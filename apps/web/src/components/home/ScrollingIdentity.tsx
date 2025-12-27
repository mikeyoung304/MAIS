'use client';

import { useEffect, useState } from 'react';

/**
 * Scrolling Identity Animation
 *
 * Displays "You're a [profession], so [verb]." with playful
 * rotating text. Mix of serious and humorous options.
 */

const identities = [
  // Real professions with satisfying verbs
  { profession: 'photographer', verb: 'shoot' },
  { profession: 'therapist', verb: 'listen' },
  { profession: 'chef', verb: 'cook' },
  { profession: 'yoga instructor', verb: 'breathe' },
  { profession: 'wedding planner', verb: 'orchestrate chaos' },
  { profession: 'personal trainer', verb: 'yell encouragingly' },
  { profession: 'life coach', verb: 'ask powerful questions' },
  { profession: 'realtor', verb: 'unlock doors' },
  { profession: 'tattoo artist', verb: 'make permanent decisions' },
  { profession: 'dog walker', verb: 'get dragged around' },
  // Slightly absurd
  { profession: 'cat whisperer', verb: 'be ignored' },
  { profession: 'spreadsheet wizard', verb: 'vlookup' },
  { profession: 'vibe curator', verb: 'curate vibes' },
  { profession: 'chaos coordinator', verb: 'coordinate chaos' },
  { profession: 'professional overthinker', verb: 'overthink' },
  // Tech-adjacent humor
  { profession: 'developer', verb: 'google things' },
  { profession: 'designer', verb: 'move pixels' },
  { profession: 'consultant', verb: 'make decks' },
  // The classics, reimagined
  { profession: 'musician', verb: 'make sounds' },
  { profession: 'artist', verb: 'stare at walls' },
  { profession: 'writer', verb: 'procrastinate' },
  // Wildcard
  { profession: 'pirate', verb: 'arrr' },
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
