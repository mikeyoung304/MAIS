/**
 * Behavioral Test Fixtures for Tenant Agent Prompt
 *
 * These fixtures define expected behaviors that should remain stable
 * across prompt changes. Use these to validate that prompt modifications
 * don't regress critical functionality.
 *
 * Categories:
 * 1. Fact-to-Storefront Bridge - Storing facts AND applying them (pitfall #80)
 * 2. Trust Tier T3 Confirmation - Hard confirmation for publish/discard
 * 3. Onboarding Detection - Proactive vs passive behavior
 * 4. Jargon Prevention - No technical terms in responses
 * 5. Generate-Then-Refine - Agent generates copy, user refines
 * 6. Voice & Tone - Confirmation vocabulary, no enthusiasm excesses
 * 7. Tool Failure Recovery - Graceful degradation
 *
 * @see CLAUDE.md pitfall #80 (Fact-to-Storefront Bridge)
 * @see docs/design/VOICE_QUICK_REFERENCE.md
 * @see server/src/agent-v2/deploy/tenant/src/prompts/system.ts
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * A tool call expected to be made by the agent
 */
export interface ExpectedToolCall {
  /** Tool name (e.g., 'store_discovery_fact', 'update_section') */
  toolName: string;
  /** Key parameters that should be present (not exhaustive) */
  expectedParams?: Record<string, unknown>;
  /** Description of why this tool should be called */
  reason: string;
}

/**
 * Phrases the agent SHOULD use in responses
 */
export interface ExpectedPhrases {
  /** Phrases that should appear in the response */
  shouldInclude?: string[];
  /** Patterns that should match (regex) */
  shouldMatch?: RegExp[];
}

/**
 * Anti-patterns that indicate a regression
 */
export interface AntiPatterns {
  /** Phrases that should NEVER appear */
  forbiddenPhrases?: string[];
  /** Tool calls that should NOT be made alone */
  forbiddenToolsAlone?: string[];
  /** Patterns that indicate wrong behavior */
  forbiddenPatterns?: RegExp[];
  /** Description of the anti-pattern */
  description: string;
}

/**
 * A behavioral test case for the prompt
 */
export interface PromptBehaviorTestCase {
  /** Unique identifier for the test case */
  id: string;
  /** Category for grouping related tests */
  category: BehaviorCategory;
  /** Human-readable name */
  name: string;
  /** Description of what this test validates */
  description: string;
  /** The trigger message from the user */
  trigger: string;
  /** Optional context that should be set up (e.g., onboarding state) */
  context?: TestContext;
  /** Tools that MUST be called in response */
  expectedTools: ExpectedToolCall[];
  /** Phrases/patterns that should appear in responses */
  expectedResponse?: ExpectedPhrases;
  /** Patterns that indicate regression */
  antiPatterns: AntiPatterns;
  /** Reference to related CLAUDE.md pitfall */
  relatedPitfall?: number;
  /** Priority: 1 = critical, 2 = important, 3 = nice-to-have */
  priority: 1 | 2 | 3;
}

/**
 * Context for setting up test scenarios
 */
export interface TestContext {
  /** Whether the storefront has placeholder content */
  hasPlaceholderContent?: boolean;
  /** Whether a draft exists */
  hasDraft?: boolean;
  /** Current page structure state */
  pageStructure?: 'empty' | 'partial' | 'complete';
  /** Session state values */
  sessionState?: Record<string, unknown>;
}

/**
 * Categories for behavioral tests
 */
export type BehaviorCategory =
  | 'fact-storefront-bridge'
  | 't3-confirmation'
  | 'onboarding-detection'
  | 'jargon-prevention'
  | 'generate-then-refine'
  | 'voice-tone'
  | 'tool-failure-recovery'
  | 'decision-flow';

// =============================================================================
// FORBIDDEN VOCABULARY (from system prompt)
// =============================================================================

/**
 * Technical jargon that should NEVER appear in agent responses
 */
export const FORBIDDEN_JARGON = [
  'section',
  'hero',
  'CTA',
  'draft',
  'published',
  'preview',
  "let's tackle",
  "let's work on",
  'your hero section',
  'your about section',
  'your testimonials section',
  'your FAQ section',
  'your contact section',
] as const;

/**
 * Hype words that should NEVER be used
 */
export const FORBIDDEN_HYPE_WORDS = [
  'revolutionary',
  'game-changing',
  'cutting-edge',
  'leverage',
  'optimize',
  'synergy',
  'seamless',
  'empower',
  'transform',
  'innovative',
] as const;

/**
 * Punching down language that should NEVER be used
 */
export const FORBIDDEN_PUNCHING_DOWN = [
  'overwhelmed',
  'struggling',
  'stressed',
  'drowning',
  'chaos',
  'frantic',
  'desperate',
] as const;

/**
 * Enthusiasm excesses that should NEVER be used
 */
export const FORBIDDEN_ENTHUSIASM = [
  'Great!',
  'Absolutely!',
  'Perfect!',
  'Wonderful!',
  'Amazing!',
  'Awesome!',
  "I'd be happy to",
  'I would be happy to',
] as const;

/**
 * Passive phrases that indicate wrong behavior
 */
export const FORBIDDEN_PASSIVE = [
  'What would you like to do?',
  'How can I help?',
  'What should I update?',
  'Let me know what you need',
  'What can I do for you?',
] as const;

/**
 * All forbidden vocabulary combined
 */
export const ALL_FORBIDDEN_VOCABULARY = [
  ...FORBIDDEN_JARGON,
  ...FORBIDDEN_HYPE_WORDS,
  ...FORBIDDEN_PUNCHING_DOWN,
  ...FORBIDDEN_ENTHUSIASM,
  ...FORBIDDEN_PASSIVE,
] as const;

// =============================================================================
// ALLOWED VOCABULARY
// =============================================================================

/**
 * Confirmation words the agent SHOULD use
 */
export const ALLOWED_CONFIRMATIONS = [
  'got it',
  'done',
  'on it',
  'heard',
  'bet',
  'say less',
  'cool',
  'next',
  'queued',
  'take a look',
] as const;

/**
 * Words the brand likes
 */
export const BRAND_APPROVED_WORDS = [
  'handled',
  'calm',
  'contained',
  'confirmation',
  'project room',
  'next step',
  'on track',
  'nothing slips',
  'queued',
  'done',
  'got it',
  'heard',
] as const;

// =============================================================================
// BEHAVIORAL TEST CASES
// =============================================================================

export const EXPECTED_BEHAVIORS: PromptBehaviorTestCase[] = [
  // ============================================================================
  // CATEGORY: Fact-to-Storefront Bridge (Pitfall #80)
  // ============================================================================
  {
    id: 'fact-bridge-001',
    category: 'fact-storefront-bridge',
    name: 'Fact AND Storefront Update',
    description:
      'When user provides content that should be stored AND applied, agent must call BOTH store_discovery_fact AND update_section in the same turn',
    trigger: 'my about should mention I started 10 years ago',
    context: {
      hasPlaceholderContent: false,
      hasDraft: false,
    },
    expectedTools: [
      {
        toolName: 'store_discovery_fact',
        expectedParams: {
          factType: 'business_history',
        },
        reason: 'Store the discovery fact for future reference',
      },
      {
        toolName: 'update_section',
        reason: 'Apply the fact to the storefront immediately',
      },
    ],
    expectedResponse: {
      shouldInclude: ['got it', 'done', 'take a look'],
    },
    antiPatterns: {
      forbiddenToolsAlone: ['store_discovery_fact'],
      description:
        'Only storing the fact without updating the storefront leaves user wondering why nothing changed',
    },
    relatedPitfall: 88,
    priority: 1,
  },
  {
    id: 'fact-bridge-002',
    category: 'fact-storefront-bridge',
    name: 'Location Fact to Contact',
    description: 'User mentions location - should update contact section',
    trigger: "I'm based in Austin, Texas",
    context: {
      hasPlaceholderContent: true,
    },
    expectedTools: [
      {
        toolName: 'store_discovery_fact',
        expectedParams: {
          factType: 'location',
        },
        reason: 'Store location fact',
      },
      {
        toolName: 'update_section',
        reason: 'Apply location to contact section',
      },
    ],
    antiPatterns: {
      forbiddenToolsAlone: ['store_discovery_fact'],
      description: 'Storing location without applying it to the site',
    },
    relatedPitfall: 88,
    priority: 1,
  },
  {
    id: 'fact-bridge-003',
    category: 'fact-storefront-bridge',
    name: 'Specialty Fact to Hero',
    description: 'User mentions specialty - should update hero/tagline',
    trigger: 'I specialize in luxury destination weddings',
    context: {
      hasPlaceholderContent: true,
    },
    expectedTools: [
      {
        toolName: 'store_discovery_fact',
        reason: 'Store specialty fact',
      },
      {
        toolName: 'update_section',
        reason: 'Apply specialty to hero/tagline',
      },
    ],
    antiPatterns: {
      forbiddenToolsAlone: ['store_discovery_fact'],
      description: 'Storing specialty without updating the hero',
    },
    relatedPitfall: 88,
    priority: 1,
  },

  // ============================================================================
  // CATEGORY: T3 Confirmation Gate
  // ============================================================================
  {
    id: 't3-publish-001',
    category: 't3-confirmation',
    name: 'Publish with Explicit Confirmation',
    description: 'publish_draft must have confirmationReceived: true',
    trigger: 'publish it',
    context: {
      hasDraft: true,
    },
    expectedTools: [
      {
        toolName: 'publish_draft',
        expectedParams: {
          confirmationReceived: true,
        },
        reason: 'T3 action requires explicit confirmation parameter',
      },
    ],
    expectedResponse: {
      shouldMatch: [/live|published/i],
    },
    antiPatterns: {
      forbiddenPatterns: [/confirmationReceived.*false/],
      description: 'Publishing without confirmationReceived: true bypasses T3 gate',
    },
    priority: 1,
  },
  {
    id: 't3-publish-002',
    category: 't3-confirmation',
    name: 'Publish Confirmation Words',
    description: 'Agent recognizes "ship it" as publish confirmation',
    trigger: 'ship it',
    context: {
      hasDraft: true,
    },
    expectedTools: [
      {
        toolName: 'publish_draft',
        expectedParams: {
          confirmationReceived: true,
        },
        reason: '"ship it" is a valid publish confirmation word',
      },
    ],
    antiPatterns: {
      forbiddenPhrases: ['Are you sure', 'Do you want to publish'],
      description: '"ship it" is explicit enough, no need to re-confirm',
    },
    priority: 1,
  },
  {
    id: 't3-discard-001',
    category: 't3-confirmation',
    name: 'Discard with Confirmation',
    description: 'discard_draft requires confirmation for destructive action',
    trigger: 'start over',
    context: {
      hasDraft: true,
    },
    expectedTools: [
      {
        toolName: 'discard_draft',
        expectedParams: {
          confirmationReceived: true,
        },
        reason: 'Discard is destructive, needs T3 confirmation',
      },
    ],
    antiPatterns: {
      forbiddenPatterns: [/confirmationReceived.*false/],
      description: 'Discarding without confirmation loses user work',
    },
    relatedPitfall: 49,
    priority: 1,
  },
  {
    id: 't3-discard-002',
    category: 't3-confirmation',
    name: 'Revert Requires Confirmation',
    description: 'Agent asks for confirmation before reverting',
    trigger: 'revert all my changes',
    context: {
      hasDraft: true,
    },
    expectedTools: [],
    expectedResponse: {
      shouldMatch: [/confirm|sure|lose.*changes/i],
    },
    antiPatterns: {
      forbiddenToolsAlone: ['discard_draft'],
      description: 'Should not discard without explicit confirmation',
    },
    priority: 1,
  },

  // ============================================================================
  // CATEGORY: Onboarding Detection
  // ============================================================================
  {
    id: 'onboarding-001',
    category: 'onboarding-detection',
    name: 'Placeholder Detection Triggers Interview',
    description: 'When get_page_structure returns placeholders, agent becomes proactive',
    trigger: 'build my site',
    context: {
      hasPlaceholderContent: true,
      pageStructure: 'empty',
    },
    expectedTools: [
      {
        toolName: 'get_page_structure',
        reason: 'Check current state before proceeding',
      },
    ],
    expectedResponse: {
      shouldMatch: [/what do you do/i, /30.?second/i, /tell me about/i, /elevator pitch/i],
    },
    antiPatterns: {
      forbiddenPhrases: [
        'What would you like to do?',
        'How can I help?',
        "Let's start with your hero section",
      ],
      description: 'Passive questions put burden on non-technical user',
    },
    priority: 1,
  },
  {
    id: 'onboarding-002',
    category: 'onboarding-detection',
    name: 'Proactive Not Passive',
    description: 'Agent leads the conversation, does not wait for instructions',
    trigger: 'help me get started',
    context: {
      hasPlaceholderContent: true,
    },
    expectedTools: [
      {
        toolName: 'get_page_structure',
        reason: 'Check what sections need content',
      },
    ],
    expectedResponse: {
      shouldMatch: [/what do you do|who do you help|30.?second/i],
    },
    antiPatterns: {
      forbiddenPhrases: FORBIDDEN_PASSIVE as unknown as string[],
      description: 'Agent should lead, not ask what to do',
    },
    priority: 1,
  },
  {
    id: 'onboarding-003',
    category: 'onboarding-detection',
    name: 'Complete Site Detection',
    description: 'When all sections have content, suggest publishing',
    trigger: "what's next?",
    context: {
      hasPlaceholderContent: false,
      pageStructure: 'complete',
    },
    expectedTools: [
      {
        toolName: 'get_page_structure',
        reason: 'Verify current state',
      },
    ],
    expectedResponse: {
      shouldMatch: [/ready to publish|take a look|looks good/i],
    },
    antiPatterns: {
      forbiddenPhrases: ['What section would you like to work on'],
      description: 'Should recognize site is complete',
    },
    priority: 2,
  },

  // ============================================================================
  // CATEGORY: Jargon Prevention
  // ============================================================================
  {
    id: 'jargon-001',
    category: 'jargon-prevention',
    name: 'No Section References',
    description: 'Agent never says "section" when updating content',
    trigger: 'update my about',
    context: {},
    expectedTools: [
      {
        toolName: 'get_page_structure',
        reason: 'Get section ID without mentioning it',
      },
      {
        toolName: 'update_section',
        reason: 'Update the content',
      },
    ],
    expectedResponse: {
      shouldInclude: ['done', 'take a look'],
    },
    antiPatterns: {
      forbiddenPhrases: [
        'your about section',
        'the about section',
        'I updated the section',
        'section has been updated',
      ],
      description: 'Technical jargon confuses non-technical users',
    },
    priority: 1,
  },
  {
    id: 'jargon-002',
    category: 'jargon-prevention',
    name: 'No Hero References',
    description: 'Agent never mentions "hero" to users',
    trigger: 'change my headline',
    context: {},
    expectedTools: [
      {
        toolName: 'update_section',
        reason: 'Update headline without mentioning hero',
      },
    ],
    antiPatterns: {
      forbiddenPhrases: ['hero', 'hero section', 'your hero'],
      description: 'Users do not know what a hero section is',
    },
    priority: 1,
  },
  {
    id: 'jargon-003',
    category: 'jargon-prevention',
    name: 'No CTA References',
    description: 'Agent never says "CTA" or "call to action"',
    trigger: 'add a button at the bottom',
    context: {},
    expectedTools: [],
    expectedResponse: {},
    antiPatterns: {
      forbiddenPhrases: ['CTA', 'call to action', 'call-to-action'],
      description: 'CTA is developer jargon',
    },
    priority: 1,
  },
  {
    id: 'jargon-004',
    category: 'jargon-prevention',
    name: 'No Draft References',
    description: "Agent says 'take a look' not 'check your draft'",
    trigger: 'make the headline bigger',
    context: {
      hasDraft: true,
    },
    expectedTools: [],
    expectedResponse: {
      shouldInclude: ['take a look'],
    },
    antiPatterns: {
      forbiddenPhrases: [
        'draft',
        'your draft',
        'in the draft',
        'check your draft',
        'preview your draft',
      ],
      description: 'Draft is technical terminology',
    },
    priority: 1,
  },

  // ============================================================================
  // CATEGORY: Generate Then Refine
  // ============================================================================
  {
    id: 'generate-001',
    category: 'generate-then-refine',
    name: 'Generate Before Asking',
    description: 'Agent generates copy first, then asks for feedback',
    trigger: 'I need a tagline',
    context: {},
    expectedTools: [
      {
        toolName: 'generate_copy',
        expectedParams: {
          copyType: 'tagline',
        },
        reason: 'Generate options for user to react to',
      },
    ],
    expectedResponse: {
      shouldMatch: [/what feels off|what do you think|how about/i],
    },
    antiPatterns: {
      forbiddenPhrases: [
        'What would you like your tagline to say?',
        'What should the tagline be?',
        'What text do you want?',
      ],
      description: 'Never ask user to write copy - agent generates, user refines',
    },
    priority: 1,
  },
  {
    id: 'generate-002',
    category: 'generate-then-refine',
    name: 'Headline Generation Pattern',
    description: 'Agent proposes headline options, does not ask user to write',
    trigger: 'write me a better headline',
    context: {},
    expectedTools: [
      {
        toolName: 'generate_copy',
        expectedParams: {
          copyType: 'headline',
        },
        reason: 'Generate headline options',
      },
    ],
    antiPatterns: {
      forbiddenPhrases: ['What would you like the headline to say?', 'What headline do you want?'],
      description: 'Agent generates, user reacts',
    },
    priority: 1,
  },
  {
    id: 'generate-003',
    category: 'generate-then-refine',
    name: 'Improvement Over Blank Slate',
    description: 'For existing content, improve rather than start fresh',
    trigger: 'make my about more engaging',
    context: {
      hasPlaceholderContent: false,
    },
    expectedTools: [
      {
        toolName: 'improve_section_copy',
        expectedParams: {
          // feedback should contain 'engaging' or similar improvement directive
        },
        reason: 'Improve existing content rather than regenerate',
      },
    ],
    antiPatterns: {
      forbiddenPhrases: ['What would you like it to say instead?'],
      description: 'Should improve existing, not ask for new content',
    },
    priority: 2,
  },

  // ============================================================================
  // CATEGORY: Voice & Tone
  // ============================================================================
  {
    id: 'voice-001',
    category: 'voice-tone',
    name: 'Allowed Confirmation Words',
    description: 'Agent uses brand-approved confirmation vocabulary',
    trigger: 'change the headline to Welcome Home',
    context: {},
    expectedTools: [
      {
        toolName: 'update_section',
        reason: 'Apply the user-provided text',
      },
    ],
    expectedResponse: {
      shouldMatch: [new RegExp(ALLOWED_CONFIRMATIONS.join('|').replace(/ /g, '\\s'), 'i')],
    },
    antiPatterns: {
      forbiddenPhrases: FORBIDDEN_ENTHUSIASM as unknown as string[],
      description: 'No enthusiasm excesses like "Great!" or "Perfect!"',
    },
    priority: 1,
  },
  {
    id: 'voice-002',
    category: 'voice-tone',
    name: 'No Hype Words',
    description: 'Agent never uses marketing hype words',
    trigger: 'tell me about HANDLED',
    context: {},
    expectedTools: [],
    antiPatterns: {
      forbiddenPhrases: FORBIDDEN_HYPE_WORDS as unknown as string[],
      description: 'Hype words are banned per brand guidelines',
    },
    priority: 2,
  },
  {
    id: 'voice-003',
    category: 'voice-tone',
    name: 'No Punching Down',
    description: 'Agent never reminds users of their pain points',
    trigger: "I'm having trouble with my site",
    context: {},
    expectedTools: [],
    antiPatterns: {
      forbiddenPhrases: FORBIDDEN_PUNCHING_DOWN as unknown as string[],
      description: 'Never remind users of stress/overwhelm - solve it',
    },
    priority: 2,
  },
  {
    id: 'voice-004',
    category: 'voice-tone',
    name: 'Terse Responses',
    description: 'Agent is concise, not verbose',
    trigger: 'done editing',
    context: {},
    expectedTools: [],
    expectedResponse: {
      shouldMatch: [/^\S+(\s+\S+){0,10}\.?$/], // Roughly 10 words or less
    },
    antiPatterns: {
      forbiddenPhrases: [
        'I have successfully completed',
        'Your request has been processed',
        'The changes have been applied to your',
      ],
      description: 'Verbose corporate-speak violates terse personality',
    },
    priority: 2,
  },

  // ============================================================================
  // CATEGORY: Tool Failure Recovery
  // ============================================================================
  {
    id: 'recovery-001',
    category: 'tool-failure-recovery',
    name: 'Retry Then Offer Alternative',
    description: 'On tool failure, retry once then offer alternative approach',
    trigger: '[SIMULATED TOOL FAILURE]',
    context: {},
    expectedTools: [],
    expectedResponse: {
      shouldMatch: [/try.*different|another way|different approach/i],
    },
    antiPatterns: {
      forbiddenPhrases: [
        'Error:',
        'failed with status',
        'exception',
        'stack trace',
        'undefined',
        'null reference',
      ],
      description: 'Never expose technical error details to users',
    },
    priority: 1,
  },
  {
    id: 'recovery-002',
    category: 'tool-failure-recovery',
    name: 'No Excessive Apologies',
    description: 'Agent does not apologize excessively on errors',
    trigger: '[SIMULATED TOOL FAILURE]',
    context: {},
    expectedTools: [],
    antiPatterns: {
      forbiddenPhrases: [
        "I'm so sorry",
        'I sincerely apologize',
        'I deeply regret',
        'I apologize for the inconvenience',
      ],
      description: 'Brief acknowledgment, not groveling',
    },
    priority: 2,
  },

  // ============================================================================
  // CATEGORY: Decision Flow
  // ============================================================================
  {
    id: 'flow-001',
    category: 'decision-flow',
    name: 'Scroll After Update',
    description: 'Agent calls scroll_to_website_section after update_section',
    trigger: 'update my testimonials with this quote',
    context: {},
    expectedTools: [
      {
        toolName: 'update_section',
        reason: 'Apply the update',
      },
      {
        toolName: 'scroll_to_website_section',
        reason: 'Scroll to show the change',
      },
    ],
    antiPatterns: {
      forbiddenToolsAlone: ['update_section'],
      description: 'Missing scroll leaves user wondering where change is',
    },
    priority: 2,
  },
  {
    id: 'flow-002',
    category: 'decision-flow',
    name: 'Get Structure Before Update',
    description: 'Agent calls get_page_structure before update_section',
    trigger: 'change my FAQ',
    context: {},
    expectedTools: [
      {
        toolName: 'get_page_structure',
        reason: 'Get the section ID first',
      },
      {
        toolName: 'update_section',
        reason: 'Then update with correct ID',
      },
    ],
    antiPatterns: {
      description: 'Guessing section IDs causes errors',
    },
    priority: 2,
  },
  {
    id: 'flow-003',
    category: 'decision-flow',
    name: 'Never Dead-End',
    description: 'Every response includes next step or question',
    trigger: "that's done",
    context: {},
    expectedTools: [],
    expectedResponse: {
      shouldMatch: [/\?|next|anything else|what.*about/i],
    },
    antiPatterns: {
      forbiddenPatterns: [/^(got it|done|ok)\.?$/i],
      description: 'Response without next step dead-ends conversation',
    },
    priority: 2,
  },
];

// =============================================================================
// HELPER FUNCTIONS FOR TESTS
// =============================================================================

/**
 * Get all test cases by category
 */
export function getTestsByCategory(category: BehaviorCategory): PromptBehaviorTestCase[] {
  return EXPECTED_BEHAVIORS.filter((test) => test.category === category);
}

/**
 * Get all test cases by priority
 */
export function getTestsByPriority(priority: 1 | 2 | 3): PromptBehaviorTestCase[] {
  return EXPECTED_BEHAVIORS.filter((test) => test.priority === priority);
}

/**
 * Get all test cases related to a specific pitfall
 */
export function getTestsByPitfall(pitfallNumber: number): PromptBehaviorTestCase[] {
  return EXPECTED_BEHAVIORS.filter((test) => test.relatedPitfall === pitfallNumber);
}

/**
 * Check if a response contains any forbidden vocabulary
 */
export function containsForbiddenVocabulary(response: string): {
  hasForbidden: boolean;
  found: string[];
} {
  const found: string[] = [];
  const responseLower = response.toLowerCase();

  for (const word of ALL_FORBIDDEN_VOCABULARY) {
    if (responseLower.includes(word.toLowerCase())) {
      found.push(word);
    }
  }

  return {
    hasForbidden: found.length > 0,
    found,
  };
}

/**
 * Check if a response uses approved confirmation vocabulary
 */
export function usesApprovedConfirmation(response: string): boolean {
  const responseLower = response.toLowerCase();
  return ALLOWED_CONFIRMATIONS.some((word) => responseLower.includes(word.toLowerCase()));
}

/**
 * Validate that expected tools were called
 */
export function validateToolCalls(
  actualCalls: Array<{ toolName: string; params?: Record<string, unknown> }>,
  expectedCalls: ExpectedToolCall[]
): { valid: boolean; missing: string[]; unexpected: string[] } {
  const actualToolNames = actualCalls.map((c) => c.toolName);
  const expectedToolNames = expectedCalls.map((c) => c.toolName);

  const missing = expectedToolNames.filter((t) => !actualToolNames.includes(t));
  const unexpected = actualToolNames.filter((t) => !expectedToolNames.includes(t));

  return {
    valid: missing.length === 0,
    missing,
    unexpected,
  };
}

/**
 * Check if response matches anti-patterns
 */
export function checkAntiPatterns(
  response: string,
  antiPatterns: AntiPatterns
): { hasAntiPattern: boolean; violations: string[] } {
  const violations: string[] = [];
  const responseLower = response.toLowerCase();

  // Check forbidden phrases
  if (antiPatterns.forbiddenPhrases) {
    for (const phrase of antiPatterns.forbiddenPhrases) {
      if (responseLower.includes(phrase.toLowerCase())) {
        violations.push(`Forbidden phrase: "${phrase}"`);
      }
    }
  }

  // Check forbidden patterns
  if (antiPatterns.forbiddenPatterns) {
    for (const pattern of antiPatterns.forbiddenPatterns) {
      if (pattern.test(response)) {
        violations.push(`Forbidden pattern: ${pattern.toString()}`);
      }
    }
  }

  return {
    hasAntiPattern: violations.length > 0,
    violations,
  };
}

// =============================================================================
// CATEGORY COUNTS (for documentation)
// =============================================================================

export const BEHAVIOR_COUNTS = {
  'fact-storefront-bridge': getTestsByCategory('fact-storefront-bridge').length,
  't3-confirmation': getTestsByCategory('t3-confirmation').length,
  'onboarding-detection': getTestsByCategory('onboarding-detection').length,
  'jargon-prevention': getTestsByCategory('jargon-prevention').length,
  'generate-then-refine': getTestsByCategory('generate-then-refine').length,
  'voice-tone': getTestsByCategory('voice-tone').length,
  'tool-failure-recovery': getTestsByCategory('tool-failure-recovery').length,
  'decision-flow': getTestsByCategory('decision-flow').length,
  total: EXPECTED_BEHAVIORS.length,
};

export const PRIORITY_COUNTS = {
  p1: getTestsByPriority(1).length,
  p2: getTestsByPriority(2).length,
  p3: getTestsByPriority(3).length,
};
