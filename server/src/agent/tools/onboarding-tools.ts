/**
 * Onboarding Agent Tools
 *
 * MCP-compatible tools for agent-powered tenant onboarding.
 * These tools guide new tenants through discovery, market research,
 * service configuration, and storefront setup.
 *
 * Architecture:
 * - Tools use discriminated union results for type-safe error handling (Fix #1)
 * - State transitions use XState machine for validation
 * - Events persisted with optimistic locking (Fix #2)
 * - Market research falls back to industry benchmarks (Fix #6)
 *
 * Trust Tiers:
 * - update_onboarding_state: T1 (auto-confirm) - state metadata only
 * - upsert_services: T2 (soft confirm) - creates real database records
 * - update_storefront: T2 (soft confirm) - updates landing page config
 */

import type { AgentTool, ToolContext, AgentToolResult, WriteToolProposal } from './types';
import { sanitizeForContext } from './types';
import { ProposalService } from '../proposals/proposal.service';
import { handleToolError, formatPrice } from './utils';
import {
  type OnboardingPhase,
  type DiscoveryData,
  type MarketResearchData,
  type ServicesData,
  type MarketingData,
  type BusinessType,
  type TargetMarket,
  DiscoveryDataSchema,
  MarketResearchDataSchema,
  ServicesDataSchema,
  MarketingDataSchema,
  BusinessTypeSchema,
  TargetMarketSchema,
  OnboardingPhaseSchema,
  parseOnboardingPhase,
} from '@macon/contracts';
import { stateToPhase, isValidTransition } from '../onboarding/state-machine';
import { appendEvent } from '../onboarding/event-sourcing';
import type { OnboardingMachineEvent, OnboardingEventType } from '@macon/contracts';
import { searchMarketPricing } from '../onboarding/market-search';
import { logger } from '../../lib/core/logger';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a proposal for a write operation
 */
async function createProposal(
  context: ToolContext,
  toolName: string,
  operation: string,
  trustTier: 'T1' | 'T2' | 'T3',
  payload: Record<string, unknown>,
  preview: Record<string, unknown>
): Promise<WriteToolProposal> {
  const proposalService = new ProposalService(context.prisma);

  const result = await proposalService.createProposal({
    tenantId: context.tenantId,
    sessionId: context.sessionId,
    toolName,
    operation,
    trustTier,
    payload,
    preview,
  });

  return {
    success: true,
    proposalId: result.proposalId,
    operation: result.operation,
    preview: result.preview,
    trustTier: result.trustTier,
    requiresApproval: result.requiresApproval,
    expiresAt: result.expiresAt,
  };
}

/**
 * Map onboarding phase to event type for "started" events
 */
function getStartedEventType(phase: OnboardingPhase): OnboardingEventType | null {
  const mapping: Partial<Record<OnboardingPhase, OnboardingEventType>> = {
    DISCOVERY: 'DISCOVERY_STARTED',
    MARKET_RESEARCH: 'MARKET_RESEARCH_STARTED',
    SERVICES: 'SERVICES_STARTED',
    MARKETING: 'MARKETING_STARTED',
  };
  return mapping[phase] || null;
}

/**
 * Map onboarding phase to event type for "completed" events
 */
function getCompletedEventType(phase: OnboardingPhase): OnboardingEventType | null {
  const mapping: Partial<Record<OnboardingPhase, OnboardingEventType>> = {
    DISCOVERY: 'DISCOVERY_COMPLETED',
    MARKET_RESEARCH: 'MARKET_RESEARCH_COMPLETED',
    SERVICES: 'SERVICES_CONFIGURED',
    MARKETING: 'MARKETING_CONFIGURED',
    COMPLETED: 'ONBOARDING_COMPLETED',
    SKIPPED: 'ONBOARDING_SKIPPED',
  };
  return mapping[phase] || null;
}

/**
 * Map phase to machine event type
 */
function getMachineEventForPhase(
  phase: OnboardingPhase,
  data?: unknown
): OnboardingMachineEvent | null {
  switch (phase) {
    case 'DISCOVERY':
      return data ? { type: 'COMPLETE_DISCOVERY', data: data as DiscoveryData } : null;
    case 'MARKET_RESEARCH':
      return data ? { type: 'COMPLETE_MARKET_RESEARCH', data: data as MarketResearchData } : null;
    case 'SERVICES':
      return data ? { type: 'COMPLETE_SERVICES', data: data as ServicesData } : null;
    case 'MARKETING':
      return data ? { type: 'COMPLETE_MARKETING', data: data as MarketingData } : null;
    case 'SKIPPED':
      return { type: 'SKIP' };
    default:
      return null;
  }
}

// ============================================================================
// Tool 1: update_onboarding_state
// ============================================================================

/**
 * update_onboarding_state - Transition onboarding phase and persist event
 *
 * Trust Tier: T1 (auto-confirm) - Only updates state metadata, no business data
 *
 * This tool:
 * 1. Validates the transition using XState machine
 * 2. Persists the event with optimistic locking
 * 3. Updates the tenant's onboarding phase
 *
 * Returns discriminated union result for type-safe error handling.
 */
export const updateOnboardingStateTool: AgentTool = {
  name: 'update_onboarding_state',
  trustTier: 'T1', // Metadata update only
  description: `Transition the tenant's onboarding phase. Use after collecting required data for each phase.

Phases flow: NOT_STARTED → DISCOVERY → MARKET_RESEARCH → SERVICES → MARKETING → COMPLETED

For DISCOVERY phase, provide:
- businessType: photographer, coach, therapist, wedding_planner, etc.
- businessName: The business name
- location: { city, state, country }
- targetMarket: luxury, premium, mid_range, budget_friendly, mixed
- yearsInBusiness (optional): Number of years in business
- currentAveragePrice (optional): Current average price in cents

For MARKET_RESEARCH phase, provide pricing benchmarks from research.
For SERVICES phase, provide configured segments and packages.
For MARKETING phase, provide headline, tagline, and brand voice.

Use phase: SKIPPED to skip onboarding entirely.`,
  inputSchema: {
    type: 'object',
    properties: {
      phase: {
        type: 'string',
        description: 'Target phase to transition to',
        enum: ['DISCOVERY', 'MARKET_RESEARCH', 'SERVICES', 'MARKETING', 'COMPLETED', 'SKIPPED'],
      },
      data: {
        type: 'object',
        description: 'Phase-specific data (varies by phase)',
      },
    },
    required: ['phase'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma, sessionId } = context;
    const data = params.data as Record<string, unknown> | undefined;

    try {
      // Validate phase using Zod instead of type assertion
      const phaseResult = OnboardingPhaseSchema.safeParse(params.phase);
      if (!phaseResult.success) {
        return {
          success: false,
          error: 'INVALID_TRANSITION',
          currentPhase: 'NOT_STARTED',
          attemptedPhase: String(params.phase),
        } as AgentToolResult;
      }
      const targetPhase = phaseResult.data;

      // Get current tenant state
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          onboardingPhase: true,
          onboardingVersion: true,
        },
      });

      if (!tenant) {
        return {
          success: false,
          error: 'Unable to access tenant. Please try again.',
        };
      }

      const currentPhase = parseOnboardingPhase(tenant.onboardingPhase);
      const currentVersion = tenant.onboardingVersion || 0;

      // Validate phase data based on target phase
      let validatedData: unknown;
      let missingFields: string[] = [];

      if (targetPhase === 'DISCOVERY' && data) {
        const result = DiscoveryDataSchema.safeParse(data);
        if (!result.success) {
          missingFields = result.error.issues.map((i) => i.path.join('.'));
          return {
            success: false,
            error: 'INCOMPLETE_DATA',
            missingFields,
          } as AgentToolResult;
        }
        validatedData = result.data;
      } else if (targetPhase === 'MARKET_RESEARCH' && data) {
        const result = MarketResearchDataSchema.safeParse(data);
        if (!result.success) {
          missingFields = result.error.issues.map((i) => i.path.join('.'));
          return {
            success: false,
            error: 'INCOMPLETE_DATA',
            missingFields,
          } as AgentToolResult;
        }
        validatedData = result.data;
      } else if (targetPhase === 'SERVICES' && data) {
        const result = ServicesDataSchema.safeParse(data);
        if (!result.success) {
          missingFields = result.error.issues.map((i) => i.path.join('.'));
          return {
            success: false,
            error: 'INCOMPLETE_DATA',
            missingFields,
          } as AgentToolResult;
        }
        validatedData = result.data;
      } else if (targetPhase === 'MARKETING' && data) {
        const result = MarketingDataSchema.safeParse(data);
        if (!result.success) {
          missingFields = result.error.issues.map((i) => i.path.join('.'));
          return {
            success: false,
            error: 'INCOMPLETE_DATA',
            missingFields,
          } as AgentToolResult;
        }
        validatedData = result.data;
      }

      // Validate the transition is allowed using state machine rules
      // Note: Using direct validation instead of full XState actor for simplicity
      if (!isValidTransition(currentPhase, targetPhase)) {
        return {
          success: false,
          error: 'INVALID_TRANSITION',
          currentPhase,
          attemptedPhase: targetPhase,
        } as AgentToolResult;
      }

      // Determine event type
      const eventType = getCompletedEventType(targetPhase);
      if (!eventType) {
        return {
          success: false,
          error: 'INVALID_TRANSITION',
          currentPhase,
          attemptedPhase: targetPhase,
        } as AgentToolResult;
      }

      // Build event payload based on phase
      let eventPayload: Record<string, unknown>;
      const timestamp = new Date().toISOString();

      switch (targetPhase) {
        case 'DISCOVERY':
          eventPayload = {
            ...(validatedData as Record<string, unknown>),
            completedAt: timestamp,
          };
          break;
        case 'MARKET_RESEARCH':
          eventPayload = validatedData as Record<string, unknown>;
          break;
        case 'SERVICES':
          eventPayload = {
            ...(validatedData as Record<string, unknown>),
            configuredAt: timestamp,
          };
          break;
        case 'MARKETING':
          eventPayload = {
            ...(validatedData as Record<string, unknown>),
            configuredAt: timestamp,
          };
          break;
        case 'COMPLETED':
          eventPayload = {
            completedAt: timestamp,
            phasesCompleted: ['DISCOVERY', 'MARKET_RESEARCH', 'SERVICES', 'MARKETING'],
          };
          break;
        case 'SKIPPED':
          eventPayload = {
            skippedAt: timestamp,
            lastPhase: currentPhase,
            reason: (data as { reason?: string })?.reason,
          };
          break;
        default:
          eventPayload = { timestamp };
      }

      // Append event with optimistic locking
      const appendResult = await appendEvent(
        prisma,
        tenantId,
        eventType,
        eventPayload as Parameters<typeof appendEvent>[3],
        currentVersion
      );

      if (!appendResult.success) {
        if (appendResult.error === 'CONCURRENT_MODIFICATION') {
          return {
            success: false,
            error: 'CONCURRENT_MODIFICATION',
            currentVersion: appendResult.currentVersion,
          } as AgentToolResult;
        }
        return {
          success: false,
          error: appendResult.error || 'Failed to persist state change',
        };
      }

      // Update tenant's onboarding phase
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          onboardingPhase: targetPhase,
          onboardingVersion: appendResult.version,
          ...(targetPhase === 'COMPLETED' ? { onboardingCompletedAt: new Date() } : {}),
        },
      });

      logger.info(
        {
          tenantId,
          fromPhase: currentPhase,
          toPhase: targetPhase,
          version: appendResult.version,
        },
        'Onboarding state transitioned via agent'
      );

      // Generate summary based on phase
      let summary: string;
      switch (targetPhase) {
        case 'DISCOVERY':
          summary = `Discovery complete! We know you're a ${(validatedData as DiscoveryData).businessType} in ${(validatedData as DiscoveryData).location.city}, ${(validatedData as DiscoveryData).location.state}.`;
          break;
        case 'MARKET_RESEARCH':
          const mrData = validatedData as MarketResearchData;
          summary = `Market research complete! Found pricing range ${formatPrice(mrData.pricingBenchmarks.marketLowCents)} - ${formatPrice(mrData.pricingBenchmarks.marketHighCents)}.`;
          break;
        case 'SERVICES':
          const svcData = validatedData as ServicesData;
          summary = `Services configured! Created ${svcData.segments.length} segment(s) with ${svcData.createdPackageIds.length} package(s).`;
          break;
        case 'MARKETING':
          summary = 'Marketing content configured! Your storefront is ready.';
          break;
        case 'COMPLETED':
          summary = 'Onboarding complete! Your business is ready to accept bookings.';
          break;
        case 'SKIPPED':
          summary = 'Onboarding skipped. You can configure your business manually.';
          break;
        default:
          summary = `Transitioned to ${targetPhase}.`;
      }

      return {
        success: true,
        data: {
          phase: targetPhase,
          summary,
          version: appendResult.version,
        },
      };
    } catch (error) {
      return handleToolError(
        error,
        'update_onboarding_state',
        tenantId,
        'Failed to update onboarding state. Please try again.'
      );
    }
  },
};

// ============================================================================
// Tool 2: upsert_services
// ============================================================================

/**
 * upsert_services - Create or update service packages during onboarding
 *
 * Trust Tier: T2 (soft confirm) - Creates real database records
 *
 * This tool creates segments and packages based on market research recommendations.
 * It handles the actual database writes for service configuration.
 */
export const upsertServicesTool: AgentTool = {
  name: 'upsert_services',
  trustTier: 'T2', // Creates real database records
  description: `Create or update service packages during onboarding.

Use this after market research to create the recommended service tiers.
Provide segment name and packages with pricing based on market benchmarks.

Example:
{
  "segmentName": "Photography Sessions",
  "segmentSlug": "photography-sessions",
  "packages": [
    { "name": "Mini Session", "slug": "mini-session", "priceCents": 29900, "groupingOrder": 1 },
    { "name": "Full Session", "slug": "full-session", "priceCents": 49900, "groupingOrder": 2 },
    { "name": "Premium Session", "slug": "premium-session", "priceCents": 79900, "groupingOrder": 3 }
  ]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      segmentName: {
        type: 'string',
        description: 'Display name for the segment (e.g., "Photography Sessions")',
      },
      segmentSlug: {
        type: 'string',
        description: 'URL-safe identifier (e.g., "photography-sessions")',
      },
      packages: {
        type: 'array',
        description: 'Array of packages to create within this segment',
      },
    },
    required: ['segmentName', 'segmentSlug', 'packages'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const segmentName = params.segmentName as string;
    const segmentSlug = params.segmentSlug as string;
    const packages = params.packages as Array<{
      name: string;
      slug: string;
      description?: string;
      priceCents: number;
      groupingOrder: number;
    }>;

    try {
      // Validate packages array
      if (!Array.isArray(packages) || packages.length === 0) {
        return {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'At least one package is required',
        } as AgentToolResult;
      }

      // Check for duplicate package names
      const packageNames = packages.map((p) => p.name.toLowerCase());
      const duplicates = packageNames.filter((name, i) => packageNames.indexOf(name) !== i);
      if (duplicates.length > 0) {
        return {
          success: false,
          error: 'DUPLICATE_PACKAGE_NAME',
          duplicateName: duplicates[0],
        } as AgentToolResult;
      }

      // Check if segment with this slug already exists
      const existingSegment = await prisma.segment.findFirst({
        where: { tenantId, slug: segmentSlug },
      });

      if (existingSegment) {
        return {
          success: false,
          error: 'SEGMENT_EXISTS',
          existingSlug: segmentSlug,
        } as AgentToolResult;
      }

      // Get tenant slug for preview URL
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true },
      });

      // Build preview
      const totalPackages = packages.length;
      const priceRange =
        packages.length > 0
          ? `${formatPrice(Math.min(...packages.map((p) => p.priceCents)))} - ${formatPrice(Math.max(...packages.map((p) => p.priceCents)))}`
          : 'N/A';

      const operation = `Create segment "${sanitizeForContext(segmentName, 50)}" with ${totalPackages} packages`;
      const payload = {
        segmentName,
        segmentSlug,
        packages,
      };
      const preview = {
        segmentName: sanitizeForContext(segmentName, 50),
        packageCount: totalPackages,
        priceRange,
        packages: packages.map((p) => ({
          name: sanitizeForContext(p.name, 30),
          price: formatPrice(p.priceCents),
        })),
      };

      return createProposal(context, 'upsert_services', operation, 'T2', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'upsert_services',
        tenantId,
        'Failed to create services proposal. Verify all packages have name, slug, and priceCents.'
      );
    }
  },
};

// ============================================================================
// Tool 3: update_storefront
// ============================================================================

/**
 * update_storefront - Update landing page content during onboarding
 *
 * Trust Tier: T2 (soft confirm) - Updates tenant configuration
 *
 * This tool updates the landing page hero, headline, tagline, and brand settings
 * based on the marketing phase of onboarding.
 */
export const updateStorefrontTool: AgentTool = {
  name: 'update_storefront',
  trustTier: 'T2', // Updates tenant configuration
  description: `Update storefront landing page content during onboarding.

Use this after marketing phase to configure the tenant's landing page.
Provide headline, tagline, brand voice, and optionally hero image and colors.

Brand voice options: professional, friendly, luxurious, approachable, bold

Example:
{
  "headline": "Capturing Your Story",
  "tagline": "Professional photography for life's most beautiful moments",
  "brandVoice": "luxurious",
  "primaryColor": "#1a365d"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      headline: {
        type: 'string',
        description: 'Hero headline (max 200 chars)',
      },
      tagline: {
        type: 'string',
        description: 'Hero tagline/subheadline (max 300 chars)',
      },
      brandVoice: {
        type: 'string',
        description: 'Brand voice tone',
        enum: ['professional', 'friendly', 'luxurious', 'approachable', 'bold'],
      },
      heroImageUrl: {
        type: 'string',
        description: 'URL for hero background image',
      },
      primaryColor: {
        type: 'string',
        description: 'Primary brand color (hex format, e.g., "#1a365d")',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId } = context;
    const headline = params.headline as string | undefined;
    const tagline = params.tagline as string | undefined;
    const brandVoice = params.brandVoice as string | undefined;
    const heroImageUrl = params.heroImageUrl as string | undefined;
    const primaryColor = params.primaryColor as string | undefined;

    try {
      // Validate at least one field is provided
      const updates = { headline, tagline, brandVoice, heroImageUrl, primaryColor };
      const providedFields = Object.entries(updates).filter(([_, v]) => v !== undefined);

      if (providedFields.length === 0) {
        return {
          success: false,
          error: 'At least one field must be provided to update.',
        };
      }

      // Validate color format if provided
      if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
        return {
          success: false,
          error: 'Primary color must be in hex format (e.g., "#1a365d")',
        };
      }

      // Validate headline length
      if (headline && headline.length > 200) {
        return {
          success: false,
          error: 'Headline must be 200 characters or less',
        };
      }

      // Validate tagline length
      if (tagline && tagline.length > 300) {
        return {
          success: false,
          error: 'Tagline must be 300 characters or less',
        };
      }

      const operation = `Update storefront (${providedFields.map(([k]) => k).join(', ')})`;
      const payload = updates;
      const preview: Record<string, unknown> = {
        updates: providedFields.map(([k, v]) => ({
          field: k,
          value: typeof v === 'string' && v.length > 50 ? `${v.slice(0, 50)}...` : v,
        })),
      };

      return createProposal(context, 'update_storefront', operation, 'T2', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'update_storefront',
        tenantId,
        'Failed to create storefront update proposal. Verify all values are valid.'
      );
    }
  },
};

// ============================================================================
// Tool 4: get_market_research (Read Tool)
// ============================================================================

/**
 * get_market_research - Get pricing benchmarks for a business type and location
 *
 * Trust Tier: N/A (read tool)
 *
 * This tool retrieves market pricing data. It first attempts web search,
 * then falls back to industry benchmarks if web data is unavailable.
 *
 * Uses Fix #6: Returns `source` enum instead of `isFallback` boolean.
 */
export const getMarketResearchTool: AgentTool = {
  name: 'get_market_research',
  trustTier: 'T1', // Read-only tool
  description: `Get pricing benchmarks for a business type and location.

Use this during the MARKET_RESEARCH phase to get recommended pricing tiers.
Returns market low/median/high pricing and recommended tier structure.

Business types: photographer, videographer, wedding_planner, florist, caterer,
dj, officiant, makeup_artist, hair_stylist, event_designer, venue, coach,
therapist, consultant, wellness_practitioner, personal_trainer, tutor,
music_instructor, other

Target markets: luxury, premium, mid_range, budget_friendly, mixed`,
  inputSchema: {
    type: 'object',
    properties: {
      businessType: {
        type: 'string',
        description: 'Type of business',
        enum: [
          'photographer',
          'videographer',
          'wedding_planner',
          'florist',
          'caterer',
          'dj',
          'officiant',
          'makeup_artist',
          'hair_stylist',
          'event_designer',
          'venue',
          'coach',
          'therapist',
          'consultant',
          'wellness_practitioner',
          'personal_trainer',
          'tutor',
          'music_instructor',
          'other',
        ],
      },
      targetMarket: {
        type: 'string',
        description: 'Target market segment',
        enum: ['luxury', 'premium', 'mid_range', 'budget_friendly', 'mixed'],
      },
      city: {
        type: 'string',
        description: 'City name for location-aware pricing',
      },
      state: {
        type: 'string',
        description: 'State/province code (e.g., "CA", "NY")',
      },
    },
    required: ['businessType', 'targetMarket'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId } = context;
    const businessType = params.businessType as BusinessType;
    const targetMarket = params.targetMarket as TargetMarket;
    const city = params.city as string | undefined;
    const state = params.state as string | undefined;

    try {
      // Validate business type
      const typeResult = BusinessTypeSchema.safeParse(businessType);
      if (!typeResult.success) {
        return {
          success: false,
          error: `Invalid business type. Valid types: ${BusinessTypeSchema.options.join(', ')}`,
        };
      }

      // Validate target market
      const marketResult = TargetMarketSchema.safeParse(targetMarket);
      if (!marketResult.success) {
        return {
          success: false,
          error: `Invalid target market. Valid markets: ${TargetMarketSchema.options.join(', ')}`,
        };
      }

      // Delegate to searchMarketPricing which handles:
      // - Web search (Phase 3)
      // - Industry benchmark fallback
      // - COL adjustments by state
      // - Target market multipliers
      // - Source attribution (Fix #6)
      const searchResult = await searchMarketPricing({
        tenantId,
        businessType,
        targetMarket,
        city,
        state,
        skipWebSearch: true, // Phase 2: Always use benchmarks; Phase 3 will enable web search
      });

      if (!searchResult.success) {
        return {
          success: false,
          error: searchResult.error,
        };
      }

      logger.info(
        { tenantId, businessType, targetMarket, source: searchResult.source },
        'Market research retrieved via agent'
      );

      return {
        success: true,
        data: searchResult.data,
        meta: {
          businessType,
          targetMarket,
          location: city && state ? `${city}, ${state}` : undefined,
          source: searchResult.source,
        },
      };
    } catch (error) {
      return handleToolError(
        error,
        'get_market_research',
        tenantId,
        'Failed to retrieve market research. Please try again.'
      );
    }
  },
};

// ============================================================================
// Export All Onboarding Tools
// ============================================================================

export const onboardingTools: AgentTool[] = [
  updateOnboardingStateTool,
  upsertServicesTool,
  updateStorefrontTool,
  getMarketResearchTool,
];
