/**
 * MAIS Business Growth Agent - MCP Server
 *
 * This module provides AI agent integration for the MAIS platform.
 * It implements the Model Context Protocol (MCP) for Claude integration.
 *
 * Architecture:
 * - Tools wrap existing API endpoints (tenant-admin routes)
 * - Server-side proposal mechanism for write operations
 * - Audit logging for all tool calls
 * - Context injection for session initialization
 * - Claude API orchestration via BaseOrchestrator subclasses:
 *   - AdminOrchestrator: Business assistant with onboarding mode detection
 *   - OnboardingOrchestrator: Specialized onboarding flow
 *   - CustomerChatOrchestrator: Public customer chatbot with injection detection
 *
 * Security:
 * - TenantId from JWT, never from user input
 * - Server-side approval for sensitive operations
 * - Data sanitization before context injection
 * - Code-level guardrails (rate limiting, circuit breakers, tier budgets)
 */

// Tool exports
export { readTools } from './tools/read-tools';
export { writeTools } from './tools/write-tools';
export type {
  AgentTool,
  AgentToolResult,
  ToolContext,
  ReadToolResult,
  WriteToolProposal,
  ToolError,
} from './tools/types';
export {
  sanitizeForContext,
  INJECTION_PATTERNS,
  DENY_LIST_FIELDS,
  TRUST_TIERS,
} from './tools/types';

// Proposal service
export { ProposalService } from './proposals/proposal.service';
export type { CreateProposalInput, ProposalResult } from './proposals/proposal.service';

// Context builder
export {
  buildSessionContext,
  buildFallbackContext,
  getHandledGreeting,
  detectOnboardingState,
} from './context/context-builder';
export type { AgentSessionContext } from './context/context-builder';

// Audit service
export { AuditService, AuditBatcher } from './audit/audit.service';
export type { AuditLogInput, AuditLogEntry } from './audit/audit.service';

// Orchestrators (Claude API integration with code-level guardrails)
export {
  BaseOrchestrator,
  AdminOrchestrator,
  OnboardingOrchestrator,
  CustomerChatOrchestrator,
} from './orchestrator';
export type {
  OrchestratorConfig,
  ChatMessage,
  SessionState,
  ChatResponse,
  BaseOrchestratorConfig,
  BaseChatMessage,
  BaseSessionState,
  BaseChatResponse,
  PromptContext,
} from './orchestrator';

// Re-export getAllTools from consolidated module
export { getAllTools, getAllToolsWithOnboarding } from './tools/all-tools';

// Onboarding system prompt
export {
  buildOnboardingSystemPrompt,
  getOnboardingGreeting,
} from './prompts/onboarding-system-prompt';
export type { OnboardingPromptContext } from './prompts/onboarding-system-prompt';

// Advisor memory service
export { AdvisorMemoryService } from './onboarding/advisor-memory.service';
export type { AdvisorMemorySummary, OnboardingContext } from './onboarding/advisor-memory.service';
