'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-client';
import { HandledLogo } from '@/components/ui/handled-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  Loader2,
  Check,
  ArrowRight,
  Globe,
  MessageSquare,
  Calendar,
  Sparkles,
} from 'lucide-react';

// =============================================================================
// Payment Page (Onboarding Step 1)
// =============================================================================

/**
 * Onboarding Payment Page
 *
 * Shows the membership value prop and initiates Stripe Checkout.
 * After payment, Stripe webhook advances tenant to PENDING_INTAKE
 * and redirects here with session_id → we redirect to /onboarding/intake.
 */
function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: sessionLoading } = useAuth();

  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelled = searchParams.get('cancelled') === 'true';

  // Check onboarding state on mount — redirect if not PENDING_PAYMENT
  useEffect(() => {
    if (sessionLoading) return;

    if (!isAuthenticated) {
      router.push('/signup');
      return;
    }

    // Check onboarding state from backend
    const checkState = async () => {
      try {
        const res = await fetch('/api/tenant-admin/onboarding/state');
        if (!res.ok) return; // Fail silently — page still works

        const data = await res.json();
        if (data.redirectTo && data.redirectTo !== '/onboarding/payment') {
          router.push(data.redirectTo);
        }
      } catch {
        // Fail silently — if state check fails, show the payment page
      }
    };

    checkState();
  }, [isAuthenticated, sessionLoading, router]);

  const handleCheckout = async () => {
    setIsRedirecting(true);
    setError(null);

    try {
      const res = await fetch('/api/tenant-admin/onboarding/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Could not start checkout');
      }

      const data = await res.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsRedirecting(false);
    }
  };

  if (sessionLoading) {
    return <PaymentSkeleton />;
  }

  const features = [
    {
      icon: Globe,
      title: 'Done-for-you website',
      description: 'AI-built storefront tailored to your business',
    },
    {
      icon: Calendar,
      title: 'Online booking',
      description: 'Clients book and pay directly — no back and forth',
    },
    {
      icon: MessageSquare,
      title: 'AI receptionist',
      description: 'Answers inquiries and books appointments 24/7',
    },
    {
      icon: Sparkles,
      title: 'Project management',
      description: 'Client portal, task tracking, and communication hub',
    },
  ];

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Logo */}
      <div className="mb-8 flex justify-center">
        <HandledLogo variant="dark" size="lg" href="/" />
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-sage" />
          <span className="text-xs text-sage font-medium">Account</span>
        </div>
        <div className="w-8 h-px bg-neutral-600" />
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-sage ring-2 ring-sage/30" />
          <span className="text-xs text-text-primary font-medium">Membership</span>
        </div>
        <div className="w-8 h-px bg-neutral-700" />
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
          <span className="text-xs text-text-muted">Setup</span>
        </div>
      </div>

      {/* Headline */}
      <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary text-center mb-3 leading-[1.15]">
        One membership. Everything handled.
      </h1>
      <p className="text-text-muted text-center mb-8 leading-relaxed">
        Your website, booking, and client management — built and maintained for you.
      </p>

      {/* Cancelled alert */}
      {cancelled && (
        <Alert variant="destructive" className="mb-6" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>Payment cancelled. Ready when you are.</AlertDescription>
        </Alert>
      )}

      {/* Error alert */}
      {error && (
        <Alert variant="destructive" className="mb-6" role="alert" aria-live="polite">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Pricing card */}
      <Card className="bg-surface-alt border border-neutral-800 rounded-3xl overflow-hidden">
        <CardContent className="pt-6">
          {/* Features */}
          <div className="space-y-4 mb-8">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-sage/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-sage" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{title}</p>
                  <p className="text-xs text-text-muted">{description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Included list */}
          <div className="border-t border-neutral-800 pt-4 mb-6">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
              Also included
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                'Custom domain',
                'Stripe payments',
                'Email notifications',
                'Google Calendar sync',
                'Client portal',
                'Analytics dashboard',
              ].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-sage flex-shrink-0" aria-hidden="true" />
                  <span className="text-xs text-text-muted">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Button
            variant="sage"
            className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl hover:shadow-sage/20 transition-all duration-300"
            disabled={isRedirecting}
            onClick={handleCheckout}
          >
            {isRedirecting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Redirecting to checkout...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Start my 14-day trial
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
          </Button>

          <p className="text-xs text-text-muted text-center mt-3">Cancel anytime. No contracts.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function PaymentSkeleton() {
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="mb-8 text-center">
        <div className="h-9 w-32 mx-auto animate-pulse rounded bg-neutral-700" />
      </div>
      <div className="flex justify-center gap-2 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full animate-pulse bg-neutral-700" />
            <div className="w-16 h-3 animate-pulse rounded bg-neutral-700" />
          </div>
        ))}
      </div>
      <div className="text-center mb-8">
        <div className="h-10 w-80 mx-auto animate-pulse rounded bg-neutral-700 mb-3" />
        <div className="h-5 w-96 mx-auto animate-pulse rounded bg-neutral-700" />
      </div>
      <div className="bg-surface-alt border border-neutral-800 rounded-3xl p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl animate-pulse bg-neutral-700" />
              <div className="flex-1">
                <div className="h-4 w-32 animate-pulse rounded bg-neutral-700 mb-1" />
                <div className="h-3 w-48 animate-pulse rounded bg-neutral-700" />
              </div>
            </div>
          ))}
          <div className="h-12 animate-pulse rounded-full bg-sage/30 mt-6" />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Page Component
// =============================================================================

export default function OnboardingPaymentPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <Suspense fallback={<PaymentSkeleton />}>
        <PaymentContent />
      </Suspense>
    </div>
  );
}
