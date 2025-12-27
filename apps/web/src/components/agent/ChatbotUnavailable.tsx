'use client';

import { Sparkles } from 'lucide-react';
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
      "The AI assistant is being set up. In the meantime, you can manage everything from your dashboard.",
  },
  context_unavailable: {
    title: 'Having trouble loading your details',
    description:
      "Something went sideways trying to load your business info. Try refreshing, or the humans can help.",
  },
  not_authenticated: {
    title: 'Who dis?',
    description:
      "I can't figure out who you are. Try logging in again.",
  },
  rate_limited: {
    title: 'Whoa, slow down',
    description:
      "I can only think so fast. Give me a sec and try again.",
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
 */
export function ChatbotUnavailable({ reason, onRetry }: ChatbotUnavailableProps) {
  const errorInfo = errorMessages[reason || 'generic'] || errorMessages.generic;

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
        <Sparkles className="w-8 h-8 text-sage" />
      </div>

      <h2 className="font-serif text-2xl font-bold text-text-primary mb-3">
        {errorInfo.title}
      </h2>

      <p className="text-text-muted max-w-md leading-relaxed mb-6">
        {errorInfo.description}
      </p>

      <div className="flex gap-3">
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="rounded-full"
          >
            Try Again
          </Button>
        )}
        <Button asChild variant="sage" className="rounded-full">
          <Link href="/tenant/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export default ChatbotUnavailable;
