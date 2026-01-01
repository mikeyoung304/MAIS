/**
 * Agent Orchestrator Types
 *
 * Branded types prevent sessionId/tenantId mixups at compile time.
 * Based on Kieran's TypeScript review feedback.
 */

// Branded types prevent ID mixups at compile time
export type SessionId = string & { readonly __brand: 'SessionId' };
export type TenantId = string & { readonly __brand: 'TenantId' };

export function toSessionId(id: string): SessionId {
  return id as SessionId;
}

export function toTenantId(id: string): TenantId {
  return id as TenantId;
}

// Shared agent type (used across all agent configs)
export type AgentType = 'onboarding' | 'customer' | 'admin';

// Per-tier recursion budgets (prevents T1 from starving T2/T3)
export interface TierBudgets {
  readonly T1: number; // Auto-confirm tools (metadata, reads)
  readonly T2: number; // Soft-confirm tools (writes)
  readonly T3: number; // Hard-confirm tools (bookings, money)
}

// Default budgets based on DoorDash "Budgeting the Loop" pattern
export const DEFAULT_TIER_BUDGETS: TierBudgets = {
  T1: 10, // Generous for metadata
  T2: 3, // Limited writes per turn
  T3: 1, // One booking at a time
} as const;

// Budget tracker interface with readonly properties
export interface BudgetTracker {
  readonly remaining: Readonly<TierBudgets>;
  readonly used: Readonly<TierBudgets>;

  consume(tier: keyof TierBudgets): boolean; // Returns false if exhausted
  reset(): void;
}

// Factory function for creating budget trackers
export function createBudgetTracker(initial: TierBudgets): BudgetTracker {
  let remaining = { ...initial };
  let used: TierBudgets = { T1: 0, T2: 0, T3: 0 };

  return {
    get remaining() {
      return { ...remaining } as const;
    },
    get used() {
      return { ...used } as const;
    },

    consume(tier: keyof TierBudgets): boolean {
      if (remaining[tier] <= 0) return false;
      remaining = { ...remaining, [tier]: remaining[tier] - 1 };
      used = { ...used, [tier]: used[tier] + 1 };
      return true;
    },

    reset(): void {
      remaining = { ...initial };
      used = { T1: 0, T2: 0, T3: 0 };
    },
  };
}

// Soft-confirm windows per agent type (in milliseconds)
export const SOFT_CONFIRM_WINDOWS: Record<AgentType, number> = {
  onboarding: 10 * 60 * 1000, // 10 minutes - thoughtful time
  customer: 2 * 60 * 1000, // 2 minutes - quick responses
  admin: 5 * 60 * 1000, // 5 minutes - in between
} as const;
