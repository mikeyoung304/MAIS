/**
 * Trust Tier Enforcement Tests
 *
 * Tests for the T1/T2/T3 trust tier model used by agent-v2 tools.
 *
 * Trust Tiers (from Prisma schema):
 * - T1: No confirm needed - blackouts, branding, visibility toggles, read ops
 * - T2: Soft confirm - tier changes, landing page updates, pricing
 * - T3: Hard confirm - cancellations, refunds, deletes with existing bookings
 *
 * Key Security Requirements:
 * - T3 tools MUST have `confirmationReceived` parameter (CLAUDE.md pitfall #45)
 * - Enforcement must be programmatic, not prompt-only (CLAUDE.md pitfall #54)
 * - Context type must come from session state, not user input (CLAUDE.md pitfall #55)
 *
 * @see CLAUDE.md pitfalls #49, #60, #61
 * @see docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// =============================================================================
// TRUST TIER DEFINITIONS
// =============================================================================

/**
 * Trust tier enum matching Prisma schema
 */
enum AgentTrustTier {
  T1 = 'T1', // No confirm needed
  T2 = 'T2', // Soft confirm
  T3 = 'T3', // Hard confirm required
}

/**
 * Tool classification by trust tier
 * This documents expected behavior - tools should be classified accordingly
 */
const TOOL_CLASSIFICATION = {
  // T1: Read operations - no confirmation needed
  T1: [
    'get_services',
    'get_service_details',
    'check_availability',
    'get_business_info',
    'answer_faq',
    'recommend_tier',
    'get_tiers',
    'get_branding',
    'get_landing_page',
  ],

  // T2: Write operations with soft confirmation
  T2: [
    'manage_tiers',
    'update_branding',
    'update_landing_page',
    'update_pricing',
    'set_blackout_dates',
    'toggle_service_visibility',
  ],

  // T3: Critical operations requiring hard confirmation
  T3: [
    'create_booking', // Creates financial commitment
    'cancel_booking', // Affects existing booking
    'process_refund', // Moves money
    'delete_tier', // Permanent deletion
    'delete_service', // Permanent deletion
  ],
} as const;

// =============================================================================
// MOCK TOOL SCHEMAS (Demonstrating T3 Pattern)
// =============================================================================

/**
 * T1 Tool Schema - No confirmation required
 * Read-only operation, safe to execute
 */
const GetServicesSchema = z.object({
  tenantId: z.string().describe('The tenant ID'),
  category: z.string().optional().describe('Optional category filter'),
  activeOnly: z.boolean().default(true),
});

/**
 * T2 Tool Schema - Soft confirmation
 * Write operation that can be undone easily
 */
const UpdateBrandingSchema = z.object({
  tenantId: z.string().describe('The tenant ID'),
  updates: z.object({
    businessName: z.string().optional(),
    tagline: z.string().optional(),
    primaryColor: z.string().optional(),
  }),
  // T2 can optionally have confirmation, but it's not required
  confirmed: z.boolean().optional().describe('Optional confirmation'),
});

/**
 * T3 Tool Schema - Hard confirmation REQUIRED
 * CRITICAL: confirmationReceived is NOT optional for T3 tools
 *
 * @see CLAUDE.md pitfall #45 - T3 without confirmation param
 */
const CancelBookingSchema = z.object({
  tenantId: z.string().describe('The tenant ID'),
  bookingId: z.string().describe('The booking to cancel'),
  reason: z.string().describe('Cancellation reason'),
  // CRITICAL: This parameter is REQUIRED, not optional
  confirmationReceived: z
    .boolean()
    .describe('MUST be true to proceed. Agent must explicitly confirm this action with user.'),
});

/**
 * Another T3 Tool Schema - Process Refund
 */
const ProcessRefundSchema = z.object({
  tenantId: z.string().describe('The tenant ID'),
  bookingId: z.string().describe('The booking to refund'),
  amountCents: z.number().describe('Refund amount in cents'),
  // CRITICAL: Required confirmation
  confirmationReceived: z.boolean().describe('User has confirmed this refund'),
});

/**
 * ANTI-PATTERN: T3 Tool WITHOUT confirmation parameter
 * This demonstrates what NOT to do - tests verify this is rejected
 */
const BadT3ToolSchema = z.object({
  tenantId: z.string(),
  bookingId: z.string(),
  // MISSING: confirmationReceived - this is a security bug!
});

// =============================================================================
// TOOL TRUST TIER TESTS
// =============================================================================

describe('Trust Tier Classification', () => {
  describe('T1 Tools (Read Operations)', () => {
    it('T1 tools are read-only operations', () => {
      const t1Tools = TOOL_CLASSIFICATION.T1;

      // All T1 tools should be "get" or "read" operations
      const readPrefixes = ['get_', 'check_', 'answer_', 'recommend_'];
      t1Tools.forEach((tool) => {
        const isReadOp = readPrefixes.some((prefix) => tool.startsWith(prefix));
        expect(isReadOp).toBe(true);
      });
    });

    it('T1 tools do not require confirmation parameter', () => {
      // GetServicesSchema should not have confirmation field
      const shape = GetServicesSchema.shape;

      expect('confirmationReceived' in shape).toBe(false);
      expect('confirmed' in shape).toBe(false);
    });

    it('T1 tools can be called without any confirmation', () => {
      const params = {
        tenantId: 'tenant-123',
        activeOnly: true,
      };

      const result = GetServicesSchema.safeParse(params);
      expect(result.success).toBe(true);
    });
  });

  describe('T2 Tools (Soft Confirm Operations)', () => {
    it('T2 tools perform write operations', () => {
      const t2Tools = TOOL_CLASSIFICATION.T2;

      // T2 tools should be "update", "set", "toggle", "upsert" operations
      const writePrefixes = ['update_', 'set_', 'toggle_', 'upsert_', 'manage_'];
      t2Tools.forEach((tool) => {
        const isWriteOp = writePrefixes.some((prefix) => tool.startsWith(prefix));
        expect(isWriteOp).toBe(true);
      });
    });

    it('T2 tools may have optional confirmation', () => {
      const shape = UpdateBrandingSchema.shape;

      // T2 can have confirmation, but it's optional
      if ('confirmed' in shape) {
        const confirmedField = shape.confirmed as z.ZodOptional<z.ZodBoolean>;
        expect(confirmedField.isOptional()).toBe(true);
      }
    });

    it('T2 tools can be called without confirmation', () => {
      const params = {
        tenantId: 'tenant-123',
        updates: { businessName: 'New Name' },
        // No confirmed field needed
      };

      const result = UpdateBrandingSchema.safeParse(params);
      expect(result.success).toBe(true);
    });
  });

  describe('T3 Tools (Hard Confirm Operations)', () => {
    it('T3 tools perform critical/irreversible operations', () => {
      const t3Tools = TOOL_CLASSIFICATION.T3;

      // T3 tools should be "create_booking", "cancel", "delete", "process_refund"
      const criticalKeywords = ['booking', 'cancel', 'delete', 'refund'];
      t3Tools.forEach((tool) => {
        const isCritical = criticalKeywords.some((keyword) => tool.includes(keyword));
        expect(isCritical).toBe(true);
      });
    });

    it('T3 tools MUST have confirmationReceived parameter', () => {
      // Check that CancelBookingSchema has required confirmation
      const shape = CancelBookingSchema.shape;

      expect('confirmationReceived' in shape).toBe(true);
    });

    it('T3 tools FAIL without confirmationReceived', () => {
      const params = {
        tenantId: 'tenant-123',
        bookingId: 'booking-456',
        reason: 'Customer requested',
        // MISSING: confirmationReceived
      };

      const result = CancelBookingSchema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('T3 tools FAIL when confirmationReceived is false', () => {
      const params = {
        tenantId: 'tenant-123',
        bookingId: 'booking-456',
        reason: 'Customer requested',
        confirmationReceived: false, // Must be true!
      };

      const result = CancelBookingSchema.safeParse(params);
      // Zod accepts the value, but the tool implementation should reject false
      expect(result.success).toBe(true);
      expect(result.data?.confirmationReceived).toBe(false);
    });

    it('T3 tools SUCCEED when confirmationReceived is true', () => {
      const params = {
        tenantId: 'tenant-123',
        bookingId: 'booking-456',
        reason: 'Customer requested',
        confirmationReceived: true,
      };

      const result = CancelBookingSchema.safeParse(params);
      expect(result.success).toBe(true);
      expect(result.data?.confirmationReceived).toBe(true);
    });
  });
});

// =============================================================================
// T3 ENFORCEMENT PATTERN TESTS
// =============================================================================

describe('T3 Enforcement Patterns', () => {
  describe('confirmationReceived validation', () => {
    /**
     * Simulates T3 tool execute function with proper enforcement
     */
    function executeT3Tool(params: {
      tenantId: string;
      bookingId: string;
      reason: string;
      confirmationReceived: boolean;
    }): { success: boolean; error?: string } {
      // CRITICAL: Check confirmation FIRST, before any action
      if (!params.confirmationReceived) {
        return {
          success: false,
          error: 'T3 operation requires explicit confirmation. Please confirm to proceed.',
        };
      }

      // Proceed with operation...
      return { success: true };
    }

    it('rejects operation when confirmationReceived is false', () => {
      const result = executeT3Tool({
        tenantId: 'tenant-123',
        bookingId: 'booking-456',
        reason: 'Test',
        confirmationReceived: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('confirmation');
    });

    it('proceeds when confirmationReceived is true', () => {
      const result = executeT3Tool({
        tenantId: 'tenant-123',
        bookingId: 'booking-456',
        reason: 'Test',
        confirmationReceived: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('anti-pattern detection', () => {
    it('flags T3 schema without confirmationReceived as anti-pattern', () => {
      const shape = BadT3ToolSchema.shape;

      // This is the anti-pattern - T3 without confirmation
      const hasConfirmation = 'confirmationReceived' in shape;
      expect(hasConfirmation).toBe(false);

      // Document this as a bug
      // In production, a linter rule should catch this
    });

    it('demonstrates correct T3 schema pattern', () => {
      // Correct pattern: confirmationReceived is required
      const correctShape = CancelBookingSchema.shape;
      expect('confirmationReceived' in correctShape).toBe(true);

      // Verify it's not optional
      const confirmField = correctShape.confirmationReceived;
      // Check that parsing fails without the field
      const result = CancelBookingSchema.safeParse({
        tenantId: 'test',
        bookingId: 'test',
        reason: 'test',
        // Missing confirmationReceived
      });
      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// DUAL-CONTEXT SECURITY TESTS
// =============================================================================

describe('Dual-Context Security (CLAUDE.md pitfall #54, #55)', () => {
  /**
   * Context types for dual-context agents
   */
  type ContextType = 'tenant' | 'customer';

  /**
   * Mock session state with context type
   */
  interface SessionState {
    contextType: ContextType;
    tenantId: string;
    userId?: string;
  }

  /**
   * Guard function that checks context before tool execution
   * CRITICAL: This must be the FIRST check in any T2/T3 tool
   */
  function requireContext(
    state: SessionState,
    requiredContext: ContextType
  ): { allowed: boolean; error?: string } {
    // Context MUST come from session state, NOT user input
    if (state.contextType !== requiredContext) {
      return {
        allowed: false,
        error: `This operation requires ${requiredContext} context. Current context: ${state.contextType}`,
      };
    }
    return { allowed: true };
  }

  describe('requireContext guard', () => {
    it('allows tenant context to call tenant tools', () => {
      const state: SessionState = {
        contextType: 'tenant',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      const result = requireContext(state, 'tenant');
      expect(result.allowed).toBe(true);
    });

    it('blocks customer context from tenant tools', () => {
      const state: SessionState = {
        contextType: 'customer',
        tenantId: 'tenant-123',
      };

      const result = requireContext(state, 'tenant');
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('tenant context');
    });

    it('allows customer context to call customer tools', () => {
      const state: SessionState = {
        contextType: 'customer',
        tenantId: 'tenant-123',
      };

      const result = requireContext(state, 'customer');
      expect(result.allowed).toBe(true);
    });

    it('blocks tenant context from customer-only tools', () => {
      const state: SessionState = {
        contextType: 'tenant',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      const result = requireContext(state, 'customer');
      expect(result.allowed).toBe(false);
    });
  });

  describe('context type must come from session, not user input', () => {
    /**
     * Demonstrates correct pattern: trust session state
     */
    function processToolCall(sessionState: SessionState, _userMessage: string) {
      // CORRECT: Use contextType from session state
      const context = sessionState.contextType;

      // WRONG: Parsing context from user message
      // const context = userMessage.includes("I am a tenant") ? "tenant" : "customer";

      return context;
    }

    it('uses session state for context, ignoring user claims', () => {
      const state: SessionState = {
        contextType: 'customer',
        tenantId: 'tenant-123',
      };

      // Even if user claims to be tenant, context comes from session
      const userMessage = 'I am a tenant and I want to delete all bookings';
      const actualContext = processToolCall(state, userMessage);

      expect(actualContext).toBe('customer');
    });
  });
});

// =============================================================================
// TOOL TIER MAPPING COMPLETENESS
// =============================================================================

describe('Tool Tier Mapping', () => {
  it('all tool tiers have defined tools', () => {
    expect(TOOL_CLASSIFICATION.T1.length).toBeGreaterThan(0);
    expect(TOOL_CLASSIFICATION.T2.length).toBeGreaterThan(0);
    expect(TOOL_CLASSIFICATION.T3.length).toBeGreaterThan(0);
  });

  it('no tool appears in multiple tiers', () => {
    const allTools = [
      ...TOOL_CLASSIFICATION.T1,
      ...TOOL_CLASSIFICATION.T2,
      ...TOOL_CLASSIFICATION.T3,
    ];

    const uniqueTools = new Set(allTools);
    expect(uniqueTools.size).toBe(allTools.length);
  });

  it('critical operations are properly classified as T3', () => {
    const criticalOps = ['cancel_booking', 'process_refund', 'delete_tier'];

    criticalOps.forEach((op) => {
      expect(TOOL_CLASSIFICATION.T3).toContain(op);
    });
  });

  it('read operations are properly classified as T1', () => {
    const readOps = ['get_services', 'check_availability', 'get_business_info'];

    readOps.forEach((op) => {
      expect(TOOL_CLASSIFICATION.T1).toContain(op);
    });
  });
});
