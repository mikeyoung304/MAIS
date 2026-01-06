'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut } from 'lucide-react';
import { stopImpersonation } from '@/app/(protected)/admin/tenants/actions';

/**
 * Impersonation Banner
 *
 * Fixed banner shown at the top of the page when a PLATFORM_ADMIN
 * is impersonating a tenant. Provides context about who is being
 * impersonated and a button to exit impersonation.
 *
 * HYDRATION SAFETY: This component waits until after hydration to render
 * the banner content, ensuring server and client render the same initial
 * HTML (both return null during SSR and initial client render).
 */
export function ImpersonationBanner() {
  const { impersonation, isImpersonating, isLoading } = useAuth();
  const [isExiting, setIsExiting] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Mark as hydrated after first client render
  // This ensures server and client both render null initially
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // During SSR and initial hydration, render nothing to avoid mismatch
  // The session data may not be available yet on the server
  if (!isHydrated || isLoading) {
    return null;
  }

  // After hydration, check actual impersonation state
  if (!isImpersonating() || !impersonation) {
    return null;
  }

  const { tenantSlug, tenantEmail } = impersonation;

  /**
   * Handle exiting impersonation with proper session refresh
   *
   * After the server action clears the impersonation JWT, we use
   * window.location.href for a hard navigation that forces a complete
   * page reload. This ensures both the RSC cache and SessionProvider
   * get fresh data from the server.
   *
   * IMPORTANT: We use a simple async/await pattern instead of startTransition
   * because we're doing a full page reload anyway. React's concurrent features
   * can interfere with side effects like navigation.
   */
  const handleExitImpersonation = async () => {
    setIsExiting(true);

    try {
      const result = await stopImpersonation();

      if (result.success) {
        // Full page reload to ensure fresh session state
        window.location.href = result.redirectTo;
      } else {
        setIsExiting(false);
        console.error('Failed to exit impersonation:', result.error);
      }
    } catch (error) {
      setIsExiting(false);
      console.error('Error exiting impersonation:', error);
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-50 bg-amber-950/50 border-b border-amber-800"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">
            Viewing as: <strong>{tenantSlug}</strong> ({tenantEmail})
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-amber-700 text-amber-400 hover:bg-amber-900/50"
          onClick={handleExitImpersonation}
          disabled={isExiting}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {isExiting ? 'Exiting...' : 'Exit Impersonation'}
        </Button>
      </div>
    </div>
  );
}
