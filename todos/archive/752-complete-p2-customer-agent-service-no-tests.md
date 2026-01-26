# CustomerAgentService Has No Unit Tests

## Metadata

- **ID:** 752
- **Status:** deferred
- **Priority:** p2
- **Tags:** code-review, testing, customer-critical
- **Created:** 2026-01-26
- **Source:** Legacy Agent Migration Review

## Problem Statement

The new `CustomerAgentService` (735 lines) was created during the legacy agent migration but has **ZERO unit tests**. This service handles customer booking chat - a revenue-critical flow.

**Impact:**

- No regression protection for customer-facing feature
- No validation of error handling paths
- No verification of multi-tenant isolation
- Difficult to refactor safely

## Findings

**Test Coverage Analyst finding:**

The service (`server/src/services/customer-agent.service.ts`) includes:

| Method                   | Lines | Complexity | Test Coverage |
| ------------------------ | ----- | ---------- | ------------- |
| `getGreeting()`          | ~40   | Low        | None          |
| `chat()`                 | ~170  | High       | None          |
| `getSession()`           | ~30   | Low        | None          |
| `extractAgentResponse()` | ~60   | Medium     | None          |
| `extractToolCalls()`     | ~40   | Medium     | None          |
| `getIdentityToken()`     | ~50   | Medium     | None          |
| Private helpers          | ~150  | Various    | None          |

**Critical paths needing tests:**

1. Session creation with ADK (lines 191-256)
2. AI quota enforcement (lines 294-315)
3. ADK response parsing
4. Timeout handling
5. Retry logic with new ADK session
6. Multi-tenant isolation

**Existing E2E coverage:** 1 file (`e2e/tests/customer-chatbot-mcp.spec.ts`, 165 lines) - covers happy path only.

## Proposed Solutions

### Option 1: Add comprehensive unit tests (Recommended)

Create `server/test/services/customer-agent.service.test.ts` with:

- Mock ADK responses
- Test all public methods
- Test error paths
- Test quota enforcement

**Pros:** Full coverage, enables safe refactoring
**Cons:** Time investment
**Effort:** Large (4-6 hours)
**Risk:** None

### Option 2: Add critical path tests only

Test only:

- `chat()` happy path
- Multi-tenant isolation
- Quota enforcement

**Pros:** Covers most important paths
**Cons:** Incomplete coverage
**Effort:** Medium (2-3 hours)
**Risk:** Low

### Option 3: Accept E2E coverage as sufficient

Rely on existing E2E test for customer chatbot.

**Pros:** No work required
**Cons:** E2E is slow, doesn't test error paths
**Effort:** None
**Risk:** Medium

## Technical Details

**New test file location:**
`server/test/services/customer-agent.service.test.ts`

**Dependencies to mock:**

- `SessionService`
- `fetch` (for ADK calls)
- `GoogleAuth` (for identity tokens)
- `PrismaClient` (for tenant lookup)

**Example test structure:**

```typescript
describe('CustomerAgentService', () => {
  describe('chat', () => {
    it('should enforce AI quota limits', async () => {
      // Setup tenant at quota limit
      // Attempt to send message
      // Verify quota error returned
    });

    it('should scope sessions by tenantId', async () => {
      // Create sessions for tenant A and B
      // Verify tenant A cannot access tenant B session
    });
  });
});
```

## Acceptance Criteria

- [ ] Unit tests created for `CustomerAgentService`
- [ ] Coverage >80% for critical methods
- [ ] Tests run in CI pipeline
- [ ] Multi-tenant isolation verified

## Work Log

| Date       | Action                   | Learnings                   |
| ---------- | ------------------------ | --------------------------- |
| 2026-01-26 | Created from code review | Service created without TDD |

## Resources

- Service: `server/src/services/customer-agent.service.ts`
- Similar tests: `server/test/services/*.test.ts`
- E2E: `e2e/tests/customer-chatbot-mcp.spec.ts`
