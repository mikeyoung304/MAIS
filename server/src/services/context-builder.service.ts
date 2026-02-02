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
import type { Prisma } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';

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
  constructor(private readonly prisma: PrismaClient) {}

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
        landingPageConfig: true,
        landingPageConfigDraft: true,
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

    // Build storefront state
    const storefrontState = this.buildStorefrontState(
      tenant.landingPageConfig as Prisma.JsonValue | null,
      tenant.landingPageConfigDraft as Prisma.JsonValue | null
    );

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
        landingPageConfig: true,
        landingPageConfigDraft: true,
        onboardingCompletedAt: true, // onboardingDone doesn't exist - derive from this
        onboardingPhase: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const branding = (tenant.branding as Record<string, unknown>) || {};
    const discoveryFacts = (branding.discoveryFacts as KnownFacts) || {};

    const hasPublished =
      tenant.landingPageConfig !== null &&
      Object.keys(tenant.landingPageConfig as object).length > 0;
    const hasDraft =
      tenant.landingPageConfigDraft !== null &&
      Object.keys(tenant.landingPageConfigDraft as object).length > 0;

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

  private buildStorefrontState(
    published: Prisma.JsonValue | null,
    draft: Prisma.JsonValue | null
  ): StorefrontState {
    const hasDraft = draft !== null && Object.keys(draft as object).length > 0;
    const _hasPublished = published !== null && Object.keys(published as object).length > 0;

    // Extract section states from published config
    const publishedConfig = published as Record<string, unknown> | null;
    const extractedPublished =
      (publishedConfig?.published as Record<string, unknown>) ?? publishedConfig;
    const pages = (extractedPublished?.pages as Array<{ sections?: unknown[] }>) || [];

    const getSectionStatus = (sectionType: string): SectionState => {
      for (const page of pages) {
        const sections = (page.sections as Array<{ type?: string }>) || [];
        const found = sections.find((s) => s.type === sectionType);
        if (found) {
          return { status: 'published', content: found as Record<string, unknown> };
        }
      }
      return DEFAULT_SECTION_STATE;
    };

    // Calculate completion score
    const sectionWeights = { hero: 25, about: 20, services: 40, faq: 10, reviews: 5 };
    let completion = 0;

    const heroState = getSectionStatus('hero');
    const aboutState = getSectionStatus('about');
    const servicesState = getSectionStatus('services');
    const faqState = getSectionStatus('faq');
    const reviewsState = getSectionStatus('reviews');

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
      lastPublished: undefined, // TODO: Track this
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

export function createContextBuilderService(prisma: PrismaClient): ContextBuilderService {
  return new ContextBuilderService(prisma);
}
