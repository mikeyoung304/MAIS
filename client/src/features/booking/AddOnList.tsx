import type { AddOnDto } from '@macon/contracts';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';

interface AddOnListProps {
  addOns: AddOnDto[];
  selected: Set<string>;
  onToggle: (addOnId: string) => void;
}

export function AddOnList({ addOns, selected, onToggle }: AddOnListProps) {
  return (
    <div className="space-y-3">
      {addOns.map((addOn) => {
        const isSelected = selected.has(addOn.id);

        return (
          <Card
            key={addOn.id}
            className={cn(
              'cursor-pointer transition-all duration-300 bg-white border-gray-200 hover:border-gray-300 hover:scale-[1.02] active:scale-[0.98]',
              isSelected && 'border-macon-orange shadow-elevation-2 bg-orange-50 scale-[1.01]'
            )}
            onClick={() => onToggle(addOn.id)}
          >
            <label className="flex items-start gap-4 p-5 cursor-pointer">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(addOn.id)}
                  className="sr-only"
                />
                <div
                  className={cn(
                    'h-6 w-6 rounded-md border-2 transition-all duration-300 flex items-center justify-center',
                    isSelected
                      ? 'bg-macon-orange border-macon-orange scale-110 rotate-[360deg]'
                      : 'bg-white border-gray-300 hover:border-macon-orange/50 scale-100'
                  )}
                >
                  {isSelected && (
                    <Check className="h-4 w-4 text-white stroke-[3] animate-in zoom-in-50 duration-200" />
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3
                      className={cn(
                        'font-semibold transition-colors text-xl mb-1',
                        isSelected ? 'text-gray-900' : 'text-gray-800'
                      )}
                    >
                      {addOn.title}
                    </h3>
                    {addOn.description && (
                      <p className="text-sm text-gray-600 leading-relaxed">{addOn.description}</p>
                    )}
                  </div>
                  <div className="relative">
                    <span
                      className={cn(
                        'font-bold transition-all duration-300 shrink-0 text-2xl block',
                        isSelected ? 'text-macon-orange scale-110' : 'text-gray-700 scale-100'
                      )}
                    >
                      {formatCurrency(addOn.priceCents)}
                    </span>
                    {isSelected && (
                      <div className="absolute -right-2 -top-2 h-2 w-2 bg-macon-orange rounded-full animate-ping" />
                    )}
                  </div>
                </div>
              </div>
            </label>
          </Card>
        );
      })}
    </div>
  );
}
