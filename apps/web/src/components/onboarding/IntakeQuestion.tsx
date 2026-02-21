'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntakeQuestion as IntakeQuestionConfig } from '@macon/contracts';

// =============================================================================
// IntakeQuestion Component
// =============================================================================

interface IntakeQuestionProps {
  question: IntakeQuestionConfig;
  onSubmit: (answer: string | string[]) => void;
  isSubmitting: boolean;
}

/**
 * Renders the active intake question input based on question type.
 *
 * Input types:
 * - text: Single-line input with Enter to submit
 * - textarea: Multi-line with Submit button (Enter submits on desktop)
 * - select: Grid of option buttons with click-to-advance
 * - url: Single-line URL input with optional Skip button
 */
export function IntakeQuestion({ question, onSubmit, isSubmitting }: IntakeQuestionProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Auto-focus with delay for animation
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, [question.id]);

  // Reset value when question changes
  useEffect(() => {
    setValue('');
    setError(null);
  }, [question.id]);

  const validate = useCallback(
    (v: string): boolean => {
      const result = question.validation.safeParse(v);
      if (!result.success) {
        const firstIssue = result.error.issues[0];
        setError(firstIssue?.message ?? 'Invalid input');
        return false;
      }
      setError(null);
      return true;
    },
    [question.validation]
  );

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;
    const trimmed = value.trim();
    if (!validate(trimmed)) return;
    onSubmit(trimmed);
  }, [isSubmitting, value, validate, onSubmit]);

  const handleSkip = useCallback(() => {
    if (isSubmitting) return;
    onSubmit('');
  }, [isSubmitting, onSubmit]);

  const handleSelectOption = useCallback(
    (optionValue: string) => {
      if (isSubmitting) return;
      const result = question.validation.safeParse(optionValue);
      if (!result.success) {
        const firstIssue = result.error.issues[0];
        setError(firstIssue?.message ?? 'Invalid selection');
        return;
      }
      setError(null);
      onSubmit(optionValue);
    },
    [isSubmitting, question.validation, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setValue('');
        setError(null);
        return;
      }

      if (question.type === 'textarea') {
        // Shift+Enter for newlines, Enter submits on desktop
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      } else {
        // Enter to submit for text and url
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        }
      }
    },
    [question.type, handleSubmit]
  );

  // Select type: grid of option buttons
  if (question.type === 'select' && question.options) {
    return (
      <div className="space-y-3">
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-2"
          role="radiogroup"
          aria-label={question.prompt}
        >
          {question.options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={value === option.value}
              disabled={isSubmitting}
              onClick={() => handleSelectOption(option.value)}
              className={cn(
                'min-h-[44px] px-4 py-3 rounded-2xl border text-left text-sm font-medium',
                'transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sage/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                value === option.value
                  ? 'bg-sage/20 border-sage text-text-primary'
                  : 'bg-surface-alt border-neutral-700 text-text-muted hover:bg-sage/10 hover:border-sage/50 hover:text-text-primary'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Textarea type
  if (question.type === 'textarea') {
    return (
      <div className="space-y-3">
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={question.placeholder}
          disabled={isSubmitting}
          rows={3}
          className={cn(
            'w-full bg-surface border rounded-2xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/50',
            'focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage/40',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'resize-none',
            error ? 'border-red-400/60' : 'border-neutral-700'
          )}
          aria-label={question.prompt}
          aria-invalid={!!error}
          aria-describedby={error ? `error-${question.id}` : undefined}
        />
        {error && (
          <p id={`error-${question.id}`} className="text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            variant="sage"
            size="default"
            disabled={isSubmitting || !value.trim()}
            onClick={handleSubmit}
            isLoading={isSubmitting}
            loadingText="Saving..."
          >
            <span className="flex items-center gap-2">
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Button>
        </div>
      </div>
    );
  }

  // URL type: text input with optional Skip
  if (question.type === 'url') {
    return (
      <div className="space-y-3">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="url"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={question.placeholder}
          disabled={isSubmitting}
          className={cn(
            'w-full bg-surface border rounded-2xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/50',
            'focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage/40',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error ? 'border-red-400/60' : 'border-neutral-700'
          )}
          aria-label={question.prompt}
          aria-invalid={!!error}
          aria-describedby={error ? `error-${question.id}` : undefined}
        />
        {error && (
          <p id={`error-${question.id}`} className="text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          {!question.required && (
            <Button
              variant="ghost-light"
              size="default"
              disabled={isSubmitting}
              onClick={handleSkip}
            >
              <span className="flex items-center gap-1.5">
                <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                Skip
              </span>
            </Button>
          )}
          <Button
            variant="sage"
            size="default"
            disabled={isSubmitting || !value.trim()}
            onClick={handleSubmit}
            isLoading={isSubmitting}
            loadingText="Saving..."
          >
            <span className="flex items-center gap-2">
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Button>
        </div>
      </div>
    );
  }

  // Default: text type
  return (
    <div className="space-y-3">
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={handleKeyDown}
        placeholder={question.placeholder}
        disabled={isSubmitting}
        className={cn(
          'w-full bg-surface border rounded-2xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/50',
          'focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-red-400/60' : 'border-neutral-700'
        )}
        aria-label={question.prompt}
        aria-invalid={!!error}
        aria-describedby={error ? `error-${question.id}` : undefined}
      />
      {error && (
        <p id={`error-${question.id}`} className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
