---
title: Multi-Agent Parallel Code Review - Preview Token System Session
category: methodology
tags:
  - multi-agent-review
  - code-review
  - parallel-agents
  - preview-token
  - security
  - data-integrity
  - dry-extraction
  - compound-engineering
severity: reference
components:
  - server/src/lib/preview-tokens.ts
  - server/src/lib/segment-utils.ts
  - server/src/services/landing-page.service.ts
  - server/src/routes/public-tenant.routes.ts
  - server/src/routes/tenant-admin.routes.ts
  - apps/web/src/hooks/usePreviewToken.ts
symptoms:
  - Need comprehensive code review coverage
  - Single reviewer misses domain-specific issues
  - Security + performance + architecture need parallel analysis
root_cause: >
  Specialized expertise in different domains discovers issues that generalist
  reviews miss. Six parallel reviewers with non-overlapping focus areas achieve
  comprehensive coverage in less time than sequential review.
solved_date: 2026-01-10
confidence: high
related_docs:
  - docs/solutions/methodology/multi-agent-parallel-code-review-workflow-MAIS-20260109.md
  - docs/solutions/methodology/MULTI_AGENT_REVIEW_QUICK_REFERENCE.md
  - docs/solutions/patterns/CODE_REVIEW_708_717_PREVENTION_STRATEGIES.md
  - docs/reviews/2026-01-10-preview-token-system-review.md
---

# Multi-Agent Parallel Code Review: Preview Token System Session

## Problem Statement

How to perform thorough code review of a significant feature (preview token system + DRY segment utilities, +2184/-222 lines across 30 files) that catches security, performance, architecture, TypeScript, and code quality issues without missing critical problems.

## Solution: 6-Agent Parallel Review

### The Methodology

Deploy six specialized review agents **in parallel**, each with deep domain expertise:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Agent Parallel Review                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Security    │  │    Data      │  │ Architecture │          │
│  │  Sentinel    │  │  Integrity   │  │  Strategist  │          │
│  │              │  │  Guardian    │  │              │          │
│  │ Rate limits  │  │ Tenant iso   │  │ DRY patterns │          │
│  │ JWT signing  │  │ TOCTOU       │  │ Consistency  │          │
│  │ Info leak    │  │ Transactions │  │ Layering     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  TypeScript  │  │ Performance  │  │    Code      │          │
│  │  Reviewer    │  │   Oracle     │  │  Simplicity  │          │
│  │              │  │              │  │  Reviewer    │          │
│  │ Contracts    │  │ N+1 queries  │  │ Duplication  │          │
│  │ Type safety  │  │ Caching      │  │ Complexity   │          │
│  │ Route order  │  │ Memory       │  │ Dead code    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                      │
│                  ┌──────────────┐                                │
│                  │  Synthesize  │                                │
│                  │  & Create    │                                │
│                  │  Todo Files  │                                │
│                  └──────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Prompts Used

Each agent received a focused prompt with specific concerns:

**security-sentinel:**

```
Analyze for security vulnerabilities:
- JWT signing and validation (algorithms, secrets, expiry)
- Tenant isolation (can token be used for wrong tenant?)
- Cache poisoning prevention (Cache-Control headers)
- Information disclosure in error messages
- Rate limiting gaps
```

**data-integrity-guardian:**

```
Analyze for tenant isolation issues:
- Do ALL queries include tenantId in WHERE clause?
- Are there TOCTOU race conditions?
- Is validateSegmentOwnership() called before mutations?
- Transaction boundaries for multi-step operations
```

**architecture-strategist:**

```
Analyze DRY extraction:
- Is resolveOrCreateGeneralSegment() used everywhere it should be?
- Is there duplicate segment resolution logic remaining?
- Are the two draft systems clearly separated?
```

**typescript-reviewer:**

```
Analyze API contracts and type safety:
- Do responses match TypeScript interfaces?
- Are request/response types validated with Zod?
- Any use of 'as any' that bypasses safety?
- Express route ordering (static before parameterized)
```

**performance-oracle:**

```
Analyze performance implications:
- N+1 queries in preview endpoint?
- structuredClone called unnecessarily?
- Token refresh strategy (thundering herd risk?)
- Caching strategy appropriate?
```

**code-simplicity-reviewer:**

```
Analyze for simplification:
- Is landing-page.service.ts doing too much?
- Are there duplicate implementations?
- Could methods be merged?
- Overly complex conditionals?
```

## Results: Non-Overlapping Coverage

### Findings by Agent

| Agent                    | P1    | P2    | P3    | Key Findings                        |
| ------------------------ | ----- | ----- | ----- | ----------------------------------- |
| security-sentinel        | 0     | 2     | 1     | Rate limiting gap, error disclosure |
| data-integrity-guardian  | 0     | 0     | 0     | ✅ Excellent isolation confirmed    |
| architecture-strategist  | 0     | 0     | 1     | ✅ DRY extraction correct           |
| typescript-reviewer      | 0     | 2     | 0     | Missing contract, type assertion    |
| performance-oracle       | 0     | 1     | 0     | Extra DB query in preview           |
| code-simplicity-reviewer | 0     | 2     | 1     | Duplicate implementations           |
| **TOTAL**                | **0** | **6** | **3** | **9 unique findings**               |

### Key Insight: Zero Overlap

Each agent found issues **only in their domain**:

- Security found security issues, not performance issues
- Performance found query issues, not security issues
- Simplicity found duplication, not type issues

**This proves specialized parallel review is more effective than generalist review.**

### Positive Findings (Commendations)

The review also confirmed excellent practices:

**Security Excellence:**

- ✅ JWT algorithm pinning (`HS256` only)
- ✅ Token type validation (`type: 'preview'`)
- ✅ Cache-Control headers prevent poisoning
- ✅ 10-minute token expiry limits attack window

**Tenant Isolation Excellence:**

- ✅ All queries include `tenantId` in WHERE
- ✅ `validateSegmentOwnership()` enforced
- ✅ Transactions for read-modify-write
- ✅ No TOCTOU vulnerabilities

**DRY Extraction Correct:**

- ✅ `resolveOrCreateGeneralSegment()` used consistently
- ✅ No duplicate segment resolution logic
- ✅ Route ordering correct (`/:slug/preview` before `/:slug`)

## Prevention Strategies

### When to Use Multi-Agent Review

| Trigger                                     | Agents to Include                            |
| ------------------------------------------- | -------------------------------------------- |
| 500+ lines changed                          | All 6 agents                                 |
| Security-sensitive (auth, tokens, payments) | security-sentinel required                   |
| Database/multi-tenant changes               | data-integrity-guardian required             |
| API changes                                 | typescript-reviewer, architecture-strategist |
| Performance-critical paths                  | performance-oracle required                  |

### Agent Selection Matrix

```
Code Type                 → Required Agents
─────────────────────────────────────────────
JWT/Auth/Tokens           → security, typescript
Database queries          → data-integrity, performance
API endpoints             → typescript, architecture, security
React hooks               → typescript, simplicity
Service layer             → architecture, simplicity, performance
Multi-tenant operations   → data-integrity, security
```

### Quality Checklist

- [ ] All 6 agents launched in parallel (single message, multiple Task calls)
- [ ] Key files read BEFORE launching agents (agents need context)
- [ ] Findings deduplicated across agents
- [ ] Severity assigned (P1 blocks merge, P2 should fix, P3 nice-to-have)
- [ ] Todo file created for each finding
- [ ] Review document saved to `docs/reviews/`
- [ ] Next steps documented for fresh context

### Common Mistakes to Avoid

1. **Running agents sequentially** - Loses parallelism benefit
2. **Not reading files first** - Agents need file context in prompt
3. **Skipping synthesis** - Findings need deduplication
4. **Not creating todo files** - Findings get lost without tracking
5. **Missing positive findings** - Commendations build confidence

## Integration with Compound Engineering

This methodology fits the compound engineering loop:

```
Plan → Work → Review → Compound → Repeat
              ↑          ↑
         This session   This document
```

1. **Work:** Commits 75a91c26, 8b044392 (preview token system)
2. **Review:** Multi-agent parallel review (this session)
3. **Compound:** Document methodology and findings (this file)
4. **Repeat:** Next session has reference for similar reviews

## Files Created

| File                                                                  | Purpose                |
| --------------------------------------------------------------------- | ---------------------- |
| `docs/reviews/2026-01-10-preview-token-system-review.md`              | Review findings        |
| `todos/721-pending-p2-preview-token-rate-limiting.md`                 | Security fix           |
| `todos/722-pending-p2-preview-token-error-disclosure.md`              | Security fix           |
| `todos/723-pending-p2-preview-endpoint-query-optimization.md`         | Performance fix        |
| `todos/724-pending-p2-duplicate-getBuildModeDraft-implementations.md` | DRY fix                |
| `todos/725-pending-p2-duplicate-publish-discard-executors.md`         | DRY fix                |
| `todos/726-pending-p2-missing-preview-token-contract.md`              | TypeScript fix         |
| `todos/727-pending-p3-jwt-type-assertion-pattern.md`                  | TypeScript improvement |
| `todos/728-pending-p3-repeated-validation-fallback-pattern.md`        | DRY improvement        |
| `todos/729-pending-p3-dual-draft-system-complexity.md`                | Architecture debt      |

## Quick Reference

### Launch Review

```bash
# In Claude Code, launch 6 agents in parallel (single message):
Task security-sentinel("Review for security...")
Task data-integrity-guardian("Review for tenant isolation...")
Task architecture-strategist("Review for DRY...")
Task typescript-reviewer("Review for type safety...")
Task performance-oracle("Review for performance...")
Task code-simplicity-reviewer("Review for simplicity...")
```

### After Review

```bash
ls todos/*-pending-*.md     # View findings
/triage                     # Prioritize
/resolve_todo_parallel      # Fix approved items
npm test                    # Verify
```

## Related Documentation

- [Multi-Agent Review Workflow](./multi-agent-parallel-code-review-workflow-MAIS-20260109.md) - Full methodology
- [Quick Reference](./MULTI_AGENT_REVIEW_QUICK_REFERENCE.md) - 2-minute guide (print & pin)
- [Prevention Strategies Index](../PREVENTION-STRATEGIES-INDEX.md) - All prevention docs
- [Code Review 708-717 Patterns](../patterns/CODE_REVIEW_708_717_PREVENTION_STRATEGIES.md) - Previous review findings
