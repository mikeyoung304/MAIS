import { useState, useRef, useEffect } from 'react';

export function useSuccessMessage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showSuccess = (message: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSuccessMessage(message);
    timeoutRef.current = setTimeout(() => {
      setSuccessMessage(null);
      timeoutRef.current = null;
    }, 3000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    successMessage,
    showSuccess,
  };
}
