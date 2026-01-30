'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Globe,
  Mail,
  Phone,
  MessageSquare,
  Search,
  CalendarCheck,
  MessageCircle,
  Star,
  ArrowRight,
} from 'lucide-react';

/**
 * BeforeAfterComparison - Side-by-side contrast showing scattered vs. unified
 *
 * Design decisions:
 * - Before card: muted, neutral tones (the pain they recognize)
 * - After card: elevated with sage accent (the relief they want)
 * - Copy validates identity first, names pain without shaming
 * - Lists describe flow, not features
 * - Contrast does the persuasion work
 */
export function BeforeAfterComparison() {
  return (
    <section className="relative py-24 md:py-32 px-6 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-sage/5 rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto">
        {/* Section intro */}
        <div className="text-center mb-16">
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight">
            You didn't start this to become a tech expert.
          </h2>
          <p className="mt-4 text-lg md:text-xl text-text-muted max-w-2xl mx-auto">
            You started it to do the work you're good at.
          </p>
        </div>

        {/* Before/After Cards */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* BEFORE Card */}
          <div className="rounded-3xl border border-neutral-700 bg-surface-alt overflow-hidden">
            {/* Header */}
            <div className="bg-neutral-800/50 px-6 py-4 border-b border-neutral-700">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Before
              </span>
              <p className="text-sm text-text-muted mt-1">
                Scattered tools. Mental notes. Constant vigilance.
              </p>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8">
              <p className="text-text-muted leading-relaxed mb-6">
                But somewhere along the way, running your business turned into managing:
              </p>

              <ul className="space-y-4 mb-8">
                <BeforeItem icon={Globe} text="websites and SEO" />
                <BeforeItem icon={Search} text="marketing tools and contact forms" />
                <BeforeItem icon={Mail} text="follow-up emails you meant to send" />
                <BeforeItem icon={Phone} text="missed calls and forgotten texts" />
                <BeforeItem
                  icon={MessageSquare}
                  text="conversations scattered across too many places"
                />
              </ul>

              <p className="text-text-muted text-sm leading-relaxed">
                Not because you're bad at your craft —<br />
                but because your base of operations is too scattered.
              </p>

              <div className="mt-8 pt-6 border-t border-neutral-700">
                <p className="text-text-primary font-medium">
                  That's how great work gets buried under admin.
                </p>
              </div>
            </div>
          </div>

          {/* AFTER Card */}
          <div className="rounded-3xl border-2 border-sage bg-surface shadow-xl shadow-sage/10 overflow-hidden">
            {/* Header */}
            <div className="bg-sage/10 px-6 py-4 border-b border-sage/30">
              <span className="text-xs font-semibold uppercase tracking-wider text-sage">
                After
              </span>
              <p className="text-sm text-sage mt-1">One link. One system. Handled.</p>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8">
              <h3 className="font-serif text-xl md:text-2xl font-bold text-text-primary mb-2">
                With Handled, everything runs through one place.
              </h3>
              <p className="text-text-muted mb-6">
                One calm system your clients actually use — from first click to final follow-up.
              </p>

              <p className="text-text-muted text-sm mb-4">Handled becomes the place clients:</p>

              <ul className="space-y-4 mb-8">
                <AfterItem icon={Search} text="discover you" />
                <AfterItem icon={MessageCircle} text="inquire and ask questions" />
                <AfterItem icon={CalendarCheck} text="book and pay" />
                <AfterItem icon={MessageSquare} text="communicate changes" />
                <AfterItem icon={Star} text="leave feedback and reviews" />
              </ul>

              <p className="text-text-muted text-sm leading-relaxed">
                All in one shared dashboard — for you and your clients.
              </p>

              <div className="mt-6 space-y-2 text-sm text-text-muted">
                <p>No stitching tools together.</p>
                <p>No dropped balls.</p>
                <p>No wondering what you missed.</p>
              </div>

              <div className="mt-8 pt-6 border-t border-sage/30">
                <p className="text-text-primary font-medium mb-4">
                  Nothing slips through the cracks.
                </p>
                <Button
                  asChild
                  variant="ghost"
                  className="group text-sage hover:text-sage hover:bg-sage/10 p-0"
                >
                  <Link href="#how-it-works" className="flex items-center gap-2">
                    See how Handled works
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * BeforeItem - Muted list item for the "scattered" state
 */
function BeforeItem({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-text-muted" />
      </div>
      <span className="text-text-muted pt-1">{text}</span>
    </li>
  );
}

/**
 * AfterItem - Elevated list item for the "Handled" state
 */
function AfterItem({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-sage/15 border border-sage/30 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-sage" />
      </div>
      <span className="text-text-primary pt-1">{text}</span>
    </li>
  );
}
