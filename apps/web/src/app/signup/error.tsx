'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

export default function SignupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Signup error boundary caught error', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="text-center space-y-4 p-8">
        <h2 className="text-2xl font-bold text-text-primary">Signup Error</h2>
        <p className="text-text-muted">We encountered an error during signup. Please try again.</p>
        <Button onClick={reset} variant="sage">
          Try again
        </Button>
      </div>
    </div>
  );
}
