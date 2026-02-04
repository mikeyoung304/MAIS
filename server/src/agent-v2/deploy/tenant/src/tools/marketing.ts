/**
 * Marketing Copy Tools
 *
 * Agent-native tools for generating and improving marketing copy.
 * These tools return generation context - the agent generates copy directly
 * using its native Gemini access, eliminating backend round-trips.
 *
 * Tools:
 * - generate_copy: Returns generation instructions for the agent to create copy
 * - improve_section_copy: Reads current content, returns improvement instructions
 *
 * Architecture (Post-Phase 4):
 * OLD: Agent → Backend → Vertex AI → Response (broken - routes didn't exist)
 * NEW: Agent (on Vertex AI) → generates copy directly (no backend needed)
 *
 * ============================================================================
 * IMPORTANT: INTENTIONAL EXCEPTION TO PITFALL #47
 * ============================================================================
 * These tools return INSTRUCTIONS for the LLM, not concrete results.
 * This violates Pitfall #47 ("Tools return instructions") but is an APPROVED
 * architectural exception because:
 *
 * 1. The agent already runs on Vertex AI with Gemini access - calling the
 *    backend to invoke Vertex AI again would be redundant
 * 2. Copy generation IS what the LLM is best at - having it generate copy
 *    directly is more natural than wrapping it in a backend call
 * 3. The system prompt explicitly instructs the agent to use these instructions
 *    to generate copy, then call `update_section` to apply it
 *
 * DO NOT "fix" this by adding backend copy generation routes. This is by design.
 *
 * @see docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md
 *      (Exception: Agent-Native Copy Generation)
 * ============================================================================
 *
 * Migrated from: marketing-agent (Phase 2c)
 * Redesigned: 2026-01-31 (agent-native approach)
 * @see docs/issues/2026-01-31-tenant-agent-testing-issues.md
 */

import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { callMaisApi, getTenantId, logger } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const COPY_TYPES = ['headline', 'subheadline', 'tagline', 'description', 'about', 'cta'] as const;

const TONE_OPTIONS = ['professional', 'warm', 'creative', 'luxury', 'conversational'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Parameter Schemas
// ─────────────────────────────────────────────────────────────────────────────

const GenerateCopyParams = z.object({
  copyType: z.enum(COPY_TYPES).describe('Type of copy to generate'),
  context: z.string().describe('What the copy is for (e.g., "wedding photography hero section")'),
  tone: z
    .enum(TONE_OPTIONS)
    .default('warm')
    .describe('Desired tone: professional, warm, creative, luxury, or conversational'),
  keywords: z
    .array(z.string())
    .optional()
    .describe('Keywords to incorporate (e.g., ["Austin", "wedding", "candid"])'),
  targetAudience: z
    .string()
    .optional()
    .describe('Target audience (e.g., "engaged couples in Austin")'),
  businessType: z
    .string()
    .optional()
    .describe('Type of business (e.g., "wedding photographer", "life coach")'),
});

const ImproveSectionCopyParams = z.object({
  sectionId: z
    .string()
    .min(1)
    .describe('Section ID to improve. Get from get_page_structure first.'),
  feedback: z
    .string()
    .describe('What to improve (e.g., "make it more engaging", "add urgency", "shorten it")'),
  tone: z.enum(TONE_OPTIONS).optional().describe('Target tone if changing style'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Copy Generation Templates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build generation instructions for the agent based on copy type.
 * These templates guide the agent's native LLM to generate appropriate copy.
 */
function buildCopyInstructions(params: z.infer<typeof GenerateCopyParams>): string {
  const { copyType, context, tone, keywords, targetAudience, businessType } = params;

  // Base tone descriptions
  const toneGuides: Record<string, string> = {
    professional:
      'Clean and authoritative. Confident without being stuffy. Good for consultants, coaches, B2B.',
    warm: 'Friendly and approachable. Personal and inviting. Good for photographers, therapists, wellness.',
    creative:
      'Bold and distinctive. Memorable and unique. Good for artists, designers, creative agencies.',
    luxury:
      'Elegant and exclusive. Sophisticated refinement. Good for high-end weddings, premium services.',
    conversational:
      'Casual and relatable. Like talking to a friend. Good for lifestyle brands, personal brands.',
  };

  // Copy type specifications
  const typeSpecs: Record<string, { maxLength: string; guidance: string }> = {
    headline: {
      maxLength: 'Under 10 words',
      guidance: 'Punchy, attention-grabbing. Lead with the transformation or outcome.',
    },
    subheadline: {
      maxLength: 'Under 20 words',
      guidance: 'Supports the headline. Adds context or elaborates on the promise.',
    },
    tagline: {
      maxLength: 'Under 7 words',
      guidance: 'Memorable brand phrase. Captures essence of the business.',
    },
    description: {
      maxLength: '50-150 words',
      guidance: 'Service or offering description. Benefits over features. End with soft CTA.',
    },
    about: {
      maxLength: '100-300 words',
      guidance: 'Personal story. Why you do this work. Who you serve best. Build connection.',
    },
    cta: {
      maxLength: 'Under 5 words',
      guidance: 'Action-oriented button text. Clear next step. Create urgency without pressure.',
    },
  };

  const spec = typeSpecs[copyType];
  const toneGuide = toneGuides[tone];

  // Build the instruction string
  let instructions = `Generate a ${copyType} for: ${context}\n\n`;
  instructions += `**Tone:** ${tone} - ${toneGuide}\n`;
  instructions += `**Length:** ${spec.maxLength}\n`;
  instructions += `**Style:** ${spec.guidance}\n`;

  if (businessType) {
    instructions += `**Business type:** ${businessType}\n`;
  }
  if (targetAudience) {
    instructions += `**Target audience:** ${targetAudience}\n`;
  }
  if (keywords && keywords.length > 0) {
    instructions += `**Keywords to incorporate:** ${keywords.join(', ')}\n`;
  }

  instructions += `\n**Remember:**\n`;
  instructions += `- Write ONLY the ${copyType} text, nothing else\n`;
  instructions += `- No quotation marks around the output\n`;
  instructions += `- Match the ${tone} tone precisely\n`;
  instructions += `- Stay within the length limit\n`;

  return instructions;
}

/**
 * Build improvement instructions based on current content and feedback.
 */
function buildImprovementInstructions(
  currentContent: {
    headline?: string;
    subheadline?: string;
    content?: string;
    ctaText?: string;
  },
  feedback: string,
  tone?: string
): string {
  let instructions = `Improve the following content based on this feedback: "${feedback}"\n\n`;
  instructions += `**Current content:**\n`;

  if (currentContent.headline) {
    instructions += `- Headline: "${currentContent.headline}"\n`;
  }
  if (currentContent.subheadline) {
    instructions += `- Subheadline: "${currentContent.subheadline}"\n`;
  }
  if (currentContent.content) {
    instructions += `- Content: "${currentContent.content}"\n`;
  }
  if (currentContent.ctaText) {
    instructions += `- CTA: "${currentContent.ctaText}"\n`;
  }

  instructions += `\n**Improvement guidance:**\n`;
  instructions += `- Apply the feedback: "${feedback}"\n`;
  instructions += `- Keep the same general length unless asked to shorten/lengthen\n`;
  instructions += `- Maintain brand consistency\n`;

  if (tone) {
    instructions += `- Adjust tone to: ${tone}\n`;
  }

  instructions += `\n**Output format:**\n`;
  instructions += `Provide the improved version of each field that needs updating.\n`;
  instructions += `Example: "Headline: [improved headline]" or "Content: [improved content]"\n`;

  return instructions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate Copy Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate Copy Tool (T1 - Agent-Native)
 *
 * Returns generation instructions for the agent to create marketing copy.
 * The agent uses its native Gemini access to generate the copy directly.
 *
 * Workflow:
 * 1. User asks for copy → call this tool
 * 2. Tool returns generation instructions
 * 3. Agent generates copy based on instructions
 * 4. Agent presents copy to user
 * 5. User approves → agent calls update_section
 */
export const generateCopyTool = new FunctionTool({
  name: 'generate_copy',
  description: `Get generation instructions to create marketing copy.

**This tool returns instructions - YOU generate the actual copy.**

Copy types:
- headline: Punchy headlines (under 10 words)
- subheadline: Supporting headlines (under 20 words)
- tagline: Brand taglines (under 7 words)
- description: Service descriptions (50-150 words)
- about: About section content (100-300 words)
- cta: Call-to-action button text (under 5 words)

Tone options:
- professional: Clean, authoritative (consultants, coaches)
- warm: Friendly, approachable (photographers, therapists)
- creative: Bold, distinctive (artists, designers)
- luxury: Elegant, exclusive (high-end services)
- conversational: Casual, relatable (personal brands)

**WORKFLOW:**
1. Call this tool with copyType, context, and tone
2. Read the generation instructions in the response
3. Generate the copy yourself based on those instructions
4. Present the copy to the user
5. When user approves, call update_section to apply it

This is a T1 tool - returns instructions immediately.`,
  parameters: GenerateCopyParams,
  execute: async (params, context: ToolContext | undefined) => {
    // Validate with Zod first (pitfall #62)
    const parseResult = GenerateCopyParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    const validatedParams = parseResult.data;

    // Get tenant ID from context (for logging purposes)
    const tenantId = getTenantId(context);

    logger.info(
      {
        copyType: validatedParams.copyType,
        context: validatedParams.context,
        tone: validatedParams.tone,
        tenantId,
      },
      '[TenantAgent] generate_copy called - agent-native generation'
    );

    // Build generation instructions for the agent
    const instructions = buildCopyInstructions(validatedParams);

    // Return instructions for the agent to generate copy
    // The agent's LLM will use these instructions to create the copy
    return {
      success: true,
      action: 'GENERATE_COPY',
      copyType: validatedParams.copyType,
      tone: validatedParams.tone,
      context: validatedParams.context,
      instructions,
      // Guidance for the agent on next steps
      nextStep:
        'Generate the copy based on the instructions above, then present it to the user. When they approve, call update_section to apply it.',
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Improve Section Copy Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Improve Section Copy Tool (T1 - Hybrid)
 *
 * Reads current section content from the backend, then returns improvement
 * instructions for the agent to generate improved copy.
 *
 * Workflow:
 * 1. User asks to improve a section → call this tool
 * 2. Tool fetches current content from backend
 * 3. Tool returns content + improvement instructions
 * 4. Agent generates improved copy
 * 5. Agent presents improved copy to user
 * 6. User approves → agent calls update_section
 */
export const improveSectionCopyTool = new FunctionTool({
  name: 'improve_section_copy',
  description: `Get current section content and improvement instructions.

**This tool fetches current content, then YOU generate the improvement.**

Common improvements:
- "make it more engaging"
- "add urgency"
- "shorten it"
- "make it sound more professional"
- "add a call to action"
- "make it warmer/friendlier"

**WORKFLOW:**
1. Get sectionId from get_page_structure first
2. Call this tool with sectionId and feedback
3. Read the current content and improvement instructions
4. Generate improved copy yourself based on those instructions
5. Present the improved copy to the user
6. When user approves, call update_section to apply it

This is a T1 tool - reads content and returns instructions immediately.`,
  parameters: ImproveSectionCopyParams,
  execute: async (params, context: ToolContext | undefined) => {
    // Validate with Zod first (pitfall #62)
    const parseResult = ImproveSectionCopyParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    const { sectionId, feedback, tone } = parseResult.data;

    // Get tenant ID from context
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    logger.info(
      { sectionId, feedback, tenantId },
      '[TenantAgent] improve_section_copy called - fetching current content'
    );

    // Fetch current content using existing storefront endpoint
    const result = await callMaisApi('/storefront/section', tenantId, { sectionId });

    if (!result.ok) {
      return {
        success: false,
        error: `Could not read section content: ${result.error}`,
      };
    }

    const sectionData = result.data as {
      headline?: string;
      subheadline?: string;
      content?: string;
      ctaText?: string;
      blockType?: string;
    };

    // Build improvement instructions
    const instructions = buildImprovementInstructions(
      {
        headline: sectionData.headline,
        subheadline: sectionData.subheadline,
        content: sectionData.content,
        ctaText: sectionData.ctaText,
      },
      feedback,
      tone
    );

    // Return current content + improvement instructions
    return {
      success: true,
      action: 'IMPROVE_COPY',
      sectionId,
      blockType: sectionData.blockType,
      currentContent: {
        headline: sectionData.headline,
        subheadline: sectionData.subheadline,
        content: sectionData.content,
        ctaText: sectionData.ctaText,
      },
      feedback,
      instructions,
      // Guidance for the agent on next steps
      nextStep:
        'Generate improved copy based on the instructions above, then present it to the user. When they approve, call update_section with the sectionId to apply it.',
    };
  },
});
