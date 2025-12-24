/**
 * DepositSettingsCard Component
 *
 * Allows tenants to configure deposit settings for bookings.
 * - Deposit percentage (0-100%, null = full payment required)
 * - Balance due days (1-90 days before event)
 *
 * Design: Matches landing page aesthetic with sage accents
 */

import {
  DollarSign,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Percent,
  Calendar,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ANIMATION_TRANSITION } from '@/lib/animation-constants';
import { useDepositSettingsManager } from './hooks/useDepositSettingsManager';

export function DepositSettingsCard() {
  const manager = useDepositSettingsManager();

  if (manager.loading) {
    return (
      <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-sage" aria-hidden="true" />
        <p className="text-text-muted mt-3">Loading deposit settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-text-primary">Deposit Settings</h2>
          <p className="text-text-muted text-sm mt-1">
            Configure deposit requirements for bookings
          </p>
        </div>
        <StatusBadge
          status={manager.settings?.depositPercent !== null ? 'Deposits Enabled' : 'Full Payment'}
          variant={manager.settings?.depositPercent !== null ? 'success' : 'neutral'}
        />
      </div>

      {manager.error && (
        <div className="p-4 bg-danger-50 border border-danger-100 rounded-xl flex items-start gap-3">
          <AlertCircle
            className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span className="text-sm text-danger-700">{manager.error}</span>
        </div>
      )}

      {manager.saved && (
        <div className="p-4 bg-sage/10 border border-sage/20 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span className="text-sm text-text-primary">Settings saved successfully</span>
        </div>
      )}

      <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-6 space-y-6">
        {/* Enable Deposits Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="deposits-enabled" className="text-base font-medium">
              Enable Deposits
            </Label>
            <p className="text-sm text-text-muted">
              Require a deposit at checkout, with balance due before the event
            </p>
          </div>
          <Switch
            id="deposits-enabled"
            checked={manager.depositsEnabled}
            onCheckedChange={manager.setDepositsEnabled}
          />
        </div>

        {/* Deposit Settings (shown when enabled) */}
        {manager.depositsEnabled && (
          <div className="space-y-4 pt-4 border-t border-sage-light/10">
            {/* Deposit Percentage */}
            <div className="space-y-2">
              <Label htmlFor="deposit-percent" className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-text-muted" aria-hidden="true" />
                Deposit Percentage
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="deposit-percent"
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={manager.depositPercent}
                  onChange={(e) => manager.setDepositPercent(e.target.value)}
                  className="w-24"
                />
                <span className="text-text-muted">%</span>
              </div>
              <p className="text-xs text-text-muted">
                Customers pay this percentage at checkout (e.g., 50% = half now, half later)
              </p>
            </div>

            {/* Balance Due Days */}
            <div className="space-y-2">
              <Label htmlFor="balance-due-days" className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-text-muted" aria-hidden="true" />
                Balance Due
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="balance-due-days"
                  type="number"
                  min="1"
                  max="90"
                  value={manager.balanceDueDays}
                  onChange={(e) => manager.setBalanceDueDays(e.target.value)}
                  className="w-24"
                />
                <span className="text-text-muted">days before event</span>
              </div>
              <p className="text-xs text-text-muted">
                Customers receive a payment link this many days before their event
              </p>
            </div>

            {/* Example Calculation */}
            <div className="p-4 bg-sage/5 border border-sage/20 rounded-xl">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-sage mt-0.5" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-medium text-text-primary">Example</p>
                  <p className="text-text-muted mt-1">
                    For a $1,000 booking with {manager.depositPercent}% deposit and{' '}
                    {manager.balanceDueDays} days balance due:
                  </p>
                  <ul className="mt-2 space-y-1 text-text-muted">
                    <li>
                      • At checkout:{' '}
                      <span className="font-medium text-text-primary">
                        ${((parseFloat(manager.depositPercent) / 100) * 1000).toFixed(0)} deposit
                      </span>
                    </li>
                    <li>
                      • {manager.balanceDueDays} days before event:{' '}
                      <span className="font-medium text-text-primary">
                        ${(1000 - (parseFloat(manager.depositPercent) / 100) * 1000).toFixed(0)}{' '}
                        balance
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full Payment Info (shown when deposits disabled) */}
        {!manager.depositsEnabled && (
          <div className="p-4 bg-sage/5 border border-sage/20 rounded-xl">
            <div className="flex items-start gap-2">
              <DollarSign className="w-4 h-4 text-sage mt-0.5" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-medium text-text-primary">Full Payment Required</p>
                <p className="text-text-muted mt-1">
                  Customers pay the full amount at checkout. Enable deposits to split payments.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={manager.handleSave}
          disabled={manager.saving || !manager.hasChanges()}
          className={`bg-sage hover:bg-sage-hover text-white rounded-full px-6 h-11 shadow-soft hover:shadow-medium ${ANIMATION_TRANSITION.HOVER}`}
        >
          {manager.saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
