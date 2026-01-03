'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="text-sage inline-block"
            style={{ willChange: 'transform, opacity' }}
          >
            {profession}
          </motion.span>
        </AnimatePresence>
        , so{' '}
        <AnimatePresence mode="wait">
          <motion.span
            key={`verb-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="inline-block"
            style={{ willChange: 'transform, opacity' }}
          >
            {verb}
          </motion.span>
        </AnimatePresence>
        .
      </h1>
    </>
  );
}
