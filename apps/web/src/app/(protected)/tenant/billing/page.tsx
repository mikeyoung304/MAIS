'use client';

/**
 * Billing Page (Tiered Pricing)
 *
 * Displays subscription tiers and AI usage:
 * - FREE: Trial tier (50 AI messages)
 * - STARTER: $49/month (500 AI messages)
 * - PRO: $150/month (5000 AI messages)
 */

import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Loader2, CreditCard, CheckCircle, Sparkles, Zap } from 'lucide-react';
import { useSubscription, type SubscriptionTier } from '@/hooks';
import { AIUsageDisplay } from '@/components/billing/AIUsageDisplay';
import { cn } from '@/lib/utils';

interface TierInfo {
  name: string;
  tier: SubscriptionTier;
  price: number;
  aiMessages: number;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
}

const TIERS: TierInfo[] = [
  {
    name: 'Starter',
    tier: 'STARTER',
    price: 49,
    aiMessages: 500,
    description: 'Perfect for getting started',
    features: [
      '500 AI messages/month',
      'Professional storefront',
      'Email notifications',
      'Custom branding',
      'Calendar sync',
    ],
    cta: 'Get Starter',
  },
  {
    name: 'Growth',
    tier: 'PRO',
    price: 150,
    aiMessages: 5000,
    description: 'For busy professionals',
    features: [
      '5,000 AI messages/month',
      'Everything in Starter',
      'Priority support',
      'Advanced analytics',
      'Custom domain',
    ],
    cta: 'Get Growth',
    popular: true,
  },
];

export default function BillingPage() {
  const searchParams = useSearchParams();
  const {
    tier,
    status,
    daysRemaining,
    usage,
    isLoading,
    upgrade,
    isUpgrading,
    error: hookError,
  } = useSubscription();

  // Check for success/canceled from Stripe redirect
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-sage" />
      </div>
    );
  }

  const isActive = status === 'ACTIVE';
  const isTrialing = status === 'TRIALING';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">Billing</h1>
        <p className="mt-2 text-text-muted">Manage your subscription and AI usage</p>
      </div>

      {/* Success message */}
      {success === 'true' && (
        <Alert className="border-green-800 bg-green-950/50">
          <CheckCircle className="h-4 w-4 text-green-400" />
          <AlertDescription className="text-green-400">
            Payment successful! Your subscription is now active.
          </AlertDescription>
        </Alert>
      )}

      {/* Canceled message */}
      {canceled === 'true' && (
        <Alert className="border-amber-800 bg-amber-950/50">
          <AlertDescription className="text-amber-400">
            Checkout was canceled. No charges were made.
          </AlertDescription>
        </Alert>
      )}

      {/* AI Usage Card */}
      {usage && (
        <Card colorScheme="dark">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-sage" />
              AI Usage This Month
            </CardTitle>
            <CardDescription>Your chatbot assistant usage</CardDescription>
          </CardHeader>
          <CardContent>
            <AIUsageDisplay
              used={usage.used}
              limit={usage.limit}
              remaining={usage.remaining}
              showUpgradePrompt={tier === 'FREE' || tier === 'STARTER'}
              onUpgrade={() => upgrade(tier === 'FREE' ? 'STARTER' : 'PRO')}
            />
          </CardContent>
        </Card>
      )}

      {/* Current Plan Status */}
      {isActive && (
        <Card colorScheme="dark" className="border-2 border-green-700 bg-green-950/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              Active: {tier === 'STARTER' ? 'Starter' : 'Growth'} Plan
            </CardTitle>
            <CardDescription>
              Your subscription is active. To upgrade, select a higher tier below.
              <br />
              <span className="text-xs mt-1 block">
                To cancel or make changes, email us at support@gethandled.ai
              </span>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Trial Status */}
      {isTrialing && daysRemaining !== null && (
        <Card colorScheme="dark" className="border-sage/30 bg-sage/10">
          <CardContent className="p-6">
            <p className="text-sage">
              <strong>{daysRemaining} days</strong> remaining in your free trial. Subscribe now to
              keep all your features.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pricing Tiers */}
      <div>
        <h2 className="font-serif text-2xl font-bold text-text-primary mb-6">
          {isActive ? 'Upgrade Your Plan' : 'Choose Your Plan'}
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {TIERS.map((tierInfo) => {
            const isCurrent = tier === tierInfo.tier;
            const canUpgrade =
              !isCurrent && (tier === 'FREE' || (tier === 'STARTER' && tierInfo.tier === 'PRO'));

            return (
              <Card
                key={tierInfo.tier}
                colorScheme="dark"
                className={cn(
                  'relative transition-all',
                  tierInfo.popular && 'border-sage ring-1 ring-sage',
                  isCurrent && 'border-green-700 bg-green-950/30'
                )}
              >
                {tierInfo.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-sage rounded-full text-xs font-medium text-white">
                    Most Popular
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-600 rounded-full text-xs font-medium text-white flex items-center gap-1">
                    <Check className="h-3 w-3" /> Current Plan
                  </div>
                )}
                <CardHeader className="pt-6">
                  <CardTitle className="flex items-center gap-2">
                    {tierInfo.tier === 'PRO' ? (
                      <Zap className="h-5 w-5 text-sage" />
                    ) : (
                      <CreditCard className="h-5 w-5 text-sage" />
                    )}
                    {tierInfo.name}
                  </CardTitle>
                  <CardDescription>{tierInfo.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-text-primary">${tierInfo.price}</span>
                    <span className="text-text-muted">/month</span>
                  </div>

                  <ul className="space-y-3">
                    {tierInfo.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-sage flex-shrink-0" />
                        <span className="text-text-primary text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {hookError && canUpgrade && (
                    <p className="text-sm text-destructive">{hookError}</p>
                  )}

                  {canUpgrade ? (
                    <Button
                      variant="sage"
                      className="w-full"
                      onClick={() => upgrade(tierInfo.tier as 'STARTER' | 'PRO')}
                      disabled={isUpgrading}
                    >
                      {isUpgrading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecting...
                        </>
                      ) : (
                        tierInfo.cta
                      )}
                    </Button>
                  ) : isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Downgrade not available
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <p className="text-center text-xs text-text-muted">
        Secure payment powered by Stripe. To cancel, email support@gethandled.ai
      </p>
    </div>
  );
}
