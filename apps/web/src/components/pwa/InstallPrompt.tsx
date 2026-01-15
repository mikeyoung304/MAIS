'use client';

import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall, hasUserDismissedInstall, setInstallDismissed } from '@/hooks/usePWAInstall';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'pwa-install-page-views';
const MIN_PAGE_VIEWS = 3;
const MIN_TIME_ON_SITE_MS = 30000; // 30 seconds

interface InstallPromptProps {
  /** Custom class name for positioning */
  className?: string;
  /** Force show the prompt (for testing) */
  forceShow?: boolean;
}

/**
 * Smart PWA install prompt that appears at the right time.
 *
 * Shows after user engagement (3 page views or 30 seconds on site).
 * Different UI for iOS (manual instructions) vs Android/Desktop (native prompt).
 * Respects user dismissal with localStorage persistence.
 */
export function InstallPrompt({ className, forceShow = false }: InstallPromptProps) {
  const { canInstall, isIOS, prompt, status, isInstalled } = usePWAInstall();
  const [shouldShow, setShouldShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Track page views and time on site
  useEffect(() => {
    if (isInstalled || hasUserDismissedInstall()) {
      return;
    }

    // Increment page view count
    const pageViews = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) + 1;
    localStorage.setItem(STORAGE_KEY, String(pageViews));

    // Show after minimum page views
    if (pageViews >= MIN_PAGE_VIEWS) {
      setShouldShow(true);
      // Delay visibility for animation
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    }

    // Or show after time on site
    const timer = setTimeout(() => {
      if (!hasUserDismissedInstall() && !isInstalled) {
        setShouldShow(true);
        setTimeout(() => setIsVisible(true), 100);
      }
    }, MIN_TIME_ON_SITE_MS);

    return () => clearTimeout(timer);
  }, [isInstalled]);

  // Force show for testing
  useEffect(() => {
    if (forceShow) {
      setShouldShow(true);
      setTimeout(() => setIsVisible(true), 100);
    }
  }, [forceShow]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setInstallDismissed();
    // Remove from DOM after animation
    setTimeout(() => setShouldShow(false), 300);
    logger.info('PWA: Install prompt dismissed by user');
  }, []);

  const handleInstall = useCallback(async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    const result = await prompt();
    if (result === 'accepted') {
      setIsVisible(false);
      setTimeout(() => setShouldShow(false), 300);
    }
  }, [isIOS, prompt]);

  // Don't render if conditions aren't met
  if (!shouldShow || !canInstall || isInstalled) {
    return null;
  }

  // iOS instructions modal - uses Radix Dialog for focus trap and escape key handling
  if (showIOSInstructions) {
    return (
      <Dialog.Root open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={cn(
              'fixed inset-0 z-50 bg-black/50',
              'data-[state=open]:animate-in data-[state=open]:fade-in-300',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-300',
              'motion-reduce:animate-none'
            )}
          />
          <Dialog.Content
            className={cn(
              'fixed bottom-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2 p-4',
              'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=open]:fade-in-0',
              'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-4 data-[state=closed]:fade-out-0',
              'motion-reduce:animate-none',
              className
            )}
          >
            <div className="w-full rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between">
                <Dialog.Title className="font-serif text-xl font-bold text-text-primary">
                  Add to Home Screen
                </Dialog.Title>
                <Dialog.Close
                  className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                  aria-label="Close instructions"
                >
                  <X className="h-5 w-5" />
                </Dialog.Close>
              </div>

              <Dialog.Description className="sr-only">
                Follow these steps to add this app to your iOS home screen
              </Dialog.Description>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sage/10">
                    <Share className="h-5 w-5 text-sage" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">1. Tap the Share button</p>
                    <p className="text-sm text-text-secondary">Find it at the bottom of Safari</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sage/10">
                    <Plus className="h-5 w-5 text-sage" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">
                      2. Tap &ldquo;Add to Home Screen&rdquo;
                    </p>
                    <p className="text-sm text-text-secondary">
                      Scroll down in the share menu to find it
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sage/10">
                    <Download className="h-5 w-5 text-sage" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">3. Tap &ldquo;Add&rdquo;</p>
                    <p className="text-sm text-text-secondary">
                      The app will appear on your home screen
                    </p>
                  </div>
                </div>
              </div>

              <Button
                variant="sage"
                size="lg"
                onClick={() => setShowIOSInstructions(false)}
                className="mt-6 w-full"
              >
                Got it
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  // Main install prompt banner
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 p-4',
        'transition-all duration-300 ease-out',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0',
        className
      )}
      role="banner"
      aria-label="Install app prompt"
    >
      <div
        className={cn(
          'mx-auto max-w-lg rounded-3xl bg-white p-4 shadow-2xl',
          'border border-neutral-100'
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-sage/10">
            <Download className="h-6 w-6 text-sage" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-lg font-bold text-text-primary">Install HANDLED</h3>
            <p className="text-sm text-text-secondary">
              {isIOS
                ? 'Add to your home screen for quick access'
                : 'Install for a better experience'}
            </p>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Dismiss install prompt"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex gap-3">
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="flex-1">
            Not now
          </Button>
          <Button
            variant="sage"
            size="sm"
            onClick={handleInstall}
            isLoading={status === 'prompting'}
            loadingText="Installing..."
            className="flex-1"
          >
            {isIOS ? 'Show me how' : 'Install'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Minimal install button for use in settings or menus.
 */
export function InstallButton({ className }: { className?: string }) {
  const { canInstall, isIOS, prompt, status, isInstalled } = usePWAInstall();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  const handleClick = useCallback(async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    await prompt();
  }, [isIOS, prompt]);

  if (!canInstall || isInstalled) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        isLoading={status === 'prompting'}
        className={className}
      >
        <Download className="mr-2 h-4 w-4" />
        {isIOS ? 'Add to Home Screen' : 'Install App'}
      </Button>

      <Dialog.Root open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={cn(
              'fixed inset-0 z-50 bg-black/50',
              'data-[state=open]:animate-in data-[state=open]:fade-in-300',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-300',
              'motion-reduce:animate-none'
            )}
          />
          <Dialog.Content
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 p-4',
              'data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0',
              'data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=closed]:fade-out-0',
              'motion-reduce:animate-none'
            )}
          >
            <div className="w-full rounded-3xl bg-white p-6 shadow-2xl">
              <Dialog.Title className="mb-4 font-serif text-lg font-bold">
                Add to Home Screen
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Follow these steps to add this app to your iOS home screen
              </Dialog.Description>
              <ol className="mb-4 list-inside list-decimal space-y-2 text-sm text-text-secondary">
                <li>
                  Tap the <Share className="inline h-4 w-4" /> Share button
                </li>
                <li>Scroll down and tap &ldquo;Add to Home Screen&rdquo;</li>
                <li>Tap &ldquo;Add&rdquo; in the top right</li>
              </ol>
              <Button
                variant="sage"
                size="sm"
                onClick={() => setShowIOSInstructions(false)}
                className="w-full"
              >
                Got it
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
