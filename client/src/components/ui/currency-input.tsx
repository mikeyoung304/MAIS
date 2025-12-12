import * as React from 'react';
import { DollarSign } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toCents, fromCents } from '@/lib/api-helpers';

export interface CurrencyInputProps
  extends Omit<InputProps, 'type' | 'step' | 'value' | 'onChange'> {
  /**
   * Value in cents as a string (to match form state pattern)
   * Example: "50000" for $500.00
   */
  value: string;
  /**
   * Called with new value in cents as a string
   * Example: onChange("50000") when user types 500.00
   */
  onChange: (centsValue: string) => void;
  /**
   * Called when input loses focus (optional)
   */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
}

/**
 * CurrencyInput - Reusable dollar input that stores value in cents
 *
 * Features:
 * - Displays and accepts dollars (e.g., 500.00)
 * - Stores value in cents internally (e.g., "50000")
 * - $ icon prefix for visual clarity
 * - Handles floating-point conversion safely
 * - Supports all standard Input props (disabled, required, error, etc.)
 *
 * Usage:
 * ```tsx
 * <CurrencyInput
 *   value={form.priceCents}
 *   onChange={(cents) => setForm({ ...form, priceCents: cents })}
 *   placeholder="500.00"
 *   disabled={isSaving}
 *   error={!!fieldErrors.priceCents}
 *   errorMessage={fieldErrors.priceCents}
 * />
 * ```
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, onBlur, className, placeholder = '0.00', ...props }, ref) => {
    // Convert cents to dollars for display
    const displayValue = React.useMemo(() => {
      if (!value || value === '') return '';
      const cents = parseInt(value, 10);
      if (isNaN(cents)) return '';
      return fromCents(cents).toString();
    }, [value]);

    // Handle user input: convert dollars to cents for storage
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const dollarValue = e.target.value;

        if (dollarValue === '') {
          onChange('');
          return;
        }

        const dollars = parseFloat(dollarValue);
        if (!isNaN(dollars) && dollars >= 0) {
          onChange(toCents(dollars).toString());
        }
        // Invalid input is ignored (browser's type="number" prevents most invalid input)
      },
      [onChange]
    );

    return (
      <div className="relative">
        <DollarSign
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 pointer-events-none"
          aria-hidden="true"
        />
        <Input
          ref={ref}
          type="number"
          step="0.01"
          min="0"
          value={displayValue}
          onChange={handleChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className={cn('pl-10', className)}
          {...props}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
