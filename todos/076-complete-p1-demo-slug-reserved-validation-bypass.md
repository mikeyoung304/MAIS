---
status: complete
priority: p1
issue_id: "076"
tags: [data-integrity, code-review, seed, validation]
dependencies: []
---

# P1: Demo Seed Uses Reserved Slug 'demo'

## Problem Statement

The demo seed creates a tenant with slug `'demo'`, but `'demo'` is in the reserved slugs list in `apiKeyService.validateTenantSlug()`. Seeds bypass validation because they directly use Prisma, creating inconsistency between validation rules and actual data.

**Why it matters:**
- Runtime errors when trying to regenerate keys for demo tenant via API
- Inconsistency between validation rules and database state
- May cause issues with tenant signup if 'demo' slug is attempted

## Findings

**Location:** `server/prisma/seeds/demo.ts:14`

```typescript
const demoSlug = 'demo';  // RESERVED SLUG!
```

**Location:** `server/src/lib/api-key.service.ts:216-234`

```typescript
const reserved = [
  'api', 'admin', 'app', 'www', 'widget', 'cdn',
  'static', 'assets', 'public', 'private', 'internal',
  'system', 'test', 'staging', 'production', 'dev',
  'demo',  // ← Reserved!
];
```

**Issue:** Seeds bypass `apiKeyService.validateTenantSlug()` because they directly call `prisma.tenant.upsert()`.

## Proposed Solutions

### Solution A: Change demo slug to non-reserved value (Recommended)
**Pros:** Simple, maintains consistency
**Cons:** Breaking change for existing dev databases
**Effort:** Small (10 min)
**Risk:** Low

```typescript
const demoSlug = 'demo-tenant';  // or 'sample-business'
```

### Solution B: Remove 'demo' from reserved list
**Pros:** No seed changes needed
**Cons:** Allows users to create tenant with slug 'demo'
**Effort:** Small (5 min)
**Risk:** Medium (namespace pollution)

```typescript
const reserved = [
  'api', 'admin', 'app', 'www', 'widget', 'cdn',
  'static', 'assets', 'public', 'private', 'internal',
  'system', 'test', 'staging', 'production', 'dev',
  // 'demo' removed
];
```

### Solution C: Add validation bypass flag for seeds
**Pros:** Explicit, documented
**Cons:** More complex, risk of misuse
**Effort:** Medium (30 min)
**Risk:** Medium

```typescript
// api-key.service.ts
validateTenantSlug(slug: string, options?: { allowReserved?: boolean }) {
  if (!options?.allowReserved && reserved.includes(slug)) {
    throw new Error(...);
  }
}
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `server/prisma/seeds/demo.ts`
- Optionally: `server/src/lib/api-key.service.ts`

**Components:**
- Demo seed function
- API key service validation

**Database Changes:** May need to update existing demo tenant slug

## Acceptance Criteria

- [ ] Demo tenant slug is not in reserved list
- [ ] OR reserved list excludes 'demo'
- [ ] `apiKeyService.generateKeyPair('demo-tenant')` works without error
- [ ] Existing demo data migrated if slug changed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-29 | Created from code review | Seeds bypass validation - need consistency |

## Resources

- **Code Review:** Seed system refactoring review
- **Seed:** `server/prisma/seeds/demo.ts`
- **Validation:** `server/src/lib/api-key.service.ts`
