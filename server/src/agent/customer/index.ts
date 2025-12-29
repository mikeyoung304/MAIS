/**
 * Customer Chatbot Module
 *
 * Exports for customer-facing AI chatbot functionality.
 */

export { CustomerOrchestrator } from './customer-orchestrator';
export type {
  CustomerSessionContext,
  CustomerSessionState,
  CustomerChatResponse,
} from './customer-orchestrator';
export { CUSTOMER_TOOLS } from './customer-tools';
export type { CustomerToolContext } from './customer-tools';
export { CUSTOMER_SYSTEM_PROMPT, buildCustomerSystemPrompt } from './customer-prompt';
export { registerCustomerBookingExecutor } from './customer-booking-executor';
export { registerCustomerProposalExecutor, getCustomerProposalExecutor } from './executor-registry';
export type { CustomerProposalExecutor } from './executor-registry';
