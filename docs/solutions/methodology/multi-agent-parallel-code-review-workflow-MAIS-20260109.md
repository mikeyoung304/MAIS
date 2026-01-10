---
title: Multi-Agent Parallel Code Review Workflow
category: methodology
tags:
  [
    multi-agent-review,
    code-review,
    parallel-agents,
    security,
    data-integrity,
    workflows,
    compound-engineering,
  ]
severity: reference
date_solved: 2026-01-09
components:
  - server/src/services
  - server/src/agent
  - apps/web/src/components
symptoms:
  - Need comprehensive code review covering multiple dimensions
  - Want to catch issues that single-perspective reviews miss
  - Complex commit or PR with changes across security, performance, architecture
review_methodology: parallel-specialized-agents
agents_deployed: 6
commit_reviewed: 5cd5bfb1
---

# Multi-Agent Parallel Code Review Workflow

## Summary

This document captures the multi-agent parallel review workflow used via `/workflows:review`, demonstrating how specialized agents running in parallel catch issues that single-perspective reviews miss.

## The Key Insight

**Specialized parallel review catches issues that generalist reviews miss.**

Example: In commit 5cd5bfb1, the Data Integrity Guardian found a P1 TOCTOU race condition in `appointment-booking.service.ts` that five other specialized reviewers (TypeScript, Security, Architecture, Performance, Simplicity) did not flag. Each agent has domain-specific heuristics that surface different classes of issues.

## Workflow Process

### Step 1: Invoke the Review Command

```bash
/workflows:review 5cd5bfb1
```

The command accepts: PR number, GitHub URL, branch name, commit hash, or "latest"

### Step 2: Parallel Agent Deployment

Six specialized review agents launch simultaneously:

| Agent                         | Focus Area                        | What It Catches                                              |
| ----------------------------- | --------------------------------- | ------------------------------------------------------------ |
| **TypeScript/React Reviewer** | Type safety, React patterns       | Unsafe type assertions, missing type guards, hook violations |
| **Security Sentinel**         | Auth, input validation, injection | XSS patterns, CSRF, injection vectors, auth bypass           |
| **Architecture Strategist**   | System design, DI, layering       | DI violations, circular deps, layer boundary violations      |
| **Performance Oracle**        | N+1, caching, indexes             | Missing indexes, redundant queries, cache misses             |
| **Code Simplicity Reviewer**  | DRY, complexity, dead code        | Duplicated components, over-engineering, unused exports      |
| **Data Integrity Guardian**   | Transactions, constraints, races  | TOCTOU races, missing locks, constraint violations           |

### Step 3: Independent Analysis

Each agent:

1. Searches the codebase using targeted grep/glob patterns
2. Reads relevant source files identified by their search
3. Applies domain-specific heuristics and best practices
4. Documents findings with file paths, line numbers, and severity
5. Proposes concrete solutions with acceptance criteria

### Step 4: Findings Synthesis

Results are:

- **Collected** into a unified findings set
- **Deduplicated** to remove overlapping issues
- **Prioritized** using P1/P2/P3 severity levels
- **Categorized** by tags (security, performance, data-integrity, etc.)

### Step 5: Todo Creation

Each finding becomes a todo file in `todos/`:

```
{id}-pending-{priority}-{description}.md
```

Example outputs from commit 5cd5bfb1:

- `708-pending-p1-maxperday-toctou-race-condition.md`
- `709-pending-p2-panelchat-unsafe-type-assertion.md`
- `711-pending-p2-message-bubble-component-duplication.md`
- `714-pending-p3-xss-bypass-patterns-review.md`

## Findings from Session (2026-01-09)

### P1 - Critical (Blocks Merge)

| ID  | Issue                           | Found By                |
| --- | ------------------------------- | ----------------------- |
| 708 | maxPerDay TOCTOU race condition | Data Integrity Guardian |

The race condition allows concurrent booking requests to exceed `maxPerDay` limits because the count check and booking creation are not atomic.

### P2 - Important

| ID  | Issue                                            | Found By                 |
| --- | ------------------------------------------------ | ------------------------ |
| 709 | Unsafe type assertion in PanelAgentChat          | TypeScript Reviewer      |
| 710 | Missing Zod validation caching in getDraftConfig | Architecture Strategist  |
| 711 | MessageBubble component duplication              | Code Simplicity Reviewer |
| 712 | ProposalCard component duplication               | Code Simplicity Reviewer |

### P3 - Nice-to-Have

| ID  | Issue                                | Found By                |
| --- | ------------------------------------ | ----------------------- |
| 714 | XSS bypass patterns need review      | Security Sentinel       |
| 715 | Unused type exports cleanup          | TypeScript Reviewer     |
| 716 | Callback memoization recommendations | Performance Oracle      |
| 717 | Quota increment minor overcount      | Data Integrity Guardian |

## Why Parallel Specialized Review Works

### 1. Domain Expertise Depth

Each agent applies hundreds of domain-specific heuristics that a generalist review would miss or deprioritize:

- **Data Integrity Guardian** knows to check for TOCTOU patterns in any check-then-act code
- **Security Sentinel** tests for 7+ XSS bypass techniques including HTML entities and null bytes
- **Code Simplicity Reviewer** measures component similarity to detect near-duplicates

### 2. No Cognitive Load Sharing

Parallel execution means each agent has full context window for their domain, rather than splitting attention across all concerns.

### 3. Speed Through Parallelism

Six agents analyzing simultaneously complete faster than one agent analyzing serially.

### 4. Cross-Validation

Multiple agents may flag the same issue from different angles, increasing confidence. Overlaps are deduplicated during synthesis.

## How to Use This Workflow

### For Commit Review

```bash
/workflows:review <commit-hash>
```

### For PR Review

```bash
/workflows:review <pr-number>
/workflows:review https://github.com/org/repo/pull/123
```

### For Current Branch

```bash
/workflows:review latest
```

### Follow-Up Commands

After review completes:

```bash
# View all pending findings
ls todos/*-pending-*.md

# Interactive triage (prioritize and approve)
/triage

# Resolve approved todos in parallel
/resolve_todo_parallel
```

## Prevention Strategies Derived

Based on patterns observed in this review:

### TOCTOU Prevention Checklist

- [ ] Any check-then-act pattern wrapped in transaction?
- [ ] Advisory lock acquired for concurrent access scenarios?
- [ ] Unique constraint as fallback for race conditions?

### Type Safety Checklist

- [ ] All `as Type` assertions have runtime validation?
- [ ] Zod schemas used for external data parsing?
- [ ] Type guards used for discriminated unions?

### DRY Checklist

- [ ] Similar components abstracted with variants?
- [ ] Shared logic extracted to utils/hooks?
- [ ] Near-duplicate code detected and consolidated?

## Related Documentation

- [Multi-Agent Code Review Process](/docs/solutions/methodology/multi-agent-code-review-process.md) - Original methodology doc
- [ADR-013: Advisory Locks](/docs/adrs/ADR-013-advisory-locks.md) - Pattern for preventing TOCTOU
- [TOCTOU Prevention Strategies](/docs/solutions/patterns/STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md) - Broader TOCTOU prevention

## Appendix: Agent Definitions

The review agents are defined in the compound-engineering plugin:

```
~/.claude/plugins/every-marketplace/plugins/compound-engineering/agents/review/
```

Each agent has:

- Specialized system prompt with domain expertise
- Pattern matching for relevant file types
- Severity classification heuristics
- Solution templates for common issues
