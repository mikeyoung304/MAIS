---
status: ready
priority: p2
issue_id: '5253'
tags: [code-review, data-integrity]
dependencies: []
---

# P2: Idempotency Key Allows NULL (Partial Protection)

## Problem Statement

The idempotency key is optional. In PostgreSQL, `NULL` values are not considered equal in unique constraints, so two messages with `idempotencyKey = NULL` can be inserted even if identical.

**Why it matters:** Network retries without idempotency keys could create duplicate messages.

## Findings

**File:** `server/prisma/schema.prisma:936`

```prisma
idempotencyKey String? @db.VarChar(64)  // Optional!

@@unique([sessionId, idempotencyKey])   // NULL excluded from unique constraint
```

**File:** `server/src/services/session/session.schemas.ts:63`

```typescript
idempotencyKey: z.string().max(64).optional(),  // Optional in schema too
```

## Proposed Solutions

### Option A: Make idempotency key required, generate server-side if not provided

**Pros:** Full idempotency protection
**Cons:** Migration needed for existing data
**Effort:** Medium
**Risk:** Low

```typescript
const idempotencyKey = input.idempotencyKey ?? `${sessionId}:${Date.now()}:${crypto.randomUUID()}`;
```

### Option B: Document that clients MUST provide idempotency keys

**Pros:** No code change
**Cons:** Relies on client behavior
**Effort:** Small
**Risk:** Medium

### Option C: Add server-side dedup window (hash content + timestamp)

**Pros:** Automatic protection
**Cons:** More complex
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A - Generate idempotency key server-side if not provided by client.

## Technical Details

**Affected files:**

- `server/src/services/session/session.repository.ts`
- `server/src/services/session/session.schemas.ts`

## Acceptance Criteria

- [ ] All messages have idempotency keys (generated if not provided)
- [ ] Duplicate messages are properly rejected
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [Idempotency Patterns](https://stripe.com/docs/api/idempotent_requests)
