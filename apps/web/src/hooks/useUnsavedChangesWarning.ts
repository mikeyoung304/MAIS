'use client';

/**
 * useUnsavedChangesWarning - Warn users before leaving with unsaved changes
 *
 * Handles:
 * - Browser beforeunload event (refresh, close tab)
 * - Next.js router navigation
 *
 * Usage:
 * ```tsx
 * useUnsavedChangesWarning(isDirty);
 * ```
 */

import { useEffect } from 'react';

export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    // Handle browser beforeunload (refresh, close tab, navigate away)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
}
