'use client';

import { useSyncExternalStore, useCallback } from 'react';

/**
 * Network connection type.
 */
export type ConnectionType =
  | 'bluetooth'
  | 'cellular'
  | 'ethernet'
  | 'none'
  | 'wifi'
  | 'wimax'
  | 'other'
  | 'unknown';

/**
 * Effective connection type (speed-based).
 */
export type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g';

/**
 * Network status information.
 */
export interface NetworkStatus {
  /** True if the browser is online */
  readonly online: boolean;

  /** Connection type (if available via Network Information API) */
  readonly type: ConnectionType;

  /** Effective connection type based on measured performance */
  readonly effectiveType: EffectiveType | undefined;

  /** Estimated downlink speed in Mbps */
  readonly downlink: number | undefined;

  /** Estimated round-trip time in milliseconds */
  readonly rtt: number | undefined;

  /** True if the user has requested reduced data usage */
  readonly saveData: boolean;
}

/**
 * NetworkInformation API interface (not in TypeScript lib by default).
 */
interface NetworkInformation extends EventTarget {
  readonly type?: ConnectionType;
  readonly effectiveType?: EffectiveType;
  readonly downlink?: number;
  readonly rtt?: number;
  readonly saveData?: boolean;
  addEventListener(
    type: 'change',
    listener: () => void,
    options?: AddEventListenerOptions
  ): void;
  removeEventListener(
    type: 'change',
    listener: () => void,
    options?: EventListenerOptions
  ): void;
}

interface NavigatorWithConnection extends Navigator {
  readonly connection?: NetworkInformation;
  readonly mozConnection?: NetworkInformation;
  readonly webkitConnection?: NetworkInformation;
}

/**
 * Get the network connection object (with vendor prefixes).
 */
function getConnection(): NetworkInformation | undefined {
  if (typeof navigator === 'undefined') return undefined;

  const nav = navigator as NavigatorWithConnection;
  return nav.connection || nav.mozConnection || nav.webkitConnection;
}

// Cached snapshot to prevent infinite loops in useSyncExternalStore
let cachedSnapshot: NetworkStatus | null = null;

/**
 * Reset the cached snapshot (for testing purposes).
 * @internal
 */
export function __resetCachedSnapshot(): void {
  cachedSnapshot = null;
}

/**
 * Get current network status snapshot with memoization.
 * Returns the same object reference if values haven't changed.
 */
function getNetworkSnapshot(): NetworkStatus {
  if (typeof navigator === 'undefined') {
    return getServerSnapshot();
  }

  const connection = getConnection();
  const online = navigator.onLine;
  const type = connection?.type ?? 'unknown';
  const effectiveType = connection?.effectiveType;
  const downlink = connection?.downlink;
  const rtt = connection?.rtt;
  const saveData = connection?.saveData ?? false;

  // Return cached snapshot if values haven't changed
  if (
    cachedSnapshot &&
    cachedSnapshot.online === online &&
    cachedSnapshot.type === type &&
    cachedSnapshot.effectiveType === effectiveType &&
    cachedSnapshot.downlink === downlink &&
    cachedSnapshot.rtt === rtt &&
    cachedSnapshot.saveData === saveData
  ) {
    return cachedSnapshot;
  }

  // Create new snapshot and cache it
  cachedSnapshot = {
    online,
    type,
    effectiveType,
    downlink,
    rtt,
    saveData,
  };

  return cachedSnapshot;
}

// Cached server snapshot
const serverSnapshot: NetworkStatus = {
  online: true,
  type: 'unknown',
  effectiveType: undefined,
  downlink: undefined,
  rtt: undefined,
  saveData: false,
};

/**
 * Server snapshot (assume online).
 */
function getServerSnapshot(): NetworkStatus {
  return serverSnapshot;
}

/**
 * Hook to monitor network status in real-time.
 *
 * Uses the Network Information API when available for detailed
 * connection information, with fallback to basic online/offline.
 *
 * @returns NetworkStatus with connection details
 *
 * @example
 * ```tsx
 * function App() {
 *   const network = useNetworkStatus();
 *
 *   if (!network.online) {
 *     return <OfflineBanner />;
 *   }
 *
 *   if (network.saveData) {
 *     return <LiteExperience />;
 *   }
 *
 *   return <FullExperience />;
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  const subscribe = useCallback((callback: () => void) => {
    // Subscribe to online/offline events
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);

    // Subscribe to connection changes if available
    const connection = getConnection();
    connection?.addEventListener('change', callback);

    return () => {
      window.removeEventListener('online', callback);
      window.removeEventListener('offline', callback);
      connection?.removeEventListener('change', callback);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    getNetworkSnapshot,
    getServerSnapshot
  );
}

/**
 * Simple hook that returns just the online status.
 */
export function useIsOnline(): boolean {
  const status = useNetworkStatus();
  return status.online;
}

/**
 * Hook that returns true if the user prefers reduced data.
 */
export function useSaveData(): boolean {
  const status = useNetworkStatus();
  return status.saveData;
}

/**
 * Hook that returns true if the connection is slow (2G or worse).
 */
export function useIsSlowConnection(): boolean {
  const status = useNetworkStatus();
  return (
    status.effectiveType === 'slow-2g' || status.effectiveType === '2g'
  );
}
