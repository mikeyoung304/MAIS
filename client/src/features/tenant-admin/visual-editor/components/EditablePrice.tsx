/**
 * EditablePrice - Click-to-edit price component with dollar formatting
 *
 * Features:
 * - Displays price in dollars (e.g., $99.99)
 * - Input accepts dollar values, converts to cents on save
 * - Visual indicator for unsaved changes
 * - Validates numeric input
 */

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Pencil } from 'lucide-react';

interface EditablePriceProps {
  /** Price in cents */
  value: number;
  /** Called with price in cents */
  onChange: (value: number) => void;
  className?: string;
  hasDraft?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Format cents to dollars string (e.g., 9999 -> "99.99")
 */
function formatCentsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Parse dollars string to cents (e.g., "99.99" -> 9999)
 */
function parseDollarsToCents(dollars: string): number {
  const parsed = parseFloat(dollars);
  if (isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function EditablePrice({
  value,
  onChange,
  className,
  hasDraft = false,
  disabled = false,
  'aria-label': ariaLabel,
}: EditablePriceProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(formatCentsToDollars(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync edit value when external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(formatCentsToDollars(value));
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      setIsEditing(true);
    }
  }, [disabled]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const cents = parseDollarsToCents(editValue);
    if (cents !== value) {
      onChange(cents);
    }
    // Reset to formatted value (in case user entered incomplete input)
    setEditValue(formatCentsToDollars(cents));
  }, [editValue, value, onChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const cents = parseDollarsToCents(editValue);
        if (cents !== value) {
          onChange(cents);
        }
        setEditValue(formatCentsToDollars(cents));
        setIsEditing(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditValue(formatCentsToDollars(value));
        setIsEditing(false);
      }
    },
    [editValue, value, onChange]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only numeric input with optional decimal point
    const inputValue = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(inputValue) || inputValue === '') {
      setEditValue(inputValue);
    }
  }, []);

  // Display mode
  if (!isEditing) {
    return (
      <div
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel || 'Edit price'}
        className={cn(
          'group relative inline-flex items-center cursor-pointer rounded px-2 py-1 transition-colors',
          'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          hasDraft && 'ring-1 ring-amber-400/50 bg-amber-50/30',
          disabled && 'cursor-not-allowed opacity-60',
          className
        )}
      >
        <span className="font-semibold text-lg">${formatCentsToDollars(value)}</span>
        {!disabled && (
          <Pencil
            className={cn(
              'ml-1 h-3 w-3 text-muted-foreground opacity-0 transition-opacity',
              'group-hover:opacity-100 group-focus:opacity-100'
            )}
            aria-hidden="true"
          />
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="inline-flex items-center">
      <span className="text-muted-foreground mr-1">$</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={editValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel || 'Edit price'}
        className={cn(
          'w-24 rounded border border-input bg-background px-2 py-1',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          'font-semibold text-lg'
        )}
      />
    </div>
  );
}
