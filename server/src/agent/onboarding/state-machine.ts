/**
 * XState v5 State Machine for Onboarding Agent
 *
 * Manages the tenant onboarding flow through 4 phases:
 * Discovery → Market Research → Services → Marketing → Complete
 *
 * Architecture:
 * - Uses XState v5 setup() pattern for type safety (Kieran Fix #4)
 * - entry (not onEntry) for v5 syntax
 * - fromPromise for async actors
 * - Invokes event sourcing on each state transition
 *
 * @see https://stately.ai/docs/setup
 */

import { setup, assign, fromPromise } from 'xstate';
import type {
  OnboardingContext,
  OnboardingMachineEvent,
  DiscoveryData,
  MarketResearchData,
  ServicesData,
  MarketingData,
  OnboardingPhase,
} from '@macon/contracts';
import { getIndustryBenchmarks, type IndustryBenchmarks } from './industry-benchmarks';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';

// ============================================================================
// Actor Types (for async operations)
// ============================================================================

interface LoadBenchmarksInput {
  businessType: string;
  location: { city: string; state: string };
}

interface LoadBenchmarksOutput {
  benchmarks: IndustryBenchmarks;
}

// ============================================================================
// State Machine Definition
// ============================================================================

/**
 * Onboarding state machine using XState v5 setup() pattern.
 *
 * The setup() function provides:
 * - Type inference for context and events
 * - Typed actor inputs/outputs
 * - Typed actions and guards
 *
 * @example
 * ```typescript
 * import { createActor } from 'xstate';
 *
 * const actor = createActor(onboardingMachine, {
 *   input: { tenantId: 'tenant_123', sessionId: 'session_456' }
 * });
 *
 * actor.start();
 * actor.send({ type: 'START' });
 * actor.send({ type: 'COMPLETE_DISCOVERY', data: discoveryData });
 * ```
 */
export const onboardingMachine = setup({
  types: {
    context: {} as OnboardingContext,
    events: {} as OnboardingMachineEvent,
    input: {} as { tenantId: string; sessionId: string },
  },
  actors: {
    /**
     * Load industry benchmarks for market research phase.
     * Uses fallback data if web search is unavailable.
     */
    loadBenchmarks: fromPromise<LoadBenchmarksOutput, LoadBenchmarksInput>(async ({ input }) => {
      logger.info(
        { businessType: input.businessType, location: input.location },
        'Loading industry benchmarks'
      );

      const benchmarks = await getIndustryBenchmarks(input.businessType);

      return { benchmarks };
    }),
  },
  actions: {
    /**
     * Log state entry for debugging and observability
     */
    logStateEntry: ({ context, event }) => {
      logger.info(
        {
          tenantId: context.tenantId,
          sessionId: context.sessionId,
          eventType: event.type,
          eventVersion: context.eventVersion,
        },
        'Onboarding state transition'
      );
    },

    /**
     * Assign discovery data to context
     */
    assignDiscoveryData: assign({
      discovery: ({ event }) => {
        if (event.type === 'COMPLETE_DISCOVERY') {
          return event.data;
        }
        return undefined;
      },
    }),

    /**
     * Assign market research data to context
     */
    assignMarketResearchData: assign({
      marketResearch: ({ event }) => {
        if (event.type === 'COMPLETE_MARKET_RESEARCH') {
          return event.data;
        }
        return undefined;
      },
    }),

    /**
     * Assign services data to context
     */
    assignServicesData: assign({
      services: ({ event }) => {
        if (event.type === 'COMPLETE_SERVICES') {
          return event.data;
        }
        return undefined;
      },
    }),

    /**
     * Assign marketing data to context
     */
    assignMarketingData: assign({
      marketing: ({ event }) => {
        if (event.type === 'COMPLETE_MARKETING') {
          return event.data;
        }
        return undefined;
      },
    }),

    /**
     * Assign error to context
     */
    assignError: assign({
      error: ({ event }) => {
        if (event.type === 'ERROR') {
          return event.error;
        }
        return undefined;
      },
    }),

    /**
     * Clear error from context
     */
    clearError: assign({
      error: undefined,
    }),

    /**
     * Increment event version (for optimistic locking)
     */
    incrementVersion: assign({
      eventVersion: ({ context }) => context.eventVersion + 1,
    }),
  },
  guards: {
    /**
     * Check if discovery data is complete
     */
    hasDiscoveryData: ({ context }) => {
      return (
        context.discovery !== undefined &&
        !!context.discovery.businessType &&
        !!context.discovery.businessName &&
        !!context.discovery.location?.city
      );
    },

    /**
     * Check if market research data is complete
     */
    hasMarketResearchData: ({ context }) => {
      return (
        context.marketResearch !== undefined && !!context.marketResearch.pricingBenchmarks?.source
      );
    },

    /**
     * Check if services data is complete
     */
    hasServicesData: ({ context }) => {
      return (
        context.services !== undefined &&
        context.services.segments?.length > 0 &&
        context.services.createdPackageIds?.length > 0
      );
    },

    /**
     * Check if marketing data is present (optional fields, so any data counts)
     */
    hasMarketingData: ({ context }) => {
      return context.marketing !== undefined;
    },
  },
}).createMachine({
  id: 'onboarding',
  initial: 'notStarted',
  context: ({ input }) => ({
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    eventVersion: 0,
    discovery: undefined,
    marketResearch: undefined,
    services: undefined,
    marketing: undefined,
    error: undefined,
  }),
  states: {
    /**
     * Initial state - no onboarding interaction yet
     */
    notStarted: {
      on: {
        START: {
          target: 'discovery',
          actions: ['logStateEntry', 'incrementVersion'],
        },
        SKIP: {
          target: 'skipped',
          actions: ['logStateEntry', 'incrementVersion'],
        },
      },
    },

    /**
     * Discovery phase - collecting business information
     */
    discovery: {
      entry: ['logStateEntry'], // XState v5 uses 'entry' not 'onEntry'
      on: {
        COMPLETE_DISCOVERY: {
          target: 'marketResearch',
          actions: ['assignDiscoveryData', 'incrementVersion'],
        },
        SKIP: {
          target: 'skipped',
          actions: ['incrementVersion'],
        },
      },
    },

    /**
     * Market Research phase - analyzing market and generating pricing recommendations
     * Invokes async actor to load benchmarks (can use web search or fallback data)
     */
    marketResearch: {
      entry: ['logStateEntry'],
      invoke: {
        id: 'loadBenchmarks',
        src: 'loadBenchmarks',
        input: ({ context }) => ({
          businessType: context.discovery?.businessType || 'other',
          location: context.discovery?.location || { city: 'Unknown', state: 'Unknown' },
        }),
        onDone: {
          // Benchmarks loaded - stay in marketResearch until agent completes
          actions: ({ event }) => {
            logger.info(
              { benchmarksLoaded: true, source: event.output.benchmarks.source },
              'Industry benchmarks loaded'
            );
          },
        },
        onError: {
          target: 'error',
          actions: [
            assign({ error: ({ event }) => String(event.error) }),
            ({ event }) => {
              logger.error(
                { error: sanitizeError(event.error) },
                'Failed to load industry benchmarks'
              );
            },
          ],
        },
      },
      on: {
        COMPLETE_MARKET_RESEARCH: {
          target: 'services',
          actions: ['assignMarketResearchData', 'incrementVersion'],
        },
        GO_BACK: {
          target: 'discovery',
          actions: ['incrementVersion'],
        },
        SKIP: {
          target: 'skipped',
          actions: ['incrementVersion'],
        },
      },
    },

    /**
     * Services phase - creating service packages based on recommendations
     */
    services: {
      entry: ['logStateEntry'],
      on: {
        COMPLETE_SERVICES: {
          target: 'marketing',
          actions: ['assignServicesData', 'incrementVersion'],
        },
        GO_BACK: {
          target: 'marketResearch',
          actions: ['incrementVersion'],
        },
        SKIP: {
          target: 'completed', // Can skip marketing and go straight to completed
          actions: ['incrementVersion'],
        },
      },
    },

    /**
     * Marketing phase - configuring landing page and brand voice
     */
    marketing: {
      entry: ['logStateEntry'],
      on: {
        COMPLETE_MARKETING: {
          target: 'completed',
          actions: ['assignMarketingData', 'incrementVersion'],
        },
        GO_BACK: {
          target: 'services',
          actions: ['incrementVersion'],
        },
        SKIP: {
          target: 'completed',
          actions: ['incrementVersion'],
        },
      },
    },

    /**
     * Completed state - onboarding finished successfully
     */
    completed: {
      entry: ['logStateEntry'],
      type: 'final',
    },

    /**
     * Skipped state - user opted out of onboarding
     */
    skipped: {
      entry: ['logStateEntry'],
      type: 'final',
    },

    /**
     * Error state - something went wrong
     */
    error: {
      entry: ['logStateEntry', 'assignError'],
      on: {
        RETRY: {
          target: 'marketResearch', // Go back to where we were
          actions: ['clearError'],
        },
        SKIP: {
          target: 'skipped',
          actions: ['clearError', 'incrementVersion'],
        },
      },
    },
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map XState state value to OnboardingPhase enum
 */
export function stateToPhase(stateValue: string): OnboardingPhase {
  const mapping: Record<string, OnboardingPhase> = {
    notStarted: 'NOT_STARTED',
    discovery: 'DISCOVERY',
    marketResearch: 'MARKET_RESEARCH',
    services: 'SERVICES',
    marketing: 'MARKETING',
    completed: 'COMPLETED',
    skipped: 'SKIPPED',
    error: 'NOT_STARTED', // Error state maps back to not started for recovery
  };

  return mapping[stateValue] || 'NOT_STARTED';
}

/**
 * Map OnboardingPhase enum to XState state value
 */
export function phaseToState(phase: OnboardingPhase): string {
  const mapping: Record<OnboardingPhase, string> = {
    NOT_STARTED: 'notStarted',
    DISCOVERY: 'discovery',
    MARKET_RESEARCH: 'marketResearch',
    SERVICES: 'services',
    MARKETING: 'marketing',
    COMPLETED: 'completed',
    SKIPPED: 'skipped',
  };

  return mapping[phase];
}

/**
 * Get valid next phases from current phase
 */
export function getValidTransitions(currentPhase: OnboardingPhase): OnboardingPhase[] {
  const transitions: Record<OnboardingPhase, OnboardingPhase[]> = {
    NOT_STARTED: ['DISCOVERY', 'SKIPPED'],
    DISCOVERY: ['MARKET_RESEARCH', 'SKIPPED'],
    MARKET_RESEARCH: ['SERVICES', 'DISCOVERY', 'SKIPPED'],
    SERVICES: ['MARKETING', 'MARKET_RESEARCH', 'COMPLETED', 'SKIPPED'],
    MARKETING: ['COMPLETED', 'SERVICES', 'SKIPPED'],
    COMPLETED: [], // Final state
    SKIPPED: [], // Final state
  };

  return transitions[currentPhase] || [];
}

/**
 * Check if a phase transition is valid
 */
export function isValidTransition(from: OnboardingPhase, to: OnboardingPhase): boolean {
  return getValidTransitions(from).includes(to);
}

// Export the machine type for external typing
export type OnboardingMachine = typeof onboardingMachine;
