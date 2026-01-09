'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  Calendar,
  Users,
  DollarSign,
  ArrowRight,
  ExternalLink,
  Palette,
  FileEdit,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errors';
import { StartTrialCard, TrialBanner } from '@/components/trial';
import { agentUIActions } from '@/stores/agent-ui-store';

interface DashboardStats {
  packagesCount: number;
  bookingsCount: number;
  blackoutsCount: number;
  hasStripeConnected: boolean;
}

interface TrialStatus {
  status: 'NONE' | 'TRIALING' | 'ACTIVE' | 'EXPIRED';
  daysRemaining: number | null;
  canStartTrial: boolean;
  hasPackages: boolean;
}

/**
 * Tenant Dashboard Page
 *
 * Main dashboard for tenant admins showing:
 * - Quick stats overview
 * - Quick action buttons
 * - Recent activity (future)
 *
 * Supports ?showPreview=true query param to auto-open preview mode
 * (used when redirected from /tenant/build)
 */
export default function TenantDashboardPage() {
  const { tenantId, user, slug: authSlug, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(authSlug || null);

  // Handle showPreview query param (from /tenant/build redirect)
  useEffect(() => {
    if (searchParams.get('showPreview') === 'true') {
      // Trigger preview mode via agent UI store
      agentUIActions.showPreview('home');
      // Clean up URL to prevent re-triggering on refresh
      window.history.replaceState({}, '', '/tenant/dashboard');
    }
  }, [searchParams]);

  const fetchDashboardData = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch tenant info to get slug (if not already available from session)
      if (!authSlug) {
        const infoResponse = await fetch('/api/tenant-admin/info');

        if (infoResponse.ok) {
          const info = await infoResponse.json();
          setSlug(info.slug);
        }
      }

      // Fetch all data in parallel (including trial status)
      const [packagesResponse, bookingsResponse, blackoutsResponse, stripeResponse, trialResponse] =
        await Promise.all([
          fetch('/api/tenant-admin/packages'),
          fetch('/api/tenant-admin/bookings'),
          fetch('/api/tenant-admin/blackouts'),
          fetch('/api/tenant-admin/stripe/status'),
          fetch('/api/tenant-admin/trial/status'),
        ]);

      const packages = packagesResponse.ok ? await packagesResponse.json() : [];
      const bookings = bookingsResponse.ok ? await bookingsResponse.json() : [];
      const blackouts = blackoutsResponse.ok ? await blackoutsResponse.json() : [];
      const stripeStatus = stripeResponse.ok ? await stripeResponse.json() : null;
      const trial = trialResponse.ok ? await trialResponse.json() : null;

      setStats({
        packagesCount: Array.isArray(packages) ? packages.length : 0,
        bookingsCount: Array.isArray(bookings) ? bookings.length : 0,
        blackoutsCount: Array.isArray(blackouts) ? blackouts.length : 0,
        hasStripeConnected: stripeStatus?.chargesEnabled || false,
      });

      if (trial) {
        setTrialStatus(trial);
      }
    } catch (err) {
      logger.error(
        'Dashboard data fetch failed',
        err instanceof Error ? err : { error: String(err) }
      );
      setError(getErrorMessage(err));
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authSlug]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, tenantId]);

  const statCards = [
    {
      title: 'Packages',
      value: stats?.packagesCount ?? 0,
      icon: <Package className="h-5 w-5" />,
      href: '/tenant/packages',
      color: 'text-sage',
    },
    {
      title: 'Bookings',
      value: stats?.bookingsCount ?? 0,
      icon: <Calendar className="h-5 w-5" />,
      href: '/tenant/scheduling',
      color: 'text-sky-400',
    },
    {
      title: 'Blackout Dates',
      value: stats?.blackoutsCount ?? 0,
      icon: <Users className="h-5 w-5" />,
      href: '/tenant/scheduling',
      color: 'text-amber-400',
    },
    {
      title: 'Payments',
      value: stats?.hasStripeConnected ? 'Connected' : 'Setup',
      icon: <DollarSign className="h-5 w-5" />,
      href: '/tenant/payments',
      color: stats?.hasStripeConnected ? 'text-sage' : 'text-amber-400',
    },
  ];

  const quickActions = [
    {
      title: 'Site Builder',
      description: 'Preview and edit your storefront',
      href: '/tenant/build',
      icon: <Palette className="h-5 w-5" />,
      highlight: true,
    },
    {
      title: 'Manage Pages',
      description: 'Configure your website pages',
      href: '/tenant/pages',
      icon: <FileEdit className="h-5 w-5" />,
    },
    {
      title: 'View Storefront',
      description: 'See your public booking page',
      href: slug ? `/t/${slug}` : '#',
      icon: <ExternalLink className="h-5 w-5" />,
      external: true,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Trial Banner - Show at top if trialing or expired */}
      {trialStatus && (trialStatus.status === 'TRIALING' || trialStatus.status === 'EXPIRED') && (
        <TrialBanner status={trialStatus.status} daysRemaining={trialStatus.daysRemaining ?? 0} />
      )}

      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">
          Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="mt-2 text-text-muted">Here&apos;s an overview of your business.</p>
      </div>

      {/* Start Trial Card - Show if has packages but no trial started */}
      {trialStatus && trialStatus.canStartTrial && (
        <StartTrialCard onTrialStarted={fetchDashboardData} />
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-800 bg-red-950/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-red-300">Failed to load dashboard</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDashboardData}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card
              colorScheme="dark"
              className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-text-muted">{card.title}</CardTitle>
                <div className={card.color}>{card.icon}</div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-text-primary">
                  {isLoading ? (
                    <div className="h-8 w-16 animate-pulse rounded bg-neutral-700" />
                  ) : (
                    card.value
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-serif text-xl font-bold text-text-primary mb-4">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              target={'external' in action && action.external ? '_blank' : undefined}
              rel={'external' in action && action.external ? 'noopener noreferrer' : undefined}
            >
              <Card
                colorScheme="dark"
                className={`transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer group ${
                  'highlight' in action && action.highlight
                    ? 'border-2 border-sage/30 bg-sage/10'
                    : ''
                }`}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <div
                    className={`rounded-xl p-3 transition-colors ${
                      'highlight' in action && action.highlight
                        ? 'bg-sage text-white group-hover:bg-sage-hover'
                        : 'bg-sage/10 text-sage group-hover:bg-sage group-hover:text-white'
                    }`}
                  >
                    {action.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-text-primary">{action.title}</h3>
                    <p className="text-sm text-text-muted">{action.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-text-muted group-hover:text-sage transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Getting Started (shown if Stripe not connected) */}
      {stats && !stats.hasStripeConnected && (
        <Card colorScheme="dark" className="border-2 border-amber-700/30 bg-amber-950/30">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-text-primary">Complete Your Setup</h3>
                <p className="text-sm text-text-muted">
                  Connect Stripe to start accepting payments from customers.
                </p>
              </div>
              <Button variant="sage" asChild>
                <Link href="/tenant/payments">
                  Connect Stripe
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
