'use client';

/**
 * RevealTransition - One-shot animated reveal when first draft completes
 *
 * P0: iframe MUST be ready before animation starts. The component pre-loads
 * the iframe behind the ComingSoon overlay, listens for onLoad, then kicks
 * off the animation sequence.
 *
 * Desktop (2.5s): ComingSoon fades out → white flash → iframe fades in from below → auto-scroll
 * Mobile (1.5s): ComingSoon fades out → iframe fades in (no scroll tour)
 * prefers-reduced-motion: Instant switch, no animation
 *
 * @see plans/2026-02-06-feat-dashboard-onboarding-rebuild-plan.md (lines 429-479)
 * @see stores/agent-ui-store.ts for ViewState 'revealing'
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion, useIsMobile } from '@/hooks/useBreakpoint';
import { usePreviewToken } from '@/hooks/usePreviewToken';
import { buildPreviewUrl } from '@/lib/preview-utils';
import { ComingSoonDisplay } from './ComingSoonDisplay';

// ============================================
// TYPES
// ============================================

interface RevealTransitionProps {
  /** Tenant slug for building iframe URL */
  slug: string | null | undefined;
  /** Called when the reveal animation completes → agentUIActions.showPreview() */
  onComplete: () => void;
}

// ============================================
// ANIMATION TIMING (ms)
// ============================================

const TIMING = {
  /** ComingSoon fade-out duration */
  fadeOut: 400,
  /** Delay before flash starts (overlaps slightly with fade-out end) */
  flashDelay: 300,
  /** Flash duration */
  flash: 300,
  /** Delay before iframe fade-in */
  iframeDelay: 500,
  /** Iframe fade-in duration */
  iframeFadeIn: 800,
  /** Delay before auto-scroll starts */
  scrollDelay: 1300,
  /** Auto-scroll duration */
  scrollDuration: 2000,
  /** Total time before onComplete fires */
  totalDesktop: 3300,
  /** Mobile: simpler, shorter sequence */
  totalMobile: 1500,
} as const;

// ============================================
// ANIMATED REVEAL SEQUENCE (Desktop)
// ============================================

interface AnimatedRevealSequenceProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onComplete: () => void;
  isMobile: boolean;
}

function AnimatedRevealSequence({ iframeRef, onComplete, isMobile }: AnimatedRevealSequenceProps) {
  const [phase, setPhase] = useState<'fade-out' | 'flash' | 'fade-in' | 'scroll' | 'done'>(
    'fade-out'
  );

  // Drive the animation sequence with timers (component owns the timer, not the store)
  useEffect(() => {
    const total = isMobile ? TIMING.totalMobile : TIMING.totalDesktop;

    const timers: ReturnType<typeof setTimeout>[] = [];

    if (!isMobile) {
      // Desktop sequence: fade-out → flash → fade-in → scroll → done
      timers.push(setTimeout(() => setPhase('flash'), TIMING.flashDelay));
      timers.push(setTimeout(() => setPhase('fade-in'), TIMING.iframeDelay));
      timers.push(setTimeout(() => setPhase('scroll'), TIMING.scrollDelay));
    } else {
      // Mobile: just fade-in, no flash or scroll
      timers.push(setTimeout(() => setPhase('fade-in'), TIMING.fadeOut));
    }

    // Final: fire onComplete
    timers.push(
      setTimeout(() => {
        setPhase('done');
        onComplete();
      }, total)
    );

    return () => timers.forEach(clearTimeout);
  }, [isMobile, onComplete]);

  // Auto-scroll the iframe from top to bottom (desktop only)
  useEffect(() => {
    if (phase !== 'scroll' || isMobile) return;

    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    // Cross-origin safety: contentDocument access throws SecurityError if iframe
    // is on a different origin (e.g., tenant subdomain or CDN split).
    // The reveal animation still works without scroll — graceful degradation.
    let scrollHeight: number;
    try {
      const doc = iframe.contentDocument ?? iframe.contentWindow.document;
      scrollHeight = doc.documentElement.scrollHeight - doc.documentElement.clientHeight;
    } catch {
      return; // Cross-origin — skip auto-scroll
    }

    if (scrollHeight <= 0) return;

    const startTime = performance.now();
    let rafId: number;

    const scroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / TIMING.scrollDuration, 1);
      // Ease-in-out for natural feel
      const eased =
        progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      iframe.contentWindow?.scrollTo(0, eased * scrollHeight);

      if (progress < 1) {
        rafId = requestAnimationFrame(scroll);
      }
    };

    rafId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(rafId);
  }, [phase, isMobile, iframeRef]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* ComingSoon layer — fades out first */}
      <AnimatePresence>
        {phase === 'fade-out' && (
          <motion.div
            className="absolute inset-0 z-20"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: TIMING.fadeOut / 1000, ease: 'easeOut' }}
          >
            <ComingSoonDisplay buildingIndicator="Putting finishing touches on..." />
          </motion.div>
        )}
      </AnimatePresence>

      {/* White flash overlay — "camera flash" effect (desktop only) */}
      {!isMobile && (
        <AnimatePresence>
          {phase === 'flash' && (
            <motion.div
              className="absolute inset-0 z-30 bg-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: TIMING.flash / 1000 }}
            />
          )}
        </AnimatePresence>
      )}

      {/* Iframe layer — fades in from below (desktop) or just fades in (mobile) */}
      <motion.div
        className="absolute inset-0 z-10"
        initial={isMobile ? { opacity: 0 } : { opacity: 0, y: 40 }}
        animate={
          phase === 'fade-in' || phase === 'scroll' || phase === 'done'
            ? isMobile
              ? { opacity: 1 }
              : { opacity: 1, y: 0 }
            : undefined
        }
        transition={
          isMobile
            ? { duration: (TIMING.totalMobile - TIMING.fadeOut) / 1000, ease: 'easeOut' }
            : { duration: TIMING.iframeFadeIn / 1000, type: 'spring', damping: 20, stiffness: 200 }
        }
      >
        {/* The iframe is already mounted and ready — just revealed here */}
      </motion.div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RevealTransition({ slug, onComplete }: RevealTransitionProps) {
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobileQuery = useIsMobile();
  const isMobile = isMobileQuery ?? false;
  const { token: previewToken, isLoading: isTokenLoading } = usePreviewToken();

  // Build iframe URL (shared helper — always loads 'home')
  const iframeUrl = useMemo(() => buildPreviewUrl(slug, previewToken), [slug, previewToken]);

  // Handle iframe load — marks ready for animation
  const handleIframeLoad = useCallback(() => {
    setIframeReady(true);
  }, []);

  // Stable onComplete ref to avoid re-creating animation sequence
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const stableOnComplete = useCallback(() => onCompleteRef.current(), []);

  // prefers-reduced-motion: instant switch, skip to preview immediately
  useEffect(() => {
    if (prefersReducedMotion && iframeReady) {
      onComplete();
    }
  }, [prefersReducedMotion, iframeReady, onComplete]);

  // Don't render iframe until we have a URL
  if (!iframeUrl || isTokenLoading) {
    return <ComingSoonDisplay buildingIndicator="Preparing your site..." />;
  }

  // prefers-reduced-motion: no animation at all
  if (prefersReducedMotion) {
    return (
      <div className="h-full w-full relative" data-testid="reveal-transition-reduced">
        <iframe
          ref={iframeRef}
          src={iframeUrl}
          className="w-full h-full border-0"
          onLoad={handleIframeLoad}
          title="Website preview"
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full relative" data-testid="reveal-transition">
      {/* Pre-load iframe behind ComingSoon overlay — invisible until animation reveals it */}
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        className="absolute inset-0 w-full h-full border-0 z-0"
        onLoad={handleIframeLoad}
        title="Website preview"
      />

      {/* Wait for iframe readiness (P0 guard) */}
      {!iframeReady ? (
        <div className="absolute inset-0 z-20">
          <ComingSoonDisplay buildingIndicator="Putting finishing touches on..." />
        </div>
      ) : (
        <AnimatedRevealSequence
          iframeRef={iframeRef}
          onComplete={stableOnComplete}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

export default RevealTransition;
