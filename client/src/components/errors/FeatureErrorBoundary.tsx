/**
 * Feature-level Error Boundary Component
 * Wraps individual features with isolated error handling
 * Shows feature-specific fallback UI on errors
 */

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: React.ReactNode;
  featureName: string;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

/**
 * Feature-specific error fallback
 * Displays a contained error message without breaking the entire page
 */
function FeatureErrorFallback({
  error,
  resetError,
  featureName,
}: {
  error: Error;
  resetError: () => void;
  featureName: string;
}) {
  const isDev = import.meta.env.DEV;

  return (
    <div className="p-6 border border-danger-200 bg-danger-50 rounded-lg my-4">
      <div className="flex items-start gap-3">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-danger-500 flex-shrink-0 mt-0.5"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-danger-800 mb-1">{featureName} Error</h3>

          <p className="text-sm text-danger-700 mb-3">
            Something went wrong while loading this feature. Please try again.
          </p>

          {isDev && (
            <details className="mb-3 text-xs">
              <summary className="cursor-pointer font-medium text-danger-800 mb-1">
                Error details (development only)
              </summary>
              <div className="mt-2 p-2 bg-danger-100 rounded border border-danger-200">
                <p className="font-semibold text-danger-900 mb-1">
                  {error.name}: {error.message}
                </p>
                {error.stack && (
                  <pre className="text-xs text-danger-800 overflow-auto whitespace-pre-wrap break-words max-h-40">
                    {error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}

          <button
            onClick={resetError}
            className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors hover:bg-danger-700 focus:outline-none focus:ring-2 focus:ring-danger-500 focus:ring-offset-2"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Wraps a feature with error boundary
 * Provides feature-specific error handling without breaking parent components
 *
 * @example
 * ```tsx
 * <FeatureErrorBoundary featureName="Package Catalog">
 *   <CatalogGrid />
 * </FeatureErrorBoundary>
 * ```
 */
export function FeatureErrorBoundary({ children, featureName, fallback }: Props) {
  const FallbackComponent =
    fallback ||
    (({ error, resetError }: { error: Error; resetError: () => void }) => (
      <FeatureErrorFallback error={error} resetError={resetError} featureName={featureName} />
    ));

  return (
    <ErrorBoundary name={featureName} fallback={FallbackComponent}>
      {children}
    </ErrorBoundary>
  );
}
