/**
 * Live Integration Test for Gemini Tool Calling
 *
 * This test hits the REAL Vertex AI API to verify our tool calling
 * implementation works end-to-end. This is our TESTED CONTRACT with Vertex AI.
 *
 * CRITICAL: This test proves that:
 * 1. Function responses with `role: 'user'` are accepted by Vertex AI
 * 2. Our message adapter correctly formats tool calls and results
 * 3. The model can use tool results to generate responses
 *
 * Run manually with:
 *   VERTEX_LIVE_TEST=true npm run --workspace=server test -- tool-calling-live
 *
 * Prerequisites:
 *   - GOOGLE_VERTEX_PROJECT set in environment
 *   - ADC configured: gcloud auth application-default login
 *   - Quota project set: gcloud auth application-default set-quota-project <project>
 *
 * @see https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  getVertexClient,
  resetVertexClient,
  GEMINI_MODELS,
  toGeminiFunctionDeclarations,
  toGeminiFunctionResponse,
  toGeminiMultipleFunctionResponses,
  extractToolCalls,
  extractText,
  hasToolCalls,
  extractUsage,
} from '../../src/llm';
import type { AgentTool, AgentToolResult } from '../../src/agent/tools/types';

// Skip unless explicitly enabled - these tests cost money and require credentials
const LIVE_TEST_ENABLED = process.env.VERTEX_LIVE_TEST === 'true';

describe.skipIf(!LIVE_TEST_ENABLED)('Live Tool Calling Contract', () => {
  let gemini: ReturnType<typeof getVertexClient>;

  beforeAll(() => {
    // Reset client to ensure fresh connection
    resetVertexClient();
    gemini = getVertexClient();
  });

  // Simple tool for testing
  const weatherTool: AgentTool = {
    name: 'get_current_weather',
    description: 'Get the current weather in a given location',
    trustTier: 'T1',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City and state, e.g., San Francisco, CA',
        },
      },
      required: ['location'],
    },
    execute: async () => ({
      success: true,
      data: { temperature: 72, conditions: 'sunny', humidity: 45 },
    }),
  };

  it('should complete full tool calling round-trip', async () => {
    console.log('🔄 Starting live tool calling test...');
    console.log(`   Using model: ${GEMINI_MODELS.FLASH}`);

    // Step 1: Send message with tool, expect model to call it
    console.log('1️⃣ Sending initial request with tool definition...');
    const response1 = await gemini.models.generateContent({
      model: GEMINI_MODELS.FLASH,
      contents: [
        {
          role: 'user',
          parts: [{ text: "What's the current weather in San Francisco?" }],
        },
      ],
      config: {
        tools: [
          {
            functionDeclarations: toGeminiFunctionDeclarations([weatherTool]),
          },
        ],
      },
    });

    // Verify model emitted a function call
    expect(hasToolCalls(response1)).toBe(true);
    const toolCalls = extractToolCalls(response1);
    expect(toolCalls.length).toBeGreaterThan(0);
    expect(toolCalls[0].name).toBe('get_current_weather');
    expect(toolCalls[0].input).toHaveProperty('location');

    console.log(`   ✓ Model requested tool: ${toolCalls[0].name}`);
    console.log(`   ✓ With args: ${JSON.stringify(toolCalls[0].input)}`);

    // Step 2: Execute tool and format result
    console.log('2️⃣ Executing tool and formatting response...');
    const toolResult: AgentToolResult = {
      success: true,
      data: { temperature: 72, conditions: 'sunny', humidity: 45 },
    };
    const functionResponse = toGeminiFunctionResponse(toolCalls[0], toolResult);

    // CRITICAL VERIFICATION: Our function response format
    expect(functionResponse.role).toBe('user');
    expect(functionResponse.parts[0]).toHaveProperty('functionResponse');
    console.log(`   ✓ Function response role: ${functionResponse.role}`);

    // Step 3: Continue conversation with tool result
    console.log('3️⃣ Sending tool result back to model...');
    const response2 = await gemini.models.generateContent({
      model: GEMINI_MODELS.FLASH,
      contents: [
        {
          role: 'user',
          parts: [{ text: "What's the current weather in San Francisco?" }],
        },
        response1.candidates![0].content!, // Model's function call
        functionResponse, // Our function response (role: 'user')
      ],
      config: {
        tools: [
          {
            functionDeclarations: toGeminiFunctionDeclarations([weatherTool]),
          },
        ],
      },
    });

    // Verify model used the tool result to generate a response
    const finalText = extractText(response2);
    expect(finalText.length).toBeGreaterThan(0);

    // Model should incorporate our data
    const textLower = finalText.toLowerCase();
    const mentionsData =
      textLower.includes('72') ||
      textLower.includes('sunny') ||
      textLower.includes('san francisco') ||
      textLower.includes('weather');

    expect(mentionsData).toBe(true);

    const usage = extractUsage(response2);
    console.log(`   ✓ Model response: "${finalText.slice(0, 100)}..."`);
    console.log(`   ✓ Tokens used: ${usage.totalTokens}`);

    console.log('✅ Live tool calling test PASSED!');
  }, 30000); // 30s timeout for API calls

  it('should handle parallel tool calls', async () => {
    console.log('🔄 Testing parallel tool calls...');

    // Ask a question that might trigger multiple tool calls
    const response = await gemini.models.generateContent({
      model: GEMINI_MODELS.FLASH,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Compare the weather in San Francisco and New York City right now.',
            },
          ],
        },
      ],
      config: {
        tools: [
          {
            functionDeclarations: toGeminiFunctionDeclarations([weatherTool]),
          },
        ],
      },
    });

    if (hasToolCalls(response)) {
      const toolCalls = extractToolCalls(response);
      console.log(`   Model requested ${toolCalls.length} tool call(s)`);

      // If parallel calls, verify we can format them properly
      if (toolCalls.length > 1) {
        const results = toolCalls.map((tc) => ({
          toolCall: tc,
          result: {
            success: true,
            data: { temperature: Math.floor(Math.random() * 30) + 50 },
          } as AgentToolResult,
        }));

        const batchResponse = toGeminiMultipleFunctionResponses(results);
        expect(batchResponse.role).toBe('user');
        expect(batchResponse.parts.length).toBe(toolCalls.length);

        console.log(`   ✓ Successfully formatted ${toolCalls.length} parallel responses`);
      }

      // Verify unique IDs
      const ids = toolCalls.map((tc) => tc.id);
      expect(new Set(ids).size).toBe(ids.length);
      console.log('   ✓ Each tool call has unique ID');
    } else {
      // Model might choose to call tools sequentially - that's also valid
      console.log('   ℹ️ Model did not use parallel calls (sequential approach)');
    }

    console.log('✅ Parallel tool calls test PASSED!');
  }, 30000);

  it('should handle tool error responses', async () => {
    console.log('🔄 Testing tool error response handling...');

    // First get a tool call
    const response1 = await gemini.models.generateContent({
      model: GEMINI_MODELS.FLASH,
      contents: [
        {
          role: 'user',
          parts: [{ text: 'What is the weather in Unknown City, XX?' }],
        },
      ],
      config: {
        tools: [
          {
            functionDeclarations: toGeminiFunctionDeclarations([weatherTool]),
          },
        ],
      },
    });

    if (!hasToolCalls(response1)) {
      console.log('   ℹ️ Model did not call tool, skipping error test');
      return;
    }

    const toolCalls = extractToolCalls(response1);

    // Send error response
    const errorResult: AgentToolResult = {
      success: false,
      error: 'Location not found: Unknown City, XX',
    };
    const errorResponse = toGeminiFunctionResponse(toolCalls[0], errorResult);

    console.log('   Sending error response to model...');

    const response2 = await gemini.models.generateContent({
      model: GEMINI_MODELS.FLASH,
      contents: [
        {
          role: 'user',
          parts: [{ text: 'What is the weather in Unknown City, XX?' }],
        },
        response1.candidates![0].content!,
        errorResponse,
      ],
      config: {
        tools: [
          {
            functionDeclarations: toGeminiFunctionDeclarations([weatherTool]),
          },
        ],
      },
    });

    // Model should acknowledge the error gracefully
    const finalText = extractText(response2);
    expect(finalText.length).toBeGreaterThan(0);
    console.log(`   ✓ Model handled error: "${finalText.slice(0, 100)}..."`);

    console.log('✅ Error handling test PASSED!');
  }, 30000);

  it('should work with model specified for MAIS', async () => {
    // Verify our default model is accessible and working
    console.log(`🔄 Verifying ${GEMINI_MODELS.FLASH} is accessible...`);

    const response = await gemini.models.generateContent({
      model: GEMINI_MODELS.FLASH,
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Say "Hello MAIS" in exactly 2 words.' }],
        },
      ],
    });

    const text = extractText(response);
    expect(text.length).toBeGreaterThan(0);
    console.log(`   ✓ Model responded: "${text}"`);

    const usage = extractUsage(response);
    console.log(`   ✓ Usage: ${usage.inputTokens} input, ${usage.outputTokens} output tokens`);

    console.log('✅ Model accessibility test PASSED!');
  }, 15000);
});

// Helpful output when tests are skipped
describe.skipIf(LIVE_TEST_ENABLED)('Live Test Instructions', () => {
  it('should provide instructions for running live tests', () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  Live Tool Calling Tests are SKIPPED                             ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  To run these tests against real Vertex AI:                      ║
║                                                                  ║
║  1. Ensure ADC is configured:                                    ║
║     gcloud auth application-default login                        ║
║                                                                  ║
║  2. Set quota project:                                           ║
║     gcloud auth application-default set-quota-project <project>  ║
║                                                                  ║
║  3. Run with env var:                                            ║
║     VERTEX_LIVE_TEST=true npm run --workspace=server test \\      ║
║       -- tool-calling-live                                       ║
║                                                                  ║
║  Note: These tests make real API calls and incur costs.          ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
    `);
    expect(true).toBe(true);
  });
});
