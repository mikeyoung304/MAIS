'use client';

import { useEffect, useState } from 'react';

/**
 * Scrolling Identity Animation
 *
 * Displays "You're a [profession], so [verb]." with playful
 * rotating text. The "so X" format tells them to DO their job,
 * because we handle the rest.
 *
 * Philosophy: Identity-first marketing. When someone sees their
 * profession, they feel SEEN. Then the verb gives them permission
 * to get back to what they love.
 */

const identities = [
  // === PHASE 1: Core Professions (0-12 seconds) ===
  // Lead with the most common, land the emotional punch
  { profession: 'photographer', verb: 'capture moments' },
  { profession: 'therapist', verb: 'hold space' },
  { profession: 'coach', verb: 'unlock potential' },
  { profession: 'wedding planner', verb: 'make magic' },
  { profession: 'consultant', verb: 'solve problems' },

  // === PHASE 2: Expanded Professions (12-22 seconds) ===
  { profession: 'personal trainer', verb: 'change lives' },
  { profession: 'massage therapist', verb: 'heal bodies' },
  { profession: 'financial advisor', verb: 'build futures' },
  { profession: 'interior designer', verb: 'create beauty' },

  // === PHASE 3: Getting Cheeky (22-32 seconds) ===
  { profession: 'reluctant IT department', verb: 'stop being one' },
  { profession: 'accidental bookkeeper', verb: 'close that spreadsheet' },
  { profession: 'human who answers emails at 11pm', verb: 'go to sleep' },

  // === PHASE 4: Easter Eggs (32-42 seconds) ===
  { profession: 'person still reading this', verb: 'keep watching' },
  { profession: 'easter egg hunter', verb: 'you found one' },
  { profession: 'human with better things to do', verb: 'go do them' },

  // === PHASE 5: The Close (42+ seconds) ===
  { profession: 'legend who scrolled this far', verb: 'get handled' },
  { profession: 'future member', verb: 'join us' },
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
    <span className="inline-block min-w-[320px] sm:min-w-[480px] md:min-w-[600px]">
      <span
        className={`inline-block transition-all duration-300 ${
          isAnimating
            ? 'opacity-0 translate-y-2'
            : 'opacity-100 translate-y-0'
        }`}
      >
        <span className="text-terracotta">{current.profession}</span>
        <span className="text-text-primary">, so </span>
        <span className="text-terracotta">{current.verb}</span>
      </span>
    </span>
  );
}
