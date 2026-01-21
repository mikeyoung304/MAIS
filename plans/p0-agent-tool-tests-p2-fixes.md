# P0: Agent Tool Unit Tests

## Overview

Add focused unit tests to the 3 untested agent tool files, prioritizing tenant isolation and critical paths over coverage metrics.

**Scope:** ~2,000 lines of test code
**Effort:** 3-4 days
**Priority:** P0

> **Note:** P2 type safety fixes (TS-3, TS-4, TS-5) moved to separate PR to ship smaller batches.

## Problem Statement

Three agent tool files have zero or minimal test coverage despite handling tenant data:

| Tool File           | Tools | Test Coverage | Priority   |
| ------------------- | ----- | ------------- | ---------- |
| `read-tools.ts`     | 16    | ❌ 0%         | HIGH       |
| `ui-tools.ts`       | 5     | ❌ 0%         | LOW (skip) |
| `customer-tools.ts` | 6     | ⚠️ 1/6        | HIGH       |

**What we're testing for:**

1. Tenant isolation — all queries include `tenantId` in WHERE clause
2. Happy path — tool returns expected data shape
3. Error handling — graceful failures for not-found/invalid input

## Implementation

### Phase 1: Read Tools (Day 1-2)

**File:** `server/test/agent/tools/read-tools.test.ts` (~800 LOC)

**Approach:** One test per tool for each of:

- Tenant isolation verification
- Happy path
- Primary error case

**16 tools, ~50 LOC average = ~800 LOC total**

```typescript
describe('get_tenant', () => {
  it('should filter by tenantId from context', async () => {
    // Verify WHERE clause includes tenantId
  });

  it('should return tenant profile on success', async () => {
    // Happy path
  });

  it('should handle tenant not found', async () => {
    // Error case
  });
});
```

**High-risk tools (extra attention):**

- `get_bookings` — date filtering + status enum
- `get_packages` — add-on includes
- `check_availability` — conflict detection

### Phase 2: Customer Tools Gap Fill (Day 2-3)

**File:** Expand `server/test/agent/customer/customer-tools.test.ts` (~600 LOC)

**Current state:** Only `confirm_proposal` tested (281 LOC)

**Add tests for 5 tools:**
| Tool | Trust Tier | Key Test |
|------|------------|----------|
| `get_services` | T1 | Category filtering |
| `browse_service_categories` | T1 | Segment list |
| `check_availability` | T1 | Date conflicts |
| `book_service` | T3 | Proposal creation |
| `get_business_info` | T1 | Hours/policies |

**Important:** Customer tools use `CustomerToolContext` (extends base):

```typescript
interface CustomerToolContext extends ToolContext {
  customerId: string | null;
  proposalService: ProposalService;
}
```

Mock setup must include `proposalService`:

```typescript
mockContext = {
  tenantId: 'tenant-123',
  sessionId: 'session-456',
  prisma: mockPrisma,
  customerId: null,
  proposalService: {
    createProposal: vi.fn().mockResolvedValue({ proposalId: 'prop-123' }),
  },
};
```

### Phase 3: Verify & Ship (Day 3-4)

```bash
# Run all new tests
npm test -- server/test/agent/tools/read-tools.test.ts
npm test -- server/test/agent/customer/customer-tools.test.ts

# Type check
npm run typecheck

# Full test suite
npm test
```

**Done when:**

- [x] All tests pass
- [x] Type check passes
- [x] Tenant isolation verified for all 21 tools

### UI Tools: Intentionally Skipped

Per reviewer feedback, `ui-tools.ts` contains trivial state updates (`navigate_to_page`, `toggle_panel`). These are low-risk and break obviously during manual testing. Not worth 400 LOC of tests.

## Test Pattern (Reference)

Use existing pattern from `write-tools.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock BEFORE imports
vi.mock('../../../src/lib/core/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { readTools } from '../../../src/agent/tools/read-tools';

describe('Read Tools', () => {
  let mockPrisma: MockPrismaClient;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      tenant: { findUnique: vi.fn() },
      package: { findMany: vi.fn() },
      booking: { findMany: vi.fn(), groupBy: vi.fn() },
    };
    mockContext = {
      tenantId: 'tenant-test-123',
      sessionId: 'session-456',
      prisma: mockPrisma as unknown as ToolContext['prisma'],
    };
  });

  describe('get_packages', () => {
    it('should filter by tenantId', async () => {
      const tool = readTools.find((t) => t.name === 'get_packages')!;
      mockPrisma.package.findMany.mockResolvedValue([]);

      await tool.execute(mockContext, {});

      expect(mockPrisma.package.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-test-123' }),
        })
      );
    });
  });
});
```

## Acceptance Criteria

- [x] `read-tools.test.ts` covers all 16 tools (tenant isolation + happy path)
- [x] `customer-tools.test.ts` covers all 6 tools
- [x] All tests pass
- [x] No new lint errors
- [ ] PR reviewed and merged

## What's NOT in Scope

- **P2 type safety fixes** — Separate PR (TS-3, TS-4, TS-5)
- **UI tools tests** — Low value, skipped
- **Coverage thresholds** — Focus on critical paths, not percentages
- **Documentation updates** — Test files are the documentation
- **ARCH-2 session isolation** — Documented as acceptable for MVP

## References

- Existing pattern: `server/test/agent/tools/write-tools.test.ts` (869 LOC)
- P0 TODO: `todos/5176-ready-p0-add-unit-tests-agent-tools.md`
- P2 tracking: `todos/pr-23-p2-fixes.md` (separate PR)

---

## Quick Start

```bash
# Create test file
touch server/test/agent/tools/read-tools.test.ts

# Run in watch mode during development
npm test -- --watch server/test/agent/tools/read-tools.test.ts

# Verify all pass
npm test -- server/test/agent/tools/
```
