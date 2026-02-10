---
status: pending
priority: p3
issue_id: '5263'
tags: [code-review, duplication, pr-44]
dependencies: []
---

# Consider extracting tenant lookup to middleware/helper

## Problem Statement

Every domain has 3-10 occurrences of identical tenant lookup pattern:

```typescript
const tenant = await tenantRepo.findById(tenantId);
if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
```

## Findings

- Pattern appears 3-10 times per domain file (6 domains = ~40 occurrences total)
- Identical structure in all cases
- Critical security check (tenant isolation)
- Current pattern is explicit and clear
- Extraction would add indirection

## Proposed Solutions

### Option 1: Shared middleware `resolveTenant()`

**Approach:** Create middleware that resolves tenant and attaches to `res.locals.tenant`

**Pros:**

- Eliminates ~40 repetitive checks
- Single source of truth

**Cons:**

- Adds magic/indirection
- Harder to trace for security audits
- Middleware ordering becomes critical

**Effort:** 2 hours

**Risk:** Medium (security-critical code)

### Option 2: Helper function `requireTenant()`

**Approach:** Create utility `const tenant = await requireTenant(tenantId, res);`

**Pros:**

- Reduces duplication
- Still explicit at call site
- Easier to trace than middleware

**Cons:**

- Still requires call in every route
- Less duplication reduction than middleware

**Effort:** 1 hour

**Risk:** Low

### Option 3: Keep current explicit pattern

**Approach:** Leave tenant lookup explicit in each route

**Pros:**

- Clear and explicit
- Easy to audit for security
- No magic/indirection
- Standard pattern for security-critical code

**Cons:**

- ~40 occurrences of same code

**Effort:** 0 minutes

**Risk:** None

## Recommended Action

**To be filled during triage.** Recommend Option 3 (keep explicit pattern) - explicit is better than implicit for tenant isolation.

## Technical Details

**Affected files:**

- All 6 domain route files (~40 total occurrences)
- Potential new file: `server/src/middleware/tenant.ts` or `server/src/lib/tenant-helpers.ts`

**Related components:**

- Tenant repository
- Authentication middleware
- All agent route handlers

## Resources

- **PR:** #44

## Acceptance Criteria

- [ ] Decision made: extract or keep explicit
- [ ] If extracted: all routes updated
- [ ] If extracted: security audit passes
- [ ] All tests pass

## Work Log

### 2026-02-09 - Initial Discovery

**By:** Claude Code

**Actions:**

- Identified during PR #44 code review
- Counted ~40 occurrences across 6 domains
- Evaluated extraction vs explicit pattern
- Noted security-critical nature of code

## Notes

- Low priority: current duplication is acceptable
- Explicit is better than implicit for security-critical code
- Tenant isolation must be obvious in code review
- Consider only if pattern becomes more complex
- Current duplication aids security audits
