'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

/**
 * Feedback status types.
 */
export type FeedbackStatus = 'success' | 'error' | 'warning' | 'info';

/**
 * Props for FormFeedback component.
 */
export interface FormFeedbackProps {
  /** Feedback status type */
  status: FeedbackStatus;
  /** Title text */
  title?: string;
  /** Description text */
  message?: string;
  /** Whether the feedback is visible */
  isVisible?: boolean;
  /** Auto-dismiss after milliseconds (0 = no auto-dismiss) */
  autoDismissMs?: number;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Whether to show close button */
  showClose?: boolean;
  /** Additional className */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * Status icon mapping.
 */
const statusIcons: Record<FeedbackStatus, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

/**
 * Status color mapping.
 */
const statusColors: Record<FeedbackStatus, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const statusIconColors: Record<FeedbackStatus, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

/**
 * FormFeedback - Animated feedback banner for form submissions.
 *
 * Features:
 * - Slide-in animation on mount
 * - Auto-dismiss option
 * - Accessible with ARIA live regions
 * - Multiple status types with appropriate icons and colors
 * - Shake animation for errors
 *
 * @example
 * ```tsx
 * function ContactForm() {
 *   const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
 *
 *   return (
 *     <form>
 *       {status === 'success' && (
 *         <FormFeedback
 *           status="success"
 *           title="Message sent!"
 *           message="We'll get back to you within 24 hours."
 *           autoDismissMs={5000}
 *           onDismiss={() => setStatus('idle')}
 *         />
 *       )}
 *
 *       {status === 'error' && (
 *         <FormFeedback
 *           status="error"
 *           title="Failed to send"
 *           message="Please try again later."
 *           showClose
 *           onDismiss={() => setStatus('idle')}
 *         />
 *       )}
 *     </form>
 *   );
 * }
 * ```
 */
export function FormFeedback({
  status,
  title,
  message,
  isVisible = true,
  autoDismissMs = 0,
  onDismiss,
  showClose = false,
  className,
  children,
}: FormFeedbackProps) {
  const [isAnimatingOut, setIsAnimatingOut] = React.useState(false);
  const Icon = statusIcons[status];

  // Auto-dismiss timer
  React.useEffect(() => {
    if (!isVisible || autoDismissMs <= 0 || !onDismiss) return;

    const timer = setTimeout(() => {
      setIsAnimatingOut(true);
      setTimeout(onDismiss, 300); // Wait for animation
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [isVisible, autoDismissMs, onDismiss]);

  const handleDismiss = React.useCallback(() => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  }, [onDismiss]);

  if (!isVisible) return null;

  return (
    <div
      role="alert"
      aria-live={status === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'relative rounded-xl border p-4',
        'transition-all duration-300 ease-out',
        isAnimatingOut
          ? 'translate-y-2 opacity-0'
          : 'translate-y-0 opacity-100 animate-in slide-in-from-top-2',
        status === 'error' && 'animate-shake',
        statusColors[status],
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', statusIconColors[status])} />
        <div className="flex-1 min-w-0">
          {title && <p className="font-semibold">{title}</p>}
          {message && <p className="text-sm opacity-90">{message}</p>}
          {children}
        </div>
        {showClose && onDismiss && (
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-shrink-0 rounded-lg p-1 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Success animation checkmark for inline use.
 */
export function SuccessCheckmark({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <svg
        className="h-16 w-16 text-green-500"
        viewBox="0 0 52 52"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="stroke-current opacity-20"
          cx="26"
          cy="26"
          r="24"
          fill="none"
          strokeWidth="2"
        />
        <circle
          className="stroke-current animate-draw-circle"
          cx="26"
          cy="26"
          r="24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            strokeDasharray: 151,
            strokeDashoffset: 151,
            animation: 'draw-circle 0.6s ease-in-out forwards',
          }}
        />
        <path
          className="stroke-current animate-draw-check"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14 27l7 7 16-16"
          style={{
            strokeDasharray: 36,
            strokeDashoffset: 36,
            animation: 'draw-check 0.3s ease-in-out 0.4s forwards',
          }}
        />
      </svg>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx>{`
        @keyframes draw-circle {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes draw-check {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Error X animation for inline use.
 */
export function ErrorX({ className }: { className?: string }) {
  return (
    <div className={cn('relative animate-shake', className)}>
      <svg
        className="h-16 w-16 text-red-500"
        viewBox="0 0 52 52"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="stroke-current opacity-20"
          cx="26"
          cy="26"
          r="24"
          fill="none"
          strokeWidth="2"
        />
        <circle
          className="stroke-current"
          cx="26"
          cy="26"
          r="24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            strokeDasharray: 151,
            strokeDashoffset: 151,
            animation: 'draw-circle 0.6s ease-in-out forwards',
          }}
        />
        <path
          className="stroke-current"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          d="M18 18 L34 34 M34 18 L18 34"
          style={{
            strokeDasharray: 24,
            strokeDashoffset: 24,
            animation: 'draw-x 0.3s ease-in-out 0.4s forwards',
          }}
        />
      </svg>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx>{`
        @keyframes draw-circle {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes draw-x {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}

// Add shake animation to tailwind config or use this CSS
// @keyframes shake {
//   0%, 100% { transform: translateX(0); }
//   10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
//   20%, 40%, 60%, 80% { transform: translateX(4px); }
// }
