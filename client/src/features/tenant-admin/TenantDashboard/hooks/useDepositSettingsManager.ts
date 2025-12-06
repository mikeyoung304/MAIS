/**
 * useDepositSettingsManager Hook
 *
 * Manages deposit settings state and operations for the tenant dashboard.
 * Extracted from DepositSettingsCard for testability and reusability.
 *
 * Uses React Query for optimized caching and instant tab switching.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
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
  const queryClient = useQueryClient();

  // React Query for deposit settings
  const {
    data: settings = null,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.tenantAdmin.depositSettings,
    queryFn: async () => {
      const result = await api.tenantAdminGetDepositSettings();
      if (result.status === 200 && result.body) {
        return result.body;
      }
      throw new Error('Failed to fetch deposit settings');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Local state for mutations and UI
  const [error, setError] = useState<string | null>(null);
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

  // Sync editable state when settings are loaded
  useEffect(() => {
    if (settings) {
      setDepositsEnabled(settings.depositPercent !== null);
      setDepositPercent(settings.depositPercent?.toString() || '50');
      setBalanceDueDays(settings.balanceDueDays.toString());
    }
  }, [settings]);

  // Mutation for saving deposit settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: { depositPercent: number | null; balanceDueDays: number }) => {
      const result = await api.tenantAdminUpdateDepositSettings({
        body: data,
      });
      if (result.status === 200 && result.body) {
        return result.body;
      }
      const errorBody = result.body as { error?: string } | undefined;
      throw new Error(errorBody?.error || 'Failed to save deposit settings');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantAdmin.depositSettings });
      setSaved(true);
      setError(null);

      // Clear saved indicator after 3 seconds
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: Error) => {
      logger.error('Error saving deposit settings:', {
        error: err,
        component: 'useDepositSettingsManager',
      });
      setError(err.message);
    },
  });

  const handleSave = useCallback(async () => {
    setError(null);
    setSaved(false);

    const percentNum = depositsEnabled ? parseFloat(depositPercent) : null;
    const daysNum = parseInt(balanceDueDays, 10);

    // Validate
    if (depositsEnabled && (isNaN(percentNum!) || percentNum! < 0 || percentNum! > 100)) {
      setError('Deposit percentage must be between 0 and 100');
      return;
    }

    if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
      setError('Balance due days must be between 1 and 90');
      return;
    }

    await saveSettingsMutation.mutateAsync({
      depositPercent: percentNum,
      balanceDueDays: daysNum,
    });
  }, [depositsEnabled, depositPercent, balanceDueDays, saveSettingsMutation]);

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
    // Server state (from React Query)
    settings,
    loading,
    error: error || (queryError ? String(queryError) : null),
    saving: saveSettingsMutation.isPending,
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
