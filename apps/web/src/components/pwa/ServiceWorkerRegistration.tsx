'use client';

import { useEffect, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

export interface ServiceWorkerStatus {
  /** Whether the browser supports service workers */
  supported: boolean;
  /** Whether a service worker is registered */
  registered: boolean;
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Whether the service worker is waiting to activate */
  waiting: boolean;
  /** Apply the waiting update */
  applyUpdate: () => void;
}

/**
 * Service Worker Registration Component
 *
 * Handles:
 * - Registration of the service worker
 * - Update detection and notification
 * - Controlled refresh on update
 *
 * Should be rendered once in the root layout.
 */
export function ServiceWorkerRegistration() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const applyUpdate = useCallback(() => {
    if (!registration?.waiting) return;

    // Mark this as a user-initiated update so we reload after controller change
    (window as Window & { __swUserInitiatedUpdate?: () => void }).__swUserInitiatedUpdate?.();

    // Tell the waiting service worker to skip waiting
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [registration]);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    // Check for service worker support
    if (!('serviceWorker' in navigator)) {
      logger.info('Service workers not supported');
      return;
    }

    let mounted = true;

    const registerServiceWorker = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        if (!mounted) return;

        setRegistration(reg);
        logger.info('Service worker registered', { scope: reg.scope });

        // Check for updates immediately
        reg.update().catch((error) => {
          logger.warn('Service worker update check failed', { error });
        });

        // Check for waiting service worker (update ready)
        if (reg.waiting) {
          setUpdateAvailable(true);
          logger.info('Service worker update waiting');
        }

        // Listen for new service worker installing
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              setUpdateAvailable(true);
              logger.info('Service worker update available');
            }
          });
        });
      } catch (error) {
        logger.error('Service worker registration failed', error as Error);
      }
    };

    // Listen for controller change (update applied)
    // Enterprise pattern: Only reload if the update was user-initiated
    // This prevents jarring auto-reloads during deployments
    let userInitiatedUpdate = false;

    const handleControllerChange = () => {
      if (userInitiatedUpdate) {
        logger.info('Service worker updated (user-initiated), reloading...');
        window.location.reload();
      } else {
        // New SW took control but user didn't request it
        // This can happen on first visit or if SW calls skipWaiting internally
        logger.info('Service worker controller changed (background)');
      }
    };

    // Store the flag setter so applyUpdate can use it
    (window as Window & { __swUserInitiatedUpdate?: () => void }).__swUserInitiatedUpdate = () => {
      userInitiatedUpdate = true;
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Register on load
    if (document.readyState === 'complete') {
      registerServiceWorker();
    } else {
      window.addEventListener('load', registerServiceWorker);
    }

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('load', registerServiceWorker);
      // Clean up the window property
      delete (window as Window & { __swUserInitiatedUpdate?: () => void }).__swUserInitiatedUpdate;
    };
  }, []);

  // Show update notification when available
  if (updateAvailable) {
    return (
      <div
        className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom duration-300 md:left-auto md:right-4"
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-center gap-4 rounded-2xl bg-sage p-4 text-white shadow-xl">
          <div className="flex-1">
            <p className="font-medium">Update available</p>
            <p className="text-sm text-white/80">Refresh to get the latest version</p>
          </div>
          <button
            onClick={applyUpdate}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-sage transition-all hover:bg-white/90"
          >
            Update
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Hook to access service worker status.
 * Returns null during SSR.
 */
export function useServiceWorker(): ServiceWorkerStatus | null {
  const [status, setStatus] = useState<ServiceWorkerStatus | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      setStatus({
        supported: false,
        registered: false,
        updateAvailable: false,
        waiting: false,
        applyUpdate: () => {},
      });
      return;
    }

    const updateStatus = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        setStatus({
          supported: true,
          registered: !!registration,
          updateAvailable: !!registration?.waiting,
          waiting: !!registration?.waiting,
          applyUpdate: () => {
            registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
          },
        });
      } catch {
        setStatus({
          supported: true,
          registered: false,
          updateAvailable: false,
          waiting: false,
          applyUpdate: () => {},
        });
      }
    };

    updateStatus();
  }, []);

  return status;
}
