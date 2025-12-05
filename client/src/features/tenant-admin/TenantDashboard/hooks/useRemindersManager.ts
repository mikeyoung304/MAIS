/**
 * useRemindersManager Hook
 *
 * Manages booking reminder state and operations for the tenant dashboard.
 * Extracted from RemindersCard for testability and reusability.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
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
  // State
  status: ReminderStatus | null;
  loading: boolean;
  error: string | null;
  processing: boolean;
  processResult: ProcessResult | null;

  // Actions
  fetchStatus: () => Promise<void>;
  handleProcessReminders: () => Promise<void>;
  formatDate: (dateStr: string) => string;
}

export function useRemindersManager(): UseRemindersManagerResult {
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);

  // Fetch reminder status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.tenantAdminGetReminderStatus();

      if (result.status === 200 && result.body) {
        setStatus(result.body);
      } else {
        setError('Failed to fetch reminder status');
      }
    } catch (err) {
      logger.error('Error fetching reminder status:', { error: err, component: 'useRemindersManager' });
      setError('Failed to fetch reminder status');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleProcessReminders = useCallback(async () => {
    setProcessing(true);
    setError(null);
    setProcessResult(null);

    try {
      const result = await api.tenantAdminProcessReminders({
        body: undefined,
      });

      if (result.status === 200 && result.body) {
        setProcessResult(result.body);
        // Refresh status after processing
        await fetchStatus();
      } else {
        setError('Failed to process reminders');
      }
    } catch (err) {
      logger.error('Error processing reminders:', { error: err, component: 'useRemindersManager' });
      setError('Failed to process reminders');
    } finally {
      setProcessing(false);
    }
  }, [fetchStatus]);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  return {
    // State
    status,
    loading,
    error,
    processing,
    processResult,

    // Actions
    fetchStatus,
    handleProcessReminders,
    formatDate,
  };
}
