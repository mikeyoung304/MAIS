/**
 * useAgentChat - Shared chat logic for AI agent interfaces
 *
 * Extracts common state management and API communication from AgentChat and PanelAgentChat.
 * Components remain responsible for styling and layout.
 *
 * @example
 * ```tsx
 * const {
 *   messages,
 *   isLoading,
 *   sendMessage,
 *   confirmProposal,
 *   rejectProposal,
 *   inputProps,
 * } = useAgentChat({ apiUrl: '/api/agent' });
 * ```
 */

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Message in the chat history
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  proposals?: Proposal[];
  toolResults?: ToolResult[];
}

/**
 * Proposal requiring user confirmation
 */
export interface Proposal {
  proposalId: string;
  operation: string;
  preview: Record<string, unknown>;
  trustTier: string;
  requiresApproval: boolean;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Health check response from backend
 */
export interface HealthCheckResponse {
  available: boolean;
  reason: string | null;
  message?: string; // Used by PanelAgentChat
  onboardingState?: 'needs_stripe' | 'needs_packages' | 'needs_bookings' | 'ready';
  capabilities?: string[];
}

/**
 * Session context from backend (AgentChat-specific)
 */
export interface SessionContext {
  businessName: string;
  businessSlug: string;
  quickStats: {
    stripeConnected: boolean;
    packageCount: number;
    upcomingBookings: number;
    totalBookings: number;
    revenueThisMonth: number;
  };
}

/**
 * Configuration options for useAgentChat
 */
export interface UseAgentChatOptions {
  /** Base API URL for agent endpoints */
  apiUrl: string;
  /** Initial greeting override (will use API response if not provided) */
  initialGreeting?: string;
  /** Fallback greeting if API returns none */
  fallbackGreeting?: string;
  /** Callback when chat session starts */
  onSessionStart?: (sessionId: string) => void;
  /** Callback when a proposal is confirmed */
  onProposalConfirmed?: (proposalId: string, result: unknown) => void;
  /** Callback when user sends their first message */
  onFirstMessage?: () => void;
  /** Callback when a tool executes successfully */
  onToolComplete?: (toolResults: ToolResult[]) => void;
}

/**
 * Return type for useAgentChat hook
 */
export interface UseAgentChatReturn {
  // State
  messages: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  sessionId: string | null;
  context: SessionContext | null;
  error: string | null;
  pendingProposals: Proposal[];

  // Health check state
  isCheckingHealth: boolean;
  isAvailable: boolean | null;
  unavailableReason: string | null;

  // Actions
  sendMessage: () => Promise<void>;
  confirmProposal: (proposalId: string) => Promise<void>;
  rejectProposal: (proposalId: string) => Promise<void>;
  initializeChat: () => Promise<void>;
  setInputValue: (value: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;

  // Refs for component integration (cast to remove | null for React 18 JSX compatibility)
  messagesEndRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLTextAreaElement>;

  // Event handlers
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  scrollToBottom: () => void;

  // Tracking
  hasSentFirstMessage: boolean;
}

/**
 * useAgentChat - Core chat logic for AI agent interfaces
 *
 * Handles:
 * - Health check and session initialization
 * - Message sending with optimistic UI updates
 * - Proposal confirmation/rejection
 * - Auto-scroll on new messages
 * - Keyboard shortcuts (Enter to send)
 */
export function useAgentChat({
  apiUrl,
  initialGreeting,
  fallbackGreeting = 'Hello! How can I help you today?',
  onSessionStart,
  onProposalConfirmed,
  onFirstMessage,
  onToolComplete,
}: UseAgentChatOptions): UseAgentChatReturn {
  // Core state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingProposals, setPendingProposals] = useState<Proposal[]>([]);

  // Health check state
  const [isCheckingHealth, setIsCheckingHealth] = useState(true);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  // First message tracking
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState(false);

  // Refs (cast to remove | null for React 18 JSX compatibility)
  const messagesEndRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const inputRef = useRef<HTMLTextAreaElement>(null) as React.RefObject<HTMLTextAreaElement>;

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Health check and session initialization
  // P1-FIX (2026-01-10): Load history from backend instead of discarding it
  const initializeChat = useCallback(async () => {
    setIsCheckingHealth(true);
    setError(null);

    try {
      // Step 1: Pre-flight health check
      const healthResponse = await fetch(`${apiUrl}/health`);

      if (!healthResponse.ok) {
        // Network error - try to proceed anyway
        console.warn('Health check failed, attempting session init...');
      } else {
        const health: HealthCheckResponse = await healthResponse.json();

        if (!health.available) {
          setIsAvailable(false);
          setUnavailableReason(health.reason || health.message || null);
          setIsCheckingHealth(false);
          return;
        }
      }

      // Step 2: Initialize session
      const sessionResponse = await fetch(`${apiUrl}/session`);

      if (!sessionResponse.ok) {
        throw new Error('Failed to initialize chat session');
      }

      const data = await sessionResponse.json();
      setSessionId(data.sessionId);
      setContext(data.context || null);
      setIsAvailable(true);
      onSessionStart?.(data.sessionId);

      // P1-FIX: Load existing messages from history if session has them
      // This fixes the "context loss" bug where switching tabs discards history
      if (data.messageCount > 0) {
        try {
          // Fetch full message history
          const historyResponse = await fetch(`${apiUrl}/session/${data.sessionId}/history`);
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            if (historyData.messages && historyData.messages.length > 0) {
              // Load historical messages
              setMessages(
                historyData.messages.map(
                  (m: { role: string; content: string; timestamp?: string }) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                    timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
                  })
                )
              );
              return; // Don't show greeting - we have history
            }
          }
        } catch (historyErr) {
          // If history fetch fails, fall through to showing greeting
          console.warn('Failed to load chat history, showing greeting', historyErr);
        }
      }

      // New session or failed history fetch - show greeting
      const greeting = initialGreeting || data.greeting || fallbackGreeting;
      setMessages([
        {
          role: 'assistant',
          content: greeting,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setIsAvailable(false);
      setUnavailableReason('context_unavailable');
      setError(err instanceof Error ? err.message : 'Failed to start chat');
    } finally {
      setIsCheckingHealth(false);
    }
  }, [apiUrl, initialGreeting, fallbackGreeting, onSessionStart]);

  // Initialize on mount
  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  // Send a message to the agent
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

    // Add user message to chat (optimistic update)
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch(`${apiUrl}/chat`, {
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
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        proposals: data.proposals,
        toolResults: data.toolResults,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Track pending proposals that need confirmation (T3)
      if (data.proposals?.length) {
        const needsConfirmation = data.proposals.filter(
          (p: Proposal) => p.requiresApproval && p.trustTier === 'T3'
        );
        if (needsConfirmation.length) {
          setPendingProposals((prev) => [...prev, ...needsConfirmation]);
        }
      }

      // Notify parent if tools executed successfully
      if (data.toolResults?.some((r: ToolResult) => r.success)) {
        onToolComplete?.(data.toolResults);
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
    hasSentFirstMessage,
    apiUrl,
    onFirstMessage,
    onToolComplete,
  ]);

  // Handle proposal confirmation
  const confirmProposal = useCallback(
    async (proposalId: string) => {
      try {
        const response = await fetch(`${apiUrl}/proposals/${proposalId}/confirm`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to confirm proposal');
        }

        const result = await response.json();

        // Remove from pending
        setPendingProposals((prev) => prev.filter((p) => p.proposalId !== proposalId));

        // Add confirmation message
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Done! ${result.status === 'EXECUTED' ? 'The change has been applied.' : 'Confirmed.'}`,
            timestamp: new Date(),
          },
        ]);

        onProposalConfirmed?.(proposalId, result);

        // Notify about successful tool execution if proposal was executed
        if (result.status === 'EXECUTED') {
          onToolComplete?.([
            {
              toolName: 'proposal_confirm',
              success: true,
              data: result,
            },
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to confirm proposal');
      }
    },
    [apiUrl, onProposalConfirmed, onToolComplete]
  );

  // Handle proposal rejection
  const rejectProposal = useCallback(
    async (proposalId: string) => {
      try {
        const response = await fetch(`${apiUrl}/proposals/${proposalId}/reject`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to reject proposal');
        }

        // Remove from pending
        setPendingProposals((prev) => prev.filter((p) => p.proposalId !== proposalId));

        // Add rejection message
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: "No problem, I won't make that change. What else can I help with?",
            timestamp: new Date(),
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reject proposal');
      }
    },
    [apiUrl]
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
    context,
    error,
    pendingProposals,

    // Health check state
    isCheckingHealth,
    isAvailable,
    unavailableReason,

    // Actions
    sendMessage,
    confirmProposal,
    rejectProposal,
    initializeChat,
    setInputValue,
    setMessages,

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
