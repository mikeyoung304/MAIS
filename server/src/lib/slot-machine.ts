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
import { SECTION_BLUEPRINT, type SectionReadiness, type SectionQuality } from '@macon/contracts';

// ============================================================================
// Types
// ============================================================================

export type SlotAction =
  | 'ASK'
  | 'BUILD_SECTION'
  | 'BUILD_FIRST_DRAFT'
  | 'TRIGGER_RESEARCH'
  | 'OFFER_REFINEMENT';

// Re-export for consumers
export type { SectionReadiness, SectionQuality };

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

  /** Per-section readiness with quality levels (Phase 3) */
  sectionReadiness: SectionReadiness[];
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
 * Section readiness thresholds — derived from canonical SECTION_BLUEPRINT.
 * Each section requires specific facts before it can be built.
 */
const SECTION_REQUIREMENTS: Record<
  string,
  { required: string[][]; optional: string[]; priority: 'MUST' | 'SHOULD' | 'IDEAL' }
> = Object.fromEntries(
  SECTION_BLUEPRINT.map((entry) => [
    entry.sectionType,
    {
      required: entry.requiredFacts,
      optional: entry.optionalFacts,
      priority: entry.priority,
    },
  ])
);

/** Questions to ask for each missing fact key.
 * Q1 (location) and Q2 (businessType) are scripted in the system prompt.
 * These hints are fallbacks for the slot machine's missingForNext — the agent
 * uses its personality to phrase them, not reading them verbatim.
 */
const FACT_QUESTIONS: Record<string, string> = {
  businessType: 'What do you do, and who do you do it for?',
  businessName: "What's the name of your business?",
  location:
    'Welcome to Handled. I\u2019m going to help you set up your website and storefront. To get us started, what city and state are you in?',
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
 *
 * Design: location (#1) + businessType (#2) triggers async backend research.
 * Questions #3-#7 fill the ~30s research gap with hero/about content facts.
 * servicesOffered (#8) + priceRange (#9) come AFTER research completes,
 * so the agent can cite market data when discussing pricing.
 */
const QUESTION_PRIORITY: string[] = [
  'location', // #1 — greeting icebreaker, triggers research with businessType
  'businessType', // #2 — triggers async research when combined with location
  'businessName', // #3 — research running in background (~30s)
  'uniqueValue', // #4 — powers hero/about content
  'approach', // #5 — powers about section
  'dreamClient', // #6 — powers hero/about content
  'targetMarket', // #7 — research likely complete by now
  'servicesOffered', // #8 — agent cites research data for pricing context
  'priceRange', // #9 — informed by research results
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
 * Compute quality level based on how many relevant facts are available.
 *
 * - minimal: Only required facts present (bare minimum to build)
 * - good: Required + some optional facts
 * - excellent: Required + most/all optional facts
 */
function computeQuality(
  requiredFacts: string[][],
  optionalFacts: string[],
  knownKeys: Set<string>
): SectionQuality {
  // All unique fact keys relevant to this section
  const allRelevant = [...new Set([...requiredFacts.flat(), ...optionalFacts])];
  const knownRelevant = allRelevant.filter((k) => knownKeys.has(k));
  const ratio = allRelevant.length > 0 ? knownRelevant.length / allRelevant.length : 0;

  if (ratio >= 0.8) return 'excellent';
  if (ratio >= 0.5) return 'good';
  return 'minimal';
}

/**
 * Compute per-section readiness for all canonical sections.
 * Returns an array in blueprint order (hero → cta).
 */
export function computeSectionReadiness(knownFactKeys: string[]): SectionReadiness[] {
  const knownSet = new Set(knownFactKeys);

  return SECTION_BLUEPRINT.map((entry) => {
    const config = SECTION_REQUIREMENTS[entry.sectionType];
    if (!config) {
      return {
        sectionType: entry.sectionType,
        isReady: false,
        knownFacts: [],
        missingFacts: [],
        quality: 'minimal' as SectionQuality,
      };
    }

    const isReady = isSectionReady(config.required, knownSet);

    // Collect all relevant fact keys for this section
    const allRelevant = [...new Set([...config.required.flat(), ...config.optional])];
    const knownFacts = allRelevant.filter((k) => knownSet.has(k));
    const missingFacts = allRelevant.filter((k) => !knownSet.has(k));

    const quality = isReady
      ? computeQuality(config.required, config.optional, knownSet)
      : 'minimal';

    return {
      sectionType: entry.sectionType,
      isReady,
      knownFacts,
      missingFacts,
      quality,
    };
  });
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

  // Compute per-section readiness (Phase 3)
  const sectionReadiness = computeSectionReadiness(knownFactKeys);

  return {
    nextAction,
    currentPhase,
    phaseAdvanced,
    readySections,
    missingForNext: missingForNext.slice(0, 3), // Top 3 most valuable
    slotMetrics,
    sectionReadiness,
  };
}
