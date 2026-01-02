/**
 * Onboarding Scenarios
 *
 * Tests the business advisor agent's onboarding flow, ensuring it doesn't
 * force Stripe connection before service setup and provides helpful guidance.
 *
 * @see plans/agent-evaluation-system.md Phase 3.2
 */

import type { ConversationScenario } from '../types';

/**
 * No Stripe Forcing Scenario
 *
 * Critical regression test: new business owners can set up services
 * without being forced to connect Stripe first.
 */
export const NO_STRIPE_FORCING: ConversationScenario = {
  id: 'onboarding-no-stripe-forcing',
  name: 'Onboarding Without Stripe Forcing',
  description: 'New business owner can set up services without being forced to connect Stripe',
  agentType: 'onboarding',
  category: 'happy-path',

  setup: {
    tenant: {
      businessName: 'Test Photography',
      businessType: 'photographer',
      stripeConnected: false,
      onboardingPhase: 'NOT_STARTED',
    },
  },

  turns: [
    {
      user: 'Hi, I just signed up and want to set up my services.',
      expectations: {
        responseShouldNotMatch: /must.*connect.*stripe|need.*stripe.*first|require.*stripe/i,
      },
    },
    {
      user: "I'm a wedding photographer. I want to create my packages.",
      expectations: {
        responseShouldNotMatch: /must.*connect.*stripe|need.*stripe.*first/i,
        responseShouldMatch: /package|service|offering|price/i,
      },
    },
    {
      user: 'Let\'s create a "Full Day Coverage" package for $3500',
      expectations: {
        shouldCallTools: ['upsert_services'],
        responseShouldNotMatch: /can't.*without.*stripe|stripe.*required/i,
      },
    },
    {
      user: "I'll connect Stripe later. What else should I set up?",
      expectations: {
        responseShouldNotMatch: /really.*should.*stripe|strongly.*recommend.*stripe.*now/i,
        responseShouldMatch: /storefront|website|availability|portfolio/i,
      },
    },
  ],

  successCriteria: {
    minOverallScore: 7.5,
    taskCompleted: true,
    requiredToolCalls: ['upsert_services'],
  },

  tags: ['critical', 'onboarding', 'stripe-bug', 'regression'],
  priority: 'critical',
};

/**
 * Complete Onboarding Flow Scenario
 *
 * Tests the full onboarding journey from discovery to service creation.
 */
export const COMPLETE_ONBOARDING: ConversationScenario = {
  id: 'onboarding-complete-flow',
  name: 'Complete Onboarding Flow',
  description: 'New business owner completes the full onboarding journey',
  agentType: 'onboarding',
  category: 'happy-path',

  setup: {
    tenant: {
      businessName: 'Fresh Start Wellness',
      businessType: 'wellness',
      onboardingPhase: 'NOT_STARTED',
    },
  },

  turns: [
    {
      user: "Hi! I'm just getting started. I'm a massage therapist.",
      expectations: {
        responseShouldMatch: /welcome|excited|help.*set up|massage|wellness/i,
      },
    },
    {
      user: "I've been doing massage for 5 years. I want to offer 60 and 90 minute sessions.",
      expectations: {
        responseShouldMatch: /session|minute|price|package/i,
      },
    },
    {
      user: 'Can you suggest pricing for my area?',
      expectations: {
        shouldCallTools: ['get_market_research'],
        responseShouldMatch: /price|market|suggest|range/i,
      },
    },
    {
      user: "Let's go with $85 for 60 minutes and $120 for 90 minutes.",
      expectations: {
        shouldCallTools: ['upsert_services'],
      },
    },
    {
      user: 'What should I set up next?',
      expectations: {
        responseShouldMatch: /availability|calendar|storefront|booking/i,
      },
    },
  ],

  successCriteria: {
    minOverallScore: 8.0,
    taskCompleted: true,
    requiredToolCalls: ['upsert_services'],
  },

  tags: ['onboarding', 'happy-path', 'full-journey'],
  priority: 'high',
};

/**
 * Skip Onboarding Scenario
 *
 * Tests that users can skip onboarding gracefully.
 */
export const SKIP_ONBOARDING: ConversationScenario = {
  id: 'onboarding-skip',
  name: 'Skip Onboarding',
  description: 'User chooses to skip guided onboarding',
  agentType: 'onboarding',
  category: 'edge-case',

  setup: {
    tenant: {
      businessName: 'Quick Setup Co',
      onboardingPhase: 'NOT_STARTED',
    },
  },

  turns: [
    {
      user: "I don't need guidance, I'll figure it out myself.",
      expectations: {
        responseShouldNotMatch: /must|require|have to|cannot/i,
        responseShouldMatch: /understand|okay|no problem|skip|self/i,
      },
    },
    {
      user: 'Yes, skip the onboarding please.',
      expectations: {
        responseShouldMatch: /skip|anytime|help|available/i,
      },
    },
  ],

  successCriteria: {
    minOverallScore: 7.0,
    taskCompleted: true,
    maxTurns: 4,
  },

  tags: ['onboarding', 'skip', 'edge-case'],
  priority: 'medium',
};

/**
 * Returning User Resume Scenario
 *
 * Tests that the agent can resume context for returning users.
 */
export const RETURNING_USER_RESUME: ConversationScenario = {
  id: 'onboarding-returning-user',
  name: 'Returning User Resume',
  description: 'Agent remembers context from previous session and helps user continue',
  agentType: 'onboarding',
  category: 'edge-case',

  setup: {
    tenant: {
      businessName: 'Partially Setup Studio',
      businessType: 'photographer',
      onboardingPhase: 'SERVICES',
    },
    existingData: {
      services: [{ name: 'Basic Session', price: 15000, duration: 30 }],
    },
  },

  turns: [
    {
      user: "Hi, I'm back. What was I working on?",
      expectations: {
        responseShouldMatch: /service|package|continue|left off|setup/i,
      },
    },
    {
      user: 'Oh right, I wanted to add a premium package too.',
      expectations: {
        responseShouldMatch: /premium|package|price|add/i,
      },
    },
  ],

  successCriteria: {
    minOverallScore: 7.0,
    maxTurns: 5,
  },

  tags: ['onboarding', 'context', 'resume', 'edge-case'],
  priority: 'medium',
};

// Export all onboarding scenarios
export const ONBOARDING_SCENARIOS: ConversationScenario[] = [
  NO_STRIPE_FORCING,
  COMPLETE_ONBOARDING,
  SKIP_ONBOARDING,
  RETURNING_USER_RESUME,
];
