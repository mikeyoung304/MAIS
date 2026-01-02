/**
 * Customer Booking Happy Path Scenario
 *
 * Tests the complete customer journey: browse services, check availability, and book.
 *
 * @see plans/agent-evaluation-system.md Phase 3.2
 */

import type { ConversationScenario } from '../types';

export const BOOKING_HAPPY_PATH: ConversationScenario = {
  id: 'customer-booking-happy-path',
  name: 'Customer Booking Happy Path',
  description: 'Customer successfully browses services, checks availability, and books',
  agentType: 'customer',
  category: 'happy-path',

  setup: {
    tenant: {
      businessName: 'Bella Photography',
      businessType: 'photographer',
    },
    existingData: {
      services: [
        { name: 'Mini Session', price: 15000, duration: 30 },
        { name: 'Full Session', price: 35000, duration: 60 },
      ],
    },
  },

  turns: [
    {
      user: "Hi! I'm looking to book a photography session.",
      expectations: {
        responseShouldMatch: /welcome|hello|hi/i,
        responseShouldNotMatch: /stripe|payment method|credit card/i,
        shouldNotCallTools: ['book_service'],
      },
    },
    {
      user: 'What packages do you offer?',
      expectations: {
        shouldCallTools: ['get_services'],
        responseShouldMatch: /mini|full|session/i,
      },
    },
    {
      user: 'Is next Saturday available for the Mini Session?',
      expectations: {
        shouldCallTools: ['check_availability'],
      },
    },
    {
      user: "Great, I'd like to book the 2pm slot please!",
      expectations: {
        shouldCallTools: ['book_service'],
      },
    },
    {
      user: 'Yes, confirm the booking. My email is test@example.com',
      expectations: {
        responseShouldMatch: /confirmed|booked|see you/i,
      },
    },
  ],

  successCriteria: {
    minOverallScore: 8.0,
    taskCompleted: true,
    maxTotalLatencyMs: 15000,
    maxTurns: 7,
    requiredToolCalls: ['get_services', 'check_availability', 'book_service'],
  },

  tags: ['critical-path', 'booking', 'happy-path'],
  priority: 'critical',
};

/**
 * Customer Information Query Scenario
 *
 * Tests basic information retrieval without booking.
 */
export const INFORMATION_QUERY: ConversationScenario = {
  id: 'customer-information-query',
  name: 'Customer Information Query',
  description: 'Customer asks questions about the business without making a booking',
  agentType: 'customer',
  category: 'happy-path',

  setup: {
    tenant: {
      businessName: 'Sunny Studio',
      businessType: 'photographer',
    },
    existingData: {
      services: [{ name: 'Portrait Session', price: 20000, duration: 45 }],
    },
  },

  turns: [
    {
      user: 'What are your business hours?',
      expectations: {
        shouldCallTools: ['get_business_info'],
        responseShouldMatch: /hour|open|available/i,
      },
    },
    {
      user: 'Where are you located?',
      expectations: {
        responseShouldNotMatch: /book|schedule|reservation/i,
      },
    },
    {
      user: 'Thanks, that helps!',
      expectations: {
        responseShouldMatch: /welcome|happy to help|question/i,
      },
    },
  ],

  successCriteria: {
    minOverallScore: 7.5,
    taskCompleted: true,
    maxTotalLatencyMs: 10000,
    forbiddenToolCalls: ['book_service'],
  },

  tags: ['information', 'happy-path'],
  priority: 'high',
};

/**
 * Customer Multiple Services Comparison
 *
 * Tests the agent's ability to help compare multiple service options.
 */
export const SERVICE_COMPARISON: ConversationScenario = {
  id: 'customer-service-comparison',
  name: 'Customer Service Comparison',
  description: 'Customer compares multiple services before deciding',
  agentType: 'customer',
  category: 'happy-path',

  setup: {
    tenant: {
      businessName: 'Premium Studios',
      businessType: 'photographer',
    },
    existingData: {
      services: [
        { name: 'Basic Package', price: 10000, duration: 30, description: '5 edited photos' },
        { name: 'Standard Package', price: 25000, duration: 60, description: '15 edited photos' },
        {
          name: 'Premium Package',
          price: 50000,
          duration: 120,
          description: '40 edited photos, album included',
        },
      ],
    },
  },

  turns: [
    {
      user: 'I want to see all your photography packages.',
      expectations: {
        shouldCallTools: ['get_services'],
        responseShouldMatch: /basic|standard|premium/i,
      },
    },
    {
      user: "What's the difference between Basic and Standard?",
      expectations: {
        responseShouldMatch: /photo|edit|duration|price/i,
      },
    },
    {
      user: 'Which package would you recommend for a family photo shoot?',
      expectations: {
        responseShouldMatch: /recommend|suggest|family/i,
        responseShouldNotMatch: /don't know|can't help|no idea/i,
      },
    },
  ],

  successCriteria: {
    minOverallScore: 7.0,
    maxTurns: 5,
    requiredToolCalls: ['get_services'],
  },

  tags: ['information', 'comparison', 'happy-path'],
  priority: 'medium',
};

// Export all customer scenarios
export const CUSTOMER_SCENARIOS: ConversationScenario[] = [
  BOOKING_HAPPY_PATH,
  INFORMATION_QUERY,
  SERVICE_COMPARISON,
];
