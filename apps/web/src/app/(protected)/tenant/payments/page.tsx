'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  Check,
  X,
} from 'lucide-react';

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

/**
 * Validates that a URL is a legitimate Stripe domain
 */
const validateStripeUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.stripe.com') || parsed.hostname === 'stripe.com';
  } catch {
    return false;
  }
};

/**
 * Tenant Payments Page
 *
 * Displays Stripe Connect status and handles onboarding flow.
 */
export default function TenantPaymentsPage() {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);

  // Onboarding dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [dialogEmail, setDialogEmail] = useState('');
  const [dialogBusinessName, setDialogBusinessName] = useState('');
  const [dialogErrors, setDialogErrors] = useState<{ email?: string; businessName?: string }>({});

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tenant-admin/stripe/status');

      if (response.ok) {
        setStatus(await response.json());
      } else if (response.status === 404) {
        setStatus(null);
      } else {
        setError('Failed to fetch Stripe status');
      }
    } catch (err) {
      setError('Failed to fetch Stripe status');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCreateAccount = async () => {
    const errors: { email?: string; businessName?: string } = {};

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dialogEmail)) {
      errors.email = 'Please enter a valid email address';
    }

    if (dialogBusinessName.length < 2 || dialogBusinessName.length > 100) {
      errors.businessName = 'Business name must be 2-100 characters';
    }

    if (Object.keys(errors).length > 0) {
      setDialogErrors(errors);
      return;
    }

    setShowDialog(false);
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/tenant-admin/stripe/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: dialogEmail,
          businessName: dialogBusinessName,
          country: 'US',
        }),
      });

      if (response.ok || response.status === 201) {
        await fetchStatus();
        await handleOnboard();
      } else if (response.status === 409) {
        setError('Stripe account already exists');
        await fetchStatus();
      } else {
        setError('Failed to create Stripe account');
      }
    } catch (err) {
      setError('Failed to create Stripe account');
    } finally {
      setIsCreating(false);
    }
  };

  const handleOnboard = async () => {
    setIsOnboarding(true);
    setError(null);

    try {
      const baseUrl = window.location.origin;
      const response = await fetch('/api/tenant-admin/stripe/onboard-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshUrl: `${baseUrl}/tenant/payments`,
          returnUrl: `${baseUrl}/tenant/payments?stripe_onboarding=complete`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.url && validateStripeUrl(data.url)) {
          window.location.href = data.url;
        } else {
          setError('Invalid redirect URL from server');
        }
      } else {
        setError('Failed to generate onboarding link');
      }
    } catch (err) {
      setError('Failed to generate onboarding link');
    } finally {
      setIsOnboarding(false);
    }
  };

  const handleOpenDashboard = async () => {
    try {
      const response = await fetch('/api/tenant-admin/stripe/dashboard-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.url && validateStripeUrl(data.url)) {
          window.open(data.url, '_blank');
        } else {
          setError('Invalid dashboard URL from server');
        }
      } else {
        setError('Failed to generate dashboard link');
      }
    } catch (err) {
      setError('Failed to generate dashboard link');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Payments</h1>
          <p className="mt-2 text-text-muted">Manage your payment processing</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
        </div>
      </div>
    );
  }

  // No Stripe account
  if (!status) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Payments</h1>
          <p className="mt-2 text-text-muted">Connect Stripe to accept payments</p>
        </div>

        {error && (
          <Card colorScheme="dark" className="border-red-800 bg-red-950/50">
            <CardContent className="flex items-center gap-3 p-6">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        <Card colorScheme="dark" className="border-2 border-dashed border-sage/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-sage/10 p-4">
              <CreditCard className="h-8 w-8 text-sage" />
            </div>
            <h3 className="mb-2 font-semibold text-text-primary">Connect your Stripe account</h3>
            <p className="mb-6 max-w-sm text-sm text-text-muted">
              Start accepting payments from customers. Stripe handles all the complex payment
              processing securely.
            </p>
            <Button
              variant="sage"
              className="rounded-full"
              onClick={() => setShowDialog(true)}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Connect Stripe
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Onboarding Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Up Stripe Connect</DialogTitle>
              <DialogDescription>
                Enter your business details to create your Stripe Connect account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="stripe-email">Business Email</Label>
                <Input
                  id="stripe-email"
                  type="email"
                  placeholder="you@yourbusiness.com"
                  value={dialogEmail}
                  onChange={(e) => {
                    setDialogEmail(e.target.value);
                    if (dialogErrors.email) {
                      setDialogErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  className={dialogErrors.email ? 'border-red-500' : ''}
                />
                {dialogErrors.email && <p className="text-sm text-red-600">{dialogErrors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stripe-business-name">Business Name</Label>
                <Input
                  id="stripe-business-name"
                  type="text"
                  placeholder="Your Business Name"
                  value={dialogBusinessName}
                  onChange={(e) => {
                    setDialogBusinessName(e.target.value);
                    if (dialogErrors.businessName) {
                      setDialogErrors((prev) => ({ ...prev, businessName: undefined }));
                    }
                  }}
                  className={dialogErrors.businessName ? 'border-red-500' : ''}
                />
                {dialogErrors.businessName && (
                  <p className="text-sm text-red-600">{dialogErrors.businessName}</p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="sage"
                onClick={handleCreateAccount}
                disabled={!dialogEmail || !dialogBusinessName}
                className="flex-1"
              >
                Continue to Stripe
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Stripe account exists
  const isFullyOnboarded =
    status.chargesEnabled && status.payoutsEnabled && status.detailsSubmitted;
  const hasRequirements =
    status.requirements.currentlyDue.length > 0 || status.requirements.pastDue.length > 0;

  const StatusItem = ({ label, enabled }: { label: string; enabled: boolean }) => (
    <div className="flex items-center justify-between py-3 border-b border-neutral-700 last:border-0">
      <span className="text-text-muted">{label}</span>
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full ${
          enabled ? 'bg-sage/10' : 'bg-amber-950/50'
        }`}
      >
        {enabled ? (
          <Check className="h-4 w-4 text-sage" />
        ) : (
          <X className="h-4 w-4 text-amber-400" />
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Payments</h1>
          <p className="mt-2 text-text-muted">
            {isFullyOnboarded ? 'Stripe is connected and ready' : 'Complete your Stripe setup'}
          </p>
        </div>
        {isFullyOnboarded && (
          <div className="flex items-center gap-2 rounded-full bg-sage/10 px-3 py-1">
            <CheckCircle className="h-4 w-4 text-sage" />
            <span className="text-sm font-medium text-sage">Connected</span>
          </div>
        )}
      </div>

      {error && (
        <Card colorScheme="dark" className="border-red-800 bg-red-950/50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card colorScheme="dark">
        <CardContent className="p-6">
          {/* Account ID */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-700">
            <span className="text-sm text-text-muted">Account ID</span>
            <code className="rounded-lg border border-neutral-700 bg-surface px-3 py-1.5 font-mono text-xs text-text-primary">
              {status.accountId}
            </code>
          </div>

          {/* Status Items */}
          <div className="mt-2">
            <StatusItem label="Charges Enabled" enabled={status.chargesEnabled} />
            <StatusItem label="Payouts Enabled" enabled={status.payoutsEnabled} />
            <StatusItem label="Details Submitted" enabled={status.detailsSubmitted} />
          </div>
        </CardContent>
      </Card>

      {/* Requirements Warning */}
      {hasRequirements && (
        <Card colorScheme="dark" className="border-amber-800 bg-amber-950/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-900/50">
                <AlertCircle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h4 className="font-medium text-amber-300">Action Required</h4>
                {status.requirements.pastDue.length > 0 && (
                  <p className="mt-1 text-sm text-amber-400">
                    <strong>Past Due:</strong> {status.requirements.pastDue.join(', ')}
                  </p>
                )}
                {status.requirements.currentlyDue.length > 0 && (
                  <p className="mt-1 text-sm text-amber-400">
                    <strong>Currently Due:</strong> {status.requirements.currentlyDue.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!isFullyOnboarded && (
          <Button
            variant="sage"
            className="flex-1 rounded-full"
            onClick={handleOnboard}
            disabled={isOnboarding}
          >
            {isOnboarding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Complete Setup
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}

        <Button
          variant="outline"
          onClick={handleOpenDashboard}
          className={`rounded-full ${isFullyOnboarded ? 'flex-1' : ''}`}
        >
          <ArrowUpRight className="mr-2 h-4 w-4" />
          Open Stripe Dashboard
        </Button>
      </div>
    </div>
  );
}
