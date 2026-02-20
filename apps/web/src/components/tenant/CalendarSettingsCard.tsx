'use client';

/**
 * CalendarSettingsCard
 *
 * Card component for the tenant settings page that manages
 * Google Calendar OAuth connection state.
 *
 * States:
 * - Loading: Skeleton placeholder while fetching status
 * - Not connected: "Connect Google Calendar" button
 * - Connected: Green badge, calendar info, disconnect button
 * - Error: Inline error with retry
 *
 * API calls go through the Next.js proxy (/api/tenant-admin/...)
 * which injects the backend auth token server-side.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Calendar, CheckCircle, Loader2, AlertCircle, Unlink } from 'lucide-react';
import { logger } from '@/lib/logger';

/** Status response from GET /v1/tenant-admin/calendar/status */
interface CalendarStatus {
  configured: boolean;
  method?: 'oauth' | 'service_account';
  calendarId: string | null;
}

/** OAuth start response from GET /v1/tenant-admin/calendar/oauth/start */
interface OAuthStartResponse {
  url: string;
}

export function CalendarSettingsCard() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/tenant-admin/calendar/status', {
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: string } | null)?.error || `Failed to load calendar status (${res.status})`
        );
      }

      const data: CalendarStatus = await res.json();
      setStatus(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load calendar status';
      logger.error('CalendarSettingsCard: fetchStatus failed', { error: message });
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const res = await fetch('/api/tenant-admin/calendar/oauth/start', {
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: string } | null)?.error || `Failed to start OAuth flow (${res.status})`
        );
      }

      const data: OAuthStartResponse = await res.json();

      // Redirect the browser to Google's OAuth consent screen
      window.location.href = data.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start connection';
      logger.error('CalendarSettingsCard: handleConnect failed', { error: message });
      setError(message);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      setError(null);

      const res = await fetch('/api/tenant-admin/calendar/oauth/disconnect', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: string } | null)?.error || `Failed to disconnect (${res.status})`
        );
      }

      // Refresh status
      setStatus({ configured: false, calendarId: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect';
      logger.error('CalendarSettingsCard: handleDisconnect failed', { error: message });
      setError(message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <Card colorScheme="dark">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-sage" />
            Google Calendar
          </CardTitle>
          <CardDescription>Sync your bookings with Google Calendar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton width={80} height={24} rounded="full" className="bg-neutral-700" />
            <Skeleton width={160} height={16} className="bg-neutral-700" />
          </div>
          <Skeleton width={180} height={40} rounded="xl" className="bg-neutral-700" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.configured && status.method === 'oauth';
  const isServiceAccount = status?.configured && status.method === 'service_account';

  return (
    <Card colorScheme="dark">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-sage" />
              Google Calendar
            </CardTitle>
            <CardDescription>Sync your bookings with Google Calendar</CardDescription>
          </div>
          {isConnected && (
            <Badge variant="success" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Connected
            </Badge>
          )}
          {isServiceAccount && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Service Account
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-800 bg-red-950/50 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-400">{error}</p>
              <Button
                variant="ghost-light"
                size="sm"
                onClick={fetchStatus}
                className="mt-2 text-red-400 hover:text-red-300"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Connected state (OAuth) */}
        {isConnected && (
          <>
            <div className="rounded-lg border border-neutral-700 bg-surface p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sage/10">
                  <CheckCircle className="h-5 w-5 text-sage" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Google Calendar connected</p>
                  <p className="text-sm text-text-muted">
                    {status.calendarId === 'primary'
                      ? 'Using your primary calendar'
                      : `Calendar: ${status.calendarId}`}
                  </p>
                </div>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline-light"
                  size="sm"
                  className="text-red-400 border-red-800 hover:bg-red-950/50 hover:border-red-700"
                >
                  <Unlink className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    New bookings will no longer sync to your Google Calendar. Existing calendar events
                    are not affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect} disabled={isDisconnecting}>
                    {isDisconnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      'Disconnect'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {/* Service account state (legacy) */}
        {isServiceAccount && (
          <div className="rounded-lg border border-neutral-700 bg-surface p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sage/10">
                <CheckCircle className="h-5 w-5 text-sage" />
              </div>
              <div>
                <p className="font-medium text-text-primary">Connected via service account</p>
                <p className="text-sm text-text-muted">
                  Calendar: {status.calendarId || 'Unknown'}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Upgrade to OAuth for a simpler setup. Connect below to switch.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Not connected state (or service account suggesting upgrade) */}
        {(!status?.configured || isServiceAccount) && (
          <div className="space-y-3">
            {!isServiceAccount && (
              <p className="text-sm text-text-muted">
                Connect your Google Calendar so bookings automatically appear on your schedule.
              </p>
            )}
            <Button
              variant="sage"
              onClick={handleConnect}
              isLoading={isConnecting}
              loadingText="Redirecting to Google..."
            >
              <Calendar className="mr-2 h-4 w-4" />
              {isServiceAccount ? 'Switch to OAuth' : 'Connect Google Calendar'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
