/**
 * Pricing & Usage Module
 *
 * Centralized cost calculation for Gemini models.
 * Pricing source: https://cloud.google.com/vertex-ai/generative-ai/pricing
 * Last updated: January 2026
 *
 * IMPORTANT: Update this file when Google changes pricing.
 */

import { logger } from '../lib/core/logger';
import type { GeminiModel } from './vertex-client';
import { GEMINI_MODELS } from './vertex-client';

// ─────────────────────────────────────────────────────────────────────────────
// Pricing Constants (Vertex AI, January 2026)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cost per 1M tokens for each model.
 *
 * Source: https://cloud.google.com/vertex-ai/generative-ai/pricing
 * Last verified: 2026-01-13
 *
 * Note: Prices are for ≤200K context. >200K has different rates.
 */
export const VERTEX_PRICING: Record<
  GeminiModel,
  {
    inputPer1M: number;
    outputPer1M: number;
    cachedInputPer1M: number;
  }
> = {
  // Gemini 3 Flash Preview (primary)
  [GEMINI_MODELS.FLASH]: {
    inputPer1M: 0.5, // $0.50/1M input tokens
    outputPer1M: 3.0, // $3.00/1M output tokens
    cachedInputPer1M: 0.05, // $0.05/1M cached input (90% savings)
  },

  // Gemini 2.5 Flash (stable fallback)
  [GEMINI_MODELS.FLASH_STABLE]: {
    inputPer1M: 0.3, // $0.30/1M input tokens
    outputPer1M: 2.5, // $2.50/1M output tokens
    cachedInputPer1M: 0.03, // $0.03/1M cached input
  },

  // Gemini 3 Pro Preview (premium)
  [GEMINI_MODELS.PRO]: {
    inputPer1M: 2.0, // $2.00/1M input tokens
    outputPer1M: 12.0, // $12.00/1M output tokens
    cachedInputPer1M: 0.2, // $0.20/1M cached input
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Cost Calculation
// ─────────────────────────────────────────────────────────────────────────────

export interface UsageMetrics {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cachedInputCost: number;
  totalCost: number;
  model: GeminiModel;
}

/**
 * Calculate cost for a single API call.
 *
 * @param model - The Gemini model used
 * @param usage - Token counts from the response
 * @returns Cost breakdown in USD
 */
export function calculateCost(model: GeminiModel, usage: UsageMetrics): CostBreakdown {
  const pricing = VERTEX_PRICING[model];

  if (!pricing) {
    logger.warn({ model }, 'Unknown model for pricing, using Flash rates');
    return calculateCost(GEMINI_MODELS.FLASH, usage);
  }

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPer1M;
  const cachedInputCost = ((usage.cachedInputTokens || 0) / 1_000_000) * pricing.cachedInputPer1M;

  return {
    inputCost,
    outputCost,
    cachedInputCost,
    totalCost: inputCost + outputCost + cachedInputCost,
    model,
  };
}

/**
 * Convert cost to cents (for integer storage).
 */
export function costToCents(cost: number): number {
  return Math.round(cost * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost per 1K Tokens (Legacy Format for Tracing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cost per 1K tokens (legacy format for existing tracing code).
 *
 * @deprecated Use VERTEX_PRICING with calculateCost() for new code
 */
export const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  // Gemini 3 Flash Preview
  [GEMINI_MODELS.FLASH]: {
    input: 0.0005, // $0.50/1M = $0.0005/1K
    output: 0.003, // $3.00/1M = $0.003/1K
  },
  // Gemini 2.5 Flash
  [GEMINI_MODELS.FLASH_STABLE]: {
    input: 0.0003, // $0.30/1M = $0.0003/1K
    output: 0.0025, // $2.50/1M = $0.0025/1K
  },
  // Gemini 3 Pro Preview
  [GEMINI_MODELS.PRO]: {
    input: 0.002, // $2.00/1M = $0.002/1K
    output: 0.012, // $12.00/1M = $0.012/1K
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Usage Logging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log API call with cost breakdown.
 *
 * Call this after each LLM call for observability.
 */
export function logUsage(
  context: { tenantId: string; sessionId: string; operation: string },
  model: GeminiModel,
  usage: UsageMetrics,
  latencyMs: number
): void {
  const cost = calculateCost(model, usage);

  logger.info(
    {
      ...context,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedInputTokens || 0,
      totalTokens: usage.inputTokens + usage.outputTokens,
      costUsd: cost.totalCost.toFixed(6),
      costCents: costToCents(cost.totalCost),
      latencyMs,
    },
    'LLM API call completed'
  );
}
