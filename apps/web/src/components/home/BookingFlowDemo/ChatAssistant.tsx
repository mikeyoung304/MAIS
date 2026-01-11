'use client';

import { Bot, User, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Stage, ChatMessage } from './types';

/**
 * Stage-specific chat conversations
 *
 * Each stage shows a contextual conversation that demonstrates
 * how the AI assistant helps throughout the booking journey.
 */
const CHAT_MESSAGES: Record<Stage, ChatMessage[]> = {
  storefront: [
    {
      id: 's1',
      role: 'assistant',
      content: 'Hi! I can help you choose a package. What are you looking for?',
    },
    { id: 's2', role: 'user', content: 'What do you recommend for a first session?' },
    {
      id: 's3',
      role: 'assistant',
      content:
        'Essential is our most popular — 4 sessions with priority booking. Perfect for getting started!',
    },
  ],
  calendar: [
    { id: 'c1', role: 'assistant', content: 'Great choice! When works best for you?' },
    { id: 'c2', role: 'user', content: 'Do you have Thursday afternoon?' },
    {
      id: 'c3',
      role: 'assistant',
      content: 'Yes! Thursday at 2pm is open. Want me to reserve it?',
    },
  ],
  checkout: [
    { id: 'p1', role: 'assistant', content: 'Almost there! Just enter your details to confirm.' },
    {
      id: 'p2',
      role: 'assistant',
      content: 'Payment is secure with Stripe. You can cancel anytime up to 24 hours before.',
    },
  ],
  confirmation: [
    {
      id: 'f1',
      role: 'assistant',
      content: 'This is your Session Space — everything for this booking lives here.',
    },
    { id: 'f2', role: 'user', content: 'Can I bring my dog to the shoot?' },
    {
      id: 'f3',
      role: 'assistant',
      content:
        "Absolutely! I've noted that for the session. Based on your last booking, you loved outdoor shots — want me to suggest pet-friendly locations?",
    },
  ],
};

interface ChatAssistantProps {
  stage: Stage;
}

/**
 * ChatAssistant - The AI chat panel that appears on the right
 *
 * Shows contextual messages based on the current stage of the
 * booking flow. Messages animate in with a stagger effect.
 */
export function ChatAssistant({ stage }: ChatAssistantProps) {
  const messages = CHAT_MESSAGES[stage];

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Chat header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-neutral-800 bg-sage/5">
        <div className="w-7 h-7 rounded-full bg-sage/20 flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 text-sage" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary truncate">Booking Assistant</p>
          <p className="text-[10px] text-sage">Always here to help</p>
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden px-2.5 py-3 space-y-2.5">
        {messages.map((message, index) => (
          <ChatBubble key={message.id} message={message} delay={index * 150} />
        ))}
      </div>

      {/* Input area (decorative) */}
      <div className="px-2.5 py-2 border-t border-neutral-800">
        <div className="flex gap-1.5">
          <div className="flex-1 rounded-full border border-neutral-700 px-3 py-1.5 text-[10px] text-neutral-500 bg-neutral-800/50">
            Ask a question...
          </div>
          <button
            className="w-7 h-7 rounded-full bg-sage flex items-center justify-center"
            aria-label="Send message"
          >
            <Send className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ChatBubbleProps {
  message: ChatMessage;
  delay: number;
}

function ChatBubble({ message, delay }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn('flex gap-1.5 animate-fade-in-up', isUser && 'flex-row-reverse')}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Avatar */}
      <div
        className={cn(
          'shrink-0 w-5 h-5 rounded-full flex items-center justify-center',
          isUser ? 'bg-neutral-700' : 'bg-sage/15'
        )}
      >
        {isUser ? (
          <User className="w-2.5 h-2.5 text-neutral-400" />
        ) : (
          <Bot className="w-2.5 h-2.5 text-sage" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed',
          isUser
            ? 'bg-sage text-white rounded-br-sm'
            : 'bg-neutral-800 text-text-primary border border-neutral-700 rounded-bl-sm'
        )}
      >
        <p className="whitespace-pre-line">{message.content}</p>
      </div>
    </div>
  );
}
