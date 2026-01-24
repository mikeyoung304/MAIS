---
status: complete
priority: p1
issue_id: '564'
tags: [code-review, documentation, agent-ecosystem, quality-first-triage]
dependencies: []
resolved_at: 2026-01-01
resolution: "Fixed misleading comment - changed 'token bucket pattern' to 'call counter pattern' in rate-limiter.ts."
---

# P1: Misleading "Token Bucket" Comment in Rate Limiter

> **Quality-First Triage Upgrade:** P3 → P1. "Documentation lies about algorithm. Simple counter, not token bucket. Actively misleads."

## Problem Statement

The class comment claims "token bucket pattern" but this is NOT a token bucket:

```typescript
// rate-limiter.ts:57
/**
 * Per-tool rate limiter using token bucket pattern.
 */
```

Token bucket would involve bucket capacity, refill rate, and token consumption. The current implementation is simple counter-based rate limiting.

**Why it matters:** Misleading comments confuse developers and set wrong expectations.

## Proposed Solutions

### Option 1: Fix Comment (Recommended)

**Effort:** Trivial (5 minutes)

```typescript
/**
 * Per-tool call counter with turn and session limits.
 * Tracks calls per turn (reset each turn) and per session (persistent).
 */
```

## Acceptance Criteria

- [ ] Update class comment to accurately describe implementation
- [ ] Remove "token bucket" terminology

## Work Log

| Date       | Action                   | Learnings                   |
| ---------- | ------------------------ | --------------------------- |
| 2026-01-01 | Created from code review | Simplicity Reviewer flagged |
