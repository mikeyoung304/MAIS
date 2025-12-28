'use client';

import { TenantErrorBoundary } from '@/components/tenant';

export default function AboutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <TenantErrorBoundary error={error} reset={reset} context="about (domain)" />;
}
