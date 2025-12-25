'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  errorMessage?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, errorMessage, required, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;

    return (
      <>
        <input
          type={type}
          id={inputId}
          className={cn(
            'flex h-11 w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-neutral-900',
            'shadow-sm hover:shadow-elevation-1',
            'transition-all duration-200 ease-out',
            'hover:border-macon-navy/40',
            'focus:border-macon-orange focus:shadow-elevation-2',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-macon-orange/30 focus-visible:ring-offset-0',
            'placeholder:text-neutral-500 placeholder:transition-opacity focus:placeholder:opacity-70',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:border-neutral-200',
            'file:border-0 file:bg-transparent file:text-sm file:font-medium',
            'bg-gradient-to-b from-white to-neutral-50/50',
            error
              ? 'border-danger-500 focus:border-danger-600 focus-visible:ring-danger-500/30'
              : 'border-neutral-300',
            className
          )}
          ref={ref}
          aria-invalid={error}
          aria-errormessage={error && errorMessage ? errorId : undefined}
          aria-required={required}
          {...props}
        />
        {error && errorMessage && (
          <span id={errorId} className="mt-1 text-sm text-danger-600" role="alert">
            {errorMessage}
          </span>
        )}
      </>
    );
  }
);
Input.displayName = 'Input';

export { Input };
