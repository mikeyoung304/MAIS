'use client';

import { useEffect, useState } from 'react';

/**
 * Scrolling Identity Animation
 *
 * Displays "You're a [profession], so [verb]." with playful
 * rotating text. Mix of serious and humorous options.
 */

const identities = [
  { profession: 'photographer', verb: 'photograph' },
  { profession: 'life coach', verb: 'coach' },
  { profession: 'chef', verb: 'chef' },
  { profession: 'consultant', verb: 'consult' },
  { profession: 'wedding planner', verb: 'plan' },
  { profession: 'therapist', verb: 'heal' },
  { profession: 'personal trainer', verb: 'train' },
  { profession: 'artist', verb: 'create' },
  { profession: 'musician', verb: 'play' },
  { profession: 'yoga instructor', verb: 'flow' },
  { profession: 'pirate', verb: 'pirate' },
  { profession: 'dog walker', verb: 'walk' },
  { profession: 'realtor', verb: 'sell' },
  { profession: 'designer', verb: 'design' },
  { profession: 'developer', verb: 'ship' },
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
    <span className="inline-block min-w-[280px] sm:min-w-[320px]">
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
