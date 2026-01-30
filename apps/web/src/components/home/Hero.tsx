'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StorefrontPreview } from './StorefrontPreview';

/**
 * Hero - Full-width centered hero with empathy-first messaging
 *
 * Design decisions:
 * - Two-part headline: validation ("You're great") + promise ("Handled")
 * - Subheadline lists concrete problems solved (leads, tools, mental load)
 * - Micro-copy below CTA reduces friction (5-min, no tech skills)
 * - Copy follows brand voice: no punching down, no filler words
 */
export function Hero() {
  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 px-6 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sage/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-sage/3 rounded-full blur-3xl" />

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Headline - validation + promise, two-part structure */}
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.08] tracking-tight">
          You're great at what you do.
          <br />
          <span className="text-sage">The rest should be Handled.</span>
        </h1>

        {/* Subheadline - concrete problems solved */}
        <p className="mt-6 text-lg md:text-xl text-text-muted leading-relaxed max-w-2xl mx-auto">
          Handled builds and runs your website, booking, and client communication — so you stop
          missing leads, stop juggling tools, and stop carrying your business around in your head.
        </p>

        {/* CTA + Micro-copy */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <Button
            asChild
            variant="teal"
            className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Link href="/signup">Get Handled</Link>
          </Button>
          <p className="text-sm text-text-muted">
            5-minute setup · No tech skills · Built for service professionals
          </p>
        </div>

        {/* Full-width Browser Mockup */}
        <div className="mt-16 max-w-4xl mx-auto">
          <StorefrontPreview />
        </div>
      </div>
    </section>
  );
}
