/**
 * Tenant Agent Message Dispatcher
 *
 * Enables external components (like SectionWidget) to send messages
 * to the Tenant Agent chat without direct coupling to ConciergeChat component.
 *
 * Pattern: Producer/Consumer with callback registration
 * - SectionWidget calls queueAgentMessage() → producer
 * - ConciergeChat registers sendProgrammaticMessage → consumer
 *
 * Note: The frontend hook is still named "ConciergeChat" for historical reasons,
 * but it actually connects to the unified `tenant-agent` on Cloud Run.
 * See SERVICE_REGISTRY.md for current agent architecture.
 *
 * @see apps/web/src/components/build-mode/SectionWidget.tsx
 * @see apps/web/src/hooks/useConciergeChat.ts (legacy name, connects to tenant-agent)
 */

type MessageSender = (message: string) => Promise<void>;

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

  // Process any messages that were queued before registration
  if (pendingMessages.length > 0) {
    const messages = [...pendingMessages];
    pendingMessages = [];
    // Process in order with small delays to avoid overwhelming
    messages.forEach((msg, i) => {
      setTimeout(() => sender(msg), i * 100);
    });
  }

  // Return cleanup function
  return () => {
    registeredSender = null;
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
    registeredSender(message);
  } else {
    // Queue for later (chat not yet initialized)
    pendingMessages.push(message);
  }
}

/**
 * Check if the agent chat is ready to receive messages.
 */
export function isAgentChatReady(): boolean {
  return registeredSender !== null;
}
