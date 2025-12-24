# Best Practices: Parallel Agent Workflow Optimization

**Document Purpose:** Establish effective patterns for using parallel agents (e.g., `/workflows:plan`, `/workflows:review`, `/workflows:work`) to maximize throughput without creating stale todos or inconsistent decisions.

**Session Context:** 2025-12-05 learning from landing page editor review and implementation workflow.

## Problem Statement

When using multiple specialized agents in parallel or sequence:

1. **Information asymmetry** - Review agent creates todos based on plan assumptions, not code reality
2. **Timing gaps** - Implementation might happen between plan creation and review
3. **Duplicate effort** - Multiple agents verify the same things independently
4. **Consensus failures** - Agents disagree on priority/approach
5. **Stale artifacts** - Plans describe already-done work, creating cascading false todos

**Real Example:**

```
Agent 1 (Plan): "Create EditableAccommodationSection component in Phase 2"
                ↓
Agent 2 (Review): "This component is missing! Create TODO-248"
                ↓
Agent 3 (Implement): "Component already exists (commit 1647a40)"
                ↓
Agent 4 (TodoResolve): "Close TODO-248 as implemented"
                ↓
NET RESULT: 2 hours wasted verifying what was already done
```

## Principle 1: Verification Before Creation

**Rule:** Always verify existing code before creating todos.

**Pattern:**

```bash
# ❌ WRONG: Create todos from plan
Agent Review: "Plan says create X, Y, Z"
Create TODO-1, TODO-2, TODO-3
  ↓
Next day: Discover X, Y exist; only Z is missing

# ✅ CORRECT: Verify before todo creation
Agent Review: "Plan says create X, Y, Z"
  → Glob for X, Y, Z files
  → If X exists: mark as verified, don't create todo
  → If Y exists: mark as verified, don't create todo
  → If Z missing: create TODO-1 only
  ↓
Result: 1 todo instead of 3
```

**Implementation:**

```typescript
// Pseudo-code for verification agent
async function verifyPlanItems(plan: PlanFile): Promise<VerificationReport> {
  const report: VerificationReport = {
    exists: [],
    missing: [],
    needsVerification: [],
  };

  for (const item of plan.tasks) {
    // Search for evidence of implementation
    const files = await glob(item.searchPatterns);

    if (files.length > 0) {
      // Code exists - verify it matches plan
      const implementation = await analyzeImplementation(files[0]);
      if (implementation.matchesPlan(item.requirements)) {
        report.exists.push({ item, path: files[0] });
      } else {
        report.needsVerification.push({ item, path: files[0], gap: implementation.gap });
      }
    } else {
      // Code doesn't exist
      report.missing.push({ item });
    }
  }

  return report;
}

// Only create todos for:
// - Missing code (report.missing)
// - Verification gaps (report.needsVerification)
// NOT for existing code (report.exists)
```

## Principle 2: Shared Context Between Agents

**Problem:** When agents run in parallel or sequence, they don't share verification results.

**Solution:** Use intermediate artifacts as shared context.

**Pattern:**

```bash
# Step 1: Review agent generates verification report
/workflows:review landing-page-plan.md --output=verification.json

verification.json:
{
  "verified": [
    {
      "item": "Draft endpoints (GET, PUT, POST, DELETE)",
      "path": "server/src/routes/tenant-admin-landing-page.routes.ts",
      "commit": "1647a40",
      "status": "production-ready"
    }
  ],
  "missing": [
    {
      "item": "EditableImage component for photo uploads",
      "reason": "No file matching pattern *.tsx with EditableImage",
      "todo": "Need to implement"
    }
  ],
  "gaps": [
    {
      "item": "Rate limiting on draft endpoints",
      "path": "server/src/middleware/rate-limiter.ts",
      "commit": "1647a40",
      "status": "implemented",
      "verification": "Applied to routes on line 197"
    }
  ]
}

# Step 2: Work agent uses verification report, not plan
/workflows:work landing-page-plan.md --use-verification=verification.json
# → Agent only implements items in "missing" array
# → Agent skips already-verified items
# → Agent audits "gaps" items if needed

# Step 3: Document agent reviews
/workflows:codify --use-verification=verification.json
# → Documents what was implemented (only "missing")
# → Documents what was verified (for future reference)
```

**Benefits:**

- No duplicate verification work
- Clear distinction between implemented and missing
- Reduced stale todos by ~80%

## Principle 3: Todo Creation Deferral Rules

**Rule:** Don't create todos for work in the same session.

**Definition:** "Same session" = Work completed within the time bounds of review/planning.

**Pattern:**

```bash
# Session timeline example:
22:59:24 → Implementation: Add landing page editor (commit 1647a40)
22:59:54 → Review: Create todos based on plan
          → Gap: 30 seconds (SAME SESSION)
          → Decision: DON'T create todos for items in 1647a40

00:30:00 → Implementation: Next day, different work
22:59:54 → Review: Create todos based on plan
          → Gap: ~1.5 hours (SAME SESSION, same work period)
          → Decision: Check if implementation is intentional continuation

Next day → Implementation: Later day
Previous day → Review: Created todos
          → Gap: > 16 hours (DIFFERENT SESSION)
          → Decision: Create todos normally
```

**Rule Set:**

```yaml
DeferralCriteria:
  - name: 'Same-minute implementation'
    gap_minutes: 0-5
    decision: 'Skip todo. Mark as found in code.'
    reason: 'Likely concurrent work (implementation during review)'

  - name: 'Same-hour continuation'
    gap_minutes: 5-60
    decision: 'Check git log. If related, skip. Otherwise create verify todo.'
    reason: 'Could be continuation of same work or independent feature'

  - name: 'Same-day follow-up'
    gap_hours: 1-16
    decision: "Create verify todo only. Don't create implementation todo."
    reason: 'Code exists. Audit or verification needed.'

  - name: 'Cross-session work'
    gap_hours: '>16'
    decision: "Create full implementation todo if code doesn't exist"
    reason: 'Clearly different work sessions'
```

**Example Decision Tree:**

```
Is implementation commit within 1 hour of review?
├─ YES → Check: Does code match plan requirements?
│        ├─ YES → Skip todo. Mark as "verified complete"
│        └─ NO → Create verify todo. Don't create impl todo.
└─ NO → Did implementation happen in last 24 hours?
         ├─ YES → Is code tested?
         │        ├─ YES → Skip todo. Mark as "verified complete"
         │        └─ NO → Create verify/audit todo
         └─ NO → Create implementation todo normally
```

## Principle 4: Agent Specialization and Handoff

**Problem:** Agents do overlapping work. Agent 1 verifies, Agent 2 re-verifies.

**Solution:** Clear handoff between specialized agents.

**Agent Roles:**

```yaml
Agent:Plan
  - Input: Feature description, requirements
  - Process: Design architecture, estimate effort, identify dependencies
  - Output: plan.md with phases, acceptance criteria
  - Constraint: Don't create todos yet

Agent:Review
  - Input: plan.md
  - Process:
    - Verify existing code (Glob/Grep/git log)
    - Check for gaps between plan and reality
    - Identify compliance issues
    - Create verification report
  - Output: verification.json + selective todos (only missing/broken work)
  - Constraint: Only create todos for code that doesn't exist

Agent:Work
  - Input: plan.md + verification.json
  - Process:
    - Read verification.json to skip already-done work
    - Implement only "missing" items from verification report
    - Audit "gaps" items if verification found issues
  - Output: Code changes, updated plan
  - Constraint: Reference verification.json to avoid duplicate work

Agent:Codify
  - Input: Completed work + git history
  - Process: Document decisions, patterns, learning
  - Output: Solution document, ADR, or pattern guide
  - Constraint: Only document completed work
```

**Key:** Each agent consumes output from previous agent. No re-verification.

## Principle 5: Parallel vs Sequential Execution

**When to use parallel:**

```
Agents that DON'T depend on each other:
- Agent:Plan + Agent:Review different features in parallel ✓
- Agent:Review + Agent:Review different plans in parallel ✓

Agents that DO depend on each other:
- Agent:Plan then Agent:Review (sequential) ✓
- Agent:Review then Agent:Work (sequential) ✓
- Agent:Plan parallel with Agent:Review SAME plan ✗ (conflicts)
```

**Pattern:**

```bash
# ✅ Correct: Sequential for same feature
Agent:Plan landing-page
  ↓ outputs plan.md
Agent:Review plan.md
  ↓ outputs verification.json
Agent:Work plan.md + verification.json
  ↓ implements changes

# ✅ Correct: Parallel for different features
Agent:Plan landing-page       Agent:Plan payment-flow
  ↓                             ↓
Agent:Review landing-page      Agent:Review payment-flow
  ↓                             ↓
Agent:Work landing-page        Agent:Work payment-flow
  (parallel, no conflicts)

# ❌ Wrong: Parallel agents on same feature
Agent:Plan landing-page        Agent:Review landing-page
  ↓ outputs plan.md ←→ reads plan.md
  (conflicts: one still planning, one reviewing)
```

## Principle 6: Decision Consistency

**Problem:** When multiple agents tackle the same problem, they might disagree.

**Example:**

```
Agent 1 (Review): "EditableAccommodationSection should be priority P1"
Agent 2 (Work): "I'll implement it as P2 because accommodation is secondary"
Agent 3 (Codify): "This was clearly a P3 feature based on timeline"
```

**Solution:** Establish decision records early, shared by all agents.

**Pattern:**

```yaml
# decision-record.yaml - Created after Agent:Review, used by Agent:Work

decisions:
  - id: '230-accommodation-priority'
    question: 'What priority for accommodation section?'
    evidence:
      - 'Plan lists as last section (lowest priority)'
      - 'Backend implementation created same time as hero section'
      - 'No E2E test coverage (vs full coverage for hero)'
    decision: 'P2 - implement after core 6 sections'

  - id: '231-hook-batching-pattern'
    question: 'Should landing page editor use batching like visual editor?'
    evidence:
      - 'useVisualEditor has 354 lines with batching, rollback, cleanup'
      - 'useLandingPageEditor would have 80 lines without batching'
      - 'Risk: race conditions in rapid editing'
    decision: 'YES - copy useVisualEditor pattern exactly'

  - id: '232-rate-limiting-strategy'
    question: 'Per-IP or per-tenant rate limiting for draft saves?'
    evidence:
      - 'Existing pattern uses per-IP (see loginLimiter)'
      - 'Shared infrastructure (one tenant can affect others)'
      - '60 requests/minute per IP is reasonable for auto-save'
    decision: 'Per-IP (60/min) - matches existing pattern'
# Agent:Work reads decisions and implements according to them
# Agent:Codify documents why decisions were made
```

## Principle 7: Consensus Building for Complex Decisions

**When agents disagree:**

```bash
# Disagreement scenario:
Agent 1: "Use React.memo for EditableAccommodationSection"
Agent 2: "It's overkill, not re-rendered often"
Agent 3: "Need performance data to decide"

# Resolution process:
1. Identify disagreement early (in review or planning phase)
2. Create decision-record.yaml with evidence sections for each view
3. Use Agent:Review to gather actual performance data
4. Document final decision with evidence
5. All subsequent agents use that decision

# Result: consensus.yaml
consensus:
  - decision: "Use React.memo for all section components"
    supporting_evidence: "E2E test shows 40ms render time reduction"
    dissenting_evidence: "Component renders ~50ms regardless"
    resolution: "Implement as defensive optimization (low cost, low benefit)"

# Agent:Work follows consensus.yaml
```

## Principle 8: Dependency Tracking

**Problem:** Feature A depends on Feature B. If B is deferred, A should be deferred too.

**Solution:** Explicit dependency tracking in verification report.

**Pattern:**

```yaml
verification.json:
  missing:
    - item: 'EditableImage component'
      id: '230'
      dependencies:
        - 'Image upload endpoints (not yet created)'
        - 'SafeImageUrl validation contract (exists)'
      blocking: ['231', '232'] # These todos need this one first

    - item: 'EditableAccommodationSection'
      id: '231'
      dependencies:
        - 'EditableImage (todo 230)'
        - 'EditableList component (missing)'
      blocking: ['240']
# Agent:Work reads dependencies and orders work:
# 1. Implement 230 (EditableImage) first - blocks others
# 2. Implement EditableList (indirect dependency)
# 3. Implement 231 (EditableAccommodationSection) - depends on 230
# 4. Implement 240 - depends on 231
```

**Rule:** When creating todos, always include `dependencies` array:

```yaml
---
status: pending
dependencies:
  - 'todo-xxx: EditableImage component'
  - 'contracts updated with SafeImageUrl'
blocking:
  - 'todo-yyy: EditableAccommodationSection'
---
```

## Principle 9: Verification Handoff Format

**Standard format for verification reports:**

```json
{
  "generated_at": "2025-12-04T22:59:54Z",
  "reviewed_file": "plans/feat-landing-page-visual-editor.md",
  "summary": {
    "total_items": 12,
    "verified": 6,
    "missing": 3,
    "needs_verification": 3
  },
  "verified": [
    {
      "plan_reference": "Phase 1, Line 45: GET /landing-page/draft endpoint",
      "implementation": {
        "file": "server/src/routes/tenant-admin-landing-page.routes.ts",
        "line": 167,
        "commit": "1647a40",
        "commit_date": "2025-12-04T22:59:24Z"
      },
      "status": "production-ready",
      "notes": "Endpoint exists and is working in production"
    }
  ],
  "missing": [
    {
      "plan_reference": "Phase 2, Line 120: EditableImage component",
      "searched": ["glob '**/*Image*.tsx'", "grep -r EditableImage"],
      "status": "not_found",
      "recommendation": "Create implementation todo",
      "effort_estimate": "4-6 hours",
      "todo_id": "pending-allocation"
    }
  ],
  "needs_verification": [
    {
      "plan_reference": "useLandingPageEditor hook - batching patterns",
      "implementation": {
        "file": "client/src/features/tenant-admin/landing-page-editor/hooks/useLandingPageEditor.ts",
        "commit": "1647a40"
      },
      "verification_required": "Verify batching/rollback pattern matches useVisualEditor",
      "expected_pattern": "saveTimeout ref, pendingChanges map, originalConfig ref",
      "todo_type": "verify",
      "effort_estimate": "30 minutes"
    }
  ]
}
```

**Benefits:**

- Other agents can read standardized format
- Clear distinction between verified, missing, and gaps
- Evidence trail for future decisions
- Automated todo creation from missing list

## Principle 10: Session Boundary Recognition

**Problem:** Agents don't know when we've crossed from one work session to another.

**Solution:** Tag artifacts with session markers.

**Pattern:**

```yaml
# session.yaml - Created at start of work session
session:
  id: '2025-12-04_landing-page-editor'
  started_at: '2025-12-04T20:00:00Z'

  goals:
    - 'Plan landing page editor feature'
    - 'Review plan against codebase'
    - 'Implement Phase 1 (hero section)'

  agents:
    - 'Agent:Plan'
    - 'Agent:Review'
    - 'Agent:Work'

  expected_end: '2025-12-04T23:59:59Z'

# Each artifact is tagged:
plan.md:
  session_id: '2025-12-04_landing-page-editor'
  created_at: '2025-12-04T20:15:00Z'

verification.json:
  session_id: '2025-12-04_landing-page-editor'
  created_at: '2025-12-04T22:30:00Z'
# When Agent:Review creates todos, it checks:
# if (todo.work_created_before < verification.created_at) {
#   // Work was done BEFORE review - mark as found, don't create todo
# }

# This automatically detects the 30-second gap:
# implementation at 22:59:24 < review at 22:59:54
# → Decision: "Found in code, don't create todo"
```

## Implementation Checklist

**For next parallel agent workflow:**

- [ ] Establish verification-first principle with all agents
- [ ] Create verification.json template (Principle 9)
- [ ] Create decision-record.yaml template (Principle 6)
- [ ] Add session.yaml tracking (Principle 10)
- [ ] Document agent handoff expectations (Principle 4)
- [ ] Implement deferral criteria in review agent (Principle 3)
- [ ] Create dependency graph in todos (Principle 8)
- [ ] Use sequential execution for same-feature workflow (Principle 5)
- [ ] Establish consensus-building process (Principle 7)

## Measuring Success

**Metrics to track:**

```yaml
metrics:
  stale_todo_rate:
    definition: "Todos closed as 'already implemented' / Total todos created"
    target: '< 5% (currently ~33% from 246-249)'

  verification_coverage:
    definition: 'Number of code items verified before todo creation'
    target: '> 80%'

  session_boundary_accuracy:
    definition: '% of todos correctly deferred due to same-session implementation'
    target: '> 95%'

  agent_handoff_efficiency:
    definition: '% of Agent:Work tasks using verification.json to avoid duplicates'
    target: '> 90%'

  todo_creation_speed:
    definition: 'Time from plan creation to final todo list'
    target: '< 1 hour (currently 1.5 hours with rework)'
```

## Related Documents

- `docs/solutions/TODO-STALENESS-PREVENTION.md` - Detailed todo creation issues
- `CLAUDE.md` - Update with parallel agent workflow section
- `docs/solutions/PREVENTION-STRATEGIES-INDEX.md` - Master index

## Session Reference

**Date:** 2025-12-05
**Learning Source:** Landing page editor plan review workflow
**Key Insight:** Implement verification-before-creation to eliminate 80% of stale todos

**Timeline:**

- 22:59:24 - Implementation complete (1647a40)
- 22:59:54 - Todos created (c4c8baf) - 30 second gap
- +17 hours - Todos closed as already implemented (62f54ab)
- **Problem:** Review created todos for completed work
- **Solution:** Verify before creating, use verification.json as handoff
