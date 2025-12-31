/**
 * Onboarding Agent Module
 *
 * Agent-powered tenant onboarding system with:
 * - XState v5 state machine for flow management
 * - Event sourcing for audit trail and state reconstruction
 * - Industry benchmarks for pricing recommendations
 *
 * Phase 1 exports (Foundation):
 * - State machine and helpers
 * - Event sourcing utilities
 * - Industry benchmarks
 */

// State Machine (XState v5)
export {
  onboardingMachine,
  stateToPhase,
  phaseToState,
  getValidTransitions,
  isValidTransition,
  type OnboardingMachine,
} from './state-machine';

// Event Sourcing
export {
  getNextVersion,
  validateEventPayload,
  safeValidateEventPayload,
  appendEvent,
  updateOnboardingPhase,
  type AppendEventResult,
  type UpdatePhaseResult,
} from './event-sourcing';

// NOTE: For state projection and event history, use AdvisorMemoryRepository
// from server/src/lib/ports.ts via dependency injection

// Industry Benchmarks
export {
  getIndustryBenchmarks,
  toPricingBenchmarks,
  getSupportedBusinessTypes,
  type IndustryBenchmarks,
} from './industry-benchmarks';

// Market Search (Phase 2)
export {
  searchMarketPricing,
  getMarketResearch,
  type MarketSearchOptions,
  type MarketSearchResult,
  type MarketSearchError,
  type MarketSearchResponse,
} from './market-search';

// Advisor Memory Service (Phase 3)
export {
  AdvisorMemoryService,
  type AdvisorMemorySummary,
  type OnboardingContext,
} from './advisor-memory.service';
