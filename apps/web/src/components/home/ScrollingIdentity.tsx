'use client';

import { useEffect, useState } from 'react';

/**
 * Scrolling Identity Animation
 *
 * Displays "You're a [profession], so [verb]." with playful
 * rotating text. Mix of serious and humorous options.
 */

const identities = [
  // === PHASE 1: Normal (0-10 seconds, ~4 items) ===
  { profession: 'photographer', verb: 'shoot' },
  { profession: 'therapist', verb: 'listen' },
  { profession: 'coach', verb: 'coach' },
  { profession: 'wedding planner', verb: 'orchestrate chaos' },

  // === PHASE 2: Getting Weird (10-20 seconds) ===
  { profession: 'reluctant IT department', verb: 'google error messages' },
  { profession: 'accidental accountant', verb: 'stare at spreadsheets' },
  { profession: 'chaos gremlin', verb: 'gremlin' },

  // === PHASE 3: Why Are You Still Here (20-30 seconds) ===
  { profession: 'person still reading this', verb: 'keep reading' },
  { profession: 'easter egg hunter', verb: 'find the weird ones' },

  // === PHASE 4: Existential Dread (30-40 seconds) ===
  { profession: 'future skeleton', verb: 'delay the inevitable' },
  { profession: 'temporary arrangement of atoms', verb: 'briefly cohere' },

  // === PHASE 5: Fourth Wall Break (40+ seconds) ===
  { profession: 'person who should sign up', verb: 'get handled' },
  { profession: 'legend', verb: 'join already' },
  { profession: 'hire us already', verb: '(please)' },
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
      }, 300);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const current = identities[currentIndex];

  return (
    <span className="inline-block min-w-[320px] sm:min-w-[480px] md:min-w-[540px]">
      <span
        className={`inline-block transition-all duration-300 ${
          isAnimating
            ? 'opacity-0 translate-y-2'
            : 'opacity-100 translate-y-0'
        }`}
      >
        <span className="text-sage">{current.profession}</span>
        <span className="text-text-primary">, so </span>
        <span className="text-sage">{current.verb}</span>
      </span>
    </span>
  );
}
