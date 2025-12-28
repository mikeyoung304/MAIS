'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    logger.error('Error boundary caught error', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl font-bold text-text-primary mb-4">
          Something went sideways.
        </h1>
        <p className="text-text-muted mb-8">
          We&apos;re on it. Try refreshing, or come back in a minute.
        </p>
        <Button
          onClick={reset}
          variant="sage"
          className="rounded-full px-8 py-3"
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}
