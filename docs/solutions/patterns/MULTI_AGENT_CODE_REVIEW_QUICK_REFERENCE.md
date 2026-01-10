# Multi-Agent Code Review Quick Reference

**Print this and pin to your desk!**

---

## When to Run `/workflows:review`

**ALWAYS:**

- Database migrations
- Agent tool changes
- Auth/security changes
- Multi-tenant queries
- API contract changes

**RECOMMENDED:**

- Large PRs (>300 lines)
- Cross-cutting changes
- New features
- Pre-release

---

## Key Learnings

| #   | Learning                                               | Action                                       |
| --- | ------------------------------------------------------ | -------------------------------------------- |
| 1   | **Specialized reviewers catch domain-specific issues** | Run ALL relevant reviewers                   |
| 2   | **Parallel execution is faster**                       | Let agents run simultaneously                |
| 3   | **Todo files ensure actionability**                    | Create todos IMMEDIATELY                     |
| 4   | **P1/P2/P3 severity matters**                          | P1 blocks merge, P2 should fix, P3 can defer |

---

## Reviewer Selection

### By Change Type

| Change              | Required Reviewers                          |
| ------------------- | ------------------------------------------- |
| **Backend routes**  | kieran-typescript + security-sentinel       |
| **Database/Prisma** | data-integrity-guardian + kieran-typescript |
| **Agent tools**     | agent-native + security + architecture      |
| **Next.js pages**   | kieran-typescript + julik-frontend-races    |
| **Auth changes**    | security-sentinel + kieran-typescript       |

### Reviewer Specialties

| Reviewer                    | Catches                                   |
| --------------------------- | ----------------------------------------- |
| **data-integrity-guardian** | TOCTOU, missing constraints, cascade bugs |
| **security-sentinel**       | Auth fallbacks, injection, secrets        |
| **agent-native-reviewer**   | Missing executors, wrong trust tier       |
| **performance-oracle**      | N+1, missing indexes, memory leaks        |
| **architecture-strategist** | Circular imports, layer violations        |

---

## Severity Definitions

| Severity | Criteria                                   | Action                     |
| -------- | ------------------------------------------ | -------------------------- |
| **P1**   | Security, data corruption, breaking change | **Fix now. Blocks merge.** |
| **P2**   | Performance, architecture, major quality   | Fix before release         |
| **P3**   | Cleanup, optimization, documentation       | Fix when convenient        |

---

## Workflow

```bash
# 1. Run review
/workflows:review 123

# 2. Check todos
ls todos/*-pending-*.md

# 3. Triage
/triage

# 4. Fix in parallel
/resolve_todo_parallel

# 5. Verify
npm test && npm run typecheck
```

---

## Anti-Patterns

| Don't                         | Do Instead                     |
| ----------------------------- | ------------------------------ |
| Run reviewers sequentially    | Run all in parallel            |
| Present findings for approval | Create todo files immediately  |
| Skip specialized reviewers    | Include all relevant reviewers |
| Merge with P1 open            | Address all P1 before merge    |
| Forget to commit todos        | `git add todos/` after review  |

---

## Decision Tree

```
Code Review Needed?
|
+-- Database change? --> data-integrity-guardian (REQUIRED)
|
+-- Agent tool? --> agent-native-reviewer (REQUIRED)
|
+-- Auth change? --> security-sentinel (REQUIRED)
|
+-- Large PR? --> All reviewers (RECOMMENDED)
|
+-- Small fix? --> Single reviewer (OK)
```

---

## Quick Commands

```bash
# Full review
/workflows:review PR_NUMBER

# Triage findings
/triage

# Fix all approved todos
/resolve_todo_parallel

# Check P1 todos
ls todos/*-pending-p1-*.md

# Clean up completed
git rm todos/*-complete-*.md
```

---

**Full Guide:** [MULTI_AGENT_CODE_REVIEW_PREVENTION_STRATEGIES.md](MULTI_AGENT_CODE_REVIEW_PREVENTION_STRATEGIES.md)
