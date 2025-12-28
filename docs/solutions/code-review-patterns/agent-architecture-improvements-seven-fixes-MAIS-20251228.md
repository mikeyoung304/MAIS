---
title: Agent Tools Architecture Improvements - Seven Issues Fixed
category: code-review-patterns
tags:
  - agent
  - performance
  - type-safety
  - code-quality
  - architecture
  - database-indexing
  - error-handling
  - pagination
  - dry
severity: P1
created: 2025-12-28
related_files:
  - server/src/agent/tools/utils.ts
  - server/src/agent/tools/read-tools.ts
  - server/src/agent/tools/write-tools.ts
  - server/src/agent/proposals/proposal.service.ts
  - server/prisma/schema.prisma
todo_references:
  - 451-complete-p1-agent-unbounded-queries.md
  - 452-complete-p2-agent-duplicate-blackout-tools.md
  - 453-complete-p2-agent-type-safety-any-casts.md
  - 454-complete-p2-agent-t2-soft-confirm-timing.md
  - 455-complete-p2-agent-dry-error-handling.md
  - 456-complete-p2-agent-missing-database-index.md
  - 457-complete-p3-agent-check-availability-parallel.md
---

# Agent Tools Architecture Improvements - Seven Issues Fixed

## Problem Statement

The agent tools architecture accumulated seven interconnected technical debt issues during rapid feature development:

1. **P1: Unbounded queries** causing potential token bloat in LLM context
2. **P2: Duplicate blackout tools** creating LLM decision paralysis
3. **P2: Type safety bypassed** with `as any` casts risking runtime errors
4. **P2: T2 soft-confirm timing** window too long, allowing stale confirmations
5. **P2: DRY violations** with 36+ repeated error handling patterns
6. **P2: Missing database index** on revenue queries causing slow reports
7. **P3: Sequential queries** in `check_availability` instead of parallel

## Root Cause Analysis

Root cause was **insufficient code review discipline during rapid agent feature development** combined with missing utility layer abstractions. Specifically:

- No pagination limits were established when creating list tools
- Duplicate tools emerged from different PRs without consolidation review
- Type casts used to "make it work" rather than proper type guards
- Temporal constraints not considered for approval mechanisms
- No DRY helpers extracted when patterns emerged
- Performance indexes not added proactively

## Solution Implementation

### 1. Created Centralized Utility Layer (`utils.ts`)

New file: `server/src/agent/tools/utils.ts`

```typescript
/**
 * Agent Tool Utilities - DRY helpers for consistent patterns
 */

import { logger } from '../../lib/core/logger';
import type { ToolError } from './types';

/**
 * Handle tool errors consistently across all tools
 */
export function handleToolError(
  error: unknown,
  toolName: string,
  tenantId: string,
  helpText: string
): ToolError {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error({ error, tenantId }, `Error in ${toolName} tool`);
  return {
    success: false,
    error: `${helpText}: ${errorMessage}`,
    code: `${toolName.toUpperCase().replace(/-/g, '_')}_ERROR`,
  };
}

/**
 * Build a date range filter for Prisma queries
 */
export function buildDateRangeFilter(
  fromDate?: string,
  toDate?: string
): { date?: { gte?: Date; lte?: Date } } {
  if (!fromDate && !toDate) return {};
  return {
    date: {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(toDate) } : {}),
    },
  };
}

/**
 * Format price in cents to display string
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format a Date to ISO date string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

**Impact:** Reduces 36+ inline patterns to 4 reusable functions.

### 2. Added Pagination Limits to Unbounded Queries

In `server/src/agent/tools/read-tools.ts`:

```typescript
// Before (unbounded - could return 10,000+ records)
const bookings = await prisma.booking.findMany({
  where: { tenantId },
});

// After (bounded - maximum 100 records)
const bookings = await prisma.booking.findMany({
  where: { tenantId },
  take: 100, // Pagination limit
  orderBy: { createdAt: 'desc' },
});
```

**Pagination limits applied:**

- `list_bookings`: take: 100
- `list_packages`: take: 50
- `list_customers`: take: 100
- `list_add_ons`: take: 50
- `list_segments`: take: 25

**Impact:** Prevents context token bloat; keeps responses manageable for LLM.

### 3. Removed Duplicate Blackout Tools

In `read-tools.ts` and `write-tools.ts`:

```typescript
// Before: 5 overlapping blackout tools
export const readTools = [
  // ...
  getBlackoutsTool, // REMOVED - duplicate
  listBlackoutDatesTool, // Kept - canonical list tool
];

export const writeTools = [
  // ...
  manageBlackoutTool, // REMOVED - duplicate of add/remove
  addBlackoutDateTool, // Kept - single-purpose
  removeBlackoutDateTool, // Kept - single-purpose
];
```

**Impact:** Reduces LLM decision paralysis; clearer tool boundaries.

### 4. Added Type Guard for BookingStatus Validation

In `server/src/agent/tools/read-tools.ts`:

```typescript
import { BookingStatus, Prisma } from '../../generated/prisma';

/**
 * Type guard for validating BookingStatus strings
 */
function isValidBookingStatus(status: string): status is BookingStatus {
  return Object.values(BookingStatus).includes(status as BookingStatus);
}

// Usage in tool handler
if (status && !isValidBookingStatus(status)) {
  return {
    success: false,
    error: `Invalid status. Valid values: ${Object.values(BookingStatus).join(', ')}`,
    code: 'INVALID_STATUS',
  };
}

const where: Prisma.BookingWhereInput = {
  tenantId,
  ...(status ? { status } : {}), // Now type-safe
};
```

**Impact:** Replaces `as any` with runtime validation; catches invalid status at tool layer.

### 5. Added T2 Soft-Confirm Timing Window (2 minutes)

In `server/src/agent/proposals/proposal.service.ts`:

```typescript
/**
 * T2 soft-confirm window in milliseconds (2 minutes)
 * T2 proposals only auto-confirm if created within this window.
 * This prevents accidental confirmations when user changes topics.
 */
const T2_SOFT_CONFIRM_WINDOW_MS = 2 * 60 * 1000;

async softConfirmPendingT2(tenantId: string, sessionId: string): Promise<number> {
  const now = new Date();

  // Only confirm proposals created within the 2-minute window
  const softConfirmCutoff = new Date(now.getTime() - T2_SOFT_CONFIRM_WINDOW_MS);

  const proposals = await this.prisma.agentProposal.findMany({
    where: {
      tenantId,
      sessionId,
      status: 'PENDING',
      trustTier: 'T2',
      expiresAt: { gt: now },
      createdAt: { gte: softConfirmCutoff },  // Within 2-minute window
    },
  });

  // ... confirm matching proposals
}
```

**Impact:** Prevents stale proposal auto-confirmation; user must re-request if topic changes.

### 6. Added Database Index for Revenue Queries

In `server/prisma/schema.prisma`:

```prisma
model Booking {
  // ... fields ...

  @@index([tenantId, date])
  @@index([tenantId, createdAt, status])  // Added: Revenue queries (TODO-456)
}
```

**Impact:** Optimizes revenue report queries; prevents full table scans.

### 7. Parallelized check_availability Queries

In `server/src/agent/tools/read-tools.ts`:

```typescript
// Before (sequential - ~20ms total)
const existingBooking = await prisma.booking.findFirst({
  where: { tenantId, date, status: { notIn: ['CANCELED', 'REFUNDED'] } },
});
const blackout = await prisma.blackoutDate.findFirst({
  where: { tenantId, date },
});

// After (parallel - ~10ms total)
const [existingBooking, blackout] = await Promise.all([
  prisma.booking.findFirst({
    where: { tenantId, date, status: { notIn: ['CANCELED', 'REFUNDED'] } },
    select: { id: true, status: true },
  }),
  prisma.blackoutDate.findFirst({
    where: { tenantId, date },
    select: { reason: true },
  }),
]);
```

**Impact:** ~50% latency reduction for availability checks.

## Prevention Strategies

### For Future Agent Tool Development

1. **Always add pagination limits** to list operations:

   ```typescript
   // Required pattern for all list tools
   const results = await prisma.model.findMany({
     where: { tenantId, ...filters },
     take: 100, // REQUIRED: Prevent unbounded queries
     orderBy: { createdAt: 'desc' },
   });
   ```

2. **Use type guards instead of `as any`**:

   ```typescript
   // Wrong
   const status = input.status as BookingStatus;

   // Right
   if (!isValidBookingStatus(input.status)) {
     return { success: false, error: 'Invalid status' };
   }
   const status = input.status; // Now type-safe
   ```

3. **Extract repeated patterns immediately**:
   - If you write the same catch block twice, extract a helper
   - If you format prices/dates inline, use `formatPrice()`/`formatDateISO()`

4. **Consider temporal constraints** for approval mechanisms:
   - What happens if user changes topics?
   - Add time windows to prevent stale confirmations

5. **Add database indexes proactively**:
   - Before adding a new query pattern, check if it needs an index
   - Revenue, reporting, and date-range queries almost always need composite indexes

6. **Consolidate tools before shipping**:
   - Review existing tools before adding new ones
   - One tool per distinct operation (not one per UI button)

### Checklist for New Agent Tools

- [ ] List operations have `take` limit
- [ ] No `as any` casts (use type guards)
- [ ] Error handling uses `handleToolError()`
- [ ] Prices formatted with `formatPrice()`
- [ ] Dates formatted with `formatDateISO()`
- [ ] Independent queries use `Promise.all()`
- [ ] No duplicate functionality with existing tools
- [ ] Database indexes for new query patterns

## Related Documentation

- [Agent Design System Patterns](../agent-design/AGENT_DESIGN_SYSTEM_PATTERNS.md)
- [Agent Tool Addition Prevention](../agent-design/AGENT-TOOL-ADDITION-PREVENTION.md)
- [TypeScript Type Safety Prevention](../best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md)
- [MAIS Critical Patterns](../patterns/mais-critical-patterns.md)

## Testing Verification

All changes verified with:

```bash
cd server && npm test       # 771 tests passing
npm run typecheck           # No TypeScript errors
```

## Files Modified

| File                                             | Change                               |
| ------------------------------------------------ | ------------------------------------ |
| `server/src/agent/tools/utils.ts`                | NEW: DRY helpers                     |
| `server/src/agent/tools/read-tools.ts`           | Pagination, type guards, Promise.all |
| `server/src/agent/tools/write-tools.ts`          | Removed duplicate tools              |
| `server/src/agent/proposals/proposal.service.ts` | 2-minute T2 window                   |
| `server/prisma/schema.prisma`                    | Revenue query index                  |

## Lessons Learned

1. **Technical debt compounds faster in AI agent code** - LLM context bloat and decision paralysis amplify small inefficiencies
2. **Utility layers should be created early** - Extract helpers as soon as patterns emerge, not after 36 repetitions
3. **Temporal constraints matter for approval flows** - Users change topics; approval mechanisms must account for this
4. **Code review agents catch systematic issues** - Running 5 parallel review agents found patterns a single reviewer might miss
