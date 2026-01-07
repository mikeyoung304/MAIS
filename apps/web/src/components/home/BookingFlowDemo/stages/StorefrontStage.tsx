'use client';

import { Check, Star, Users, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StageProps } from '../types';

/**
 * Demo pricing tiers for the storefront
 */
const tiers = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$75',
    description: 'Single session',
    features: ['1 session', 'Notes included'],
    isPopular: false,
  },
  {
    id: 'essential',
    name: 'Essential',
    price: '$275',
    perSession: '$69/ea',
    description: '4 sessions',
    features: ['Custom plan', 'Priority booking', 'Direct messaging'],
    isPopular: true,
  },
  {
    id: 'complete',
    name: 'Complete',
    price: '$495',
    perSession: '$62/ea',
    description: '8 sessions',
    features: ['Full support', 'Flexible scheduling'],
    isPopular: false,
  },
];

const socialProof = [
  { icon: Star, value: '5.0', label: 'rating' },
  { icon: Users, value: '150+', label: 'clients' },
  { icon: Clock, value: '3+ yrs', label: 'experience' },
];

/**
 * StorefrontStage - The initial pricing tiers view
 *
 * Shows the three-tier pricing structure with the middle tier
 * highlighted as "Popular". This is what a customer sees when
 * they first land on a tenant's storefront.
 */
export function StorefrontStage({ active }: StageProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 p-3 transition-all duration-500 overflow-hidden',
        active ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
      )}
    >
      {/* Mini header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-sage/20 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-sage">AC</span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-text-primary">Alex Chen</p>
            <p className="text-[9px] text-text-muted">Math Tutor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {socialProof.map((item) => (
            <div key={item.label} className="flex items-center gap-0.5">
              <item.icon className="w-2.5 h-2.5 text-sage" />
              <span className="text-[9px] font-medium text-text-primary">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section label */}
      <p className="text-[10px] text-text-muted text-center mb-2">Choose a Package</p>

      {/* Tier cards - responsive: 1 col mobile, 3 cols tablet+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {tiers.map((tier, index) => (
          <div
            key={tier.id}
            className={cn(
              'relative rounded-xl p-2 transition-all duration-300',
              tier.isPopular
                ? 'bg-surface border-2 border-sage shadow-lg shadow-sage/10 scale-[1.02] -mt-1 z-10'
                : 'bg-surface border border-neutral-700'
            )}
            style={{
              transitionDelay: active ? `${index * 80}ms` : '0ms',
            }}
          >
            {/* Popular badge */}
            {tier.isPopular && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
                <span className="inline-flex items-center gap-0.5 bg-sage text-white text-[8px] px-1.5 py-0.5 font-semibold rounded-full">
                  <Sparkles className="w-2 h-2" />
                  Popular
                </span>
              </div>
            )}

            {/* Tier name */}
            <div className={cn('mb-1', tier.isPopular && 'pt-1')}>
              <p className="text-[10px] font-semibold text-text-primary">{tier.name}</p>
              <p className="text-[8px] text-text-muted">{tier.description}</p>
            </div>

            {/* Price */}
            <div className="mb-1.5">
              <span
                className={cn(
                  'font-bold text-text-primary',
                  tier.isPopular ? 'text-base' : 'text-sm'
                )}
              >
                {tier.price}
              </span>
              {tier.perSession && (
                <span className="text-[8px] text-text-muted ml-1">{tier.perSession}</span>
              )}
            </div>

            {/* Features */}
            <ul className="space-y-0.5 mb-2">
              {tier.features.slice(0, 2).map((feature) => (
                <li key={feature} className="flex items-center gap-1">
                  <Check className="w-2 h-2 text-sage shrink-0" />
                  <span className="text-[8px] text-text-muted">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              className={cn(
                'w-full py-1.5 rounded-full text-[9px] font-medium transition-colors',
                tier.isPopular
                  ? 'bg-sage text-white hover:bg-sage-hover'
                  : 'bg-neutral-800 text-text-primary hover:bg-neutral-700'
              )}
            >
              Select
            </button>
          </div>
        ))}
      </div>

      {/* Trust footer */}
      <div className="flex items-center justify-center gap-3 mt-2 text-[8px] text-text-muted">
        <span>Cancel anytime</span>
        <span className="text-neutral-600">•</span>
        <span>Secure payments</span>
        <span className="text-neutral-600">•</span>
        <span>Chat support</span>
      </div>
    </div>
  );
}
