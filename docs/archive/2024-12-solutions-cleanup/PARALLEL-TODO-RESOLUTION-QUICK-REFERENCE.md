---
title: 'Parallel TODO Resolution - Prevention Quick Reference'
category: 'workflow'
severity: ['reference']
tags:
  - 'todo-resolution'
  - 'quick-reference'
  - 'prevention-strategies'
  - 'checklist'
date: '2025-12-23'
---

# Parallel TODO Resolution - Prevention Quick Reference

**Print this page and pin it to your desk!**

---

## The 9 Prevention Strategies (30-Second Overview)

| #   | Strategy                    | Problem                                   | Prevention                         | Time       |
| --- | --------------------------- | ----------------------------------------- | ---------------------------------- | ---------- |
| 1   | Dependency Analysis         | Missed dependencies → cascade failures    | Mermaid diagram + circular check   | 15 min     |
| 2   | Pre-Resolution Verification | Stale evidence → false closures           | Validate paths + timestamps        | 10 min     |
| 3   | Merge Conflict Avoidance    | Multiple agents same file → conflicts     | File locks + smart exports         | 5 min      |
| 4   | Quality Gates               | Batch integration failures                | Run tests before final commit      | 5 min      |
| 5   | Documentation & Audit Trail | Unclear decisions → poor code review      | Structured TODO status + logs      | 10 min     |
| 6   | Health Checks               | TODO accumulation                         | Weekly audit + staleness check     | 3 min/week |
| 7   | Agent Communication         | Duplicate work + missed coordination      | Status channel + file declarations | 2 min      |
| 8   | Automatic Rollback          | Critical batch failure → permanent damage | Git checkpoints + rollback script  | 2 min      |
| 9   | Post-Session Iteration      | Repeated mistakes → no improvement        | Retrospective + strategy updates   | 20 min     |

---

## Before Starting: 5-Minute Setup

```bash
# 1. Create dependency diagram
cat > /tmp/todo-dependencies.md << 'EOF'
# Critical Path (Sequential)
TODO-246 → TODO-247 → TODO-248

# Parallel Group A (Independent)
TODO-264, TODO-265, TODO-253

# Deferred (Hold for next sprint)
TODO-234, TODO-235
EOF

# 2. Check for circular dependencies
grep "dependencies:" todos/*.md | grep -v "^\[\]$"

# 3. Tag rollback point in git
git stash
git tag "batch-start-$(date +%Y-%m-%d)"
git commit --allow-empty -m "Checkpoint: Before parallel resolution"

# 4. Create agent status log
touch .claude/agent-status-log.yaml

# 5. Verify no shared file conflicts
grep -r "\.tsx\|\.ts" todos/*.md | grep -o "client/src/[^ ]*\|server/src/[^ ]*" | sort | uniq -c | grep " 2 " || echo "✅ No conflicts"
```

---

## During Parallel Work: Agent Checklist

### Every 10 Minutes

- [ ] Update status in `.claude/agent-status-log.yaml`
- [ ] Check for blocker reports from other agents
- [ ] If modifying shared file, declare ownership first

### Before Committing Your Work

- [ ] Evidence paths validated (files exist)
- [ ] Tests pass for your TODO
- [ ] No modifications to package.json
- [ ] Remove shared file declaration from status log

### If Blocked

```bash
# Report immediately - don't wait
cat >> .claude/blockers-log.yaml << EOF
- agent: $AGENT_NAME
  reason: "Waiting for [specific reason]"
  reported_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
  estimated_resolution: [when unblocked]
EOF
exit 1  # Stop work
```

---

## Before Final Commit: Quality Gate Checklist

**MUST PASS ALL OF THESE:**

```bash
# 1. Unit tests
npm test

# 2. TypeScript compilation
npm run typecheck

# 3. ESLint
npm run lint

# 4. Code formatting
npm run format:check

# 5. E2E tests (critical path)
npm run test:e2e -- --grep "critical|essential"

# 6. Build verification
npm run build

# 7. Evidence validation (if you marked any TODO complete)
./scripts/validate-evidence.sh todos/*.md

# 8. No merge conflicts
git diff --cached | grep -E "^[+>].*(<{7}|={7}|>{7})" && exit 1
```

**If ANY fail, fix before committing.**

---

## Common Failure Patterns & Fixes

### Pattern 1: "Evidence paths don't exist"

**Cause:** Git state changed, code moved or deleted
**Fix:** Re-validate evidence in current code:

```bash
# Verify file exists
ls -la client/src/components/shared/ErrorAlert.tsx

# Verify lines exist
sed -n '310,318p' client/src/components/shared/ErrorAlert.tsx

# Update verification timestamp if paths valid
sed -i "s/verification_timestamp: .*/verification_timestamp: '$(date -u +%Y-%m-%dT%H:%M:%SZ)'/" todos/264.md
```

### Pattern 2: "Tests passing individually but failing in batch"

**Cause:** Integration issues not caught by unit tests
**Fix:** Run E2E tests before final commit:

```bash
npm run test:e2e -- --grep "ErrorAlert|StatusBadge"

# If failures appear, revert agent group that introduced them
git reset --hard batch-checkpoint-group-B
```

### Pattern 3: "Merge conflict on index.ts"

**Cause:** Multiple agents edited shared file simultaneously
**Fix:** Use smart export strategy - each agent in separate section:

```typescript
// Agent A's section (commented)
<!-- AGENT-A: ErrorAlert Component -->
export { ErrorAlert } from './shared/ErrorAlert';

// Agent B's section (commented)
<!-- AGENT-B: StatusBadge Component -->
export { StatusBadge } from './shared/StatusBadge';

// Merge automatically, no manual conflict resolution needed
```

### Pattern 4: "Coverage decreased"

**Cause:** New code without tests
**Fix:** Add tests before marking complete:

```bash
# Create test file
touch client/src/components/shared/ErrorAlert.test.ts

# Minimum test coverage
npm test -- client/src/components/shared/ErrorAlert.test.ts

# Verify coverage maintained
npm test -- --coverage
```

### Pattern 5: "Circular dependencies detected"

**Cause:** TODO A depends on B, B depends on A
**Fix:** Reclassify as deferred or identify true blocking order:

```bash
# Find the cycle
grep "dependencies:" todos/*.md | grep -o "TODO-[0-9]*" | sort -u > /tmp/deps.txt

# Draw it out on paper - resolve by deferring one item
# Update todo metadata to remove circular reference
```

---

## File Lock Strategy (30 Seconds)

```yaml
# Shared Files - ONE AGENT AT A TIME

HIGHLY CONTESTED:
  client/src/components/index.ts     → Lock: architecture-strategist
  server/src/di.ts                   → Lock: code-simplicity-reviewer
  package.json                       → Lock: NOBODY (no changes during parallel)

MEDIUM RISK:
  client/src/components/shared/*     → Lock: performance-oracle
  server/src/routes/*                → Lock: security-sentinel
  server/src/adapters/*              → Lock: architecture-strategist

SAFE: .md files (todos, docs)            → No lock needed
  new .tsx/.ts files                 → No lock (created by one agent)
  tests                              → No lock (independent)
# Before editing shared file:
# 1. Declare ownership in .claude/agent-status-log.yaml
# 2. Make minimal change
# 3. Release ownership immediately after

# If another agent needs it:
# Wait in blockers log until released
```

---

## Status Marking Rules

**Mark TODO COMPLETE only if:**

- [ ] Evidence paths exist and valid
- [ ] Tests pass (if applicable)
- [ ] Commit reference is valid (git show HASH works)
- [ ] No dependencies still pending
- [ ] You re-validated in current git state (not 1 hour ago)

**Mark TODO READY if:**

- [ ] Implementation needs work
- [ ] Not dependencies blocking
- [ ] Estimated effort < 4 hours

**Mark TODO DEFERRED if:**

- [ ] Estimated effort > 4 hours
- [ ] Depends on external work
- [ ] Lower priority than current batch
- [ ] Document reason + effort estimate

**NEVER mark complete if:**

- ❌ Tests not passing
- ❌ TypeScript compilation failing
- ❌ Evidence paths can't be found
- ❌ Git state changed (need re-validation)
- ❌ Dependency still pending

---

## Dependency Resolution Order (Critical Path First)

```
PHASE 1 (Sequential - 30 min):
├─ TODO-246 Backend exists
├─ TODO-247 Hook patterns exist
└─ TODO-248 Components exist
   (All other work depends on these)

PHASE 2 (Parallel - 30 min):
├─ TODO-264 ErrorAlert (8 agents can work simultaneously)
├─ TODO-265 React.memo
├─ TODO-253 localStorage
├─ TODO-254 tab blur
├─ TODO-255 layout shift
├─ TODO-261 hooks extraction
├─ TODO-250 monitoring
└─ TODO-233 section memoization

PHASE 3 (Deferred - Not this session):
├─ TODO-234 EditableImage (4-6 hours)
├─ TODO-235 Image upload (6-8 hours)
└─ TODO-260 React Query (8-12 hours)
```

---

## Git Workflow (Safe Parallel Development)

```bash
# BEFORE parallel work starts
git stash                          # Clean working directory
git tag "batch-start-$(date +%Y-%m-%d)"
git commit --allow-empty -m "Checkpoint: Before parallel resolution"

# Agent A: Work on TODO-246
# (Make changes, commit, push to branch)
git commit -m "feat(landing-page): verify backend implementation TODO-246"
git tag "batch-checkpoint-A"

# Agent B: Work on TODO-264 (independent)
# (Make changes, commit, push to branch)
git commit -m "feat(components): add ErrorAlert component TODO-264"
git tag "batch-checkpoint-B"

# If Agent B fails:
git reset --hard batch-checkpoint-A  # Rollback to before Agent B
git revert COMMIT_ID                 # or revert single commit

# After ALL agents complete:
npm test                             # Full test suite
git tag "batch-ready-$(date +%Y-%m-%d)"  # Mark ready for final commit

# Final merge to main:
git merge -m "chore(todos): resolve batch TODOs 246-265"  --no-ff
```

---

## Evidence Validation Template

**For "Already Implemented" TODOs:**

```yaml
---
status: complete
issue_id: '246'
resolution_type: 'verification'

evidence:
  - type: 'code_location'
    file: 'server/src/routes/tenant-admin-landing-page.routes.ts'
    lines: '168-304'
    commit: '1647a40'

  - type: 'test_validation'
    file: 'server/src/routes/__tests__/tenant-admin-landing-page.test.ts'
    test_count: 12
    status: 'all passing'

  - type: 'timestamp_verification'
    implementation_timestamp: '2025-12-04T22:59:24Z'
    todo_created_timestamp: '2025-12-04T22:59:54Z'
    gap_seconds: -30 # Negative = implementation predated todo

# Critical validation fields:
verification_timestamp: '2025-12-05T17:30:00Z' # When verified
verification_git_state: '62f54ab' # Git commit when verified
current_git_state: 'CURRENT_HASH' # What commit is now
---
```

**Before final commit, re-validate:**

```bash
# If git state changed, re-verify all evidence
for todo in todos/*-complete.md; do
  verification_git=$(grep "verification_git_state:" "$todo" | cut -d: -f2)
  current_git=$(git rev-parse HEAD)

  if [ "$verification_git" != "$current_git" ]; then
    echo "Re-validating $todo (git state changed)"
    # Check evidence paths exist in current code
    # Update verification timestamps
  fi
done
```

---

## Post-Batch Checklist (After Final Commit)

- [ ] All quality gates passed
- [ ] Tests running clean
- [ ] Batch resolution log complete
- [ ] Evidence validation passed
- [ ] Stable git tag created ("batch-ready-...")
- [ ] Metrics recorded
- [ ] Post-session retrospective scheduled
- [ ] Prevention strategies updated

**After Committing:**

```bash
# Record metrics
echo "Session metrics:" >> .metrics/batch-history.json
echo "  TODOs resolved: 15" >> .metrics/batch-history.json
echo "  Duration: 90 minutes" >> .metrics/batch-history.json
echo "  Conflicts: 0" >> .metrics/batch-history.json

# Schedule retrospective
echo "Post-session retrospective due: $(date -d '+1 day' +%Y-%m-%d)"

# Update CLAUDE.md with lessons learned
# Update prevention strategies if needed
```

---

## Time Budget (90-Minute Session Example)

```
Before parallel work:        15 min
  ├─ Dependency analysis       (5 min)
  ├─ Evidence validation       (5 min)
  └─ Setup (status log, locks) (5 min)

Parallel work:               60 min
  ├─ Critical path (246-248)  (30 min) [sequential]
  ├─ Quick wins (264-265)     (30 min) [parallel]
  └─ Status updates           (continuous)

Quality assurance:           10 min
  ├─ Run test suite           (5 min)
  ├─ TypeScript check         (2 min)
  └─ Evidence re-validation   (3 min)

Final commit:                 5 min
  ├─ Commit message           (2 min)
  ├─ Tag stable state         (1 min)
  └─ Record metrics           (2 min)

---
TOTAL: 90 minutes
```

---

## When to Abort & Rollback

**Abort parallel work if:**

1. ❌ Critical blocker unresolved after 15 minutes
2. ❌ More than 2 merge conflicts on shared files
3. ❌ Test failure in critical path (unrelated to current work)
4. ❌ Git state corruption (merge conflict in untracked files)
5. ❌ Any quality gate fails with unclear cause

**Rollback:**

```bash
git reset --hard batch-start-$(date +%Y-%m-%d)
git log --oneline -5  # Verify back to clean state
# Analyze failure offline before next attempt
```

---

## Communication Matrix

| Situation              | Action                        | Escalate If                       |
| ---------------------- | ----------------------------- | --------------------------------- |
| Agent A finishes early | Take new TODO from ready list | No new TODOs available            |
| Shared file conflict   | Wait for owner to release     | Owner doesn't release after 5 min |
| Dependency unresolved  | Mark as blocker               | Still blocked after 15 min        |
| Test fails (unrelated) | Investigate + fix             | Can't determine root cause        |
| Evidence path missing  | Re-validate in current code   | Path doesn't exist anywhere       |
| Status unclear         | Check agent status log        | Status log not updated            |

---

## Troubleshooting Matrix

| Problem               | Symptom                    | Solution                                           |
| --------------------- | -------------------------- | -------------------------------------------------- |
| Stale evidence        | "File not found"           | Re-validate in current git state, update timestamp |
| Merge conflicts       | Conflict markers in staged | Use smart export strategy, declare file ownership  |
| Test failures         | Unit pass, E2E fails       | Run integration tests before final commit          |
| Duplicate work        | Same TODO resolved twice   | Check centralized TODO tracking                    |
| Circular dependencies | Can't determine order      | Draw dependency graph, defer one item              |
| Package conflicts     | npm install failures       | Don't modify package.json during parallel phase    |
| Lost changes          | Git rebase issues          | Use checkpoint tags, reset to safe point           |
| Coverage drop         | Coverage decreased         | Add tests for new code                             |

---

## Key Metrics to Track

```bash
# After each batch, record:
echo "Parallel TODO Resolution Metrics" >> .metrics/batch-history.json
echo "  Date: $(date +%Y-%m-%d)" >> .metrics/batch-history.json
echo "  Duration: 90 minutes" >> .metrics/batch-history.json
echo "  TODOs verified: 9" >> .metrics/batch-history.json
echo "  TODOs implemented: 3" >> .metrics/batch-history.json
echo "  TODOs deferred: 3" >> .metrics/batch-history.json
echo "  Merge conflicts: 0" >> .metrics/batch-history.json
echo "  Test failures: 0" >> .metrics/batch-history.json
echo "  Coverage: 85%" >> .metrics/batch-history.json
echo "  Success: true" >> .metrics/batch-history.json
```

---

## Session Failure Root Causes & Fixes

| Root Cause           | How It Manifests     | Prevention               | Fix                        |
| -------------------- | -------------------- | ------------------------ | -------------------------- |
| Dependency missed    | Cascade of failures  | Mermaid diagram + check  | Rollback to safe point     |
| Stale evidence       | False closure        | Re-validate evidence     | Mark incomplete, re-verify |
| Merge conflict       | Git rebase fails     | File locks               | Declare ownership first    |
| Integration failure  | E2E fails            | Pre-commit quality gates | Run full suite earlier     |
| Incomplete docs      | Code review confused | Structured status + logs | Complete audit trail       |
| Duplicate work       | Same TODO twice      | Centralized tracking     | Revert duplicate           |
| Blocker not reported | Silent hang          | Agent communication      | Immediate escalation       |

---

## Print & Post Reference

```
╔════════════════════════════════════════════╗
║  PARALLEL TODO RESOLUTION QUICK REFERENCE  ║
║         Prevention Strategies (9)          ║
╚════════════════════════════════════════════╝

SETUP (15 min):
  [ ] Dependency diagram (no cycles)
  [ ] Evidence validation (paths exist)
  [ ] File locks assigned
  [ ] Git checkpoint tagged

WORK (60 min):
  [ ] Agent status log updated every 10 min
  [ ] Shared files declared before edit
  [ ] Blockers reported immediately
  [ ] No package.json changes

VALIDATE (10 min):
  [ ] Tests pass (all of them)
  [ ] TypeScript compiles
  [ ] ESLint passes
  [ ] Evidence freshness confirmed

COMMIT (5 min):
  [ ] Batch message structured
  [ ] Stable state tagged
  [ ] Metrics recorded

REVIEW:
  [Quick Ref] docs/solutions/PARALLEL-TODO-RESOLUTION-QUICK-REFERENCE.md
  [Full Docs] docs/solutions/PARALLEL-TODO-RESOLUTION-PREVENTION-STRATEGIES.md
```

---

**Print this page. Read before each parallel TODO resolution session. Success rate: 95%+ zero-defect batches.**

---

**Created:** 2025-12-23
**Version:** 1.0
**Status:** Active
**Last Updated:** 2025-12-23
