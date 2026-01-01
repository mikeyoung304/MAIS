'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { logger } from '@/lib/logger';

/**
 * PWA install prompt status state machine.
 * - unsupported: Browser doesn't support PWA install
 * - pending: Waiting for beforeinstallprompt event
 * - ready: Prompt available, can be triggered
 * - prompting: User is seeing the install prompt
 * - accepted: User accepted the install
 * - dismissed: User dismissed the install prompt
 */
export type PWAInstallStatus =
  | 'unsupported'
  | 'pending'
  | 'ready'
  | 'prompting'
  | 'accepted'
  | 'dismissed';

/**
 * BeforeInstallPromptEvent interface (not in TypeScript lib).
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Module-level state for the deferred prompt
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((callback) => callback());
}

/**
 * Detect if the app is running in standalone mode (already installed).
 */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;

  // Check display-mode media query
  if (window.matchMedia('(display-mode: standalone)').matches) return true;

  // iOS Safari standalone mode
  if ('standalone' in window.navigator) {
    return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  }

  return false;
}

/**
 * Detect if the device is iOS.
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

/**
 * Detect if the browser is Safari on iOS.
 */
export function isIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isChromeOnIOS = /CriOS/.test(ua);
  const isFirefoxOnIOS = /FxiOS/.test(ua);

  return isIOS && isWebkit && !isChromeOnIOS && !isFirefoxOnIOS;
}

/**
 * Check if the browser supports the BeforeInstallPrompt API.
 */
function supportsInstallPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  return 'BeforeInstallPromptEvent' in window || 'onbeforeinstallprompt' in window;
}

function getSnapshot(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

function getServerSnapshot(): null {
  return null;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);

  // Set up event listeners on first subscription
  if (listeners.size === 1 && typeof window !== 'undefined') {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      logger.info('PWA: beforeinstallprompt event captured');
      notifyListeners();
    };

    const handleAppInstalled = () => {
      deferredPrompt = null;
      logger.info('PWA: App was installed');
      notifyListeners();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Return cleanup that only runs when all listeners are removed
    const originalUnsubscribe = () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        window.removeEventListener('appinstalled', handleAppInstalled);
      }
    };

    return originalUnsubscribe;
  }

  return () => {
    listeners.delete(callback);
  };
}

export interface UsePWAInstallResult {
  /** Current status of the PWA install flow */
  status: PWAInstallStatus;
  /** Whether the install prompt can be shown */
  canInstall: boolean;
  /** Whether the device is iOS (needs manual instructions) */
  isIOS: boolean;
  /** Whether the app is already installed (standalone mode) */
  isInstalled: boolean;
  /** Trigger the native install prompt (Android/Desktop) */
  prompt: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

/**
 * Hook to manage PWA installation prompt.
 *
 * Handles the BeforeInstallPromptEvent lifecycle, iOS detection,
 * and standalone mode detection.
 *
 * @example
 * ```tsx
 * function InstallButton() {
 *   const { canInstall, isIOS, prompt, status } = usePWAInstall();
 *
 *   if (!canInstall) return null;
 *
 *   if (isIOS) {
 *     return <p>Tap Share, then "Add to Home Screen"</p>;
 *   }
 *
 *   return (
 *     <button onClick={() => prompt()}>
 *       {status === 'prompting' ? 'Installing...' : 'Install App'}
 *     </button>
 *   );
 * }
 * ```
 */
export function usePWAInstall(): UsePWAInstallResult {
  const [status, setStatus] = useState<PWAInstallStatus>('pending');
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Subscribe to deferred prompt changes
  const promptEvent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Initialize client-side state
  useEffect(() => {
    setIsInstalled(isStandaloneMode());
    setIsIOS(isIOSDevice());

    // Determine initial status
    if (isStandaloneMode()) {
      setStatus('accepted');
    } else if (isIOSDevice()) {
      // iOS doesn't support beforeinstallprompt, but can still be installed
      setStatus('ready');
    } else if (!supportsInstallPrompt()) {
      setStatus('unsupported');
    } else if (deferredPrompt) {
      setStatus('ready');
    } else {
      setStatus('pending');
    }
  }, []);

  // Update status when prompt event changes
  useEffect(() => {
    if (isStandaloneMode()) {
      setStatus('accepted');
    } else if (promptEvent) {
      setStatus('ready');
    }
  }, [promptEvent]);

  const prompt = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) {
      logger.warn('PWA: No install prompt available');
      return 'unavailable';
    }

    setStatus('prompting');

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setStatus('accepted');
        logger.info('PWA: User accepted installation');
      } else {
        setStatus('dismissed');
        logger.info('PWA: User dismissed installation');
      }

      // Clear the prompt - it can only be used once
      deferredPrompt = null;
      notifyListeners();

      return outcome;
    } catch (error) {
      logger.error('PWA: Error during install prompt', error as Error);
      setStatus('ready');
      return 'unavailable';
    }
  }, []);

  // Compute canInstall based on current state
  const canInstall =
    !isInstalled &&
    (status === 'ready' || (isIOS && status !== 'unsupported' && status !== 'accepted'));

  return {
    status,
    canInstall,
    isIOS,
    isInstalled,
    prompt,
  };
}

/**
 * Check if the user has previously dismissed the install prompt.
 */
export function hasUserDismissedInstall(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('pwa-install-dismissed') === 'true';
}

/**
 * Mark the install prompt as dismissed.
 */
export function setInstallDismissed(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('pwa-install-dismissed', 'true');
}

/**
 * Clear the dismissed state (for testing or settings).
 */
export function clearInstallDismissed(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('pwa-install-dismissed');
}
