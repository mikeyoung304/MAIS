'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface StickyMobileCTAProps {
  /** Text to display on the CTA button */
  ctaText?: string;
  /** Anchor link target (e.g., "#packages") */
  href?: string;
  /** ID of the element to observe for visibility (e.g., "hero-section") */
  observeElementId?: string;
}

/**
 * StickyMobileCTA - Fixed bottom CTA that appears on mobile after scrolling past hero.
 *
 * Uses IntersectionObserver for performance (no scroll listeners).
 * Hidden on desktop (md+) to avoid cluttering the UI.
 *
 * Architecture decision: We observe when the hero section exits the viewport
 * rather than tracking scroll position. This is more performant and
 * works correctly with variable hero heights.
 *
 * @example
 * <StickyMobileCTA
 *   ctaText="View Packages"
 *   href="#packages"
 *   observeElementId="hero-section"
 * />
 */
export function StickyMobileCTA({
  ctaText = 'View Services',
  href = '#packages',
  observeElementId = 'main-content',
}: StickyMobileCTAProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Find the element to observe (usually the hero or main content container)
    const targetElement = document.getElementById(observeElementId);

    if (!targetElement) {
      // Log warning in development, fail gracefully in production
      if (process.env.NODE_ENV === 'development') {
        console.warn(`StickyMobileCTA: Element #${observeElementId} not found`);
      }
      return;
    }

    // Create an observer that triggers when the element scrolls out of view
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show CTA when the observed element is NOT fully visible
        // (i.e., user has scrolled past it)
        setIsVisible(!entry.isIntersecting);
      },
      {
        // Trigger when top of element leaves the viewport
        threshold: 0,
        rootMargin: '-100px 0px 0px 0px', // Offset to account for header
      }
    );

    observer.observe(targetElement);

    return () => {
      observer.disconnect();
    };
  }, [observeElementId]);

  // Only show when mounted AND visible (prevents hydration mismatch)
  const shouldShow = isMounted && isVisible;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe transition-transform duration-300 md:hidden ${
        shouldShow ? 'translate-y-0' : 'translate-y-full'
      }`}
      role="complementary"
      aria-label="Quick action"
    >
      {/* Background blur and gradient for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/95 to-white/80 backdrop-blur-sm" />

      {/* CTA Button */}
      <div className="relative">
        <Button asChild variant="accent" size="xl" className="w-full shadow-lg">
          <a href={href}>{ctaText}</a>
        </Button>
      </div>
    </div>
  );
}
