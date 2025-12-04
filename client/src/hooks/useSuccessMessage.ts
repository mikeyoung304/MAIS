import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * useSuccessMessage Hook
 *
 * Manages temporary success messages with automatic cleanup.
 * Prevents memory leaks by properly clearing timeouts on unmount and message changes.
 *
 * @param duration - Duration in milliseconds to display the message (default: 3000)
 * @returns Object containing message state and control functions
 *
 * @example
 * const { message, showSuccess, clearMessage } = useSuccessMessage();
 * showSuccess("Operation completed successfully");
 */
export function useSuccessMessage(duration = 3000) {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showSuccess = useCallback(
    (msg: string) => {
      // Clear any existing timeout to prevent memory leaks
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setMessage(msg);
      timeoutRef.current = setTimeout(() => setMessage(null), duration);
    },
    [duration]
  );

  const clearMessage = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setMessage(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { message, showSuccess, clearMessage };
}
