'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Billing page error', { error: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-red-800">Failed to load billing</p>
              <p className="text-sm text-red-700">{error.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={reset} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
