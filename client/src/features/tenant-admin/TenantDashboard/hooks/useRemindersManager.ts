/**
 * useRemindersManager Hook
 *
 * Manages booking reminder state and operations for the tenant dashboard.
 * Extracted from RemindersCard for testability and reusability.
 *
 * Uses React Query for optimized caching and instant tab switching.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

export interface UpcomingReminder {
  bookingId: string;
  coupleName: string;
  eventDate: string;
  reminderDueDate: string;
  daysUntilEvent: number;
}

export interface ReminderStatus {
  pendingCount: number;
  upcomingReminders: UpcomingReminder[];
}

export interface ProcessResult {
  processed: number;
  failed: number;
}

export interface UseRemindersManagerResult {
  // State (from React Query)
  status: ReminderStatus | null;
  loading: boolean;
  error: string | null;
  processing: boolean;
  processResult: ProcessResult | null;

  // Actions
  fetchStatus: () => void;
  handleProcessReminders: () => Promise<void>;
  formatDate: (dateStr: string) => string;
}

export function useRemindersManager(): UseRemindersManagerResult {
  const queryClient = useQueryClient();

  // React Query for reminder status
  const {
    data: status = null,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.tenantAdmin.reminderStatus,
    queryFn: async () => {
      const result = await api.tenantAdminGetReminderStatus();
      if (result.status === 200 && result.body) {
        return result.body;
      }
      throw new Error('Failed to fetch reminder status');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Local state for mutations and UI
  const [error, setError] = useState<string | null>(null);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);

  // Mutation for processing reminders
  const processRemindersMutation = useMutation({
    mutationFn: async () => {
      const result = await api.tenantAdminProcessReminders({
        body: undefined,
      });
      if (result.status === 200 && result.body) {
        return result.body;
      }
      throw new Error('Failed to process reminders');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantAdmin.reminderStatus });
      setProcessResult(data);
      setError(null);
    },
    onError: (err: Error) => {
      logger.error('Error processing reminders:', {
        error: err,
        component: 'useRemindersManager',
      });
      setError(err.message);
    },
  });

  const fetchStatus = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleProcessReminders = useCallback(async () => {
    setError(null);
    setProcessResult(null);
    await processRemindersMutation.mutateAsync();
  }, [processRemindersMutation]);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  return {
    // State (from React Query)
    status,
    loading,
    error: error || (queryError ? String(queryError) : null),
    processing: processRemindersMutation.isPending,
    processResult,

    // Actions
    fetchStatus,
    handleProcessReminders,
    formatDate,
  };
}
