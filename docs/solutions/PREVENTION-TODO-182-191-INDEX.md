---
title: Prevention Strategies Index - TODO Categories 182-191
category: prevention
tags: [index, 182-191, quick-links]
priority: P1
last_updated: 2025-12-03
---

# Prevention Strategies Index: TODO Categories 182-191

This index guides you to the right prevention strategy documents for TODOs 182-191 resolved in commit 14374f7.

---

## Quick Navigation

### Main Documents

| Document                                                                               | Audience              | Read Time | Purpose                                        |
| -------------------------------------------------------------------------------------- | --------------------- | --------- | ---------------------------------------------- |
| [PREVENTION-TODO-182-191-QUICK-REF.md](./PREVENTION-TODO-182-191-QUICK-REF.md)         | All engineers         | 5 min     | **START HERE** - Cheat sheet with code samples |
| [PREVENTION-TODO-182-191-COMPREHENSIVE.md](./PREVENTION-TODO-182-191-COMPREHENSIVE.md) | Tech leads, reviewers | 30 min    | Complete guide with checklist, ESLint, tests   |

---

## The 10 Categories

### 1. Information Disclosure Prevention (182)

**Don't expose version/environment in public endpoints**

- Quick Ref: [Section 1](./PREVENTION-TODO-182-191-QUICK-REF.md#1-information-disclosure-182)
- Full Guide: [Section 1](./PREVENTION-TODO-182-191-COMPREHENSIVE.md#1-information-disclosure-prevention-182)
- Key Pattern: Remove `npm_package_version`, `NODE_ENV` from unauthenticated responses
- Grep: `rg 'npm_package_version|NODE_ENV' server/src/routes`
- Test: `/metrics` endpoint shouldn't expose version or environment

---

### 2. Transaction Atomicity (183)

**Generate resources inside transactions, not before**

- Quick Ref: [Section 2](./PREVENTION-TODO-182-191-QUICK-REF.md#2-transaction-atomicity-183)
- Full Guide: [Section 2](./PREVENTION-TODO-182-191-COMPREHENSIVE.md#2-transaction-atomicity-183)
- Key Pattern: Move `crypto.randomBytes()` inside `prisma.$transaction()` callback
- Grep: `rg 'crypto\.randomBytes' server/src/prisma/seeds -B 5 | grep -v '\$transaction'`
- Test: Verify no orphaned secrets on transaction failure

---

### 3. Memory Leak - Event Systems (184)

**subscribe() must return unsubscribe function**

- Quick Ref: [Section 3](./PREVENTION-TODO-182-191-QUICK-REF.md#3-memory-leak---event-systems-184)
- Full Guide: [Section 3](./PREVENTION-TODO-182-191-COMPREHENSIVE.md#3-memory-leak-prevention---event-systems-184)
- Key Pattern: `return () => { handlers.splice(...); }` from subscribe
- Grep: `rg 'subscribe.*:\s*void' server/src`
- Test: Verify unsubscribe removes handler and prevents re-firing

---

### 4. Type DRY Principle (185)

**Derive types from Zod schemas, never duplicate**

- Quick Ref: [Section 4](./PREVENTION-TODO-182-191-QUICK-REF.md#4-type-dry-principle-185)
- Full Guide: [Section 4](./PREVENTION-TODO-182-191-COMPREHENSIVE.md#4-type-dry-principle-185)
- Key Pattern: `export type Status = z.infer<typeof Schema>['status']`
- Grep: `rg "export type \w+ = '[A-Z_]+'.*\|" client/src`
- Test: Verify compile error if contract changes

---

### 5. Exhaustiveness Checking (186)

**Default case must assign to never type**

- Quick Ref: [Section 5](./PREVENTION-TODO-182-191-QUICK-REF.md#5-exhaustiveness-checking-186)
- Full Guide: [Section 5](./PREVENTION-TODO-182-191-COMPREHENSIVE.md#5-exhaustiveness-checking-186)
- Key Pattern: `default: { const _: never = status; return fallback; }`
- Grep: `rg 'switch\s*\([^)]+status' client/src -A 30 | grep -v 'default:'`
- Test: TypeScript compile error on missing case

---

### 6. Documentation Requirements (187)

**Register all advisory lock IDs and magic numbers**

- Quick Ref: [Section 6](./PREVENTION-TODO-182-191-QUICK-REF.md#6-documentation-requirements-187)
- Full Guide: [Section 6](./PREVENTION-TODO-182-191-COMPREHENSIVE.md#6-documentation-requirements-187)
- Key Pattern: Create `docs/reference/ADVISORY_LOCKS.md` registry
- Grep: `rg 'advisoryLock.*=.*\d+' server/src`
- Test: Verify all lock IDs in registry, no duplicates

---

### 7. React Hook Cleanup (188)

**useRef with Promise/function needs cleanup effect**

- Quick Ref: [Section 7](./PREVENTION-TODO-182-191-QUICK-REF.md#7-react-hook-cleanup-188)
- Full Guide: [Section 7](./PREVENTION-TODO-182-191-COMPREHENSIVE.md#7-react-hook-cleanup-188)
- Key Pattern: `useEffect(() => { return () => { ref.current = null; }; }, [])`
- Grep: `rg 'useRef<.*Promise|Function' client/src -A 10 | grep -v 'useEffect'`
- Test: Promise resolves false on component unmount

---

### 8. Test Coverage - Infrastructure (189)

**Core/lib/adapters code needs dedicated unit tests**

- Quick Ref: [Section 8](./PREVENTION-TODO-182-191-QUICK-REF.md#8-test-coverage---infrastructure-189)
- Full Guide: [Section 8](./PREVENTION-TODO-182-191-COMPREHENSIVE.md#8-test-coverage---infrastructure-code-189)
- Key Pattern: `server/test/lib/` mirrors `server/src/lib/`
- Grep: `find server/test -name "*.ts" ! -exec grep -q "describe\|it(" {} \; -print`
- Test: Unit tests for error isolation, multiple handlers, cleanup

---

### 9. Observability - Transaction Logging (190)

**Log transaction start and completion with duration**

- Quick Ref: [Section 9](./PREVENTION-TODO-182-191-QUICK-REF.md#9-observability---transaction-logging-190)
- Full Guide: [Section 9](./PREVENTION-TODO-182-191-COMPREHENSIVE.md#9-observability---transaction-logging-190)
- Key Pattern: `logger.info()` before and after `prisma.$transaction()`
- Grep: `rg '\$transaction' server/src/prisma/seeds -A 2 | grep -v logger`
- Test: Verify start/completion logs, duration tracked

---

### 10. File Organization (191)

**File location must match file purpose**

- Quick Ref: [Section 10](./PREVENTION-TODO-182-191-QUICK-REF.md#10-file-organization-191)
- Full Guide: [Section 10](./PREVENTION-TODO-182-191-COMPREHENSIVE.md#10-file-organization-191)
- Key Pattern: Tests in `test/`, docs in `docs/`, examples in `docs/examples/`
- Grep: `find server/test -name "*.ts" -exec grep -l "Example\|Documentation" {} \;`
- Test: Documentation files should be in docs/, not test/

---

## By Use Case

### "I'm doing a code review"

1. Open [QUICK-REF.md](./PREVENTION-TODO-182-191-QUICK-REF.md)
2. Copy the code review checklist at the end
3. Check each category against the PR

### "I found a violation in my code"

1. Find your issue in the table above
2. Open Quick Ref section for that category
3. Copy the ✅ pattern and fix it
4. Grep command shows similar issues in codebase

### "I'm adding a new feature"

1. Which category does it relate to?
2. Read Quick Ref + Full Guide sections
3. Add tests from "Test Patterns"
4. Update code review checklist

### "I'm writing tests"

1. Open Full Guide for your category
2. Copy test pattern from "Test Patterns" section
3. Adapt to your code
4. Verify tests pass

---

## Implementation Checklist

- [ ] Read QUICK-REF.md (5 min)
- [ ] Read COMPREHENSIVE.md sections relevant to your work (30 min)
- [ ] Add checklist items to code review process
- [ ] Run grep commands on your PR before submitting
- [ ] Write tests following provided patterns
- [ ] Update documentation if rules apply to your code

---

## Metrics

All 10 categories resolved in commit **14374f7**:

- Date: 2025-12-03
- Files changed: 7
- Tests added/updated: Yes
- Documentation: Comprehensive

**Target:** Apply prevention strategies to all new code going forward

---

## Quick Links

- [Full Comprehensive Guide](./PREVENTION-TODO-182-191-COMPREHENSIVE.md)
- [Quick Reference (Print Me!)](./PREVENTION-TODO-182-191-QUICK-REF.md)
- [TODO Files (Resolved)](../../todos/)
- [Related: PREVENTION-QUICK-REFERENCE.md](./PREVENTION-QUICK-REFERENCE.md)
- [Related: PREVENTION-IMPLEMENTATION-ROADMAP.md](./PREVENTION-IMPLEMENTATION-ROADMAP.md)

---

**Created:** 2025-12-03
**Status:** Complete and Ready for Team Review
**Next Step:** Team training session
