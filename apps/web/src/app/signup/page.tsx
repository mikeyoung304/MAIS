'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, loginWithToken } from '@/lib/auth-client';
import { HandledLogo } from '@/components/ui/handled-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  Loader2,
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  ArrowRight,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// =============================================================================
// Type-Safe Tier Content System
// =============================================================================

const SIGNUP_TIERS = ['handled', 'fully-handled'] as const;
type SignupTier = (typeof SIGNUP_TIERS)[number];

function isValidTier(tier: string | null): tier is SignupTier {
  return tier !== null && tier !== '' && (SIGNUP_TIERS as readonly string[]).includes(tier);
}

interface TierContent {
  title: string;
  subtitle: string;
  cta: string;
  loadingCta: string;
}

const TIER_CONTENT: Record<SignupTier | 'default', TierContent> = {
  handled: {
    title: "Let's build your storefront.",
    subtitle: 'Done-for-you website + booking. Try free for 14 days.',
    cta: 'Start my storefront',
    loadingCta: 'Setting up your storefront...',
  },
  'fully-handled': {
    title: "Let's get you more clients.",
    subtitle: 'AI chatbot + auto-responder. One booking pays for itself.',
    cta: 'Start growing',
    loadingCta: 'Preparing your growth system...',
  },
  default: {
    title: 'Bring your passion.',
    subtitle: 'The rest is handled. Try free for 14 days.',
    cta: 'Get Handled',
    loadingCta: 'Setting up your storefront...',
  },
};

function getTierContent(tier: string | null): TierContent {
  if (isValidTier(tier)) {
    return TIER_CONTENT[tier];
  }
  return TIER_CONTENT.default;
}

// =============================================================================
// Signup Form Component
// =============================================================================

/**
 * Signup Form Component
 *
 * Handles tenant registration with tier-aware copy, validation, and error handling.
 * Uses NextAuth.js for session management after signup.
 */
function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, role, isLoading: sessionLoading } = useAuth();

  // Get tier from URL params for tier-aware content
  const rawTier = searchParams.get('tier');
  const content = getTierContent(rawTier);

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // TODO: Phase 0 - Add analytics tracking
  // useEffect(() => {
  //   trackEvent('signup_page_view', { tier: rawTier || 'none' });
  // }, [rawTier]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && role && !sessionLoading) {
      if (role === 'PLATFORM_ADMIN') {
        router.push('/admin/dashboard');
      } else if (role === 'TENANT_ADMIN') {
        router.push('/tenant/build');
      }
    }
  }, [isAuthenticated, role, sessionLoading, router]);

  /**
   * Validate form before submission
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Business name validation
    if (!businessName) {
      errors.businessName = 'Business name is required';
    } else if (businessName.length < 2) {
      errors.businessName = 'Business name must be at least 2 characters';
    } else if (businessName.length > 100) {
      errors.businessName = 'Business name must be less than 100 characters';
    }

    // Email validation
    if (!email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // TODO: Phase 0 - Track submit attempt
    // trackEvent('signup_submit_attempt', { tier: rawTier || 'none' });

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Use raw fetch() instead of ts-rest client because:
      // 1. The signup endpoint is public (no authentication required)
      // 2. It doesn't follow the authenticated ts-rest contract pattern
      // 3. The response includes a JWT token for immediate session creation
      const response = await fetch(`${API_BASE_URL}/v1/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, businessName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Signup failed');
      }

      const data = await response.json();

      // TODO: Phase 0 - Track success
      // trackEvent('signup_success', { tier: rawTier || 'none', tenantId: data.tenantId });

      // Create NextAuth session with the token from signup
      await loginWithToken({
        token: data.token,
        email: data.email,
        role: 'TENANT_ADMIN',
        tenantId: data.tenantId,
        slug: data.slug,
      });

      // Use window.location for hard redirect to Build Mode
      // This ensures clean navigation after session creation
      window.location.href = '/tenant/build';
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred during signup. Please try again.');
      }
      setIsLoading(false);
    }
  };

  // Light inputs on dark card - maximum contrast, premium feel
  // Uses default Input component styles (bg-white) with sage focus ring
  const inputStyles =
    'bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:border-sage focus:ring-2 focus:ring-sage/30 focus:outline-none hover:border-neutral-300 transition-all duration-200';
  const inputErrorStyles = 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20';

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo */}
      <div className="mb-8 flex justify-center">
        <HandledLogo variant="dark" size="lg" href="/" />
      </div>

      {/* Trial Badge - with border for pop */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-2 bg-sage/15 text-sage text-sm font-medium px-4 py-2 rounded-full border border-sage/30">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          14-day free trial
        </div>
      </div>

      {/* Tier Title - PRIMARY hierarchy, OUTSIDE card */}
      <h1
        id="signup-heading"
        className="font-serif text-3xl sm:text-4xl font-bold text-text-primary text-center mb-3 leading-[1.15]"
      >
        {content.title}
      </h1>

      {/* Tier Subtitle - SECONDARY hierarchy */}
      <p className="text-text-muted text-center mb-8 leading-relaxed">{content.subtitle}</p>

      {/* Card - Form only, reduced header */}
      <Card className="bg-surface-alt border border-neutral-800 rounded-3xl">
        <CardContent className="pt-6">
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            aria-labelledby="signup-heading"
            aria-busy={isLoading}
          >
            {/* Screen reader loading announcement */}
            {isLoading && (
              <span className="sr-only" aria-live="polite">
                Creating your account, please wait.
              </span>
            )}

            {error && (
              <Alert variant="destructive" role="alert" aria-live="polite">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-text-primary">
                Business Name
              </Label>
              <div className="relative">
                <Building2
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
                  aria-hidden="true"
                />
                <Input
                  id="businessName"
                  type="text"
                  placeholder="Your Business Name"
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    if (fieldErrors.businessName) {
                      setFieldErrors((prev) => ({ ...prev, businessName: '' }));
                    }
                  }}
                  className={`pl-10 ${inputStyles} ${fieldErrors.businessName ? inputErrorStyles : ''}`}
                  required
                  autoComplete="organization"
                  disabled={isLoading}
                  maxLength={100}
                  aria-invalid={!!fieldErrors.businessName}
                  aria-describedby={fieldErrors.businessName ? 'businessName-error' : undefined}
                />
              </div>
              {fieldErrors.businessName && (
                <p id="businessName-error" className="text-sm text-danger-500" role="alert">
                  {fieldErrors.businessName}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-text-primary">
                Email
              </Label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
                  aria-hidden="true"
                />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: '' }));
                    }
                  }}
                  className={`pl-10 ${inputStyles} ${fieldErrors.email ? inputErrorStyles : ''}`}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                />
              </div>
              {fieldErrors.email && (
                <p id="email-error" className="text-sm text-danger-500" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password with inline validation hint */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-text-primary">
                Password
              </Label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: '' }));
                    }
                  }}
                  className={`pl-10 pr-12 ${inputStyles} ${fieldErrors.password ? inputErrorStyles : ''}`}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'password-error' : 'password-hint'}
                />
                {/* Password toggle with 44px touch target - uses pr-1 to keep within input bounds */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none focus:ring-2 focus:ring-sage/50 rounded"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {/* Inline validation hint */}
              {!fieldErrors.password && (
                <p id="password-hint" className="text-xs text-text-muted flex items-center gap-1">
                  {password.length >= 8 ? (
                    <>
                      <Check className="w-3 h-3 text-sage" aria-hidden="true" />
                      <span className="text-sage">8+ characters</span>
                    </>
                  ) : (
                    <span>Min 8 characters</span>
                  )}
                </p>
              )}
              {fieldErrors.password && (
                <p id="password-error" className="text-sm text-danger-500" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* CTA Button with ArrowRight */}
            <Button
              type="submit"
              variant="sage"
              className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl hover:shadow-sage/20 transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  {content.loadingCta}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {content.cta}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </Button>

            {/* What's next copy */}
            <p className="text-sm text-text-muted text-center mt-4">
              You&apos;ll set up your storefront next. Takes about 5 minutes.
            </p>
          </form>

          <div className="mt-6 text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-sage hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>

      <p className="mt-8 text-center text-xs text-text-muted">
        By signing up, you agree to our{' '}
        <Link href="/terms" className="underline hover:no-underline">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline hover:no-underline">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

/**
 * Loading fallback for signup form - dark mode compatible
 */
function SignupFormSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo skeleton */}
      <div className="mb-8 text-center">
        <div className="h-9 w-32 mx-auto animate-pulse rounded bg-neutral-700" />
      </div>

      {/* Badge skeleton */}
      <div className="flex justify-center mb-6">
        <div className="h-9 w-52 animate-pulse rounded-full bg-neutral-700" />
      </div>

      {/* Title + subtitle skeleton */}
      <div className="text-center mb-8">
        <div className="h-10 w-64 mx-auto animate-pulse rounded bg-neutral-700 mb-3" />
        <div className="h-5 w-80 mx-auto animate-pulse rounded bg-neutral-700" />
      </div>

      {/* Card skeleton */}
      <div className="bg-surface-alt border border-neutral-800 rounded-3xl p-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-neutral-700" />
              <div className="h-12 animate-pulse rounded-lg bg-neutral-700" />
              {/* Password hint skeleton - reserves space to prevent CLS */}
              {i === 3 && <div className="h-4 w-28 animate-pulse rounded bg-neutral-700" />}
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

/**
 * Signup Page
 *
 * Allows new businesses to sign up for the HANDLED platform.
 * Supports tier-aware content via ?tier=handled or ?tier=fully-handled URL params.
 */
export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Suspense fallback={<SignupFormSkeleton />}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
