'use client';

import { useEffect, useState, useCallback } from 'react';

// LocalStorage keys for panel state
const PANEL_OPEN_KEY = 'agent-panel-open';
const WELCOMED_KEY = 'agent-panel-welcomed';

interface UseAgentPanelStateReturn {
  /** Whether panel is open (desktop) */
  isOpen: boolean;
  /** Set panel open/closed state (persists to localStorage) */
  setIsOpen: (open: boolean) => void;
  /** Whether this is the user's first visit */
  isFirstVisit: boolean;
  /** Whether the component has mounted (for SSR hydration) */
  isMounted: boolean;
  /** Mark user as welcomed (called when they send first message) */
  markWelcomed: () => void;
}

/**
 * useAgentPanelState - Manages panel open/closed state and first-visit tracking.
 *
 * Handles:
 * - Persisting open/closed state to localStorage
 * - First-visit detection (auto-open + "New" badge)
 * - SSR hydration guard (isMounted)
 */
export function useAgentPanelState(): UseAgentPanelStateReturn {
  const [isOpen, setIsOpenState] = useState(true); // Default open on desktop
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Load persisted state from localStorage on mount
  useEffect(() => {
    setIsMounted(true);

    const storedOpen = localStorage.getItem(PANEL_OPEN_KEY);
    const welcomed = localStorage.getItem(WELCOMED_KEY);

    // Check if this is first visit
    if (!welcomed) {
      setIsFirstVisit(true);
      setIsOpenState(true); // Auto-open for first-time visitors (desktop only)
    } else {
      // Use stored preference or default to open
      setIsOpenState(storedOpen === null ? true : storedOpen === 'true');
    }
  }, []);

  // Persist open state to localStorage
  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenState(open);
    localStorage.setItem(PANEL_OPEN_KEY, String(open));
  }, []);

  // Mark user as welcomed (persists to localStorage)
  const markWelcomed = useCallback(() => {
    if (isFirstVisit) {
      localStorage.setItem(WELCOMED_KEY, 'true');
      setIsFirstVisit(false);
    }
  }, [isFirstVisit]);

  return {
    isOpen,
    setIsOpen,
    isFirstVisit,
    isMounted,
    markWelcomed,
  };
}
