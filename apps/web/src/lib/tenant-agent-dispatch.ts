/**
 * Tenant Agent Message Dispatcher
 *
 * Enables external components (like SectionWidget) to send messages
 * to the tenant-agent chat without direct coupling to ConciergeChat component.
 *
 * Pattern: Producer/Consumer with callback registration
 * - SectionWidget calls queueAgentMessage() → producer
 * - ConciergeChat component registers sendProgrammaticMessage → consumer
 *
 * Architecture note: The frontend hook/component are still named "ConciergeChat"
 * for backwards compatibility, but they connect to the unified `tenant-agent`
 * on Cloud Run. See SERVICE_REGISTRY.md for current agent architecture.
 *
 * @see apps/web/src/components/build-mode/SectionWidget.tsx
 * @see apps/web/src/hooks/useConciergeChat.ts (legacy name, connects to tenant-agent)
 * @see server/src/agent-v2/deploy/SERVICE_REGISTRY.md
 */

import { logger } from './logger';

type MessageSender = (message: string) => Promise<void>;

/**
 * Maximum number of messages to queue before sender is registered.
 * Defense-in-depth against potential DoS via message flooding.
 * Normal operation has 0-1 queued messages.
 */
const MAX_PENDING_MESSAGES = 20;

// Module-level state for message dispatch
let registeredSender: MessageSender | null = null;
let pendingMessages: string[] = [];

/**
 * Register the message sender callback from the chat component.
 * Called once when the chat initializes.
 *
 * @param sender - Function to send a message programmatically
 * @returns Cleanup function to unregister
 */
export function registerAgentSender(sender: MessageSender): () => void {
  registeredSender = sender;
  const timeoutIds: number[] = [];

  // Process any messages that were queued before registration
  if (pendingMessages.length > 0) {
    const messages = [...pendingMessages];
    pendingMessages = [];
    // Process in order with small delays to avoid overwhelming
    messages.forEach((msg, i) => {
      const id = window.setTimeout(() => sender(msg), i * 100);
      timeoutIds.push(id);
    });
  }

  // Return cleanup function that clears pending timeouts
  return () => {
    registeredSender = null;
    timeoutIds.forEach(clearTimeout);
  };
}

/**
 * Queue a message to send to the Tenant Agent.
 * If the chat is not yet initialized, the message is queued.
 *
 * @param message - The message to send
 *
 * @example
 * // From SectionWidget when user clicks "Approve & Continue"
 * queueAgentMessage("I approve the professional variant for the hero section");
 */
export function queueAgentMessage(message: string): void {
  if (registeredSender) {
    // Sender is registered, send immediately
    registeredSender(message).catch((err) => {
      logger.error('[tenant-agent-dispatch] Failed to send message:', err);
    });
  } else {
    // Queue for later (chat not yet initialized)
    if (pendingMessages.length >= MAX_PENDING_MESSAGES) {
      pendingMessages.shift(); // Drop oldest
      logger.warn('[tenant-agent-dispatch] Message queue full, dropped oldest message');
    }
    pendingMessages.push(message);
  }
}
