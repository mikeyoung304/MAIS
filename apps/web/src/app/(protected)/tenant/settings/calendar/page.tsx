'use client';

/**
 * Calendar Settings Page
 *
 * Landing page for Google Calendar OAuth callback redirects.
 * The backend redirects here with query params:
 *   ?connected=true  — OAuth flow completed successfully
 *   ?error=denied    — User denied the consent screen
 *   ?error=failed    — Token exchange or storage failed
 *   ?error=invalid   — Missing code/state params
 *
 * Shows a toast notification based on the query param, then renders
 * the full settings page with the CalendarSettingsCard visible.
 */

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarSettingsCard } from '@/components/tenant/CalendarSettingsCard';
import { Loader2 } from 'lucide-react';

/**
 * Error code → user-facing message mapping.
 *
 * Voice rules: no hype, no filler, assume competence.
 */
const ERROR_MESSAGES: Record<string, string> = {
  denied: 'Google Calendar access was not granted. Connect again when ready.',
  failed: 'Something went wrong during the connection. Try again.',
  invalid: 'Invalid callback from Google. Try connecting again.',
};

function CalendarSettingsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toastShown = useRef(false);

  useEffect(() => {
    if (toastShown.current) return;

    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected === 'true') {
      toastShown.current = true;
      toast.success('Google Calendar connected.', {
        description: 'Bookings will now sync to your calendar.',
      });
      // Clean URL without triggering re-render loop
      router.replace('/tenant/settings/calendar', { scroll: false });
    } else if (error) {
      toastShown.current = true;
      const message = ERROR_MESSAGES[error] || 'Connection failed. Try again.';
      toast.error(message);
      router.replace('/tenant/settings/calendar', { scroll: false });
    }
  }, [searchParams, router]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">Calendar Settings</h1>
        <p className="mt-2 text-text-muted">
          Manage your Google Calendar integration
        </p>
      </div>

      {/* Calendar connection card */}
      <CalendarSettingsCard />

      {/* Back link */}
      <div>
        <button
          onClick={() => router.push('/tenant/settings')}
          className="text-sm text-sage hover:text-sage-hover transition-colors"
        >
          &larr; Back to all settings
        </button>
      </div>
    </div>
  );
}

export default function CalendarSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
        </div>
      }
    >
      <CalendarSettingsInner />
    </Suspense>
  );
}
