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

// LocalStorage keys for persisting session state
const SESSION_STORAGE_KEY = 'handled:concierge:sessionId';
const VERSION_STORAGE_KEY = 'handled:concierge:version';

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
 * Dashboard action from agent navigation tools
 * These control UI navigation, scrolling, and preview updates
 *
 * Guided Refinement actions (added in Phase 5.1):
 * - SHOW_VARIANT_WIDGET: Display tone variant selection widget
 * - SHOW_PUBLISH_READY: Show publish-ready state
 * - HIGHLIGHT_NEXT_SECTION: Highlight and scroll to next section
 */
export interface DashboardAction {
  type:
    | 'NAVIGATE'
    | 'SCROLL_TO_SECTION'
    | 'SHOW_PREVIEW'
    | 'REFRESH'
    | 'REFRESH_PREVIEW'
    // Guided Refinement actions
    | 'SHOW_VARIANT_WIDGET'
    | 'SHOW_PUBLISH_READY'
    | 'HIGHLIGHT_NEXT_SECTION';
  section?: string;
  blockType?: string;
  sectionId?: string; // Used by SCROLL_TO_SECTION and Guided Refinement
  highlight?: boolean;
  fullScreen?: boolean;
  // Guided Refinement: variant options for SHOW_VARIANT_WIDGET
  variants?: {
    professional: { headline?: string; body?: string; content?: string; subheadline?: string };
    premium: { headline?: string; body?: string; content?: string; subheadline?: string };
    friendly: { headline?: string; body?: string; content?: string; subheadline?: string };
  };
  // Guided Refinement: AI's recommendation
  recommendation?: 'professional' | 'premium' | 'friendly';
  rationale?: string;
  // Section type for display
  sectionType?: string;
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
  /** Callback when dashboard actions are received (navigation, scroll, preview) */
  onDashboardActions?: (actions: DashboardAction[]) => void;
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
  sendProgrammaticMessage: (message: string) => Promise<void>;
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
  onDashboardActions,
  onFirstMessage,
}: UseConciergeChatchatOptions = {}): UseConciergeChatchatReturn {
  // Core state
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(0); // Optimistic locking version (Pitfall #69)
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
      let existingVersion: number | null = null;
      try {
        existingSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
        const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
        existingVersion = storedVersion ? parseInt(storedVersion, 10) : null;
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
            // Get version from response or fall back to localStorage value
            const restoredVersion = historyData.session?.version ?? existingVersion ?? 0;
            setVersion(restoredVersion);
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
            localStorage.removeItem(VERSION_STORAGE_KEY);
          } catch {
            // Ignore localStorage errors
          }
        } catch {
          // Session validation failed, create new session
          try {
            localStorage.removeItem(SESSION_STORAGE_KEY);
            localStorage.removeItem(VERSION_STORAGE_KEY);
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
      // New sessions start at version 0
      setVersion(data.version ?? 0);
      setIsAvailable(true);
      onSessionStart?.(data.sessionId);

      // Persist session state to localStorage
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, data.sessionId);
        localStorage.setItem(VERSION_STORAGE_KEY, String(data.version ?? 0));
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
          version, // Required for optimistic locking (Pitfall #69)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();

      // Update version for optimistic locking (Pitfall #69)
      if (data.version !== undefined) {
        setVersion(data.version);
        try {
          localStorage.setItem(VERSION_STORAGE_KEY, String(data.version));
        } catch {
          // Ignore localStorage errors
        }
      }

      // Extract tool calls if present
      const toolCalls: ConciergeToolCall[] = data.toolCalls || [];
      setLastToolCalls(toolCalls);

      // Extract dashboard actions (navigation, scroll, preview commands)
      const dashboardActions: DashboardAction[] = data.dashboardActions || [];

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

      // Process dashboard actions (UI navigation commands from agent)
      if (dashboardActions.length > 0) {
        onDashboardActions?.(dashboardActions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [
    inputValue,
    isLoading,
    sessionId,
    version,
    hasSentFirstMessage,
    onFirstMessage,
    onToolComplete,
    onDashboardActions,
  ]);

  /**
   * Send a message programmatically (for external components like SectionWidget)
   * This bypasses the input field and sends directly.
   */
  const sendProgrammaticMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading || !sessionId) return;

      // Track first message
      if (!hasSentFirstMessage) {
        setHasSentFirstMessage(true);
        onFirstMessage?.();
      }

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
            version,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to send message');
        }

        const data = await response.json();

        // Update version for optimistic locking
        if (data.version !== undefined) {
          setVersion(data.version);
          try {
            localStorage.setItem(VERSION_STORAGE_KEY, String(data.version));
          } catch {
            // Ignore localStorage errors
          }
        }

        // Extract tool calls if present
        const toolCalls: ConciergeToolCall[] = data.toolCalls || [];
        setLastToolCalls(toolCalls);

        // Extract dashboard actions
        const dashboardActions: DashboardAction[] = data.dashboardActions || [];

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

        // Process dashboard actions
        if (dashboardActions.length > 0) {
          onDashboardActions?.(dashboardActions);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message');
      } finally {
        setIsLoading(false);
      }
    },
    [
      isLoading,
      sessionId,
      version,
      hasSentFirstMessage,
      onFirstMessage,
      onToolComplete,
      onDashboardActions,
    ]
  );

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
    sendProgrammaticMessage,
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
