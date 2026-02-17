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
 * Context type for the agent session
 */
type AgentContextType = 'customer' | 'tenant';

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
  /** Context type for display purposes (customer or tenant/provider) */
  contextType?: AgentContextType;
  /** Whether to show the context indicator badge */
  showContextIndicator?: boolean;
  /** JWT access token for authentication (required for public routes) */
  accessToken?: string;
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
  contextType?: AgentContextType;
  showContextIndicator?: boolean;
}

/**
 * Context indicator configuration
 */
const CONTEXT_CONFIG: Record<
  AgentContextType,
  { label: string; bgColor: string; textColor: string; icon: string }
> = {
  customer: {
    label: 'Customer View',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    icon: '👤',
  },
  tenant: {
    label: 'Provider View',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    icon: '🏢',
  },
};

const ChatHeader = React.memo(function ChatHeader({
  businessName,
  primaryColor,
  onClose,
  showClose = false,
  contextType,
  showContextIndicator = false,
}: ChatHeaderProps) {
  const contextConfig = contextType ? CONTEXT_CONFIG[contextType] : null;

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
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-neutral-900">{businessName}</h3>
            {/* Context visibility indicator - Phase 2 enhancement */}
            {showContextIndicator && contextConfig && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                  contextConfig.bgColor,
                  contextConfig.textColor
                )}
                title={`You are interacting as a ${contextType}`}
              >
                <span className="text-[8px]">{contextConfig.icon}</span>
                {contextConfig.label}
              </span>
            )}
          </div>
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
 * Error types returned from the backend
 */
type ErrorType = 'agent_unavailable' | 'agent_timeout' | 'session_expired' | 'agent_error' | string;

/**
 * Error display component with retry support
 */
interface ErrorDisplayProps {
  error: string;
  errorType?: ErrorType;
  onRetry?: () => void;
  onRefresh?: () => void;
}

const ErrorDisplay = React.memo(function ErrorDisplay({
  error,
  errorType,
  onRetry,
  onRefresh,
}: ErrorDisplayProps) {
  // User-friendly messages based on error type
  const getMessage = () => {
    switch (errorType) {
      case 'agent_unavailable':
        return 'The chat service is temporarily unavailable. Please try again in a moment.';
      case 'agent_timeout':
        return 'The request took too long. Please try again.';
      case 'session_expired':
        return 'Your chat session has expired. Please refresh to continue.';
      case 'agent_error':
        return 'Something went wrong. Please try again.';
      default:
        return error;
    }
  };

  const canRetry = errorType === 'agent_timeout' || errorType === 'agent_error';
  const needsRefresh = errorType === 'session_expired';

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
      <div className="flex items-center gap-2 text-red-700">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="text-sm">{getMessage()}</span>
      </div>
      {(canRetry || needsRefresh) && (
        <div className="flex gap-2 mt-1">
          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
            >
              Try Again
            </button>
          )}
          {needsRefresh && onRefresh && (
            <button
              onClick={onRefresh}
              className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
            >
              Refresh Chat
            </button>
          )}
        </div>
      )}
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
  errorType?: ErrorType;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onRetry?: () => void;
  onRefresh?: () => void;
}

const ChatMessages = React.memo(function ChatMessages({
  messages,
  primaryColor,
  isLoading,
  isInitializing,
  error,
  errorType,
  messagesEndRef,
  onRetry,
  onRefresh,
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

          {error && (
            <ErrorDisplay
              error={error}
              errorType={errorType}
              onRetry={onRetry}
              onRefresh={onRefresh}
            />
          )}

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
  primaryColor = '#5A7C65', // Default deep sage (WCAG AA with white)
  inline = false,
  contextType = 'customer', // Default to customer context
  showContextIndicator = false, // Off by default, enable for debugging/testing
  accessToken, // JWT access token for public route authentication
}: ProjectHubChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(inline);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | undefined>(undefined);
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null); // For retry functionality

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
      // Token is required for authentication on public routes
      const sessionResponse = await fetch(
        `${API_URL}/v1/public/projects/${projectId}/chat/session`,
        fetchOptions('POST', { token: accessToken })
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
  }, [projectId, sessionId, isInitializing, fetchOptions, accessToken]);

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
  const sendMessage = async (messageOverride?: string) => {
    const message = messageOverride || inputValue.trim();
    if (!message || isLoading || !sessionId) return;

    setInputValue('');
    setError(null);
    setErrorType(undefined);
    setIsLoading(true);
    setLastMessage(message); // Store for retry

    // Add user message immediately (only if not a retry)
    if (!messageOverride) {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
    }

    try {
      const response = await fetch(
        `${API_URL}/v1/public/projects/${projectId}/chat/message`,
        fetchOptions('POST', { message, sessionId, token: accessToken })
      );

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string;
          errorType?: ErrorType;
          message?: string;
        };

        // Capture error type for UI handling
        setErrorType(errorData.errorType);

        // Handle session expiration specially
        if (response.status === 410 || errorData.errorType === 'session_expired') {
          setSessionId(null); // Reset session so refresh creates a new one
        }

        throw new Error(errorData.error || errorData.message || 'Failed to send message');
      }

      const responseData = await response.json();
      const data = MessageResponseSchema.parse(responseData);

      // Update session ID if it changed (happens on first message when session was created server-side)
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
      }

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLastMessage(null); // Clear on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Retry last failed message
  const retryLastMessage = useCallback(() => {
    if (lastMessage) {
      sendMessage(lastMessage);
    }
  }, [lastMessage]);

  // Refresh chat session (used after session expiration)
  const refreshChat = useCallback(() => {
    setSessionId(null);
    setError(null);
    setErrorType(undefined);
    setLastMessage(null);
    // Keep messages but re-initialize session
    initializeChat();
  }, [initializeChat]);

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
    errorType,
    messagesEndRef,
    onRetry: retryLastMessage,
    onRefresh: refreshChat,
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
        <ChatHeader
          businessName={businessName}
          primaryColor={primaryColor}
          contextType={contextType}
          showContextIndicator={showContextIndicator}
        />
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
        contextType={contextType}
        showContextIndicator={showContextIndicator}
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
