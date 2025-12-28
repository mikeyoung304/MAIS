'use client';

import { useEffect, useState } from 'react';

/**
 * Scrolling Identity Animation
 *
 * Displays "You're a [profession], so [verb]." with rotating text.
 * Direct verb matching - photographer photographs, therapist therapizes.
 * Fast, punchy, slightly absurd. The "..." pause adds thinking moment.
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
  const [isAnimating, setIsAnimating] = useState(false);
  const [showEllipsis, setShowEllipsis] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // First show ellipsis (thinking)
      setShowEllipsis(true);

      // Then animate out and change
      setTimeout(() => {
        setIsAnimating(true);
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % identities.length);
          setIsAnimating(false);
          setShowEllipsis(false);
        }, 100);
      }, 400);
    }, 1400); // Fast cycle - ~17 second full loop

    return () => clearInterval(interval);
  }, []);

  const current = identities[currentIndex];

  return (
    <span className="inline-block min-w-[320px] sm:min-w-[480px] md:min-w-[600px]">
      <span
        className={`inline-block transition-all duration-150 ease-out ${
          isAnimating ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'
        }`}
      >
        <span className="text-sage">{current.profession}</span>
        <span className="text-text-primary">, so </span>
        <span className="text-sage">{current.verb}</span>
        {showEllipsis && <span className="text-text-muted/60 ml-1">...</span>}
      </span>
    </span>
  );
}
