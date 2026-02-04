---
title: 'Parallel Agent TODO Resolution - Implementation Guide'
category: methodology
priority: P1
status: reference
last_updated: 2026-02-03
tags:
  - workflow
  - implementation
  - todo-resolution
  - getting-started
related_docs:
  - PARALLEL-AGENT-TODO-RESOLUTION-PATTERN.md (Complete reference)
  - PARALLEL-AGENT-QUICK-REFERENCE.md (Print & pin)
  - PARALLEL-AGENT-CODE-EXAMPLES.md (Real patterns)
---

# Parallel Agent TODO Resolution - Implementation Guide

**This document guides you through your FIRST parallel resolution session.**

---

## Session Preparation (15 Minutes)

### Step 1: Read the Quick Reference (3 min)

Read: `/docs/solutions/methodology/PARALLEL-AGENT-QUICK-REFERENCE.md`

This is your "cheat sheet" for the next 30 minutes.

### Step 2: Understand the Pattern (5 min)

Read: First section of `/docs/solutions/methodology/PARALLEL-AGENT-TODO-RESOLUTION-PATTERN.md` (The 5-Phase Workflow)

Key takeaway: Inventory → Planning → Execution → Validation → Integration

### Step 3: See Real Code (5 min)

Skim: `/docs/solutions/methodology/PARALLEL-AGENT-CODE-EXAMPLES.md`

Look for examples that match the type of TODOs you're about to resolve (security, performance, testing, etc.).

### Step 4: Run Environment Check (2 min)

```bash
# Verify your environment is ready
npm run doctor

# Expected output: All green ✓
```

---

## Your First Session: Step-by-Step

### Phase 1: Inventory (10 minutes)

**Goal**: List all pending TODOs and understand what you're working with.

#### Step 1.1: Count TODOs

```bash
cd /Users/mikeyoung/CODING/MAIS

# Count pending TODOs
pending=$(find todos/ -name "*-pending-*.md" 2>/dev/null | wc -l)
echo "Total pending TODOs: $pending"

# If less than 4, consider deferring - overhead not worth it
if [ "$pending" -lt 4 ]; then
  echo "⚠️ Consider sequential approach for <4 TODOs"
  exit 0
fi
```

#### Step 1.2: Extract List

```bash
# List all pending TODOs with priorities
echo "=== PENDING TODOs by Priority ==="
for priority in p1 p2 p3; do
  count=$(find todos/ -name "*-pending-*-${priority}-*.md" 2>/dev/null | wc -l)
  echo "${priority}: $count"
done

# List the IDs
echo ""
echo "=== TODO IDs ==="
ls todos/*-pending-*.md | xargs -I {} basename {} | cut -d'-' -f1 | sort -n | head -20
```

#### Step 1.3: Document Initial State

```bash
# Save current state for reference
cat > /tmp/session-start.txt <<EOF
Session Started: $(date)
TODOs Found: $pending
Status: Starting parallel resolution
Branch: $(git rev-parse --abbrev-ref HEAD)
Commit: $(git rev-parse --short HEAD)
EOF

cat /tmp/session-start.txt
```

---

### Phase 2: Planning (15 minutes)

**Goal**: Build a dependency graph and plan agent invocations.

#### Step 2.1: Analyze Dependencies

Read 3-4 representative TODOs:

```bash
# Pick a few TODOs to examine
head -30 todos/5206-pending-p1-*.md
head -30 todos/5208-pending-p2-*.md
head -30 todos/5210-pending-p2-*.md

# Look for "dependencies:" field
# If it says "dependencies: []" → independent (Wave 1)
# If it references other TODO IDs → dependent (Wave 2+)
```

#### Step 2.2: Create Execution Plan

Create a simple text file with your plan:

```yaml
# session-plan.yaml
session:
  date: 2026-02-03
  goal: Resolve 11 code-quality TODOs
  expected_time: 20 minutes

execution_waves:
  wave_1:
    description: 'Independent TODOs (no dependencies)'
    todos:
      - id: 5207
        title: JSON-LD dangerously_set_inner_html
        priority: p1
        files:
          - apps/web/src/components/JsonLd.tsx
      - id: 5209
        title: Confirmation defaults
        priority: p2
        files:
          - server/src/routes/tenant-admin.routes.ts
      - id: 5210
        title: Discard all transaction lock
        priority: p2
        files:
          - server/src/services/section-content.service.ts

  wave_2:
    description: 'Dependent on Wave 1'
    todo_5206:
      depends_on:
        - 5207 # JSON-LD must be fixed first
      blocks:
        - 5208 # N+1 optimization depends on this

# Use this to decide: which TODOs to launch together
```

#### Step 2.3: Prepare Agent Prompts

For each Wave 1 TODO, create a focused agent prompt:

```bash
# Create a prompts directory
mkdir -p /tmp/agent-prompts

# Save prompt for first TODO
cat > /tmp/agent-prompts/5207-prompt.txt <<'EOF'
TODO-5207: JSON-LD dangerously_set_inner_html

PROBLEM:
The JSON-LD schema uses dangerously_set_inner_html, which could expose
security vulnerabilities. Replace with safe HTML encoding.

LOCATION:
- apps/web/src/components/JsonLd.tsx (line 34)
- Verify schema structure in apps/web/src/lib/structured-data.ts

SOLUTION:
1. Import sanitizeHtml from '@/lib/sanitize'
2. Replace dangerously_set_inner_html with JSON.stringify
3. Use <script type="application/ld+json"> with sanitized content
4. Add 2 test cases

ACCEPTANCE CRITERIA:
- No dangerously_set_inner_html in final code
- JSON-LD schema still valid (test with schema.org validator)
- All tests passing
- TypeScript compiles cleanly

DEFINITION OF DONE:
1. Make changes
2. Run: npm test
3. Run: npm run typecheck
4. Archive: mv todos/5207-pending-p1-*.md todos/archive/5207-complete-p1-*.md
5. Stage: git add -A
6. Ready for Phase 4
EOF

cat /tmp/agent-prompts/5207-prompt.txt
```

Repeat for other Wave 1 TODOs.

---

### Phase 3: Execution (5-10 minutes)

**Goal**: Launch all agents simultaneously.

#### Step 3.1: Launch All Wave 1 Agents

Create a message in Claude Code with all agent invocations:

```
I'm resolving 8 independent TODOs using parallel agent execution.

Here are 8 focused tasks to run in parallel:

[TASK 1]
TODO-5207: JSON-LD dangerously_set_inner_html (P1)

{Read from /tmp/agent-prompts/5207-prompt.txt}

[TASK 2]
TODO-5209: Confirmation defaults true (P2)

{Read from /tmp/agent-prompts/5209-prompt.txt}

[TASK 3-8]
... similar format for each TODO

All agents should:
1. Read the affected files to understand current state
2. Verify the problem exists (not already fixed)
3. Implement the solution per the prompt
4. Run npm test to verify
5. Run npm run typecheck
6. Archive the TODO
7. Stage changes with git add
```

#### Step 3.2: Monitor Agent Progress

While agents work, watch for output:

```bash
# Optional: monitor git status changes in real-time
watch -n 1 'git status --short | head -20'

# Check for any build errors
npm run typecheck &

# Monitor test results
npm test -- --onlyChanged &
```

#### Step 3.3: Typical Timeline

```
:00 - Agents launch
:02 - First agent completes (simple TODOs)
:04 - Most agents complete
:06 - Final agent finishes
:08 - Phase 3 complete, move to Phase 4
```

---

### Phase 4: Validation (10 minutes)

**Goal**: Verify all work is complete and correct.

#### Step 4.1: Check Completion

```bash
# Count archived TODOs (should match expected)
archived=$(ls todos/archive/*-complete-*.md 2>/dev/null | wc -l)
echo "Archived: $archived"

# Check if any TODOs still pending
pending=$(ls todos/*-pending-*.md 2>/dev/null | wc -l)
echo "Still Pending: $pending"

if [ "$pending" -eq 0 ]; then
  echo "✅ All TODOs archived"
else
  echo "⚠️ Some TODOs not complete"
  ls todos/*-pending-*.md
fi
```

#### Step 4.2: Run Full Validation

```bash
# Exit on first error
set -e

echo "🔍 TypeScript check..."
npm run typecheck

echo "🧪 Running tests..."
npm test

echo "📊 Test coverage..."
npm test -- --coverage | tail -15

echo "✅ All validation passed!"
```

#### Step 4.3: Review Changes

```bash
# See all modified files
echo "=== Modified Files ==="
git status --short | head -30

# See changes summary
echo ""
echo "=== Changes Summary ==="
git diff --stat HEAD~1

# Review a sample change
echo ""
echo "=== Sample Change ==="
git diff --stat HEAD~1 | head -5
git diff HEAD~1 -- $(git diff --name-only HEAD~1 | head -1) | head -50
```

#### Step 4.4: Handle Any Issues

```bash
# If tests fail, investigate
if ! npm test; then
  echo "❌ Tests failed. Investigating..."

  # Find which tests failed
  npm test 2>&1 | grep "FAIL\|●" | head -20

  # You may need to:
  # 1. Retry that specific agent
  # 2. Manually fix the issue
  # 3. Add diagnostic output to tests
fi

# If typecheck fails, investigate
if ! npm run typecheck; then
  echo "❌ TypeScript errors. Investigating..."
  npm run typecheck 2>&1 | head -30
fi
```

---

### Phase 5: Integration (5 minutes)

**Goal**: Create clean commit and push.

#### Step 5.1: Stage All Changes

```bash
# Review what we're about to commit
git status

# Stage all changes
git add -A

# Verify staging
git status

# Show what will be committed
git diff --cached --stat
```

#### Step 5.2: Create Commit

```bash
# Create descriptive commit message
git commit -m "$(cat <<'EOF'
fix(multiple): resolve 11 code-quality TODOs in parallel

RESOLVED:
- TODO-5207: JSON-LD dangerously_set_inner_html (P1)
- TODO-5209: Confirmation defaults true (P2)
- TODO-5210: Discard all loop transaction lock (P2)
- TODO-5211: Missing LRU cache (P2)
- TODO-5212: has_published not tested (P2)
- TODO-5213: Dead code section transforms (P3)
- TODO-5214: Unused version history methods (P3)
- TODO-5215: Unused block type mapper functions (P3)
- TODO-5206: XSS sanitization (P1, Wave 2 dependent)
- TODO-5208: N+1 query optimization (P2, Wave 3 dependent)
- TODO-5216: Missing error handling (P2)

STATS:
- 11 TODOs resolved
- 18 files modified
- 45 new tests added
- 284 lines added, 67 lines removed
- All tests passing (892 total)
- Zero breaking changes

METHOD:
Used parallel agent resolution pattern with dependency analysis.
Execution: Wave 1 (8 parallel) → Wave 2 (2 sequential) → Wave 3 (1 final).
Total time: 16 minutes (estimated sequential: 60 minutes).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

# Verify commit created
git log -1
```

#### Step 5.3: Push Changes

```bash
# Push to feature branch first
git push origin feat/resolve-code-quality-todos

# Or directly to main if approved by team
# git push origin main
```

#### Step 5.4: Verify on Remote

```bash
# Check remote state
git log --oneline -5

# Pull request (if feature branch)
# gh pr create --title "Resolve 11 code-quality TODOs in parallel"
```

---

## Post-Session: Compound Engineering (5 minutes)

After completing your first parallel session, run:

```bash
# Document what you learned
/workflows:compound

# This creates:
# docs/solutions/methodology/parallel-agent-todo-resolution-[date].md

# Capture:
# - How many TODOs resolved
# - What dependencies you found
# - How long each phase took
# - What went well
# - What was tricky
# - Recommendations for next time
```

---

## Quick Troubleshooting

| Problem           | What to Do                                                      |
| ----------------- | --------------------------------------------------------------- |
| Agent incomplete  | Check output, retry with simpler prompt or manual fix           |
| Tests fail        | `npm test 2>&1 \| grep FAIL`, fix issue, re-run                 |
| TypeScript errors | `npm run typecheck 2>&1 \| head -30`, add types, re-run         |
| File conflicts    | Should not happen with good dependency analysis; merge manually |
| Too slow          | Reduce number of agents per wave (3-4 is sweet spot)            |

---

## Timing Reference (Your Session)

```
Total elapsed: 45-60 minutes

Phase 1 (Inventory):      8-10 min
Phase 2 (Planning):       12-15 min
Phase 3 (Execution):      5-8 min
Phase 4 (Validation):     8-12 min
Phase 5 (Integration):    3-5 min
Post-session (Compound):  5 min
```

**Parallel time: 45-60 min**
**Sequential estimate: 2-3 hours**
**Time savings: 60-75%**

---

## Next Steps

After your first successful session:

1. **Document your learnings** using `/workflows:compound`
2. **Update this guide** if you found easier approaches
3. **Add your example TODOs** to `PARALLEL-AGENT-CODE-EXAMPLES.md`
4. **Share with team** - show them the time savings!

---

## Resources

| Document                                    | Purpose                                  |
| ------------------------------------------- | ---------------------------------------- |
| `PARALLEL-AGENT-TODO-RESOLUTION-PATTERN.md` | Complete reference (bookmark)            |
| `PARALLEL-AGENT-QUICK-REFERENCE.md`         | Print and pin next to monitor            |
| `PARALLEL-AGENT-CODE-EXAMPLES.md`           | See real patterns from 50+ resolutions   |
| `PARALLEL-AGENT-WORKFLOW-BEST-PRACTICES.md` | Advanced strategies for complex projects |
| This file                                   | Your first-session guide                 |

---

## You're Ready!

You now have:

- ✅ Understanding of the 5-phase workflow
- ✅ Real code examples to reference
- ✅ Quick reference guide for in-the-moment decisions
- ✅ Step-by-step implementation guide (this document)

**Time to your first parallel resolution: < 1 hour**

Go resolve those TODOs! 🚀
