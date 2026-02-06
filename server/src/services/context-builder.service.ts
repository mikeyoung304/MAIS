/**
 * ContextBuilder Service
 *
 * Single source of truth for agent context assembly.
 * Replaces legacy AdvisorMemoryService with direct reads from canonical storage.
 *
 * Architecture: Agent-First (2026-02-01)
 * - Context is injected at session start, never inferred
 * - One read path for all agent context
 * - Reads from tenant.branding.discoveryFacts (state-based, not event-sourced)
 *
 * @see docs/architecture/AGENT_FIRST_ARCHITECTURE_SPEC.md
 */

import type { PrismaClient } from '../generated/prisma/client';
import type { SectionReadiness } from '@macon/contracts';
import { logger } from '../lib/core/logger';
import { computeSectionReadiness } from '../lib/slot-machine';
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
  onboardingPhase: string;
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
  onboardingPhase: string;
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
   * Per-section readiness computed from known discovery facts.
   * Used by the agent to know which sections can be built and at what quality.
   *
   * @see server/src/lib/slot-machine.ts computeSectionReadiness()
   */
  sectionReadiness?: SectionReadiness[];
  /**
   * Whether the reveal animation has already been shown.
   * Frontend uses this to skip coming-soon → reveal transition on return visits.
   */
  revealCompleted?: boolean;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

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

    // Compute onboardingDone from completedAt or phase
    const onboardingDone =
      tenant.onboardingCompletedAt !== null || tenant.onboardingPhase === 'COMPLETED';

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
      onboardingPhase: tenant.onboardingPhase || 'NOT_STARTED',
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
      hasDraft = await this.sectionContentService.hasDraft(tenantId);
      hasPublished = await this.sectionContentService.hasPublished(tenantId);
    }

    // Calculate simple completion score
    const factCount = Object.keys(discoveryFacts).filter(
      (k) => discoveryFacts[k] !== undefined
    ).length;
    const completion = Math.min(
      100,
      Math.round((factCount / 10) * 50) + (hasPublished ? 50 : hasDraft ? 25 : 0)
    );

    // Enterprise slot-policy: compute which slots have values
    // Agent must NOT ask for any of these slots
    const forbiddenSlots = Object.keys(discoveryFacts).filter(
      (key) =>
        discoveryFacts[key as keyof KnownFacts] !== undefined &&
        discoveryFacts[key as keyof KnownFacts] !== null
    ) as (keyof KnownFacts)[];

    // Compute onboardingDone from completedAt or phase
    const onboardingDone =
      tenant.onboardingCompletedAt !== null || tenant.onboardingPhase === 'COMPLETED';

    logger.info(
      { tenantId, factCount, forbiddenSlots, completion },
      '[ContextBuilder] Bootstrap data prepared'
    );

    // Compute per-section readiness from known fact keys
    const knownFactKeys = Object.keys(discoveryFacts).filter(
      (k) =>
        discoveryFacts[k as keyof KnownFacts] !== undefined &&
        discoveryFacts[k as keyof KnownFacts] !== null
    );
    const sectionReadiness = computeSectionReadiness(knownFactKeys);

    return {
      tenantId: tenant.id,
      businessName: tenant.name || 'Your Business',
      slug: tenant.slug,
      onboardingComplete: onboardingDone,
      onboardingPhase: tenant.onboardingPhase || 'NOT_STARTED',
      discoveryFacts,
      storefrontState: {
        hasDraft,
        hasPublished,
        completion,
      },
      forbiddenSlots,
      sectionReadiness,
      revealCompleted: tenant.revealCompletedAt !== null,
    };
  }

  /**
   * Get onboarding state (replaces AdvisorMemoryService.getOnboardingContext)
   */
  async getOnboardingState(tenantId: string): Promise<{
    phase: string;
    isComplete: boolean;
    discoveryFacts: KnownFacts;
    factCount: number;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        branding: true,
        onboardingCompletedAt: true, // onboardingDone doesn't exist - derive from this
        onboardingPhase: true,
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

    // Compute onboardingDone from completedAt or phase
    const onboardingDone =
      tenant.onboardingCompletedAt !== null || tenant.onboardingPhase === 'COMPLETED';

    return {
      phase: tenant.onboardingPhase || 'NOT_STARTED',
      isComplete: onboardingDone,
      discoveryFacts,
      factCount,
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

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

    // Get all sections for this tenant (published)
    const structure = await this.sectionContentService.getPageStructure(tenantId, {});
    const hasDraft = await this.sectionContentService.hasDraft(tenantId);

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
