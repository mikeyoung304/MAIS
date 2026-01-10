# Multi-Agent Code Review Prevention Strategies

**Date:** 2026-01-09
**Status:** ACTIVE (use for all significant commits)
**Related Commands:** `/workflows:review`, `/triage`, `/resolve_todo_parallel`

This document captures key learnings and prevention strategies for effective multi-agent code review workflows. These strategies emerge from production experience with the compound-engineering plugin's parallel review system.

---

## Executive Summary

Multi-agent code review dramatically improves code quality by running specialized reviewers in parallel. Key learnings:

1. **Specialized reviewers catch domain-specific issues** - Data Integrity Guardian found TOCTOU races that other reviewers missed
2. **Parallel execution makes comprehensive review feasible** - 6+ agents running simultaneously
3. **Structured todo file creation ensures findings are actionable** - Use file-todos skill immediately
4. **P1/P2/P3 severity classification helps prioritization** - Critical issues block merge

---

## When to Use Multi-Agent Review

### Required (Always Run)

| Trigger                    | Why Multi-Agent Review                                         |
| -------------------------- | -------------------------------------------------------------- |
| **Database migrations**    | Data integrity, rollback safety, lock risks                    |
| **Agent tool changes**     | Trust tier validation, executor registration, tenant isolation |
| **Authentication changes** | Security vulnerabilities, token handling, auth fallbacks       |
| **Multi-tenant queries**   | Data isolation, composite keys, tenantId in where clauses      |
| **API contract changes**   | Breaking changes, field mapping, response validation           |

### Recommended (Run When Practical)

| Trigger                         | Why Multi-Agent Review                              |
| ------------------------------- | --------------------------------------------------- |
| **Large PRs (>300 lines)**      | Multiple reviewers catch different issues           |
| **Cross-cutting changes**       | Architecture + security + performance concerns      |
| **New feature implementations** | Agent parity, accessibility, performance            |
| **Refactoring**                 | Behavior preservation, simplification opportunities |
| **Pre-release**                 | Comprehensive quality gate                          |

### Skip (Single Reviewer Sufficient)

- Documentation-only changes
- Dependency version bumps (automated)
- Config file updates
- Test-only additions (unless complex)

---

## Key Learning 1: Specialized Reviewers Find Domain-Specific Issues

### The Pattern

Different reviewers have different expertise. Run ALL relevant reviewers in parallel - they find non-overlapping issues.

### Evidence from Production

| Reviewer                    | Issue Found                      | Would Others Catch?                        |
| --------------------------- | -------------------------------- | ------------------------------------------ |
| **data-integrity-guardian** | TOCTOU race on JSON field update | NO - requires database expertise           |
| **security-sentinel**       | Auth fallback vulnerability      | MAYBE - TypeScript reviewer might miss     |
| **performance-oracle**      | N+1 query in agent tool          | NO - requires performance expertise        |
| **architecture-strategist** | Circular dependency in executor  | NO - requires system design view           |
| **agent-native-reviewer**   | Missing executor registration    | NO - requires agent architecture knowledge |

### Prevention Strategy

**Always include these reviewers for MAIS commits:**

```markdown
## Required Reviewers by Change Type

### Database Changes

- data-integrity-guardian (REQUIRED)
- data-migration-expert (if migration)
- performance-oracle (query analysis)

### Agent/Tool Changes

- agent-native-reviewer (REQUIRED)
- security-sentinel (trust tier validation)
- architecture-strategist (circular dependencies)

### Authentication/Security

- security-sentinel (REQUIRED)
- data-integrity-guardian (PII handling)
- architecture-strategist (auth flow design)

### UI/Frontend Changes

- kieran-typescript-reviewer (REQUIRED)
- julik-frontend-races-reviewer (async/race conditions)
- performance-oracle (bundle size, rendering)

### API Changes

- kieran-typescript-reviewer (REQUIRED)
- architecture-strategist (contract design)
- security-sentinel (input validation)
```

### Implementation

```bash
# Run full review with all agents
/workflows:review PR_NUMBER

# OR manually invoke specific agents in parallel
Task data-integrity-guardian(PR content)
Task security-sentinel(PR content)
Task agent-native-reviewer(PR content)
Task performance-oracle(PR content)
```

---

## Key Learning 2: Parallel Execution Makes Comprehensive Review Feasible

### The Pattern

Sequential review of 10+ aspects is slow and exhausting. Parallel execution completes faster and maintains reviewer focus.

### Evidence from Production

| Approach       | Time for 10 Aspects | Quality                  |
| -------------- | ------------------- | ------------------------ |
| **Sequential** | 45-60 minutes       | Fatigue in later aspects |
| **Parallel**   | 10-15 minutes       | Consistent depth         |

### Prevention Strategy

**Parallel Agent Invocation Pattern:**

```markdown
<parallel_tasks>

Run ALL agents simultaneously:

1. Task kieran-typescript-reviewer(PR content)
2. Task security-sentinel(PR content)
3. Task performance-oracle(PR content)
4. Task data-integrity-guardian(PR content)
5. Task architecture-strategist(PR content)
6. Task agent-native-reviewer(PR content)
7. Task code-simplicity-reviewer(PR content)

</parallel_tasks>
```

**Benefits:**

- Each agent maintains full context (not fatigued)
- Issues discovered independently (no priming bias)
- Total time = longest agent, not sum of all
- Natural de-duplication during synthesis

### Implementation in `/workflows:review`

The command automatically parallelizes agents. To customize:

```bash
# Full parallel review (default)
/workflows:review 123

# Subset for quick check
/workflows:review 123 --agents="security,data-integrity"
```

---

## Key Learning 3: Structured Todo Files Ensure Actionability

### The Pattern

Findings that aren't captured as todos get lost. Create todo files immediately - not after discussion.

### Anti-Pattern (Don't Do This)

```markdown
## Review Findings

1. Found TOCTOU race in storefront tool
2. Missing tenantId in query
3. Auth fallback vulnerability

Should I create todos for these?
```

**Problem:** User might say "later" and findings are lost.

### Correct Pattern (Do This)

```markdown
## Created Todo Files

| File                                 | Severity | Finding                        |
| ------------------------------------ | -------- | ------------------------------ |
| `697-pending-p1-toctou-race.md`      | P1       | TOCTOU race in storefront tool |
| `698-pending-p1-missing-tenantid.md` | P1       | Missing tenantId in query      |
| `699-pending-p1-auth-fallback.md`    | P1       | Auth fallback vulnerability    |

All findings captured. Next steps:

1. Review P1 todos immediately
2. Run `/triage` for prioritization
3. Use `/resolve_todo_parallel` to fix
```

### Prevention Strategy

**Todo Creation Workflow:**

```markdown
1. **Synthesize findings** - Collect from all agents, categorize, assign severity
2. **Create todos IMMEDIATELY** - Don't wait for user approval
3. **Use standard template** - From file-todos skill
4. **Include actionable details:**
   - Problem Statement (what's broken)
   - Findings (evidence/location)
   - Proposed Solutions (2-3 options with tradeoffs)
   - Acceptance Criteria (testable checklist)
5. **Report summary** - List all created todos with links
```

**Naming Convention:**

```
{issue_id}-{status}-{priority}-{description}.md

Examples:
697-pending-p1-toctou-race-storefront-tool.md
698-pending-p2-performance-n-plus-1-query.md
699-pending-p3-code-cleanup-unused-import.md
```

---

## Key Learning 4: P1/P2/P3 Severity Classification

### The Pattern

Not all findings are equal. Classify by severity to focus effort.

### Severity Definitions

| Severity              | Criteria                                                                    | Action                                                 |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| **P1 (Critical)**     | Blocks merge. Security vulnerability, data corruption, breaking change      | Fix immediately. No exceptions.                        |
| **P2 (Important)**    | Should fix. Performance issue, architectural concern, major quality problem | Fix before next release. May defer with justification. |
| **P3 (Nice-to-Have)** | Enhancement. Minor cleanup, optimization opportunity, documentation         | Fix when convenient. Can defer indefinitely.           |

### Examples from MAIS

| Finding                       | Severity | Rationale                                    |
| ----------------------------- | -------- | -------------------------------------------- |
| Missing tenantId in query     | **P1**   | Data leak, multi-tenant isolation failure    |
| Auth fallback `\|\| 'system'` | **P1**   | Security vulnerability, privilege escalation |
| TOCTOU race on JSON field     | **P1**   | Data corruption, race condition              |
| N+1 query in agent tool       | **P2**   | Performance, but not blocking                |
| Unused import                 | **P3**   | Cleanup, no functional impact                |
| Missing JSDoc                 | **P3**   | Documentation, developer experience          |

### Prevention Strategy

**Severity Assignment Checklist:**

```markdown
## P1 (Critical) - Must Have ALL:

- [ ] Impacts production data or security
- [ ] Cannot be worked around
- [ ] Risk is immediate (not theoretical)

## P2 (Important) - Has ANY:

- [ ] Performance degradation >10%
- [ ] Architectural violation
- [ ] Maintenance burden increase
- [ ] User experience impact

## P3 (Nice-to-Have) - DEFAULT:

- [ ] No immediate impact
- [ ] Improves code quality
- [ ] Could be deferred
```

---

## Workflow Integration

### Complete Review Workflow

```bash
# 1. Start multi-agent review
/workflows:review 123

# 2. Review created todos
ls todos/*-pending-*.md

# 3. Triage findings (interactive prioritization)
/triage

# 4. Resolve approved todos in parallel
/resolve_todo_parallel

# 5. Verify fixes
npm test
npm run typecheck

# 6. Update todo status
# Rename files: pending → complete
```

### PR Workflow Integration

**Before Creating PR:**

```bash
# Run review on current branch
/workflows:review

# Address all P1 findings before PR
/resolve_todo_parallel --priority=p1

# Verify no P1 todos remain
ls todos/*-pending-p1-*.md  # Should be empty
```

**During PR Review:**

```bash
# Human reviewer runs multi-agent review
/workflows:review 123

# Discuss P2/P3 findings in PR comments
# P1 findings block merge
```

**After Merge:**

```bash
# Clean up completed todos
git rm todos/*-complete-*.md
git commit -m "chore: clean up resolved todos"
```

---

## Reviewer Selection Guide

### For MAIS Codebase

| Change Type         | Required Reviewers                                                            | Optional Reviewers      |
| ------------------- | ----------------------------------------------------------------------------- | ----------------------- |
| **Backend routes**  | kieran-typescript-reviewer, security-sentinel                                 | performance-oracle      |
| **Database/Prisma** | data-integrity-guardian, kieran-typescript-reviewer                           | data-migration-expert   |
| **Agent tools**     | agent-native-reviewer, security-sentinel, architecture-strategist             | performance-oracle      |
| **Next.js pages**   | kieran-typescript-reviewer, julik-frontend-races-reviewer                     | performance-oracle      |
| **API contracts**   | kieran-typescript-reviewer, architecture-strategist                           | security-sentinel       |
| **Auth changes**    | security-sentinel, kieran-typescript-reviewer                                 | architecture-strategist |
| **Migrations**      | data-integrity-guardian, data-migration-expert, deployment-verification-agent |                         |

### Reviewer Strengths

| Reviewer                          | Primary Expertise                             | Unique Catches                                       |
| --------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| **data-integrity-guardian**       | ACID, transactions, referential integrity     | TOCTOU races, missing constraints, cascade bugs      |
| **security-sentinel**             | Auth, injection, secrets                      | Fallback vulnerabilities, input validation gaps      |
| **agent-native-reviewer**         | Tool registration, trust tiers, action parity | Missing executors, wrong trust tier, UI gaps         |
| **performance-oracle**            | Queries, caching, bundle size                 | N+1, missing indexes, memory leaks                   |
| **architecture-strategist**       | System design, dependencies, patterns         | Circular imports, layer violations, coupling         |
| **code-simplicity-reviewer**      | Complexity, readability, maintainability      | Over-engineering, dead code, DRY violations          |
| **kieran-typescript-reviewer**    | TypeScript, React, best practices             | Type safety, hook rules, component patterns          |
| **julik-frontend-races-reviewer** | Async, race conditions, state                 | Effect order bugs, unmounted updates, debounce races |

---

## Quick Reference Checklist

### Before Running `/workflows:review`

- [ ] Current branch has all changes (committed or staged)
- [ ] Tests pass locally
- [ ] No uncommitted changes that need review

### During Review

- [ ] All required reviewers for change type included
- [ ] Agents running in parallel (not sequential)
- [ ] Findings being captured as todo files immediately

### After Review

- [ ] All P1 findings have todo files
- [ ] P1 todos addressed before merge
- [ ] Todo files committed to repository
- [ ] Status updated (pending -> complete)

### Code Review Comment Template

```markdown
## Multi-Agent Review Complete

**Reviewers:** data-integrity-guardian, security-sentinel, agent-native-reviewer, kieran-typescript-reviewer

**Summary:**

- **P1 (Critical):** 2 findings - BLOCKS MERGE
- **P2 (Important):** 3 findings
- **P3 (Nice-to-Have):** 5 findings

**Created Todos:**

- `697-pending-p1-toctou-race.md`
- `698-pending-p1-missing-tenantid.md`
- [full list in todos/]

**Required Action:** Address P1 findings before merge.
```

---

## Related Documentation

- **[/workflows:review command](~/.claude/plugins/every-marketplace/plugins/compound-engineering/commands/workflows/review.md)** - Full command specification
- **[data-integrity-guardian agent](~/.claude/plugins/every-marketplace/plugins/compound-engineering/agents/review/data-integrity-guardian.md)** - Database review expertise
- **[file-todos skill](~/.claude/skills/file-todos/)** - Todo file management
- **[CODE_REVIEW_PREVENTION_INDEX.md](CODE_REVIEW_PREVENTION_INDEX.md)** - Route ordering, auth fallbacks, tenant isolation patterns
- **[PREVENTION_STRATEGIES_CODE_REVIEW_PATTERNS.md](PREVENTION_STRATEGIES_CODE_REVIEW_PATTERNS.md)** - Detailed P0 patterns with detection rules

---

## Version History

| Date       | Change                                              |
| ---------- | --------------------------------------------------- |
| 2026-01-09 | Initial creation from code review session learnings |

**Next Review:** 2026-02-09 (monthly)
**Owner:** Engineering Team
