'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

export default function FAQError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('FAQ page error boundary caught error', error);
  }, [error]);

  return (
    <div id="main-content" className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4 p-8">
        <h1 className="text-2xl font-bold text-text-primary">Something went wrong</h1>
        <p className="text-text-muted">We couldn&apos;t load the FAQ. Please try again.</p>
        <Button onClick={reset} variant="sage">
          Try again
        </Button>
      </div>
    </div>
  );
}
