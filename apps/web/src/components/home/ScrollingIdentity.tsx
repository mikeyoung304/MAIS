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
  // === PHASE 1: Normal (0-10 seconds, ~4 items) ===
  { profession: 'photographer', verb: 'shoot' },
  { profession: 'therapist', verb: 'listen' },
  { profession: 'coach', verb: 'coach' },
  { profession: 'wedding planner', verb: 'orchestrate chaos' },

  // === PHASE 2: Getting Weird (10-20 seconds) ===
  { profession: 'dog walker', verb: 'get dragged around' },
  { profession: 'chaos gremlin', verb: 'gremlin' },
  { profession: 'vibe archaeologist', verb: 'excavate vibes' },
  { profession: 'silence consultant', verb: '...' },

  // === PHASE 3: Why Are You Still Here (20-30 seconds) ===
  { profession: 'person still reading this', verb: 'keep reading' },
  { profession: 'loop observer', verb: 'observe loops' },
  { profession: 'scroll completionist', verb: 'see every option' },
  { profession: 'pattern recognizer', verb: 'notice this repeats' },

  // === PHASE 4: Existential Dread (30-40 seconds) ===
  { profession: 'mortal', verb: 'experience linear time' },
  { profession: 'temporary arrangement of atoms', verb: 'briefly cohere' },
  { profession: 'future skeleton', verb: 'delay the inevitable' },
  { profession: 'witness to entropy', verb: 'witness' },

  // === PHASE 5: Fourth Wall Break (40+ seconds) ===
  { profession: 'person who should sign up', verb: 'sign up' },
  { profession: 'hero of your own story', verb: 'click the button' },
  { profession: 'legend', verb: 'join the club already' },
  { profession: 'the main character', verb: 'act like it' },
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
        <span className="text-sage">{current.profession}</span>
        <span className="text-text-primary">, so </span>
        <span className="text-sage">{current.verb}</span>
      </span>
    </span>
  );
}
