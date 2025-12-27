'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Loader2, CreditCard, CheckCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface BillingStatus {
  subscriptionStatus: 'NONE' | 'TRIALING' | 'ACTIVE' | 'EXPIRED';
  trialEndsAt: string | null;
  daysRemaining: number | null;
  stripeCustomerId: string | null;
  plan: string | null;
  pricePerMonth: number | null;
}

/**
 * Billing Page
 *
 * Simple page for tenant subscription management:
 * - Shows current subscription status
 * - Single "Subscribe Now" button for $99/month
 * - Redirects to Stripe Checkout
 */
export default function BillingPage() {
  const searchParams = useSearchParams();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for success/canceled from Stripe redirect
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  useEffect(() => {
    fetchBillingStatus();
  }, []);

  const fetchBillingStatus = async () => {
    try {
      const response = await fetch('/api/tenant-admin/billing/status');
      if (response.ok) {
        const data = await response.json();
        setBillingStatus(data);
      }
    } catch (err) {
      logger.error('Failed to fetch billing status', { error: err });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setIsCheckoutLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tenant-admin/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { checkoutUrl } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout';
      logger.error('Checkout failed', { error: message });
      setError(message);
      setIsCheckoutLoading(false);
    }
  };

  const features = [
    'Unlimited bookings',
    'Custom branding',
    'AI Growth Assistant',
    'Professional storefront',
    'Email notifications',
    'Calendar integrations',
    'Priority support',
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-sage" />
      </div>
    );
  }

  const isActive = billingStatus?.subscriptionStatus === 'ACTIVE';

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">Billing</h1>
        <p className="mt-2 text-text-muted">
          Manage your HANDLED subscription
        </p>
      </div>

      {/* Success message */}
      {success === 'true' && (
        <Alert className="border-green-500/50 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Payment successful! Your subscription is now active.
          </AlertDescription>
        </Alert>
      )}

      {/* Canceled message */}
      {canceled === 'true' && (
        <Alert className="border-amber-500/50 bg-amber-50">
          <AlertDescription className="text-amber-800">
            Checkout was canceled. No charges were made.
          </AlertDescription>
        </Alert>
      )}

      {/* Active Subscription Card */}
      {isActive && (
        <Card className="border-2 border-green-500/30 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Active Subscription
            </CardTitle>
            <CardDescription>
              You&apos;re subscribed to HANDLED Professional
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-text-primary">$99</span>
              <span className="text-text-muted">/month</span>
            </div>
            <p className="mt-4 text-sm text-text-muted">
              Thank you for being a subscriber! You have access to all features.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Subscribe Card (show if not active) */}
      {!isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-sage" />
              HANDLED Professional
            </CardTitle>
            <CardDescription>
              Everything you need to grow your business
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-text-primary">$99</span>
              <span className="text-text-muted">/month</span>
            </div>

            <ul className="space-y-3">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-sage flex-shrink-0" />
                  <span className="text-text-primary">{feature}</span>
                </li>
              ))}
            </ul>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              variant="sage"
              className="w-full"
              onClick={handleSubscribe}
              disabled={isCheckoutLoading}
            >
              {isCheckoutLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting to checkout...
                </>
              ) : (
                'Subscribe Now'
              )}
            </Button>

            <p className="text-center text-xs text-text-muted">
              Secure payment powered by Stripe. Cancel anytime.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Trial Status */}
      {billingStatus?.subscriptionStatus === 'TRIALING' && billingStatus.daysRemaining !== null && (
        <Card className="border-sage/30 bg-sage/5">
          <CardContent className="p-6">
            <p className="text-sage-dark">
              <strong>{billingStatus.daysRemaining} days</strong> remaining in your free trial.
              Subscribe now to keep all your features.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
