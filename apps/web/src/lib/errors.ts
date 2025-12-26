/**
 * Error handling utilities
 *
 * Provides type-safe error message extraction for catch blocks.
 */

/**
 * Extract error message from unknown error type
 *
 * Use this in catch blocks instead of `catch (err: any)` to maintain type safety.
 *
 * @param error - Unknown error value from catch block
 * @returns Error message string
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   setError(getErrorMessage(error));
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}
