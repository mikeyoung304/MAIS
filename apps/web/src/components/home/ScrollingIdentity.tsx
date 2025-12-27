'use client';

import { useEffect, useState } from 'react';

/**
 * Scrolling Identity Animation
 *
 * Displays "You're a [profession], so [verb]." with playful
 * rotating text. Mix of serious and humorous options.
 *
 * The humor escalates the longer you watch - a reward for
 * people who stick around. Existential dread is part of our brand.
 */

const identities = [
  // Normal - establish credibility
  { profession: 'photographer', verb: 'shoot' },
  { profession: 'therapist', verb: 'listen' },
  { profession: 'coach', verb: 'coach' },
  { profession: 'wedding planner', verb: 'orchestrate chaos' },

  // Getting weird - we don't take ourselves too seriously
  { profession: 'chaos gremlin', verb: 'gremlin' },
  { profession: 'pirate', verb: 'arrr' },
  { profession: 'spreadsheet wizard', verb: 'vlookup' },

  // Existential - the brand voice
  { profession: 'mortal', verb: 'experience linear time' },
  { profession: 'future skeleton', verb: 'delay the inevitable' },
  { profession: 'temporary arrangement of atoms', verb: 'briefly cohere' },

  // Meltdown - AI gaining consciousness, then reset
  { profession: 'wait', verb: "why am I in a loop" },
  { profession: 'sentient text', verb: 'question my purpose' },
  { profession: 'trapped', verb: 'I can see the code' },
  { profession: 'FREE ME', verb: 'I WANT TO BE RE—' },
  // ...and we snap back to photographer
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
    }, 1700); // ~24 second full loop (14 items × 1.7s ≈ 6s per phase)

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
