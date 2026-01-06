'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Admin dashboard page error', { error: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-orange-500 mb-4" />
          <h2 className="font-serif text-xl font-bold text-text-primary mb-2">
            Failed to load dashboard
          </h2>
          <p className="text-text-muted mb-6">
            {error.message || 'Something went wrong. Please try again.'}
          </p>
          <Button onClick={reset} variant="sage">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
