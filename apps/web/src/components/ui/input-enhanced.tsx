'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface InputEnhancedProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
  errorMessage?: string;
  label?: string;
  floatingLabel?: boolean;
  helperText?: string;
  showCharCount?: boolean;
  clearable?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClear?: () => void;
}

const InputEnhanced = React.forwardRef<HTMLInputElement, InputEnhancedProps>(
  (
    {
      className,
      type,
      error,
      errorMessage,
      label,
      floatingLabel = false,
      helperText,
      showCharCount = false,
      clearable = false,
      leftIcon,
      rightIcon,
      onClear,
      required,
      id,
      maxLength,
      value,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(!!value);

    // Derive error state
    const hasError = !!error;
    const displayErrorMessage = typeof error === 'string' ? error : errorMessage;

    React.useEffect(() => {
      setHasValue(!!value);
    }, [value]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(!!e.target.value);
      props.onChange?.(e);
    };

    const showFloatingLabel = floatingLabel && label;
    const isLabelFloating = isFocused || hasValue;

    const charCount = typeof value === 'string' ? value.length : 0;
    const showCount = showCharCount && maxLength;

    return (
      <div className="w-full">
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <input
            type={type}
            id={inputId}
            value={value}
            maxLength={maxLength}
            className={cn(
              'peer flex h-14 w-full rounded-lg border bg-white px-4 py-2.5 text-base',
              'shadow-sm hover:shadow-md',
              'transition-all duration-200 ease-out',
              'hover:border-primary/40',
              'focus:border-sage focus:shadow-lg',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sage/30 focus-visible:ring-offset-0',
              'placeholder:text-neutral-500 placeholder:transition-opacity focus:placeholder:opacity-70',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:border-neutral-200',
              'bg-gradient-to-b from-white to-neutral-50/50',
              'text-neutral-900',
              hasError
                ? 'border-red-500 focus:border-red-600 focus-visible:ring-red-500/30'
                : 'border-neutral-300',
              showFloatingLabel && 'pt-6 pb-2',
              leftIcon && 'pl-10',
              (rightIcon || clearable) && 'pr-10',
              className
            )}
            ref={ref}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            aria-invalid={hasError}
            aria-errormessage={hasError && displayErrorMessage ? errorId : undefined}
            aria-describedby={helperText ? helperId : undefined}
            aria-required={required}
            {...props}
          />

          {/* Floating Label */}
          {showFloatingLabel && (
            <label
              htmlFor={inputId}
              className={cn(
                'absolute left-4 pointer-events-none',
                'transition-all duration-200 ease-in-out',
                isLabelFloating
                  ? 'top-2 text-xs font-semibold text-primary'
                  : 'top-1/2 -translate-y-1/2 text-base text-neutral-600',
                leftIcon && (isLabelFloating ? 'left-4' : 'left-10'),
                hasError && isLabelFloating && 'text-red-700'
              )}
            >
              {label}
              {required && <span className="ml-1 text-red-600">*</span>}
            </label>
          )}

          {/* Non-floating Label */}
          {!showFloatingLabel && label && (
            <label htmlFor={inputId} className="block text-sm font-semibold text-neutral-800 mb-2">
              {label}
              {required && <span className="ml-1 text-red-600">*</span>}
            </label>
          )}

          {/* Right Icon or Clear Button */}
          {clearable && hasValue && !props.disabled ? (
            <button
              type="button"
              onClick={() => {
                onClear?.();
                setHasValue(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
              aria-label="Clear input"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            rightIcon && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                {rightIcon}
              </div>
            )
          )}
        </div>

        {/* Helper Text / Error Message / Character Count */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex-1">
            {hasError && displayErrorMessage ? (
              <span
                id={errorId}
                className="text-sm text-red-600 flex items-center gap-1"
                role="alert"
              >
                {displayErrorMessage}
              </span>
            ) : helperText ? (
              <span id={helperId} className="text-sm text-neutral-500">
                {helperText}
              </span>
            ) : null}
          </div>

          {showCount && (
            <span
              className={cn(
                'text-xs font-medium tabular-nums',
                charCount > maxLength! * 0.9 ? 'text-amber-600' : 'text-neutral-400',
                charCount >= maxLength! && 'text-red-600'
              )}
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

InputEnhanced.displayName = 'InputEnhanced';

export { InputEnhanced };
