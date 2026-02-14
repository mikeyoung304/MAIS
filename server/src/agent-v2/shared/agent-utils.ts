/**
 * Canonical Agent Utilities — Single Source of Truth
 *
 * This file is the CANONICAL source for shared utilities used by all
 * Cloud Run agent deployments (tenant, customer, research).
 *
 * BUILD-TIME SYNC: This file is copied into each agent's src/ directory
 * by the `prebuild` npm script. Do NOT edit the copies directly.
 *
 * DRIFT DETECTION: server/src/lib/constants-sync.test.ts verifies that
 * agent copies match this canonical source.
 *
 * Exported utilities:
 * - logger: Structured JSON logger for Cloud Logging
 * - requireEnv: Fail-fast environment variable access
 * - fetchWithTimeout: AbortController-based fetch timeout
 * - getTenantId: 4-tier tenant ID extraction from ADK context
 * - callMaisApi: POST-based backend API calls
 * - callBackendAPI: Full HTTP method backend API calls
 * - callMaisApiTyped: Zod-validated backend API calls
 * - requireTenantId: Throw-on-missing tenant ID helper
 * - validateParams: Zod schema validation helper
 * - wrapToolExecute: Standardized error handling wrapper
 * - ToolError: Error class for tool execution failures
 * - TTLCache: Size-limited TTL cache with periodic cleanup
 *
 * @see server/src/lib/constants-sync.test.ts (drift detection)
 * @see docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md
 */

import type { ToolContext } from '@google/adk';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Environment Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Require an environment variable, throwing if not set.
 * Addresses pitfall #41: Empty secret fallback masks misconfiguration.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const MAIS_API_URL = process.env.MAIS_API_URL || 'https://api.gethandled.ai';
const INTERNAL_API_SECRET = requireEnv('INTERNAL_API_SECRET');
const AGENT_API_PATH = process.env.AGENT_API_PATH || '/v1/internal/agent';

// Validate: Allow HTTP only for localhost, require HTTPS for all other hosts
if (
  MAIS_API_URL.startsWith('http://') &&
  !MAIS_API_URL.includes('localhost') &&
  !MAIS_API_URL.includes('127.0.0.1') &&
  !MAIS_API_URL.includes('0.0.0.0') &&
  !MAIS_API_URL.includes('[::1]') &&
  !MAIS_API_URL.includes('::1') &&
  !MAIS_API_URL.includes('host.docker.internal')
) {
  throw new Error(`MAIS_API_URL must use HTTPS for non-localhost hosts. Got: ${MAIS_API_URL}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeout Configuration (per pitfall #42)
// ─────────────────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  BACKEND_API: 15_000, // 15s for backend calls
  VOCABULARY_RESOLVE: 5_000, // 5s for vocabulary resolution
  METADATA_SERVICE: 5_000, // 5s for GCP metadata
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Structured Logger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight structured logger for Cloud Run agents.
 * Outputs JSON for easy parsing in Cloud Logging.
 */
/* eslint-disable no-console -- Structured logger wraps console for Cloud Logging */
export const logger = {
  debug: (data: Record<string, unknown>, msg: string) =>
    console.log(
      JSON.stringify({ level: 'debug', msg, ...data, timestamp: new Date().toISOString() })
    ),
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
/* eslint-enable no-console */

// ─────────────────────────────────────────────────────────────────────────────
// Network Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch with timeout using AbortController.
 * Addresses pitfall #42: No fetch timeouts.
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

/**
 * Call the MAIS backend API.
 *
 * @param endpoint - API endpoint path (e.g., '/tenant-context')
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param params - Additional parameters to send in request body
 * @returns Result object with ok flag, data, and optional error
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
      logger.error(
        { status: response.status, error: errorText, endpoint },
        `[Agent] API error: ${endpoint}`
      );
      return { ok: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({ endpoint }, '[Agent] Backend API timeout');
      return { ok: false, error: 'Request timed out. Please try again.' };
    }
    logger.error(
      { error: error instanceof Error ? error.message : String(error), endpoint },
      '[Agent] Network error'
    );
    return { ok: false, error: 'Network error - could not reach backend' };
  }
}

/**
 * Call the MAIS backend API with full HTTP method support and typed response.
 *
 * @param endpoint - API endpoint path (e.g., '/project-hub/pending-requests')
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @param body - Request body (for POST/PUT)
 * @returns Typed response data
 * @throws Error on failure
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
        '[Agent] Backend API error'
      );
      throw new Error(`Backend API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({ endpoint, method, timeout: TIMEOUTS.BACKEND_API }, '[Agent] API timeout');
      throw new Error(`Backend API timeout after ${TIMEOUTS.BACKEND_API}ms`);
    }
    // Re-throw if already a handled error
    if (error instanceof Error && error.message.startsWith('Backend API error:')) {
      throw error;
    }
    logger.error(
      { endpoint, method, error: error instanceof Error ? error.message : String(error) },
      '[Agent] Network error'
    );
    throw error;
  }
}

/**
 * Call MAIS API with response validation.
 * Parses response with Zod schema — returns typed data instead of unknown.
 * Replaces unsafe `as` casts with runtime validation (todo 6010).
 */
export async function callMaisApiTyped<T>(
  endpoint: string,
  tenantId: string,
  params: Record<string, unknown>,
  responseSchema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const result = await callMaisApi(endpoint, tenantId, params);
  if (!result.ok) return { ok: false, error: result.error ?? 'Request failed' };

  const parsed = responseSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.error({ endpoint, errors: parsed.error.format() }, '[API] Response shape mismatch');
    return { ok: false, error: 'Unexpected response format from backend' };
  }
  return { ok: true, data: parsed.data };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant ID Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract tenant ID using 4-tier defensive pattern.
 *
 * This handles all ADK session state scenarios:
 * 1. state.get<T>('key') - Map-like API (direct ADK calls)
 * 2. state.tenantId - Plain object access (A2A protocol)
 * 3. userId with colon - Format "tenantId:userId" (MAIS multi-tenant)
 * 4. userId without colon - Direct tenant ID (fallback)
 *
 * @param context - ADK ToolContext from tool execution
 * @returns Tenant ID or null if not found
 */
export function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Tier 1: Get from session state using Map-like interface (direct ADK)
  try {
    const fromState = context.state?.get<string>('tenantId');
    if (fromState) {
      logger.debug({}, `[Agent] Got tenantId from state.get(): ${fromState}`);
      return fromState;
    }
  } catch {
    // state.get() might not be available or might throw
    logger.debug({}, '[Agent] state.get() failed, trying alternatives');
  }

  // Tier 2: Access state as plain object (A2A passes state as plain object)
  try {
    const stateObj = context.state as unknown as Record<string, unknown>;
    if (stateObj && typeof stateObj === 'object' && 'tenantId' in stateObj) {
      const tenantId = stateObj.tenantId as string;
      if (tenantId) {
        logger.debug({}, `[Agent] Got tenantId from state object: ${tenantId}`);
        return tenantId;
      }
    }
  } catch {
    logger.debug({}, '[Agent] state object access failed');
  }

  // Tier 3 & 4: Extract from userId
  const userId = context.invocationContext?.session?.userId;
  if (userId) {
    if (userId.includes(':')) {
      // Tier 3: Extract tenantId from "tenantId:userId" format
      const [tenantId] = userId.split(':');
      if (tenantId) {
        logger.debug({}, `[Agent] Extracted tenantId from userId (colon format): ${tenantId}`);
        return tenantId;
      }
    } else {
      // Tier 4: userId might be the tenantId directly
      logger.debug({}, `[Agent] Using userId as tenantId: ${userId}`);
      return userId;
    }
  }

  logger.warn({}, '[Agent] Could not extract tenantId from context');
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Boilerplate Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Error thrown by tool helpers — caught by wrapToolExecute */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

/**
 * Extract tenantId from ADK context, throwing if not found.
 * Eliminates the 5-line null-check boilerplate in every tool.
 */
export function requireTenantId(context: ToolContext | undefined): string {
  const tenantId = getTenantId(context);
  if (!tenantId) {
    throw new ToolError('No tenant context available');
  }
  return tenantId;
}

/**
 * Validate tool parameters against a Zod schema, throwing on failure.
 * Replaces the 5-line safeParse + error return boilerplate.
 */
export function validateParams<S extends z.ZodTypeAny>(schema: S, params: unknown): z.output<S> {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ToolError(`Invalid parameters: ${result.error.message}`);
  }
  return result.data as z.output<S>;
}

/**
 * Wrap a tool execute function with standardized error handling.
 * Catches ToolError and returns { success: false, error } consistently.
 */
export function wrapToolExecute<P, R>(
  fn: (params: P, context: ToolContext | undefined) => Promise<R>
): (params: P, context: ToolContext | undefined) => Promise<R | { success: false; error: string }> {
  return async (params, context) => {
    try {
      return await fn(params, context);
    } catch (err) {
      if (err instanceof ToolError) {
        return { success: false, error: err.message };
      }
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        '[Tool] Unexpected error in tool execution'
      );
      return { success: false, error: 'An unexpected error occurred' };
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Session context with proper typing for agents that need customer/project context.
 */
export interface CustomerSessionContext {
  tenantId: string;
  customerId?: string;
  projectId?: string;
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
    logger.error({}, '[Agent] No tenant context available - check session configuration');
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

// ─────────────────────────────────────────────────────────────────────────────
// TTL Cache (addresses pitfall #46)
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  createdAt: number;
}

/**
 * TTL Cache with size limits and periodic cleanup.
 *
 * Addresses pitfall #46: Module-level cache unbounded.
 * Entries are evicted:
 * 1. On access if expired (passive cleanup)
 * 2. When size limit reached (LRU-style: oldest entry evicted)
 * 3. Periodically via cleanup interval (active cleanup)
 */
export class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly ttlMs: number,
    private readonly maxSize: number,
    private readonly name: string
  ) {
    // Run cleanup every 5 minutes to remove expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);

    // Ensure cleanup interval doesn't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL (passive cleanup)
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    // Enforce size limit - remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        logger.debug({ cache: this.name }, '[TTLCache] Evicted oldest entry due to size limit');
      }
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  get size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.ttlMs) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.debug(
        { cache: this.name, expiredCount, remaining: this.cache.size },
        '[TTLCache] Cleanup removed expired entries'
      );
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
