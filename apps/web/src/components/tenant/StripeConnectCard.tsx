'use client';

/**
 * StripeConnectCard
 *
 * Card component for the tenant settings page that manages
 * Stripe Connect integration status.
 *
 * States:
 * - Loading: Skeleton placeholder while fetching status
 * - Not connected: "Connect Stripe" button → begins onboarding flow
 * - Connected (incomplete): Orange badge, continue onboarding
 * - Connected (active): Green badge, open Stripe dashboard
 * - Error: Inline error with retry
 *
 * API calls go through the Next.js proxy (/api/tenant-admin/...).
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { CreditCard, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { logger } from '@/lib/logger';

/** Status response from GET /v1/tenant-admin/stripe/status */
interface StripeStatus {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
  };
}

export function StripeConnectCard() {
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      setNotFound(false);
      const res = await fetch('/api/tenant-admin/stripe/status', {
        credentials: 'include',
      });

      if (res.status === 404) {
        // No Stripe account yet — this is expected for new tenants
        setNotFound(true);
        setStatus(null);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: string } | null)?.error || `Failed to load Stripe status (${res.status})`
        );
      }

      const data: StripeStatus = await res.json();
      setStatus(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Stripe status';
      logger.error('StripeConnectCard: fetchStatus failed', { error: message });
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

      // If no account exists, create one first
      if (notFound || !status) {
        const createRes = await fetch('/api/tenant-admin/stripe/connect', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: '', // Will be filled from tenant context on backend
            businessName: 'My Business',
            country: 'US',
          }),
        });

        if (!createRes.ok && createRes.status !== 409) {
          const body = await createRes.json().catch(() => null);
          throw new Error(
            (body as { error?: string } | null)?.error || 'Failed to create Stripe account'
          );
        }
      }

      // Generate onboarding link
      const origin = window.location.origin;
      const onboardRes = await fetch('/api/tenant-admin/stripe/onboard', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshUrl: `${origin}/tenant/settings`,
          returnUrl: `${origin}/tenant/settings`,
        }),
      });

      if (!onboardRes.ok) {
        const body = await onboardRes.json().catch(() => null);
        throw new Error(
          (body as { error?: string } | null)?.error || 'Failed to start Stripe onboarding'
        );
      }

      const { url } = await onboardRes.json();
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect Stripe';
      logger.error('StripeConnectCard: handleConnect failed', { error: message });
      setError(message);
      setIsConnecting(false);
    }
  };

  const handleOpenDashboard = async () => {
    try {
      setError(null);
      const res = await fetch('/api/tenant-admin/stripe/dashboard', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: string } | null)?.error || 'Failed to open Stripe dashboard'
        );
      }

      const { url } = await res.json();
      window.open(url, '_blank');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open dashboard';
      logger.error('StripeConnectCard: handleOpenDashboard failed', { error: message });
      setError(message);
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <Card colorScheme="dark">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-sage" />
            Stripe Payments
          </CardTitle>
          <CardDescription>Accept payments from your clients</CardDescription>
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

  const isActive = status?.chargesEnabled && status?.payoutsEnabled;
  const isIncomplete = status && !isActive;

  return (
    <Card colorScheme="dark">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-sage" />
              Stripe Payments
            </CardTitle>
            <CardDescription>Accept payments from your clients</CardDescription>
          </div>
          {isActive && (
            <Badge variant="success" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Connected
            </Badge>
          )}
          {isIncomplete && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Setup Incomplete
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

        {/* Active state */}
        {isActive && (
          <>
            <div className="rounded-lg border border-neutral-700 bg-surface p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sage/10">
                  <CheckCircle className="h-5 w-5 text-sage" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Stripe connected</p>
                  <p className="text-sm text-text-muted">
                    Payments and payouts are active
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline-light"
              size="sm"
              onClick={handleOpenDashboard}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Stripe Dashboard
            </Button>
          </>
        )}

        {/* Incomplete setup */}
        {isIncomplete && (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-800 bg-amber-950/50 p-4">
              <p className="text-sm text-amber-400">
                Stripe onboarding is incomplete. Finish setup to start accepting payments.
              </p>
            </div>
            <Button
              variant="sage"
              onClick={handleConnect}
              isLoading={isConnecting}
              loadingText="Redirecting to Stripe..."
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Continue Setup
            </Button>
          </div>
        )}

        {/* Not connected */}
        {(notFound || (!status && !error)) && !isLoading && (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              Connect Stripe to accept payments from your clients.
            </p>
            <Button
              variant="sage"
              onClick={handleConnect}
              isLoading={isConnecting}
              loadingText="Redirecting to Stripe..."
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Connect Stripe
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
