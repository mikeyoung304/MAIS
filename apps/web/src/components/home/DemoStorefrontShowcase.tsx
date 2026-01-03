'use client';

import {
  Check,
  GraduationCap,
  Clock,
  MessageSquare,
  Trophy,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

/**
 * DemoStorefrontShowcase - Realistic demo storefront for a college tutor
 *
 * Psychology-optimized three-tier pricing display implementing:
 * - Anchoring effect (premium tier sets high reference point)
 * - Decoy effect (middle tier appears optimal)
 * - Social proof ("Most Popular" badge)
 * - Outcome-focused naming (benefits over features)
 * - Visual hierarchy (elevated popular tier)
 *
 * Based on 2025 pricing page best practices research:
 * - 41.4% of successful startups use exactly three tiers
 * - Three-tier approach yields 25-40% higher average purchase values
 * - 70% of buyers choose the middle option when properly positioned
 */

// Demo tenant data - college STEM tutor
const demoTenant = {
  name: 'Alex Chen',
  tagline: 'STEM Tutoring',
  subject: 'Math & Physics',
  initials: 'AC',
};

// Psychologically optimized tier structure
// Research: Price middle tier 20-30% more than basic with 100%+ feature value increase
const tiers = [
  {
    id: 'basic',
    name: 'Quick Help',
    description: 'Perfect for exam prep or homework help',
    price: 85,
    priceDisplay: '$85',
    priceSubtext: '/session',
    features: ['1-hour tutoring session', 'Email notes & recap', 'Flexible scheduling'],
    ctaText: 'Book Session',
    isPopular: false,
  },
  {
    id: 'standard',
    name: 'Grade Boost',
    description: 'For consistent improvement',
    price: 320,
    priceDisplay: '$320',
    priceSubtext: '4 sessions',
    perSession: '$80/session',
    savings: 'Save $20',
    features: [
      '4 one-hour sessions',
      'Personalized study plan',
      'Priority scheduling',
      'Text support between sessions',
    ],
    ctaText: 'Start Boosting',
    isPopular: true,
  },
  {
    id: 'premium',
    name: 'Semester Success',
    description: 'Full semester support',
    price: 560,
    priceDisplay: '$560',
    priceSubtext: '8 sessions',
    perSession: '$70/session',
    savings: 'Save $120',
    features: [
      '8 one-hour sessions',
      'Comprehensive study plan',
      'Guaranteed availability',
      'Unlimited messaging support',
      'Exam prep strategies',
      'Grade improvement guarantee',
    ],
    ctaText: 'Get Started',
    isPopular: false,
  },
];

// Social proof stats
const proofStats = [
  { icon: Trophy, value: '4.9', label: 'rating' },
  { icon: GraduationCap, value: '200+', label: 'students helped' },
  { icon: Clock, value: '5 yrs', label: 'experience' },
];

interface DemoStorefrontShowcaseProps {
  /** Compact mode for smaller displays */
  compact?: boolean;
}

export function DemoStorefrontShowcase({ compact = false }: DemoStorefrontShowcaseProps) {
  return (
    <div className="h-full bg-surface overflow-hidden flex flex-col">
      {/* Hero Section - Compact but impactful */}
      <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.12)_0%,transparent_70%)] bg-surface px-4 py-4 text-center border-b border-neutral-800">
        <div className="flex items-center justify-center gap-3 mb-2">
          {/* Professional initials avatar instead of emoji */}
          <div className="w-9 h-9 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
            <span className="text-sage font-semibold text-sm">{demoTenant.initials}</span>
          </div>
          <div className="text-left">
            <h2 className="font-serif text-base font-bold text-text-primary">{demoTenant.name}</h2>
            <p className="text-[11px] text-sage font-medium">{demoTenant.tagline}</p>
          </div>
        </div>
        <p className="text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
          Ace your {demoTenant.subject} courses with personalized 1-on-1 tutoring
        </p>

        {/* Social proof bar */}
        <div className="flex items-center justify-center gap-5 mt-3">
          {proofStats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-1">
              <stat.icon className="w-3 h-3 text-sage" />
              <span className="text-[11px] font-semibold text-text-primary">{stat.value}</span>
              <span className="text-[10px] text-text-muted">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tier Cards Section */}
      <div className={`flex-1 px-3 ${compact ? 'py-3' : 'py-5'} bg-surface-alt`}>
        <h3 className="font-serif text-center text-sm font-semibold text-text-primary mb-3">
          Choose Your Path to Success
        </h3>

        <div className="grid grid-cols-3 gap-2">
          {tiers.map((tier) => {
            const isPopular = tier.isPopular;

            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl p-2.5 transition-all duration-300 ${
                  isPopular
                    ? 'bg-surface border-2 border-sage shadow-xl shadow-sage/20 -mt-2 mb-1 scale-105 z-10 ring-1 ring-sage/20'
                    : 'bg-surface border border-neutral-700 hover:border-sage/50'
                }`}
              >
                {/* Most Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                    <span
                      className="inline-flex items-center gap-0.5 bg-sage text-white text-[9px] font-semibold px-2 py-0.5 rounded-full shadow-md"
                      role="status"
                      aria-label="Most popular choice"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      Popular
                    </span>
                  </div>
                )}

                {/* Tier Name */}
                <div className={`mb-1.5 ${isPopular ? 'pt-0.5' : ''}`}>
                  <h4
                    className={`font-serif font-semibold text-text-primary ${compact ? 'text-[11px]' : 'text-xs'}`}
                  >
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
                    <span className="text-[10px] text-text-muted">{tier.priceSubtext}</span>
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
                  {tier.features.slice(0, compact ? 3 : 4).map((feature) => (
                    <li key={feature} className="flex items-start gap-1">
                      <Check className={`flex-shrink-0 mt-0.5 w-2.5 h-2.5 text-sage`} />
                      <span className="text-[9px] text-text-muted leading-tight">{feature}</span>
                    </li>
                  ))}
                  {tier.features.length > (compact ? 3 : 4) && (
                    <li className="text-[9px] text-sage pl-3">
                      +{tier.features.length - (compact ? 3 : 4)} more
                    </li>
                  )}
                </ul>

                {/* CTA Button - improved touch target and focus states */}
                <button
                  className={`w-full py-2 rounded-full text-[10px] font-semibold transition-all duration-200 flex items-center justify-center gap-1
                    focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-1 focus:ring-offset-surface
                    ${
                      isPopular
                        ? 'bg-sage text-white hover:bg-sage-hover shadow-md hover:shadow-lg'
                        : 'bg-neutral-800 text-text-primary hover:bg-neutral-700'
                    }`}
                >
                  {tier.ctaText}
                  {isPopular && <ArrowRight className="w-2.5 h-2.5" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trust Footer */}
      <div className="px-4 py-2 bg-surface border-t border-neutral-800 flex items-center justify-center gap-3">
        <div className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3 text-sage" />
          <span className="text-[9px] text-text-muted">Chat available</span>
        </div>
        <span className="text-neutral-600">•</span>
        <span className="text-[9px] text-text-muted">Cancel anytime</span>
        <span className="text-neutral-600">•</span>
        <span className="text-[9px] text-text-muted">Secure payments</span>
      </div>
    </div>
  );
}

/**
 * Standalone demo component for use in marketing pages
 * Shows the full storefront in a browser-style frame
 */
export function DemoStorefrontFrame() {
  return (
    <div className="bg-surface-alt rounded-2xl border border-neutral-800 overflow-hidden">
      {/* Browser-like header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-neutral-800/50 border-b border-neutral-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-neutral-700" />
          <div className="w-3 h-3 rounded-full bg-neutral-700" />
          <div className="w-3 h-3 rounded-full bg-neutral-700" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-neutral-800 rounded-md px-3 py-1 text-xs text-text-muted max-w-xs mx-auto text-center">
            alexchen.gethandled.ai
          </div>
        </div>
      </div>

      {/* Storefront content */}
      <div className="aspect-[4/5]">
        <DemoStorefrontShowcase />
      </div>
    </div>
  );
}
