# 56 Solution Docs Still Reference Legacy Paths Without Notices

## Metadata

- **ID:** 755
- **Status:** ready
- **Priority:** p2
- **Tags:** code-review, documentation
- **Created:** 2026-01-26
- **Source:** Legacy Agent Migration Review

## Problem Statement

Phase 5 of the legacy agent migration added legacy notices to 4 key index files, but 56 solution documents in `docs/solutions/` still contain references to deleted legacy paths without any notice that the referenced code no longer exists.

**Impact:**

- Confusion when searching for solutions
- Developers may try to find/modify deleted files
- Technical debt in documentation

## Findings

**Documentation Reviewer finding:**

**Files WITH legacy notices (4 files):**

- `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_PREVENTION.md`
- `docs/solutions/patterns/README.md`
- `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_QUICK_REFERENCE.md`
- `docs/solutions/AGENT_PREVENTION_INDEX.md`

**Files WITHOUT legacy notices (high priority, 9 files):**

1. `docs/solutions/CUSTOMER-CHATBOT-PHASE-0-SOLUTIONS.md`
2. `docs/solutions/CUSTOMER_CHATBOT_QUICK_REFERENCE.md`
3. `docs/solutions/CUSTOMER_CHATBOT_PREVENTION_STRATEGIES.md`
4. `docs/solutions/CUSTOMER_CHATBOT_PREVENTION_DELIVERY_SUMMARY.md`
5. `docs/solutions/agent-evaluation-system-remediation-MAIS-20260102.md`
6. `docs/solutions/Phase-6-7-Agent-Evaluation-Solutions-Extract-MAIS-20260102.md`
7. `docs/solutions/PHASE-6-7-INDEX.md`
8. `docs/solutions/SESSION_SUMMARY_20260102.md`
9. `docs/solutions/EXTRACTION_SUMMARY_20260102.md`

**References found:** server/src/agent/orchestrator, server/src/agent/customer, server/src/agent/evals, server/src/agent/feedback

## Proposed Solutions

### Option 1: Add legacy notices to high-impact files (Recommended)

Add standard legacy notice to the 9 high-priority files:

```markdown
> **LEGACY NOTICE (2026-01-26):** This document references code paths that were deleted during the Legacy Agent Migration. The patterns and concepts may still be valuable, but the specific file paths no longer exist. See `server/src/agent-v2/` for the current agent system.
```

**Pros:** Quick, addresses most confusion
**Cons:** Doesn't cover all 56 files
**Effort:** Small (30 min)
**Risk:** None

### Option 2: Archive all legacy solution docs

Move all 56 files to `docs/archive/solutions-legacy-agent/`.

**Pros:** Clean separation
**Cons:** May lose valuable patterns that still apply
**Effort:** Medium (1-2 hours)
**Risk:** Low

### Option 3: Batch update with script

Create script to add legacy notice to all files containing legacy references.

**Pros:** Comprehensive
**Cons:** May add notices to files where not needed
**Effort:** Medium
**Risk:** Low

## Technical Details

**Legacy notice template:**

```markdown
> **LEGACY NOTICE (2026-01-26):** This document references code that was deleted during the Legacy Agent Migration. See `server/src/agent-v2/` for the current agent system. Archive branches: `archive/legacy-agent-orchestrators`, `archive/legacy-evals-feedback`.
```

**Search pattern to find affected files:**

```bash
grep -rn "server/src/agent/orchestrator\|server/src/agent/customer\|server/src/agent/evals\|server/src/agent/feedback" docs/solutions/
```

## Acceptance Criteria

- [ ] High-priority files (9) have legacy notices
- [ ] Notices include migration date and archive branch references
- [ ] No confusion about which code paths are current

## Work Log

| Date       | Action                   | Learnings              |
| ---------- | ------------------------ | ---------------------- |
| 2026-01-26 | Created from code review | Phase 5 was incomplete |

## Resources

- Migration plan: `plans/LEGACY_AGENT_MIGRATION_PLAN.md`
- Archive branches: `archive/legacy-agent-orchestrators`, `archive/legacy-evals-feedback`
