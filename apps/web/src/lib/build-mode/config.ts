/**
 * Build Mode configuration constants
 * Centralized for easy tuning and documentation
 */
export const BUILD_MODE_CONFIG = {
  timing: {
    /** Max wait time for BUILD_MODE_READY message from iframe */
    iframeReadyTimeout: 5000,
    debounce: {
      /** Simple text edits - faster feedback */
      textEdit: 300,
      /** Rich text edits - more processing needed */
      richTextEdit: 500,
      /** API save calls - batched for efficiency */
      autosave: 1000,
    },
    /** Duration to show "saved" status before returning to idle */
    saveStatusResetDelay: 2000,
    /** Duration to show error status before returning to idle */
    errorStatusResetDelay: 3000,
    /** Success toast visibility duration */
    toastDuration: 3000,
  },
  viewport: {
    /** iPhone SE width for mobile preview */
    mobileWidth: 375,
  },
} as const;
