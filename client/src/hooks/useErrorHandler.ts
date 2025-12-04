/**
 * Error handling hook
 * Provides error state management and reporting
 * Integrated with Sentry for error tracking
 */

import { useState, useCallback } from 'react';
import { captureException } from '../lib/sentry';
import { handleError as handleErrorUtil } from '../lib/error-handler';
import { logger } from '../lib/logger';

export interface UseErrorHandlerReturn {
  error: Error | null;
  handleError: (error: Error, context?: Record<string, any>) => void;
  clearError: () => void;
  hasError: boolean;
}

/**
 * Hook for managing error state in components
 * Automatically reports errors to Sentry
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { error, handleError, clearError } = useErrorHandler();
 *
 *   const fetchData = async () => {
 *     try {
 *       const data = await api.getData();
 *     } catch (err) {
 *       handleError(err as Error, { component: 'MyComponent', action: 'fetchData' });
 *     }
 *   };
 *
 *   return (
 *     <>
 *       {error && <ErrorMessage error={error} onClose={clearError} />}
 *       <button onClick={fetchData}>Fetch</button>
 *     </>
 *   );
 * }
 * ```
 */
export function useErrorHandler(): UseErrorHandlerReturn {
  const [error, setError] = useState<Error | null>(null);

  const handleError = (error: Error, context?: Record<string, any>) => {
    logger.error('Error', { error: error.message, ...context });
    setError(error);

    // Report to Sentry with context
    handleErrorUtil(error, context);
  };

  const clearError = () => {
    setError(null);
  };

  return {
    error,
    handleError,
    clearError,
    hasError: error !== null,
  };
}

/**
 * Hook for wrapping async functions with error handling
 * Automatically reports errors to Sentry
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { execute, error, loading } = useAsyncError(async () => {
 *     const data = await api.getData();
 *     return data;
 *   });
 *
 *   return (
 *     <>
 *       {error && <ErrorMessage error={error} />}
 *       <button onClick={execute} disabled={loading}>
 *         Fetch
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export function useAsyncError<T>(asyncFn: () => Promise<T>): {
  execute: () => Promise<T | void>;
  error: Error | null;
  loading: boolean;
  clearError: () => void;
} {
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await asyncFn();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Async error', { error: error.message });
      setError(error);

      // Report to Sentry
      handleErrorUtil(error, {
        type: 'async',
        location: window.location.href,
      });
    } finally {
      setLoading(false);
    }
  }, [asyncFn]);

  const clearError = () => {
    setError(null);
  };

  return { execute, error, loading, clearError };
}
