/**
 * Request Context for Agent Orchestrators
 *
 * Uses AsyncLocalStorage to provide request-scoped state without
 * polluting instance variables (which cause race conditions in singletons).
 *
 * @see https://nodejs.org/api/async_context.html
 */

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Context available during a single request lifecycle
 */
export interface OrchestratorRequestContext {
  /** Whether tenant is in active onboarding (not COMPLETED/SKIPPED) */
  isOnboardingMode: boolean;
}

/**
 * AsyncLocalStorage instance for request-scoped context.
 * Each async operation (request) gets its own isolated storage.
 */
export const requestContext = new AsyncLocalStorage<OrchestratorRequestContext>();

/**
 * Get current request context (returns undefined if not in request scope)
 */
export function getRequestContext(): OrchestratorRequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Run a callback within a request context
 *
 * @example
 * const result = await runInRequestContext({ isOnboardingMode: true }, async () => {
 *   // All async operations here have access to the context
 *   return await someAsyncWork();
 * });
 */
export function runInRequestContext<T>(context: OrchestratorRequestContext, callback: () => T): T {
  return requestContext.run(context, callback);
}
