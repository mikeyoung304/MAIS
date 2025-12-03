import { useState, useCallback } from "react";

interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  isOpen: boolean;
  onConfirm: () => void;
}

/**
 * useConfirmDialog Hook
 *
 * Provides a programmatic way to show confirmation dialogs.
 * Returns dialog state and methods to control it.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { confirm, ConfirmDialog } = useConfirmDialog();
 *
 *   const handleDelete = async () => {
 *     const confirmed = await confirm({
 *       title: "Delete Package",
 *       description: "Are you sure? This action cannot be undone.",
 *       confirmLabel: "Delete",
 *       variant: "destructive"
 *     });
 *
 *     if (confirmed) {
 *       await deletePackage();
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleDelete}>Delete</button>
 *       <ConfirmDialog />
 *     </>
 *   );
 * }
 * ```
 */
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<ConfirmDialogState | null>(null);

  /**
   * Show confirmation dialog and wait for user response
   * @returns Promise<boolean> - true if confirmed, false if cancelled
   */
  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        ...options,
        isOpen: true,
        onConfirm: () => {
          setDialogState(null);
          resolve(true);
        },
      });
    });
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      // Dialog closed without confirming
      setDialogState(null);
    }
  }, []);

  return {
    confirm,
    dialogState,
    handleOpenChange,
  };
}
