'use client';

import { useEffect, useState } from 'react';

/**
 * Scrolling Identity Animation
 *
 * Displays "You're a [profession], so [verb]." with rotating text.
 * Showcases the range of service professionals HANDLED serves.
 * Cheeky but competent - no chaos, no meltdowns.
 */

const identities = [
  // Core audience - establish who we serve
  { profession: 'photographer', verb: 'capture moments' },
  { profession: 'therapist', verb: 'hold space' },
  { profession: 'coach', verb: 'unlock potential' },
  { profession: 'wedding planner', verb: 'orchestrate magic' },
  { profession: 'consultant', verb: 'solve problems' },
  { profession: 'trainer', verb: 'transform lives' },
  { profession: 'designer', verb: 'create beauty' },
  { profession: 'doula', verb: 'guide journeys' },
];

export function ScrollingIdentity() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % identities.length);
        setIsAnimating(false);
      }, 150);
    }, 2500); // ~20 second full loop (8 items × 2.5s)

    return () => clearInterval(interval);
  }, []);

  const current = identities[currentIndex];

  return (
    <span className="inline-block min-w-[320px] sm:min-w-[480px] md:min-w-[600px]">
      <span
        className={`inline-block transition-all duration-200 ease-out ${
          isAnimating
            ? 'opacity-0 -translate-y-1'
            : 'opacity-100 translate-y-0'
        }`}
      >
        <span className="text-sage">{current.profession}</span>
        <span className="text-text-primary">, so </span>
        <span className="text-sage">{current.verb}</span>
      </span>
      {/* Blinking cursor signals dynamic text */}
      <span className="animate-pulse text-sage/70 font-light">|</span>
    </span>
  );
}
