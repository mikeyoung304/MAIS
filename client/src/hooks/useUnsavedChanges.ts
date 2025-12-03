import { useEffect, useCallback, useRef } from "react";
import { useBlocker } from "react-router-dom";

interface UseUnsavedChangesOptions {
  /**
   * Whether the form has unsaved changes (dirty state)
   */
  isDirty: boolean;

  /**
   * Message to show in confirmation dialog
   * @default "You have unsaved changes. Are you sure you want to leave?"
   */
  message?: string;

  /**
   * Whether to enable the warning
   * @default true
   */
  enabled?: boolean;

  /**
   * Optional custom confirm function (for testing or custom dialogs)
   * @default browser's confirm dialog
   */
  confirmFn?: (message: string) => Promise<boolean>;
}

/**
 * useUnsavedChanges Hook
 *
 * Prevents accidental navigation away from forms with unsaved changes.
 * Shows warning dialog when user tries to:
 * - Navigate to another route (React Router)
 * - Close browser tab/window
 * - Refresh page
 *
 * @example
 * ```tsx
 * function MyForm() {
 *   const [formData, setFormData] = useState(initialData);
 *   const [savedData, setSavedData] = useState(initialData);
 *   const { confirm } = useConfirmDialog();
 *
 *   const isDirty = JSON.stringify(formData) !== JSON.stringify(savedData);
 *
 *   useUnsavedChanges({
 *     isDirty,
 *     message: "You have unsaved changes. Leave anyway?",
 *     confirmFn: (msg) => confirm({
 *       title: "Unsaved Changes",
 *       description: msg,
 *       variant: "destructive"
 *     })
 *   });
 *
 *   return <form>...</form>;
 * }
 * ```
 */
export function useUnsavedChanges({
  isDirty,
  message = "You have unsaved changes. Are you sure you want to leave?",
  enabled = true,
  confirmFn,
}: UseUnsavedChangesOptions) {
  const messageRef = useRef(message);
  const confirmFnRef = useRef(confirmFn);

  // Update refs when they change
  useEffect(() => {
    messageRef.current = message;
    confirmFnRef.current = confirmFn;
  }, [message, confirmFn]);

  /**
   * Block navigation with React Router when form is dirty
   */
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => {
        // Only block if:
        // 1. Feature is enabled
        // 2. Form has unsaved changes
        // 3. User is navigating to a different route
        return enabled && isDirty && currentLocation.pathname !== nextLocation.pathname;
      },
      [enabled, isDirty]
    )
  );

  /**
   * Show confirmation dialog when blocker is triggered
   */
  useEffect(() => {
    if (blocker.state === "blocked") {
      const handleConfirm = async () => {
        let shouldProceed: boolean;

        if (confirmFnRef.current) {
          // Use custom confirm function (e.g., ConfirmDialog)
          shouldProceed = await confirmFnRef.current(messageRef.current);
        } else {
          // Fallback to browser confirm (deprecated, but kept for backwards compatibility)
          shouldProceed = window.confirm(messageRef.current);
        }

        if (shouldProceed) {
          blocker.proceed();
        } else {
          blocker.reset();
        }
      };

      handleConfirm();
    }
  }, [blocker]);

  /**
   * Warn on browser close/refresh (beforeunload event)
   */
  useEffect(() => {
    if (!enabled || !isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Modern browsers ignore custom message and show their own
      event.preventDefault();
      // Chrome requires returnValue to be set
      event.returnValue = messageRef.current;
      return messageRef.current;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, isDirty]);

  return {
    /**
     * Current blocker state (useful for showing custom UI)
     */
    blockerState: blocker.state,

    /**
     * Manually proceed with blocked navigation
     */
    proceed: blocker.proceed,

    /**
     * Manually reset/cancel blocked navigation
     */
    reset: blocker.reset,
  };
}
