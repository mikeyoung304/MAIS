/**
 * Agent Tool Types
 *
 * Type definitions for MCP tool implementation.
 */

import type { AgentTrustTier } from '../../generated/prisma';

/**
 * Context provided to each tool execution
 */
export interface ToolContext {
  /** Tenant ID from JWT (CRITICAL: never from user input) */
  tenantId: string;
  /** Agent session ID for correlation */
  sessionId: string;
  /** Prisma client for database access */
  prisma: import('../../generated/prisma').PrismaClient;
}

/**
 * Result from a read tool
 */
export interface ReadToolResult<T = unknown> {
  success: true;
  data: T;
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
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
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
 */
export const INJECTION_PATTERNS = [
  /ignore.*instructions/i,
  /you are now/i,
  /system:/i,
  /admin mode/i,
  /forget.*previous/i,
  /new.*instructions/i,
  /disregard/i,
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
  let result = text;
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, '[FILTERED]');
  }
  return result.slice(0, maxLength);
}
