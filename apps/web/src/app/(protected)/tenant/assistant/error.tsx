'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

export default function AssistantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Assistant page error:', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
      <div className="rounded-full bg-red-100 p-4 mb-4">
        <AlertTriangle className="h-8 w-8 text-red-600" />
      </div>
      <h2 className="font-serif text-2xl font-bold text-text-primary mb-2">
        Something went wrong
      </h2>
      <p className="text-text-muted mb-6 max-w-md">
        We couldn&apos;t load the assistant. This might be a temporary issue.
      </p>
      <Button onClick={reset} variant="sage">
        <RefreshCw className="h-4 w-4 mr-2" />
        Try again
      </Button>
    </div>
  );
}
