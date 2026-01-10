/**
 * Agent Session Store
 *
 * Persists agent session state across route navigations.
 * Solves the "context loss" bug where switching tabs resets chat history.
 *
 * P1-FIX (2026-01-10): Frontend was discarding message history on component
 * remount. This store persists the sessionId and messages across navigation.
 *
 * Architecture:
 * - Zustand store with localStorage persistence
 * - Session ID persisted to survive component remounts
 * - Messages cached to avoid redundant API calls
 * - TTL for session validity (matches backend 24-hour TTL)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '@/hooks/useAgentChat';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (matches backend)

interface AgentSessionState {
  // Session identity
  sessionId: string | null;
  sessionCreatedAt: number | null;

  // Cached messages
  messages: ChatMessage[];
  lastMessageFetchedAt: number | null;

  // Actions
  setSessionId: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  clearSession: () => void;
  isSessionValid: () => boolean;
}

export const useAgentSessionStore = create<AgentSessionState>()(
  persist(
    (set, get) => ({
      // Initial state
      sessionId: null,
      sessionCreatedAt: null,
      messages: [],
      lastMessageFetchedAt: null,

      // Set session ID (also records creation time)
      setSessionId: (id) =>
        set({
          sessionId: id,
          sessionCreatedAt: id ? Date.now() : null,
        }),

      // Replace all messages (used when loading history from backend)
      setMessages: (messages) =>
        set({
          messages,
          lastMessageFetchedAt: Date.now(),
        }),

      // Add a single message (used during chat)
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),

      // Clear all session state (used on logout or session expiry)
      clearSession: () =>
        set({
          sessionId: null,
          sessionCreatedAt: null,
          messages: [],
          lastMessageFetchedAt: null,
        }),

      // Check if current session is still valid (within TTL)
      isSessionValid: () => {
        const { sessionId, sessionCreatedAt } = get();
        if (!sessionId || !sessionCreatedAt) return false;
        return Date.now() - sessionCreatedAt < SESSION_TTL_MS;
      },
    }),
    {
      name: 'agent-session',
      // Only persist essential fields, not computed state
      partialize: (state) => ({
        sessionId: state.sessionId,
        sessionCreatedAt: state.sessionCreatedAt,
        messages: state.messages,
        lastMessageFetchedAt: state.lastMessageFetchedAt,
      }),
    }
  )
);

// Expose store on window for Playwright E2E tests
// Pattern from: docs/solutions/patterns/E2E_NEXTJS_MIGRATION_PREVENTION_STRATEGIES.md
if (typeof window !== 'undefined') {
  (window as Window & { agentSessionStore?: typeof useAgentSessionStore }).agentSessionStore =
    useAgentSessionStore;
}

/**
 * Helper to get session ID without hook (for non-React contexts)
 */
export function getAgentSessionId(): string | null {
  return useAgentSessionStore.getState().sessionId;
}

/**
 * Helper to check session validity without hook
 */
export function isAgentSessionValid(): boolean {
  return useAgentSessionStore.getState().isSessionValid();
}
