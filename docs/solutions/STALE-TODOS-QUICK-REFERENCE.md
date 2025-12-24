# Quick Reference: Preventing Stale Todos

**Situation:** You're about to create todos from a plan or code review. Use this checklist to avoid stale todos.

## 5-Minute Decision Tree

```
Are you creating a todo based on a plan or review?
│
├─ YES
│  │
│  ├─ Step 1: Search codebase for code (2 minutes)
│  │  │
│  │  ├─ glob '**/*ComponentName*'
│  │  ├─ grep -r 'functionName'
│  │  └─ git log -p -S 'ComponentName' (last 50 commits)
│  │
│  ├─ Code found?
│  │  │
│  │  ├─ YES → When was it implemented?
│  │  │  │
│  │  │  ├─ Last 24 hours?
│  │  │  │  │
│  │  │  │  ├─ YES (same session)
│  │  │  │  │  └─ STOP. Don't create todo.
│  │  │  │  │     Mark as "FOUND: Code exists at [path]"
│  │  │  │  │
│  │  │  │  └─ NO (different session)
│  │  │  │     └─ Create VERIFY todo
│  │  │  │        (Check if implementation matches plan)
│  │  │  │
│  │  │  └─ More than 24 hours ago?
│  │  │     └─ Create AUDIT todo if needed
│  │  │        (Compliance check only)
│  │  │
│  │  └─ NO → Code doesn't exist
│  │     └─ Create IMPLEMENTATION todo
│  │        (Estimate: time to build from scratch)
│  │
│  └─ Complete deferral checklist below
│
└─ NO → Normal todo creation rules apply
```

## Quick Checklist

**Before creating ANY todo from a plan:**

```
[ ] Search: Is there a file matching this component?
    Command: glob '**/*ComponentName*'

[ ] Search: Is there a function with this name?
    Command: grep -r 'functionName' --include="*.ts"

[ ] Verify: Check git log for recent implementation
    Command: git log -p -S 'ComponentName' -n 50

[ ] Decide: What type of todo is this?
    [ ] Implementation (code doesn't exist)
    [ ] Verification (code exists, audit needed)
    [ ] Audit (code exists, compliance check)

[ ] Defer: Should I skip this todo?
    [ ] Code exists and is < 24 hours old? DEFER
    [ ] Feature is already tested? DEFER
    [ ] Recent commit implements this? DEFER
    [ ] Plan describes completed work? DEFER

[ ] Create: Only create if:
    [ ] Code doesn't exist, OR
    [ ] Code is incomplete/broken, OR
    [ ] Verification/audit is needed
```

## When to Skip Creating a Todo

| Situation                              | Skip?   | Why                                 | Alternative                   |
| -------------------------------------- | ------- | ----------------------------------- | ----------------------------- |
| Plan says "create X", X exists in code | YES     | Implementation predates plan        | Note: "Found at [path]"       |
| Code added < 1 hour before review      | YES     | Same work session                   | No todo needed                |
| Code added < 24 hours before review    | Partial | Check if matches plan               | Create VERIFY todo only       |
| Code added > 24 hours ago              | NO      | Different session                   | Create VERIFY todo            |
| Feature is E2E tested                  | YES     | Tests imply implementation complete | Note: "Verified by E2E tests" |
| Code exists but is incomplete          | NO      | Needs completion                    | Create TODO (partial impl)    |

## Quick Status Codes

Use these instead of generic "pending":

```yaml
status: pending
# Standard: Work needs to be done

status: verify
# Alternative to pending: Code exists, verify it matches plan/requirements
# Effort: 30 minutes

status: audit
# Alternative to pending: Code exists, compliance/pattern check needed
# Effort: 1-2 hours

status: complete
# Mark todos closed on same day as implementation
```

## Git Commands (Copy-Paste Ready)

**Find if code was implemented recently:**

```bash
# Find function by name
git log -p -S "EditableAccommodationSection" -n 50 --oneline

# Find when file was added
git log --all --diff-filter=A -- "client/src/features/*/EditableAccommodationSection.tsx"

# Show when a specific file changed
git log --oneline -- "path/to/file.ts" | head -5

# Check what changed in last commit
git show --stat HEAD

# Find commits by time
git log --since="2 hours ago" --oneline
```

## Common Scenarios

### Scenario 1: Plan says "create endpoint", endpoint exists

```bash
# 1. Verify it exists
$ glob '**/*landing-page*routes*'
server/src/routes/tenant-admin-landing-page.routes.ts ✓

# 2. Check when it was created
$ git log -p -S "PUT /landing-page/draft" -n 1 --oneline
1647a40 feat(landing-page): add visual editor...

# 3. Check timestamp
$ git log --format="%h %ai" -n 1 1647a40
1647a40 2025-12-04 22:59:24 -0500

# 4. Compare to review time
Today: 2025-12-04 22:59:54 (30 seconds later!)

# 5. Decision
SKIP TODO - Code implemented minutes before review
Record: "Landing page draft endpoints exist (1647a40)"
```

### Scenario 2: Plan says "create component", component doesn't exist

```bash
# 1. Search for component
$ glob '**/*EditableImage*'
(no results)

# 2. Search for related code
$ grep -r "EditableImage" --include="*.ts" client/
(no results)

# 3. Decision
CREATE TODO: "Implement EditableImage component"
Status: pending
Effort: 4-6 hours
Type: implementation
```

### Scenario 3: Plan says "add feature", code exists but old

```bash
# 1. Find code
$ grep -r "someFunction" --include="*.ts"
server/src/services/old.service.ts

# 2. Check when it was added
$ git log --format="%h %ai" -- server/src/services/old.service.ts | head -1
abc123 2025-11-15 10:00:00 -0500  (20 days old)

# 3. Decision
CREATE VERIFY TODO: "Audit implementation matches current requirements"
Status: verify
Effort: 30-60 minutes
Type: verification
Note: "Code exists but predates plan by 20 days"
```

### Scenario 4: Plan says "add feature", code exists from today

```bash
# 1. Find code
$ git log -p -S "EditableAccommodationSection" -n 1 --oneline
1647a40 feat(landing-page): add visual editor

# 2. Check timestamp
$ git log --format="%h %ai" -n 1 1647a40
1647a40 2025-12-04 22:59:24 -0500

# 3. Check when plan review happened
(metadata in todos): 2025-12-04 22:59:54

# 4. Gap analysis
Commit: 22:59:24
Review: 22:59:54
Gap: 30 seconds (SAME SESSION)

# 5. Decision
SKIP TODO - Implementation concurrent with review
Record: "EditableAccommodationSection already complete (1647a40)"
Action: Update plan to mark as verified instead of future work
```

## Todo Template (Copy-Paste)

**For Implementation Todos:**

```markdown
---
status: pending
type: implementation
priority: p2
source: '[plan-name or review-date]'
created: '[YYYY-MM-DD]'
evidence: '[path to evidence, or "no code found"]'
---

# TODO-XXX: [Concise Title]

## Problem

[What's missing]

## Acceptance Criteria

- [ ] [Specific requirement]
- [ ] [Specific requirement]

## Estimated Effort

[N hours] - No existing code
```

**For Verification Todos:**

```markdown
---
status: verify
type: verification
priority: p2
source: '[plan-name or review-date]'
evidence_paths:
  - '[path/to/file.ts:line]'
implementation_date: '[YYYY-MM-DD HH:MM]'
---

# TODO-XXX: Verify [Component] Matches [Requirement]

## Existing Code Location

[Path to implementation]

## What to Verify

- [ ] [Requirement from plan]
- [ ] [Requirement from plan]

## Estimated Effort

30 minutes - Code exists, audit only
```

## Warning Signs (Red Flags)

**Stop and double-check if you see:**

1. **Plan written BEFORE implementation** but you're reviewing AFTER
   - → Always search code first before creating todos

2. **Todos created within 1 hour of recent commits**
   - → Check if commits implement the planned features

3. **Multiple todos for same feature**
   - → Likely one supersedes the other; consolidate

4. **"Already implemented" todos in next session**
   - → You created stale todos; review your verification process

5. **E2E tests exist for a feature**
   - → Feature is implemented; create VERIFY todo at most, not IMPL

6. **Recent commit message matches plan item**
   - → Code was implemented recently; mark as found, don't create todo

## Efficiency Gains

| Scenario                        | Old Way                                                  | New Way                       | Savings   |
| ------------------------------- | -------------------------------------------------------- | ----------------------------- | --------- |
| Create 10 todos blindly         | Create + Next day verify                                 | Verify first + Create 3 todos | 6.5 hours |
| Review plan with 20 items       | Review (30 min) + Create todos (30 min) + Verify (2 hrs) | Verify during review (30 min) | 2 hours   |
| Plan review touching 5 features | Create 20+ todos + Resolve stale ones                    | Create only for missing work  | 4+ hours  |

**Average improvement: 50-70% faster plan reviews with 80% fewer stale todos**

## One-Minute Summary

Before creating a todo:

1. **Search:** Does code exist?
   - `glob` for files
   - `grep` for functions
   - `git log` for recent commits

2. **Decide:** What type?
   - Implementation (missing)
   - Verify (exists, needs check)
   - Audit (exists, compliance)

3. **Defer?** Skip if:
   - Code < 24 hours old
   - Feature is tested
   - Implementation recent
   - Matches plan exactly

4. **Create:** Only for missing/broken/unverified work

**Expected outcome:** 80% fewer stale todos, 3+ hours saved per plan review.

---

## Cheat Sheet (Print This)

```
┌─────────────────────────────────────────────┐
│  BEFORE CREATING TODO: Verify Code Exists   │
├─────────────────────────────────────────────┤
│                                             │
│  1. glob '**/*ComponentName*'               │
│  2. grep -r 'functionName' --include="*.ts"│
│  3. git log -p -S 'Name' -n 50              │
│                                             │
│  Code found?                                │
│  └─ < 24h old? → SKIP (found in code)      │
│  └─ > 24h old? → Create VERIFY todo        │
│  └─ Not found? → Create IMPL todo          │
│                                             │
│  Status codes:                              │
│  pending = needs implementation             │
│  verify = code exists, audit needed         │
│  audit = compliance check                   │
│                                             │
└─────────────────────────────────────────────┘
```

---

**Version:** 1.0
**Last Updated:** 2025-12-05
**Related:** TODO-STALENESS-PREVENTION.md, PARALLEL-AGENT-WORKFLOW-BEST-PRACTICES.md
