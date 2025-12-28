/**
 * CustomerDetailsStep Component (Step 2)
 *
 * Collects customer information including name, email,
 * phone (optional), and notes (optional).
 */

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { InputEnhanced } from '@/components/ui/input-enhanced';
import { User, Mail, Phone } from 'lucide-react';
import type { CustomerDetailsStepProps } from './types';

// P3-355 FIX: Removed React.memo - simple presentational component doesn't benefit from memoization
export default function CustomerDetailsStep({
  customerDetails,
  onUpdateField,
  validationErrors,
}: CustomerDetailsStepProps) {
  return (
    <Card className="border-neutral-200 shadow-elevation-1">
      <CardHeader>
        <CardTitle className="text-2xl font-heading">Your Information</CardTitle>
        <p className="text-neutral-500 text-base mt-1">We'll use this to send your confirmation</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <InputEnhanced
            id="name"
            type="text"
            value={customerDetails.name}
            onChange={(e) => onUpdateField('name', e.target.value)}
            placeholder="Jane & John Smith"
            label="Name(s)"
            floatingLabel
            leftIcon={<User className="w-5 h-5" />}
            clearable
            onClear={() => onUpdateField('name', '')}
            required
            error={customerDetails.name && validationErrors.name}
          />
          <InputEnhanced
            id="email"
            type="email"
            value={customerDetails.email}
            onChange={(e) => onUpdateField('email', e.target.value)}
            placeholder="your.email@example.com"
            label="Email Address"
            floatingLabel
            leftIcon={<Mail className="w-5 h-5" />}
            clearable
            onClear={() => onUpdateField('email', '')}
            required
            error={customerDetails.email && validationErrors.email}
          />
          <InputEnhanced
            id="phone"
            type="tel"
            value={customerDetails.phone}
            onChange={(e) => onUpdateField('phone', e.target.value)}
            placeholder="(555) 123-4567"
            label="Phone Number (optional)"
            floatingLabel
            leftIcon={<Phone className="w-5 h-5" />}
            clearable
            onClear={() => onUpdateField('phone', '')}
          />
          <div>
            <label htmlFor="notes" className="block text-sm font-semibold text-neutral-800 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={customerDetails.notes}
              onChange={(e) => onUpdateField('notes', e.target.value)}
              placeholder="Any special requests or information..."
              className="w-full h-24 px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-base text-neutral-900 placeholder:text-neutral-500 focus:border-macon-orange focus:outline-none focus:ring-4 focus:ring-macon-orange/30 transition-all"
              maxLength={500}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
