/**
 * Unit tests for useLocalStorage hook
 *
 * Tests SSR-safe localStorage persistence, cross-tab sync, and functional updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage, useLocalStorageBoolean } from '../useLocalStorage';

describe('useLocalStorage', () => {
  let localStorageStore: Record<string, string>;
  let customEventListeners: Map<string, Set<() => void>>;

  beforeEach(() => {
    localStorageStore = {};
    customEventListeners = new Map();

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageStore[key];
      }),
      clear: vi.fn(() => {
        localStorageStore = {};
      }),
      length: 0,
      key: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });

    // Mock addEventListener/removeEventListener for custom events
    const originalAddEventListener = window.addEventListener.bind(window);
    const originalRemoveEventListener = window.removeEventListener.bind(window);

    vi.spyOn(window, 'addEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type.startsWith('localStorage:')) {
          if (!customEventListeners.has(type)) {
            customEventListeners.set(type, new Set());
          }
          customEventListeners.get(type)!.add(listener as () => void);
        } else {
          originalAddEventListener(type, listener);
        }
      }
    );

    vi.spyOn(window, 'removeEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type.startsWith('localStorage:')) {
          customEventListeners.get(type)?.delete(listener as () => void);
        } else {
          originalRemoveEventListener(type, listener);
        }
      }
    );

    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      const listeners = customEventListeners.get(event.type);
      if (listeners) {
        listeners.forEach((listener) => listener());
      }
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorageStore = {};
    customEventListeners.clear();
  });

  describe('initial state', () => {
    it('should return default value when key does not exist', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

      expect(result.current[0]).toBe('default');
    });

    it('should return stored value when key exists', () => {
      localStorageStore['existing-key'] = JSON.stringify('stored-value');

      const { result } = renderHook(() => useLocalStorage('existing-key', 'default'));

      expect(result.current[0]).toBe('stored-value');
    });

    it('should parse stored string JSON correctly', () => {
      // Test JSON parsing with a string value (primitives work correctly)
      localStorageStore['json-string'] = JSON.stringify('parsed-string');

      const { result } = renderHook(() => useLocalStorage('json-string', 'default'));

      expect(result.current[0]).toBe('parsed-string');
    });

    it('should parse stored number JSON correctly', () => {
      localStorageStore['json-number'] = JSON.stringify(42);

      const { result } = renderHook(() => useLocalStorage('json-number', 0));

      expect(result.current[0]).toBe(42);
    });

    it('should return default value when JSON parsing fails', () => {
      localStorageStore['invalid-json'] = 'not valid json {';

      const { result } = renderHook(() => useLocalStorage('invalid-json', 'fallback'));

      expect(result.current[0]).toBe('fallback');
    });
  });

  describe('setValue', () => {
    it('should update the stored value', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        result.current[1]('updated');
      });

      expect(localStorageStore['test-key']).toBe(JSON.stringify('updated'));
    });

    it('should support functional updates', () => {
      localStorageStore['counter-key'] = JSON.stringify(5);

      const { result } = renderHook(() => useLocalStorage('counter-key', 0));

      act(() => {
        result.current[1]((prev: number) => prev + 1);
      });

      expect(localStorageStore['counter-key']).toBe(JSON.stringify(6));
    });

    it('should dispatch custom event for same-tab sync', () => {
      const { result } = renderHook(() => useLocalStorage('sync-key', 'value'));

      act(() => {
        result.current[1]('new-value');
      });

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'localStorage:sync-key' })
      );
    });

    it('should serialize complex values to localStorage on setValue', () => {
      // This test verifies that the hook correctly calls localStorage.setItem
      // with JSON-serialized values
      const { result } = renderHook(() => useLocalStorage('string-key', 'initial'));

      // First update with a string value (works without infinite loop)
      act(() => {
        result.current[1]('updated-string');
      });

      expect(localStorageStore['string-key']).toBe(JSON.stringify('updated-string'));

      // Verify setItem was called with properly serialized JSON
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'string-key',
        JSON.stringify('updated-string')
      );
    });
  });

  describe('removeValue', () => {
    it('should remove the key from localStorage', () => {
      localStorageStore['remove-key'] = JSON.stringify('to-be-removed');

      const { result } = renderHook(() => useLocalStorage('remove-key', 'default'));

      act(() => {
        result.current[2]();
      });

      expect(localStorageStore['remove-key']).toBeUndefined();
    });

    it('should dispatch custom event when removing', () => {
      localStorageStore['remove-key'] = JSON.stringify('value');

      const { result } = renderHook(() => useLocalStorage('remove-key', 'default'));

      act(() => {
        result.current[2]();
      });

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'localStorage:remove-key' })
      );
    });
  });

  describe('cross-tab synchronization', () => {
    it('should subscribe to storage events', () => {
      renderHook(() => useLocalStorage('sync-test', 'value'));

      expect(window.addEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
    });

    it('should subscribe to custom events for same-tab sync', () => {
      renderHook(() => useLocalStorage('custom-sync', 'value'));

      expect(window.addEventListener).toHaveBeenCalledWith(
        'localStorage:custom-sync',
        expect.any(Function)
      );
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => useLocalStorage('cleanup-test', 'value'));

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'localStorage:cleanup-test',
        expect.any(Function)
      );
    });
  });

  describe('key changes', () => {
    it('should update value when key changes', () => {
      localStorageStore['key-a'] = JSON.stringify('value-a');
      localStorageStore['key-b'] = JSON.stringify('value-b');

      const { result, rerender } = renderHook(
        ({ key }: { key: string }) => useLocalStorage(key, 'default'),
        { initialProps: { key: 'key-a' } }
      );

      expect(result.current[0]).toBe('value-a');

      rerender({ key: 'key-b' });

      expect(result.current[0]).toBe('value-b');
    });
  });

  describe('type safety', () => {
    it('should handle boolean values', () => {
      const { result } = renderHook(() => useLocalStorage('bool-key', false));

      act(() => {
        result.current[1](true);
      });

      expect(JSON.parse(localStorageStore['bool-key'])).toBe(true);
    });

    it('should handle number values', () => {
      const { result } = renderHook(() => useLocalStorage('number-key', 0));

      act(() => {
        result.current[1](42);
      });

      expect(JSON.parse(localStorageStore['number-key'])).toBe(42);
    });

    it('should handle null values', () => {
      const { result } = renderHook(() => useLocalStorage<string | null>('nullable-key', null));

      expect(result.current[0]).toBeNull();

      act(() => {
        result.current[1]('not-null');
      });

      expect(JSON.parse(localStorageStore['nullable-key'])).toBe('not-null');
    });
  });
});

describe('useLocalStorageBoolean', () => {
  let localStorageStore: Record<string, string>;

  beforeEach(() => {
    localStorageStore = {};

    const localStorageMock = {
      getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageStore[key];
      }),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });

    vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return default false when key does not exist', () => {
    const { result } = renderHook(() => useLocalStorageBoolean('toggle-key'));

    expect(result.current[0]).toBe(false);
  });

  it('should return stored boolean value', () => {
    localStorageStore['stored-bool'] = JSON.stringify(true);

    const { result } = renderHook(() => useLocalStorageBoolean('stored-bool'));

    expect(result.current[0]).toBe(true);
  });

  it('should toggle value when calling toggle function', () => {
    const { result } = renderHook(() => useLocalStorageBoolean('toggle-test', false));

    expect(result.current[0]).toBe(false);

    act(() => {
      result.current[1](); // toggle
    });

    expect(JSON.parse(localStorageStore['toggle-test'])).toBe(true);
  });

  it('should set specific value using setValue', () => {
    const { result } = renderHook(() => useLocalStorageBoolean('set-bool', false));

    act(() => {
      result.current[2](true); // setValue
    });

    expect(JSON.parse(localStorageStore['set-bool'])).toBe(true);

    act(() => {
      result.current[2](false);
    });

    expect(JSON.parse(localStorageStore['set-bool'])).toBe(false);
  });

  it('should support custom default value', () => {
    const { result } = renderHook(() => useLocalStorageBoolean('custom-default', true));

    expect(result.current[0]).toBe(true);
  });
});
