import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  errorMessage?: string;
  label?: string;
  helperText?: string;
  showCharCount?: boolean;
  autoResize?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      error,
      errorMessage,
      label,
      helperText,
      showCharCount = false,
      autoResize = false,
      maxLength,
      value,
      required,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    // Auto-resize functionality
    React.useEffect(() => {
      if (autoResize && textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, [value, autoResize]);

    // Merge refs
    const setRefs = (element: HTMLTextAreaElement | null) => {
      textareaRef.current = element;
      if (typeof ref === 'function') {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    };

    const charCount = typeof value === 'string' ? value.length : 0;
    const showCount = showCharCount && maxLength;

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-neutral-700 mb-2">
            {label}
            {required && <span className="ml-1 text-danger-500">*</span>}
          </label>
        )}

        {/* Textarea */}
        <textarea
          id={inputId}
          value={value}
          maxLength={maxLength}
          className={cn(
            'flex min-h-[120px] w-full rounded-lg border bg-white px-4 py-3 text-base',
            'shadow-sm hover:shadow-elevation-1',
            'transition-all duration-300 ease-spring',
            'hover:border-macon-orange/30',
            'focus:border-macon-orange/50 focus:shadow-elevation-2',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-macon-orange/20 focus-visible:ring-offset-2',
            'placeholder:text-neutral-400',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
            'resize-none', // Prevent manual resize when auto-resize is on
            'bg-gradient-to-b from-white to-neutral-50/50',
            error
              ? 'border-danger-500 focus:border-danger-600 focus:ring-danger-200'
              : 'border-neutral-200/80',
            className
          )}
          ref={setRefs}
          aria-invalid={error}
          aria-errormessage={error && errorMessage ? errorId : undefined}
          aria-describedby={helperText ? helperId : undefined}
          aria-required={required}
          {...props}
        />

        {/* Helper Text / Error Message / Character Count */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex-1">
            {error && errorMessage ? (
              <span id={errorId} className="text-sm text-danger-600" role="alert">
                {errorMessage}
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
                charCount > maxLength! * 0.9 ? 'text-warning-600' : 'text-neutral-400',
                charCount >= maxLength! && 'text-danger-600'
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

Textarea.displayName = 'Textarea';

export { Textarea };
