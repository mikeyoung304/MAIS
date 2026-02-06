/**
 * First Draft Tool for Tenant Agent
 *
 * Agent-orchestrated tool that identifies placeholder sections ready for
 * content generation. The tool gathers page structure + known facts from
 * the backend, then returns structured data for the LLM to generate
 * personalized copy using update_section.
 *
 * This is an ORCHESTRATOR tool — it doesn't generate copy itself.
 * Flow: build_first_draft → LLM generates copy → update_section × N
 *
 * @see docs/plans/2026-02-05-feat-onboarding-ecosystem-rebuild-plan.md (Phase 5)
 * @see docs/solutions/agent-issues/AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md
 */

import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { logger, callMaisApi, getTenantId } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parameter Schema
// ─────────────────────────────────────────────────────────────────────────────

const BuildFirstDraftParams = z.object({});

// ─────────────────────────────────────────────────────────────────────────────
// Build First Draft Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build First Draft Tool (T2)
 *
 * Called when the slot machine returns nextAction: 'BUILD_FIRST_DRAFT'.
 * Gathers all the information the LLM needs to generate a complete first
 * draft of the storefront in a single turn:
 *
 * 1. Gets page structure with placeholder flags
 * 2. Gets known discovery facts
 * 3. Filters to placeholder sections that are ready to build
 * 4. Returns structured data for the LLM to generate copy
 *
 * After receiving this tool's result, the agent should:
 * - Generate personalized copy for each section using known facts + tone
 * - Call update_section for each section (no approval needed for first draft)
 * - Announce what it built with narrative explanation
 */
export const buildFirstDraftTool = new FunctionTool({
  name: 'build_first_draft',
  description: `Identify all placeholder sections that need content and return them with known facts.

Call this when store_discovery_fact returns nextAction: 'BUILD_FIRST_DRAFT'.

This tool gathers everything you need to build the first draft:
- Which sections still have placeholder content
- Which sections have enough facts to build (readySections)
- All known discovery facts to use for copy generation

After calling this, for each section in sectionsToUpdate:
1. Generate personalized copy using knownFacts and the business tone
2. Call update_section with the generated content
3. Explain WHY you wrote what you wrote (build with narrative)

No user approval needed for first draft — just build and announce.`,

  parameters: BuildFirstDraftParams,

  execute: async (_params, context: ToolContext | undefined) => {
    // Validate params (pitfall #56)
    const parseResult = BuildFirstDraftParams.safeParse(_params);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid parameters: ${parseResult.error.message}`,
      };
    }

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    logger.info({ tenantId }, '[TenantAgent] build_first_draft called');

    // 1. Get page structure with placeholder flags
    const structureResult = await callMaisApi('/storefront/structure', tenantId, {});

    if (!structureResult.ok) {
      return {
        success: false,
        error: `Could not get page structure: ${structureResult.error}`,
        suggestion: 'Try calling get_page_structure to check the storefront state.',
      };
    }

    // 2. Get known facts
    const factsResult = await callMaisApi('/get-discovery-facts', tenantId);

    if (!factsResult.ok) {
      return {
        success: false,
        error: `Could not get discovery facts: ${factsResult.error}`,
        suggestion: 'Try calling get_known_facts to check what you know.',
      };
    }

    const structureData = structureResult.data as {
      pages: Array<{
        pageName: string;
        enabled: boolean;
        sections: Array<{
          id: string;
          type: string;
          headline?: string;
          isPlaceholder?: boolean;
        }>;
      }>;
      hasDraft: boolean;
    };

    const factsData = factsResult.data as {
      facts: Record<string, unknown>;
      factCount: number;
      factKeys: string[];
    };

    // 3. Collect all placeholder sections across all pages
    const allSections = structureData.pages.flatMap((page) =>
      page.sections.map((section) => ({
        ...section,
        pageName: page.pageName,
      }))
    );

    const placeholderSections = allSections.filter((s) => s.isPlaceholder);

    if (placeholderSections.length === 0) {
      return {
        success: true,
        sectionsToUpdate: [],
        knownFacts: factsData.facts,
        message:
          'No placeholder sections found — all sections already have content. Offer to refine existing content instead.',
      };
    }

    // 4. Return structured data for the LLM to generate copy
    const sectionsToUpdate = placeholderSections.map((s) => ({
      sectionId: s.id,
      sectionType: s.type,
      pageName: s.pageName,
      currentHeadline: s.headline ?? '(no headline)',
    }));

    logger.info(
      {
        tenantId,
        placeholderCount: sectionsToUpdate.length,
        totalSections: allSections.length,
        factCount: factsData.factCount,
      },
      '[TenantAgent] build_first_draft identified sections'
    );

    return {
      success: true,
      sectionsToUpdate,
      knownFacts: factsData.facts,
      factKeys: factsData.factKeys,
      totalPlaceholders: sectionsToUpdate.length,
      instruction:
        'Generate personalized content for each section below using the known facts. Call update_section for each one. Explain WHY you wrote what you wrote — build with narrative.',
      // Scroll to the first section being built
      dashboardAction: sectionsToUpdate[0]
        ? { type: 'SCROLL_TO_SECTION', sectionId: sectionsToUpdate[0].sectionId }
        : undefined,
    };
  },
});
