/**
 * useCalendarConfigManager Hook
 *
 * Manages calendar configuration state and operations for the tenant dashboard.
 * Extracted from CalendarConfigCard for testability and reusability.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
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
  // Server state
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
  fetchStatus: () => Promise<void>;
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
  // Server state
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Dialog state
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const [calendarId, setCalendarId] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [configErrors, setConfigErrors] = useState<ConfigErrors>({});

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch calendar status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.tenantAdminGetCalendarStatus();

      if (result.status === 200 && result.body) {
        setStatus(result.body);
      } else {
        setError('Failed to fetch calendar status');
      }
    } catch (err) {
      logger.error('Error fetching calendar status:', {
        error: err,
        component: 'useCalendarConfigManager',
      });
      setError('Failed to fetch calendar status');
    } finally {
      setLoading(false);
    }
  }, []);

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

    setSaving(true);
    setError(null);

    try {
      const result = await api.tenantAdminSaveCalendarConfig({
        body: {
          calendarId: calendarId.trim(),
          serviceAccountJson: serviceAccountJson.trim(),
        },
      });

      if (result.status === 200 && result.body?.success) {
        setShowConfigDialog(false);
        await fetchStatus();
      } else {
        const errorBody = result.body as { error?: string } | undefined;
        setError(errorBody?.error || 'Failed to save calendar configuration');
      }
    } catch (err) {
      logger.error('Error saving calendar config:', {
        error: err,
        component: 'useCalendarConfigManager',
      });
      setError('Failed to save calendar configuration');
    } finally {
      setSaving(false);
    }
  }, [calendarId, serviceAccountJson, fetchStatus]);

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
    setDeleting(true);
    setError(null);

    try {
      const result = await api.tenantAdminDeleteCalendarConfig({
        body: undefined,
      });

      if (result.status === 200 && result.body?.success) {
        setShowDeleteDialog(false);
        setTestResult(null);
        await fetchStatus();
      } else {
        setError('Failed to remove calendar configuration');
      }
    } catch (err) {
      logger.error('Error deleting calendar config:', {
        error: err,
        component: 'useCalendarConfigManager',
      });
      setError('Failed to remove calendar configuration');
    } finally {
      setDeleting(false);
    }
  }, [fetchStatus]);

  const clearCalendarIdError = useCallback(() => {
    if (configErrors.calendarId) {
      setConfigErrors((prev) => ({ ...prev, calendarId: undefined }));
    }
  }, [configErrors.calendarId]);

  return {
    // Server state
    status,
    loading,
    error,
    saving,
    testing,
    testResult,
    deleting,

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
    fetchStatus,
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
