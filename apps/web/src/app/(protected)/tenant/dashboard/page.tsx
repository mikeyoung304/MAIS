'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DashboardStats {
  packagesCount: number;
  bookingsCount: number;
  blackoutsCount: number;
  hasStripeConnected: boolean;
}

/**
 * Tenant Dashboard Page
 *
 * Main dashboard for tenant admins showing:
 * - Quick stats overview
 * - Quick action buttons
 * - Recent activity (future)
 */
export default function TenantDashboardPage() {
  const { backendToken, tenantId, user, slug: authSlug } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [slug, setSlug] = useState<string | null>(authSlug || null);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!backendToken) return;

      try {
        // Fetch tenant info to get slug (if not already available from session)
        if (!authSlug) {
          const infoResponse = await fetch(`${API_BASE_URL}/v1/tenant-admin/info`, {
            headers: {
              Authorization: `Bearer ${backendToken}`,
            },
          });

          if (infoResponse.ok) {
            const info = await infoResponse.json();
            setSlug(info.slug);
          }
        }

        // Fetch packages count
        const packagesResponse = await fetch(`${API_BASE_URL}/v1/tenant-admin/packages`, {
          headers: {
            Authorization: `Bearer ${backendToken}`,
          },
        });

        // Fetch bookings count
        const bookingsResponse = await fetch(`${API_BASE_URL}/v1/tenant-admin/bookings`, {
          headers: {
            Authorization: `Bearer ${backendToken}`,
          },
        });

        // Fetch blackouts count
        const blackoutsResponse = await fetch(`${API_BASE_URL}/v1/tenant-admin/blackouts`, {
          headers: {
            Authorization: `Bearer ${backendToken}`,
          },
        });

        // Fetch Stripe status
        const stripeResponse = await fetch(`${API_BASE_URL}/v1/tenant-admin/stripe/status`, {
          headers: {
            Authorization: `Bearer ${backendToken}`,
          },
        });

        const packages = packagesResponse.ok ? await packagesResponse.json() : [];
        const bookings = bookingsResponse.ok ? await bookingsResponse.json() : [];
        const blackouts = blackoutsResponse.ok ? await blackoutsResponse.json() : [];
        const stripeStatus = stripeResponse.ok ? await stripeResponse.json() : null;

        setStats({
          packagesCount: Array.isArray(packages) ? packages.length : 0,
          bookingsCount: Array.isArray(bookings) ? bookings.length : 0,
          blackoutsCount: Array.isArray(blackouts) ? blackouts.length : 0,
          hasStripeConnected: stripeStatus?.chargesEnabled || false,
        });
      } catch (error) {
        // Silently fail - stats will show 0
        setStats({
          packagesCount: 0,
          bookingsCount: 0,
          blackoutsCount: 0,
          hasStripeConnected: false,
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, [backendToken, tenantId, authSlug]);

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
      href: '/tenant/bookings',
      color: 'text-macon-teal',
    },
    {
      title: 'Blackout Dates',
      value: stats?.blackoutsCount ?? 0,
      icon: <Users className="h-5 w-5" />,
      href: '/tenant/blackouts',
      color: 'text-macon-orange',
    },
    {
      title: 'Payments',
      value: stats?.hasStripeConnected ? 'Connected' : 'Setup',
      icon: <DollarSign className="h-5 w-5" />,
      href: '/tenant/payments',
      color: stats?.hasStripeConnected ? 'text-green-600' : 'text-macon-orange',
    },
  ];

  const quickActions = [
    {
      title: 'Edit Landing Page',
      description: 'Customize your public storefront',
      href: '/tenant/landing-page',
      icon: <FileEdit className="h-5 w-5" />,
    },
    {
      title: 'Branding Settings',
      description: 'Update colors, logo, and fonts',
      href: '/tenant/branding',
      icon: <Palette className="h-5 w-5" />,
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
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">
          Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="mt-2 text-text-muted">
          Here&apos;s an overview of your business.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-text-muted">
                  {card.title}
                </CardTitle>
                <div className={card.color}>{card.icon}</div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-text-primary">
                  {isLoading ? (
                    <div className="h-8 w-16 animate-pulse rounded bg-neutral-200" />
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
        <h2 className="font-serif text-xl font-bold text-text-primary mb-4">
          Quick Actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              target={action.external ? '_blank' : undefined}
              rel={action.external ? 'noopener noreferrer' : undefined}
            >
              <Card className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer group">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="rounded-xl bg-sage/10 p-3 text-sage group-hover:bg-sage group-hover:text-white transition-colors">
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
        <Card className="border-2 border-macon-orange/20 bg-macon-orange/5">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-text-primary">
                  Complete Your Setup
                </h3>
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
