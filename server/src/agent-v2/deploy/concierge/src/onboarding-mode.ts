/**
 * Onboarding Mode Detection & Utilities
 *
 * Provides mode detection and resume greeting generation for the Concierge agent.
 * Used to determine if a tenant needs onboarding and to create personalized resume messages.
 *
 * Architecture:
 * - Single boolean check (needsOnboarding)
 * - Deterministic greeting from discovery data
 * - No LLM calls - pure data projection
 */

/**
 * Bootstrap response from the backend.
 * Returned by POST /v1/internal/agent/bootstrap
 */
export interface BootstrapResponse {
  tenantId: string;
  businessName: string;
  industry: string | null;
  tier: string;
  onboardingDone: boolean;
  discoveryData: DiscoveryData | null;
}

/**
 * Discovery data from advisor memory.
 * Projected from onboarding events.
 */
export interface DiscoveryData {
  businessType?: string;
  businessName?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  targetMarket?: string;
  yearsInBusiness?: number;
  servicesOffered?: string[];
}

/**
 * Single boolean check - no complex conditions.
 * This is THE check for onboarding mode.
 *
 * @param bootstrap - Bootstrap response from backend
 * @returns true if tenant needs onboarding
 */
export function needsOnboarding(bootstrap: BootstrapResponse): boolean {
  return !bootstrap.onboardingDone;
}

/**
 * Generate resume greeting from existing discovery data.
 * Creates a personalized message for returning users.
 *
 * @param discoveryData - Discovery data from advisor memory
 * @returns Human-friendly greeting or empty string if no data
 */
export function getResumeGreeting(discoveryData: DiscoveryData | null): string {
  if (!discoveryData?.businessType) return '';

  const parts = [`Welcome back! I remember you're a ${discoveryData.businessType}`];

  // Add location context if available
  if (discoveryData.location) {
    const { city, state } = discoveryData.location;
    if (city && state) {
      parts[0] += ` in ${city}, ${state}`;
    } else if (city) {
      parts[0] += ` in ${city}`;
    }
  }

  // Add experience context if available
  if (discoveryData.yearsInBusiness !== undefined) {
    if (discoveryData.yearsInBusiness === 0) {
      parts.push('just getting started');
    } else if (discoveryData.yearsInBusiness === 1) {
      parts.push('with a year under your belt');
    } else {
      parts.push(`with ${discoveryData.yearsInBusiness} years of experience`);
    }
  }

  // Join parts naturally
  const greeting = parts.join(', ') + '. Ready to continue?';
  return greeting;
}

/**
 * Get a summary of what the user has already done during onboarding.
 * Useful for resume context.
 *
 * @param discoveryData - Discovery data from advisor memory
 * @returns Summary of completed items or empty string
 */
export function getProgressSummary(discoveryData: DiscoveryData | null): string {
  if (!discoveryData) return '';

  const completed: string[] = [];

  if (discoveryData.businessType) {
    completed.push('told me about your business');
  }

  if (discoveryData.location?.city) {
    completed.push('shared your location');
  }

  if (discoveryData.targetMarket) {
    completed.push('defined your target market');
  }

  if (discoveryData.servicesOffered && discoveryData.servicesOffered.length > 0) {
    completed.push(`listed ${discoveryData.servicesOffered.length} services`);
  }

  if (completed.length === 0) return '';

  return `So far you've ${completed.join(', ')}.`;
}

/**
 * Build the full onboarding context for system prompt injection.
 * Combines bootstrap data with computed summaries.
 *
 * @param bootstrap - Bootstrap response from backend
 * @returns Context object for prompt injection
 */
export function buildOnboardingContext(bootstrap: BootstrapResponse): {
  isOnboarding: boolean;
  resumeGreeting: string;
  progressSummary: string;
  knownFacts: string[];
} {
  const isOnboarding = needsOnboarding(bootstrap);
  const resumeGreeting = getResumeGreeting(bootstrap.discoveryData);
  const progressSummary = getProgressSummary(bootstrap.discoveryData);

  // Build list of known facts for context
  const knownFacts: string[] = [];
  if (bootstrap.discoveryData) {
    if (bootstrap.discoveryData.businessType) {
      knownFacts.push(`Business type: ${bootstrap.discoveryData.businessType}`);
    }
    if (bootstrap.discoveryData.businessName) {
      knownFacts.push(`Business name: ${bootstrap.discoveryData.businessName}`);
    }
    if (bootstrap.discoveryData.location?.city) {
      const loc = bootstrap.discoveryData.location;
      knownFacts.push(`Location: ${loc.city}${loc.state ? `, ${loc.state}` : ''}`);
    }
    if (bootstrap.discoveryData.targetMarket) {
      knownFacts.push(`Target market: ${bootstrap.discoveryData.targetMarket}`);
    }
    if (bootstrap.discoveryData.yearsInBusiness !== undefined) {
      knownFacts.push(`Years in business: ${bootstrap.discoveryData.yearsInBusiness}`);
    }
    if (bootstrap.discoveryData.servicesOffered?.length) {
      knownFacts.push(`Services: ${bootstrap.discoveryData.servicesOffered.join(', ')}`);
    }
  }

  return {
    isOnboarding,
    resumeGreeting,
    progressSummary,
    knownFacts,
  };
}
