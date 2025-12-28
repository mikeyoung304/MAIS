'use client';

import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut } from 'lucide-react';
import { stopImpersonation } from '@/app/(protected)/admin/tenants/actions';
import { useTransition } from 'react';

/**
 * Impersonation Banner
 *
 * Fixed banner shown at the top of the page when a PLATFORM_ADMIN
 * is impersonating a tenant. Provides context about who is being
 * impersonated and a button to exit impersonation.
 */
export function ImpersonationBanner() {
  const { impersonation, isImpersonating } = useAuth();
  const [isPending, startTransition] = useTransition();

  if (!isImpersonating() || !impersonation) {
    return null;
  }

  const { tenantSlug, tenantEmail } = impersonation;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500/10 border-b border-orange-500/20">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-orange-700">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">
            Viewing as: <strong>{tenantSlug}</strong> ({tenantEmail})
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-orange-500 text-orange-700 hover:bg-orange-500/10"
          onClick={() => startTransition(() => stopImpersonation())}
          disabled={isPending}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {isPending ? 'Exiting...' : 'Exit Impersonation'}
        </Button>
      </div>
    </div>
  );
}
