'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StorefrontPreview } from './StorefrontPreview';

/**
 * Hero - Simplified full-width centered hero section
 *
 * Replaces the 4-vertical selector (HeroWithVerticals) with a cleaner,
 * more focused design. Single Alex Chen mockup communicates value faster
 * without decision fatigue.
 *
 * Design decisions:
 * - Full-width centered layout for maximum visual impact
 * - Ambient glow effects for depth without distraction
 * - Copy follows brand voice: no punching down, no filler words
 * - "Nothing slips" instead of "rely on memory" per review fix
 */
export function Hero() {
  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 px-6 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sage/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-sage/3 rounded-full blur-3xl" />

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Headline - outcome-first, under 15 words */}
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.08] tracking-tight">
          The operations layer that keeps bookings moving.
        </h1>

        {/* Subheadline - no punching down, uses approved words */}
        <p className="mt-6 text-lg md:text-xl text-text-muted leading-relaxed max-w-2xl mx-auto">
          Communication, booking, and follow-up in one calm system. Nothing slips.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            asChild
            variant="teal"
            className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Link href="/signup">Get Handled</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="rounded-full px-8 py-6 text-lg text-text-muted hover:text-text-primary"
          >
            <Link href="#how-it-works">How it works</Link>
          </Button>
        </div>

        {/* Full-width Browser Mockup */}
        <div className="mt-16 max-w-4xl mx-auto">
          <StorefrontPreview />
        </div>
      </div>
    </section>
  );
}
