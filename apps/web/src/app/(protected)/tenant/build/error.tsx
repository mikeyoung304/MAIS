'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { logger } from '@/lib/logger';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Build Mode Error Boundary
 *
 * Handles errors in the Build Mode page with recovery options.
 */
export default function BuildModeError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    logger.error('Build Mode error', { error: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-neutral-50">
      <div className="max-w-md text-center p-8">
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <h1 className="text-xl font-semibold text-neutral-900 mb-2">
          Something went wrong
        </h1>

        <p className="text-neutral-600 mb-6">
          Build Mode encountered an error. Your changes may not have been saved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>

          <Button
            variant="sage"
            onClick={() => router.push('/tenant/dashboard')}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Return to Dashboard
          </Button>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-neutral-400">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
