'use client';

import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, AlertTriangle } from 'lucide-react';

interface TrialBannerProps {
  daysRemaining: number;
  status: 'TRIALING' | 'EXPIRED';
}

/**
 * TrialBanner Component
 *
 * Shows trial countdown or expired status:
 * - TRIALING: "X days left in your trial"
 * - EXPIRED: "Your trial has ended"
 */
export function TrialBanner({ daysRemaining, status }: TrialBannerProps) {
  if (status === 'EXPIRED') {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Your trial has ended. Subscribe to continue using all features.</span>
          <Link
            href="/tenant/billing"
            className="ml-4 font-medium underline hover:no-underline"
          >
            Subscribe now
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  // TRIALING status
  const urgency = daysRemaining <= 3;

  return (
    <Alert
      className={`mb-6 ${
        urgency
          ? 'border-amber-500/50 bg-amber-50'
          : 'border-sage/30 bg-sage/10'
      }`}
    >
      <Clock className={`h-4 w-4 ${urgency ? 'text-amber-600' : 'text-sage'}`} />
      <AlertDescription className="flex items-center justify-between">
        <span className={urgency ? 'text-amber-800' : 'text-sage-dark'}>
          {daysRemaining === 1
            ? '1 day left in your trial'
            : `${daysRemaining} days left in your trial`}
          {urgency && ' — upgrade now to keep your features'}
        </span>
        <Link
          href="/tenant/billing"
          className={`ml-4 font-medium underline hover:no-underline ${
            urgency ? 'text-amber-800' : 'text-sage'
          }`}
        >
          Upgrade now
        </Link>
      </AlertDescription>
    </Alert>
  );
}
