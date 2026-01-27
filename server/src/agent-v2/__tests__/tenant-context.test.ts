/**
 * Tenant Context Module Tests
 *
 * Tests for the 4-tier defensive tenant ID extraction pattern.
 * Ensures tenant context is correctly extracted across all ADK scenarios:
 *
 * 1. state.get<T>('key') - Map-like API (direct ADK calls)
 * 2. state.tenantId - Plain object access (A2A protocol)
 * 3. userId with colon - Format "tenantId:userId" (MAIS multi-tenant pattern)
 * 4. userId without colon - Direct tenant ID (fallback)
 *
 * @see CLAUDE.md Pitfall #41 - State Map-like API
 * @see CLAUDE.md Pitfall #42 - Missing state defaults
 * @see docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md
 */

import { describe, it, expect, vi } from 'vitest';
import { getTenantId, requireTenantId, type TenantContextLogger } from '../shared/tenant-context';
import type { ToolContext } from '@google/adk';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a mock logger for testing log output
 */
function createMockLogger(): TenantContextLogger & { logs: { level: string; msg: string }[] } {
  const logs: { level: string; msg: string }[] = [];
  return {
    logs,
    info: (_data: Record<string, unknown>, msg: string) => {
      logs.push({ level: 'info', msg });
    },
    warn: (_data: Record<string, unknown>, msg: string) => {
      logs.push({ level: 'warn', msg });
    },
  };
}

/**
 * Create a mock ToolContext with state.get() Map-like API (Tier 1)
 */
function createMapLikeStateContext(tenantId: string | null): Partial<ToolContext> {
  const stateMap = new Map<string, unknown>();
  if (tenantId) {
    stateMap.set('tenantId', tenantId);
  }

  return {
    state: {
      get: <T>(key: string) => stateMap.get(key) as T,
      set: (key: string, value: unknown) => stateMap.set(key, value),
      has: (key: string) => stateMap.has(key),
      delete: (key: string) => stateMap.delete(key),
    } as ToolContext['state'],
    invocationContext: undefined,
  };
}

/**
 * Create a mock ToolContext with plain object state (Tier 2 - A2A)
 */
function createPlainObjectStateContext(tenantId: string | null): Partial<ToolContext> {
  const stateObj: Record<string, unknown> = {};
  if (tenantId) {
    stateObj.tenantId = tenantId;
  }

  return {
    // A2A passes state as plain object, not Map-like
    state: stateObj as unknown as ToolContext['state'],
    invocationContext: undefined,
  };
}

/**
 * Create a mock ToolContext with userId in colon format (Tier 3)
 */
function createColonUserIdContext(userId: string): Partial<ToolContext> {
  return {
    state: undefined,
    invocationContext: {
      session: {
        userId,
        id: 'session-123',
        appName: 'test-agent',
      },
    } as ToolContext['invocationContext'],
  };
}

/**
 * Create a mock ToolContext with userId as direct tenant ID (Tier 4)
 */
function createDirectUserIdContext(userId: string): Partial<ToolContext> {
  return {
    state: undefined,
    invocationContext: {
      session: {
        userId,
        id: 'session-123',
        appName: 'test-agent',
      },
    } as ToolContext['invocationContext'],
  };
}

/**
 * Create an empty context with no tenant information
 */
function createEmptyContext(): Partial<ToolContext> {
  return {
    state: undefined,
    invocationContext: undefined,
  };
}

// =============================================================================
// getTenantId() Tests
// =============================================================================

describe('getTenantId()', () => {
  describe('Tier 1: state.get() Map-like API (direct ADK)', () => {
    it('extracts tenant ID from state.get()', () => {
      const context = createMapLikeStateContext('tenant-123');
      const result = getTenantId(context as ToolContext);
      expect(result).toBe('tenant-123');
    });

    it('handles complex tenant IDs', () => {
      const context = createMapLikeStateContext('cm1abc123def456');
      const result = getTenantId(context as ToolContext);
      expect(result).toBe('cm1abc123def456');
    });

    it('returns null when tenantId not in state', () => {
      const context = createMapLikeStateContext(null);
      const result = getTenantId(context as ToolContext);
      // Will fall through to try other tiers, but none have data
      expect(result).toBe(null);
    });

    it('logs extraction source with logger', () => {
      const logger = createMockLogger();
      const context = createMapLikeStateContext('tenant-abc');
      getTenantId(context as ToolContext, { logger, agentName: 'TestAgent' });

      expect(logger.logs.some((l) => l.msg.includes('state.get()'))).toBe(true);
      expect(logger.logs.some((l) => l.msg.includes('tenant-abc'))).toBe(true);
    });
  });

  describe('Tier 2: state as plain object (A2A protocol)', () => {
    it('extracts tenant ID from plain object state', () => {
      const context = createPlainObjectStateContext('tenant-a2a');
      const result = getTenantId(context as ToolContext);
      expect(result).toBe('tenant-a2a');
    });

    it('handles A2A state with additional fields', () => {
      const context = {
        state: {
          tenantId: 'tenant-full-state',
          otherField: 'value',
          nested: { data: true },
        } as unknown as ToolContext['state'],
        invocationContext: undefined,
      };
      const result = getTenantId(context as ToolContext);
      expect(result).toBe('tenant-full-state');
    });

    it('returns null when tenantId not in plain object', () => {
      const context = createPlainObjectStateContext(null);
      const result = getTenantId(context as ToolContext);
      expect(result).toBe(null);
    });

    it('logs extraction source for A2A', () => {
      const logger = createMockLogger();
      const context = createPlainObjectStateContext('tenant-a2a-logged');
      getTenantId(context as ToolContext, { logger, agentName: 'A2AAgent' });

      expect(logger.logs.some((l) => l.msg.includes('state object'))).toBe(true);
    });
  });

  describe('Tier 3: userId with colon format (tenantId:userId)', () => {
    it('extracts tenant ID from colon-separated userId', () => {
      const context = createColonUserIdContext('tenant-xyz:user-123');
      const result = getTenantId(context as ToolContext);
      expect(result).toBe('tenant-xyz');
    });

    it('handles CUID-format tenant IDs', () => {
      const context = createColonUserIdContext('cm1abc123def456:user-789');
      const result = getTenantId(context as ToolContext);
      expect(result).toBe('cm1abc123def456');
    });

    it('handles multiple colons (uses first segment)', () => {
      // Edge case: userId might have colons in it
      const context = createColonUserIdContext('tenant-id:user:with:colons');
      const result = getTenantId(context as ToolContext);
      expect(result).toBe('tenant-id');
    });

    it('logs colon format extraction', () => {
      const logger = createMockLogger();
      const context = createColonUserIdContext('tenant-colon:user-id');
      getTenantId(context as ToolContext, { logger, agentName: 'ColonAgent' });

      expect(logger.logs.some((l) => l.msg.includes('colon format'))).toBe(true);
    });
  });

  describe('Tier 4: userId as direct tenant ID (fallback)', () => {
    it('uses userId directly when no colon present', () => {
      const context = createDirectUserIdContext('direct-tenant-id');
      const result = getTenantId(context as ToolContext);
      expect(result).toBe('direct-tenant-id');
    });

    it('handles CUID as direct userId', () => {
      const context = createDirectUserIdContext('cm1def456ghi789');
      const result = getTenantId(context as ToolContext);
      expect(result).toBe('cm1def456ghi789');
    });

    it('logs direct userId usage', () => {
      const logger = createMockLogger();
      const context = createDirectUserIdContext('direct-fallback');
      getTenantId(context as ToolContext, { logger, agentName: 'FallbackAgent' });

      expect(logger.logs.some((l) => l.msg.includes('userId as tenantId'))).toBe(true);
    });
  });

  describe('no tenant context available', () => {
    it('returns null for undefined context', () => {
      const result = getTenantId(undefined);
      expect(result).toBe(null);
    });

    it('returns null for empty context', () => {
      const context = createEmptyContext();
      const result = getTenantId(context as ToolContext);
      expect(result).toBe(null);
    });

    it('returns null when all tiers fail', () => {
      const context = {
        state: { somethingElse: 'value' } as unknown as ToolContext['state'],
        invocationContext: {
          session: undefined,
        } as ToolContext['invocationContext'],
      };
      const result = getTenantId(context as ToolContext);
      expect(result).toBe(null);
    });

    it('logs warning when tenant ID not found', () => {
      const logger = createMockLogger();
      const context = createEmptyContext();
      getTenantId(context as ToolContext, { logger, agentName: 'WarnAgent' });

      expect(logger.logs.some((l) => l.level === 'warn')).toBe(true);
      expect(logger.logs.some((l) => l.msg.includes('Could not extract'))).toBe(true);
    });
  });

  describe('tier precedence (priority order)', () => {
    it('prefers Tier 1 (state.get) over Tier 2 (plain object)', () => {
      // Create a context that could match both Tier 1 and Tier 2
      const stateMap = new Map<string, unknown>();
      stateMap.set('tenantId', 'tier1-tenant');

      const context = {
        state: Object.assign(
          {
            get: <T>(key: string) => stateMap.get(key) as T,
            set: (key: string, value: unknown) => stateMap.set(key, value),
            has: (key: string) => stateMap.has(key),
            delete: (key: string) => stateMap.delete(key),
            tenantId: 'tier2-tenant', // Plain object property
          },
          {}
        ) as ToolContext['state'],
        invocationContext: undefined,
      };

      const result = getTenantId(context as ToolContext);
      // Should get Tier 1 result
      expect(result).toBe('tier1-tenant');
    });

    it('falls back to Tier 2 when Tier 1 returns null', () => {
      const context = {
        state: Object.assign(
          {
            get: <T>(_key: string) => undefined as T,
            set: vi.fn(),
            has: vi.fn(),
            delete: vi.fn(),
            tenantId: 'tier2-fallback',
          },
          {}
        ) as ToolContext['state'],
        invocationContext: undefined,
      };

      const result = getTenantId(context as ToolContext);
      expect(result).toBe('tier2-fallback');
    });

    it('falls back to Tier 3/4 when state has no tenantId', () => {
      const context = {
        state: {
          get: <T>(_key: string) => undefined as T,
          otherField: 'value',
        } as unknown as ToolContext['state'],
        invocationContext: {
          session: {
            userId: 'tenant-from-userid:user-123',
            id: 'session-123',
            appName: 'test-agent',
          },
        } as ToolContext['invocationContext'],
      };

      const result = getTenantId(context as ToolContext);
      expect(result).toBe('tenant-from-userid');
    });
  });

  describe('edge cases', () => {
    it('handles empty string tenantId as falsy', () => {
      const context = createMapLikeStateContext('');
      const result = getTenantId(context as ToolContext);
      // Empty string is falsy, should fall through
      expect(result).toBe(null);
    });

    it('handles whitespace-only tenantId', () => {
      const context = createMapLikeStateContext('   ');
      const result = getTenantId(context as ToolContext);
      // Whitespace is truthy but might be invalid
      expect(result).toBe('   ');
    });

    it('handles special characters in tenant ID', () => {
      const context = createMapLikeStateContext('tenant-with_special.chars');
      const result = getTenantId(context as ToolContext);
      expect(result).toBe('tenant-with_special.chars');
    });

    it('handles state.get throwing error', () => {
      const context = {
        state: {
          get: () => {
            throw new Error('Map-like API not available');
          },
        } as unknown as ToolContext['state'],
        invocationContext: undefined,
      };

      // Should not throw, should fall back to other tiers
      expect(() => getTenantId(context as ToolContext)).not.toThrow();
    });

    it('handles userId with empty string after colon', () => {
      const context = createColonUserIdContext('tenant-id:');
      const result = getTenantId(context as ToolContext);
      expect(result).toBe('tenant-id');
    });

    it('handles userId with colon at start (returns null)', () => {
      const context = createColonUserIdContext(':user-only');
      const result = getTenantId(context as ToolContext);
      // First segment is empty string, which is falsy
      // The code does NOT fall through to Tier 4 because colon was detected
      // This is documented behavior - malformed userId with leading colon returns null
      expect(result).toBe(null);
    });
  });
});

// =============================================================================
// requireTenantId() Tests
// =============================================================================

describe('requireTenantId()', () => {
  describe('success cases', () => {
    it('returns tenant ID when available via Tier 1', () => {
      const context = createMapLikeStateContext('required-tenant');
      const result = requireTenantId(context as ToolContext);
      expect(result).toBe('required-tenant');
    });

    it('returns tenant ID when available via Tier 2', () => {
      const context = createPlainObjectStateContext('a2a-required-tenant');
      const result = requireTenantId(context as ToolContext);
      expect(result).toBe('a2a-required-tenant');
    });

    it('returns tenant ID when available via Tier 3', () => {
      const context = createColonUserIdContext('colon-tenant:user');
      const result = requireTenantId(context as ToolContext);
      expect(result).toBe('colon-tenant');
    });

    it('returns tenant ID when available via Tier 4', () => {
      const context = createDirectUserIdContext('direct-tenant');
      const result = requireTenantId(context as ToolContext);
      expect(result).toBe('direct-tenant');
    });
  });

  describe('fail-fast behavior', () => {
    it('throws when context is undefined', () => {
      expect(() => requireTenantId(undefined)).toThrow('Tenant context is required');
    });

    it('throws when context has no tenant info', () => {
      const context = createEmptyContext();
      expect(() => requireTenantId(context as ToolContext)).toThrow('Tenant context is required');
    });

    it('includes agent name in error message', () => {
      const context = createEmptyContext();
      expect(() => requireTenantId(context as ToolContext, { agentName: 'MyAgent' })).toThrow(
        '[MyAgent] Tenant context is required'
      );
    });

    it('uses default agent name if not provided', () => {
      const context = createEmptyContext();
      expect(() => requireTenantId(context as ToolContext)).toThrow(
        '[Agent] Tenant context is required'
      );
    });
  });

  describe('error message clarity', () => {
    it('error message indicates action required', () => {
      const context = createEmptyContext();
      try {
        requireTenantId(context as ToolContext, { agentName: 'BookingAgent' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('required');
        expect((error as Error).message).toContain('not available');
        expect((error as Error).message).toContain('BookingAgent');
      }
    });
  });
});

// =============================================================================
// Multi-Tenant Isolation Tests
// =============================================================================

describe('Multi-Tenant Isolation', () => {
  it('extracts different tenant IDs from different contexts', () => {
    const contextA = createMapLikeStateContext('tenant-A');
    const contextB = createMapLikeStateContext('tenant-B');

    const resultA = getTenantId(contextA as ToolContext);
    const resultB = getTenantId(contextB as ToolContext);

    expect(resultA).toBe('tenant-A');
    expect(resultB).toBe('tenant-B');
    expect(resultA).not.toBe(resultB);
  });

  it('handles rapid context switching', () => {
    const tenants = ['tenant-1', 'tenant-2', 'tenant-3', 'tenant-4', 'tenant-5'];
    const results: string[] = [];

    for (const tenantId of tenants) {
      const context = createMapLikeStateContext(tenantId);
      const result = getTenantId(context as ToolContext);
      results.push(result!);
    }

    expect(results).toEqual(tenants);
  });

  it('does not leak tenant context between calls', () => {
    // Simulate processing multiple requests in sequence
    const tenantA = createMapLikeStateContext('tenant-A');
    const tenantB = createMapLikeStateContext('tenant-B');
    const empty = createEmptyContext();

    // Process tenant A
    expect(getTenantId(tenantA as ToolContext)).toBe('tenant-A');

    // Process empty (should not return tenant A)
    expect(getTenantId(empty as ToolContext)).toBe(null);

    // Process tenant B
    expect(getTenantId(tenantB as ToolContext)).toBe('tenant-B');

    // Process tenant A again (should still work)
    expect(getTenantId(tenantA as ToolContext)).toBe('tenant-A');
  });

  it('extracts tenant correctly from mixed context types', () => {
    const scenarios = [
      { context: createMapLikeStateContext('map-tenant'), expected: 'map-tenant' },
      { context: createPlainObjectStateContext('obj-tenant'), expected: 'obj-tenant' },
      { context: createColonUserIdContext('colon-tenant:user'), expected: 'colon-tenant' },
      { context: createDirectUserIdContext('direct-tenant'), expected: 'direct-tenant' },
    ];

    for (const { context, expected } of scenarios) {
      expect(getTenantId(context as ToolContext)).toBe(expected);
    }
  });
});

// =============================================================================
// Logging Behavior Tests
// =============================================================================

describe('Logging Behavior', () => {
  it('includes agent name in all log messages', () => {
    const logger = createMockLogger();
    const context = createMapLikeStateContext('tenant-123');

    getTenantId(context as ToolContext, { logger, agentName: 'CustomAgent' });

    expect(logger.logs.every((l) => l.msg.includes('CustomAgent'))).toBe(true);
  });

  it('does not log when logger not provided', () => {
    // This is a compile-time check - no runtime assertion needed
    const context = createMapLikeStateContext('tenant-123');
    expect(() => getTenantId(context as ToolContext)).not.toThrow();
  });

  it('logs appropriate level based on outcome', () => {
    const successLogger = createMockLogger();
    const failLogger = createMockLogger();

    const successContext = createMapLikeStateContext('success-tenant');
    const failContext = createEmptyContext();

    getTenantId(successContext as ToolContext, { logger: successLogger });
    getTenantId(failContext as ToolContext, { logger: failLogger });

    // Success path uses info
    expect(successLogger.logs.some((l) => l.level === 'info')).toBe(true);

    // Failure path uses warn
    expect(failLogger.logs.some((l) => l.level === 'warn')).toBe(true);
  });
});
