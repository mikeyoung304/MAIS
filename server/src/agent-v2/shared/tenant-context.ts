/**
 * Shared Tenant Context Utilities
 *
 * Provides consistent tenant ID extraction across all deployed agents.
 * The 4-tier defensive pattern handles all ADK session state scenarios:
 *
 * 1. state.get<T>('key') - Map-like API (direct ADK calls)
 * 2. state.tenantId - Plain object access (A2A protocol)
 * 3. userId with colon - Format "tenantId:userId" (MAIS multi-tenant pattern)
 * 4. userId without colon - Direct tenant ID (fallback)
 *
 * @module agent-v2/shared/tenant-context
 */

import type { ToolContext } from '@google/adk';

/**
 * Logger interface for dependency injection.
 * Each agent provides its own logger for correct log attribution.
 */
export interface TenantContextLogger {
  info: (data: Record<string, unknown>, msg: string) => void;
  warn?: (data: Record<string, unknown>, msg: string) => void;
}

/**
 * Options for tenant ID extraction
 */
export interface GetTenantIdOptions {
  /**
   * Logger for debugging tenant extraction steps.
   * Each agent should pass its own logger for proper log attribution.
   */
  logger?: TenantContextLogger;
  /**
   * Agent name for log messages (e.g., "MarketingAgent", "Concierge")
   */
  agentName?: string;
}

/**
 * Extract tenant ID from ADK ToolContext using 4-tier defensive pattern.
 *
 * This function handles all known scenarios for how tenant ID can be passed:
 * - Direct ADK sessions use state.get<T>() Map-like API
 * - A2A (agent-to-agent) calls pass state as plain objects
 * - MAIS backend passes userId as "tenantId:userId" format
 *
 * @param context - ADK ToolContext from tool execution
 * @param options - Optional logger and agent name for debugging
 * @returns Tenant ID or null if not found
 *
 * @example
 * ```typescript
 * const tenantId = getTenantId(context, {
 *   logger,
 *   agentName: 'MarketingAgent'
 * });
 * if (!tenantId) {
 *   return { error: 'No tenant context available' };
 * }
 * ```
 */
export function getTenantId(
  context: ToolContext | undefined,
  options: GetTenantIdOptions = {}
): string | null {
  if (!context) return null;

  const { logger, agentName = 'Agent' } = options;

  // Try 1: Get from session state using Map-like interface (direct ADK)
  try {
    const fromState = context.state?.get<string>('tenantId');
    if (fromState) {
      logger?.info({}, `[${agentName}] Got tenantId from state.get(): ${fromState}`);
      return fromState;
    }
  } catch {
    // state.get() might not be available or might throw
    logger?.info({}, `[${agentName}] state.get() failed, trying alternatives`);
  }

  // Try 2: Access state as plain object (A2A passes state as plain object)
  try {
    const stateObj = context.state as unknown as Record<string, unknown>;
    if (stateObj && typeof stateObj === 'object' && 'tenantId' in stateObj) {
      const tenantId = stateObj.tenantId as string;
      if (tenantId) {
        logger?.info({}, `[${agentName}] Got tenantId from state object: ${tenantId}`);
        return tenantId;
      }
    }
  } catch {
    logger?.info({}, `[${agentName}] state object access failed`);
  }

  // Try 3: Extract from userId (format: "tenantId:userId" or just tenantId)
  // The MAIS backend passes userId as `${tenantId}:${userId}` for multi-tenant isolation
  const userId = context.invocationContext?.session?.userId;
  if (userId) {
    if (userId.includes(':')) {
      const [tenantId] = userId.split(':');
      if (tenantId) {
        logger?.info(
          {},
          `[${agentName}] Extracted tenantId from userId (colon format): ${tenantId}`
        );
        return tenantId;
      }
    } else {
      // Try 4: userId might be the tenantId directly
      logger?.info({}, `[${agentName}] Using userId as tenantId: ${userId}`);
      return userId;
    }
  }

  logger?.warn?.({}, `[${agentName}] Could not extract tenantId from context`);
  return null;
}

/**
 * Assert that tenant ID is available, throwing if not.
 * Use this when tenant context is required and you want to fail fast.
 *
 * @param context - ADK ToolContext from tool execution
 * @param options - Optional logger and agent name
 * @returns Tenant ID (never null)
 * @throws Error if tenant ID cannot be extracted
 */
export function requireTenantId(
  context: ToolContext | undefined,
  options: GetTenantIdOptions = {}
): string {
  const tenantId = getTenantId(context, options);
  if (!tenantId) {
    throw new Error(
      `[${options.agentName || 'Agent'}] Tenant context is required but not available`
    );
  }
  return tenantId;
}
