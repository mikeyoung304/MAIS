/**
 * All Agent Tools Registry
 *
 * Consolidates read and write tools into a single export.
 * This module exists to avoid circular dependency between
 * agent/index.ts and agent/orchestrator/orchestrator.ts.
 */

import { readTools } from './read-tools';
import { writeTools } from './write-tools';
import { onboardingTools } from './onboarding-tools';
import { storefrontTools } from './storefront-tools';
import type { AgentTool } from './types';

/**
 * Get all agent tools (read + write + storefront)
 */
export function getAllTools(): AgentTool[] {
  return [...readTools, ...writeTools, ...storefrontTools];
}

/**
 * Get all tools including onboarding tools
 * Use this for tenant admin agent with onboarding mode enabled
 */
export function getAllToolsWithOnboarding(): AgentTool[] {
  return [...readTools, ...writeTools, ...storefrontTools, ...onboardingTools];
}

/**
 * Get only onboarding tools
 * Use for specialized onboarding-only agent
 */
export function getOnboardingTools(): AgentTool[] {
  return onboardingTools;
}
