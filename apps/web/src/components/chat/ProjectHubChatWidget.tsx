'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Send, Loader2, MessageCircle, X, User, Bot, AlertTriangle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================================================
// API Response Schemas
// ============================================================================

/** Chat session response schema */
const SessionResponseSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  customerId: z.string().optional(),
  greeting: z.string(),
  businessName: z.string().optional(),
});

/** Chat message response schema */
const MessageResponseSchema = z.object({
  message: z.string(),
  sessionId: z.string(),
  proposals: z.array(z.unknown()).optional(),
});

// ============================================================================
// Types
// ============================================================================

/**
 * Chat message in history
 */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Props for ProjectHubChatWidget
 */
interface ProjectHubChatWidgetProps {
  /** Project ID for context */
  projectId: string;
  /** Tenant public API key */
  tenantApiKey: string;
  /** Business name for display */
  businessName: string;
  /** Customer name for personalization */
  customerName?: string;
  /** Primary brand color (hex) */
  primaryColor?: string;
  /** Whether to show as inline chat (vs floating) */
  inline?: boolean;
}

// ============================================================================
// Shared Sub-Components (Extracted to eliminate duplication)
// ============================================================================

/**
 * Chat header with business name and optional close button
 */
interface ChatHeaderProps {
  businessName: string;
  primaryColor: string;
  onClose?: () => void;
  showClose?: boolean;
}

const ChatHeader = React.memo(function ChatHeader({
  businessName,
  primaryColor,
  onClose,
  showClose = false,
}: ChatHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center px-5 py-4 border-b border-neutral-100',
        showClose ? 'justify-between' : 'gap-3'
      )}
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
          <p className="text-xs text-neutral-500">Project Assistant</p>
        </div>
      </div>
      {showClose && onClose && (
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-neutral-100 transition-colors"
          aria-label="Close chat"
        >
          <X className="w-5 h-5 text-neutral-500" />
        </button>
      )}
    </div>
  );
});

/**
 * Typing indicator with animated dots
 */
interface TypingIndicatorProps {
  primaryColor: string;
}

const TypingIndicator = React.memo(function TypingIndicator({
  primaryColor,
}: TypingIndicatorProps) {
  return (
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
            style={{ backgroundColor: primaryColor, opacity: 0.5 }}
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
  );
});

/**
 * Error display component
 */
interface ErrorDisplayProps {
  error: string;
}

const ErrorDisplay = React.memo(function ErrorDisplay({ error }: ErrorDisplayProps) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="text-sm">{error}</span>
    </div>
  );
});

/**
 * Loading state for initializing chat
 */
const LoadingState = React.memo(function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      <p className="text-sm text-neutral-500 mt-3">Starting chat...</p>
    </div>
  );
});

/**
 * Chat messages container with typing indicator and error display
 */
interface ChatMessagesProps {
  messages: ChatMessage[];
  primaryColor: string;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

const ChatMessages = React.memo(function ChatMessages({
  messages,
  primaryColor,
  isLoading,
  isInitializing,
  error,
  messagesEndRef,
}: ChatMessagesProps) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-neutral-50/50">
      {isInitializing ? (
        <LoadingState />
      ) : (
        <>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} primaryColor={primaryColor} />
          ))}

          {isLoading && <TypingIndicator primaryColor={primaryColor} />}

          {error && <ErrorDisplay error={error} />}

          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
});

/**
 * Chat input with textarea and send button
 */
interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
  sessionId: string | null;
  primaryColor: string;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

const ChatInput = React.memo(function ChatInput({
  inputValue,
  onInputChange,
  onSend,
  onKeyDown,
  isLoading,
  sessionId,
  primaryColor,
  inputRef,
}: ChatInputProps) {
  return (
    <div className="px-5 py-4 border-t border-neutral-100 bg-white">
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about your booking..."
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
          onClick={onSend}
          disabled={!inputValue.trim() || isLoading || !sessionId}
          className="h-12 w-12 shrink-0 rounded-full"
          style={{ backgroundColor: primaryColor }}
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </Button>
      </div>
    </div>
  );
});

/**
 * ProjectHubChatWidget - Chat widget for Project Hub agent interactions
 *
 * Features:
 * - Floating chat bubble or inline chat
 * - Project context-aware messaging
 * - Reschedule, add-on, and question handling
 * - Activity timeline integration
 */
export function ProjectHubChatWidget({
  projectId,
  tenantApiKey,
  businessName,
  // customerName reserved for future personalization features
  primaryColor = '#8B9E86', // Default HANDLED sage
  inline = false,
}: ProjectHubChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(inline);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

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
      // Create session with project context
      const sessionResponse = await fetch(
        `${API_URL}/v1/public/projects/${projectId}/chat/session`,
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
  }, [projectId, sessionId, isInitializing, fetchOptions]);

  // Open widget and initialize
  const openWidget = useCallback(() => {
    setIsOpen(true);
    if (!sessionId) {
      initializeChat();
    }
  }, [sessionId, initializeChat]);

  // Auto-initialize for inline mode
  useEffect(() => {
    if (inline && !sessionId && !isInitializing) {
      initializeChat();
    }
  }, [inline, sessionId, isInitializing, initializeChat]);

  // Send message to Project Hub agent
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
        `${API_URL}/v1/public/projects/${projectId}/chat/message`,
        fetchOptions('POST', { message, sessionId })
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to send message');
      }

      const responseData = await response.json();
      const data = MessageResponseSchema.parse(responseData);

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Shared props for chat sub-components
  const chatMessagesProps = {
    messages,
    primaryColor,
    isLoading,
    isInitializing,
    error,
    messagesEndRef,
  };

  const chatInputProps = {
    inputValue,
    onInputChange: setInputValue,
    onSend: sendMessage,
    onKeyDown: handleKeyDown,
    isLoading,
    sessionId,
    primaryColor,
    inputRef,
  };

  // Inline chat layout
  if (inline) {
    return (
      <div
        className={cn(
          'w-full h-[500px] bg-white rounded-2xl shadow-lg border border-neutral-100',
          'flex flex-col overflow-hidden'
        )}
      >
        <ChatHeader businessName={businessName} primaryColor={primaryColor} />
        <ChatMessages {...chatMessagesProps} />
        <ChatInput {...chatInputProps} />
      </div>
    );
  }

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
        'h-[min(600px,calc(100dvh-120px))] max-h-[calc(100vh-120px)]',
        'supports-[height:100dvh]:max-h-[calc(100dvh-120px)]',
        'bg-white rounded-3xl shadow-2xl border border-neutral-100',
        'flex flex-col overflow-hidden',
        'animate-in slide-in-from-bottom-4 duration-300'
      )}
    >
      <ChatHeader
        businessName={businessName}
        primaryColor={primaryColor}
        onClose={() => setIsOpen(false)}
        showClose
      />
      <ChatMessages {...chatMessagesProps} />
      <ChatInput {...chatInputProps} />
    </div>
  );
}

/**
 * Individual message bubble
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

export default ProjectHubChatWidget;
