'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Module-scope const for memoization and A/B testing (Kieran, Simplicity)
const PRICING_TIERS = [
  {
    id: 'foundation',
    name: 'The Foundation',
    price: '$49',
    priceSubtext: '/month',
    description: 'Professional presence. Zero tech headaches.',
    features: [
      'Done-for-you website',
      'Online booking & payments',
      'Email notifications',
      'Monthly newsletter',
      'Live monthly Zoom calls',
    ],
    ctaText: 'Get Started',
    isPopular: false,
  },
  {
    id: 'system',
    name: 'The System',
    price: '$149',
    priceSubtext: '/month',
    description: 'One extra booking pays for itself.',
    features: [
      'Everything in Foundation',
      'AI chatbot (books clients 24/7)',
      'Smart reminders',
      'Priority support',
    ],
    ctaText: 'Start Growing',
    isPopular: true,
  },
  {
    id: 'partnership',
    name: 'The Partnership',
    price: "Let's talk",
    priceSubtext: '',
    description: 'Hands-on guidance for scaling.',
    features: [
      'Everything in The System',
      '1-on-1 strategy sessions',
      'Custom integrations',
      'Dedicated account manager',
    ],
    ctaText: "Let's Talk",
    isPopular: false,
  },
] as const;

type PricingTier = (typeof PRICING_TIERS)[number];

function PricingCard({ tier }: { tier: PricingTier }) {
  return (
    <div
      className={cn(
        'relative bg-surface-alt rounded-2xl p-8 border transition-all duration-300',
        tier.isPopular
          ? 'scale-105 border-2 border-sage shadow-xl shadow-sage/20 z-10'
          : 'border-neutral-800 shadow-lg hover:shadow-xl hover:-translate-y-1'
      )}
    >
      {tier.isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sage text-white px-4 py-1 rounded-full text-sm font-medium">
          Most Popular
        </span>
      )}

      <div className="text-center mb-6">
        <h3 className="font-serif text-xl font-bold text-text-primary mb-2">{tier.name}</h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="font-serif text-4xl font-bold text-text-primary">{tier.price}</span>
          {tier.priceSubtext && (
            <span className="text-text-muted text-sm">{tier.priceSubtext}</span>
          )}
        </div>
        <p className="mt-2 text-sm text-text-muted">{tier.description}</p>
      </div>

      <ul className="space-y-3 mb-8">
        {tier.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
            <span className="text-sm text-text-primary">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={`/signup?tier=${tier.id}`}
        className={cn(
          'block w-full rounded-full py-3 px-6 text-center font-medium transition-all duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt',
          'hover:shadow-lg hover:-translate-y-0.5',
          tier.isPopular
            ? 'bg-sage text-white hover:bg-sage-hover'
            : 'bg-neutral-800 text-text-primary hover:bg-neutral-700 border border-neutral-700'
        )}
        aria-label={`${tier.ctaText} with ${tier.name} plan`}
      >
        {tier.ctaText}
      </Link>
    </div>
  );
}

export function PricingSection() {
  return (
    <section className="py-20 md:py-28 px-6" id="pricing">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
            Pick a plan. Skip the tech anxiety.
          </h2>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            No contracts. No setup fees. Cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 items-start">
          {PRICING_TIERS.map((tier) => (
            <PricingCard key={tier.id} tier={tier} />
          ))}
        </div>

        {/* Trust footer */}
        <div className="flex items-center justify-center gap-4 mt-12 text-sm text-text-muted">
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>Secure payments via Stripe</span>
          </div>
          <span className="text-neutral-600">•</span>
          <span>Cancel anytime</span>
        </div>
      </div>
    </section>
  );
}
