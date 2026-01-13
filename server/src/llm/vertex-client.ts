/**
 * Vertex AI Client Module
 *
 * Thin boundary between orchestrators and @google/genai SDK.
 * Handles auth, model selection, safety, and tracing hooks.
 *
 * Design: Single implementation, but isolated so we can:
 * - Swap model versions without touching orchestrators
 * - Update SDK surface changes in one place
 * - Add observability hooks centrally
 */

import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { logger } from '../lib/core/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Model Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Available models for MAIS agents.
 *
 * Model selection strategy:
 * - Flash: Default for most traffic (cost-optimized)
 * - Pro: Complex reasoning, planning, high-stakes generation
 *
 * Model IDs from official Vertex AI documentation.
 * Source: https://cloud.google.com/vertex-ai/generative-ai/docs/models
 *
 * IMPORTANT: Use canonical IDs, not invented version suffixes.
 * Preview models: gemini-3-flash-preview, gemini-3-pro-preview
 * GA models: gemini-2.5-flash, gemini-2.5-pro (auto-updated aliases)
 */
export const GEMINI_MODELS = {
  // Primary: Gemini 3 Flash Preview (fast, cheap, good)
  // Source: https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-flash
  FLASH: 'gemini-3-flash-preview',
  // Fallback: Gemini 2.5 Flash (stable, GA)
  FLASH_STABLE: 'gemini-2.5-flash',
  // Premium: Gemini 3 Pro Preview (complex reasoning)
  // Source: https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro
  PRO: 'gemini-3-pro-preview',
} as const;

export type GeminiModel = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS];

/**
 * Default model for most agent operations.
 * Use Gemini 3 Flash Preview for best price/performance.
 */
export const DEFAULT_MODEL: GeminiModel = GEMINI_MODELS.FLASH;

// ─────────────────────────────────────────────────────────────────────────────
// Safety Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safety settings for all requests.
 *
 * BLOCK_MEDIUM_AND_ABOVE is appropriate for business assistant use cases.
 * Adjust per-orchestrator if needed (e.g., stricter for customer-facing).
 */
export const DEFAULT_SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Client Factory
// ─────────────────────────────────────────────────────────────────────────────

export interface VertexClientConfig {
  project?: string;
  location?: string;
}

/**
 * Create Gemini client for Vertex AI.
 *
 * Uses Application Default Credentials (ADC) automatically.
 * No key files needed - ADC handles auth via:
 * - Local: `gcloud auth application-default login`
 * - Production: Workload Identity Federation
 */
export function createVertexClient(config: VertexClientConfig = {}): GoogleGenAI {
  const project = config.project || process.env.GOOGLE_VERTEX_PROJECT;
  const location = config.location || process.env.GOOGLE_VERTEX_LOCATION || 'global';

  if (!project) {
    throw new Error(
      'GOOGLE_VERTEX_PROJECT environment variable is required. ' +
        'Run: gcloud config set project YOUR_PROJECT'
    );
  }

  logger.debug({ project, location }, 'Creating Vertex AI client');

  return new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

let _client: GoogleGenAI | null = null;

/**
 * Get shared Gemini client instance.
 *
 * Uses singleton pattern for connection reuse.
 * Call resetVertexClient() in tests for isolation.
 */
export function getVertexClient(): GoogleGenAI {
  if (!_client) {
    _client = createVertexClient();
  }
  return _client;
}

/**
 * Reset client (useful for testing).
 */
export function resetVertexClient(): void {
  _client = null;
}
