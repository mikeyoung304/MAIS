'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star, Users, Award, GraduationCap, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DemoStorefrontShowcase } from './DemoStorefrontShowcase';

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
// Component
// ============================================

export function HeroWithVerticals() {
  const [selected, setSelected] = useState<Vertical>(VERTICALS[0]);

  // Keyboard navigation for selector pills
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % VERTICALS.length;
      setSelected(VERTICALS[nextIndex]);
      // Focus the next tab
      const nextTab = document.getElementById(`hero-tab-${VERTICALS[nextIndex].id}`);
      nextTab?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + VERTICALS.length) % VERTICALS.length;
      setSelected(VERTICALS[prevIndex]);
      // Focus the previous tab
      const prevTab = document.getElementById(`hero-tab-${VERTICALS[prevIndex].id}`);
      prevTab?.focus();
    }
  };

  return (
    <section className="relative pt-28 pb-12 md:pt-32 md:pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Vertical Selector - ARIA tablist pattern */}
        <div className="text-center mb-8">
          <p className="text-text-muted text-sm mb-3">See how this works for:</p>
          <div
            role="tablist"
            aria-label="Select your profession"
            aria-orientation="horizontal"
            className="inline-flex flex-wrap justify-center gap-2"
          >
            {VERTICALS.map((v, index) => (
              <button
                key={v.id}
                role="tab"
                id={`hero-tab-${v.id}`}
                aria-selected={selected.id === v.id}
                aria-controls="hero-panel"
                tabIndex={selected.id === v.id ? 0 : -1}
                onClick={() => setSelected(v)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 focus:ring-offset-surface
                  ${
                    selected.id === v.id
                      ? 'bg-sage text-white shadow-md'
                      : 'bg-neutral-800/50 text-text-muted hover:bg-neutral-700/50 hover:text-text-primary'
                  }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hero Content Panel */}
        <div
          role="tabpanel"
          id="hero-panel"
          aria-labelledby={`hero-tab-${selected.id}`}
          aria-live="polite"
          className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center"
        >
          {/* Left: Copy */}
          <div className="text-center lg:text-left">
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-text-primary leading-[1.08] tracking-tight">
              {selected.persona.headline}
            </h1>

            <p className="mt-6 text-lg md:text-xl text-text-muted leading-relaxed max-w-lg mx-auto lg:mx-0">
              {selected.persona.subheadline}
            </p>

            {/* Trust Strip */}
            <div className="flex items-center justify-center lg:justify-start gap-4 mt-8 flex-wrap">
              {selected.trust.map((item) => (
                <div
                  key={`${item.value}-${item.label}`}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <item.icon className="w-4 h-4 text-sage" />
                  <span className="font-semibold text-text-primary">{item.value}</span>
                  {item.label && <span className="text-text-muted">{item.label}</span>}
                </div>
              ))}
            </div>

            {/* Single CTA */}
            <div className="mt-8">
              <Button
                asChild
                variant="teal"
                className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Link href="/signup">View Packages</Link>
              </Button>
            </div>
          </div>

          {/* Right: Storefront Visual - visible on ALL breakpoints */}
          <div className="block">
            <DemoStorefrontShowcase vertical={selected} />
          </div>
        </div>
      </div>
    </section>
  );
}

// Export types for DemoStorefrontShowcase
export type { Vertical, Tier, TrustItem };
