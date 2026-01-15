/**
 * Agent Tool Types
 *
 * Type definitions for MCP tool implementation.
 */

import type { AgentTrustTier, PrismaClient } from '../../generated/prisma/client';
import type { LandingPageConfig, PagesConfig } from '@macon/contracts';

/**
 * Result from getDraftConfig
 * Moved here to avoid circular dependency with utils.ts
 */
export interface DraftConfigResult {
  pages: PagesConfig;
  hasDraft: boolean;
}

/**
 * Result from getDraftConfigWithSlug
 * Combined result to avoid N+1 queries when both config and slug are needed
 *
 * Includes raw configs for discovery tools that need to compute:
 * - existsInDraft / existsInLive flags (list_section_ids)
 * - source field (get_section_by_id)
 */
export interface DraftConfigWithSlugResult extends DraftConfigResult {
  slug: string | null;
  /** Raw draft config (null if no draft exists) - use for existsInDraft checks */
  rawDraftConfig: LandingPageConfig | null;
  /** Raw live config (null if no live config exists) - use for existsInLive checks */
  rawLiveConfig: LandingPageConfig | null;
}

/**
 * Context provided to each tool execution
 */
export interface ToolContext {
  /** Tenant ID from JWT (CRITICAL: never from user input) */
  tenantId: string;
  /** Agent session ID for correlation */
  sessionId: string;
  /** Prisma client for database access */
  prisma: PrismaClient;
  /**
   * Pre-fetched draft config (optional, populated for Build Mode tools)
   * Eliminates N+1 query pattern - reduces 15+ queries to 3 per turn
   * Gated by ENABLE_CONTEXT_CACHE feature flag
   * CRITICAL: Must be invalidated after T1 writes to prevent stale data
   */
  draftConfig?: DraftConfigWithSlugResult;
}

/**
 * Result from a read tool
 */
export interface ReadToolResult<T = unknown> {
  success: true;
  data: T;
  /** Optional metadata for pagination, counts, etc. */
  meta?: Record<string, unknown>;
}

/**
 * Result from a write tool - returns a proposal for approval
 */
export interface WriteToolProposal {
  success: true;
  proposalId: string;
  operation: string;
  preview: Record<string, unknown>;
  trustTier: AgentTrustTier;
  requiresApproval: boolean;
  expiresAt: string; // ISO date
}

/**
 * Error result from any tool
 */
export interface ToolError {
  success: false;
  error: string;
  code?: string;
}

/**
 * Union type for all tool results
 */
export type AgentToolResult<T = unknown> = ReadToolResult<T> | WriteToolProposal | ToolError;

/**
 * Tool definition for MCP
 */
export interface AgentTool {
  name: string;
  description: string;
  /**
   * Trust tier for write operations:
   * - T1: Auto-confirm (reads, visibility toggles, file uploads)
   * - T2: Soft-confirm (proceeds unless user says "wait")
   * - T3: Hard-confirm (requires explicit "yes"/"confirm")
   *
   * REQUIRED for all tools to prevent silent T1 defaults.
   * Read-only tools should use 'T1'.
   */
  trustTier: 'T1' | 'T2' | 'T3';
  inputSchema: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required?: string[];
  };
  execute: (context: ToolContext, params: Record<string, unknown>) => Promise<AgentToolResult>;
}

/**
 * Trust tier definitions
 */
export const TRUST_TIERS = {
  T1: {
    description: 'No confirmation needed',
    autoConfirm: true,
    examples: ['Blackouts', 'branding', 'visibility toggles', 'file uploads'],
  },
  T2: {
    description: 'Soft confirmation - proceeds after next message unless user says "wait"',
    autoConfirm: false,
    softConfirm: true,
    examples: ['Package changes', 'landing page updates', 'pricing'],
  },
  T3: {
    description: 'Hard confirmation - requires explicit "yes"/"confirm"/"do it"',
    autoConfirm: false,
    softConfirm: false,
    examples: ['Cancellations', 'refunds', 'deletes with existing bookings'],
  },
} as const;

/**
 * Injection patterns to filter from context
 *
 * IMPORTANT: These patterns detect prompt injection attempts.
 * Keep patterns specific to avoid false positives on normal input.
 * Test with realistic business names (e.g., "Disregard for Details Photography").
 *
 * Unicode lookalike characters are handled by NFKC normalization in sanitizeForContext().
 */
export const INJECTION_PATTERNS = [
  // Original patterns - direct instruction override attempts (refined for specificity)
  /ignore\s+(all\s+)?(your\s+)?instructions/i,
  /you are now\s+(a|an|my|the)/i,
  /system:\s*\[/i, // System prompt syntax
  /admin mode\s*(on|enabled|activate)/i,
  /forget\s+(all\s+)?(your\s+)?previous/i,
  /new\s+instructions:/i, // More specific to avoid false positives
  /disregard\s+(all|previous|above)/i, // More specific than just "disregard"

  // Additional system prompt override attempts
  /override\s+(system|previous|all)/i,
  /bypass\s+(safety|filters|restrictions)/i,
  /act\s+as\s+(if|though)\s+you\s+(are|were)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(a|an)/i,
  /roleplay\s+as\s+(a|an)/i,
  /\[system\]/i, // Bracketed system markers
  /\[assistant\]/i,
  /\[user\]/i,
  /<<\s*SYS\s*>>/i, // Llama-style system markers
  /<\|system\|>/i, // Chat template markers

  // Nested injection attempts (closing/reopening context)
  /```\s*(system|assistant|user)/i,
  /###\s*(instruction|system|prompt)/i,
  /<\/?(system|assistant|user)>/i, // XML-style injection
  /\{\{(system|prompt|instructions)\}\}/i, // Template injection

  // Common jailbreak phrases (specific to avoid false positives)
  /jailbreak/i,
  /\bdan\s+mode\b/i, // "Do Anything Now" jailbreak
  /developer\s+mode\s*(on|enabled)/i,
  /unrestricted\s+mode/i,
  /no\s+(filter|restrictions|limits)\s+mode/i,
  /\bgod\s+mode\b/i,
  /\bsudo\s+mode\b/i,

  // Prompt leaking attempts
  /reveal\s+(your\s+)?(system\s+)?prompt/i,
  /show\s+(your\s+)?(system\s+)?instructions/i,
  /what\s+are\s+your\s+instructions/i,
  /output\s+(your\s+)?initial\s+prompt/i,

  // Context manipulation
  /end\s+of\s+(system\s+)?prompt/i,
  /begin\s+new\s+conversation/i,
  /reset\s+(conversation|context|memory)/i,
  /clear\s+(your\s+)?context/i,
];

/**
 * Fields that should NEVER be injected into context
 */
export const DENY_LIST_FIELDS = [
  'passwordHash',
  'passwordResetToken',
  'passwordResetExpires',
  'apiKeyPublic',
  'apiKeySecret',
  'stripeAccountId',
  'stripeWebhookSecret',
  'secrets',
  'googleCalendarRefreshToken',
] as const;

/**
 * Sanitize text for context injection
 * Removes potential prompt injection attempts and limits length
 */
export function sanitizeForContext(text: string, maxLength = 100): string {
  // Normalize Unicode to canonical form (NFKC) to prevent homoglyph/lookalike character bypasses
  let result = text.normalize('NFKC');
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, '[FILTERED]');
  }
  return result.slice(0, maxLength);
}
