---
title: Multi-Agent Code Review - Common Mistakes & Prevention
category: patterns
tags: [multi-agent-review, prevention-strategies, mistakes, pitfalls]
date_created: 2026-01-10
status: active
---

# Multi-Agent Code Review: Common Mistakes & Prevention

Learned from real code reviews and team experiences.

---

## Mistake 1: Incomplete Dimensional Coverage

### The Problem

Review focuses on one dimension (just TypeScript) and misses orthogonal issues.

**Example:**

```typescript
// TypeScript passed review ✓
// Performance failed review ✗ (N+1 query)
async function getCustomerBookings(customerId: string) {
  const bookings = await prisma.booking.findMany({
    where: { customerId },
  });

  // N+1 problem: Loop queries database
  for (const booking of bookings) {
    const customer = await prisma.customer.findUnique({
      where: { id: booking.customerId },
    });
    booking.customerName = customer.name;
  }

  return bookings;
}
```

TypeScript sees no errors. But Performance Oracle catches N+1 query pattern.

### Prevention

**Before merging, verify these agents ran:**

1. ✓ TypeScript/React (always)
2. ✓ Security Sentinel (if auth, input, external API)
3. ✓ Data Integrity Guardian (if database, check-then-act)
4. ✓ Performance Oracle (if queries, loops, caching)
5. ✓ Code Simplicity (always)
6. ✓ Architecture (if crossing layers)

**Use the dimensional coverage matrix:**

```
Database schema changes     → Include: Data Integrity ✓✓, Performance ✓✓
Authentication routes       → Include: Security ✓✓, TypeScript ✓
UI components              → Include: Simplicity ✓✓, TypeScript ✓
Payment processing         → Include: Security ✓✓, Data Integrity ✓✓
Booking/availability logic → Include: Data Integrity ✓✓, Performance ✓✓
```

**Verification:**

```bash
# Before merging, confirm all necessary agents ran
ls todos/*-pending-*.md | grep -c "TypeScript\|Security\|Data Integrity"
# Should see multiple agent perspectives
```

---

## Mistake 2: Skipping or Dismissing P1 Findings

### The Problem

P1 findings (security vulnerabilities, data corruption risks) get treated as "nice-to-have" or deferred.

**Real Example (Commit 5cd5bfb1):**

```typescript
// P1: TOCTOU Race Condition
const maxPerDay = 5;
const bookingCount = await prisma.booking.count({
  where: { tenantId, date: bookingDate }
});

// Race condition window: another request sneaks in here
if (bookingCount < maxPerDay) {
  await prisma.booking.create({
    data: { tenantId, date: bookingDate, ... }
  });
}
// Result: 6 bookings when max is 5!
```

This passed TypeScript review but Data Integrity Guardian flagged it as P1 (data corruption risk).

### Prevention

**P1 = Blocks Merge.** Full stop.

```markdown
## Before Merging Any Code

- [ ] No P1 findings OR all P1 findings fixed
- [ ] All P1 fixes verified (typecheck + tests)

If you see P1 findings:

1. FIX IT (don't defer)
2. Verify the fix
3. Then merge

"I'll fix it later" = WRONG
```

**Decision Tree:**

```
Is this a P1 finding?
├─ YES: STOP. Fix it now before merging.
│       Don't defer.
│       Don't merge with known P1s.
│
└─ NO: Can merge after P2s are handled
       P3s can wait for cleanup pass
```

---

## Mistake 3: Running Review on Incomplete Code

### The Problem

Code is half-finished, tests are failing, but you run multi-agent review anyway.

**Result:**

- Agents find false positives (things you were about to fix)
- Wasted time on findings that don't matter
- Distraction from actual implementation

### Prevention

**Checklist before running review:**

```bash
# 1. Code is complete (feature done, not in-progress)
git log -1 --format=%B | grep -i "wip\|draft\|incomplete"
# Should output nothing

# 2. Tests are passing
npm test
# All tests pass ✓

# 3. TypeScript is clean
npm run typecheck
# No errors ✓

# 4. Code is committed (not in working directory)
git status
# Should be clean (nothing uncommitted)

# 5. Branch is up-to-date with main
git merge-base --is-ancestor main HEAD
# Should succeed (HEAD includes main)
```

**Only THEN run review:**

```bash
/workflows:review latest
```

---

## Mistake 4: Merging With TypeScript Errors

### The Problem

Multi-agent review completes, fixes are verified locally, but typecheck fails on CI.

**Why it happens:**

- Committed changes don't include all file edits
- Built locally with different TypeScript version
- Working directory has edits not yet committed

### Prevention

**Verification script (copy-paste ready):**

```bash
#!/bin/bash
set -e

echo "=== Pre-Merge Verification ==="

# 1. Ensure working directory is clean
echo "1. Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Uncommitted changes detected"
  git status
  exit 1
fi

# 2. Run TypeScript check (all workspaces)
echo "2. Running TypeScript check..."
npm run typecheck
if [ $? -ne 0 ]; then
  echo "ERROR: TypeScript failed"
  exit 1
fi

# 3. Run tests
echo "3. Running tests..."
npm test
if [ $? -ne 0 ]; then
  echo "ERROR: Tests failed"
  exit 1
fi

# 4. Build check
echo "4. Building..."
npm run build
if [ $? -ne 0 ]; then
  echo "ERROR: Build failed"
  exit 1
fi

echo ""
echo "✓ All checks passed. Safe to merge."
```

**Use before every merge:**

```bash
./scripts/verify-before-merge.sh && git push
```

---

## Mistake 5: Not Grouping Related Fixes

### The Problem

Each finding becomes a separate agent task, leading to inefficiency.

**Bad approach:**

```bash
# 8 agents, each fixing one tiny thing
Task 'TODO-352: Remove unused import'
Task 'TODO-353: Add useMemo'
Task 'TODO-354: Add useCallback'
Task 'TODO-355: Memoize selector'
Task 'TODO-356: Remove console.log'
Task 'TODO-357: Fix typo'
Task 'TODO-358: Add missing type'
Task 'TODO-359: Extract constant'
```

8 agents, 8-minute resolution, resource waste.

### Prevention

**Group related fixes before launching:**

```bash
# GOOD: Related fixes grouped
Task 'Performance optimizations in DateBookingWizard (TODOs 352-355)' with:
  - Remove unused CustomerDetails import
  - Wrap steps array in useMemo
  - Memoize expensive selector
  - Add useCallback to handlers
# 1 agent, coherent changes, 2-3 minute resolution
```

**Grouping Decision Tree:**

```
Do these TODOs involve...
├─ Same file? → Group them
├─ Same component/service? → Group them
├─ Related logic? → Group them
├─ Same category (all P3)? → Group them
└─ Different files + different logic? → Keep separate
```

**Efficiency Gains:**

| Approach                  | Agents | Time   | Overhead      |
| ------------------------- | ------ | ------ | ------------- |
| One TODO per agent        | 8      | 10 min | High          |
| Group related (2-3 per)   | 3      | 6 min  | Low           |
| Group aggressive (5+ per) | 2      | 4 min  | Moderate risk |

**Target:** 2-3 groups per wave, 8-12 agents per wave.

---

## Mistake 6: Creating Stale TODOs

### The Problem

Creating findings for issues that already exist elsewhere or were already fixed.

**Example:**

```markdown
TODO: "Add tenant isolation to BookingService"

But tenant isolation already exists:

- Commit 7c0ff16b: "Add multi-tenant isolation"
- Every booking query already filters by tenantId
- Tests verify isolation works

Result: Wasted effort on already-implemented feature
```

### Prevention

**Before creating any TODO, search:**

```bash
# Search for existing implementation
grep -r "tenantId" server/src/services/booking.service.ts
git log --grep="tenant isolation" --oneline
git log -p -S "tenantId" --since="2 weeks ago"

# If implementation exists → SKIP TODO
# If partial → Refine TODO to specific gaps only
```

**Verification in TODO creation:**

```markdown
---
status: pending
priority: p1
---

# Add Tenant Isolation

## Pre-Creation Verification

- [ ] Searched codebase for implementation
- [ ] Verified issue still exists
- [ ] Not already fixed in recent commits
- [ ] Issue reproducible in current code

## Location

[Files that need modification]

## Evidence

[Code showing the gap]
```

**Create TODOs only after verification confirms issue exists.**

---

## Mistake 7: Merging Without Manual Smoke Test

### The Problem

Code passes typecheck and tests but breaks in actual usage.

**Why it happens:**

- Edge cases not covered by tests
- Integration issues not caught by unit tests
- UI rendering issues
- Real data scenarios

### Prevention

**Smoke Test Checklist (before merging):**

```bash
# Start dev environment
npm run dev:all

# Navigate to affected feature
# http://localhost:3000/<feature>

# Test critical paths:
- [ ] Happy path (expected usage works)
- [ ] Error path (error handling works)
- [ ] Edge cases (empty state, loading, etc.)
- [ ] Related features (didn't break other functionality)
- [ ] Accessibility (keyboard nav, screen reader)
- [ ] Mobile (responsive at 375px)

# For database changes:
- [ ] Query works with real data
- [ ] Performance acceptable (< 1s)
- [ ] Pagination works
- [ ] Filtering works

# For UI changes:
- [ ] Renders correctly
- [ ] Responsive design works
- [ ] Animations smooth
- [ ] Keyboard accessible
```

**Time investment:** 3-5 minutes. Prevents production incidents.

---

## Mistake 8: Ignoring Agent Complexity Warnings

### The Problem

Running all agents on massive refactors leads to timeout and incomplete reviews.

**Example:**

```bash
# TOO COMPLEX: Refactor entire service layer
/workflows:review <massive-commit>

# Agent times out at 5 minutes
# Never completes review
# No findings generated
# You merge without review 💥
```

### Prevention

**Know when to break tasks apart:**

```
Is the change large (100+ files)?
├─ YES: Break into smaller logical chunks
│       Review each chunk separately
│       Prevents timeouts
│
└─ NO: Can review as single unit

Is the refactor touching 3+ layers?
├─ YES: Break into phase 1, 2, 3
│       Each layer separately
│
└─ NO: Can review as single unit

Are changes to multiple services?
├─ YES: Review service-by-service
│       Prevent cross-service complexity
│
└─ NO: Can review as single unit
```

**Safe refactoring size:**

- 5-10 files per review
- Single component/service per review
- Related functionality per review

**Timeout handling:**

```bash
# If review times out (15+ min)
# Break commit into smaller pieces

git reset HEAD~1                  # Undo last commit
git add <subset-of-files>         # Stage partial files
git commit -m "Phase 1: ..."      # Commit smaller unit
/workflows:review latest          # Review smaller piece

# Repeat for remaining files
```

---

## Mistake 9: Not Updating TODO Status After Fixing

### The Problem

Fixes are implemented and verified, but TODO files still show "pending" status.

**Result:**

- No visibility into what's done
- Duplicated work (agent fixes something already fixed)
- Confusion about progress

### Prevention

**After fixes are verified, update TODO files:**

```bash
# 1. Verify fix is complete and committed
npm run typecheck && npm test

# 2. Rename file to show completion
mv todos/708-pending-p1-issue.md todos/708-complete-p1-issue.md

# 3. Update frontmatter
# Change: status: pending → status: complete
# Add: resolved_at: 2026-01-10T14:30:00Z

# 4. Add work log entry
# | 2026-01-10 | complete | Fix verified, typecheck passed |

# 5. Commit TODO file updates
git add todos/
git commit -m "Update TODO statuses after code review fixes"
```

**Verification:**

```bash
# Should see mostly "complete" TODOs
ls todos/*-complete-*.md
# Should be current
```

---

## Mistake 10: Deferring All P2s Instead of Fixing

### The Problem

P2 findings are marked "deferred" and never revisited.

**Result:**

- Performance issues accumulate
- Architecture problems compound
- Technical debt grows

### Prevention

**P2 triage decision:**

```
P2 finding exists. Should we fix now or defer?

Is it blocking other work?
├─ YES → Fix now (don't defer)
└─ NO → Continue

Does it significantly impact users?
├─ YES → Fix now
└─ NO → Continue

Will it cause problems if ignored?
├─ YES (debt compounds) → Fix now
└─ NO (isolated issue) → Can defer

If deferring:
  - [ ] Set explicit revisit trigger (not "when needed")
  - [ ] Document dependency (blocks what?)
  - [ ] Assign owner for follow-up
  - [ ] Calendar reminder (not hoped-for)
```

**Example deferred P2:**

```markdown
---
status: deferred
priority: p2
tags: [performance]
---

# Optimize Customer List Pagination

## Rationale for Deferral

- Current implementation works (baseline acceptable)
- Feature not bottleneck (used by admin only)
- Will implement when:
  - Active customer count exceeds 10,000 OR
  - Admin reports pagination slowness

## Revisit Trigger

- [ ] Monthly performance review (first of month)
- [ ] Customer feedback: pagination slowness
- [ ] Metrics: Response time > 500ms

## Owner

@mikey-young (check metrics monthly)
```

**Default:** Fix P2s in sprint. Defer only with explicit triggers.

---

## Quick Mistake Prevention Checklist

Before running `/workflows:review`:

```markdown
## Pre-Review Checklist

- [ ] Code is feature-complete (not WIP)
- [ ] All tests passing (`npm test`)
- [ ] TypeScript clean (`npm run typecheck`)
- [ ] All changes committed (`git status` clean)
- [ ] Branch up-to-date with main
- [ ] Identified appropriate review agents (not all 6)
- [ ] Previous TODO files reviewed (not creating duplicates)

## During Review

- [ ] Review all findings (don't skip)
- [ ] Apply P1/P2/P3 matrix correctly
- [ ] Don't dismiss P1 findings
- [ ] Group related fixes before launching

## Post-Review Fixes

- [ ] All P1 findings fixed
- [ ] All P2 findings addressed (fix or defer with trigger)
- [ ] P3 findings added to backlog
- [ ] Full verification (typecheck, tests, build, smoke test)
- [ ] TODO files updated (status: complete)

## Merging

- [ ] Zero P1 findings
- [ ] All P2s fixed or deferred
- [ ] Manual smoke test passed
- [ ] All checks green (typecheck, tests, build)
- [ ] Changes match acceptance criteria
```

---

## Escalation Path

When something goes wrong:

| Problem                   | Action                                         |
| ------------------------- | ---------------------------------------------- |
| Unclear finding           | Ask in Slack, request clarification            |
| Finding seems wrong       | Verify it exists, check git blame              |
| Agent timed out           | Break commit into smaller pieces               |
| Too many P1s              | Prioritize ruthlessly, consider blocking merge |
| P1 takes too long to fix  | Escalate to tech lead                          |
| Conflict between findings | Ask multiple agents for perspective            |

---

## Summary

The top 3 mistakes that prevent merges:

1. **Skipping P1 fixes** – They BLOCK merge, fix before touching code
2. **Running review on incomplete code** – Finish feature first, then review
3. **Merging with TypeScript errors** – Always run full verification before push

Avoid these three and you'll catch 90% of issues before production.

---

**Last Updated:** 2026-01-10
**Related:** `docs/solutions/patterns/MULTI_AGENT_REVIEW_PREVENTION_STRATEGIES.md`
