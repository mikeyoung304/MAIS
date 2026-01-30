'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Hero - Text-only hero with universal messaging
 *
 * Design decisions:
 * - Universal headline that resonates with all service professionals
 * - No demo persona/mockup to avoid "this isn't for me" reactions
 * - Section 2 (journey showcase) explains the product
 * - Scroll indicator guides users to learn more
 */
export function Hero() {
  return (
    <section className="relative min-h-[70vh] flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sage/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-sage/3 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Headline - universal message */}
        <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-text-primary leading-[1.05] tracking-tight">
          Do what you love.
          <br />
          <span className="text-text-muted">
            The rest, is <span className="text-sage">handled</span>.
          </span>
        </h1>

        {/* CTA */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <Button
            asChild
            variant="teal"
            className="rounded-full px-12 py-7 text-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <span className="text-xs text-text-muted">See how it works</span>
        <ChevronDown className="w-5 h-5 text-text-muted animate-bounce" />
      </div>
    </section>
  );
}
