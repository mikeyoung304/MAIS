'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * useScrollReveal — Intersection Observer utility for scroll-triggered animations
 *
 * Progressive enhancement:
 * - Elements start visible (opacity: 1) for SSR safety
 * - Hook sets initial opacity to 0 on mount (client-only)
 * - IntersectionObserver adds .reveal-visible class when element enters viewport
 * - prefers-reduced-motion: elements stay visible, no animation
 */
export function useScrollReveal(options?: { threshold?: number }) {
  const threshold = options?.threshold ?? 0.15;
  const elements = useRef<Set<HTMLElement>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold, rootMargin: '0px 0px -50px 0px' }
    );

    observerRef.current = observer;

    // Observe any elements already registered
    for (const el of elements.current) {
      el.style.opacity = '0';
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [threshold]);

  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    elements.current.add(node);

    // If observer already exists, observe immediately
    if (observerRef.current) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion) {
        node.style.opacity = '0';
        observerRef.current.observe(node);
      }
    }
  }, []);

  return ref;
}
