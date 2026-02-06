'use client';

/**
 * PublishConfirmation - Celebration modal shown after site publish
 *
 * Renders a full-screen overlay with canvas-based confetti (2s) and
 * share actions (copy link, Web Share API, social fallbacks).
 *
 * Displayed when publishStatus === 'published' in the refinement store.
 * The layout controls visibility via local state and dismisses on close.
 *
 * WCAG: role="dialog", aria-modal, focus managed on mount.
 *
 * @see stores/refinement-store.ts — publishStatus
 * @see app/(protected)/tenant/layout.tsx — rendering logic
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Copy, ExternalLink, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================
// CONFETTI
// ============================================

/** Individual confetti particle */
interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

/** Brand-aligned confetti palette (sage, teal, amber, violet) */
const CONFETTI_COLORS = ['#6B8F71', '#2DD4BF', '#F59E0B', '#818CF8', '#FB923C', '#A78BFA'];

/** Duration of the confetti animation in ms */
const CONFETTI_DURATION = 2000;
const CONFETTI_FADE_START = 1500;
const PARTICLE_COUNT = 120;

/**
 * Canvas-based confetti animation — self-cleaning after 2 seconds.
 * Uses requestAnimationFrame for 60fps rendering with gravity + drag physics.
 */
function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Spawn particles above viewport
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      size: Math.random() * 8 + 3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
    }));

    const startTime = performance.now();
    let animId: number;

    const draw = (time: number) => {
      const elapsed = time - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.vx *= 0.99; // air drag
        p.rotation += p.rotationSpeed;

        // Fade out in the last 500ms
        if (elapsed > CONFETTI_FADE_START) {
          p.opacity = Math.max(0, 1 - (elapsed - CONFETTI_FADE_START) / 500);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (elapsed < CONFETTI_DURATION) {
        animId = requestAnimationFrame(draw);
      }
    };

    animId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      aria-hidden="true"
    />
  );
}

// ============================================
// PUBLISH CONFIRMATION
// ============================================

export interface PublishConfirmationProps {
  /** Tenant slug for building the site URL */
  slug: string;
  /** Called when the user dismisses the modal */
  onClose: () => void;
}

export function PublishConfirmation({ slug, onClose }: PublishConfirmationProps) {
  const [copied, setCopied] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const siteUrl = typeof window !== 'undefined' ? `${window.location.origin}/t/${slug}` : '';

  // Focus close button on mount (WCAG 2.4.3)
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Clean up copy timer on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(siteUrl);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = siteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [siteUrl]);

  const handleShare = useCallback(async () => {
    // Use Web Share API if available (native share sheet on mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out my new site!',
          url: siteUrl,
        });
        return;
      } catch {
        // User cancelled — fall through to Twitter
      }
    }
    // Fallback: open Twitter/X share intent
    const text = encodeURIComponent('Just launched my site!');
    const url = encodeURIComponent(siteUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  }, [siteUrl]);

  const handleViewSite = useCallback(() => {
    window.open(`/t/${slug}`, '_blank');
    onClose();
  }, [slug, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Site published successfully"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Confetti */}
      <ConfettiCanvas />

      {/* Modal card */}
      <div
        className={cn(
          'relative z-20',
          'bg-white rounded-3xl shadow-2xl',
          'w-[400px] max-w-[90vw] overflow-hidden',
          'animate-in zoom-in-95 fade-in duration-300'
        )}
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>

        {/* Content */}
        <div className="px-8 pt-10 pb-8 text-center">
          {/* Celebration */}
          <div className="text-5xl mb-4" aria-hidden="true">
            🎉
          </div>

          <h2 className="text-2xl font-serif font-semibold text-gray-900 mb-2">
            Your site is live
          </h2>

          {/* URL display */}
          <p className="text-sm text-gray-500 mb-8 font-mono truncate px-2">{siteUrl}</p>

          {/* Copy Link + Share */}
          <div className="flex gap-3 mb-3">
            <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </Button>

            <Button variant="outline" className="flex-1 gap-2" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </Button>
          </div>

          {/* View Your Site CTA */}
          <Button variant="teal" className="w-full gap-2" onClick={handleViewSite}>
            <ExternalLink className="w-4 h-4" />
            View Your Site
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PublishConfirmation;
