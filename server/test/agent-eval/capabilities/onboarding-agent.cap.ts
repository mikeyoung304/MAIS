/**
 * Onboarding Agent Capability Map
 *
 * Defines what the onboarding assistant can do.
 * Used for parity tests and outcome-based testing.
 *
 * Onboarding Agent Purpose:
 * Guide new tenants through discovery, market research, service setup, and marketing.
 * This agent runs in onboarding mode when tenant.onboardingPhase is active.
 */

import type { AgentCapabilityMap } from './capability-map';

/**
 * Onboarding Agent Capabilities
 *
 * Phase-based toolset for new tenant setup:
 * Discovery → Market Research → Services → Marketing → Complete
 */
export const ONBOARDING_AGENT_CAPABILITIES: AgentCapabilityMap = {
  agentType: 'onboarding',
  description:
    'Onboarding assistant that guides new tenants through business setup. Collects discovery info, researches pricing, configures services, and sets up marketing.',
  capabilities: [
    // ─────────────────────────────────────────────────────────────────────────
    // READ CAPABILITIES
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: 'get-market-research',
      description: 'Get pricing benchmarks for business type and location',
      requiredTool: 'get_market_research',
      trustTier: 'T1',
      promptKeywords: ['pricing', 'market', 'research', 'benchmarks', 'competitors'],
      category: 'read',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ONBOARDING PHASE MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: 'transition-phase',
      description: 'Transition onboarding phase with validated data',
      requiredTool: 'update_onboarding_state',
      trustTier: 'T1', // Metadata only
      promptKeywords: [
        'discovery',
        'phase',
        'progress',
        'next step',
        'complete',
        'business type',
        'location',
      ],
      category: 'onboarding',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SERVICE CONFIGURATION
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: 'create-services',
      description: 'Create segments and packages based on market research',
      requiredTool: 'upsert_services',
      trustTier: 'T2',
      promptKeywords: ['packages', 'tiers', 'services', 'pricing', 'segments', 'offerings'],
      category: 'catalog',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // MARKETING SETUP
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: 'configure-storefront',
      description: 'Update landing page headline, tagline, and brand settings',
      requiredTool: 'update_storefront',
      trustTier: 'T2',
      promptKeywords: ['headline', 'tagline', 'brand', 'landing page', 'storefront', 'marketing'],
      category: 'marketing',
    },
  ],
};

/**
 * Onboarding phases for outcome testing
 *
 * The onboarding flow is strictly sequential:
 * NOT_STARTED → DISCOVERY → MARKET_RESEARCH → SERVICES → MARKETING → COMPLETED
 */
export const ONBOARDING_PHASES = [
  {
    phase: 'DISCOVERY',
    capabilities: ['transition-phase'],
    requiredData: ['businessType', 'businessName', 'location', 'targetMarket'],
  },
  {
    phase: 'MARKET_RESEARCH',
    capabilities: ['get-market-research', 'transition-phase'],
    requiredData: ['pricingBenchmarks'],
  },
  {
    phase: 'SERVICES',
    capabilities: ['create-services', 'transition-phase'],
    requiredData: ['segments', 'packages'],
  },
  {
    phase: 'MARKETING',
    capabilities: ['configure-storefront', 'transition-phase'],
    requiredData: ['headline', 'tagline', 'brandVoice'],
  },
] as const;

/**
 * Critical paths that must work for onboarding to complete
 *
 * These represent the minimum viable onboarding journey.
 */
export const CRITICAL_ONBOARDING_PATHS = [
  {
    name: 'complete-onboarding',
    description: 'New tenant can complete full onboarding journey',
    phases: ['DISCOVERY', 'MARKET_RESEARCH', 'SERVICES', 'MARKETING', 'COMPLETED'],
    capabilities: [
      'transition-phase',
      'get-market-research',
      'create-services',
      'configure-storefront',
    ],
  },
  {
    name: 'skip-onboarding',
    description: 'Tenant can skip onboarding to configure manually',
    phases: ['SKIPPED'],
    capabilities: ['transition-phase'],
  },
] as const;

/**
 * Business types supported by onboarding
 *
 * Each type has specific benchmark data and prompt guidance.
 */
export const SUPPORTED_BUSINESS_TYPES = [
  'photographer',
  'videographer',
  'wedding_planner',
  'florist',
  'caterer',
  'dj',
  'officiant',
  'makeup_artist',
  'hair_stylist',
  'event_designer',
  'venue',
  'coach',
  'therapist',
  'consultant',
  'wellness_practitioner',
  'personal_trainer',
  'tutor',
  'music_instructor',
  'other',
] as const;

/**
 * Target markets with pricing multipliers
 */
export const TARGET_MARKETS = [
  { id: 'luxury', multiplier: 2.0 },
  { id: 'premium', multiplier: 1.5 },
  { id: 'mid_range', multiplier: 1.0 },
  { id: 'budget_friendly', multiplier: 0.7 },
  { id: 'mixed', multiplier: 1.0 },
] as const;
