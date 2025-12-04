/**
 * StripeConnectCard Component
 *
 * Displays Stripe Connect account status and handles onboarding flow
 * for tenant administrators to set up payment processing.
 *
 * Design: Matches landing page aesthetic with sage accents
 */

import { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { ANIMATION_TRANSITION } from '@/lib/animation-constants';

/**
 * Validates that a URL is a legitimate Stripe domain
 * Defense-in-depth against open redirect attacks
 */
const validateStripeUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.stripe.com') || parsed.hostname === 'stripe.com';
  } catch {
    return false;
  }
};

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

export function StripeConnectCard() {
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [onboarding, setOnboarding] = useState(false);

  // Onboarding dialog state
  const [showOnboardingDialog, setShowOnboardingDialog] = useState(false);
  const [dialogEmail, setDialogEmail] = useState('');
  const [dialogBusinessName, setDialogBusinessName] = useState('');
  const [dialogErrors, setDialogErrors] = useState<{ email?: string; businessName?: string }>({});

  // Fetch Stripe Connect status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.tenantAdminGetStripeStatus();

      if (result.status === 200 && result.body) {
        setStatus(result.body);
      } else if (result.status === 404) {
        // No account exists yet - this is expected
        setStatus(null);
      } else {
        setError('Failed to fetch Stripe status');
      }
    } catch (err) {
      logger.error('Error fetching Stripe status:', { error: err, component: 'StripeConnectCard' });
      setError('Failed to fetch Stripe status');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Validates email format
   */
  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  /**
   * Validates business name - alphanumeric + common business chars
   */
  const validateBusinessName = (name: string): boolean => {
    return /^[a-zA-Z0-9\s\-&.,()]+$/.test(name) && name.length >= 2 && name.length <= 100;
  };

  /**
   * Opens the onboarding dialog
   */
  const handleOpenOnboardingDialog = () => {
    setDialogEmail('');
    setDialogBusinessName('');
    setDialogErrors({});
    setShowOnboardingDialog(true);
  };

  /**
   * Handles dialog form submission with validation
   */
  const handleDialogSubmit = async () => {
    const errors: { email?: string; businessName?: string } = {};

    if (!validateEmail(dialogEmail)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!validateBusinessName(dialogBusinessName)) {
      errors.businessName =
        'Business name must be 2-100 characters (letters, numbers, spaces, and common punctuation)';
    }

    if (Object.keys(errors).length > 0) {
      setDialogErrors(errors);
      return;
    }

    setShowOnboardingDialog(false);
    await handleCreateAccount(dialogEmail, dialogBusinessName);
  };

  const handleCreateAccount = async (email: string, businessName: string) => {
    setCreating(true);
    setError(null);

    try {
      const result = await api.tenantAdminCreateStripeAccount({
        body: {
          email,
          businessName,
          country: 'US',
        },
      });

      if (result.status === 201) {
        // Account created, now fetch status
        await fetchStatus();
        // Automatically start onboarding
        await handleOnboard();
      } else if (result.status === 409) {
        setError('Stripe account already exists');
        await fetchStatus();
      } else {
        setError('Failed to create Stripe account');
      }
    } catch (err) {
      logger.error('Error creating Stripe account:', {
        error: err,
        component: 'StripeConnectCard',
      });
      setError('Failed to create Stripe account');
    } finally {
      setCreating(false);
    }
  };

  const handleOnboard = async () => {
    setOnboarding(true);
    setError(null);

    try {
      const baseUrl = window.location.origin;
      const refreshUrl = `${baseUrl}/tenant-admin`;
      const returnUrl = `${baseUrl}/tenant-admin?stripe_onboarding=complete`;

      const result = await api.tenantAdminGetStripeOnboardingLink({
        body: {
          refreshUrl,
          returnUrl,
        },
      });

      if (result.status === 200 && result.body?.url) {
        // Validate URL is from Stripe before redirecting (defense-in-depth)
        if (!validateStripeUrl(result.body.url)) {
          logger.error('Invalid Stripe URL received', {
            url: result.body.url,
            component: 'StripeConnectCard',
          });
          setError('Invalid redirect URL from server');
          return;
        }
        // Redirect to Stripe onboarding
        window.location.href = result.body.url;
      } else if (result.status === 404) {
        setError('No Stripe account found. Create one first.');
      } else {
        setError('Failed to generate onboarding link');
      }
    } catch (err) {
      logger.error('Error generating onboarding link:', {
        error: err,
        component: 'StripeConnectCard',
      });
      setError('Failed to generate onboarding link');
    } finally {
      setOnboarding(false);
    }
  };

  const handleOpenDashboard = async () => {
    try {
      const result = await api.tenantAdminGetStripeDashboardLink({
        body: undefined,
      });

      if (result.status === 200 && result.body?.url) {
        // Validate URL is from Stripe before opening (defense-in-depth)
        if (!validateStripeUrl(result.body.url)) {
          logger.error('Invalid Stripe dashboard URL received', {
            url: result.body.url,
            component: 'StripeConnectCard',
          });
          setError('Invalid dashboard URL from server');
          return;
        }
        // Open Stripe dashboard in new tab
        window.open(result.body.url, '_blank');
      } else {
        setError('Failed to generate dashboard link');
      }
    } catch (err) {
      logger.error('Error generating dashboard link:', {
        error: err,
        component: 'StripeConnectCard',
      });
      setError('Failed to generate dashboard link');
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-sage" aria-hidden="true" />
        <p className="text-text-muted mt-3">Loading payment status...</p>
      </div>
    );
  }

  // No account exists
  if (!status) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-text-primary">Payment Processing</h2>
            <p className="text-text-muted text-sm mt-1">Connect Stripe to accept payments</p>
          </div>
        </div>

        <EmptyState
          icon={CreditCard}
          title="Connect your Stripe account"
          description="Start accepting payments from customers. Stripe handles all the complex payment processing securely."
          action={
            <>
              {error && (
                <div className="p-4 bg-danger-50 border border-danger-100 rounded-xl flex items-start gap-3 mb-4">
                  <AlertCircle
                    className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-danger-700">{error}</span>
                </div>
              )}
              <Button
                onClick={handleOpenOnboardingDialog}
                disabled={creating}
                className={`bg-sage hover:bg-sage-hover text-white rounded-full px-8 h-12 shadow-soft hover:shadow-medium ${ANIMATION_TRANSITION.HOVER} group`}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Connect Stripe
                    <ArrowUpRight
                      className={`w-4 h-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${ANIMATION_TRANSITION.TRANSFORM}`}
                      aria-hidden="true"
                    />
                  </>
                )}
              </Button>
            </>
          }
        />

        {/* Onboarding Dialog */}
        <Dialog open={showOnboardingDialog} onOpenChange={setShowOnboardingDialog}>
          <DialogContent maxWidth="md">
            <DialogHeader>
              <DialogTitle>Set Up Stripe Connect</DialogTitle>
              <DialogDescription>
                Enter your business details to create your Stripe Connect account for payment
                processing.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-4">
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
                    className={dialogErrors.email ? 'border-danger-500' : ''}
                    aria-invalid={!!dialogErrors.email}
                    aria-describedby={dialogErrors.email ? 'stripe-email-error' : undefined}
                  />
                  {dialogErrors.email && (
                    <p id="stripe-email-error" className="text-sm text-danger-600">
                      {dialogErrors.email}
                    </p>
                  )}
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
                    className={dialogErrors.businessName ? 'border-danger-500' : ''}
                    aria-invalid={!!dialogErrors.businessName}
                    aria-describedby={
                      dialogErrors.businessName ? 'stripe-business-name-error' : undefined
                    }
                  />
                  {dialogErrors.businessName && (
                    <p id="stripe-business-name-error" className="text-sm text-danger-600">
                      {dialogErrors.businessName}
                    </p>
                  )}
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowOnboardingDialog(false)}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDialogSubmit}
                disabled={!dialogEmail || !dialogBusinessName}
                className="bg-sage hover:bg-sage-hover text-white rounded-full"
              >
                Continue to Stripe
                <ArrowUpRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Account exists - show status
  const isFullyOnboarded =
    status.chargesEnabled && status.payoutsEnabled && status.detailsSubmitted;
  const hasRequirements =
    status.requirements.currentlyDue.length > 0 || status.requirements.pastDue.length > 0;

  const StatusItem = ({ label, enabled }: { label: string; enabled: boolean }) => (
    <div className="flex items-center justify-between py-3 border-b border-sage-light/10 last:border-0">
      <span className="text-text-muted">{label}</span>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          enabled ? 'bg-sage/10' : 'bg-warning-100'
        }`}
      >
        {enabled ? (
          <Check className="w-4 h-4 text-sage" aria-hidden="true" />
        ) : (
          <X className="w-4 h-4 text-warning-600" aria-hidden="true" />
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-text-primary">Payment Processing</h2>
          <p className="text-text-muted text-sm mt-1">
            {isFullyOnboarded ? 'Stripe is connected and ready' : 'Complete your Stripe setup'}
          </p>
        </div>
        {isFullyOnboarded && (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-sage" aria-hidden="true" />
            <StatusBadge status="Connected" />
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-100 rounded-xl flex items-start gap-3">
          <AlertCircle
            className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span className="text-sm text-danger-700">{error}</span>
        </div>
      )}

      <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-6">
        {/* Account ID */}
        <div className="flex items-center justify-between pb-4 border-b border-sage-light/10">
          <span className="text-text-muted text-sm">Account ID</span>
          <code className="text-xs bg-white px-3 py-1.5 rounded-lg font-mono text-text-primary border border-sage-light/20">
            {status.accountId}
          </code>
        </div>

        {/* Status Items */}
        <div className="mt-2">
          <StatusItem label="Charges Enabled" enabled={status.chargesEnabled} />
          <StatusItem label="Payouts Enabled" enabled={status.payoutsEnabled} />
          <StatusItem label="Details Submitted" enabled={status.detailsSubmitted} />
        </div>
      </div>

      {/* Requirements Warning */}
      {hasRequirements && (
        <div className="p-5 bg-warning-50 border border-warning-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-warning-600" aria-hidden="true" />
            </div>
            <div>
              <h4 className="font-medium text-warning-900 mb-1">Action Required</h4>
              {status.requirements.pastDue.length > 0 && (
                <p className="text-sm text-warning-700 mb-1">
                  <strong>Past Due:</strong> {status.requirements.pastDue.join(', ')}
                </p>
              )}
              {status.requirements.currentlyDue.length > 0 && (
                <p className="text-sm text-warning-700">
                  <strong>Currently Due:</strong> {status.requirements.currentlyDue.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!isFullyOnboarded && (
          <Button
            onClick={handleOnboard}
            disabled={onboarding}
            className={`flex-1 bg-sage hover:bg-sage-hover text-white rounded-full h-11 shadow-soft hover:shadow-medium ${ANIMATION_TRANSITION.HOVER}`}
          >
            {onboarding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Loading...
              </>
            ) : (
              <>
                Complete Setup
                <ArrowUpRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </>
            )}
          </Button>
        )}

        <Button
          onClick={handleOpenDashboard}
          variant="ghost"
          className={`text-text-muted hover:text-sage hover:bg-sage/10 rounded-full h-11 ${!isFullyOnboarded ? '' : 'flex-1'}`}
        >
          <ArrowUpRight className="w-4 h-4 mr-2" aria-hidden="true" />
          Open Stripe Dashboard
        </Button>
      </div>
    </div>
  );
}
