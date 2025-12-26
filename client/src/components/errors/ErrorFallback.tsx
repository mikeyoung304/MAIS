/**
 * Default error fallback UI
 * Displayed when an error boundary catches an error
 */

import React from 'react';

interface Props {
  error: Error;
  resetError: () => void;
}

/**
 * Default error fallback component
 * Displays a user-friendly error message with option to retry
 */
export function ErrorFallback({ error, resetError }: Props) {
  const isDev = import.meta.env.DEV;

  return (
    <div className="p-8 text-center max-w-2xl mx-auto my-8">
      <div className="mb-6">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-danger-500 mx-auto"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>

      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>

      <p className="text-neutral-500 mb-6">We're sorry for the inconvenience. Please try again.</p>

      {isDev && (
        <details className="mt-4 mb-6 text-left bg-neutral-50 p-4 rounded-lg border border-neutral-200">
          <summary className="cursor-pointer font-semibold mb-2 text-neutral-700">
            Error details (development only)
          </summary>
          <div className="mt-2">
            <p className="font-semibold text-danger-500 mb-2">
              {error.name}: {error.message}
            </p>
            {error.stack && (
              <pre className="text-xs text-neutral-600 overflow-auto whitespace-pre-wrap break-words">
                {error.stack}
              </pre>
            )}
          </div>
        </details>
      )}

      <button
        onClick={resetError}
        className="px-6 py-3 bg-primary-500 text-white rounded-lg text-base font-medium cursor-pointer transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}

/**
 * Minimal error fallback for widget mode
 */
export function MinimalErrorFallback({ error: _error, resetError }: Props) {
  return (
    <div className="p-4 text-center bg-danger-50">
      <p className="text-danger-800 mb-2">An error occurred. Please try again.</p>
      <button
        onClick={resetError}
        className="px-4 py-2 bg-danger-600 text-white border-none rounded cursor-pointer hover:bg-danger-700 focus:outline-none focus:ring-2 focus:ring-danger-500 focus:ring-offset-1 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
