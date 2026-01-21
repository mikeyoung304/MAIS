'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to Sentry and local logger
    Sentry.captureException(error);
    logger.error('Global error boundary caught error', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
          <div className="text-center space-y-4 p-8">
            <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
            <p className="text-gray-600">We encountered an unexpected error. Please try again.</p>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center rounded-lg px-6 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
