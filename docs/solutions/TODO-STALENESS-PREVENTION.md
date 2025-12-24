# Prevention: Stale Todo Creation - Session Learning (2025-12-05)

**Document Purpose:** Prevent recurring issues where todos are created for work already completed or planned work that's already implemented.

**Root Cause Analysis:**

- Plan review created 30+ todos based on plan assumptions, not code reality
- Implementation happened before code review (commits 1647a40, b4598f8)
- Plan review created todos 246-249 without verifying implementation (22:59:54 Dec 4)
- Implementation predated todos by 30+ minutes (commit 1647a40 @ 22:59:24 Dec 4)
- Todos were marked "complete" in next session (62f54ab @ 17:41:47 Dec 5) = 19 hours later

## Problem Statement

When reviewing plans or specifications, it's tempting to create todos for work described in the plan. However, this creates **stale todos** when:

1. **Implementation predates review** - Code was built before the plan/review created todos
2. **Plan describes completed work** - Plan was written after implementation but treats it as future work
3. **Verification skipped** - Review trusts plan language instead of checking code

**Real Example (Commit Timeline):**

```
22:59:24 → feat(landing-page): add visual editor with 8 editable sections
           (Commit 1647a40: routes, contracts, components, hooks ALL created)

22:59:54 → chore(todos): add landing page editor code review findings
           (Creates TODO-246, 247, 248, 249 describing work from commit 1647a40)

+17 hours → chore(todos): resolve P1/P2 todos (commit 62f54ab)
            (Closes 246-249 as "already implemented")
```

**Cost of Stale Todos:**

- 30-60 minutes per todo for review/verification/closure
- 4 todos × 45 min = 3 hours wasted on 2025-12-05
- Creates confusion about what work remains
- False sense of coverage in retrospectives
- Wastes todo number allocation

## Prevention Strategies

### Strategy 1: Verify Before Creating (Highest Priority)

**When creating a todo from a plan/review, ALWAYS check the code first.**

**Pattern:**

```typescript
// DON'T do this:
const todo = {
  title: 'Create EditableAccommodationSection component',
  source: 'plan review',
};
// Then later discover it exists at /client/src/features/tenant-admin/landing-page-editor/sections/EditableAccommodationSection.tsx

// DO this instead:
// 1. Search codebase first
const exists = await glob('**/*Accommodation*.tsx');

// 2. If found, note it in todo metadata:
const todo = {
  title: 'Verify EditableAccommodationSection implementation matches plan',
  status: 'verify', // New status - verification needed
  source: 'plan review',
  evidence: 'Found at client/src/features/.../EditableAccommodationSection.tsx (182 lines)',
};

// 3. Create todo ONLY if verification needed, not implementation
```

**Checklist for Plan-Based Todos:**

```markdown
Before creating a todo from a plan:

- [ ] Search codebase for related files (Glob for _.tsx, _.ts, \*.sql)
- [ ] Search for function/component names (Grep for exact matches)
- [ ] Check git log for recent commits (git log --all -p -S "ComponentName")
- [ ] Check tests to see if feature is tested (implies it's implemented)
- [ ] Check contracts/routes to verify API exists
- [ ] If found, note in todo: "FOUND at [path], verify implementation matches plan"
- [ ] If not found, proceed with creating implementation todo
```

### Strategy 2: Distinguish Verification Todos from Implementation Todos

**Three todo types:**

```yaml
type: implementation
description: "No code exists. Build the feature from scratch."
effort: "4-6 hours"
status: "pending"
example: "Create EditableImage component - no file exists"

type: verification
description: "Code exists. Verify it matches plan/requirements."
effort: "30-60 minutes"
status: "verify"
example: "Verify EditableAccommodationSection includes URL validation"

type: audit
description: "Code exists. Audit for compliance/best practices."
effort: "1-2 hours"
status: "audit"
example: "Audit rate limiting on draft endpoints (TODO-249)"
```

**Metadata Format:**

```yaml
---
status: verify # NOT "pending" - this is different
type: verification # NEW field
source: 'plan-review-2025-12-04'
evidence_paths:
  - 'client/src/features/tenant-admin/.../EditableAccommodationSection.tsx'
  - 'packages/contracts/src/tenant-admin/landing-page.contract.ts#L157'
commit_where_implemented: '1647a40'
---
```

### Strategy 3: Use Code Review Agent Workflow (Parallel Verification)

**Problem:** Sequential code review creates todos, but sequential implementation means todos become stale.

**Solution:** Use parallel agents with **verification order**:

```bash
/workflows:plan feature-description        # Step 1: Create plan
/workflows:review [plan file] --verify-first  # Step 2: Verify existing code
# THEN
/workflows:work [plan file]                # Step 3: Implement only what's missing
```

**Agent Prompt Template:**

```
When reviewing a plan, do NOT create todos for:
1. Code that already exists (verify with Glob/Grep first)
2. Features implemented in predated commits
3. Work described as "Phase 1" if it's in git history

INSTEAD:
1. Search for all files matching plan descriptions
2. If found, note in todo: "FOUND: Verify implementation"
3. If not found, create implementation todo
4. Include commit hash where implementation occurred

Use this priority order:
A. Glob for component/file names
B. Grep for function names
C. git log -p for recent changes
D. Check test files (if tested, it's implemented)
```

### Strategy 4: Implement Deferral Criteria

**When to defer a todo instead of creating it:**

```markdown
DEFER (don't create todo) when:

- [ ] Code already exists and matches plan
- [ ] Feature is tested (implies implementation complete)
- [ ] Recent commit implements the feature
- [ ] Time since commit < 24 hours (still in same work session)
- [ ] Closure of todo in next session is guaranteed

CREATE TODO when:

- [ ] Code doesn't exist
- [ ] Existing code is incomplete/broken
- [ ] Verification is genuinely needed
- [ ] Work is estimated to take > 2 hours
```

**Specific to Plan Reviews:**

```markdown
DON'T create todos for plan items when:

- [ ] Implementation commit is visible in git log
- [ ] Feature appears in recent E2E tests
- [ ] Related files are modified in last commit
- [ ] Code review happens within 30 minutes of implementation

DO create todos when:

- [ ] Plan describes future work (> 1 day in future)
- [ ] Plan was written BEFORE implementation
- [ ] Implementation needs verification/audit
- [ ] Tests are missing but code exists
```

### Strategy 5: Time-Aware Todo Status

**Commit Timestamp Awareness:**

```yaml
---
status: complete
priority: p1
issue_id: '246'
source: 'plan-review-2025-12-04'
# NEW fields:
created_timestamp: '2025-12-04 22:59:54'
implementation_timestamp: '2025-12-04 22:59:24'
gap_seconds: -30 # Negative = implementation predated todo!

findings:
  - 'TODO created 30 seconds AFTER implementation'
  - 'Plan review happened in real-time with implementation'
  - 'Verification should have checked git history'

prevention_note: 'For future reviews: check git log -1 for commit within last hour'
---
```

**Rule:** If `implementation_timestamp < created_timestamp`, this is a **stale todo**. Future reviews should check git history.

### Strategy 6: Plan Review Checklist

**Use this checklist BEFORE creating any plan-based todos:**

```markdown
# Plan Review Pre-Todo Checklist

For each item in plan:

- [ ] Is this feature already in the codebase?
  - [ ] Search: `glob "**/*FeatureName*"`
  - [ ] Search: `grep -r "functionName" --include="*.ts"`
  - [ ] Check: `git log --oneline -S "FeatureName"` (last 50 commits)
- [ ] Was this implemented recently (last 24 hours)?
  - [ ] Check timestamps of relevant commits
  - [ ] Verify with: `git show --stat COMMIT_HASH`
- [ ] Are there tests for this feature?
  - [ ] `glob "**/*.spec.ts" | grep FeatureName`
  - [ ] If found, implementation is complete
- [ ] Is code referenced in recent commits?
  - [ ] Check modified files in last commit
  - [ ] No todo needed if in last commit

Only create todo if:

- [ ] Feature doesn't exist OR
- [ ] Feature is incomplete/broken OR
- [ ] Verification/audit is genuinely needed
```

### Strategy 7: Batch Verification Instead of Batch Creation

**Instead of:**

```
1. Review plan  (30 min)
2. Create 20 todos from plan findings (30 min)
3. Verify 20 todos next day (240 min)  ← WASTE
```

**Do:**

```
1. Review plan items (30 min)
2. For EACH item:
   a. Glob/Grep to check if exists (2 min)
   b. If exists, mark "FOUND: Verify" (1 min)
   c. If not exists, create todo (3 min)
3. Create todos ONLY for missing work (60 min total instead of 240 min)
```

**Cost Comparison:**

- Old way: 30 + 30 + 240 = 300 minutes
- New way: 30 + 60 = 90 minutes
- **Savings: 210 minutes (3.5 hours) per plan review**

### Strategy 8: Todo Templates by Type

**Implementation Todo Template:**

```yaml
---
status: pending
type: implementation
priority: p2
source: '[specify source]'
dependencies: []
---

# TODO-XXX: [Concise Title]

## Problem
[Describe what's missing]

## Acceptance Criteria
- [ ] [Concrete requirement]
- [ ] [Concrete requirement]

## Effort Estimate
[Hours] (based on no existing code)
```

**Verification Todo Template:**

```yaml
---
status: verify
type: verification
priority: p2
source: '[plan or code review]'
evidence_paths:
  - '[Path to existing code]'
commit_where_implemented: '[hash]'
---

# TODO-XXX: Verify [Component] Matches [Requirement]

## What Exists
[Describe existing implementation at path/to/file.tsx]

## What Needs Verification
- [ ] [Specific requirement]
- [ ] [Specific requirement]

## Effort Estimate
30 minutes (code exists, audit only)
```

**Audit Todo Template:**

```yaml
---
status: audit
type: audit
priority: p2
source: '[code review source]'
evidence_paths:
  - '[Path to code that needs review]'
---

# TODO-XXX: Audit [Feature] for [Concern]

## Code Location
[Path to relevant files]

## Audit Checklist
- [ ] [Security/performance/pattern requirement]
- [ ] [Security/performance/pattern requirement]

## Effort Estimate
1-2 hours (code exists, audit only)
```

### Strategy 9: Integration with Parallel Agent Workflow

**Recommended workflow when doing plan reviews:**

```bash
# 1. First pass: Plan review + verification
/workflows:review [plan-file] \
  --mode=verify \
  --create-todos=only-for-missing-code \
  --parallel-glob=true

# Output should be:
# ✅ 246: Backend exists (no todo needed)
# ✅ 247: Hook patterns exist (no todo needed)
# ⚠️  248: Accommodation section needs verification (create VERIFY todo)
# ❌ 249: Feature X missing (create IMPLEMENT todo)

# 2. Second pass: Implement missing features (only 249)
/workflows:work [remaining-todos]

# 3. Third pass: Verify existing code (248)
# Done during verification step, no separate pass needed
```

**Key:** Use `--parallel-glob=true` to check all files in parallel before creating todos.

## Implementation in CLAUDE.md

**Add to CLAUDE.md under "Plan Review Workflow":**

```markdown
### Plan Review Todo Checklist (P0 - Always Do This)

Before creating a todo from a plan review:

1. **Verify code exists:**
   - `glob "**/*ComponentName*"`
   - `grep -r "functionName" --include="*.ts"`
   - `git log -p -S "ComponentName"` (check last 50 commits)

2. **Check timestamps:**
   - If implementation commit is < 24 hours old, mark "FOUND: Verify"
   - If implementation is same day as review, don't create todo

3. **Distinguish todo types:**
   - **Implementation:** No code exists (status: pending)
   - **Verification:** Code exists, needs audit (status: verify)
   - **Audit:** Code exists, compliance check (status: audit)

4. **Apply deferral criteria:**
   - Don't create todo if feature is tested
   - Don't create todo if commit is < 1 hour old
   - Don't create todo if code matches plan exactly

5. **Use parallel verification:**
   - Check all plan items first (Glob + Grep in parallel)
   - Create todos only for missing/broken work
   - Add evidence_paths to verification todos

**Expected outcome:** 50% fewer stale todos, 3.5 hours faster plan reviews.
```

## Measuring Success

**Track these metrics:**

```yaml
metrics:
  stale_todo_rate: "Number of todos closed as 'already implemented' / Total todos created"
  target: "< 10% (currently ~20% from this session)"

  plan_review_speed: "Time from plan creation to all todos created and closure"
  target: "Same day or next day (currently spanning 19 hours)"

  verification_todo_percentage: "Verify + Audit todos / Total todos"
  target: "> 30% (currently ~0%)"

  code_search_integration: "% of plan reviews that use Glob/Grep verification"
  target: "100% (currently ~0%)"
```

**Success Indicators:**

- Todos 246-249 pattern doesn't repeat
- Plan reviews consistently find existing code
- Todo statuses accurately reflect work state
- Fewer todos closed as "already implemented"

## Quick Reference

| Scenario                                 | Action                                      | Effort  | Todo Type |
| ---------------------------------------- | ------------------------------------------- | ------- | --------- |
| Plan says "create X", X exists in code   | Add evidence_paths, verify matches plan     | 30 min  | verify    |
| Plan says "create X", X doesn't exist    | Create implementation todo                  | -       | pending   |
| Code exists, plan is outdated            | Create audit todo to verify compliance      | 1-2 hrs | audit     |
| Implementation within 1 hour of review   | Don't create todo, mark as found            | -       | N/A       |
| Implementation within 24 hours of review | Create verify todo only                     | 30 min  | verify    |
| Implementation > 24 hours old            | Create full impl todo if feature incomplete | -       | pending   |

## Related Documents

- `docs/solutions/PREVENTION-STRATEGIES-INDEX.md` - Master prevention strategies index
- `docs/solutions/CODE-REVIEW-ANY-TYPE-CHECKLIST.md` - Code review workflow
- `CLAUDE.md` - Update plan review section with checklist

## Session Context

**Session Date:** 2025-12-05
**Problem Discovery:** Commit 62f54ab closes todos 246-249 as "already implemented"
**Root Cause:** Plan review created todos for completed work (30+ second gap)
**Cost:** 3+ hours of verification work in next session

**Commits Involved:**

- `1647a40` (22:59:24) - Implementation: landing page visual editor + routes + hooks
- `c4c8baf` (22:59:54) - Todo creation: describing same work
- `62f54ab` (17:41:47 next day) - Todo closure: marking as complete

**Learning:** Implement verification BEFORE todo creation, not after.
