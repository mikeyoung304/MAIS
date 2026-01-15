'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePrefersReducedMotion } from '@/hooks/useBreakpoint';

export interface OfflineBannerProps {
  /** Additional class name */
  className?: string;
  /** Duration in ms to show the "back online" message before hiding (default: 3000) */
  reconnectMessageDuration?: number;
}

/**
 * Offline status banner that shows when the user loses internet connection.
 *
 * Features:
 * - Slides down from top with smooth animation
 * - Shows "You're offline" message when disconnected
 * - Shows "Back online!" message briefly when reconnected
 * - Dismissible by user
 * - Fixed position, respects safe area
 *
 * @example
 * ```tsx
 * // Add to your root layout
 * function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <OfflineBanner />
 *         {children}
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function OfflineBanner({ className, reconnectMessageDuration = 3000 }: OfflineBannerProps) {
  const network = useNetworkStatus();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [dismissed, setDismissed] = React.useState(false);
  const [showReconnected, setShowReconnected] = React.useState(false);
  const wasOfflineRef = React.useRef(false);

  // Track when we come back online
  React.useEffect(() => {
    if (!network.online) {
      wasOfflineRef.current = true;
      setDismissed(false); // Reset dismissed state when going offline
    } else if (wasOfflineRef.current) {
      // Just came back online
      setShowReconnected(true);
      wasOfflineRef.current = false;

      // Hide reconnected message after duration
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, reconnectMessageDuration);

      return () => clearTimeout(timer);
    }
  }, [network.online, reconnectMessageDuration]);

  const isVisible = (!network.online || showReconnected) && !dismissed;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="alert"
          aria-live="polite"
          className={cn(
            'fixed top-0 left-0 right-0 z-[100]',
            'flex items-center justify-center gap-3',
            'px-4 py-3',
            network.online ? 'bg-success-500 text-white' : 'bg-warning-500 text-white',
            className
          )}
          style={{
            paddingTop: `calc(0.75rem + env(safe-area-inset-top, 0px))`,
          }}
          initial={prefersReducedMotion ? { opacity: 0 } : { y: -100, opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { y: -100, opacity: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.15 }
              : {
                  type: 'spring',
                  damping: 25,
                  stiffness: 300,
                }
          }
        >
          {/* Icon */}
          {network.online ? (
            <Wifi className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          ) : (
            <WifiOff className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          )}

          {/* Message */}
          <span className="text-sm font-medium">
            {network.online
              ? "You're back online!"
              : "You're offline. Some features may be unavailable."}
          </span>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className={cn(
              'ml-auto p-1.5 rounded-full',
              'hover:bg-white/20 motion-safe:transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2',
              network.online
                ? 'focus-visible:ring-offset-success-500'
                : 'focus-visible:ring-offset-warning-500'
            )}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

OfflineBanner.displayName = 'OfflineBanner';

/**
 * Hook variant for custom offline UI.
 *
 * @example
 * ```tsx
 * function CustomOfflineIndicator() {
 *   const { isOffline, justReconnected, dismiss } = useOfflineStatus();
 *
 *   if (!isOffline && !justReconnected) return null;
 *
 *   return (
 *     <div>
 *       {isOffline ? 'Offline' : 'Reconnected!'}
 *       <button onClick={dismiss}>Dismiss</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOfflineStatus(reconnectMessageDuration = 3000) {
  const network = useNetworkStatus();
  const [dismissed, setDismissed] = React.useState(false);
  const [justReconnected, setJustReconnected] = React.useState(false);
  const wasOfflineRef = React.useRef(false);

  React.useEffect(() => {
    if (!network.online) {
      wasOfflineRef.current = true;
      setDismissed(false);
    } else if (wasOfflineRef.current) {
      setJustReconnected(true);
      wasOfflineRef.current = false;

      const timer = setTimeout(() => {
        setJustReconnected(false);
      }, reconnectMessageDuration);

      return () => clearTimeout(timer);
    }
  }, [network.online, reconnectMessageDuration]);

  return {
    /** True if currently offline */
    isOffline: !network.online,
    /** True if just came back online (briefly) */
    justReconnected,
    /** True if user dismissed the notification */
    dismissed,
    /** Call to dismiss the notification */
    dismiss: () => setDismissed(true),
    /** Reset dismissed state */
    reset: () => setDismissed(false),
    /** Full network status object */
    network,
  };
}
