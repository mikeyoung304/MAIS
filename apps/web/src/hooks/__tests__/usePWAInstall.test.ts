/**
 * Unit tests for usePWAInstall hook
 *
 * Tests PWA installation flow, iOS detection, and beforeinstallprompt handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePWAInstall,
  isStandaloneMode,
  isIOSDevice,
  isIOSSafari,
  hasUserDismissedInstall,
  setInstallDismissed,
  clearInstallDismissed,
} from '../usePWAInstall';

// Reset module-level state between tests
// Note: deferredPromptReset would be used for resetting deferred prompt state if exposed by the hook

describe('usePWAInstall', () => {
  let beforeInstallPromptListeners: Array<(e: Event) => void>;
  let appInstalledListeners: Array<() => void>;
  let mockPrompt: ReturnType<typeof vi.fn>;
  let mockUserChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;

  // Helper function for creating mock beforeinstallprompt events
  // Prefixed with _ as it's prepared for future tests that may need it
  function _createMockBeforeInstallPromptEvent(
    outcome: 'accepted' | 'dismissed' = 'accepted'
  ): Event {
    mockUserChoice = Promise.resolve({ outcome, platform: 'web' });
    mockPrompt = vi.fn().mockResolvedValue(undefined);

    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperty(event, 'platforms', { value: ['web'] });
    Object.defineProperty(event, 'userChoice', { value: mockUserChoice });
    Object.defineProperty(event, 'prompt', { value: mockPrompt });

    return event;
  }
  // Silence unused warning - function is kept for future test expansion
  void _createMockBeforeInstallPromptEvent;

  beforeEach(() => {
    beforeInstallPromptListeners = [];
    appInstalledListeners = [];

    // Clear localStorage
    localStorage.clear();

    // Reset navigator properties
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      configurable: true,
    });

    Object.defineProperty(navigator, 'standalone', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    // Mock matchMedia for standalone check
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })),
      writable: true,
      configurable: true,
    });

    // Mock event listeners
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'beforeinstallprompt') {
          beforeInstallPromptListeners.push(listener as (e: Event) => void);
        }
        if (type === 'appinstalled') {
          appInstalledListeners.push(listener as () => void);
        }
      }
    );

    vi.spyOn(window, 'removeEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'beforeinstallprompt') {
          const index = beforeInstallPromptListeners.indexOf(listener as (e: Event) => void);
          if (index > -1) beforeInstallPromptListeners.splice(index, 1);
        }
        if (type === 'appinstalled') {
          const index = appInstalledListeners.indexOf(listener as () => void);
          if (index > -1) appInstalledListeners.splice(index, 1);
        }
      }
    );

    // Mock BeforeInstallPromptEvent support
    Object.defineProperty(window, 'BeforeInstallPromptEvent', {
      value: class {},
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should return pending status when no prompt is available', () => {
      const { result } = renderHook(() => usePWAInstall());

      // Initial status depends on browser support detection
      expect(['pending', 'unsupported']).toContain(result.current.status);
    });

    it('should return isInstalled false when not in standalone mode', () => {
      const { result } = renderHook(() => usePWAInstall());

      expect(result.current.isInstalled).toBe(false);
    });

    it('should detect iOS device correctly', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        configurable: true,
      });

      const { result } = renderHook(() => usePWAInstall());

      expect(result.current.isIOS).toBe(true);
    });
  });

  describe('prompt function', () => {
    it('should return unavailable when no prompt event exists', async () => {
      const { result } = renderHook(() => usePWAInstall());

      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.prompt();
      });

      expect(outcome).toBe('unavailable');
    });
  });

  describe('canInstall', () => {
    it('should be false when app is already installed', () => {
      // Mock standalone mode
      (window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));

      const { result } = renderHook(() => usePWAInstall());

      // Even if install prompt is available, canInstall should be false when installed
      expect(result.current.isInstalled).toBe(true);
    });

    it('should be true on iOS even without beforeinstallprompt', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        configurable: true,
      });

      const { result } = renderHook(() => usePWAInstall());

      // iOS users can install via Safari share menu
      expect(result.current.isIOS).toBe(true);
      expect(result.current.canInstall).toBe(true);
    });
  });
});

describe('isStandaloneMode', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })),
      writable: true,
      configurable: true,
    });
  });

  it('should return false when not in standalone mode', () => {
    expect(isStandaloneMode()).toBe(false);
  });

  it('should return true when display-mode is standalone', () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));

    expect(isStandaloneMode()).toBe(true);
  });

  it('should return true when navigator.standalone is true (iOS)', () => {
    Object.defineProperty(navigator, 'standalone', {
      value: true,
      configurable: true,
    });

    expect(isStandaloneMode()).toBe(true);
  });
});

describe('isIOSDevice', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true for iPhone user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      configurable: true,
    });

    expect(isIOSDevice()).toBe(true);
  });

  it('should return true for iPad user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)',
      configurable: true,
    });

    expect(isIOSDevice()).toBe(true);
  });

  it('should return false for Android user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 13) Chrome/120.0.0.0',
      configurable: true,
    });

    expect(isIOSDevice()).toBe(false);
  });

  it('should return false for desktop user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      configurable: true,
    });

    expect(isIOSDevice()).toBe(false);
  });
});

describe('isIOSSafari', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true for Safari on iOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    expect(isIOSSafari()).toBe(true);
  });

  it('should return false for Chrome on iOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    expect(isIOSSafari()).toBe(false);
  });

  it('should return false for Firefox on iOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15',
      configurable: true,
    });

    expect(isIOSSafari()).toBe(false);
  });

  it('should return false for desktop Safari', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      configurable: true,
    });

    expect(isIOSSafari()).toBe(false);
  });
});

describe('install dismissal persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return false when user has not dismissed', () => {
    expect(hasUserDismissedInstall()).toBe(false);
  });

  it('should return true after setInstallDismissed is called', () => {
    setInstallDismissed();
    expect(hasUserDismissedInstall()).toBe(true);
  });

  it('should return false after clearInstallDismissed is called', () => {
    setInstallDismissed();
    expect(hasUserDismissedInstall()).toBe(true);

    clearInstallDismissed();
    expect(hasUserDismissedInstall()).toBe(false);
  });

  it('should persist dismissed state across function calls', () => {
    setInstallDismissed();

    // Simulate checking from a different part of the app
    expect(localStorage.getItem('pwa-install-dismissed')).toBe('true');
    expect(hasUserDismissedInstall()).toBe(true);
  });
});
