/**
 * ReviewStep Component (Step 3)
 *
 * Displays a summary of the booking including package,
 * date, customer info, and total price before checkout.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { ReviewStepProps } from './types';

const ReviewStep = React.memo(
  ({ package: pkg, selectedDate, customerDetails }: ReviewStepProps) => {
    return (
      <Card className="border-neutral-200 shadow-elevation-1">
        <CardHeader>
          <CardTitle className="text-2xl font-heading">Review & Pay</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Package Summary */}
            <div className="border-b border-neutral-200 pb-4">
              <h3 className="text-sm font-semibold text-neutral-500 uppercase mb-2">Package</h3>
              <p className="text-lg font-semibold text-neutral-900">{pkg.title}</p>
            </div>

            {/* Date Summary */}
            <div className="border-b border-neutral-200 pb-4">
              <h3 className="text-sm font-semibold text-neutral-500 uppercase mb-2">Event Date</h3>
              <p className="text-lg font-semibold text-neutral-900">{formatDate(selectedDate)}</p>
            </div>

            {/* Customer Info Summary */}
            <div className="border-b border-neutral-200 pb-4">
              <h3 className="text-sm font-semibold text-neutral-500 uppercase mb-2">
                Contact Information
              </h3>
              <p className="text-neutral-900 font-medium">{customerDetails.name}</p>
              <p className="text-neutral-600">{customerDetails.email}</p>
              {customerDetails.phone && (
                <p className="text-neutral-600">{customerDetails.phone}</p>
              )}
              {customerDetails.notes && (
                <p className="text-neutral-600 mt-2 text-sm italic">"{customerDetails.notes}"</p>
              )}
            </div>

            {/* Total */}
            <div className="pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-lg text-neutral-600">Total:</span>
                <span className="text-3xl font-heading font-bold text-macon-orange">
                  {formatCurrency(pkg.priceCents)}
                </span>
              </div>
              <p className="text-sm text-neutral-500 mt-2">Secure payment powered by Stripe</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

ReviewStep.displayName = 'ReviewStep';

export default ReviewStep;
