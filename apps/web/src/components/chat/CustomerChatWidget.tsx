'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// API Response Schemas (TS-3: Type JSON responses with Zod validation)
// ============================================================================

/** Health check response schema */
const HealthResponseSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  message: z.string().optional(),
  businessName: z.string().optional(),
});

/** Chat session response schema */
const SessionResponseSchema = z.object({
  sessionId: z.string(),
  greeting: z.string(),
  businessName: z.string().nullable().optional(),
  messageCount: z.number().optional(),
});

/** Booking proposal preview schema */
const ProposalPreviewSchema = z.object({
  service: z.string().optional(),
  date: z.string().optional(),
  price: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
});

/** Booking proposal schema */
const ProposalSchema = z.object({
  proposalId: z.string(),
  operation: z.string(),
  preview: ProposalPreviewSchema,
  trustTier: z.string(),
  requiresApproval: z.boolean(),
});

/** Chat message response schema */
const MessageResponseSchema = z.object({
  message: z.string(),
  sessionId: z.string(),
  proposals: z.array(ProposalSchema).optional(),
  toolResults: z.array(z.unknown()).optional(),
  // Legacy single proposal support
  proposal: ProposalSchema.optional(),
});

/** Booking confirmation response schema */
const ConfirmResponseSchema = z.object({
  id: z.string().optional(),
  status: z.string().optional(),
  result: z
    .object({
      message: z.string().optional(),
      bookingId: z.string().optional(),
    })
    .optional(),
  error: z.string().optional(),
});
import {
  Send,
  Loader2,
  CheckCircle,
  MessageCircle,
  X,
  User,
  Bot,
  AlertTriangle,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Chat message in history
 */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  proposal?: BookingProposal;
}

/**
 * Booking proposal requiring confirmation
 */
interface BookingProposal {
  proposalId: string;
  operation: string;
  preview: {
    service?: string;
    date?: string;
    price?: string;
    customerName?: string;
    customerEmail?: string;
  };
  trustTier: string;
  requiresApproval: boolean;
}

/**
 * Props for CustomerChatWidget
 */
interface CustomerChatWidgetProps {
  /** Tenant public API key */
  tenantApiKey: string;
  /** Business name for display */
  businessName: string;
  /** Primary brand color (hex) */
  primaryColor?: string;
  /** Callback when booking is confirmed */
  onBookingConfirmed?: (bookingId: string) => void;
}

/**
 * CustomerChatWidget - Public-facing chatbot for tenant storefronts
 *
 * Features:
 * - Floating chat bubble that opens into full widget
 * - Browse services, check availability, book appointments
 * - Booking confirmation UI
 * - Auto-detects tenant from API key
 */
export function CustomerChatWidget({
  tenantApiKey,
  businessName,
  primaryColor = '#8B9E86', // Default HANDLED sage
  onBookingConfirmed,
}: CustomerChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<BookingProposal | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Build fetch options with tenant API key
  const fetchOptions = useCallback(
    (method: 'GET' | 'POST' = 'GET', body?: object): RequestInit => ({
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Key': tenantApiKey,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    [tenantApiKey]
  );

  // Initialize chat session when widget opens
  const initializeChat = useCallback(async () => {
    if (sessionId || isInitializing) return;

    setIsInitializing(true);
    setError(null);

    try {
      // Check if chat is available
      const healthResponse = await fetch(`${API_URL}/v1/public/chat/health`, fetchOptions('GET'));

      if (!healthResponse.ok) {
        throw new Error('Chat is temporarily unavailable');
      }

      const healthData = await healthResponse.json();
      const health = HealthResponseSchema.parse(healthData);

      if (!health.available) {
        setError(health.message || 'Chat is not available');
        return;
      }

      // Create session
      const sessionResponse = await fetch(
        `${API_URL}/v1/public/chat/session`,
        fetchOptions('POST')
      );

      if (!sessionResponse.ok) {
        throw new Error('Failed to start chat session');
      }

      const sessionData = await sessionResponse.json();
      const data = SessionResponseSchema.parse(sessionData);
      setSessionId(data.sessionId);

      // Add greeting as first message
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.greeting,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start chat');
    } finally {
      setIsInitializing(false);
    }
  }, [sessionId, isInitializing, fetchOptions]);

  // Open widget and initialize
  const openWidget = useCallback(() => {
    setIsOpen(true);
    if (!sessionId) {
      initializeChat();
    }
  }, [sessionId, initializeChat]);

  // Send message to chatbot
  const sendMessage = async () => {
    const message = inputValue.trim();
    if (!message || isLoading || !sessionId) return;

    setInputValue('');
    setError(null);
    setIsLoading(true);

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch(
        `${API_URL}/v1/public/chat/message`,
        fetchOptions('POST', { message, sessionId })
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to send message');
      }

      const responseData = await response.json();
      const data = MessageResponseSchema.parse(responseData);

      // Get proposal from either proposals array or legacy single proposal
      const proposal = data.proposals?.[0] ?? data.proposal;

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        proposal,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Track pending proposal
      if (proposal?.requiresApproval) {
        setPendingProposal(proposal);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Confirm booking proposal
  const confirmProposal = async () => {
    if (!pendingProposal || !sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      // SECURITY: Include sessionId for ownership verification (P2 fix from code review)
      const response = await fetch(
        `${API_URL}/v1/public/chat/confirm/${pendingProposal.proposalId}`,
        fetchOptions('POST', { sessionId })
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to confirm booking');
      }

      const responseData = await response.json();
      const result = ConfirmResponseSchema.parse(responseData);

      // Add confirmation message
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.result?.message || 'Your booking has been confirmed!',
          timestamp: new Date(),
        },
      ]);

      setPendingProposal(null);
      if (result.result?.bookingId) {
        onBookingConfirmed?.(result.result.bookingId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm booking');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Floating bubble (closed state)
  if (!isOpen) {
    return (
      <button
        onClick={openWidget}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'w-14 h-14 rounded-full shadow-lg',
          'flex items-center justify-center',
          'transition-all duration-300 hover:scale-110 hover:shadow-xl',
          'focus:outline-none focus:ring-4 focus:ring-offset-2'
        )}
        style={{
          backgroundColor: primaryColor,
          color: 'white',
        }}
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  // Full widget (open state)
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'w-[380px] max-w-[calc(100vw-48px)]',
        // Use dvh with vh fallback for mobile viewport handling
        'h-[min(600px,calc(100dvh-120px))] max-h-[calc(100vh-120px)]',
        // Support fallback for browsers without dvh
        'supports-[height:100dvh]:max-h-[calc(100dvh-120px)]',
        'bg-white rounded-3xl shadow-2xl border border-neutral-100',
        'flex flex-col overflow-hidden',
        'animate-in slide-in-from-bottom-4 duration-300'
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b border-neutral-100"
        style={{ backgroundColor: `${primaryColor}10` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <Bot className="w-5 h-5" style={{ color: primaryColor }} />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900">{businessName}</h3>
            <p className="text-xs text-neutral-500">Booking Assistant</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-2 rounded-full hover:bg-neutral-100 transition-colors"
          aria-label="Close chat"
        >
          <X className="w-5 h-5 text-neutral-500" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-neutral-50/50">
        {isInitializing ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            <p className="text-sm text-neutral-500 mt-3">Starting chat...</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} primaryColor={primaryColor} />
            ))}

            {/* Typing indicator */}
            {isLoading && !pendingProposal && (
              <div className="flex gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Bot className="w-4 h-4" style={{ color: primaryColor }} />
                </div>
                <div className="bg-white border border-neutral-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: primaryColor, opacity: 0.5, animationDelay: '0ms' }}
                    />
                    <div
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{
                        backgroundColor: primaryColor,
                        opacity: 0.5,
                        animationDelay: '150ms',
                      }}
                    />
                    <div
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{
                        backgroundColor: primaryColor,
                        opacity: 0.5,
                        animationDelay: '300ms',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Booking Confirmation Card */}
      {pendingProposal && (
        <div className="px-5 py-4 bg-amber-50 border-t border-amber-200">
          <p className="font-medium text-amber-900 mb-2">Confirm your booking</p>
          <div className="text-sm text-amber-800 space-y-1 mb-3">
            {pendingProposal.preview.service && (
              <p>
                <span className="font-medium">Service:</span> {pendingProposal.preview.service}
              </p>
            )}
            {pendingProposal.preview.date && (
              <p>
                <span className="font-medium">Date:</span> {pendingProposal.preview.date}
              </p>
            )}
            {pendingProposal.preview.price && (
              <p>
                <span className="font-medium">Price:</span> {pendingProposal.preview.price}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={confirmProposal}
              disabled={isLoading}
              className="flex-1 rounded-full"
              style={{ backgroundColor: primaryColor }}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirm Booking
            </Button>
            <Button
              onClick={() => setPendingProposal(null)}
              variant="outline"
              className="rounded-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      {!pendingProposal && (
        <div className="px-5 py-4 border-t border-neutral-100 bg-white">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about services or booking..."
              className={cn(
                'flex-1 resize-none rounded-2xl border border-neutral-200 px-4 py-3',
                'focus:outline-none focus:border-neutral-400 focus:ring-2',
                'placeholder:text-neutral-400 text-neutral-900 bg-white',
                'min-h-[48px] max-h-[100px] text-sm'
              )}
              style={{ '--tw-ring-color': `${primaryColor}30` } as React.CSSProperties}
              rows={1}
              disabled={isLoading || !sessionId}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading || !sessionId}
              className="h-12 w-12 shrink-0 rounded-full"
              style={{ backgroundColor: primaryColor }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual message bubble
 * Memoized to prevent unnecessary re-renders when other messages change
 */
const MessageBubble = React.memo(function MessageBubble({
  message,
  primaryColor,
}: {
  message: ChatMessage;
  primaryColor: string;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn('shrink-0 w-8 h-8 rounded-full flex items-center justify-center')}
        style={{
          backgroundColor: isUser ? '#e5e7eb' : `${primaryColor}15`,
        }}
      >
        {isUser ? (
          <User className="w-4 h-4 text-neutral-500" />
        ) : (
          <Bot className="w-4 h-4" style={{ color: primaryColor }} />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 max-w-[80%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 shadow-sm',
            isUser
              ? 'rounded-br-sm text-white'
              : 'bg-white text-neutral-900 border border-neutral-100 rounded-bl-sm'
          )}
          style={isUser ? { backgroundColor: primaryColor } : undefined}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        </div>
        <span className="text-xs text-neutral-400 mt-1 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
});

export default CustomerChatWidget;
