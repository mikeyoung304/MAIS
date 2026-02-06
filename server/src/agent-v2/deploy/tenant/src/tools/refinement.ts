/**
 * Guided Refinement Tools
 *
 * Tools for the section-by-section editing experience.
 * These tools manage the guided refinement state machine and variant selection.
 *
 * Tools:
 * - generate_section_variants (T1): Generate 3 tone variants for a section
 * - apply_section_variant (T2): Apply selected variant to draft
 * - mark_section_complete (T1): Mark section as complete
 * - get_next_incomplete_section (T1): Get next section to refine
 *
 * State Storage:
 * - Uses ADK session state via context.state.set/get
 * - State persists for session duration (7+ days with Vertex AI)
 * - See docs/spikes/2026-02-04-adk-session-state-spike.md
 *
 * @see docs/plans/2026-02-04-feat-guided-refinement-implementation-plan.md
 */

import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { callMaisApi, getTenantId, logger } from '../utils.js';
import type {
  GuidedRefinementState,
  PreferenceMemory,
  ToneVariant,
  VariantContent,
  SectionVariantSet,
} from '../types/guided-refinement.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TONE_VARIANTS = ['professional', 'premium', 'friendly'] as const;
const STATE_KEY = 'guidedRefinementState';
const MAX_TONE_HISTORY = 5;

/**
 * Total canonical sections matching SECTION_BLUEPRINT in @macon/contracts.
 * @macon/contracts is not available in the agent deploy — keep in sync manually.
 * @see packages/contracts/src/schemas/section-blueprint.schema.ts
 */
const TOTAL_SECTIONS = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create initial guided refinement state.
 */
function createInitialState(): GuidedRefinementState {
  const now = new Date().toISOString();
  return {
    mode: 'interview',
    currentSectionId: null,
    completedSections: [],
    sectionVariants: {},
    preferenceMemory: {
      toneHistory: [],
    },
    startedAt: now,
    lastActivityAt: now,
  };
}

/**
 * Get guided refinement state from session, creating if needed.
 */
function getState(context: ToolContext): GuidedRefinementState {
  const stored = context.state.get<GuidedRefinementState>(STATE_KEY);
  if (stored) {
    return stored;
  }
  const initial = createInitialState();
  context.state.set(STATE_KEY, initial);
  return initial;
}

/**
 * Save guided refinement state to session.
 */
function saveState(context: ToolContext, state: GuidedRefinementState): void {
  state.lastActivityAt = new Date().toISOString();
  context.state.set(STATE_KEY, state);
}

/**
 * Update preference memory based on tone selection.
 * Detects patterns in user's tone choices.
 */
function updatePreferenceMemory(
  memory: PreferenceMemory,
  selectedTone: ToneVariant
): PreferenceMemory {
  const history = memory.toneHistory || [];
  history.push(selectedTone);

  // Keep only last N selections
  if (history.length > MAX_TONE_HISTORY) {
    history.shift();
  }

  // Detect preferred tone: same tone selected 2+ times in last 3
  const lastThree = history.slice(-3);
  const toneCounts = lastThree.reduce(
    (acc, tone) => {
      acc[tone] = (acc[tone] || 0) + 1;
      return acc;
    },
    {} as Record<ToneVariant, number>
  );

  let preferredTone = memory.preferredTone;
  for (const [tone, count] of Object.entries(toneCounts)) {
    if (count >= 2) {
      preferredTone = tone as ToneVariant;
      break;
    }
  }

  return {
    ...memory,
    toneHistory: history,
    preferredTone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parameter Schemas
// ─────────────────────────────────────────────────────────────────────────────

const GenerateSectionVariantsParams = z.object({
  sectionId: z
    .string()
    .min(1)
    .max(50)
    .describe('Section ID to generate variants for. Get from get_page_structure first.'),
});

const ApplySectionVariantParams = z.object({
  sectionId: z.string().min(1).max(50).describe('Section ID to apply variant to'),
  variant: z
    .enum(TONE_VARIANTS)
    .describe('Which tone variant to apply: professional, premium, or friendly'),
});

const MarkSectionCompleteParams = z.object({
  sectionId: z.string().min(1).max(50).describe('Section ID to mark as complete'),
});

// Empty params schema for get_next_incomplete_section
const GetNextIncompleteSectionParams = z.object({});

// ─────────────────────────────────────────────────────────────────────────────
// Generate Section Variants Tool (T1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate Section Variants Tool (T1)
 *
 * Generates 3 tone variants (Professional/Premium/Friendly) for a section.
 * The variants are stored in session state and displayed in the widget.
 *
 * This is a T1 tool because it only reads current content and generates
 * in-memory variants. No persistent state is changed until apply is called.
 *
 * Rate limited: Backend enforces 10/min per tenant (pitfall H6).
 */
export const generateSectionVariantsTool = new FunctionTool({
  name: 'generate_section_variants',
  description: `Generate 3 tone variants for a section: Professional, Premium, and Friendly.

**WORKFLOW:**
1. Call get_page_structure to get section IDs
2. Call this tool with the sectionId
3. Present your recommendation with rationale
4. Wait for user to select a variant or ask for regeneration

**TONE DESCRIPTIONS:**
- Professional: Authoritative, builds trust, clear and direct
- Premium: Luxury feel, sophisticated vocabulary, elevated tone
- Friendly: Approachable, conversational, warm

**WHAT TO SAY AFTER:**
"For your [section], I'd go with the Professional version—it matches your serious clientele. [Show headline]. Thoughts?"

This is a T1 tool - generates options without changing the draft.`,
  parameters: GenerateSectionVariantsParams,
  execute: async (params, context: ToolContext | undefined) => {
    // REQUIRED: Zod validation as first line (Pitfall #56)
    const parseResult = GenerateSectionVariantsParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }
    const { sectionId } = parseResult.data;

    // Get tenant ID from context
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    // Check context.state is available
    if (!context?.state) {
      return {
        success: false,
        error: 'Session state not available',
      };
    }

    logger.info({ sectionId, tenantId }, '[TenantAgent] generate_section_variants called');

    // 1. Get current section content
    const sectionResult = await callMaisApi('/storefront/section', tenantId, { sectionId });
    if (!sectionResult.ok) {
      return {
        success: false,
        error: `Could not fetch section: ${sectionResult.error}`,
      };
    }

    const section = sectionResult.data as {
      type: string;
      headline?: string;
      subheadline?: string;
      content?: string;
    };

    // 2. Generate variants via backend API (handles LLM call + sanitization)
    const variantsResult = await callMaisApi('/storefront/generate-variants', tenantId, {
      sectionId,
      sectionType: section.type,
      currentContent: {
        headline: section.headline,
        subheadline: section.subheadline,
        content: section.content,
      },
      tones: TONE_VARIANTS,
    });

    if (!variantsResult.ok) {
      return {
        success: false,
        error: `Could not generate variants: ${variantsResult.error}`,
      };
    }

    const generated = variantsResult.data as {
      variants: Record<ToneVariant, VariantContent>;
      recommendation: ToneVariant;
      rationale: string;
    };

    // 3. Store variants in session state
    const state = getState(context);
    const variantSet: SectionVariantSet = {
      professional: generated.variants.professional,
      premium: generated.variants.premium,
      friendly: generated.variants.friendly,
      selectedVariant: null,
      isComplete: false,
      generatedAt: new Date().toISOString(),
    };
    state.sectionVariants[sectionId] = variantSet;
    state.currentSectionId = sectionId;
    state.mode = 'guided_refine';
    saveState(context, state);

    logger.info(
      { sectionId, recommendation: generated.recommendation },
      '[TenantAgent] Variants generated'
    );

    // 4. Return with Active Memory Pattern fields
    return {
      success: true,
      sectionId,
      sectionType: section.type,
      variants: {
        professional: {
          headline: generated.variants.professional.headline,
          body:
            generated.variants.professional.content || generated.variants.professional.subheadline,
        },
        premium: {
          headline: generated.variants.premium.headline,
          body: generated.variants.premium.content || generated.variants.premium.subheadline,
        },
        friendly: {
          headline: generated.variants.friendly.headline,
          body: generated.variants.friendly.content || generated.variants.friendly.subheadline,
        },
      },
      recommendation: generated.recommendation,
      rationale: generated.rationale,
      // Active Memory Pattern additions
      hasDraft: true,
      totalSections:
        Object.keys(state.sectionVariants).length + (state.completedSections.length || 0),
      currentProgress: {
        completed: state.completedSections.length,
        total: TOTAL_SECTIONS,
      },
      dashboardAction: {
        type: 'SHOW_VARIANT_WIDGET',
        sectionId,
        variants: ['professional', 'premium', 'friendly'],
      },
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Apply Section Variant Tool (T2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply Section Variant Tool (T2)
 *
 * Applies the selected variant to the section in DRAFT.
 * Also updates preference memory based on user's choice.
 *
 * This is a T2 tool because it modifies draft content.
 */
export const applySectionVariantTool = new FunctionTool({
  name: 'apply_section_variant',
  description: `Apply a selected variant to a section. Changes go to DRAFT.

**WORKFLOW:**
1. User selects a variant (or you recommend one)
2. Call this tool with sectionId and variant name
3. Confirm: "Professional variant applied. Want to mark this section complete?"

**IMPORTANT - Draft vs Live:**
- Changes go to DRAFT (visible in dashboard preview only)
- NOT visible to customers until published

This is a T2 tool - applies changes to draft.`,
  parameters: ApplySectionVariantParams,
  execute: async (params, context: ToolContext | undefined) => {
    // REQUIRED: Zod validation as first line (Pitfall #56)
    const parseResult = ApplySectionVariantParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }
    const { sectionId, variant } = parseResult.data;

    // Get tenant ID from context
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    // Check context.state is available
    if (!context?.state) {
      return {
        success: false,
        error: 'Session state not available',
      };
    }

    logger.info({ sectionId, variant, tenantId }, '[TenantAgent] apply_section_variant called');

    // 1. Get stored variants
    const state = getState(context);
    const variantSet = state.sectionVariants[sectionId];

    if (!variantSet) {
      return {
        success: false,
        error: 'No variants generated for this section. Call generate_section_variants first.',
      };
    }

    const selectedContent = variantSet[variant];
    if (!selectedContent) {
      return {
        success: false,
        error: `Variant "${variant}" not found in generated options.`,
      };
    }

    // 2. Apply variant to draft via backend API
    const updateResult = await callMaisApi('/storefront/update-section', tenantId, {
      sectionId,
      ...selectedContent,
    });

    if (!updateResult.ok) {
      return {
        success: false,
        error: `Could not apply variant: ${updateResult.error}`,
      };
    }

    // 3. Update session state
    variantSet.selectedVariant = variant;
    state.sectionVariants[sectionId] = variantSet;
    state.preferenceMemory = updatePreferenceMemory(state.preferenceMemory, variant);
    saveState(context, state);

    // 4. Verify the write (pitfall #48)
    const verifyResult = await callMaisApi('/storefront/section', tenantId, { sectionId });

    logger.info(
      { sectionId, variant, preferredTone: state.preferenceMemory.preferredTone },
      '[TenantAgent] Variant applied'
    );

    return {
      success: true,
      verified: verifyResult.ok,
      visibility: 'draft' as const,
      sectionId,
      appliedVariant: variant,
      updatedContent: verifyResult.ok ? verifyResult.data : selectedContent,
      hasDraft: true,
      preferenceMemory: state.preferenceMemory,
      message: `${variant.charAt(0).toUpperCase() + variant.slice(1)} variant applied to draft.`,
      suggestion: 'Mark this section complete to move to the next one.',
      dashboardAction: {
        type: 'SCROLL_TO_SECTION',
        sectionId,
      },
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Mark Section Complete Tool (T1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark Section Complete Tool (T1)
 *
 * Marks a section as complete in the guided refinement flow.
 * When all sections are complete, transitions to publish_ready mode.
 *
 * This is a T1 tool because it only updates session state.
 */
export const markSectionCompleteTool = new FunctionTool({
  name: 'mark_section_complete',
  description: `Mark a section as complete in guided refinement.

**WORKFLOW:**
1. After user approves a variant, call this tool
2. If more sections remain, say "Moving to [next section]"
3. If all complete, say "All sections complete! Ready to publish?"

**STATE MACHINE:**
- Tracks completedSections array
- When all complete: mode → 'publish_ready'
- User can still edit completed sections later

This is a T1 tool - updates state only.`,
  parameters: MarkSectionCompleteParams,
  execute: async (params, context: ToolContext | undefined) => {
    // REQUIRED: Zod validation as first line (Pitfall #56)
    const parseResult = MarkSectionCompleteParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }
    const { sectionId } = parseResult.data;

    // Check context.state is available
    if (!context?.state) {
      return {
        success: false,
        error: 'Session state not available',
      };
    }

    logger.info({ sectionId }, '[TenantAgent] mark_section_complete called');

    // 1. Get current state
    const state = getState(context);

    // 2. Mark complete (avoid duplicates)
    if (!state.completedSections.includes(sectionId)) {
      state.completedSections.push(sectionId);
    }

    // Mark the variant set as complete
    if (state.sectionVariants[sectionId]) {
      state.sectionVariants[sectionId].isComplete = true;
    }

    // 3. Check if all complete
    const totalSections = TOTAL_SECTIONS;
    const allComplete = state.completedSections.length >= totalSections;

    if (allComplete) {
      state.mode = 'publish_ready';
    }

    // 4. Save state
    saveState(context, state);

    logger.info(
      { sectionId, completed: state.completedSections.length, total: totalSections, allComplete },
      '[TenantAgent] Section marked complete'
    );

    return {
      success: true,
      sectionId,
      completedSections: state.completedSections,
      totalSections,
      allComplete,
      mode: state.mode,
      message: allComplete
        ? 'All sections complete! Your site is ready to publish.'
        : `${state.completedSections.length}/${totalSections} sections complete.`,
      dashboardAction: allComplete
        ? { type: 'SHOW_PUBLISH_READY' }
        : { type: 'HIGHLIGHT_NEXT_SECTION' },
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Get Next Incomplete Section Tool (T1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get Next Incomplete Section Tool (T1)
 *
 * Returns the next section that needs refinement.
 * Updates currentSectionId in state.
 *
 * This is a T1 tool because it only reads and updates session state.
 */
export const getNextIncompleteSectionTool = new FunctionTool({
  name: 'get_next_incomplete_section',
  description: `Get the next section that needs refinement.

**WORKFLOW:**
1. Call after marking a section complete
2. If more sections: "Moving to your [section type] section"
3. If all complete: Announce publish readiness

**RETURNS:**
- nextSection: { sectionId, type, headline, hasVariants }
- progress: { completed, total }
- allComplete: boolean

This is a T1 tool - reads state only.`,
  parameters: GetNextIncompleteSectionParams,
  execute: async (params, context: ToolContext | undefined) => {
    // REQUIRED: Zod validation as first line (Pitfall #56)
    const parseResult = GetNextIncompleteSectionParams.safeParse(params);
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

    // Check context.state is available
    if (!context?.state) {
      return {
        success: false,
        error: 'Session state not available',
      };
    }

    logger.info({ tenantId }, '[TenantAgent] get_next_incomplete_section called');

    // 1. Get page structure
    const structureResult = await callMaisApi('/storefront/structure', tenantId, {});
    if (!structureResult.ok) {
      return {
        success: false,
        error: `Could not fetch page structure: ${structureResult.error}`,
      };
    }

    const pages = structureResult.data as Array<{
      pageName: string;
      sections: Array<{
        sectionId: string;
        type: string;
        headline?: string;
      }>;
    }>;

    // 2. Get completed sections from state
    const state = getState(context);

    // 3. Find first incomplete section
    const allSections = pages.flatMap((page) => page.sections);
    const nextSection = allSections.find((s) => !state.completedSections.includes(s.sectionId));

    if (!nextSection) {
      // All complete
      state.mode = 'publish_ready';
      saveState(context, state);

      return {
        success: true,
        allComplete: true,
        mode: 'publish_ready',
        progress: {
          completed: state.completedSections.length,
          total: allSections.length,
        },
        message: 'All sections are complete! Your site is ready to publish.',
        dashboardAction: { type: 'SHOW_PUBLISH_READY' },
      };
    }

    // 4. Update current section
    state.currentSectionId = nextSection.sectionId;
    saveState(context, state);

    // Determine if this section type supports variants
    const variantSectionTypes = ['hero', 'text', 'about', 'cta', 'features'];
    const hasVariants = variantSectionTypes.includes(nextSection.type);

    logger.info(
      { sectionId: nextSection.sectionId, type: nextSection.type },
      '[TenantAgent] Next section identified'
    );

    return {
      success: true,
      allComplete: false,
      nextSection: {
        sectionId: nextSection.sectionId,
        type: nextSection.type,
        headline: nextSection.headline,
        hasVariants,
      },
      progress: {
        completed: state.completedSections.length,
        total: allSections.length,
      },
      message: hasVariants
        ? `Moving to your ${nextSection.type} section. Want me to generate tone variants?`
        : `Moving to your ${nextSection.type} section. This one doesn't need variants—let me check if it looks good.`,
      dashboardAction: {
        type: 'SCROLL_TO_SECTION',
        sectionId: nextSection.sectionId,
      },
    };
  },
});
