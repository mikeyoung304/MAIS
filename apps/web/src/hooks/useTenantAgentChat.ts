/**
 * useTenantAgentChat - Chat logic for the Tenant Agent (Cloud Run)
 *
 * This hook connects to the unified tenant-agent that handles all tenant-facing operations:
 * - Storefront editing and content management
 * - Marketing content generation (headlines, copy, taglines)
 * - Project management and client communication
 *
 * IMPORTANT: The agent speaks first based on session state (forbiddenSlots).
 * Do NOT pass a hardcoded greeting - let the agent's system prompt determine the opener.
 *
 * See SERVICE_REGISTRY.md for current agent architecture.
 * See docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md for context injection.
 *
 * @example
 * ```tsx
 * const {
 *   messages,
 *   isLoading,
 *   sendMessage,
 *   toolCalls,
 * } = useTenantAgentChat();
 * ```
 */

import { useState, useRef, useEffect, useCallback } from 'react';

// API proxy URL - proxies to /v1/tenant-admin/agent/tenant/*
const API_URL = '/api/tenant-admin/agent/tenant';

// LocalStorage keys for persisting session state
const SESSION_KEY = 'handled:tenant-agent:sessionId';
const VERSION_KEY = 'handled:tenant-agent:version';

/**
 * Message in the chat history
 */
export interface TenantAgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Tool calls made by the agent (e.g., delegate_to_marketing) */
  toolCalls?: TenantAgentToolCall[];
}

/**
 * Tool call from the tenant-agent (storefront/marketing actions)
 */
export interface TenantAgentToolCall {
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
 * Configuration options for useTenantAgentChat
 */
export interface UseTenantAgentChatOptions {
  /** Callback when session starts */
  onSessionStart?: (sessionId: string) => void;
  /** Callback when a tool completes */
  onToolComplete?: (toolCalls: TenantAgentToolCall[]) => void;
  /** Callback when dashboard actions are received (navigation, scroll, preview) */
  onDashboardActions?: (actions: DashboardAction[]) => void;
  /** Callback when user sends first message */
  onFirstMessage?: () => void;
}

/**
 * Return type for useTenantAgentChat hook
 */
export interface UseTenantAgentChatReturn {
  // State
  messages: TenantAgentMessage[];
  inputValue: string;
  isLoading: boolean;
  sessionId: string | null;
  error: string | null;
  lastToolCalls: TenantAgentToolCall[];

  // Health state
  isInitializing: boolean;
  isAvailable: boolean;

  // Actions
  sendMessage: () => Promise<void>;
  sendProgrammaticMessage: (message: string) => Promise<void>;
  setInputValue: (value: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<TenantAgentMessage[]>>;
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
 * Read session state from localStorage
 */
function getStoredSession(): { sessionId: string | null; version: number | null } {
  try {
    const sessionId = localStorage.getItem(SESSION_KEY);
    const storedVersion = localStorage.getItem(VERSION_KEY);
    const version = storedVersion ? parseInt(storedVersion, 10) : null;
    return { sessionId, version };
  } catch {
    // localStorage unavailable (private browsing) - continue without persistence
    return { sessionId: null, version: null };
  }
}

/**
 * useTenantAgentChat - Core chat logic for Tenant Agent (Cloud Run)
 *
 * Handles:
 * - Session initialization with tenant-agent backend
 * - Agent speaks first: fetches initial message based on session state
 * - Message sending with optimistic UI updates
 * - Tool call tracking for storefront and marketing actions
 * - Dashboard action processing (navigation, preview, guided refinement)
 * - Auto-scroll on new messages
 */
export function useTenantAgentChat({
  onSessionStart,
  onToolComplete,
  onDashboardActions,
  onFirstMessage,
}: UseTenantAgentChatOptions = {}): UseTenantAgentChatReturn {
  // Core state
  const [messages, setMessages] = useState<TenantAgentMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(0); // Optimistic locking version (Pitfall #69)
  const [error, setError] = useState<string | null>(null);
  const [lastToolCalls, setLastToolCalls] = useState<TenantAgentToolCall[]>([]);

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
   * Fetch the agent's first message by sending a "hello" to the chat endpoint.
   * This lets the agent speak first based on session state (forbiddenSlots).
   */
  const fetchAgentGreeting = useCallback(
    async (newSessionId: string, currentVersion: number) => {
      try {
        const response = await fetch(`${API_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'hello',
            sessionId: newSessionId,
            version: currentVersion,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get agent greeting');
        }

        const data = await response.json();

        // Update version from response
        if (data.version !== undefined) {
          setVersion(data.version);
          try {
            localStorage.setItem(VERSION_KEY, String(data.version));
          } catch {
            // Ignore localStorage errors
          }
        }

        // Set the agent's actual first message
        setMessages([
          {
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
            toolCalls: data.toolCalls?.length > 0 ? data.toolCalls : undefined,
          },
        ]);

        // Process any dashboard actions from the greeting
        const dashboardActions: DashboardAction[] = data.dashboardActions || [];
        if (dashboardActions.length > 0) {
          onDashboardActions?.(dashboardActions);
        }
      } catch (err) {
        // If we can't get the agent greeting, show a fallback
        setMessages([
          {
            role: 'assistant',
            content: "Hey, I'm your AI assistant. What can I help you with today?",
            timestamp: new Date(),
          },
        ]);
        console.error('Failed to fetch agent greeting:', err);
      }
    },
    [onDashboardActions]
  );

  /**
   * Initialize session with the tenant-agent
   * Restores existing session from localStorage if available, otherwise creates new one
   * After session creation/restoration, fetches agent's first message
   */
  const initializeSession = useCallback(async () => {
    setIsInitializing(true);
    setError(null);

    try {
      // Check localStorage for existing session
      const { sessionId: existingSessionId, version: existingVersion } = getStoredSession();

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
              const restoredMessages: TenantAgentMessage[] = historyData.messages.map(
                (msg: { role: 'user' | 'assistant'; content: string; timestamp?: string }) => ({
                  role: msg.role,
                  content: msg.content,
                  timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                })
              );
              setMessages(restoredMessages);
              setIsInitializing(false);
              return; // Successfully restored session with history
            }

            // Session exists but no messages - fetch agent's first message
            setIsInitializing(false);
            await fetchAgentGreeting(existingSessionId, restoredVersion);
            return;
          }
          // If history fetch failed, fall through to create new session
          // Clear invalid session from localStorage
          try {
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(VERSION_KEY);
          } catch {
            // Ignore localStorage errors
          }
        } catch {
          // Session validation failed, create new session
          try {
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(VERSION_KEY);
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
      const newVersion = data.version ?? 0;
      setVersion(newVersion);
      setIsAvailable(true);
      onSessionStart?.(data.sessionId);

      // Persist session state to localStorage
      try {
        localStorage.setItem(SESSION_KEY, data.sessionId);
        localStorage.setItem(VERSION_KEY, String(newVersion));
      } catch {
        // localStorage unavailable - continue without persistence
      }

      // AGENT SPEAKS FIRST: Fetch the agent's initial message based on session state
      // This replaces the hardcoded greeting - the agent's system prompt determines what to say
      setIsInitializing(false);
      await fetchAgentGreeting(data.sessionId, newVersion);
    } catch (err) {
      setIsAvailable(false);
      setError(err instanceof Error ? err.message : 'Failed to connect to assistant');
      setIsInitializing(false);
    }
  }, [onSessionStart, fetchAgentGreeting]);

  // Initialize on mount
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  /**
   * Core message sending logic shared by sendMessage and sendProgrammaticMessage.
   * Handles API call, optimistic updates, tool calls, and dashboard actions.
   */
  const sendMessageCore = useCallback(
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
      const userMessage: TenantAgentMessage = {
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
            localStorage.setItem(VERSION_KEY, String(data.version));
          } catch {
            // Ignore localStorage errors
          }
        }

        // Extract tool calls if present
        const toolCalls: TenantAgentToolCall[] = data.toolCalls || [];
        setLastToolCalls(toolCalls);

        // Extract dashboard actions (navigation, scroll, preview commands)
        const dashboardActions: DashboardAction[] = data.dashboardActions || [];

        // Add assistant message
        const assistantMessage: TenantAgentMessage = {
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

  /**
   * Send a message to the tenant-agent.
   * Reads from inputValue, clears the input, sends the message, then focuses the input.
   */
  const sendMessage = useCallback(async () => {
    const message = inputValue.trim();
    if (!message) return;
    setInputValue('');
    await sendMessageCore(message);
    inputRef.current?.focus();
  }, [inputValue, sendMessageCore]);

  /**
   * Send a message programmatically (for external components like SectionWidget).
   * This bypasses the input field and sends directly.
   */
  const sendProgrammaticMessage = sendMessageCore;

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
