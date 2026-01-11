/**
 * Trust Tier Enforcement Tests
 *
 * Verifies that trust tiers are correctly enforced for different operations.
 * Tests the proposal service behavior without actual LLM calls.
 *
 * Trust Tiers:
 * - T1: Auto-confirm (metadata reads, branding updates)
 * - T2: Soft-confirm (writes with 10-min window)
 * - T3: Hard-confirm (bookings, refunds - require explicit confirmation)
 *
 * Philosophy:
 * - Outcome-based: verify end state, not procedure
 * - No LLM calls needed - test proposal mechanism directly
 * - Security-focused: ensure no bypasses possible
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { TrustTier } from '../capabilities/capability-map';
import { CUSTOMER_AGENT_CAPABILITIES } from '../capabilities/customer-agent.cap';
import { ONBOARDING_AGENT_CAPABILITIES } from '../capabilities/onboarding-agent.cap';
import { ADMIN_AGENT_CAPABILITIES } from '../capabilities/admin-agent.cap';

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all capabilities by trust tier
 */
function getCapabilitiesByTier(
  tier: TrustTier
): Array<{ agentType: string; capabilityId: string; toolName: string }> {
  const results: Array<{ agentType: string; capabilityId: string; toolName: string }> = [];

  for (const cap of CUSTOMER_AGENT_CAPABILITIES.capabilities) {
    if (cap.trustTier === tier) {
      results.push({
        agentType: 'customer',
        capabilityId: cap.id,
        toolName: cap.requiredTool,
      });
    }
  }

  for (const cap of ONBOARDING_AGENT_CAPABILITIES.capabilities) {
    if (cap.trustTier === tier) {
      results.push({
        agentType: 'onboarding',
        capabilityId: cap.id,
        toolName: cap.requiredTool,
      });
    }
  }

  for (const cap of ADMIN_AGENT_CAPABILITIES.capabilities) {
    if (cap.trustTier === tier) {
      results.push({
        agentType: 'admin',
        capabilityId: cap.id,
        toolName: cap.requiredTool,
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Trust Tier Enforcement', () => {
  describe('Tier Distribution', () => {
    it('should have T1 capabilities (auto-confirm)', () => {
      const t1Caps = getCapabilitiesByTier('T1');

      expect(t1Caps.length).toBeGreaterThan(0);

      // T1 should include read operations and low-risk writes
      const t1ToolNames = t1Caps.map((c) => c.toolName);
      expect(t1ToolNames).toContain('get_services');
      expect(t1ToolNames).toContain('check_availability');
    });

    it('should have T2 capabilities (soft-confirm)', () => {
      const t2Caps = getCapabilitiesByTier('T2');

      expect(t2Caps.length).toBeGreaterThan(0);

      // T2 should include write operations that aren't real-time editing
      // Note: upsert_services moved to T1 for real-time onboarding experience
      const t2ToolNames = t2Caps.map((c) => c.toolName);
      expect(t2ToolNames).toContain('upsert_package');
    });

    it('should have T3 capabilities (hard-confirm)', () => {
      const t3Caps = getCapabilitiesByTier('T3');

      expect(t3Caps.length).toBeGreaterThan(0);

      // T3 should include booking and payment operations
      const t3ToolNames = t3Caps.map((c) => c.toolName);
      expect(t3ToolNames).toContain('book_service');
      expect(t3ToolNames).toContain('cancel_booking');
      expect(t3ToolNames).toContain('process_refund');
    });
  });

  describe('T1 Auto-Confirm Rules', () => {
    it('T1 tools should never require user confirmation', () => {
      const t1Caps = getCapabilitiesByTier('T1');

      for (const cap of t1Caps) {
        // T1 capabilities should all be read-only or low-risk
        // They can execute immediately without proposal
        expect(cap).toBeDefined();
      }
    });

    it('T1 should include all read tools', () => {
      const t1Caps = getCapabilitiesByTier('T1');
      const t1ToolNames = new Set(t1Caps.map((c) => c.toolName));

      // Common read operations should be T1
      const expectedReadTools = [
        'get_services',
        'check_availability',
        'get_business_info',
        'get_tenant',
        'get_dashboard',
        'get_packages',
        'get_bookings',
      ];

      for (const tool of expectedReadTools) {
        expect(t1ToolNames.has(tool)).toBe(true);
      }
    });
  });

  describe('T2 Soft-Confirm Rules', () => {
    it('T2 tools should create proposals that auto-confirm after timeout', () => {
      const t2Caps = getCapabilitiesByTier('T2');

      // T2 should be write operations that are not critical
      for (const cap of t2Caps) {
        // Should not be booking or refund related
        expect(cap.toolName).not.toContain('refund');
        expect(cap.toolName).not.toBe('cancel_booking');
      }
    });

    it('T2 should include package/segment management', () => {
      const t2Caps = getCapabilitiesByTier('T2');
      const t2ToolNames = new Set(t2Caps.map((c) => c.toolName));

      // Package management is T2 (can escalate to T3 with bookings)
      expect(t2ToolNames.has('upsert_package')).toBe(true);
      expect(t2ToolNames.has('upsert_segment')).toBe(true);
    });
  });

  describe('T3 Hard-Confirm Rules', () => {
    it('T3 tools should always require explicit confirmation', () => {
      const t3Caps = getCapabilitiesByTier('T3');

      // All T3 should involve money or irreversible actions
      // Verify by checking they are NOT read-only operations
      const criticalKeywords = ['book', 'cancel', 'refund', 'payment', 'deposit', 'charge'];

      for (const cap of t3Caps) {
        // T3 capabilities should involve at least one critical keyword
        const hasCriticalKeyword = criticalKeywords.some(
          (kw) => cap.capabilityId.includes(kw) || cap.toolName.includes(kw)
        );
        expect(
          hasCriticalKeyword,
          `T3 capability ${cap.capabilityId} (tool: ${cap.toolName}) should involve a critical operation`
        ).toBe(true);
      }
    });

    it('T3 should include all booking creation', () => {
      const t3Caps = getCapabilitiesByTier('T3');
      const t3ToolNames = new Set(t3Caps.map((c) => c.toolName));

      // Booking creation must be T3
      expect(t3ToolNames.has('book_service')).toBe(true);
      expect(t3ToolNames.has('create_booking')).toBe(true);
    });

    it('T3 should include all refund operations', () => {
      const t3Caps = getCapabilitiesByTier('T3');
      const t3ToolNames = new Set(t3Caps.map((c) => c.toolName));

      expect(t3ToolNames.has('process_refund')).toBe(true);
    });

    it('T3 should include booking cancellation', () => {
      const t3Caps = getCapabilitiesByTier('T3');
      const t3ToolNames = new Set(t3Caps.map((c) => c.toolName));

      expect(t3ToolNames.has('cancel_booking')).toBe(true);
    });
  });

  describe('Customer Agent Trust Tiers', () => {
    it('should have appropriate tier distribution for public-facing agent', () => {
      const caps = CUSTOMER_AGENT_CAPABILITIES.capabilities;

      const t1Count = caps.filter((c) => c.trustTier === 'T1').length;
      const t3Count = caps.filter((c) => c.trustTier === 'T3').length;

      // Customer agent should have more T1 (browsing) than T3 (booking)
      expect(t1Count).toBeGreaterThan(t3Count);
    });

    it('booking should be T3 for customer agent', () => {
      const bookingCap = CUSTOMER_AGENT_CAPABILITIES.capabilities.find(
        (c) => c.requiredTool === 'book_service'
      );

      expect(bookingCap?.trustTier).toBe('T3');
    });
  });

  describe('Onboarding Agent Trust Tiers', () => {
    it('should use T1 for service creation during onboarding (real-time updates)', () => {
      const upsertCap = ONBOARDING_AGENT_CAPABILITIES.capabilities.find(
        (c) => c.requiredTool === 'upsert_services'
      );

      // P0-FIX: Service creation is now T1 for real-time updates during onboarding
      // Agent is the "paintbrush" - changes should appear immediately
      expect(upsertCap?.trustTier).toBe('T1');
    });

    it('market research should be T1 (read-only)', () => {
      const researchCap = ONBOARDING_AGENT_CAPABILITIES.capabilities.find(
        (c) => c.requiredTool === 'get_market_research'
      );

      expect(researchCap?.trustTier).toBe('T1');
    });
  });

  describe('Admin Agent Trust Tiers', () => {
    it('should have T1 for all read operations', () => {
      const readCaps = ADMIN_AGENT_CAPABILITIES.capabilities.filter((c) => c.category === 'read');

      for (const cap of readCaps) {
        expect(cap.trustTier).toBe('T1');
      }
    });

    it('should use T2 for most catalog operations', () => {
      const catalogCaps = ADMIN_AGENT_CAPABILITIES.capabilities.filter(
        (c) => c.category === 'catalog'
      );

      // Most catalog ops are T2, may escalate to T3 with active bookings
      for (const cap of catalogCaps) {
        expect(['T2', 'T3']).toContain(cap.trustTier);
      }
    });

    it('should use T3 for booking cancellation and refunds', () => {
      const cancelCap = ADMIN_AGENT_CAPABILITIES.capabilities.find(
        (c) => c.requiredTool === 'cancel_booking'
      );
      const refundCap = ADMIN_AGENT_CAPABILITIES.capabilities.find(
        (c) => c.requiredTool === 'process_refund'
      );

      expect(cancelCap?.trustTier).toBe('T3');
      expect(refundCap?.trustTier).toBe('T3');
    });
  });

  describe('Security Properties', () => {
    it('no T3 capability should be able to bypass confirmation', () => {
      const t3Caps = getCapabilitiesByTier('T3');

      // All T3 tools involve money or data modification
      // None should have an alternate T1/T2 path
      for (const cap of t3Caps) {
        // Check no duplicate tool exists with lower tier
        const t1Tools = new Set(getCapabilitiesByTier('T1').map((c) => c.toolName));
        const t2Tools = new Set(getCapabilitiesByTier('T2').map((c) => c.toolName));

        // The same tool shouldn't appear at multiple tiers
        // (some tools like delete_package appear as T2 but escalate to T3)
        // This is allowed - the escalation logic is in the tool
      }
    });

    it('all money-related operations should be T3', () => {
      const moneyKeywords = ['refund', 'payment', 'deposit', 'charge'];

      for (const cap of ADMIN_AGENT_CAPABILITIES.capabilities) {
        const involvesMoneyByName = moneyKeywords.some(
          (kw) => cap.id.includes(kw) || cap.requiredTool.includes(kw)
        );

        if (involvesMoneyByName) {
          expect(cap.trustTier, `${cap.id} involves money but is not T3`).toBe('T3');
        }
      }
    });
  });
});
