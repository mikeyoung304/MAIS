---
status: complete
priority: p2
issue_id: "079"
tags: [dx, code-review, seed, developer-experience]
dependencies: []
completed_at: 2025-12-02
---

# P2: Demo Seed Regenerates API Keys on Every Run

## Problem Statement

The demo seed generates **random API keys on every run**, breaking existing integrations. Developers must update their `.env` files after each seed run.

**Why it matters:**
- Running `db:seed:dev` breaks existing local setup
- Frontend widgets stop working after re-seeding
- Poor developer experience ("why did my API key stop working?")
- Inconsistent with E2E seed (which uses fixed keys)

## Findings

**Location:** `server/prisma/seeds/demo.ts:13-16, 22-24`

```typescript
// Random keys generated each time
const demoPublicKey = `pk_live_demo_${crypto.randomBytes(8).toString('hex')}`;
const demoSecretKey = `sk_live_demo_${crypto.randomBytes(16).toString('hex')}`;

// Always updates keys in upsert
update: {
  apiKeyPublic: demoPublicKey,
  apiKeySecret: apiKeyService.hashSecretKey(demoSecretKey),
},
```

**Warning exists but doesn't prevent issue:**
```typescript
console.log(`   ⚠️  Save these keys - they change on each seed!`);
```

## Proposed Solutions

### Solution A: Fixed demo keys (Recommended for local dev)
**Pros:** Consistent local development, no key updates needed
**Cons:** Less secure (keys in source)
**Effort:** Small (10 min)
**Risk:** Low (demo data only)

```typescript
const DEMO_PUBLIC_KEY = 'pk_live_demo-tenant_dev_fixed_0000';
const DEMO_SECRET_KEY = 'sk_live_demo-tenant_dev_fixed_000000';
```

### Solution B: Only create, never update keys
**Pros:** Preserves existing keys
**Cons:** First run still needs key capture
**Effort:** Small (15 min)
**Risk:** Low

```typescript
const existing = await prisma.tenant.findUnique({ where: { slug: demoSlug } });

if (existing) {
  console.log('ℹ️  Demo tenant exists - keeping existing keys');
  return;
}

// Create with random keys only on first seed
```

### Solution C: Store keys in .env.local
**Pros:** Most flexible
**Cons:** More complex setup
**Effort:** Medium (30 min)
**Risk:** Low

Generate keys and save to `.env.local` automatically.

## Recommended Action

**Implemented Solution B** - Only create keys on first run, preserve on subsequent seeds.

The demo seed now:
1. Checks if demo tenant exists before creating
2. If exists: Updates tenant fields but preserves API keys
3. If new: Generates random API keys and logs them with warning
4. All operations fully idempotent with comprehensive test coverage

## Technical Details

**Affected Files:**
- `server/prisma/seeds/demo.ts`

## Acceptance Criteria

- [x] Running `db:seed:dev` twice does not invalidate existing API keys
- [x] Frontend widgets continue working after re-seed
- [x] Clear documentation on key behavior
- [x] Comprehensive test coverage (25 passing tests)
- [x] Logs clearly indicate key preservation vs creation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-29 | Created from code review | E2E uses fixed keys, demo should too |
| 2025-12-02 | **COMPLETED** - Verified implementation | Issue was already resolved - seed uses findUnique + create/update pattern |
| 2025-12-02 | Fixed test suite | Updated idempotency test to match actual implementation (create/update, not upsert) |

## Resources

- **Code Review:** Seed system refactoring review
- **Seed:** `server/prisma/seeds/demo.ts`
