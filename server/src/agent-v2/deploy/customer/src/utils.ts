/**
 * Customer Agent Utilities
 *
 * Shared utilities for the unified Customer Agent including:
 * - Structured logging
 * - API call helpers with timeout
 * - Tenant context extraction
 */

import { type ToolContext } from '@google/adk';

// =============================================================================
// STRUCTURED LOGGER
// =============================================================================

/**
 * Lightweight structured logger for Cloud Run agents
 * Outputs JSON for easy parsing in Cloud Logging
 */
export const logger = {
  info: (data: Record<string, unknown>, msg: string) =>
    console.log(
      JSON.stringify({ level: 'info', msg, ...data, timestamp: new Date().toISOString() })
    ),
  warn: (data: Record<string, unknown>, msg: string) =>
    console.warn(
      JSON.stringify({ level: 'warn', msg, ...data, timestamp: new Date().toISOString() })
    ),
  error: (data: Record<string, unknown>, msg: string) =>
    console.error(
      JSON.stringify({ level: 'error', msg, ...data, timestamp: new Date().toISOString() })
    ),
};

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

const MAIS_API_URL = process.env.MAIS_API_URL || 'https://api.gethandled.ai';
const _INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
if (!_INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET environment variable is required');
}
// TypeScript doesn't narrow module-level vars, so we create a typed constant
const INTERNAL_API_SECRET: string = _INTERNAL_API_SECRET;

// Validate: Allow HTTP only for localhost, require HTTPS for all other hosts
if (
  MAIS_API_URL.startsWith('http://') &&
  !MAIS_API_URL.includes('localhost') &&
  !MAIS_API_URL.includes('127.0.0.1')
) {
  throw new Error(`MAIS_API_URL must use HTTPS for non-localhost hosts. Got: ${MAIS_API_URL}`);
}

const AGENT_API_PATH = process.env.AGENT_API_PATH || '/v1/internal/agent';

// =============================================================================
// TIMEOUT CONFIGURATION
// =============================================================================

export const TIMEOUTS = {
  BACKEND_API: 15_000, // 15s for backend calls
} as const;

/**
 * Fetch with timeout using AbortController
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// CONTEXT EXTRACTION
// =============================================================================

/**
 * Session context with proper typing for customer agent
 */
export interface CustomerSessionContext {
  tenantId: string;
  customerId?: string;
  projectId?: string;
}

/**
 * Extract tenant ID from ADK ToolContext using 4-tier defensive pattern.
 * Handles: state.get(), state object, userId with colon, userId direct.
 *
 * @see docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md
 */
export function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Tier 1: Map-like API (direct ADK)
  try {
    const fromState = context.state?.get<string>('tenantId');
    if (fromState) {
      logger.info({}, `[CustomerAgent] Got tenantId from state.get(): ${fromState}`);
      return fromState;
    }
  } catch {
    // state.get() might not be available
  }

  // Tier 2: Plain object access (A2A protocol)
  try {
    const stateObj = context.state as unknown as Record<string, unknown>;
    if (stateObj && typeof stateObj === 'object' && 'tenantId' in stateObj) {
      const tenantId = stateObj.tenantId as string;
      if (tenantId) {
        logger.info({}, `[CustomerAgent] Got tenantId from state object: ${tenantId}`);
        return tenantId;
      }
    }
  } catch {
    // state object access failed
  }

  // Tier 3 & 4: Extract from userId (format: "tenantId:userId" or just tenantId)
  const userId = context.invocationContext?.session?.userId;
  if (userId) {
    if (userId.includes(':')) {
      const [tenantId] = userId.split(':');
      if (tenantId) {
        logger.info({}, `[CustomerAgent] Extracted tenantId from userId: ${tenantId}`);
        return tenantId;
      }
    } else {
      logger.info({}, `[CustomerAgent] Using userId as tenantId: ${userId}`);
      return userId;
    }
  }

  logger.error({}, '[CustomerAgent] Could not extract tenantId from context');
  return null;
}

/**
 * Extract full session context from ToolContext.
 * @throws Error if tenant ID cannot be extracted (fail-fast)
 */
export function getSessionContext(ctx: ToolContext | undefined): CustomerSessionContext {
  if (!ctx) {
    throw new Error('Tool context is required');
  }

  const tenantId = getTenantId(ctx);
  if (!tenantId) {
    logger.error({}, '[CustomerAgent] No tenant context available - check session configuration');
    throw new Error('No tenant context available - check session configuration');
  }

  // Cast through unknown because ADK's State type doesn't have an index signature
  const state = ctx.state as unknown as Record<string, unknown>;

  return {
    tenantId,
    customerId: state.customerId as string | undefined,
    projectId: state.projectId as string | undefined,
  };
}

// =============================================================================
// API CALL HELPERS
// =============================================================================

/**
 * Make an authenticated request to the MAIS backend API.
 */
export async function callMaisApi(
  endpoint: string,
  tenantId: string,
  params: Record<string, unknown> = {}
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetchWithTimeout(
      `${MAIS_API_URL}${AGENT_API_PATH}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_API_SECRET,
        },
        body: JSON.stringify({ tenantId, ...params }),
      },
      TIMEOUTS.BACKEND_API
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({}, `[CustomerAgent] API error: ${response.status} - ${errorText}`);
      return { ok: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({}, `[CustomerAgent] Backend API timeout after ${TIMEOUTS.BACKEND_API}ms`);
      return { ok: false, error: 'Request timed out. Please try again.' };
    }
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      '[CustomerAgent] Network error'
    );
    return { ok: false, error: 'Network error - could not reach backend' };
  }
}

/**
 * Make a typed backend API call with full request configuration.
 */
export async function callBackendAPI<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${MAIS_API_URL}${AGENT_API_PATH}${endpoint}`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_API_SECRET,
        },
        ...(body && { body: JSON.stringify(body) }),
      },
      TIMEOUTS.BACKEND_API
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { endpoint, method, status: response.status, error: errorText },
        '[CustomerAgent] Backend API error'
      );
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error(
        { endpoint, method, timeout: TIMEOUTS.BACKEND_API },
        '[CustomerAgent] API timeout'
      );
      throw new Error(`Backend API timeout after ${TIMEOUTS.BACKEND_API}ms`);
    }
    // Re-throw if already a handled error
    if (error instanceof Error && error.message.startsWith('Backend API error:')) {
      throw error;
    }
    logger.error(
      { endpoint, method, error: error instanceof Error ? error.message : String(error) },
      '[CustomerAgent] Network error'
    );
    throw error;
  }
}
