/**
 * Slot Machine — Deterministic state engine for tenant onboarding
 *
 * Computes what the agent should do next based on which discovery facts
 * are known. Pure function with no database dependencies — takes
 * `knownFactKeys` and returns structured instructions.
 *
 * Called from the /store-discovery-fact endpoint after every fact storage.
 * The agent tool passes through the result to the LLM, which follows
 * `nextAction` deterministically.
 *
 * @see docs/plans/2026-02-05-feat-onboarding-ecosystem-rebuild-plan.md (Phase 3)
 */

import type { OnboardingPhase } from '../generated/prisma/enums';

// ============================================================================
// Types
// ============================================================================

export type SlotAction =
  | 'ASK'
  | 'BUILD_SECTION'
  | 'BUILD_FIRST_DRAFT'
  | 'TRIGGER_RESEARCH'
  | 'OFFER_REFINEMENT';

export interface SlotMachineResult {
  /** What to do next */
  nextAction: SlotAction;

  /** Current onboarding phase */
  currentPhase: OnboardingPhase;

  /** Whether phase just advanced */
  phaseAdvanced: boolean;

  /** Sections whose fact requirements are met */
  readySections: string[];

  /** What's still needed for the next milestone */
  missingForNext: Array<{ key: string; question: string }>;

  /** Slot utilization metrics */
  slotMetrics: {
    filled: number;
    total: number;
    utilization: number; // 0-100
  };
}

// ============================================================================
// Constants
// ============================================================================

/** All valid discovery fact keys (15 total) */
const ALL_FACT_KEYS = [
  'businessType',
  'businessName',
  'location',
  'targetMarket',
  'priceRange',
  'yearsInBusiness',
  'teamSize',
  'uniqueValue',
  'servicesOffered',
  'specialization',
  'approach',
  'dreamClient',
  'testimonial',
  'faq',
  'contactInfo',
] as const;

/**
 * Section readiness thresholds.
 * Each section requires specific facts before it can be built.
 */
const SECTION_REQUIREMENTS: Record<
  string,
  { required: string[][]; priority: 'MUST' | 'SHOULD' | 'IDEAL' }
> = {
  hero: {
    required: [['businessType']],
    priority: 'SHOULD',
  },
  about: {
    // businessType + (uniqueValue OR approach)
    required: [['businessType'], ['uniqueValue', 'approach']],
    priority: 'SHOULD',
  },
  services: {
    required: [['servicesOffered']],
    priority: 'MUST',
  },
  pricing: {
    required: [['servicesOffered'], ['priceRange']],
    priority: 'IDEAL',
  },
  faq: {
    required: [['businessType'], ['servicesOffered']],
    priority: 'IDEAL',
  },
  contact: {
    required: [['businessType']],
    priority: 'SHOULD',
  },
  cta: {
    required: [['businessType']],
    priority: 'SHOULD',
  },
  testimonials: {
    required: [['testimonial']],
    priority: 'IDEAL',
  },
  // GALLERY is not auto-buildable (requires images)
};

/** Questions to ask for each missing fact key */
const FACT_QUESTIONS: Record<string, string> = {
  businessType:
    'What kind of business do you run? (e.g., wedding photographer, life coach, massage therapist)',
  businessName: "What's the name of your business?",
  location: 'Where are you based? City and state is perfect.',
  targetMarket: 'Who are your ideal clients?',
  priceRange: "What's your typical price range?",
  servicesOffered: 'Walk me through your packages or services — what do you offer?',
  uniqueValue: 'What makes your approach different from others in your space?',
  approach: 'How would you describe your approach or style?',
  dreamClient: 'Describe your dream client — who lights you up to work with?',
  testimonial: 'Got a favorite client quote or review?',
  faq: 'What questions do your clients ask most?',
  contactInfo: "What's the best way for clients to reach you?",
  yearsInBusiness: 'How long have you been doing this?',
  teamSize: 'Is it just you, or do you have a team?',
  specialization: 'Do you specialize in any particular niche?',
};

/**
 * Priority order for asking questions.
 * Earlier keys are asked first (highest-value facts for building content).
 */
const QUESTION_PRIORITY: string[] = [
  'businessType',
  'businessName',
  'location',
  'servicesOffered',
  'uniqueValue',
  'priceRange',
  'targetMarket',
  'dreamClient',
  'approach',
  'testimonial',
  'faq',
  'contactInfo',
  'yearsInBusiness',
  'teamSize',
  'specialization',
];

/** First draft trigger: these facts must all be known */
const FIRST_DRAFT_REQUIRED = ['businessType', 'location'];
const FIRST_DRAFT_OPTIONAL = ['servicesOffered', 'uniqueValue', 'dreamClient'];

/** Research trigger: these facts must be known */
const RESEARCH_REQUIRED = ['businessType', 'location'];

// ============================================================================
// Phase Computation (also used by internal-agent.routes.ts)
// ============================================================================

/**
 * Compute onboarding phase from known fact keys.
 * Phases advance monotonically based on which facts have been gathered.
 */
export function computeCurrentPhase(knownFactKeys: string[]): OnboardingPhase {
  const has = (key: string) => knownFactKeys.includes(key);

  if (has('uniqueValue') || has('testimonial')) return 'MARKETING';
  if (has('servicesOffered') || has('priceRange')) return 'SERVICES';
  if (has('location')) return 'MARKET_RESEARCH';
  if (has('businessType')) return 'DISCOVERY';

  return 'NOT_STARTED';
}

export const PHASE_ORDER: Record<string, number> = {
  NOT_STARTED: 0,
  DISCOVERY: 1,
  MARKET_RESEARCH: 2,
  SERVICES: 3,
  MARKETING: 4,
  COMPLETED: 5,
  SKIPPED: 5,
};

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Check if a section's fact requirements are met.
 * Each entry in `required` is an OR-group: at least one key must be present.
 */
function isSectionReady(requirements: string[][], knownKeys: Set<string>): boolean {
  return requirements.every((orGroup) => orGroup.some((key) => knownKeys.has(key)));
}

/**
 * Compute the slot machine result from known fact keys.
 *
 * Pure function — no database calls, no side effects.
 * Deterministic: same inputs always produce same outputs.
 *
 * @param knownFactKeys - Array of discovery fact keys that have been stored
 * @param previousPhase - The tenant's onboarding phase before this fact was stored
 * @param researchTriggered - Whether research has already been triggered this session
 */
export function computeSlotMachine(
  knownFactKeys: string[],
  previousPhase: OnboardingPhase | string = 'NOT_STARTED',
  researchTriggered = false
): SlotMachineResult {
  const knownSet = new Set(knownFactKeys);
  const has = (key: string) => knownSet.has(key);

  // Compute phase
  const currentPhase = computeCurrentPhase(knownFactKeys);
  const phaseAdvanced = (PHASE_ORDER[currentPhase] ?? 0) > (PHASE_ORDER[previousPhase] ?? 0);

  // Compute ready sections
  const readySections: string[] = [];
  for (const [sectionType, config] of Object.entries(SECTION_REQUIREMENTS)) {
    if (isSectionReady(config.required, knownSet)) {
      readySections.push(sectionType);
    }
  }

  // Compute missing facts (next most valuable to ask)
  const missingForNext: Array<{ key: string; question: string }> = [];
  for (const key of QUESTION_PRIORITY) {
    if (!knownSet.has(key) && FACT_QUESTIONS[key]) {
      missingForNext.push({ key, question: FACT_QUESTIONS[key] });
    }
  }

  // Slot metrics
  const slotMetrics = {
    filled: knownFactKeys.length,
    total: ALL_FACT_KEYS.length,
    utilization: Math.round((knownFactKeys.length / ALL_FACT_KEYS.length) * 100),
  };

  // Determine next action
  let nextAction: SlotAction = 'ASK';

  // Check first draft trigger: businessType + location + one of (servicesOffered, uniqueValue, dreamClient)
  const hasFirstDraftRequired = FIRST_DRAFT_REQUIRED.every((k) => has(k));
  const hasFirstDraftOptional = FIRST_DRAFT_OPTIONAL.some((k) => has(k));

  if (hasFirstDraftRequired && hasFirstDraftOptional && readySections.length >= 3) {
    nextAction = 'BUILD_FIRST_DRAFT';
  }
  // Check research trigger: businessType + location, and research not yet triggered
  else if (has('businessType') && has('location') && !researchTriggered) {
    nextAction = 'TRIGGER_RESEARCH';
  }
  // If we have many sections ready, offer refinement
  else if (slotMetrics.utilization >= 60 && readySections.length >= 5) {
    nextAction = 'OFFER_REFINEMENT';
  }
  // If individual sections became ready, suggest building them
  else if (readySections.length > 0 && missingForNext.length > 0) {
    // Still more to ask — keep asking
    nextAction = 'ASK';
  }

  return {
    nextAction,
    currentPhase,
    phaseAdvanced,
    readySections,
    missingForNext: missingForNext.slice(0, 3), // Top 3 most valuable
    slotMetrics,
  };
}
