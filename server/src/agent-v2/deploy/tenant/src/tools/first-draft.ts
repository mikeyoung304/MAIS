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

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import {
  logger,
  callMaisApi,
  callMaisApiTyped,
  requireTenantId,
  validateParams,
  wrapToolExecute,
} from '../utils.js';
import {
  StorefrontStructureResponse,
  GetDiscoveryFactsResponse,
  GetResearchDataResponse,
  PackageListResponse,
} from '../types/api-responses.js';
import { MVP_SECTION_TYPES, SEED_PACKAGE_NAMES } from '../constants/shared.js';

/** Shape of pre-computed research data from the backend */
interface ResearchData {
  competitorPricing?: { low: number; high: number; currency: string; summary: string };
  marketPositioning?: string[];
  localDemand?: string;
  insights?: string[];
}

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
  description: `Get ALL MVP sections (HERO, ABOUT, SERVICES) + known facts + research data for first draft.

Call this when store_discovery_fact returns nextAction: 'BUILD_FIRST_DRAFT'.

This tool returns everything you need to build the first draft in one turn:
- ALL three MVP sections to write (always returns HERO, ABOUT, SERVICES)
- All known discovery facts to use for copy generation
- Pre-computed research data with competitor pricing (if available)

IMPORTANT: This tool always returns MVP sections for overwrite. Seed defaults are NOT real content. Never refuse to build.

After calling this, for EACH section in sectionsToUpdate:
1. Generate personalized copy using knownFacts, business tone, and researchData
2. Call update_section with the generated content
3. Explain WHY you wrote what you wrote (build with narrative)
4. Do NOT stop after one section — update ALL THREE in this turn

No user approval needed for first draft — just build and announce.`,

  parameters: BuildFirstDraftParams,

  execute: wrapToolExecute(async (_params, context) => {
    validateParams(BuildFirstDraftParams, _params);
    const tenantId = requireTenantId(context);

    logger.info({ tenantId }, '[TenantAgent] build_first_draft called');

    // 1. Fetch all data in parallel — structure + facts are required,
    //    research + packages are optional (failures won't block the build)
    const [structureResult, factsResult, researchResult, listResult] = await Promise.all([
      callMaisApiTyped('/storefront/structure', tenantId, {}, StorefrontStructureResponse),
      callMaisApiTyped('/get-discovery-facts', tenantId, {}, GetDiscoveryFactsResponse),
      callMaisApiTyped('/get-research-data', tenantId, {}, GetResearchDataResponse).catch(() => {
        logger.debug({ tenantId }, '[TenantAgent] Research data fetch failed, continuing without');
        return { ok: false as const, error: 'Research unavailable' };
      }),
      callMaisApiTyped(
        '/content-generation/manage-packages',
        tenantId,
        { action: 'list' },
        PackageListResponse
      ).catch(() => {
        return { ok: false as const, error: 'Packages unavailable' };
      }),
    ]);

    if (!structureResult.ok) {
      return {
        success: false,
        error: `Could not get page structure: ${structureResult.error}`,
        suggestion: 'Try calling get_page_structure to check the storefront state.',
      };
    }

    if (!factsResult.ok) {
      return {
        success: false,
        error: `Could not get discovery facts: ${factsResult.error}`,
        suggestion: 'Try calling get_known_facts to check what you know.',
      };
    }

    // API returns flat sections array, not nested pages
    // See: server/src/routes/internal-agent.routes.ts /storefront/structure
    const structureData = structureResult.data;

    const factsData = factsResult.data;

    // 2. Find ALL MVP sections — the slot machine gates WHEN to build,
    // this tool should always return MVP sections for overwrite.
    // Seed defaults are not "real" content — always overwrite during first draft.
    //
    // Source of truth: packages/contracts/src/schemas/section-blueprint.schema.ts → MVP_REVEAL_SECTION_TYPES
    // Cloud Run agent cannot import from @macon/contracts — synced via constants/shared.ts
    const allSections = structureData.sections ?? [];
    const mvpSections = allSections.filter((s) => MVP_SECTION_TYPES.has(s.type));

    if (mvpSections.length === 0) {
      return {
        success: false,
        sectionsToUpdate: [],
        knownFacts: factsData.facts,
        error:
          'No MVP sections (HERO, ABOUT, SERVICES) found in page structure. The storefront may not be provisioned correctly.',
      };
    }

    // 3. Extract research data (pre-computed by async backend trigger after Q2)
    // so the agent can cite market pricing when creating packages
    let researchData: ResearchData | null = null;

    if (researchResult.ok) {
      const payload = researchResult.data;
      if (payload.hasData && payload.researchData) {
        researchData = payload.researchData;
        logger.info(
          { tenantId, hasPricing: !!researchData?.competitorPricing },
          '[TenantAgent] build_first_draft found pre-computed research data'
        );
      }
    }

    // 4. Return structured data for the LLM to generate copy
    const sectionsToUpdate = mvpSections.map((s) => ({
      sectionId: s.id,
      sectionType: s.type,
      pageName: s.page,
      currentHeadline: s.headline || '(no headline)',
      hasPlaceholder: s.hasPlaceholder,
    }));

    logger.info(
      {
        tenantId,
        mvpCount: sectionsToUpdate.length,
        totalSections: allSections.length,
        factCount: factsData.factCount,
        hasResearch: !!researchData,
      },
      '[TenantAgent] build_first_draft identified MVP sections for overwrite'
    );

    // 5. Programmatic fallback: delete seed packages before agent creates real ones.
    // The system prompt also instructs the agent to list-then-delete, but this ensures
    // cleanup even if the LLM skips the step. Defense-in-depth for financial-impact data.
    // API: single POST /manage-packages with action param (see packages.ts:226, :391)
    //
    // IMPORTANT: Match by name AND price, not just price. Legitimate free consultations
    // with non-seed names must be preserved.
    //
    // Canonical source: @macon/contracts SEED_PACKAGE_NAMES
    // Cloud Run agent cannot import from contracts — synced via constants/shared.ts
    try {
      if (listResult.ok) {
        // API returns priceInDollars (dollars), not basePrice (cents) — see internal-agent.routes.ts
        const packages = listResult.data.packages ?? [];
        const defaultPackages = packages.filter(
          (pkg) =>
            pkg.priceInDollars === 0 &&
            SEED_PACKAGE_NAMES.includes(pkg.name as (typeof SEED_PACKAGE_NAMES)[number])
        );
        await Promise.all(
          defaultPackages.map((pkg) =>
            callMaisApi('/content-generation/manage-packages', tenantId, {
              action: 'delete',
              packageId: pkg.id,
            })
          )
        );
        if (defaultPackages.length > 0) {
          logger.info(
            { tenantId, deletedCount: defaultPackages.length },
            '[TenantAgent] build_first_draft cleaned up seed $0 packages'
          );
        }
      }
    } catch (err) {
      // Non-fatal: agent prompt will also instruct cleanup
      logger.warn(
        { tenantId, err },
        '[TenantAgent] seed package cleanup failed, agent will retry via prompt'
      );
    }

    const pricingHint = researchData?.competitorPricing
      ? `Research data available: ${researchData.competitorPricing.summary}. Use $${researchData.competitorPricing.low.toLocaleString()}-$${researchData.competitorPricing.high.toLocaleString()} as pricing context when creating packages.`
      : 'No research pricing data available yet. Use reasonable defaults for the business type and adjust later.';

    return {
      success: true,
      sectionsToUpdate,
      knownFacts: factsData.facts,
      factKeys: factsData.factKeys,
      totalSections: sectionsToUpdate.length,
      researchData,
      instruction:
        `Generate personalized content for ALL ${sectionsToUpdate.length} sections below using the known facts. ` +
        'Call update_section for EACH one — do NOT stop after one section. ' +
        'After ALL sections are updated, the preview will reveal automatically. ' +
        `${pricingHint} ` +
        'Explain WHY you wrote what you wrote — build with narrative.',
    };
  }),
});
