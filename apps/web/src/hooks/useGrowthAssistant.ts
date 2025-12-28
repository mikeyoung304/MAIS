'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'growth-assistant-panel-open';
const WELCOMED_KEY = 'growth-assistant-welcomed';

interface UseGrowthAssistantReturn {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
  isFirstVisit: boolean;
  markWelcomed: () => void;
}

/**
 * Hook for managing Growth Assistant panel state
 *
 * Features:
 * - Persists open/closed state to localStorage
 * - Tracks first-time visit for welcome message
 * - Auto-opens panel for first-time users
 */
export function useGrowthAssistant(): UseGrowthAssistantReturn {
  // Initialize with undefined to detect first render
  const [isOpen, setIsOpenState] = useState<boolean | undefined>(undefined);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const welcomed = localStorage.getItem(WELCOMED_KEY);

    // Check if this is first visit
    if (!welcomed) {
      setIsFirstVisit(true);
      // Auto-open panel for first-time visitors
      setIsOpenState(true);
    } else {
      // Use stored preference or default to open
      setIsOpenState(stored === null ? true : stored === 'true');
    }
  }, []);

  // Persist state changes to localStorage
  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenState(open);
    localStorage.setItem(STORAGE_KEY, String(open));
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen, setIsOpen]);

  const markWelcomed = useCallback(() => {
    localStorage.setItem(WELCOMED_KEY, 'true');
    setIsFirstVisit(false);
  }, []);

  return {
    // Default to false during SSR/initial render
    isOpen: isOpen ?? false,
    setIsOpen,
    toggle,
    isFirstVisit,
    markWelcomed,
  };
}
