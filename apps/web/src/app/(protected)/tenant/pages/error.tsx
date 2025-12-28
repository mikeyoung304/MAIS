'use client';

import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function TenantPagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <AlertCircle className="h-12 w-12 text-red-500" />
      <h2 className="mt-4 text-xl font-semibold text-text-primary">Unable to Load Page Settings</h2>
      <p className="mt-2 text-text-muted">{error.message}</p>
      <Button onClick={reset} variant="sage" className="mt-6">
        Try Again
      </Button>
    </div>
  );
}
