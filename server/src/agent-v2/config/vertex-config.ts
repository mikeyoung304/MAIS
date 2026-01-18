/**
 * Vertex AI Agent System Configuration
 *
 * Central configuration for the agent-v2 system built on Google Vertex AI.
 * All agent-related settings flow through this configuration.
 */

import { z } from 'zod';

// Environment variable schema with validation
const envSchema = z.object({
  GOOGLE_CLOUD_PROJECT: z.string().min(1),
  GOOGLE_CLOUD_LOCATION: z.string().default('us-central1'),
  AGENT_ENGINE_ID: z.string().optional(),
  AGENT_STAGING_BUCKET: z.string().optional(),
  MEDIA_BUCKET: z.string().optional(),
  MEDIA_COST_WARN_PERCENT: z.coerce.number().default(80),
  MEDIA_COST_CRITICAL_PERCENT: z.coerce.number().default(95),
});

// Parse and validate environment
function loadConfig() {
  const result = envSchema.safeParse({
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_VERTEX_PROJECT,
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION || process.env.GOOGLE_VERTEX_LOCATION,
    AGENT_ENGINE_ID: process.env.AGENT_ENGINE_ID,
    AGENT_STAGING_BUCKET: process.env.AGENT_STAGING_BUCKET,
    MEDIA_BUCKET: process.env.MEDIA_BUCKET,
    MEDIA_COST_WARN_PERCENT: process.env.MEDIA_COST_WARN_PERCENT,
    MEDIA_COST_CRITICAL_PERCENT: process.env.MEDIA_COST_CRITICAL_PERCENT,
  });

  if (!result.success) {
    throw new Error(`Invalid Vertex AI configuration: ${result.error.message}`);
  }

  return result.data;
}

// Lazy-loaded config (only validates when accessed)
let _config: ReturnType<typeof loadConfig> | null = null;

export function getVertexConfig() {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

// Agent model configurations
export const AGENT_MODELS = {
  // Orchestrator uses Gemini 3 Pro with thinking for quality routing
  CONCIERGE: {
    model: 'gemini-2.5-pro',
    temperature: 0.2,
    thinkingLevel: 'high' as const,
    maxOutputTokens: 2048,
  },
  // Specialists use faster Flash model
  SPECIALIST: {
    model: 'gemini-2.5-flash',
    temperature: 0.5,
    maxOutputTokens: 4096,
  },
  // Marketing needs more creativity
  MARKETING: {
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    maxOutputTokens: 4096,
  },
  // Research needs precision
  RESEARCH: {
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxOutputTokens: 8192,
  },
} as const;

// Trust tier definitions
export enum TrustTier {
  T1 = 'T1', // Auto-execute (read operations)
  T2 = 'T2', // Preview + soft confirm (mutations to draft)
  T3 = 'T3', // Explicit confirmation required (publish, costly operations)
}

// Media generation cost estimates (as of Jan 2026)
export const MEDIA_COSTS = {
  IMAGEN_PER_IMAGE: 0.04, // USD
  VEO_PER_SECOND: 0.2, // USD
} as const;

// Subscription tier limits
export const TIER_LIMITS = {
  handled: {
    imagesPerMonth: 20,
    videosPerMonth: 5,
    videoSecondsPerMonth: 40,
  },
  fully_handled: {
    imagesPerMonth: 100,
    videosPerMonth: 25,
    videoSecondsPerMonth: 200,
  },
} as const;

// Rate limiting configuration
export const RATE_LIMITS = {
  // Per tenant limits
  TENANT_REQUESTS_PER_MINUTE: 30,
  TENANT_REQUESTS_PER_HOUR: 500,
  // Per IP limits (for public-facing agents)
  IP_REQUESTS_PER_MINUTE: 60,
  IP_REQUESTS_PER_HOUR: 300,
  // Research agent specific (web scraping)
  SCRAPE_REQUESTS_PER_HOUR: 100,
  SEARCH_REQUESTS_PER_HOUR: 200,
} as const;
