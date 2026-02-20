'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CreditCard, Receipt } from 'lucide-react';

// Lazy import the existing page components
import PaymentsContent from '../payments/page';
import BillingContent from '../billing/page';

type RevenueTab = 'payments' | 'billing';

const TABS: { id: RevenueTab; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'payments',
    label: 'Payments',
    icon: <CreditCard className="h-4 w-4" />,
    description: 'Stripe Connect setup',
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: <Receipt className="h-4 w-4" />,
    description: 'Subscription & usage',
  },
];

/**
 * Revenue Tab - Consolidated money management
 *
 * Merges the previous Payments and Billing pages into a single tabbed interface.
 * - Payments: Stripe Connect onboarding and dashboard access
 * - Billing: Subscription tiers and AI usage tracking
 *
 * @see AdminSidebar.tsx for navigation mapping
 */
export default function RevenuePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600" />
        </div>
      }
    >
      <RevenuePageInner />
    </Suspense>
  );
}

function RevenuePageInner() {
  const searchParams = useSearchParams();
  // Default to billing if coming from a billing redirect (success/canceled params)
  const hasStripeParams = searchParams.get('success') || searchParams.get('canceled');
  const hasStripeOnboarding = searchParams.get('stripe_onboarding');
  const defaultTab: RevenueTab = hasStripeOnboarding
    ? 'payments'
    : hasStripeParams
      ? 'billing'
      : 'payments';

  const [activeTab, setActiveTab] = useState<RevenueTab>(defaultTab);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">Revenue</h1>
        <p className="mt-2 text-text-muted">Manage payments, subscriptions, and billing</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-neutral-700 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-sage text-white shadow-md'
                : 'text-text-muted hover:bg-surface hover:text-text-primary'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'payments' && <PaymentsContent />}
        {activeTab === 'billing' && <BillingContent />}
      </div>
    </div>
  );
}
