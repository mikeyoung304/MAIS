'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface TenantErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
  context?: string;
}

/**
 * Shared error boundary component for tenant pages
 *
 * Provides consistent error handling and UI across both [slug] and _domain routes.
 * Logs errors with context for debugging and displays a user-friendly recovery UI.
 *
 * @param error - The error that was thrown
 * @param reset - Function to retry the failed operation
 * @param context - Optional context string for logging (e.g., 'about', 'services')
 *
 * @example
 * // In an error.tsx file:
 * 'use client';
 * import { TenantErrorBoundary } from '@/components/tenant/TenantErrorBoundary';
 *
 * export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
 *   return <TenantErrorBoundary {...props} context="about" />;
 * }
 */
export function TenantErrorBoundary({ error, reset, context }: TenantErrorBoundaryProps) {
  useEffect(() => {
    const contextLabel = context ? `${context} page` : 'Tenant page';
    logger.error(`${contextLabel} error boundary caught error`, error);
  }, [error, context]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4 p-8">
        <h1 className="text-2xl font-bold text-text-primary">Something went wrong</h1>
        <p className="text-text-muted">We couldn&apos;t load this page. Please try again.</p>
        <Button onClick={reset} variant="sage">
          Try again
        </Button>
      </div>
    </div>
  );
}

/**
 * Factory function to create error boundary components for tenant pages
 *
 * Use this to generate error.tsx exports with consistent behavior.
 *
 * @param context - Context string for logging
 * @returns Error component function suitable for Next.js error.tsx
 *
 * @example
 * // In error.tsx:
 * 'use client';
 * export { default } from '@/components/tenant/error-boundaries/about';
 *
 * // Or inline:
 * 'use client';
 * import { createTenantErrorBoundary } from '@/components/tenant/TenantErrorBoundary';
 * export default createTenantErrorBoundary('about');
 */
export function createTenantErrorBoundary(context: string) {
  return function TenantError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    return <TenantErrorBoundary error={error} reset={reset} context={context} />;
  };
}
