'use client';

import { TenantErrorBoundary } from '@/components/tenant';

export default function ContactError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <TenantErrorBoundary error={error} reset={reset} context="contact (domain)" />;
}
