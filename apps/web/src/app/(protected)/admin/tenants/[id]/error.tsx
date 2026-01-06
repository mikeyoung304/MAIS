'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { logger } from '@/lib/logger';

export default function EditTenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Edit tenant page error', { error: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/admin/tenants"
        className="mb-6 inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tenants
      </Link>

      <Card colorScheme="dark">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-950/50">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="mb-2 font-serif text-2xl font-bold text-text-primary">
            Something went wrong
          </h2>
          <p className="mb-6 text-text-muted">
            {error.message || 'An unexpected error occurred while loading the tenant.'}
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="sage" onClick={reset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline-light" asChild>
              <Link href="/admin/tenants">Go Back</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
