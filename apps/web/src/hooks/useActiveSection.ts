'use client';

import { useState, useEffect } from 'react';

/**
 * useActiveSection — Intersection Observer hook for active nav highlighting
 *
 * Watches multiple section elements by ID and returns the ID of the
 * most visible section. Unlike useScrollReveal (which unobserves after
 * first intersection), this observer persists to track scroll position.
 *
 * SSR-safe: returns null during server rendering.
 *
 * @param sectionIds - Array of section element IDs to observe
 * @param options - IO options (threshold, rootMargin)
 */
export function useActiveSection(
  sectionIds: string[],
  options?: { threshold?: number; rootMargin?: string }
): string | null {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || sectionIds.length === 0) return;

    const threshold = options?.threshold ?? 0.3;
    const rootMargin = options?.rootMargin ?? '-80px 0px 0px 0px';

    // Track visibility ratios for all observed sections
    const visibilityMap = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibilityMap.set(entry.target.id, entry.intersectionRatio);
        }

        // Find the section with the highest visibility ratio
        let maxRatio = 0;
        let maxId: string | null = null;
        for (const [id, ratio] of visibilityMap) {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            maxId = id;
          }
        }

        if (maxId && maxRatio > 0) {
          setActiveSection(maxId);
        }
      },
      {
        threshold: [0, threshold, 0.5, 1],
        rootMargin,
      }
    );

    // Observe all section elements
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
      }
    }

    return () => observer.disconnect();
  }, [sectionIds.join(','), options?.threshold, options?.rootMargin]);

  return activeSection;
}
