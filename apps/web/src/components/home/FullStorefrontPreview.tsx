'use client';

import {
  Check,
  Star,
  Users,
  GraduationCap,
  Quote,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';

/**
 * FullStorefrontPreview - Complete scrollable Alex Chen website for Journey Showcase
 *
 * Shows a miniature but complete version of a real tenant storefront:
 * Hero → About (with portrait) → Packages → Testimonials → FAQ → CTA
 *
 * This is self-contained with hardcoded Alex Chen data to demonstrate
 * what a professional's Handled storefront looks like when fully built out.
 *
 * The component is designed to be scrollable within the browser frame mockup,
 * allowing users to explore the full site structure.
 */

// ============================================
// ALEX CHEN DATA - Full website content
// ============================================

interface Tier {
  name: string;
  description: string;
  price: string;
  perSession?: string;
  savings?: string;
  features: string[];
}

interface TrustItem {
  icon: LucideIcon;
  value: string;
  label: string;
}

interface Testimonial {
  quote: string;
  author: string;
  role: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

const ALEX_CHEN = {
  // Hero Section
  hero: {
    name: 'Alex Chen',
    business: 'SAT Prep Specialist',
    initials: 'AC',
    headline: 'Your dream score is closer than you think.',
    subheadline: 'Strategic SAT prep that turns test anxiety into test confidence.',
  },

  // Trust indicators
  trust: [
    { icon: Star, value: '4.9', label: 'rating' },
    { icon: Users, value: '300+', label: 'students' },
    { icon: GraduationCap, value: '150pt', label: 'avg. gain' },
  ] as TrustItem[],

  // About Section
  about: {
    headline: 'Meet Alex',
    content: `I scored in the 99th percentile on my SAT. More importantly, I've helped 300+ students do the same.

The SAT isn't about being "smart." It's a skill—and skills can be learned. I teach the patterns, shortcuts, and strategies that the test-makers don't want you to know.

My students average a 150-point improvement. Some gain 200+.`,
    image: '/demo/alex-chen.png',
  },

  // Packages Section
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
      savings: 'Best value',
      features: [
        'Complete curriculum',
        'Unlimited practice tests',
        'Essay review',
        'Test day prep',
      ],
    },
  ] as Tier[],

  // Testimonials Section
  testimonials: [
    {
      quote:
        "Went from 1280 to 1480. Alex taught me it's not about working harder—it's about working smarter.",
      author: 'Maya R.',
      role: 'Now at UCLA',
    },
    {
      quote:
        'My daughter was so anxious about the SAT. Alex gave her confidence and a 200-point improvement.',
      author: 'Jennifer L.',
      role: 'Parent',
    },
  ] as Testimonial[],

  // FAQ Section
  faq: [
    {
      question: 'How much can I really improve?',
      answer:
        'Most students improve 100-200 points with dedicated prep. Your diagnostic session will give us a realistic target.',
    },
    {
      question: 'How far in advance should I start?',
      answer:
        "Ideally 3-4 months before your test date. That said, I've helped students see gains in as little as 6 weeks.",
    },
  ] as FAQItem[],

  // CTA Section
  cta: {
    headline: 'Ready to beat the test?',
    subheadline: 'Book your diagnostic session. See exactly where you stand—and where you can go.',
    buttonText: 'Start Here',
  },
};

// ============================================
// COMPONENT
// ============================================

export function FullStorefrontPreview() {
  const { hero, trust, about, tiers, testimonials, faq, cta } = ALEX_CHEN;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-surface scrollbar-hide">
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

        {/* Scroll indicator */}
        <div className="flex justify-center mt-4">
          <ChevronDown className="w-4 h-4 text-slate-500 animate-bounce" />
        </div>
      </section>

      {/* ===== ABOUT SECTION ===== */}
      <section className="py-4 px-4 bg-surface-alt">
        <h2 className="font-serif text-sm font-bold text-text-primary mb-3">{about.headline}</h2>

        <div className="flex gap-3">
          {/* Portrait - placeholder circle if image not available */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-sage/20 to-emerald-500/20 border border-sage/30 flex items-center justify-center overflow-hidden">
              <img
                src={about.image}
                alt={hero.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement!.innerHTML = `<span class="text-sage font-bold text-xl">${hero.initials}</span>`;
                }}
              />
            </div>
          </div>

          {/* Bio text */}
          <div className="flex-1">
            <p className="text-[10px] text-text-muted leading-relaxed whitespace-pre-line">
              {about.content}
            </p>
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

      {/* ===== TESTIMONIALS SECTION ===== */}
      <section className="py-4 px-4 bg-surface-alt">
        <h2 className="font-serif text-xs font-medium text-text-muted text-center mb-3">
          What Students Say
        </h2>

        <div className="space-y-2">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-surface rounded-lg p-2.5 border border-neutral-800">
              <Quote className="w-3 h-3 text-sage/50 mb-1" />
              <p className="text-[9px] text-text-primary leading-relaxed italic">
                "{testimonial.quote}"
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center">
                  <span className="text-sage text-[7px] font-semibold">
                    {testimonial.author.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-[8px] font-semibold text-text-primary">{testimonial.author}</p>
                  <p className="text-[7px] text-text-muted">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="py-4 px-4 bg-surface">
        <h2 className="font-serif text-xs font-medium text-text-muted text-center mb-3">
          Common Questions
        </h2>

        <div className="space-y-2">
          {faq.map((item, index) => (
            <div key={index} className="bg-surface-alt rounded-lg p-2.5 border border-neutral-800">
              <p className="text-[9px] font-semibold text-text-primary">{item.question}</p>
              <p className="text-[8px] text-text-muted mt-1 leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="py-5 px-4 bg-sage">
        <div className="text-center">
          <h2 className="font-serif text-sm font-bold text-white">{cta.headline}</h2>
          <p className="text-[10px] text-white/80 mt-1">{cta.subheadline}</p>
          <button className="mt-3 px-4 py-1.5 bg-white text-sage rounded-full text-[10px] font-semibold shadow-lg">
            {cta.buttonText}
          </button>
        </div>
      </section>
    </div>
  );
}
