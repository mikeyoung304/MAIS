'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { login, useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

/**
 * Login Form Component
 *
 * Separated to allow Suspense boundary for useSearchParams
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, role, isLoading: sessionLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get callback URL from query params
  const callbackUrl = searchParams.get('callbackUrl');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !sessionLoading) {
      const redirectUrl = callbackUrl || (role === 'PLATFORM_ADMIN' ? '/admin/dashboard' : '/tenant/dashboard');
      router.push(redirectUrl);
    }
  }, [isAuthenticated, sessionLoading, callbackUrl, role, router]);

  // Show loading while checking session
  if (sessionLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
        </CardContent>
      </Card>
    );
  }

  // Don't render form if authenticated (redirect is happening)
  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);

      // After successful login, session will update and useEffect will redirect
      // Force a page refresh to ensure session is picked up
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>
          Enter your credentials to access your dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-sage hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            variant="sage"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-sage hover:underline">
            Get started
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading fallback for login form
 */
function LoginFormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-32 animate-pulse rounded bg-neutral-200" />
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-neutral-200" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-12 animate-pulse rounded bg-neutral-200" />
          <div className="h-11 animate-pulse rounded bg-neutral-200" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-16 animate-pulse rounded bg-neutral-200" />
          <div className="h-11 animate-pulse rounded bg-neutral-200" />
        </div>
        <div className="h-11 animate-pulse rounded bg-neutral-200" />
      </CardContent>
    </Card>
  );
}

/**
 * Login Page
 *
 * Handles authentication for both tenant and platform admins.
 * Redirects to callback URL or appropriate dashboard after login.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="font-serif text-3xl font-bold text-text-primary">
            MAIS
          </Link>
          <p className="mt-2 text-text-muted">Sign in to your account</p>
        </div>

        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>

        <p className="mt-8 text-center text-xs text-text-muted">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="underline hover:no-underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:no-underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
