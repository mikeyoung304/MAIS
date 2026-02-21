'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getIntakeQuestion,
  getNextQuestionId,
  getFirstQuestionId,
  getRequiredQuestionIds,
  TOTAL_INTAKE_QUESTIONS,
  type IntakeQuestion as IntakeQuestionConfig,
} from '@macon/contracts';
import { IntakeQuestion } from './IntakeQuestion';

// =============================================================================
// Types
// =============================================================================

interface IntakeChatProps {
  initialAnswers: Record<string, unknown>;
  initialAnsweredIds: string[];
  onComplete: () => Promise<void>;
}

interface AnsweredEntry {
  question: IntakeQuestionConfig;
  answer: string | string[];
  /** The display label for the answer (e.g. option label for selects) */
  displayAnswer: string;
}

// =============================================================================
// IntakeChat Component
// =============================================================================

/**
 * Chat-style intake form for onboarding.
 *
 * Renders questions as message bubbles in a conversational flow.
 * Replays previously answered questions as read-only, then presents
 * the next unanswered question with its appropriate input.
 */
export function IntakeChat({ initialAnswers, initialAnsweredIds, onComplete }: IntakeChatProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [answeredEntries, setAnsweredEntries] = useState<AnsweredEntry[]>([]);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const currentQuestion = useMemo(
    () => (currentQuestionId ? getIntakeQuestion(currentQuestionId) : undefined),
    [currentQuestionId]
  );

  const answeredCount = answeredEntries.length;
  const canComplete = useMemo(() => {
    const requiredIds = getRequiredQuestionIds();
    return requiredIds.every((id) => answers[id] !== undefined && answers[id] !== '');
  }, [answers]);

  const isAllDone = currentQuestionId === null;

  // ---------------------------------------------------------------------------
  // Initialize: replay initial answers
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const entries: AnsweredEntry[] = [];
    const allAnswers = { ...initialAnswers };

    // Walk the question graph in order, replaying answered questions
    let qId: string | null = getFirstQuestionId();

    while (qId) {
      if (initialAnsweredIds.includes(qId)) {
        const q = getIntakeQuestion(qId);
        if (q) {
          const rawAnswer = allAnswers[qId];
          const ansStr = typeof rawAnswer === 'string' ? rawAnswer : String(rawAnswer ?? '');
          entries.push({
            question: q,
            answer: ansStr,
            displayAnswer: getDisplayAnswer(q, ansStr),
          });
        }
        qId = getNextQuestionId(qId, allAnswers);
      } else {
        break;
      }
    }

    setAnsweredEntries(entries);
    setCurrentQuestionId(qId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // ---------------------------------------------------------------------------
  // Auto-scroll to bottom
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(timer);
  }, [answeredEntries.length, currentQuestionId]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAnswerSubmit = useCallback(
    async (answer: string | string[]) => {
      if (!currentQuestionId || isSubmitting) return;

      const question = getIntakeQuestion(currentQuestionId);
      if (!question) return;

      setIsSubmitting(true);
      setError(null);

      try {
        // Save to server
        const res = await fetch('/api/tenant-admin/onboarding/intake/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: currentQuestionId, answer }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { message?: string }).message ?? 'Could not save answer. Try again.'
          );
        }

        // Update local state
        const updatedAnswers = { ...answers, [currentQuestionId]: answer };
        setAnswers(updatedAnswers);

        const displayAnswer = getDisplayAnswer(
          question,
          typeof answer === 'string' ? answer : answer.join(', ')
        );
        setAnsweredEntries((prev) => [...prev, { question, answer, displayAnswer }]);

        // Advance to next question
        const nextId = getNextQuestionId(currentQuestionId, updatedAnswers);
        setCurrentQuestionId(nextId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentQuestionId, isSubmitting, answers]
  );

  const handleComplete = useCallback(async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    setError(null);

    try {
      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete. Try again.');
      setIsCompleting(false);
    }
  }, [isCompleting, onComplete]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Progress bar */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-muted">
            Question {Math.min(answeredCount + 1, TOTAL_INTAKE_QUESTIONS)} of{' '}
            {TOTAL_INTAKE_QUESTIONS}
          </span>
          <span className="text-xs text-text-muted">
            {Math.round((answeredCount / TOTAL_INTAKE_QUESTIONS) * 100)}%
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-neutral-800 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-sage"
            initial={{ width: 0 }}
            animate={{
              width: `${(answeredCount / TOTAL_INTAKE_QUESTIONS) * 100}%`,
            }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Chat log */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6"
      >
        {/* Answered questions: read-only bubbles */}
        <AnimatePresence mode="popLayout">
          {answeredEntries.map((entry, index) => (
            <motion.div
              key={`answered-${entry.question.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="space-y-1.5"
            >
              <p className="text-xs text-text-muted">{entry.question.prompt}</p>
              <p className="text-sm text-text-primary font-medium">{entry.displayAnswer}</p>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Current question */}
        <AnimatePresence mode="wait">
          {currentQuestion && (
            <motion.div
              key={`active-${currentQuestion.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Question bubble */}
              <div
                className={cn(
                  'max-w-[85vw] sm:max-w-lg',
                  'bg-surface-alt border border-neutral-800 rounded-3xl',
                  'px-5 py-4'
                )}
              >
                <p className="text-sm font-medium text-text-primary mb-1">
                  {currentQuestion.prompt}
                </p>
                {currentQuestion.subtext && (
                  <p className="text-xs text-text-muted">{currentQuestion.subtext}</p>
                )}
              </div>

              {/* Input area (staggered after bubble) */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.15 }}
                className="max-w-[85vw] sm:max-w-lg"
              >
                <IntakeQuestion
                  question={currentQuestion}
                  onSubmit={handleAnswerSubmit}
                  isSubmitting={isSubmitting}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* All questions answered: show completion */}
        <AnimatePresence>
          {isAllDone && canComplete && (
            <motion.div
              key="completion"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 py-4"
            >
              <div
                className={cn(
                  'max-w-[85vw] sm:max-w-lg',
                  'bg-surface-alt border border-neutral-800 rounded-3xl',
                  'px-5 py-4'
                )}
              >
                <p className="text-sm font-medium text-text-primary">
                  That covers it. Ready to build your site?
                </p>
                <p className="text-xs text-text-muted mt-1">
                  We will use your answers to generate your storefront, pricing, and content.
                </p>
              </div>

              <Button
                variant="sage"
                size="lg"
                className="w-full sm:w-auto shadow-lg hover:shadow-xl hover:shadow-sage/20 transition-all duration-300"
                disabled={isCompleting}
                onClick={handleComplete}
                isLoading={isCompleting}
                loadingText="Starting build..."
              >
                <span className="flex items-center gap-2">
                  Build my site
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Error region for screen readers */}
      <div aria-live="assertive" className="sr-only">
        {error && <p role="alert">{error}</p>}
      </div>

      {/* Visible error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex-shrink-0 px-4 sm:px-6 py-3"
          >
            <div
              className="bg-red-900/20 border border-red-400/30 rounded-2xl px-4 py-3"
              role="alert"
            >
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the display-friendly version of an answer.
 * For select questions, returns the label instead of the value.
 */
function getDisplayAnswer(question: IntakeQuestionConfig, rawAnswer: string): string {
  if (!rawAnswer) return '(skipped)';

  if (question.type === 'select' && question.options) {
    const option = question.options.find((o) => o.value === rawAnswer);
    return option?.label ?? rawAnswer;
  }

  return rawAnswer;
}
