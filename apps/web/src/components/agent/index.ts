/**
 * Agent Components
 *
 * UI components for AI agent integration.
 * Cleaned up 2026-01-26 - removed legacy PanelAgentChat (uses ConciergeChat now).
 *
 * @see AgentPanel - Main panel component using ConciergeChat
 * @see ConciergeChat - Chat UI for Vertex AI Concierge agent
 */

export { AgentPanel } from './AgentPanel';
export { ConciergeChat, type ConciergeUIAction } from './ConciergeChat';
export { QuickReplyChips } from './QuickReplyChips';
