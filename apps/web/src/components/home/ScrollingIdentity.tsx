'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// ✅ FIX: Move outside component to prevent stale closure (DHH)
const IDENTITIES = [
  { profession: 'photographer', verb: 'capture moments' },
  { profession: 'therapist', verb: 'hold space' },
  { profession: 'coach', verb: 'unlock potential' },
  { profession: 'wedding planner', verb: 'create magic' },
  { profession: 'consultant', verb: 'solve problems' },
] as const;

export function ScrollingIdentity() {
  const [index, setIndex] = useState(0);
  // ✅ FIX: SSR hydration guard to prevent layout shift (Kieran)
  const [isClient, setIsClient] = useState(false);
  // P1 FIX: Respect prefers-reduced-motion (WCAG 2.3.3)
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    setIsClient(true);
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % IDENTITIES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const { profession, verb } = IDENTITIES[index];

  // ✅ FIX: Static fallback during SSR (Kieran)
  if (!isClient) {
    return (
      <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.1] tracking-tight">
        You're a <span className="text-sage">photographer</span>, so capture moments.
      </h1>
    );
  }

  return (
    <>
      {/* ✅ FIX: Screen reader gets static message, not chaos (DHH) */}
      <span className="sr-only">You're a service professional, so focus on what you do best.</span>
      <h1
        aria-hidden="true"
        className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.1] tracking-tight"
      >
        You're a{' '}
        <AnimatePresence mode="wait">
          <motion.span
            key={`profession-${index}`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -20 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4 }}
            className="text-sage inline-block"
            style={{ willChange: prefersReducedMotion ? 'auto' : 'transform, opacity' }}
          >
            {profession}
          </motion.span>
        </AnimatePresence>
        , so{' '}
        <AnimatePresence mode="wait">
          <motion.span
            key={`verb-${index}`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -20 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay: 0.1 }}
            className="inline-block"
            style={{ willChange: prefersReducedMotion ? 'auto' : 'transform, opacity' }}
          >
            {verb}
          </motion.span>
        </AnimatePresence>
        .
      </h1>
    </>
  );
}
