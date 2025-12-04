import { useMemo } from 'react';
import type { AddOnDto } from '@macon/contracts';

export function useBookingTotal(
  basePriceCents: number,
  addOns: AddOnDto[],
  selectedAddOnIds: Set<string>
): number {
  return useMemo(() => {
    let totalCents = basePriceCents;

    for (const addOn of addOns) {
      if (selectedAddOnIds.has(addOn.id)) {
        totalCents += addOn.priceCents;
      }
    }

    return totalCents / 100; // Convert to dollars
  }, [basePriceCents, addOns, selectedAddOnIds]);
}
