/**
 * useConciergeChat - Chat logic for the Vertex AI Concierge agent
 *
 * This hook connects to the Concierge agent that orchestrates specialist agents:
 * - Marketing Agent (headlines, copy, taglines)
 * - Storefront Agent (layout, sections, branding)
 * - Research Agent (competitors, market analysis)
 *
 * Key differences from legacy useAgentChat:
 * - Uses /api/tenant-admin/agent/* endpoints (not /api/agent/*)
 * - Concierge returns tool calls with specialist delegations
 * - Session management is explicit (POST /session first)
 * - Response format: { response, sessionId, toolCalls }
 *
 * @example
 * ```tsx
 * const {
 *   messages,
 *   isLoading,
 *   sendMessage,
 *   toolCalls,
 * } = useConciergeChat();
 * ```
 */

import { useState, useRef, useEffect, useCallback } from 'react';

// API proxy URL - proxies to /v1/tenant-admin/agent/*
const API_URL = '/api/tenant-admin/agent';

// LocalStorage key for persisting session ID
const SESSION_STORAGE_KEY = 'handled:concierge:sessionId';

/**
 * Message in the chat history
 */
export interface ConciergeMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Tool calls made by the agent (e.g., delegate_to_marketing) */
  toolCalls?: ConciergeToolCall[];
}

/**
 * Tool call from the Concierge (specialist delegation or direct action)
 */
export interface ConciergeToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

/**
 * Configuration options for useConciergeChat
 */
export interface UseConciergeChatchatOptions {
  /** Initial greeting message */
  initialGreeting?: string;
  /** Callback when session starts */
  onSessionStart?: (sessionId: string) => void;
  /** Callback when a tool completes */
  onToolComplete?: (toolCalls: ConciergeToolCall[]) => void;
  /** Callback when user sends first message */
  onFirstMessage?: () => void;
}

/**
 * Return type for useConciergeChat hook
 */
export interface UseConciergeChatchatReturn {
  // State
  messages: ConciergeMessage[];
  inputValue: string;
  isLoading: boolean;
  sessionId: string | null;
  error: string | null;
  lastToolCalls: ConciergeToolCall[];

  // Health state
  isInitializing: boolean;
  isAvailable: boolean;

  // Actions
  sendMessage: () => Promise<void>;
  setInputValue: (value: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<ConciergeMessage[]>>;
  initializeSession: () => Promise<void>;

  // Refs
  messagesEndRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLTextAreaElement>;

  // Event handlers
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  scrollToBottom: () => void;

  // Tracking
  hasSentFirstMessage: boolean;
}

/**
 * useConciergeChat - Core chat logic for Vertex AI Concierge agent
 *
 * Handles:
 * - Session initialization
 * - Message sending with optimistic UI updates
 * - Tool call tracking for specialist delegations
 * - Auto-scroll on new messages
 */
export function useConciergeChat({
  initialGreeting = "Hey there! I'm your AI assistant. I can help you write better headlines, update your storefront, or research your market. What would you like to work on?",
  onSessionStart,
  onToolComplete,
  onFirstMessage,
}: UseConciergeChatchatOptions = {}): UseConciergeChatchatReturn {
  // Core state
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastToolCalls, setLastToolCalls] = useState<ConciergeToolCall[]>([]);

  // Initialization state
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);

  // First message tracking
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const inputRef = useRef<HTMLTextAreaElement>(null) as React.RefObject<HTMLTextAreaElement>;

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /**
   * Initialize session with the Concierge
   * Restores existing session from localStorage if available, otherwise creates new one
   */
  const initializeSession = useCallback(async () => {
    setIsInitializing(true);
    setError(null);

    try {
      // Check localStorage for existing session
      let existingSessionId: string | null = null;
      try {
        existingSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
      } catch {
        // localStorage unavailable (private browsing) - continue without persistence
      }

      // If we have an existing session, try to restore it
      if (existingSessionId) {
        try {
          // Verify session exists and get messages
          const historyResponse = await fetch(`${API_URL}/session/${existingSessionId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            setSessionId(existingSessionId);
            setIsAvailable(true);
            onSessionStart?.(existingSessionId);

            // Restore messages from history
            if (historyData.messages && historyData.messages.length > 0) {
              const restoredMessages: ConciergeMessage[] = historyData.messages.map(
                (msg: { role: 'user' | 'assistant'; content: string; timestamp?: string }) => ({
                  role: msg.role,
                  content: msg.content,
                  timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                })
              );
              setMessages(restoredMessages);
              setIsInitializing(false);
              return; // Successfully restored session
            }
          }
          // If history fetch failed or no messages, fall through to create new session
          // Clear invalid session from localStorage
          try {
            localStorage.removeItem(SESSION_STORAGE_KEY);
          } catch {
            // Ignore localStorage errors
          }
        } catch {
          // Session validation failed, create new session
          try {
            localStorage.removeItem(SESSION_STORAGE_KEY);
          } catch {
            // Ignore localStorage errors
          }
        }
      }

      // Create a new session
      const response = await fetch(`${API_URL}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create session');
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setIsAvailable(true);
      onSessionStart?.(data.sessionId);

      // Persist session ID to localStorage
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, data.sessionId);
      } catch {
        // localStorage unavailable - continue without persistence
      }

      // Show initial greeting
      setMessages([
        {
          role: 'assistant',
          content: initialGreeting,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setIsAvailable(false);
      setError(err instanceof Error ? err.message : 'Failed to connect to assistant');
    } finally {
      setIsInitializing(false);
    }
  }, [initialGreeting, onSessionStart]);

  // Initialize on mount
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  /**
   * Send a message to the Concierge agent
   */
  const sendMessage = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || isLoading || !sessionId) return;

    // Track first message
    if (!hasSentFirstMessage) {
      setHasSentFirstMessage(true);
      onFirstMessage?.();
    }

    setInputValue('');
    setError(null);
    setIsLoading(true);

    // Add user message optimistically
    const userMessage: ConciergeMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();

      // Extract tool calls if present
      const toolCalls: ConciergeToolCall[] = data.toolCalls || [];
      setLastToolCalls(toolCalls);

      // Add assistant message
      const assistantMessage: ConciergeMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Notify about tool completion
      if (toolCalls.length > 0) {
        onToolComplete?.(toolCalls);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputValue, isLoading, sessionId, hasSentFirstMessage, onFirstMessage, onToolComplete]);

  // Handle textarea enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  return {
    // State
    messages,
    inputValue,
    isLoading,
    sessionId,
    error,
    lastToolCalls,

    // Health state
    isInitializing,
    isAvailable,

    // Actions
    sendMessage,
    setInputValue,
    setMessages,
    initializeSession,

    // Refs
    messagesEndRef,
    inputRef,

    // Event handlers
    handleKeyDown,
    scrollToBottom,

    // Tracking
    hasSentFirstMessage,
  };
}
