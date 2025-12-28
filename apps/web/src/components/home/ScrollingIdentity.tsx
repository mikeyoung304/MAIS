'use client';

import { useEffect, useState } from 'react';

/**
 * Scrolling Identity Animation
 *
 * Displays "You're a [profession], so [verb]." with rotating text.
 * Direct verb matching - photographer photographs, therapist therapizes.
 * Fast, punchy, slightly absurd. Clean swap - both words change together.
 */

const identities = [
  { profession: 'photographer', verb: 'photograph' },
  { profession: 'therapist', verb: 'therapize' },
  { profession: 'private chef', verb: 'chef' },
  { profession: 'coach', verb: 'coach' },
  { profession: 'trainer', verb: 'train' },
  { profession: 'consultant', verb: 'consult' },
  { profession: 'designer', verb: 'design' },
  { profession: 'stylist', verb: 'style' },
  { profession: 'doula', verb: 'doul?' },
  { profession: 'esthetician', verb: 'estheticize?' },
  { profession: 'wedding planner', verb: 'plan weddings' },
  { profession: 'nutritionist', verb: 'nutritionate' },
];

export function ScrollingIdentity() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setIsVisible(false);

      // Change text and fade in
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % identities.length);
        setIsVisible(true);
      }, 200);
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-grid">
      {identities.map((identity, index) => (
        <span
          key={identity.profession}
          className={`col-start-1 row-start-1 transition-opacity duration-200 ${
            index === currentIndex && isVisible ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={index !== currentIndex}
        >
          <span className="text-sage">{identity.profession}</span>
          <span className="text-text-primary">, so </span>
          <span className="text-sage">{identity.verb}</span>
        </span>
      ))}
    </span>
  );
}
