/**
 * Unit tests for useNetworkStatus hook
 *
 * Tests online/offline detection and Network Information API integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNetworkStatus, useIsOnline, useSaveData, useIsSlowConnection, __resetCachedSnapshot } from '../useNetworkStatus';

// Reset module cache between tests to clear cached snapshot
beforeEach(() => {
  __resetCachedSnapshot();
});

describe('useNetworkStatus', () => {
  let onlineListeners: Array<() => void>;
  let offlineListeners: Array<() => void>;

  beforeEach(() => {
    onlineListeners = [];
    offlineListeners = [];

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true,
    });

    // Remove connection mock to start clean
    Object.defineProperty(navigator, 'connection', {
      writable: true,
      configurable: true,
      value: undefined,
    });

    // Mock window events
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'online') onlineListeners.push(listener as () => void);
      if (type === 'offline') offlineListeners.push(listener as () => void);
    });

    vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener) => {
      if (type === 'online') {
        const index = onlineListeners.indexOf(listener as () => void);
        if (index > -1) onlineListeners.splice(index, 1);
      }
      if (type === 'offline') {
        const index = offlineListeners.indexOf(listener as () => void);
        if (index > -1) offlineListeners.splice(index, 1);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return online status when connected', () => {
    Object.defineProperty(navigator, 'onLine', { value: true });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.online).toBe(true);
  });

  it('should return offline status when disconnected', () => {
    Object.defineProperty(navigator, 'onLine', { value: false });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.online).toBe(false);
  });

  it('should return unknown connection type when Network Information API is unavailable', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.type).toBe('unknown');
  });

  it('should return saveData as false when not set', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.saveData).toBe(false);
  });

  it('should subscribe to online/offline events', () => {
    renderHook(() => useNetworkStatus());

    expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('should unsubscribe from events on unmount', () => {
    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});

describe('useIsOnline', () => {
  beforeEach(() => {
    vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when online', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true,
    });

    const { result } = renderHook(() => useIsOnline());

    expect(result.current).toBe(true);
  });

  it('should return false when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: false,
    });

    const { result } = renderHook(() => useIsOnline());

    expect(result.current).toBe(false);
  });
});

describe('useSaveData', () => {
  beforeEach(() => {
    vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false when save data preference is not set', () => {
    const { result } = renderHook(() => useSaveData());

    expect(result.current).toBe(false);
  });
});

describe('useIsSlowConnection', () => {
  beforeEach(() => {
    vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false when effective type is unavailable', () => {
    const { result } = renderHook(() => useIsSlowConnection());

    expect(result.current).toBe(false);
  });
});

describe('Network Information API integration', () => {
  let mockConnection: {
    type: string;
    effectiveType: string;
    downlink: number;
    rtt: number;
    saveData: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockConnection = {
      type: 'wifi',
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(navigator, 'connection', {
      writable: true,
      configurable: true,
      value: mockConnection,
    });

    vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'connection', {
      writable: true,
      configurable: true,
      value: undefined,
    });
    vi.restoreAllMocks();
  });

  it('should return connection type from Network Information API', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.type).toBe('wifi');
  });

  it('should return effective type from Network Information API', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.effectiveType).toBe('4g');
  });

  it('should return downlink speed', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.downlink).toBe(10);
  });

  it('should return RTT', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.rtt).toBe(50);
  });

  it('should detect slow connection on 2G', () => {
    mockConnection.effectiveType = '2g';

    const { result } = renderHook(() => useIsSlowConnection());

    expect(result.current).toBe(true);
  });

  it('should detect slow connection on slow-2g', () => {
    mockConnection.effectiveType = 'slow-2g';

    const { result } = renderHook(() => useIsSlowConnection());

    expect(result.current).toBe(true);
  });

  it('should not detect slow connection on 3g', () => {
    mockConnection.effectiveType = '3g';

    const { result } = renderHook(() => useIsSlowConnection());

    expect(result.current).toBe(false);
  });

  it('should subscribe to connection change events', () => {
    renderHook(() => useNetworkStatus());

    expect(mockConnection.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should return saveData when enabled', () => {
    mockConnection.saveData = true;

    const { result } = renderHook(() => useSaveData());

    expect(result.current).toBe(true);
  });
});
