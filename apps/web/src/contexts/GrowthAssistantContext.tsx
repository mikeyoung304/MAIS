'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useGrowthAssistant } from '@/hooks/useGrowthAssistant';

/** Context type for Growth Assistant state */
interface GrowthAssistantContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
  isFirstVisit: boolean;
  markWelcomed: () => void;
}

const GrowthAssistantContext = createContext<GrowthAssistantContextType | null>(null);

interface GrowthAssistantProviderProps {
  children: ReactNode;
}

/**
 * Provider for Growth Assistant panel state
 *
 * Wraps tenant layout to share panel open/close state between:
 * - Layout (for content margin adjustment)
 * - GrowthAssistantPanel (for panel visibility)
 */
export function GrowthAssistantProvider({ children }: GrowthAssistantProviderProps) {
  const growthAssistant = useGrowthAssistant();

  // Memoize context value to prevent unnecessary re-renders
  // We intentionally depend on specific properties, not the whole object
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(
    () => growthAssistant,
    [growthAssistant.isOpen, growthAssistant.isFirstVisit]
  );

  return (
    <GrowthAssistantContext.Provider value={value}>{children}</GrowthAssistantContext.Provider>
  );
}

/**
 * Hook to access Growth Assistant state from context
 *
 * Must be used within GrowthAssistantProvider.
 * @throws Error if used outside provider
 */
export function useGrowthAssistantContext(): GrowthAssistantContextType {
  const context = useContext(GrowthAssistantContext);
  if (!context) {
    throw new Error('useGrowthAssistantContext must be used within GrowthAssistantProvider');
  }
  return context;
}
