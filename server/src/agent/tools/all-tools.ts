/**
 * All Agent Tools Registry
 *
 * Consolidates read and write tools into a single export.
 * This module exists to avoid circular dependency between
 * agent/index.ts and agent/orchestrator/orchestrator.ts.
 */

import { readTools } from './read-tools';
import { writeTools } from './write-tools';
import type { AgentTool } from './types';

/**
 * Get all agent tools (read + write)
 */
export function getAllTools(): AgentTool[] {
  return [...readTools, ...writeTools];
}
