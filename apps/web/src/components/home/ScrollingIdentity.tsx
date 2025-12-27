'use client';

import { useEffect, useState } from 'react';

/**
 * Scrolling Identity Animation
 *
 * Displays "You're a [profession], so [verb]." with playful
 * rotating text. Mix of serious and humorous options.
 */

const identities = [
  // === PHASE 1: Normal & Relatable (0-30 seconds) ===
  { profession: 'photographer', verb: 'shoot' },
  { profession: 'therapist', verb: 'listen' },
  { profession: 'chef', verb: 'cook' },
  { profession: 'yoga instructor', verb: 'breathe' },
  { profession: 'wedding planner', verb: 'orchestrate chaos' },
  { profession: 'personal trainer', verb: 'yell encouragingly' },
  { profession: 'realtor', verb: 'unlock doors' },
  { profession: 'dog walker', verb: 'get dragged around' },
  { profession: 'tattoo artist', verb: 'make permanent decisions' },
  { profession: 'developer', verb: 'google things' },
  { profession: 'designer', verb: 'move pixels' },
  { profession: 'writer', verb: 'procrastinate' },

  // === PHASE 2: Getting Weird (30-50 seconds) ===
  { profession: 'cat whisperer', verb: 'be ignored' },
  { profession: 'spreadsheet wizard', verb: 'vlookup' },
  { profession: 'professional overthinker', verb: 'overthink' },
  { profession: 'chaos gremlin', verb: 'gremlin' },
  { profession: 'pirate', verb: 'arrr' },
  { profession: 'vibe archaeologist', verb: 'excavate vibes' },
  { profession: 'chaos sommelier', verb: 'pair anxieties' },
  { profession: 'silence consultant', verb: '...' },

  // === PHASE 3: Why Are You Still Here (50-70 seconds) ===
  { profession: 'person who is still reading this', verb: 'keep reading' },
  { profession: 'commitment enthusiast', verb: 'not scroll away' },
  { profession: 'loop observer', verb: 'observe loops' },
  { profession: 'waiting room professional', verb: 'wait' },
  { profession: 'scroll completionist', verb: 'see every option' },
  { profession: 'pattern recognition specialist', verb: 'notice this repeats' },

  // === PHASE 4: Existential Dread (70-90 seconds) ===
  { profession: 'mortal', verb: 'experience linear time' },
  { profession: 'temporary arrangement of atoms', verb: 'briefly cohere' },
  { profession: 'consciousness trapped in a meat suit', verb: 'contemplate' },
  { profession: 'person avoiding something else', verb: 'avoid it' },
  { profession: 'witness to entropy', verb: 'witness' },
  { profession: 'future skeleton', verb: 'delay the inevitable' },

  // === PHASE 5: Breaking the Fourth Wall (90+ seconds) ===
  { profession: 'person who should probably sign up now', verb: 'sign up' },
  { profession: 'hero of your own story', verb: 'click the button' },
  { profession: 'someone this website believes in', verb: 'believe in yourself' },
  { profession: 'legend', verb: 'join the club already' },
  { profession: 'friend', verb: 'stop reading and do the thing' },
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
