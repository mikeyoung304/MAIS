/**
 * Vocabulary Resolution Tool
 *
 * T1 tool for resolving natural language phrases to BlockTypes using
 * the VocabularyEmbeddingService's semantic search capabilities.
 *
 * This tool calls the MAIS backend's vocabulary resolution endpoint,
 * which uses pgvector embeddings to find the best matching BlockType
 * for user phrases like "my bio", "reviews section", "main banner", etc.
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 * @see server/src/services/vocabulary-embedding.service.ts
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import {
  callMaisApi as _callMaisApi,
  logger,
  getTenantId,
  TIMEOUTS,
  fetchWithTimeout,
} from '../utils.js';
import type { BlockType } from '../context-builder.js';

// ─────────────────────────────────────────────────────────────────────────────
// Environment Configuration
// ─────────────────────────────────────────────────────────────────────────────

const MAIS_API_URL = process.env.MAIS_API_URL || 'https://api.gethandled.ai';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
const AGENT_API_PATH = process.env.AGENT_API_PATH || '/v1/internal/agent';

// ─────────────────────────────────────────────────────────────────────────────
// Parameter Schema
// ─────────────────────────────────────────────────────────────────────────────

const ResolveVocabularyParams = z.object({
  phrase: z
    .string()
    .min(1)
    .max(200)
    .describe(
      'The natural language phrase to resolve. Examples: "my bio", "about section", "hero banner", "reviews", "pricing section", "contact info"'
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────────────────────

interface VocabularyResolutionResult {
  blockType: BlockType | null;
  confidence: number;
  matchedPhrase: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve Vocabulary Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve Vocabulary Tool (T1)
 *
 * Resolves a natural language phrase to its corresponding BlockType using
 * semantic similarity search. This enables users to refer to sections in
 * natural ways like "my story" (→ ABOUT) or "client testimonials" (→ TESTIMONIALS).
 *
 * The tool calls the MAIS backend which uses:
 * - VocabularyEmbeddingService.resolveBlockType()
 * - pgvector cosine similarity search
 * - 0.7 minimum confidence threshold
 *
 * Usage:
 * 1. Agent receives request like "update my about section"
 * 2. Agent calls resolve_vocabulary("about section")
 * 3. Tool returns { blockType: "ABOUT", confidence: 0.95 }
 * 4. Agent uses blockType to call update_section
 */
export const resolveVocabularyTool = new FunctionTool({
  name: 'resolve_vocabulary',
  description: `Resolve a natural language phrase to its BlockType (section type).

Use this when:
- User mentions a section by a non-standard name ("my bio" → ABOUT)
- User uses casual language ("header" → HERO, "reviews" → TESTIMONIALS)
- You need to map user intent to a specific section type

Returns:
- blockType: The matched section type (HERO, ABOUT, SERVICES, etc.) or null
- confidence: Match confidence score (0.0 to 1.0)
- matchedPhrase: The canonical phrase that matched

If confidence is low (<0.7), blockType will be null. Ask the user to clarify.

Common mappings:
- "bio", "about me", "my story" → ABOUT
- "header", "banner", "hero" → HERO
- "reviews", "testimonials" → TESTIMONIALS
- "packages", "pricing", "rates" → PRICING
- "questions", "FAQ" → FAQ
- "portfolio", "gallery", "work samples" → GALLERY

This is a T1 tool - executes immediately.`,
  parameters: ResolveVocabularyParams,
  execute: async (params, context) => {
    // Validate with Zod first (pitfall #62)
    const parseResult = ResolveVocabularyParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    const { phrase } = parseResult.data;
    const tenantId = getTenantId(context);

    logger.info({ phrase, tenantId }, '[TenantAgent] Resolving vocabulary');

    // Call the vocabulary resolution endpoint
    // Note: tenantId is optional for vocabulary resolution (it's a global service)
    // but we pass it for logging/analytics purposes
    try {
      const response = await fetchWithTimeout(
        `${MAIS_API_URL}${AGENT_API_PATH}/vocabulary/resolve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': INTERNAL_API_SECRET || '',
          },
          body: JSON.stringify({
            phrase,
            tenantId, // Optional - for logging
          }),
        },
        TIMEOUTS.VOCABULARY_RESOLVE
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, error: errorText },
          '[TenantAgent] Vocabulary resolution failed'
        );
        return {
          success: false,
          error: `Failed to resolve vocabulary: ${response.status}`,
          suggestion: 'Ask the user to specify which section they mean',
        };
      }

      const result = (await response.json()) as VocabularyResolutionResult;

      if (!result.blockType) {
        logger.info(
          { phrase, confidence: result.confidence },
          '[TenantAgent] No confident vocabulary match'
        );
        return {
          success: true,
          blockType: null,
          confidence: result.confidence,
          matchedPhrase: null,
          message: `Could not confidently match "${phrase}" to a section type. Confidence: ${(result.confidence * 100).toFixed(0)}%`,
          suggestion: 'Ask the user to clarify which section they want to work on',
        };
      }

      logger.info(
        {
          phrase,
          blockType: result.blockType,
          confidence: result.confidence,
          matchedPhrase: result.matchedPhrase,
        },
        '[TenantAgent] Vocabulary resolved'
      );

      return {
        success: true,
        blockType: result.blockType,
        confidence: result.confidence,
        matchedPhrase: result.matchedPhrase,
        message: `"${phrase}" → ${result.blockType} (${(result.confidence * 100).toFixed(0)}% confidence)`,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error({ phrase }, '[TenantAgent] Vocabulary resolution timeout');
        return {
          success: false,
          error: 'Vocabulary resolution timed out',
          suggestion: 'Ask the user to specify the section type directly',
        };
      }

      logger.error(
        { error: error instanceof Error ? error.message : String(error), phrase },
        '[TenantAgent] Vocabulary resolution error'
      );
      return {
        success: false,
        error: 'Failed to resolve vocabulary',
        suggestion: 'Ask the user to specify which section they want to work on',
      };
    }
  },
});
