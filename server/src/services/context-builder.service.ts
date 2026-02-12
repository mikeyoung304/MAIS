/**
 * ContextBuilder Service
 *
 * Single source of truth for agent context assembly.
 * Reads directly from canonical storage for agent context.
 *
 * Architecture: Agent-First (2026-02-01)
 * - Context is injected at session start, never inferred
 * - One read path for all agent context
 * - Reads from tenant.branding.discoveryFacts (state-based, not event-sourced)
 *
 * @see docs/architecture/AGENT_FIRST_ARCHITECTURE_SPEC.md
 */

import type { PrismaClient } from '../generated/prisma/client';
import type { OnboardingPhase } from '@macon/contracts';
import { parseOnboardingPhase } from '@macon/contracts';
import { logger } from '../lib/core/logger';
import type { SectionContentService } from './section-content.service';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Known facts about the business (agent must NOT ask about these)
 */
export interface KnownFacts {
  businessName?: string;
  businessDescription?: string;
  businessType?: string;
  location?: string;
  serviceArea?: string;
  yearsInBusiness?: number;
  specializations?: string[];
  priceRange?: string;
  targetAudience?: string;
  uniqueSellingPoints?: string[];
  [key: string]: unknown; // Extensible
}

/**
 * Brand voice preferences
 */
export interface BrandVoice {
  tone?: string;
  avoids?: string[];
  preferences?: string[];
}

/**
 * Editable facts (user can correct, agent can propose changes)
 */
export interface EditableFacts {
  brandVoice?: BrandVoice;
  visualPreferences?: {
    style?: string;
    colors?: string[];
  };
}

/**
 * Section state for storefront
 */
export interface SectionState {
  status: 'empty' | 'draft' | 'published';
  content?: Record<string, unknown>;
  lastModified?: Date;
}

/**
 * Current storefront state
 */
export interface StorefrontState {
  completion: number;
  sections: {
    hero: SectionState;
    about: SectionState;
    services: SectionState;
    faq: SectionState;
    reviews: SectionState;
  };
  hasDraft: boolean;
  lastPublished?: Date;
}

/**
 * Constraints for agent behavior
 */
export interface AgentConstraints {
  maxTurnsPerSession: number;
  maxTokensPerSession: number;
  forbiddenWords: string[];
  requiredSections: string[];
}

/**
 * Current goals for the agent
 */
export interface AgentGoals {
  primary: string;
  secondary: string[];
  blockers: string[];
}

/**
 * Open task for the agent
 */
export interface OpenTask {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'blocked';
}

/**
 * Complete agent context - injected at session start
 */
export interface AgentContext {
  // Identity
  tenantId: string;
  businessName: string;
  businessType: string;

  // Known Facts (agent must NOT ask about these)
  knownFacts: KnownFacts;

  // Editable Facts (user can correct, agent can propose changes)
  editableFacts: EditableFacts;

  // Current Storefront State
  storefrontState: StorefrontState;

  // Constraints
  constraints: AgentConstraints;

  // Current Goals
  goals: AgentGoals;

  // Open Tasks
  openTasks: OpenTask[];

  // Forbidden Questions (agent must NEVER ask these)
  forbiddenQuestions: string[];

  // Onboarding state
  onboardingComplete: boolean;
  onboardingPhase: OnboardingPhase;
}

/**
 * Bootstrap response for agent session initialization
 * Subset of AgentContext for immediate use
 */
export interface BootstrapData {
  tenantId: string;
  businessName: string;
  slug: string;
  onboardingComplete: boolean;
  onboardingPhase: OnboardingPhase;
  discoveryFacts: KnownFacts;
  storefrontState: {
    hasDraft: boolean;
    hasPublished: boolean;
    completion: number;
  };
  /**
   * Slots that have known values - agent must NOT ask for these.
   * This is the enterprise-grade slot-policy: check slot keys, not phrase matching.
   */
  forbiddenSlots: (keyof KnownFacts)[];
  /**
   * Guided refinement state hint for the agent.
   * The full state is stored in ADK session state, but this gives the agent
   * an initial hint about the current mode at session start.
   *
   * @see server/src/types/guided-refinement.ts
   */
  guidedRefinementHint?: {
    /** Current mode: 'interview' | 'draft_build' | 'guided_refine' | 'publish_ready' */
    mode: string;
    /** Number of completed sections */
    completedSections: number;
    /** Total number of sections to refine */
    totalSections: number;
    /** Current section ID being refined (if any) */
    currentSectionId: string | null;
  };
  /**
   * Whether the reveal animation has already been shown.
   * Frontend uses this to skip coming-soon → reveal transition on return visits.
   */
  revealCompleted?: boolean;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

// Module-scoped dedup cache for lazy backfill (Pitfall #46)
// Prevents redundant writes on every request for pre-rebuild tenants
const recentlyBackfilled = new Set<string>();
const MAX_BACKFILL_CACHE = 1000;

const DEFAULT_CONSTRAINTS: AgentConstraints = {
  maxTurnsPerSession: 50,
  maxTokensPerSession: 100000,
  forbiddenWords: [
    'Great!',
    'Absolutely!',
    'Perfect!',
    "I'd be happy to",
    'revolutionary',
    'game-changing',
    'cutting-edge',
    'leverage',
    'synergy',
    'overwhelmed',
    'struggling',
    'stressed',
    'drowning',
  ],
  requiredSections: ['services'],
};

const DEFAULT_SECTION_STATE: SectionState = {
  status: 'empty',
  content: undefined,
  lastModified: undefined,
};

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export class ContextBuilderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sectionContentService?: SectionContentService
  ) {}

  /**
   * Build complete agent context for a tenant
   * This is the ONLY way to read agent context
   */
  async build(tenantId: string): Promise<AgentContext> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true, // businessName field doesn't exist - use name
        slug: true,
        branding: true,
        onboardingCompletedAt: true, // onboardingDone doesn't exist - derive from this
        onboardingPhase: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    // Resolve onboarding phase and trigger lazy backfill
    const { effectivePhase, onboardingDone } = await this.resolveAndBackfillPhase(tenantId, tenant);

    // Extract discovery facts from branding (canonical storage)
    const branding = (tenant.branding as Record<string, unknown>) || {};
    const discoveryFacts = (branding.discoveryFacts as KnownFacts) || {};

    // Build known facts from discovery data
    const knownFacts: KnownFacts = {
      businessName: tenant.name || discoveryFacts.businessName,
      businessDescription: discoveryFacts.businessDescription,
      businessType: discoveryFacts.businessType,
      location: discoveryFacts.location,
      serviceArea: discoveryFacts.serviceArea,
      yearsInBusiness: discoveryFacts.yearsInBusiness,
      specializations: discoveryFacts.specializations,
      priceRange: discoveryFacts.priceRange,
      targetAudience: discoveryFacts.targetAudience,
      uniqueSellingPoints: discoveryFacts.uniqueSellingPoints,
      ...discoveryFacts, // Include any additional facts
    };

    // Build editable facts
    const editableFacts: EditableFacts = {
      brandVoice: branding.voice as BrandVoice | undefined,
      visualPreferences: branding.visual as { style?: string; colors?: string[] } | undefined,
    };

    // Build storefront state from SectionContentService (Phase 5.2 migration)
    const storefrontState = await this.buildStorefrontStateFromSections(tenantId);

    // Determine goals based on state
    const goals = this.buildGoals(storefrontState, onboardingDone);

    // Generate forbidden questions based on known facts
    const forbiddenQuestions = this.buildForbiddenQuestions(knownFacts);

    logger.info(
      {
        tenantId,
        knownFactCount: Object.keys(knownFacts).filter((k) => knownFacts[k] !== undefined).length,
        storefrontCompletion: storefrontState.completion,
        onboardingComplete: onboardingDone,
      },
      '[ContextBuilder] Built agent context'
    );

    return {
      tenantId: tenant.id,
      businessName: tenant.name || 'Your Business',
      businessType: discoveryFacts.businessType || 'service_professional',

      knownFacts,
      editableFacts,
      storefrontState,

      constraints: DEFAULT_CONSTRAINTS,
      goals,
      openTasks: [], // TODO: Populate from task system if exists

      forbiddenQuestions,
      onboardingComplete: onboardingDone,
      onboardingPhase: effectivePhase,
    };
  }

  /**
   * Get bootstrap data for agent session initialization
   * Lighter weight than full context for session creation
   */
  async getBootstrapData(tenantId: string): Promise<BootstrapData> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true, // businessName field doesn't exist - use name
        slug: true,
        branding: true,
        onboardingCompletedAt: true, // onboardingDone doesn't exist - derive from this
        onboardingPhase: true,
        revealCompletedAt: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const branding = (tenant.branding as Record<string, unknown>) || {};
    const discoveryFacts = (branding.discoveryFacts as KnownFacts) || {};

    // Determine draft/published state from SectionContentService (Phase 5.2 migration)
    let hasDraft = false;
    let hasPublished = false;
    if (this.sectionContentService) {
      [hasDraft, hasPublished] = await Promise.all([
        this.sectionContentService.hasDraft(tenantId),
        this.sectionContentService.hasPublished(tenantId),
      ]);
    }

    // Calculate simple completion score
    const factCount = Object.keys(discoveryFacts).filter(
      (k) => discoveryFacts[k] !== undefined
    ).length;
    const completion = Math.min(
      100,
      Math.round((factCount / 10) * 50) + (hasPublished ? 50 : hasDraft ? 25 : 0)
    );

    // Enterprise slot-policy: compute which slots have values (single pass)
    // Used for both forbiddenSlots (agent must NOT re-ask) and section readiness
    const knownFactKeys = Object.keys(discoveryFacts).filter(
      (key) =>
        discoveryFacts[key as keyof KnownFacts] !== undefined &&
        discoveryFacts[key as keyof KnownFacts] !== null
    );
    const forbiddenSlots = knownFactKeys as (keyof KnownFacts)[];

    // Resolve onboarding phase and trigger lazy backfill
    const { effectivePhase, onboardingDone } = await this.resolveAndBackfillPhase(tenantId, tenant);

    logger.info(
      { tenantId, factCount, forbiddenSlots, completion },
      '[ContextBuilder] Bootstrap data prepared'
    );

    return {
      tenantId: tenant.id,
      businessName: tenant.name || 'Your Business',
      slug: tenant.slug,
      onboardingComplete: onboardingDone,
      onboardingPhase: effectivePhase,
      discoveryFacts,
      storefrontState: {
        hasDraft,
        hasPublished,
        completion,
      },
      forbiddenSlots,
      // B4: revealCompleted fallback applied in BOTH getOnboardingState AND getBootstrapData
      revealCompleted:
        tenant.revealCompletedAt !== null || (await this.hasNonSeedPackages(tenantId)),
    };
  }

  /**
   * Get onboarding state for agent context injection
   */
  async getOnboardingState(tenantId: string): Promise<{
    phase: OnboardingPhase;
    isComplete: boolean;
    discoveryFacts: KnownFacts;
    factCount: number;
    revealCompleted: boolean;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        branding: true,
        onboardingCompletedAt: true,
        onboardingPhase: true,
        revealCompletedAt: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const branding = (tenant.branding as Record<string, unknown>) || {};
    const discoveryFacts = (branding.discoveryFacts as KnownFacts) || {};
    const factCount = Object.keys(discoveryFacts).filter(
      (k) => discoveryFacts[k] !== undefined
    ).length;

    // Resolve onboarding phase and trigger lazy backfill
    const { effectivePhase, onboardingDone } = await this.resolveAndBackfillPhase(tenantId, tenant);

    return {
      phase: effectivePhase,
      isComplete: onboardingDone,
      discoveryFacts,
      factCount,
      // B4: revealCompleted fallback applied in BOTH getOnboardingState AND getBootstrapData
      revealCompleted:
        tenant.revealCompletedAt !== null || (await this.hasNonSeedPackages(tenantId)),
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Resolve effective phase and trigger lazy backfill.
   * Extracts repeated 3-line block from build(), getBootstrapData(), getOnboardingState().
   */
  private async resolveAndBackfillPhase(
    tenantId: string,
    tenant: {
      onboardingPhase: string | null;
      onboardingCompletedAt: Date | null;
    }
  ): Promise<{ effectivePhase: OnboardingPhase; onboardingDone: boolean }> {
    const effectivePhase = await this.resolveOnboardingPhase(tenant, () =>
      this.hasNonSeedPackages(tenantId)
    );
    const onboardingDone = effectivePhase === 'COMPLETED' || effectivePhase === 'SKIPPED';
    this.lazyBackfillPhase(tenantId, effectivePhase, !!tenant.onboardingPhase);
    return { effectivePhase, onboardingDone };
  }

  /**
   * Resolve the effective onboarding phase for a tenant.
   *
   * Waterfall logic:
   * 1. Explicit phase set in database → trust it
   * 2. onboardingCompletedAt set (old flow) → COMPLETED
   * 3. Has real content (pre-rebuild tenant) → COMPLETED + lazy-write backfill
   * 4. Truly new tenant → NOT_STARTED
   *
   * @param hasRealContentThunk Lazy thunk that only executes if steps 1 and 2 fail
   */
  private async resolveOnboardingPhase(
    tenant: {
      onboardingPhase: string | null;
      onboardingCompletedAt: Date | null;
    },
    hasRealContentThunk: () => Promise<boolean>
  ): Promise<OnboardingPhase> {
    // 1. Explicit phase → trust it (uses Zod safeParse for type safety)
    if (tenant.onboardingPhase && tenant.onboardingPhase !== 'NOT_STARTED') {
      return parseOnboardingPhase(tenant.onboardingPhase);
    }
    // 2. Completed via old flow
    if (tenant.onboardingCompletedAt) return 'COMPLETED';
    // 3. Has real content (pre-rebuild tenant with real packages) - LAZY evaluation
    const hasRealContent = await hasRealContentThunk();
    if (hasRealContent) return 'COMPLETED';
    // 4. Truly new tenant
    return 'NOT_STARTED';
  }

  /**
   * Detect if a tenant has real (non-seed) packages.
   *
   * IMPORTANT: Cannot use sectionContent count — seed sections are created
   * as isDraft: false at provisioning time (tenant-provisioning.service.ts:170).
   * Every provisioned tenant has published sections regardless of content quality.
   *
   * Instead, check for packages with basePrice > 0 (seed packages are always $0).
   * Cross-ref: server/src/lib/tenant-defaults.ts:28-50
   */
  private async hasNonSeedPackages(tenantId: string): Promise<boolean> {
    const realPackageCount = await this.prisma.package.count({
      where: { tenantId, basePrice: { gt: 0 } },
    });
    return realPackageCount > 0;
  }

  /**
   * Lazy backfill: set the phase permanently so heuristic becomes a no-op.
   * Idempotent, non-blocking (fire-and-forget), converts perpetual per-load
   * cost into a one-time cost per tenant.
   *
   * Dedup: Module-scoped Set prevents redundant writes on subsequent requests.
   * Bounded: Clear entire Set after 1000 entries to avoid unbounded growth.
   */
  private lazyBackfillPhase(
    tenantId: string,
    effectivePhase: OnboardingPhase,
    hasExplicitPhase: boolean
  ): void {
    if (effectivePhase === 'COMPLETED' && !hasExplicitPhase) {
      // Skip if already backfilled in this process lifetime
      if (recentlyBackfilled.has(tenantId)) {
        return;
      }

      // Fire-and-forget write
      this.prisma.tenant
        .update({
          where: { id: tenantId },
          data: { onboardingPhase: 'COMPLETED', onboardingCompletedAt: new Date() },
        })
        .then(() => {
          // Track successful backfill
          recentlyBackfilled.add(tenantId);

          // Bounded memory: clear entire Set if it grows too large
          if (recentlyBackfilled.size > MAX_BACKFILL_CACHE) {
            recentlyBackfilled.clear();
          }
        })
        .catch((err) =>
          logger.warn({ tenantId, err }, '[ContextBuilder] Lazy backfill failed — non-fatal')
        );
    }
  }

  /**
   * Build storefront state from SectionContentService (Phase 5.2 migration)
   * Replaces legacy JSON column-based buildStorefrontState()
   */
  private async buildStorefrontStateFromSections(tenantId: string): Promise<StorefrontState> {
    // If SectionContentService not available, return empty state
    if (!this.sectionContentService) {
      logger.warn(
        { tenantId },
        '[ContextBuilder] SectionContentService not available, returning empty storefront state'
      );
      return {
        completion: 0,
        sections: {
          hero: DEFAULT_SECTION_STATE,
          about: DEFAULT_SECTION_STATE,
          services: DEFAULT_SECTION_STATE,
          faq: DEFAULT_SECTION_STATE,
          reviews: DEFAULT_SECTION_STATE,
        },
        hasDraft: false,
        lastPublished: undefined,
      };
    }

    // Get all sections for this tenant (published) — parallel for perf
    const [structure, hasDraft] = await Promise.all([
      this.sectionContentService.getPageStructure(tenantId, {}),
      this.sectionContentService.hasDraft(tenantId),
    ]);

    // Flatten sections from all pages
    const allSections = structure.pages.flatMap((page) => page.sections);

    // Helper to get section state by type
    const getSectionState = (sectionType: string): SectionState => {
      const found = allSections.find((s) => s.type === sectionType && s.isPublished);
      if (found) {
        return {
          status: 'published',
          content: undefined, // Content not needed for context
          lastModified: undefined,
        };
      }
      // Check for draft
      const draftFound = allSections.find((s) => s.type === sectionType && s.isDraft);
      if (draftFound) {
        return {
          status: 'draft',
          content: undefined,
          lastModified: undefined,
        };
      }
      return DEFAULT_SECTION_STATE;
    };

    // Calculate completion score based on published sections
    const sectionWeights = { hero: 25, about: 20, services: 40, faq: 10, reviews: 5 };
    let completion = 0;

    const heroState = getSectionState('hero');
    const aboutState = getSectionState('about');
    const servicesState = getSectionState('services');
    const faqState = getSectionState('faq');
    const reviewsState = getSectionState('reviews');

    if (heroState.status === 'published') completion += sectionWeights.hero;
    if (aboutState.status === 'published') completion += sectionWeights.about;
    if (servicesState.status === 'published') completion += sectionWeights.services;
    if (faqState.status === 'published') completion += sectionWeights.faq;
    if (reviewsState.status === 'published') completion += sectionWeights.reviews;

    return {
      completion,
      sections: {
        hero: heroState,
        about: aboutState,
        services: servicesState,
        faq: faqState,
        reviews: reviewsState,
      },
      hasDraft,
      lastPublished: undefined, // TODO: Track this via SectionContent updatedAt
    };
  }

  private buildGoals(storefrontState: StorefrontState, onboardingComplete: boolean): AgentGoals {
    const blockers: string[] = [];

    // Services is required
    if (storefrontState.sections.services.status === 'empty') {
      blockers.push('services_section_empty');
    }

    // Determine primary goal
    let primary = 'complete_storefront';
    if (!onboardingComplete) {
      primary = 'complete_onboarding';
    } else if (storefrontState.completion >= 100) {
      primary = 'maintain_and_optimize';
    }

    const secondary: string[] = [];
    if (storefrontState.sections.hero.status === 'empty') {
      secondary.push('create_hero_section');
    }
    if (storefrontState.sections.about.status === 'empty') {
      secondary.push('create_about_section');
    }

    return { primary, secondary, blockers };
  }

  private buildForbiddenQuestions(knownFacts: KnownFacts): string[] {
    const forbidden: string[] = [];

    // Generate forbidden questions for each known fact
    if (knownFacts.businessName) {
      forbidden.push("What's your business name?");
      forbidden.push('What do you call your business?');
    }
    if (knownFacts.businessType) {
      forbidden.push('What type of business do you have?');
      forbidden.push('What industry are you in?');
    }
    if (knownFacts.businessDescription) {
      forbidden.push('What do you do?');
      forbidden.push('Can you describe your business?');
      forbidden.push('Tell me about your business');
    }
    if (knownFacts.location) {
      forbidden.push('Where are you located?');
      forbidden.push("What's your location?");
    }
    if (knownFacts.serviceArea) {
      forbidden.push('What area do you serve?');
      forbidden.push('Where do you provide services?');
    }

    return forbidden;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createContextBuilderService(
  prisma: PrismaClient,
  sectionContentService?: SectionContentService
): ContextBuilderService {
  return new ContextBuilderService(prisma, sectionContentService);
}
