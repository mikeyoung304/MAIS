/**
 * Marketing Copy Tools
 *
 * T1 tools for generating and improving marketing copy.
 * These tools generate content suggestions - they don't modify the storefront directly.
 * Use update_section to apply generated copy to sections.
 *
 * Tools:
 * - generate_copy: Generate marketing copy (headlines, descriptions, taglines)
 * - improve_section_copy: Improve existing section content
 *
 * Migrated from: marketing-agent (Phase 2c)
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { callMaisApi, getTenantId, logger } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const COPY_TYPES = ['headline', 'description', 'tagline', 'about'] as const;

const TONE_OPTIONS = ['professional', 'warm', 'creative', 'luxury'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Parameter Schemas
// ─────────────────────────────────────────────────────────────────────────────

const GenerateCopyParams = z.object({
  copyType: z.enum(COPY_TYPES).describe('Type of copy to generate'),
  context: z.string().describe('What the copy is for (e.g., "hero section", "wedding packages")'),
  tone: z
    .enum(TONE_OPTIONS)
    .default('warm')
    .describe('Desired tone: professional, warm, creative, or luxury'),
  keywords: z
    .array(z.string())
    .optional()
    .describe('Keywords to incorporate (e.g., ["Austin", "wedding", "luxury"])'),
  targetAudience: z
    .string()
    .optional()
    .describe('Target audience (e.g., "engaged couples", "busy professionals")'),
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
// Generate Copy Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate Copy Tool (T1)
 *
 * Generates marketing copy. Returns the best option based on context and tone.
 * Does NOT apply changes directly - user reviews and calls update_section.
 *
 * Copy types:
 * - headline: Short, punchy headlines (under 10 words)
 * - description: Service descriptions (50-150 words)
 * - tagline: Brand taglines (under 7 words)
 * - about: About section content (100-300 words)
 *
 * Tone options:
 * - professional: Clean, authoritative (consultants, coaches)
 * - warm: Friendly, approachable (photographers, therapists)
 * - creative: Bold, distinctive (artists, designers)
 * - luxury: Elegant, exclusive (high-end weddings)
 */
export const generateCopyTool = new FunctionTool({
  name: 'generate_copy',
  description: `Generate marketing copy. Returns the best option for the given context.

**Copy types:**
- headline: Short punchy headlines (under 10 words)
- description: Service descriptions (50-150 words)
- tagline: Brand taglines (under 7 words)
- about: About section content (100-300 words)

**Tone options:**
- professional: Clean, authoritative. Good for consultants, coaches, B2B.
- warm: Friendly, approachable. Good for photographers, therapists.
- creative: Bold, distinctive. Good for artists, unique brands.
- luxury: Elegant, exclusive. Good for high-end weddings, premium services.

**WORKFLOW:**
1. User asks for copy → call this tool with type and context
2. Present the generated copy to user
3. User approves (or asks for revision)
4. Call update_section to apply it

This is a T1 tool - generates copy only, doesn't change storefront.`,
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

    // Get tenant ID from context
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    logger.info(
      { copyType: parseResult.data.copyType, context: parseResult.data.context },
      '[TenantAgent] generate_copy called'
    );

    // Call backend API
    const result = await callMaisApi('/marketing/generate-copy', tenantId, {
      copyType: parseResult.data.copyType,
      context: parseResult.data.context,
      tone: parseResult.data.tone,
      keywords: parseResult.data.keywords,
      targetAudience: parseResult.data.targetAudience,
    });

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    // Return generated copy
    return {
      success: true,
      copyType: parseResult.data.copyType,
      tone: parseResult.data.tone,
      // Backend returns: { copy: "...", rationale: "..." }
      ...(result.data as Record<string, unknown>),
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Improve Section Copy Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Improve Section Copy Tool (T2)
 *
 * Improves existing section content based on feedback.
 * Reads current content, generates improved version, applies to DRAFT.
 *
 * Common improvement requests:
 * - "make it more engaging"
 * - "add urgency"
 * - "shorten it"
 * - "make it sound more professional"
 * - "add a call to action"
 */
export const improveSectionCopyTool = new FunctionTool({
  name: 'improve_section_copy',
  description: `Improve existing section content based on feedback.

Reads the current content, generates an improved version, and applies it to DRAFT.

**Common improvements:**
- "make it more engaging"
- "add urgency"
- "shorten it"
- "make it sound more professional"
- "add a call to action"
- "make it warmer/friendlier"

**WORKFLOW:**
1. Get sectionId from get_page_structure first
2. Call this tool with sectionId and feedback
3. Improved copy is applied to draft
4. Tell user to check the preview

This is a T2 tool - reads current content, generates improvement, applies to draft.`,
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

    // Get tenant ID from context
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    logger.info(
      { sectionId: parseResult.data.sectionId, feedback: parseResult.data.feedback },
      '[TenantAgent] improve_section_copy called'
    );

    // Call backend API - this reads current content, generates improvement, and applies to draft
    const result = await callMaisApi('/marketing/improve-section', tenantId, {
      sectionId: parseResult.data.sectionId,
      feedback: parseResult.data.feedback,
      tone: parseResult.data.tone,
    });

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    // Return with hasDraft flag since we modified the storefront (pitfall #52)
    return {
      success: true,
      hasDraft: true,
      message: 'Section copy improved in draft',
      ...(result.data as Record<string, unknown>),
    };
  },
});
