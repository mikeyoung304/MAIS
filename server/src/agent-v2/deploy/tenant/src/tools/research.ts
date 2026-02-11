/**
 * Research Agent Delegation Tool
 *
 * Enables the tenant-agent to delegate market research tasks to the
 * research-agent Cloud Run service during onboarding conversations.
 *
 * Trigger: When agent has businessType + location, delegate research:
 * - Competitor pricing ranges
 * - Market positioning
 * - Local demand insights
 *
 * @see CLAUDE.md section "The Onboarding Conversation"
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { logger, fetchWithTimeout, getTenantId, callMaisApi, TTLCache } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Environment Configuration
// ─────────────────────────────────────────────────────────────────────────────

const RESEARCH_AGENT_URL = process.env.RESEARCH_AGENT_URL;

if (!RESEARCH_AGENT_URL) {
  logger.warn(
    {},
    '[Research] RESEARCH_AGENT_URL not set — direct research delegation disabled, will use backend pre-computed results only'
  );
}

// Longer timeout for research (web scraping, analysis)
const RESEARCH_TIMEOUT_MS = 90_000; // 90s per pitfall #42

// Cache research results for 30 minutes to avoid redundant calls
const researchCache = new TTLCache<ResearchResult>(30 * 60 * 1000, 100, 'research-cache');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ResearchResult {
  success: boolean;
  businessType: string;
  location: string;
  competitorPricing?: {
    low: number;
    high: number;
    currency: string;
    summary: string;
  };
  marketPositioning?: string[];
  localDemand?: string;
  insights?: string[];
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity Token Retrieval
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get identity token for Cloud Run service-to-service auth.
 *
 * When running on Cloud Run, uses the metadata server.
 * Falls back gracefully in local development.
 */
async function getIdentityToken(audience: string): Promise<string | null> {
  // Priority 1: GCP metadata service (when running ON Cloud Run)
  const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`;

  try {
    const response = await fetchWithTimeout(
      metadataUrl,
      {
        headers: { 'Metadata-Flavor': 'Google' },
      },
      5_000 // 5s timeout for metadata
    );

    if (response.ok) {
      const token = await response.text();
      logger.debug({}, '[Research] Got identity token from metadata server');
      return token;
    }
  } catch {
    logger.debug({}, '[Research] Metadata server not available (not on Cloud Run)');
  }

  // Priority 2: Local development - skip auth (research-agent accepts unauthenticated in dev)
  if (process.env.NODE_ENV === 'development' || process.env.LOCAL_DEV === 'true') {
    logger.debug({}, '[Research] Local development mode - skipping auth');
    return null;
  }

  logger.warn({}, '[Research] Could not get identity token');
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Research Agent Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delegate to Research Agent Tool
 *
 * Call this during onboarding when you have:
 * 1. businessType (what they do)
 * 2. location (city, state)
 *
 * Returns competitor pricing and market insights to inform:
 * - Pricing suggestions
 * - Copy positioning
 * - Local relevance
 */
export const delegateToResearchTool = new FunctionTool({
  name: 'delegate_to_research',
  description: `Delegate market research to the research agent.

WHEN TO CALL: As soon as you have businessType + location during onboarding.
Runs in background - you can continue the conversation while waiting.

Returns:
- competitorPricing: Price range for similar businesses in their area
- marketPositioning: How competitors position themselves
- localDemand: What the local market looks like
- insights: Key takeaways for copy/positioning

USE THE DATA: When suggesting pricing, cite it explicitly:
"Most wedding photographers in Austin charge $3,000-$6,000. Where do you want to position yourself?"

Examples:
- delegate_to_research(businessType: "wedding photographer", location: "Austin, TX")
- delegate_to_research(businessType: "life coach", location: "Denver, CO")
- delegate_to_research(businessType: "therapist", location: "Brooklyn, NY")`,

  parameters: z.object({
    businessType: z.string().describe('What they do (e.g., "wedding photographer", "life coach")'),
    location: z.string().describe('City and state (e.g., "Austin, TX", "Denver, Colorado")'),
  }),

  execute: async (params, context: ToolContext | undefined) => {
    // Validate params (pitfall #56)
    const parseResult = z
      .object({
        businessType: z.string().min(1),
        location: z.string().min(1),
      })
      .safeParse(params);

    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid parameters: ${parseResult.error.message}`,
      };
    }

    const { businessType, location } = parseResult.data;

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
      };
    }

    // Tier 1: Check in-memory TTL cache (instant)
    const cacheKey = `${tenantId}:${businessType.toLowerCase()}:${location.toLowerCase()}`;
    const cached = researchCache.get(cacheKey);
    if (cached) {
      logger.info({ tenantId, businessType, location }, '[Research] Cache hit (in-memory)');
      return {
        ...cached,
        fromCache: true,
      };
    }

    // Tier 2: Check backend for pre-computed results (instant if async research finished)
    try {
      const backendResult = await callMaisApi('/get-research-data', tenantId);
      if (backendResult.ok) {
        const payload = backendResult.data as {
          hasData: boolean;
          researchData: ResearchResult | null;
        };
        if (payload.hasData && payload.researchData) {
          logger.info(
            { tenantId, businessType, location },
            '[Research] Pre-computed results from backend'
          );
          // Cache the pre-computed results locally
          researchCache.set(cacheKey, payload.researchData);
          return {
            ...payload.researchData,
            fromCache: true,
            source: 'backend-precomputed',
          };
        }
      }
    } catch (error) {
      // Non-fatal: fall through to direct research agent call
      logger.debug(
        { error: error instanceof Error ? error.message : String(error) },
        '[Research] Backend pre-computed check failed, falling through to direct call'
      );
    }

    // Tier 3: Direct research agent call (30-90s)
    if (!RESEARCH_AGENT_URL) {
      logger.warn(
        { tenantId, businessType, location },
        '[Research] RESEARCH_AGENT_URL not configured — skipping direct call'
      );
      return {
        success: false,
        businessType,
        location,
        error: 'Research service not configured',
        suggestion: 'Continue without research data. Ask the user about their pricing directly.',
      };
    }

    logger.info(
      { tenantId, businessType, location },
      '[Research] Delegating to research-agent (direct call)'
    );

    try {
      // Get identity token for Cloud Run auth
      const idToken = await getIdentityToken(RESEARCH_AGENT_URL);

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      // Call research agent
      const response = await fetchWithTimeout(
        `${RESEARCH_AGENT_URL}/research`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: `${businessType} pricing and positioning in ${location}`,
            businessType,
            location,
            tenantId,
          }),
        },
        RESEARCH_TIMEOUT_MS
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, error: errorText },
          '[Research] Research agent error'
        );
        return {
          success: false,
          businessType,
          location,
          error: `Research failed: ${response.status}`,
          suggestion: 'Continue without research data. Ask the user about their pricing directly.',
        };
      }

      const data = (await response.json()) as ResearchResult;

      // Cache successful results
      const result: ResearchResult = {
        success: true,
        businessType,
        location,
        competitorPricing: data.competitorPricing,
        marketPositioning: data.marketPositioning,
        localDemand: data.localDemand,
        insights: data.insights,
      };

      researchCache.set(cacheKey, result);

      logger.info(
        { tenantId, businessType, location, hasPricing: !!data.competitorPricing },
        '[Research] Research complete'
      );

      return {
        ...result,
        // Help agent use the data
        usage: result.competitorPricing
          ? `Cite pricing in conversation: "Most ${businessType}s in ${location} charge $${result.competitorPricing.low.toLocaleString()}-$${result.competitorPricing.high.toLocaleString()}. Where do you want to position yourself?"`
          : 'Research found insights but no specific pricing data. Ask the user about their pricing.',
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error({ businessType, location }, '[Research] Timeout');
        return {
          success: false,
          businessType,
          location,
          error: 'Research timed out',
          suggestion: 'Continue without research data. Ask the user about their pricing directly.',
        };
      }

      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[Research] Network error'
      );
      return {
        success: false,
        businessType,
        location,
        error: 'Could not reach research service',
        suggestion: 'Continue without research data. Ask the user about their pricing directly.',
      };
    }
  },
});
