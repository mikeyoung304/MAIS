'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
// Signup Form Component (Simplified — email + password only)
// =============================================================================

/**
 * Signup Form Component
 *
 * Onboarding redesign (2026-02-20): Only email + password at signup.
 * Business details collected later during the conversational intake form.
 * After signup, redirects to /onboarding/payment for Stripe checkout.
 */
function SignupForm() {
  const router = useRouter();
  const { isAuthenticated, role, isLoading: sessionLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && role && !sessionLoading) {
      if (role === 'PLATFORM_ADMIN') {
        router.push('/admin/dashboard');
      } else if (role === 'TENANT_ADMIN') {
        // Authenticated tenants go to onboarding state check
        router.push('/onboarding/payment');
      }
    }
  }, [isAuthenticated, role, sessionLoading, router]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

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

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Signup failed');
      }

      const data = await response.json();

      // Create NextAuth session with the token from signup
      await loginWithToken({
        token: data.token,
        email: data.email,
        role: 'TENANT_ADMIN',
        tenantId: data.tenantId,
        slug: data.slug,
      });

      // Redirect to payment step (first step of onboarding)
      window.location.href = '/onboarding/payment';
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred during signup. Please try again.');
      }
      setIsLoading(false);
    }
  };

  const inputStyles =
    'bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:border-sage focus:ring-2 focus:ring-sage/30 focus:outline-none hover:border-neutral-300 transition-all duration-200';
  const inputErrorStyles = 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20';

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo */}
      <div className="mb-8 flex justify-center">
        <HandledLogo variant="dark" size="lg" href="/" />
      </div>

      {/* Trial Badge */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-2 bg-sage/15 text-sage text-sm font-medium px-4 py-2 rounded-full border border-sage/30">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          14-day free trial
        </div>
      </div>

      {/* Headline */}
      <h1
        id="signup-heading"
        className="font-serif text-3xl sm:text-4xl font-bold text-text-primary text-center mb-3 leading-[1.15]"
      >
        Bring your passion.
      </h1>

      <p className="text-text-muted text-center mb-8 leading-relaxed">
        The rest is handled. Try free for 14 days.
      </p>

      {/* Card */}
      <Card className="bg-surface-alt border border-neutral-800 rounded-3xl">
        <CardContent className="pt-6">
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            aria-labelledby="signup-heading"
            aria-busy={isLoading}
          >
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

            {/* Password */}
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

            {/* CTA */}
            <Button
              type="submit"
              variant="sage"
              className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl hover:shadow-sage/20 transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Setting up your account...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Get Handled
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </Button>

            <p className="text-sm text-text-muted text-center mt-4">
              Two minutes to sign up. We&apos;ll handle the rest.
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

function SignupFormSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8 text-center">
        <div className="h-9 w-32 mx-auto animate-pulse rounded bg-neutral-700" />
      </div>
      <div className="flex justify-center mb-6">
        <div className="h-9 w-52 animate-pulse rounded-full bg-neutral-700" />
      </div>
      <div className="text-center mb-8">
        <div className="h-10 w-64 mx-auto animate-pulse rounded bg-neutral-700 mb-3" />
        <div className="h-5 w-80 mx-auto animate-pulse rounded bg-neutral-700" />
      </div>
      <div className="bg-surface-alt border border-neutral-800 rounded-3xl p-6">
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-neutral-700" />
              <div className="h-12 animate-pulse rounded-lg bg-neutral-700" />
              {i === 2 && <div className="h-4 w-28 animate-pulse rounded bg-neutral-700" />}
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

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Suspense fallback={<SignupFormSkeleton />}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
