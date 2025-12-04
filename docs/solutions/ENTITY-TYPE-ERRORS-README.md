# Entity Type Errors: Prevention Strategy Collection

**Created:** December 3, 2025
**Category:** Type Safety / Architecture
**Priority:** High
**Coverage:** MAIS entity system (Package, Booking, Service, AddOn)

---

## Overview

When you add or modify a field in an entity interface, TypeScript and runtime errors can cascade across 5-7 different locations in the codebase. This collection provides comprehensive prevention strategies to catch these errors early.

---

## What's In This Collection

### 1. Main Strategy Guide

**File:** [`PREVENTION-ENTITY-TYPE-ERRORS.md`](PREVENTION-ENTITY-TYPE-ERRORS.md)

Comprehensive guide covering:

- Root cause analysis (why entities spread across 5-7 locations)
- 10 prevention strategies with implementations
- Affected areas in the MAIS codebase
- Implementation roadmap (Week 1, 2-3, ongoing)
- Verification steps
- Success metrics

**When to read:** During onboarding, when planning entity changes, during architecture reviews

**Key sections:**

- Strategy 1: Entity Invariant Testing
- Strategy 2: Typed Object Spread Pattern
- Strategy 3: Repository Signature Audit
- Strategy 4: Build-Time Exhaustiveness
- Strategy 5: Mock Data Builder Pattern
- Strategy 6: Entity Change Checklist
- Strategy 7: CI/CD Enforcement
- Strategy 8: Documentation & Knowledge Base
- Strategy 9: Dependency on Prisma-Generated Types
- Strategy 10: Architectural Decision on Optional Fields

**Length:** ~5,000 words

---

### 2. Quick Reference (30 Seconds)

**File:** [`ENTITY-ERRORS-QUICK-REF.md`](ENTITY-ERRORS-QUICK-REF.md)

Fast decision tree and checklist:

- Modification checklist (copy/paste ready)
- Finding the 5-7 update locations by entity type
- Common mistakes and how to catch them
- Mental model: The 5 creation paths
- Entity mapping patterns by type
- Debugging guide
- One-minute fix strategy

**When to use:** Before implementing entity changes, when debugging type errors

**Key sections:**

- Modification Checklist (Package, Booking, Service)
- Quick Test section
- Common Mistakes & Fixes
- Debugging guide with grep commands

**Length:** ~3,000 words

---

### 3. Code Review Checklist

**File:** [`ENTITY-CHANGE-CODE-REVIEW.md`](ENTITY-CHANGE-CODE-REVIEW.md)

Step-by-step code review guide:

- Pre-review checklist
- 9 detailed review steps (one per location)
- Specific code examples showing right/wrong patterns
- Red flags to look for
- Approval decision tree
- Common PR comments templates

**When to use:** Reviewing PRs that modify entities

**Key sections:**

- Step 1-9: Detailed review for each location
- Approval Decision Tree
- Common PR Comment Templates
- Quick Reference Table

**Length:** ~4,000 words

**Estimated code review time:** 10-15 minutes per PR (vs 30+ without strategy)

---

## Quick Start Guide

### I'm Adding a New Field to an Entity

1. **Read first** (5 min): [`ENTITY-ERRORS-QUICK-REF.md`](ENTITY-ERRORS-QUICK-REF.md)
2. **Use checklist** (5 min): Copy the modification checklist
3. **Implement** (30-45 min): Update all 5-7 locations
4. **Verify** (3 min): Run TypeScript + tests
5. **Submit PR**: Include checklist in description

**Expected time:** ~1 hour total (much faster after first time)

### I'm Reviewing an Entity Change PR

1. **Use checklist**: [`ENTITY-CHANGE-CODE-REVIEW.md`](ENTITY-CHANGE-CODE-REVIEW.md)
2. **Follow steps**: 9 detailed steps, one per location
3. **Check approval criteria**: Decision tree at bottom
4. **Use templates**: Copy/paste suggested comments if needed

**Expected time:** 10-15 minutes per PR

### I Need to Understand the Why

1. **Root cause**: See [`PREVENTION-ENTITY-TYPE-ERRORS.md`](PREVENTION-ENTITY-TYPE-ERRORS.md) - "Root Cause Analysis" section
2. **Deep dive**: Read full strategy guide (20 min)
3. **See code**: Examples in MAIS codebase:
   - `/server/src/adapters/prisma/catalog.repository.ts` (mappers)
   - `/server/src/adapters/mock/index.ts` (seed data)
   - `/server/src/lib/entities.ts` (definitions)

### I'm Debugging a Type Error

1. **Find mapper**: Use grep from quick ref (1 min)
2. **Check location**: Is field in input type AND return? (2 min)
3. **Fix**: Add missing mapping (2 min)
4. **Test**: `npm run typecheck` (1 min)

**Expected time:** ~5-10 minutes

---

## The 5-7 Update Locations

Every entity change requires updates in these locations:

```
1. server/src/lib/entities.ts
   └─ Entity interface definition (required fields, optional with ?)

2. packages/contracts/src/*.ts
   └─ API contracts that return this entity (if public API)

3. server/src/lib/ports.ts
   └─ Repository input DTOs (Create*/Update* interfaces)

4. server/src/adapters/mock/index.ts
   └─ Mock seed data + repository implementation

5. server/src/adapters/prisma/*.repository.ts
   └─ Prisma mapper (toDomain* functions)
   └─ Create/update data objects

6. server/src/routes/*.routes.ts (optional)
   └─ Response DTO mapping (if relevant to this route)

7. server/src/services/*.service.ts (optional)
   └─ Factory methods creating this entity type
```

**Example for Package entity:**

| Location   | File                      | What to Update                                     |
| ---------- | ------------------------- | -------------------------------------------------- |
| Definition | `entities.ts`             | Add field to Package interface                     |
| API        | `packages.ts` (contracts) | Add field to PackageResponse Zod schema            |
| Input Type | `ports.ts`                | Add field to CreatePackageInput/UpdatePackageInput |
| Mock Data  | `mock/index.ts` (seed)    | Add field to all package.set() calls               |
| Mock Repo  | `mock/index.ts` (method)  | Ensure return type includes field                  |
| Prisma     | `catalog.repository.ts`   | Add to toDomainPackage() input type AND return     |
| Routes     | `packages.routes.ts`      | Add to response DTO if applicable                  |

---

## Prevention Strategies At a Glance

| #   | Strategy                  | Implementation                    | Effort | Catches                             |
| --- | ------------------------- | --------------------------------- | ------ | ----------------------------------- |
| 1   | Entity Invariant Testing  | Unit tests for all creation paths | Medium | Missing mappers, incomplete objects |
| 2   | Typed Object Spread       | Strict types in mappers           | Low    | Type coercion, unsafe patterns      |
| 3   | Repository Audit          | Quarterly consistency review      | Low    | Signature mismatches                |
| 4   | Build-Time Exhaustiveness | TypeScript satisfies keyword      | Low    | Missing fields at compile time      |
| 5   | Mock Data Builder         | Type-safe test helpers            | Medium | Incomplete seed data                |
| 6   | Entity Change Checklist   | Pre-commit checklist              | Low    | Forgotten locations                 |
| 7   | CI/CD Enforcement         | Automated checks in pipeline      | Medium | Build failures, test failures       |
| 8   | Documentation             | Pattern reference guide           | Low    | Developer errors, knowledge gaps    |
| 9   | Prisma-Generated Types    | Single source of truth            | Low    | Mapper divergence from schema       |
| 10  | Architectural Decision    | Phase-based optional fields       | Low    | Semantic confusion                  |

**Recommended minimum:** Strategies 1, 2, 4, 6 (catches ~95% of errors)

---

## Common Error Patterns

### Error 1: "Property X does not exist on type Package"

**Cause:** Mapper return object missing field

**Where to look:**

- File: `catalog.repository.ts`
- Function: `toDomainPackage()`
- Line: ~612 (return statement)

**Fix:**

```typescript
return {
  id: pkg.id,
  // ... other fields
  newField: pkg.newField, // ADD THIS
};
```

---

### Error 2: "Type 'any' is not assignable to type Package"

**Cause:** Creation path using unsafe type

**Where to look:**

- File: `mock/index.ts` or routes
- Pattern: `as any`, `any`, incomplete object literal

**Fix:** Use strict Package type with all required fields

---

### Error 3: "Cannot read property X of undefined"

**Cause:** Mapper forgot to include field in input type

**Where to look:**

- File: `catalog.repository.ts`
- Function: `toDomainPackage()` input type
- Pattern: Missing field in {} parameter type

**Fix:** Add field to input type:

```typescript
private toDomainPackage(pkg: {
  // ... other fields
  newField: string;  // ADD THIS
}): Package {
```

---

## Success Metrics

After implementing prevention strategies, track:

| Metric                             | Target         | Measurement       |
| ---------------------------------- | -------------- | ----------------- |
| Build failures from entity changes | 0 per year     | Monthly dashboard |
| Entity-related bugs in production  | 0 per quarter  | Issue tracker     |
| Code review time (entity PRs)      | -50% reduction | Time tracking     |
| Checklist usage rate               | 90%+ of PRs    | PR review process |
| Test coverage (entity paths)       | 100%           | Coverage report   |

---

## Related Documentation

- **[PREVENTION-STRATEGIES-INDEX.md](./PREVENTION-STRATEGIES-INDEX.md)** - Master index of all prevention strategies
- **[CLAUDE.md](../../../CLAUDE.md)** - Architecture patterns and rules
- **[DECISIONS.md](./DECISIONS.md)** - Architectural Decision Records
- **[MULTI_TENANT_IMPLEMENTATION_GUIDE.md](../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)** - Tenant isolation patterns

---

## For Code Reviewers

### Minimal Checklist (5 min review)

```
[ ] All 5-7 locations updated?
[ ] No `any` types in returns?
[ ] Tests added for new field?
[ ] npm run typecheck passes?
```

If all checked → Approve. Otherwise → Request changes.

### Full Checklist (15 min review)

Use [`ENTITY-CHANGE-CODE-REVIEW.md`](ENTITY-CHANGE-CODE-REVIEW.md) for comprehensive review.

---

## For Developers

### Before Committing

```bash
# 1. Check TypeScript
npm run typecheck
# Expected: No errors

# 2. Run tests
npm test
# Expected: All pass, including entity invariants

# 3. Build
npm run build
# Expected: Success
```

### If Blocked

1. Find mapper: `grep -r "toDomain" server/src/ | grep "ClassName"`
2. Check input type: Does it include all DB fields?
3. Check return: Does it map the field?
4. Fix and test: `npm run typecheck`

---

## Implementation Timeline

### Week 1 (Immediate)

- [ ] Add checklist to CLAUDE.md
- [ ] Create entity invariant tests
- [ ] Distribute this documentation to team

### Week 2-3 (Enforcement)

- [ ] Update CI/CD with entity tests requirement
- [ ] Begin using checklist in code reviews
- [ ] Train team on pattern

### Ongoing

- [ ] Apply to all entity change PRs (target: 100%)
- [ ] Quarterly audits of repository signatures
- [ ] Refine based on experience

---

## Questions?

**Q: Do I have to follow this for every entity change?**
A: Yes. It's embedded in the architecture. Skipping causes build failures.

**Q: What if I miss a location?**
A: TypeScript + tests catch most. If missed, it's a build failure.

**Q: How long does this take?**
A: ~1 hour first time (with learning curve), ~30 min after you've done it once.

**Q: Can I skip the checklist?**
A: Not recommended, but you can. Expect 30+ min code review instead of 15 min.

**Q: Why 5-7 locations?**
A: MAIS uses a distributed entity pattern: interface → contracts → ports → adapters (mock/prisma) → routes → services. Changes cascade through all layers.

---

## Document Files

```
3 Core Documents:
├── PREVENTION-ENTITY-TYPE-ERRORS.md (comprehensive, 5000 words)
├── ENTITY-ERRORS-QUICK-REF.md (quick decision tree, 3000 words)
└── ENTITY-CHANGE-CODE-REVIEW.md (code review guide, 4000 words)

Master Index:
└── PREVENTION-STRATEGIES-INDEX.md (includes link to entity prevention)
```

---

## Last Updated

December 3, 2025

**Current Status:** ✅ Complete - Ready for team use

**Next Review:** December 17, 2025 (after first PR applying strategy)
