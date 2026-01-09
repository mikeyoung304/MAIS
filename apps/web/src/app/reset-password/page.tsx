'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { HandledLogo } from '@/components/ui/handled-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Lock, CheckCircle, ArrowLeft } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Loading skeleton for reset password form
 */
function ResetPasswordSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="font-serif text-3xl font-bold text-text-primary">HANDLED</div>
          <p className="mt-2 text-text-muted">Loading...</p>
        </div>
        <Card colorScheme="dark">
          <CardContent className="pt-8 pb-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-sage" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Reset Password Page
 *
 * Allows users to set a new password using a reset token from email.
 * Wrapped in Suspense for useSearchParams compatibility with Next.js 14.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

/**
 * Reset Password Form Component
 *
 * Handles the actual form logic with access to searchParams.
 */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  /**
   * Validate password requirements
   */
  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    return null;
  };

  /**
   * Submit new password
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate token exists
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.');
      return;
    }

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 400) {
          throw new Error(
            data.message ||
              'Invalid or expired reset token. Please request a new password reset link.'
          );
        }
        throw new Error(data.message || 'Failed to reset password');
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // Missing token state
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link href="/" className="font-serif text-3xl font-bold text-text-primary">
              HANDLED
            </Link>
          </div>

          <Card colorScheme="dark">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-950/50">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
              <h2 className="mb-2 font-serif text-2xl font-bold text-text-primary">
                Invalid Reset Link
              </h2>
              <p className="mb-6 text-text-muted">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <div className="flex flex-col gap-3">
                <Button variant="sage" asChild className="w-full">
                  <Link href="/forgot-password">Request New Link</Link>
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/login">Back to Login</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link href="/" className="font-serif text-3xl font-bold text-text-primary">
              HANDLED
            </Link>
          </div>

          <Card colorScheme="dark">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sage/10">
                <CheckCircle className="h-8 w-8 text-sage" />
              </div>
              <h2 className="mb-2 font-serif text-2xl font-bold text-text-primary">
                Password Reset Complete
              </h2>
              <p className="mb-6 text-text-muted">
                Your password has been successfully reset. You can now sign in with your new
                password.
              </p>
              <Button variant="sage" asChild className="w-full">
                <Link href="/login">Sign In</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        {/* Back to login */}
        <Link
          href="/login"
          className="mb-8 inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <HandledLogo variant="dark" size="lg" href="/" />
          <p className="mt-3 text-text-muted">Create a new password</p>
        </div>

        <Card colorScheme="dark">
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
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
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>
                <p className="text-xs text-text-muted">Minimum 8 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>
              </div>

              <Button type="submit" variant="sage" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-text-muted">
              Remember your password?{' '}
              <Link href="/login" className="text-sage hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
