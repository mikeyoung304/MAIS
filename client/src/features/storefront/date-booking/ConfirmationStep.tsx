/**
 * ConfirmationStep Component (Step 0)
 *
 * Displays package details and confirms the user's selection
 * before proceeding to date selection.
 */

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { ConfirmationStepProps } from './types';

// P3-355 FIX: Removed React.memo - simple presentational component doesn't benefit from memoization
export default function ConfirmationStep({ package: pkg }: ConfirmationStepProps) {
  return (
    <Card className="border-neutral-200 shadow-elevation-1">
      <CardHeader>
        <CardTitle className="text-2xl font-heading">Confirm Your Selection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Package Hero */}
        {pkg.photoUrl && (
          <div className="relative h-48 rounded-xl overflow-hidden">
            <img src={pkg.photoUrl} alt={pkg.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Package Details */}
        <div className="space-y-4">
          <div>
            <h3 className="text-2xl font-heading font-bold text-neutral-900">{pkg.title}</h3>
            <p className="text-3xl font-heading font-bold text-macon-orange mt-2">
              {formatCurrency(pkg.priceCents)}
            </p>
          </div>

          <p className="text-neutral-600 whitespace-pre-wrap">{pkg.description}</p>
        </div>

        {/* Confirmation Message */}
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-900">Great choice!</p>
            <p className="text-sm text-green-700">Click "Continue" to select your event date.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
