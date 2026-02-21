'use client';

/**
 * OnboardingVideo — Welcome video shown during initial build phase
 *
 * Plays an autoplay muted loop video while the build runs in the background.
 * Gracefully degrades: prefers-reduced-motion shows poster, onError skips.
 *
 * Props:
 * - onSkip: called when user clicks Skip or video encounters unrecoverable error
 * - buildComplete: when true, overlays a "ready" indicator
 *
 * Note: The video uses `loop` for continuous playback during the build process,
 * which means `ended` events never fire. Build completion triggers transitions
 * from the parent component, not from video playback ending.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { usePrefersReducedMotion } from '@/hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnboardingVideoProps {
  onSkip: () => void;
  buildComplete?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingVideo({ onSkip, buildComplete }: OnboardingVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showSkip, setShowSkip] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion() ?? false;

  // -------------------------------------------------------------------------
  // Show Skip button after 3 seconds
  // -------------------------------------------------------------------------

  useEffect(() => {
    const timer = setTimeout(() => setShowSkip(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // -------------------------------------------------------------------------
  // Attempt autoplay on mount (browsers may reject)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (prefersReducedMotion || !videoRef.current) return;

    videoRef.current.play().catch(() => {
      logger.warn('OnboardingVideo: autoplay rejected, showing poster fallback');
      setPlaybackFailed(true);
    });
  }, [prefersReducedMotion]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleVideoError = useCallback(() => {
    logger.warn('OnboardingVideo: video failed to load, showing fallback');
    setPlaybackFailed(true);
  }, []);

  const handleSkip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  const handleSkipKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSkip();
      }
    },
    [onSkip]
  );

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  const handlePlayClick = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        logger.warn('OnboardingVideo: manual play failed');
      });
      setPlaybackFailed(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Reduced motion: static poster with play button
  // -------------------------------------------------------------------------

  if (prefersReducedMotion) {
    return (
      <div className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden bg-neutral-800">
        {/* Static poster placeholder */}
        <div className="aspect-video flex items-center justify-center bg-surface-alt">
          <button
            onClick={handlePlayClick}
            className="flex items-center gap-3 px-6 py-3 rounded-full bg-sage/90 text-white text-sm font-medium hover:bg-sage transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            aria-label="Play onboarding welcome video"
          >
            <PlayIcon />
            Play video
          </button>
        </div>

        {/* Skip button — always visible in reduced motion */}
        <SkipButton onSkip={handleSkip} onKeyDown={handleSkipKeyDown} visible />

        {/* Build complete overlay */}
        {buildComplete && <BuildReadyOverlay />}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Full video experience
  // -------------------------------------------------------------------------

  return (
    <div className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden bg-neutral-800">
      {/* Video element */}
      {/* loop is intentional — video plays continuously during build.
           Build completion triggers transitions via parent, not video end. (11103) */}
      <video
        ref={videoRef}
        className="w-full aspect-video object-cover"
        src="/videos/onboarding-welcome.mp4"
        muted={isMuted}
        loop
        playsInline
        aria-label="Onboarding welcome video"
        onError={handleVideoError}
      />

      {/* Playback failed fallback: show play button over poster */}
      {playbackFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/60">
          <button
            onClick={handlePlayClick}
            className="flex items-center gap-3 px-6 py-3 rounded-full bg-sage/90 text-white text-sm font-medium hover:bg-sage transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            aria-label="Play onboarding welcome video"
          >
            <PlayIcon />
            Play video
          </button>
        </div>
      )}

      {/* Mute/unmute toggle — top-right */}
      <button
        onClick={toggleMute}
        className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 text-white/80 hover:bg-black/70 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
      >
        {isMuted ? <MuteIcon /> : <UnmuteIcon />}
      </button>

      {/* Skip button — appears after 3s */}
      <SkipButton onSkip={handleSkip} onKeyDown={handleSkipKeyDown} visible={showSkip} />

      {/* Build complete overlay */}
      {buildComplete && <BuildReadyOverlay />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkipButton({
  onSkip,
  onKeyDown,
  visible,
}: {
  onSkip: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  visible: boolean;
}) {
  return (
    <div
      className={`absolute bottom-4 right-4 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <button
        onClick={onSkip}
        onKeyDown={onKeyDown}
        tabIndex={0}
        className="min-w-[44px] min-h-[44px] px-4 py-2.5 rounded-full bg-black/60 text-white/90 text-sm font-medium hover:bg-black/80 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        aria-label="Skip video"
      >
        Skip video
      </button>
    </div>
  );
}

function BuildReadyOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface/70 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-sage/20 flex items-center justify-center">
          <svg
            className="w-7 h-7 text-sage"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-serif text-xl font-bold text-text-primary">Your website is ready!</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PlayIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  );
}

function UnmuteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728"
      />
    </svg>
  );
}
