/**
 * useCalendarConfigManager Hook
 *
 * Manages calendar configuration state and operations for the tenant dashboard.
 * Extracted from CalendarConfigCard for testability and reusability.
 *
 * Uses React Query for optimized caching and instant tab switching.
 */

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

export interface CalendarStatus {
  configured: boolean;
  calendarId: string | null;
}

export interface TestResult {
  success: boolean;
  calendarId?: string;
  calendarName?: string;
  error?: string;
}

export interface ConfigErrors {
  calendarId?: string;
  serviceAccountJson?: string;
}

export interface UseCalendarConfigManagerResult {
  // Server state (from React Query)
  status: CalendarStatus | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  testing: boolean;
  testResult: TestResult | null;
  deleting: boolean;

  // Dialog state
  showConfigDialog: boolean;
  showDeleteDialog: boolean;

  // Form state
  calendarId: string;
  serviceAccountJson: string;
  configErrors: ConfigErrors;

  // File input ref
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Actions
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleOpenConfigDialog: () => void;
  handleCloseConfigDialog: () => void;
  handleSaveConfig: () => Promise<void>;
  handleTestConnection: () => Promise<void>;
  handleOpenDeleteDialog: () => void;
  handleCloseDeleteDialog: () => void;
  handleDeleteConfig: () => Promise<void>;
  setCalendarId: (id: string) => void;
  clearCalendarIdError: () => void;
}

const MAX_FILE_SIZE = 50 * 1024; // 50KB

export function useCalendarConfigManager(): UseCalendarConfigManagerResult {
  const queryClient = useQueryClient();

  // React Query for calendar status
  const {
    data: status = null,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.tenantAdmin.calendarStatus,
    queryFn: async () => {
      const result = await api.tenantAdminGetCalendarStatus();
      if (result.status === 200 && result.body) {
        return result.body;
      }
      throw new Error('Failed to fetch calendar status');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Local state for mutations and UI
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Dialog state
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const [calendarId, setCalendarId] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [configErrors, setConfigErrors] = useState<ConfigErrors>({});

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutation for saving calendar config
  const saveConfigMutation = useMutation({
    mutationFn: async (data: { calendarId: string; serviceAccountJson: string }) => {
      const result = await api.tenantAdminSaveCalendarConfig({
        body: data,
      });
      if (result.status === 200 && result.body?.success) {
        return result.body;
      }
      const errorBody = result.body as { error?: string } | undefined;
      throw new Error(errorBody?.error || 'Failed to save calendar configuration');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantAdmin.calendarStatus });
      setShowConfigDialog(false);
      setError(null);
    },
    onError: (err: Error) => {
      logger.error('Error saving calendar config:', {
        error: err,
        component: 'useCalendarConfigManager',
      });
      setError(err.message);
    },
  });

  // Mutation for deleting calendar config
  const deleteConfigMutation = useMutation({
    mutationFn: async () => {
      const result = await api.tenantAdminDeleteCalendarConfig({
        body: undefined,
      });
      if (result.status === 200 && result.body?.success) {
        return result.body;
      }
      throw new Error('Failed to remove calendar configuration');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantAdmin.calendarStatus });
      setShowDeleteDialog(false);
      setTestResult(null);
      setError(null);
    },
    onError: (err: Error) => {
      logger.error('Error deleting calendar config:', {
        error: err,
        component: 'useCalendarConfigManager',
      });
      setError(err.message);
    },
  });

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setConfigErrors((prev) => ({
        ...prev,
        serviceAccountJson: 'File too large. Service account JSON should be under 50KB.',
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        // Validate it's valid JSON
        JSON.parse(content);
        setServiceAccountJson(content);
        setConfigErrors((prev) => ({ ...prev, serviceAccountJson: undefined }));
      } catch {
        setConfigErrors((prev) => ({
          ...prev,
          serviceAccountJson: 'Invalid JSON file',
        }));
      }
    };
    reader.readAsText(file);
  }, []);

  const handleOpenConfigDialog = useCallback(() => {
    setCalendarId('');
    setServiceAccountJson('');
    setConfigErrors({});
    setShowConfigDialog(true);
  }, []);

  const handleCloseConfigDialog = useCallback(() => {
    setShowConfigDialog(false);
  }, []);

  const handleSaveConfig = useCallback(async () => {
    const errors: ConfigErrors = {};

    if (!calendarId.trim()) {
      errors.calendarId = 'Calendar ID is required';
    }

    if (!serviceAccountJson.trim()) {
      errors.serviceAccountJson = 'Service account JSON is required';
    } else {
      try {
        JSON.parse(serviceAccountJson);
      } catch {
        errors.serviceAccountJson = 'Invalid JSON format';
      }
    }

    if (Object.keys(errors).length > 0) {
      setConfigErrors(errors);
      return;
    }

    setError(null);
    await saveConfigMutation.mutateAsync({
      calendarId: calendarId.trim(),
      serviceAccountJson: serviceAccountJson.trim(),
    });
  }, [calendarId, serviceAccountJson, saveConfigMutation]);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await api.tenantAdminTestCalendar({
        body: undefined,
      });

      if (result.status === 200 && result.body) {
        setTestResult(result.body);
      } else {
        setTestResult({ success: false, error: 'Failed to test connection' });
      }
    } catch (err) {
      logger.error('Error testing calendar connection:', {
        error: err,
        component: 'useCalendarConfigManager',
      });
      setTestResult({ success: false, error: 'Failed to test connection' });
    } finally {
      setTesting(false);
    }
  }, []);

  const handleOpenDeleteDialog = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false);
  }, []);

  const handleDeleteConfig = useCallback(async () => {
    setError(null);
    await deleteConfigMutation.mutateAsync();
  }, [deleteConfigMutation]);

  const clearCalendarIdError = useCallback(() => {
    if (configErrors.calendarId) {
      setConfigErrors((prev) => ({ ...prev, calendarId: undefined }));
    }
  }, [configErrors.calendarId]);

  return {
    // Server state (from React Query)
    status,
    loading,
    error: error || (queryError ? String(queryError) : null),
    saving: saveConfigMutation.isPending,
    testing,
    testResult,
    deleting: deleteConfigMutation.isPending,

    // Dialog state
    showConfigDialog,
    showDeleteDialog,

    // Form state
    calendarId,
    serviceAccountJson,
    configErrors,

    // File input ref
    fileInputRef,

    // Actions
    handleFileUpload,
    handleOpenConfigDialog,
    handleCloseConfigDialog,
    handleSaveConfig,
    handleTestConnection,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeleteConfig,
    setCalendarId,
    clearCalendarIdError,
  };
}
