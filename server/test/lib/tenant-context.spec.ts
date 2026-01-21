/**
 * Unit tests for shared tenant context utilities
 *
 * Tests the 4-tier defensive pattern for tenant ID extraction
 * used across all agent-v2 deployed agents.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTenantId, requireTenantId } from '../../src/agent-v2/shared/tenant-context';
import type { ToolContext } from '@google/adk';

describe('tenant-context utilities', () => {
  // Mock logger for testing log output
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTenantId', () => {
    it('returns null when context is undefined', () => {
      const result = getTenantId(undefined);
      expect(result).toBeNull();
    });

    it('returns null when context has no state or session', () => {
      const context = {} as ToolContext;
      const result = getTenantId(context);
      expect(result).toBeNull();
    });

    describe('Tier 1: state.get() Map-like API', () => {
      it('extracts tenantId from state.get() (direct ADK calls)', () => {
        const context = {
          state: {
            get: vi.fn().mockReturnValue('tenant_123'),
          },
        } as unknown as ToolContext;

        const result = getTenantId(context, { logger: mockLogger, agentName: 'TestAgent' });

        expect(result).toBe('tenant_123');
        expect(context.state?.get).toHaveBeenCalledWith('tenantId');
        expect(mockLogger.info).toHaveBeenCalledWith({}, expect.stringContaining('state.get()'));
      });

      it('continues to next tier when state.get() returns null', () => {
        const context = {
          state: {
            get: vi.fn().mockReturnValue(null),
            tenantId: 'tenant_456',
          },
        } as unknown as ToolContext;

        const result = getTenantId(context, { logger: mockLogger });

        expect(result).toBe('tenant_456');
      });

      it('continues to next tier when state.get() throws', () => {
        const context = {
          state: {
            get: vi.fn().mockImplementation(() => {
              throw new Error('Not a Map');
            }),
            tenantId: 'tenant_789',
          },
        } as unknown as ToolContext;

        const result = getTenantId(context, { logger: mockLogger });

        expect(result).toBe('tenant_789');
        expect(mockLogger.info).toHaveBeenCalledWith(
          {},
          expect.stringContaining('state.get() failed')
        );
      });
    });

    describe('Tier 2: Plain object state access (A2A protocol)', () => {
      it('extracts tenantId from state object property', () => {
        const context = {
          state: {
            tenantId: 'tenant_a2a',
          },
        } as unknown as ToolContext;

        const result = getTenantId(context, { logger: mockLogger, agentName: 'Concierge' });

        expect(result).toBe('tenant_a2a');
        expect(mockLogger.info).toHaveBeenCalledWith({}, expect.stringContaining('state object'));
      });

      it('ignores empty string tenantId in state object', () => {
        const context = {
          state: {
            tenantId: '',
          },
          invocationContext: {
            session: {
              userId: 'fallback_tenant',
            },
          },
        } as unknown as ToolContext;

        const result = getTenantId(context);

        expect(result).toBe('fallback_tenant');
      });
    });

    describe('Tier 3: userId with colon format (MAIS multi-tenant)', () => {
      it('extracts tenantId from userId in format "tenantId:userId"', () => {
        const context = {
          invocationContext: {
            session: {
              userId: 'tenant_mais:user_123',
            },
          },
        } as unknown as ToolContext;

        const result = getTenantId(context, { logger: mockLogger });

        expect(result).toBe('tenant_mais');
        expect(mockLogger.info).toHaveBeenCalledWith({}, expect.stringContaining('colon format'));
      });

      it('handles multiple colons by taking first segment', () => {
        const context = {
          invocationContext: {
            session: {
              userId: 'tenant:user:extra:data',
            },
          },
        } as unknown as ToolContext;

        const result = getTenantId(context);

        expect(result).toBe('tenant');
      });

      it('handles edge case of empty first segment', () => {
        const context = {
          invocationContext: {
            session: {
              userId: ':user_only',
            },
          },
        } as unknown as ToolContext;

        // Empty first segment returns null (falsy check)
        const result = getTenantId(context);

        expect(result).toBeNull();
      });
    });

    describe('Tier 4: userId as direct tenant ID (fallback)', () => {
      it('uses userId directly when no colon present', () => {
        const context = {
          invocationContext: {
            session: {
              userId: 'direct_tenant_id',
            },
          },
        } as unknown as ToolContext;

        const result = getTenantId(context, { logger: mockLogger });

        expect(result).toBe('direct_tenant_id');
        expect(mockLogger.info).toHaveBeenCalledWith(
          {},
          expect.stringContaining('Using userId as tenantId')
        );
      });
    });

    describe('logging behavior', () => {
      it('logs warning when no tenantId found', () => {
        const context = {} as ToolContext;

        getTenantId(context, { logger: mockLogger, agentName: 'Marketing' });

        expect(mockLogger.warn).toHaveBeenCalledWith(
          {},
          expect.stringContaining('Could not extract tenantId')
        );
      });

      it('uses default agent name when not provided', () => {
        const context = {} as ToolContext;

        getTenantId(context, { logger: mockLogger });

        expect(mockLogger.warn).toHaveBeenCalledWith({}, expect.stringContaining('[Agent]'));
      });

      it('works without logger (no errors thrown)', () => {
        const context = {} as ToolContext;

        expect(() => getTenantId(context)).not.toThrow();
        expect(getTenantId(context)).toBeNull();
      });
    });

    describe('priority order', () => {
      it('prefers state.get() over state object property', () => {
        const context = {
          state: {
            get: vi.fn().mockReturnValue('from_get'),
            tenantId: 'from_property',
          },
          invocationContext: {
            session: {
              userId: 'from_userId',
            },
          },
        } as unknown as ToolContext;

        const result = getTenantId(context);

        expect(result).toBe('from_get');
      });

      it('prefers state object over userId', () => {
        const context = {
          state: {
            get: vi.fn().mockReturnValue(null),
            tenantId: 'from_property',
          },
          invocationContext: {
            session: {
              userId: 'from_userId',
            },
          },
        } as unknown as ToolContext;

        const result = getTenantId(context);

        expect(result).toBe('from_property');
      });
    });
  });

  describe('requireTenantId', () => {
    it('returns tenantId when available', () => {
      const context = {
        state: {
          get: vi.fn().mockReturnValue('tenant_required'),
        },
      } as unknown as ToolContext;

      const result = requireTenantId(context);

      expect(result).toBe('tenant_required');
    });

    it('throws when tenantId not available', () => {
      const context = {} as ToolContext;

      expect(() => requireTenantId(context)).toThrow(
        'Tenant context is required but not available'
      );
    });

    it('includes agent name in error message', () => {
      const context = {} as ToolContext;

      expect(() => requireTenantId(context, { agentName: 'Booking' })).toThrow(
        '[Booking] Tenant context is required'
      );
    });

    it('uses default agent name when not provided', () => {
      const context = {} as ToolContext;

      expect(() => requireTenantId(context)).toThrow('[Agent]');
    });

    it('passes logger through to getTenantId', () => {
      const context = {
        state: {
          get: vi.fn().mockReturnValue('tenant_with_logger'),
        },
      } as unknown as ToolContext;

      requireTenantId(context, { logger: mockLogger, agentName: 'Test' });

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });
});
