'use client';

import {
  Check,
  MessageSquare,
  Star,
  Sparkles,
  ArrowRight,
  Users,
  GraduationCap,
} from 'lucide-react';

/**
 * DemoStorefrontShowcase - Alex Chen's tutoring landing page preview
 *
 * Shows a realistic example of what a service professional's
 * Handled storefront looks like:
 * - Hero section with headline and value prop
 * - 3-tier pricing with psychology-optimized display
 * - Social proof elements
 */

// Alex Chen's tutoring business
const alexChen = {
  name: 'Alex Chen',
  business: 'Math & Science Tutoring',
  headline: 'Math finally makes sense.',
  subheadline: 'Personalized tutoring for students who want to actually understand—not just pass.',
  initials: 'AC',
  heroImage: '/images/alex-chen-hero.jpg', // We'll use a gradient fallback
};

// Alex's tutoring packages
const tiers = [
  {
    id: 'single',
    name: 'Single Session',
    description: 'Try it out',
    price: 85,
    priceDisplay: '$85',
    priceSubtext: '',
    features: ['1-hour session', 'Homework help', 'Session notes'],
    ctaText: 'Book',
    isPopular: false,
  },
  {
    id: 'grade-boost',
    name: 'Grade Boost',
    description: '4 sessions',
    price: 320,
    priceDisplay: '$320',
    priceSubtext: '',
    perSession: '$80/ea',
    savings: '',
    features: ['Custom study plan', 'Text support', 'Progress tracking', 'Parent updates'],
    ctaText: 'Book',
    isPopular: true,
  },
  {
    id: 'semester',
    name: 'Semester Success',
    description: '12 sessions',
    price: 900,
    priceDisplay: '$900',
    priceSubtext: '',
    perSession: '$75/ea',
    savings: 'Best value',
    features: ['Everything in Grade Boost', 'Flexible scheduling', 'Exam prep', '24/7 chat'],
    ctaText: 'Book',
    isPopular: false,
  },
];

// Alex's social proof
const proofStats = [
  { icon: Star, value: '4.9', label: 'rating' },
  { icon: Users, value: '200+', label: 'students' },
  { icon: GraduationCap, value: '6 yrs', label: 'teaching' },
];

interface DemoStorefrontShowcaseProps {
  /** Compact mode for smaller displays */
  compact?: boolean;
}

export function DemoStorefrontShowcase({ compact = false }: DemoStorefrontShowcaseProps) {
  return (
    <div className="h-full bg-surface overflow-hidden flex flex-col">
      {/* ============================================
          HERO SECTION - Alex Chen's landing page top
          ============================================ */}
      <div
        className={`relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ${compact ? 'py-4 px-4' : 'py-6 px-5'} overflow-hidden`}
      >
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sage/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl" />
          {/* Math symbols decoration */}
          <div className="absolute top-2 right-3 text-white/10 font-mono text-lg">∑ π √</div>
          <div className="absolute bottom-2 left-3 text-white/10 font-mono text-sm">
            x² + y² = r²
          </div>
        </div>

        <div className="relative">
          {/* Profile badge */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-gradient-to-br from-sage to-emerald-600 flex items-center justify-center shadow-lg`}
            >
              <span className={`text-white font-bold ${compact ? 'text-xs' : 'text-sm'}`}>
                {alexChen.initials}
              </span>
            </div>
            <div>
              <p className={`text-white font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
                {alexChen.name}
              </p>
              <p className={`text-slate-400 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
                {alexChen.business}
              </p>
            </div>
          </div>

          {/* Headline */}
          <h2
            className={`font-serif font-bold text-white leading-tight ${compact ? 'text-lg' : 'text-xl'}`}
          >
            {alexChen.headline}
          </h2>

          {/* Subheadline */}
          <p
            className={`mt-1.5 text-slate-300 leading-snug ${compact ? 'text-[10px]' : 'text-xs'}`}
          >
            {alexChen.subheadline}
          </p>

          {/* Social proof */}
          <div className={`flex items-center gap-3 ${compact ? 'mt-3' : 'mt-4'}`}>
            {proofStats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-1">
                <stat.icon className={`text-sage ${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                <span
                  className={`font-semibold text-white ${compact ? 'text-[9px]' : 'text-[10px]'}`}
                >
                  {stat.value}
                </span>
                <span className={`text-slate-400 ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================
          PACKAGES SECTION - 3-tier pricing
          ============================================ */}
      <div className={`px-3 ${compact ? 'py-2.5' : 'py-4'} bg-surface-alt flex-1`}>
        <h3
          className={`font-serif text-center ${compact ? 'text-[10px]' : 'text-xs'} font-medium text-text-muted ${compact ? 'mb-2' : 'mb-3'}`}
        >
          Packages
        </h3>

        <div className={`grid grid-cols-3 ${compact ? 'gap-1.5' : 'gap-2'}`}>
          {tiers.map((tier) => {
            const isPopular = tier.isPopular;

            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl ${compact ? 'p-2' : 'p-2.5'} transition-all duration-300 ${
                  isPopular
                    ? `bg-surface border-2 border-sage shadow-xl shadow-sage/20 ${compact ? '-mt-1 mb-0.5 scale-[1.03]' : '-mt-2 mb-1 scale-105'} z-10 ring-1 ring-sage/20`
                    : 'bg-surface border border-neutral-700 hover:border-sage/50'
                }`}
              >
                {/* Most Popular Badge */}
                {isPopular && (
                  <div
                    className={`absolute ${compact ? '-top-2' : '-top-2.5'} left-1/2 -translate-x-1/2 z-10`}
                  >
                    <span
                      className={`inline-flex items-center gap-0.5 bg-sage text-white ${compact ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-2 py-0.5'} font-semibold rounded-full shadow-md`}
                      role="status"
                      aria-label="Most popular choice"
                    >
                      <Sparkles className={compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} />
                      Popular
                    </span>
                  </div>
                )}

                {/* Tier Name */}
                <div className={`${compact ? 'mb-1' : 'mb-1.5'} ${isPopular ? 'pt-0.5' : ''}`}>
                  <h4
                    className={`font-serif font-semibold text-text-primary ${compact ? 'text-[10px]' : 'text-xs'}`}
                  >
                    {tier.name}
                  </h4>
                  {!compact && (
                    <p className="text-[10px] text-text-muted leading-tight mt-0.5">
                      {tier.description}
                    </p>
                  )}
                </div>

                {/* Price */}
                <div className={compact ? 'mb-1' : 'mb-1.5'}>
                  <div className="flex items-baseline gap-0.5">
                    <span
                      className={`font-bold text-text-primary ${compact ? (isPopular ? 'text-base' : 'text-sm') : isPopular ? 'text-lg' : 'text-base'}`}
                    >
                      {tier.priceDisplay}
                    </span>
                    <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-text-muted`}>
                      {tier.priceSubtext}
                    </span>
                  </div>
                  {tier.perSession && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`${compact ? 'text-[8px]' : 'text-[9px]'} text-text-muted`}>
                        {tier.perSession}
                      </span>
                      {tier.savings && !compact && (
                        <span className="text-[8px] font-semibold text-sage bg-sage/15 px-1 py-0.5 rounded">
                          {tier.savings}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className={`space-y-0.5 ${compact ? 'mb-1.5' : 'mb-2'}`}>
                  {tier.features.slice(0, compact ? 2 : 4).map((feature) => (
                    <li key={feature} className="flex items-start gap-1">
                      <Check
                        className={`flex-shrink-0 mt-0.5 ${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} text-sage`}
                      />
                      <span
                        className={`${compact ? 'text-[8px]' : 'text-[9px]'} text-text-muted leading-tight`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                  {tier.features.length > (compact ? 2 : 4) && (
                    <li className={`${compact ? 'text-[8px]' : 'text-[9px]'} text-sage pl-3`}>
                      +{tier.features.length - (compact ? 2 : 4)} more
                    </li>
                  )}
                </ul>

                {/* CTA Button */}
                <button
                  className={`w-full ${compact ? 'py-1.5' : 'py-2'} rounded-full ${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold transition-all duration-200 flex items-center justify-center gap-1
                    focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-1 focus:ring-offset-surface
                    ${
                      isPopular
                        ? 'bg-sage text-white hover:bg-sage-hover shadow-md hover:shadow-lg'
                        : 'bg-neutral-800 text-text-primary hover:bg-neutral-700'
                    }`}
                >
                  {tier.ctaText}
                  {isPopular && <ArrowRight className={compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trust Footer */}
      <div
        className={`px-4 ${compact ? 'py-1.5' : 'py-2'} bg-surface border-t border-neutral-800 flex items-center justify-center gap-3`}
      >
        <div className="flex items-center gap-1">
          <MessageSquare className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-sage`} />
          <span className={`${compact ? 'text-[8px]' : 'text-[9px]'} text-text-muted`}>
            Chat available
          </span>
        </div>
        <span className="text-neutral-600">•</span>
        <span className={`${compact ? 'text-[8px]' : 'text-[9px]'} text-text-muted`}>
          Cancel anytime
        </span>
        <span className="text-neutral-600">•</span>
        <span className={`${compact ? 'text-[8px]' : 'text-[9px]'} text-text-muted`}>
          Secure payments
        </span>
      </div>
    </div>
  );
}

/**
 * Standalone demo component for use in marketing pages
 * Shows Alex Chen's full landing page in a browser-style frame
 */
export function DemoStorefrontFrame() {
  return (
    <div className="bg-surface-alt rounded-2xl border border-neutral-800 overflow-hidden shadow-2xl">
      {/* Browser-like header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-neutral-800/50 border-b border-neutral-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-neutral-800 rounded-md px-3 py-1 text-xs text-text-muted max-w-xs mx-auto text-center">
            alexchen.gethandled.ai
          </div>
        </div>
      </div>

      {/* Landing page content */}
      <div className="h-[420px] sm:h-[460px] lg:h-auto lg:aspect-[4/5]">
        <DemoStorefrontShowcase />
      </div>
    </div>
  );
}
