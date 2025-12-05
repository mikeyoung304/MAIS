/**
 * useDepositSettingsManager Hook
 *
 * Manages deposit settings state and operations for the tenant dashboard.
 * Extracted from DepositSettingsCard for testability and reusability.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';

export interface DepositSettings {
  depositPercent: number | null;
  balanceDueDays: number;
}

export interface UseDepositSettingsManagerResult {
  // Server state
  settings: DepositSettings | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saved: boolean;

  // Form state
  depositsEnabled: boolean;
  depositPercent: string;
  balanceDueDays: string;

  // Actions
  setDepositsEnabled: (enabled: boolean) => void;
  setDepositPercent: (percent: string) => void;
  setBalanceDueDays: (days: string) => void;
  handleSave: () => Promise<void>;
  hasChanges: () => boolean;
}

export function useDepositSettingsManager(): UseDepositSettingsManagerResult {
  const [settings, setSettings] = useState<DepositSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable state
  const [depositsEnabled, setDepositsEnabled] = useState(false);
  const [depositPercent, setDepositPercent] = useState('50');
  const [balanceDueDays, setBalanceDueDays] = useState('30');

  // Ref to track saved indicator timeout for cleanup
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  // Fetch deposit settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.tenantAdminGetDepositSettings();

      if (result.status === 200 && result.body) {
        const data = result.body;
        setSettings(data);

        // Set editable state
        setDepositsEnabled(data.depositPercent !== null);
        setDepositPercent(data.depositPercent?.toString() || '50');
        setBalanceDueDays(data.balanceDueDays.toString());
      } else {
        setError('Failed to fetch deposit settings');
      }
    } catch (err) {
      logger.error('Error fetching deposit settings:', {
        error: err,
        component: 'useDepositSettingsManager',
      });
      setError('Failed to fetch deposit settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const percentNum = depositsEnabled ? parseFloat(depositPercent) : null;
      const daysNum = parseInt(balanceDueDays, 10);

      // Validate
      if (depositsEnabled && (isNaN(percentNum!) || percentNum! < 0 || percentNum! > 100)) {
        setError('Deposit percentage must be between 0 and 100');
        setSaving(false);
        return;
      }

      if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
        setError('Balance due days must be between 1 and 90');
        setSaving(false);
        return;
      }

      const result = await api.tenantAdminUpdateDepositSettings({
        body: {
          depositPercent: percentNum,
          balanceDueDays: daysNum,
        },
      });

      if (result.status === 200 && result.body) {
        setSettings(result.body);
        setSaved(true);

        // Clear saved indicator after 3 seconds (with cleanup on unmount)
        if (savedTimeoutRef.current) {
          clearTimeout(savedTimeoutRef.current);
        }
        savedTimeoutRef.current = setTimeout(() => setSaved(false), 3000);
      } else {
        const errorBody = result.body as { error?: string } | undefined;
        setError(errorBody?.error || 'Failed to save deposit settings');
      }
    } catch (err) {
      logger.error('Error saving deposit settings:', {
        error: err,
        component: 'useDepositSettingsManager',
      });
      setError('Failed to save deposit settings');
    } finally {
      setSaving(false);
    }
  }, [depositsEnabled, depositPercent, balanceDueDays]);

  const hasChanges = useCallback(() => {
    if (!settings) return false;

    const currentEnabled = settings.depositPercent !== null;
    const currentPercent = settings.depositPercent?.toString() || '50';
    const currentDays = settings.balanceDueDays.toString();

    return (
      depositsEnabled !== currentEnabled ||
      (depositsEnabled && depositPercent !== currentPercent) ||
      balanceDueDays !== currentDays
    );
  }, [settings, depositsEnabled, depositPercent, balanceDueDays]);

  return {
    // Server state
    settings,
    loading,
    error,
    saving,
    saved,

    // Form state
    depositsEnabled,
    depositPercent,
    balanceDueDays,

    // Actions
    setDepositsEnabled,
    setDepositPercent,
    setBalanceDueDays,
    handleSave,
    hasChanges,
  };
}
