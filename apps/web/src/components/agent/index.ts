/**
 * Agent Components
 *
 * UI components for AI agent integration.
 * Migrated 2026-02 from Concierge → Tenant Agent naming.
 *
 * @see AgentPanel - Main panel component using TenantAgentChat
 * @see TenantAgentChat - Chat UI for unified Tenant Agent (Cloud Run)
 */

export { AgentPanel } from './AgentPanel';
export {
  TenantAgentChat,
  type TenantAgentUIAction,
  // Backwards compatibility exports (can be removed after migration)
  ConciergeChat,
  type ConciergeUIAction,
} from './TenantAgentChat';
export { QuickReplyChips } from './QuickReplyChips';
