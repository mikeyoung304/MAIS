'use client';

import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * Error messages in HANDLED brand voice
 * Cheeky, self-aware, but helpful
 */
const errorMessages: Record<string, { title: string; description: string }> = {
  missing_api_key: {
    title: 'Brain not plugged in yet',
    description:
      'The AI assistant is being set up. In the meantime, you can manage everything from your dashboard.',
  },
  context_unavailable: {
    title: 'Having trouble loading your details',
    description:
      'Something went sideways trying to load your business info. Try refreshing, or the humans can help.',
  },
  not_authenticated: {
    title: "We haven't met yet",
    description: 'I need you to log in so I can load your business info. Try signing in again.',
  },
  rate_limited: {
    title: 'Whoa, slow down',
    description: 'I can only think so fast. Give me a sec and try again.',
  },
  generic: {
    title: 'Something went sideways',
    description: 'The humans have been notified. Try refreshing.',
  },
};

interface ChatbotUnavailableProps {
  /** The reason code from the health check */
  reason: string | null;
  /** Optional retry callback */
  onRetry?: () => void;
}

/**
 * ChatbotUnavailable - Graceful degradation when chatbot can't load
 *
 * Shows HANDLED-voice error messages instead of generic "failed to initialize"
 * Styled to match HANDLED brand: warm, minimal, professional
 */
export function ChatbotUnavailable({ reason, onRetry }: ChatbotUnavailableProps) {
  const errorInfo = errorMessages[reason || 'generic'] || errorMessages.generic;

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-surface">
      <div className="w-14 h-14 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
        <Bot className="w-7 h-7 text-sage" />
      </div>

      <h2 className="font-serif text-xl sm:text-2xl font-semibold text-text-primary mb-3">
        {errorInfo.title}
      </h2>

      <p className="text-text-muted max-w-sm leading-relaxed mb-8 text-sm sm:text-base">
        {errorInfo.description}
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="rounded-full px-6 hover:bg-neutral-50 transition-all duration-300"
          >
            Try Again
          </Button>
        )}
        <Button
          asChild
          variant="sage"
          className="rounded-full px-6 shadow-md hover:shadow-lg transition-all duration-300"
        >
          <Link href="/tenant/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export default ChatbotUnavailable;
