import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { useState, useEffect } from 'react';
import type { AddOnDto } from '@macon/contracts';

interface TotalBoxProps {
  total: number;
  packagePrice?: number;
  packageName?: string;
  selectedAddOns?: AddOnDto[];
}

export function TotalBox({ total, packagePrice, packageName, selectedAddOns = [] }: TotalBoxProps) {
  // Convert total from dollars to cents for formatCurrency
  const totalCents = Math.round(total * 100);
  const packagePriceCents = packagePrice ? Math.round(packagePrice) : 0;

  // Animation state for total changes
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [total]);

  // Calculate subtotal and tax (example: 8% tax)
  const subtotalCents = totalCents;
  const taxRate = 0.08;
  const taxCents = Math.round(subtotalCents * taxRate);
  const finalTotalCents = subtotalCents + taxCents;

  return (
    <div className="sticky top-4">
      <Card className="bg-white border-neutral-200 shadow-elevation-2">
        <CardHeader className="border-b border-neutral-100">
          <CardTitle className="text-xl text-neutral-900">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Package base price */}
          {packageName && packagePriceCents > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">{packageName}</span>
              <span className="text-base font-semibold text-neutral-900">
                {formatCurrency(packagePriceCents)}
              </span>
            </div>
          )}

          {/* Selected add-ons */}
          {selectedAddOns.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-neutral-100">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Add-Ons
              </p>
              {selectedAddOns.map((addOn) => (
                <div
                  key={addOn.id}
                  className="flex justify-between items-center animate-in slide-in-from-top-2 duration-200"
                >
                  <span className="text-sm text-neutral-600">{addOn.title}</span>
                  <span className="text-base font-semibold text-macon-orange">
                    +{formatCurrency(addOn.priceCents)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Subtotal */}
          <div className="flex justify-between items-center pt-3 border-t border-neutral-200">
            <span className="text-sm font-medium text-neutral-700">Subtotal</span>
            <span className="text-lg font-semibold text-neutral-900">
              {formatCurrency(subtotalCents)}
            </span>
          </div>

          {/* Tax */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-neutral-600">Tax (8%)</span>
            <span className="text-base font-semibold text-neutral-700">
              {formatCurrency(taxCents)}
            </span>
          </div>

          {/* Total */}
          <div className="flex justify-between items-baseline pt-4 border-t-2 border-neutral-300">
            <span className="text-lg font-bold text-neutral-900 uppercase tracking-wide">
              Total
            </span>
            <span
              className={`text-4xl font-bold text-macon-navy tracking-tight transition-all duration-300 ${
                isAnimating ? 'scale-110' : 'scale-100'
              }`}
            >
              {formatCurrency(finalTotalCents)}
            </span>
          </div>

          <p className="text-xs text-neutral-500 pt-2 text-center">All-inclusive pricing</p>
        </CardContent>
      </Card>
    </div>
  );
}
