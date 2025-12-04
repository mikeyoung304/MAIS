---
status: complete
priority: p2
issue_id: "078"
tags: [security, code-review, seed, production-safety]
dependencies: []
resolution: "Already fixed - Production guard exists at e2e.ts:19-26"
completed_date: "2025-11-30"
---

# P2: E2E Seed Lacks Production Environment Guard

## Problem Statement

The E2E seed uses fixed, predictable API keys that are **publicly visible in source code**. There's no runtime protection preventing `SEED_MODE=e2e` from running in a production environment.

**Why it matters:**
- If E2E seed accidentally runs in production, test keys are inserted
- Attackers knowing the repo can use `pk_live_mais-e2e_0000000000000000` to access production
- No enforcement of "never use in production" comment

## Findings

**Location:** `server/prisma/seeds/e2e.ts:11-15`

```typescript
// WARNING comment but no enforcement
const E2E_PUBLIC_KEY = 'pk_live_mais-e2e_0000000000000000';
const E2E_SECRET_KEY = 'sk_live_mais-e2e_00000000000000000000000000000000';
```

**Missing guard:**
```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error('E2E seed cannot run in production');
}
```

## Proposed Solutions

### Solution A: Add production environment guard (Recommended)
**Pros:** Simple, effective, explicit
**Cons:** None
**Effort:** Small (5 min)
**Risk:** None

```typescript
export async function seedE2E(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: E2E seed attempted in production environment!\n' +
      'E2E seeds with fixed keys are for testing only.\n' +
      'Use SEED_MODE=production for production environments.'
    );
  }
  // ... rest of seed
}
```

### Solution B: Use environment-based keys
**Pros:** Allows rotation, more secure
**Cons:** More complex setup
**Effort:** Medium (30 min)
**Risk:** Low

```typescript
const E2E_PUBLIC_KEY = process.env.E2E_PUBLIC_KEY || 'pk_test_local_0000';
const E2E_SECRET_KEY = process.env.E2E_SECRET_KEY || 'sk_test_local_0000';
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `server/prisma/seeds/e2e.ts`

## Acceptance Criteria

- [ ] Running `SEED_MODE=e2e NODE_ENV=production npm run db:seed` throws error
- [ ] Error message clearly explains why E2E seed is blocked
- [ ] E2E seed works normally in development/test environments

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-29 | Created from code review | Comments aren't enforcement |

## Resources

- **Code Review:** Seed system refactoring review
- **Seed:** `server/prisma/seeds/e2e.ts`
