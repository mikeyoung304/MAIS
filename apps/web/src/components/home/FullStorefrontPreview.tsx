'use client';

import { Check, Star, Users, GraduationCap, MessageCircle, type LucideIcon } from 'lucide-react';

/**
 * FullStorefrontPreview - Simplified Alex Chen storefront for Journey Showcase
 *
 * Shows only the essential above-the-fold experience:
 * - Hero (profile badge, headline, trust indicators)
 * - Packages (3-tier pricing)
 * - Floating chat button (teases AI assistant)
 *
 * Deliberately minimal to convey "this looks professional" at a glance.
 * The chat button connects visually to Panel 2 where the chatbot is open.
 */

// ============================================
// ALEX CHEN DATA - Simplified for preview
// ============================================

interface Tier {
  name: string;
  description: string;
  price: string;
  perSession?: string;
  features: string[];
}

interface TrustItem {
  icon: LucideIcon;
  value: string;
  label: string;
}

const ALEX_CHEN = {
  hero: {
    name: 'Alex Chen',
    business: 'SAT Prep Specialist',
    initials: 'AC',
    headline: 'Your dream score is closer than you think.',
    subheadline: 'Strategic SAT prep that turns test anxiety into test confidence.',
  },

  trust: [
    { icon: Star, value: '4.9', label: 'rating' },
    { icon: Users, value: '300+', label: 'students' },
    { icon: GraduationCap, value: '150pt', label: 'avg. gain' },
  ] as TrustItem[],

  tiers: [
    {
      name: 'Strategy Session',
      description: 'Diagnostic + plan',
      price: '$150',
      features: ['Full practice test', 'Score analysis', 'Custom study plan'],
    },
    {
      name: 'Score Boost',
      description: '8 sessions',
      price: '$960',
      perSession: '$120/ea',
      features: ['Targeted weak areas', 'Practice tests', 'Strategy drills', 'Parent updates'],
    },
    {
      name: 'Full Prep',
      description: '16 sessions',
      price: '$1,760',
      perSession: '$110/ea',
      features: [
        'Complete curriculum',
        'Unlimited practice tests',
        'Essay review',
        'Test day prep',
      ],
    },
  ] as Tier[],
};

// ============================================
// COMPONENT
// ============================================

export function FullStorefrontPreview() {
  const { hero, trust, tiers } = ALEX_CHEN;

  return (
    <div className="relative h-full bg-surface overflow-hidden">
      {/* ===== HERO SECTION ===== */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-5 px-4 overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sage/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-blue-500/20 rounded-full blur-2xl" />
        </div>

        <div className="relative">
          {/* Profile badge */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sage to-emerald-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xs">{hero.initials}</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{hero.name}</p>
              <p className="text-slate-400 text-[9px]">{hero.business}</p>
            </div>
          </div>

          {/* Headline */}
          <h1 className="font-serif font-bold text-white text-lg leading-tight">{hero.headline}</h1>
          <p className="mt-1.5 text-slate-300 text-[11px] leading-snug">{hero.subheadline}</p>

          {/* Trust indicators */}
          <div className="flex items-center gap-3 mt-3">
            {trust.map((stat) => (
              <div key={`${stat.value}-${stat.label}`} className="flex items-center gap-1">
                <stat.icon className="text-sage w-2.5 h-2.5" />
                <span className="font-semibold text-white text-[9px]">{stat.value}</span>
                <span className="text-slate-400 text-[8px]">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PACKAGES SECTION ===== */}
      <section className="py-4 px-3 bg-surface">
        <h2 className="font-serif text-xs font-medium text-text-muted text-center mb-3">
          Packages
        </h2>

        <div className="grid grid-cols-3 gap-1.5">
          {tiers.map((tier, index) => {
            const isPopular = index === 1;

            return (
              <div
                key={tier.name}
                className={`relative rounded-xl p-2 transition-all ${
                  isPopular
                    ? 'bg-surface border-2 border-sage shadow-lg shadow-sage/20 -mt-1 scale-[1.02] z-10'
                    : 'bg-surface border border-neutral-700'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-0.5 bg-sage text-white text-[7px] px-1.5 py-0.5 font-semibold rounded-full">
                      <Star className="w-2 h-2" />
                      Popular
                    </span>
                  </div>
                )}

                <div className={`${isPopular ? 'pt-1' : ''}`}>
                  <h3 className="font-serif font-semibold text-text-primary text-[9px]">
                    {tier.name}
                  </h3>
                  <p className="text-[8px] text-text-muted">{tier.description}</p>
                </div>

                <div className="my-1">
                  <span
                    className={`font-bold text-text-primary ${isPopular ? 'text-sm' : 'text-xs'}`}
                  >
                    {tier.price}
                  </span>
                  {tier.perSession && (
                    <span className="text-[7px] text-text-muted ml-1">{tier.perSession}</span>
                  )}
                </div>

                <ul className="space-y-0.5 mb-2">
                  {tier.features.slice(0, 2).map((feature) => (
                    <li key={feature} className="flex items-start gap-1">
                      <Check className="w-2 h-2 text-sage flex-shrink-0 mt-0.5" />
                      <span className="text-[7px] text-text-muted leading-tight">{feature}</span>
                    </li>
                  ))}
                  {tier.features.length > 2 && (
                    <li className="text-[7px] text-sage pl-3">+{tier.features.length - 2} more</li>
                  )}
                </ul>

                <button
                  className={`w-full py-1 rounded-full text-[8px] font-semibold ${
                    isPopular ? 'bg-sage text-white' : 'bg-neutral-800 text-text-primary'
                  }`}
                >
                  Book
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== FLOATING CHAT BUTTON ===== */}
      <div className="absolute bottom-4 right-4">
        <div className="relative">
          {/* Pulse animation */}
          <div className="absolute inset-0 w-10 h-10 rounded-full bg-sage animate-ping opacity-20" />
          {/* Button */}
          <div className="relative w-10 h-10 rounded-full bg-sage flex items-center justify-center shadow-lg shadow-sage/30 cursor-pointer hover:scale-105 transition-transform">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          {/* Online indicator */}
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface" />
        </div>
      </div>
    </div>
  );
}
