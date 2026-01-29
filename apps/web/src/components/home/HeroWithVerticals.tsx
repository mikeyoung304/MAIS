'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Star,
  Users,
  Award,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================
// Types
// ============================================

const VERTICAL_IDS = ['tutor', 'photographer', 'chef', 'consultant'] as const;
type VerticalId = (typeof VERTICAL_IDS)[number];

interface Tier {
  name: string;
  description: string;
  price: number;
  priceDisplay: string;
  perSession?: string;
  savings?: string;
  features: string[];
}

interface TrustItem {
  icon: LucideIcon;
  value: string;
  label: string;
}

interface Vertical {
  id: VerticalId;
  label: string;
  persona: {
    name: string;
    business: string;
    initials: string;
    headline: string;
    subheadline: string;
  };
  tiers: [Tier, Tier, Tier];
  trust: [TrustItem, TrustItem, TrustItem];
}

// ============================================
// Data - Inline per DHH review
// ============================================

const VERTICALS: Vertical[] = [
  {
    id: 'tutor',
    label: 'Tutor',
    persona: {
      name: 'Alex Chen',
      business: 'Math & Science Tutoring',
      initials: 'AC',
      headline: 'Math finally makes sense.',
      subheadline:
        'Personalized tutoring for students who want to actually understand—not just pass.',
    },
    tiers: [
      {
        name: 'Single Session',
        description: 'Try it out',
        price: 85,
        priceDisplay: '$85',
        features: ['1-hour session', 'Homework help', 'Session notes'],
      },
      {
        name: 'Grade Boost',
        description: '4 sessions',
        price: 320,
        priceDisplay: '$320',
        perSession: '$80/ea',
        features: ['Custom study plan', 'Text support', 'Progress tracking', 'Parent updates'],
      },
      {
        name: 'Semester Success',
        description: '12 sessions',
        price: 900,
        priceDisplay: '$900',
        perSession: '$75/ea',
        savings: 'Best value',
        features: ['Everything in Grade Boost', 'Flexible scheduling', 'Exam prep', '24/7 chat'],
      },
    ],
    trust: [
      { icon: Star, value: '4.9', label: 'rating' },
      { icon: Users, value: '200+', label: 'students' },
      { icon: GraduationCap, value: '6 yrs', label: 'teaching' },
    ],
  },
  {
    id: 'photographer',
    label: 'Photographer',
    persona: {
      name: 'Maya Torres',
      business: 'Portrait & Event Photography',
      initials: 'MT',
      headline: 'Photos you actually want to frame.',
      subheadline: 'Portrait and event photography for people who hate being in front of a camera.',
    },
    tiers: [
      {
        name: 'Mini Session',
        description: '30 minutes',
        price: 195,
        priceDisplay: '$195',
        features: ['30-minute session', '10 edited photos', 'Online gallery'],
      },
      {
        name: 'Full Session',
        description: '90 minutes',
        price: 450,
        priceDisplay: '$450',
        features: ['90-minute session', '30 edited photos', 'Outfit changes', 'Multiple locations'],
      },
      {
        name: 'Premium Package',
        description: 'Half day',
        price: 850,
        priceDisplay: '$850',
        savings: 'Most requested',
        features: ['4-hour session', '75+ edited photos', 'Hair & makeup time', 'Print credit'],
      },
    ],
    trust: [
      { icon: Star, value: '5.0', label: 'rating' },
      { icon: Users, value: '500+', label: 'sessions' },
      { icon: Award, value: 'Featured', label: 'in The Knot' },
    ],
  },
  {
    id: 'chef',
    label: 'Private Chef',
    persona: {
      name: 'Marcus Webb',
      business: 'Private Dining Experiences',
      initials: 'MW',
      headline: 'Restaurant-quality dinners at home.',
      subheadline: 'Private chef experiences for dinner parties, date nights, and celebrations.',
    },
    tiers: [
      {
        name: 'Intimate Dinner',
        description: '2-4 guests',
        price: 350,
        priceDisplay: '$350',
        features: ['3-course menu', 'Grocery shopping', 'Kitchen cleanup'],
      },
      {
        name: 'Dinner Party',
        description: '6-10 guests',
        price: 650,
        priceDisplay: '$650',
        perSession: '$65/guest',
        features: ['4-course menu', 'Wine pairing', 'Tablescape setup', 'Full service'],
      },
      {
        name: 'Full Event',
        description: '12-20 guests',
        price: 1200,
        priceDisplay: '$1,200',
        savings: 'All-inclusive',
        features: ['5-course tasting', 'Passed appetizers', 'Dessert station', 'Wait staff'],
      },
    ],
    trust: [
      { icon: Star, value: '4.9', label: 'rating' },
      { icon: Users, value: '300+', label: 'dinners' },
      { icon: Award, value: 'CIA trained', label: '' },
    ],
  },
  {
    id: 'consultant',
    label: 'Consultant',
    persona: {
      name: 'Jordan Reyes',
      business: 'Business Strategy Consulting',
      initials: 'JR',
      headline: 'Clarity on what to do next.',
      subheadline: 'Strategic consulting for founders who have momentum but need direction.',
    },
    tiers: [
      {
        name: 'Clarity Call',
        description: '60 minutes',
        price: 250,
        priceDisplay: '$250',
        features: ['60-minute deep dive', 'Recording + summary', '3 action items'],
      },
      {
        name: 'Strategy Sprint',
        description: '4 weeks',
        price: 1500,
        priceDisplay: '$1,500',
        perSession: '$375/wk',
        features: ['4 weekly calls', 'Async support', 'Custom roadmap', 'Team alignment'],
      },
      {
        name: 'Advisory Retainer',
        description: 'Monthly',
        price: 3000,
        priceDisplay: '$3,000',
        savings: 'Ongoing',
        features: ['Unlimited calls', 'Strategic reviews', 'Board prep', 'Investor intros'],
      },
    ],
    trust: [
      { icon: Star, value: '5.0', label: 'rating' },
      { icon: Users, value: '75+', label: 'clients' },
      { icon: Award, value: 'Ex-McKinsey', label: '' },
    ],
  },
];

// ============================================
// Scrollable Storefront Preview Component
// ============================================

function StorefrontPreview({ vertical }: { vertical: Vertical }) {
  const { persona, tiers, trust } = vertical;
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="h-[420px] sm:h-[480px] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent"
      style={{ scrollbarWidth: 'thin' }}
    >
      {/* ============================================
          HERO SECTION - Tenant landing page top
          ============================================ */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-6 px-5 overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sage/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl" />
        </div>

        <div className="relative">
          {/* Profile badge */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sage to-emerald-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-sm">{persona.initials}</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{persona.name}</p>
              <p className="text-slate-400 text-[10px]">{persona.business}</p>
            </div>
          </div>

          {/* Headline */}
          <h2 className="font-serif font-bold text-white leading-tight text-xl">
            {persona.headline}
          </h2>

          {/* Subheadline */}
          <p className="mt-1.5 text-slate-300 leading-snug text-xs">{persona.subheadline}</p>

          {/* Social proof */}
          <div className="flex items-center gap-3 mt-4">
            {trust.map((stat) => (
              <div key={`${stat.value}-${stat.label}`} className="flex items-center gap-1">
                <stat.icon className="text-sage w-3 h-3" />
                <span className="font-semibold text-white text-[10px]">{stat.value}</span>
                {stat.label && <span className="text-slate-400 text-[9px]">{stat.label}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================
          PACKAGES SECTION - 3-tier pricing
          ============================================ */}
      <div className="px-3 py-4 bg-surface-alt">
        <h3 className="font-serif text-center text-xs font-medium text-text-muted mb-3">
          Packages
        </h3>

        <div className="grid grid-cols-3 gap-2">
          {tiers.map((tier, index) => {
            const isPopular = index === 1;

            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-2.5 transition-all duration-300 ${
                  isPopular
                    ? 'bg-surface border-2 border-sage shadow-xl shadow-sage/20 -mt-2 mb-1 scale-105 z-10 ring-1 ring-sage/20'
                    : 'bg-surface border border-neutral-700 hover:border-sage/50'
                }`}
              >
                {/* Most Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-0.5 bg-sage text-white text-[9px] px-2 py-0.5 font-semibold rounded-full shadow-md">
                      <Star className="w-2.5 h-2.5" />
                      Popular
                    </span>
                  </div>
                )}

                {/* Tier Name */}
                <div className={`mb-1.5 ${isPopular ? 'pt-0.5' : ''}`}>
                  <h4 className="font-serif font-semibold text-text-primary text-xs">
                    {tier.name}
                  </h4>
                  <p className="text-[10px] text-text-muted leading-tight mt-0.5">
                    {tier.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-1.5">
                  <div className="flex items-baseline gap-0.5">
                    <span
                      className={`font-bold text-text-primary ${isPopular ? 'text-lg' : 'text-base'}`}
                    >
                      {tier.priceDisplay}
                    </span>
                  </div>
                  {tier.perSession && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-text-muted">{tier.perSession}</span>
                      {tier.savings && (
                        <span className="text-[8px] font-semibold text-sage bg-sage/15 px-1 py-0.5 rounded">
                          {tier.savings}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-0.5 mb-2">
                  {tier.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex items-start gap-1">
                      <svg
                        className="flex-shrink-0 mt-0.5 w-2.5 h-2.5 text-sage"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-[9px] text-text-muted leading-tight">{feature}</span>
                    </li>
                  ))}
                  {tier.features.length > 4 && (
                    <li className="text-[9px] text-sage pl-3">+{tier.features.length - 4} more</li>
                  )}
                </ul>

                {/* CTA Button */}
                <button
                  className={`w-full py-2 rounded-full text-[10px] font-semibold transition-all duration-200 flex items-center justify-center gap-1
                    ${
                      isPopular
                        ? 'bg-sage text-white hover:bg-sage-hover shadow-md hover:shadow-lg'
                        : 'bg-neutral-800 text-text-primary hover:bg-neutral-700'
                    }`}
                >
                  Book
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trust Footer */}
      <div className="px-4 py-2 bg-surface border-t border-neutral-800 flex items-center justify-center gap-3">
        <span className="text-[9px] text-text-muted">Chat available</span>
        <span className="text-neutral-600">•</span>
        <span className="text-[9px] text-text-muted">Cancel anytime</span>
        <span className="text-neutral-600">•</span>
        <span className="text-[9px] text-text-muted">Secure payments</span>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function HeroWithVerticals() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = VERTICALS[selectedIndex];

  // Navigate to previous vertical
  const goToPrev = useCallback(() => {
    setSelectedIndex((prev) => (prev - 1 + VERTICALS.length) % VERTICALS.length);
  }, []);

  // Navigate to next vertical
  const goToNext = useCallback(() => {
    setSelectedIndex((prev) => (prev + 1) % VERTICALS.length);
  }, []);

  // Keyboard navigation for pills
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % VERTICALS.length;
      setSelectedIndex(nextIndex);
      document.getElementById(`hero-tab-${VERTICALS[nextIndex].id}`)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + VERTICALS.length) % VERTICALS.length;
      setSelectedIndex(prevIndex);
      document.getElementById(`hero-tab-${VERTICALS[prevIndex].id}`)?.focus();
    }
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 px-6 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sage/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-sage/3 rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* ============================================
              LEFT: STATIC Copy - Never changes
              ============================================ */}
          <div className="text-center lg:text-left">
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.08] tracking-tight">
              The operations layer that keeps bookings moving.
            </h1>

            <p className="mt-6 text-lg md:text-xl text-text-muted leading-relaxed max-w-lg mx-auto lg:mx-0">
              Client communication, booking, and follow-up — handled in one calm system that
              doesn&apos;t rely on memory anymore.
            </p>

            <p className="mt-4 text-base text-text-muted leading-relaxed max-w-lg mx-auto lg:mx-0">
              Handled replaces scattered websites, emails, texts, and mental load with a single
              storefront and source of truth — so nothing drops, clients stay confident, and revenue
              keeps flowing.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
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
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
          </div>

          {/* ============================================
              RIGHT: Dynamic Storefront Preview
              Pills + Arrows float above, content scrolls
              ============================================ */}
          <div className="relative">
            {/* Vertical Selector - Pills with Arrows */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {/* Left Arrow */}
              <button
                onClick={goToPrev}
                aria-label="Previous vertical"
                className="p-2 rounded-full bg-neutral-800/50 text-text-muted hover:bg-neutral-700/50 hover:text-text-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 focus:ring-offset-surface"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Pills */}
              <div
                role="tablist"
                aria-label="Select profession to preview"
                aria-orientation="horizontal"
                className="inline-flex flex-wrap justify-center gap-1.5"
              >
                {VERTICALS.map((v, index) => (
                  <button
                    key={v.id}
                    role="tab"
                    id={`hero-tab-${v.id}`}
                    aria-selected={selectedIndex === index}
                    aria-controls="hero-preview-panel"
                    tabIndex={selectedIndex === index ? 0 : -1}
                    onClick={() => setSelectedIndex(index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                      focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 focus:ring-offset-surface
                      ${
                        selectedIndex === index
                          ? 'bg-sage text-white shadow-md'
                          : 'bg-neutral-800/50 text-text-muted hover:bg-neutral-700/50 hover:text-text-primary'
                      }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              {/* Right Arrow */}
              <button
                onClick={goToNext}
                aria-label="Next vertical"
                className="p-2 rounded-full bg-neutral-800/50 text-text-muted hover:bg-neutral-700/50 hover:text-text-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 focus:ring-offset-surface"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Browser Frame */}
            <div
              role="tabpanel"
              id="hero-preview-panel"
              aria-labelledby={`hero-tab-${selected.id}`}
              aria-live="polite"
              className="bg-surface-alt rounded-3xl border border-neutral-800 overflow-hidden shadow-2xl transition-all duration-300"
            >
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-neutral-800/50 border-b border-neutral-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-neutral-800 rounded-md px-3 py-1 text-xs text-text-muted max-w-xs mx-auto text-center transition-all duration-300">
                    {selected.persona.name.toLowerCase().replace(' ', '')}.gethandled.ai
                  </div>
                </div>
              </div>

              {/* Scrollable Content with fade animation */}
              <div key={selected.id} className="animate-fade-in-scale">
                <StorefrontPreview vertical={selected} />
              </div>
            </div>

            {/* Scroll hint with subtle animation */}
            <div className="flex flex-col items-center mt-4 gap-2">
              <p className="text-[10px] text-text-muted">Scroll to explore</p>
              <div className="animate-bounce-subtle">
                <ChevronDown className="w-4 h-4 text-text-muted/50" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Export types for use elsewhere
export type { Vertical, Tier, TrustItem };
