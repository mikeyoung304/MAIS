---
status: complete
priority: p3
issue_id: '563'
tags: [code-review, simplicity, agent-ecosystem]
dependencies: []
resolved_at: 2026-01-01
resolution: 'Extracted CLEANUP_INTERVAL_CALLS and MAX_CIRCUIT_BREAKERS as module-level constants with JSDoc.'
---

# P3: Magic Numbers in Cleanup Logic Need Named Constants

## Problem Statement

Several magic numbers in base-orchestrator.ts should be named constants:

```typescript
// Line 410
if (++this.circuitBreakerCleanupCounter >= 100) {  // Magic: 100

// Line 1077
const CIRCUIT_BREAKER_TTL = 65 * 60 * 1000;  // Good - named

// Line 1091
if (this.circuitBreakers.size > 1000) {  // Magic: 1000
```

**Why it matters:** Magic numbers are unclear without context and easy to change inconsistently.

## Findings

| Reviewer            | Finding                                     |
| ------------------- | ------------------------------------------- |
| Simplicity Reviewer | P3: Magic numbers should be named constants |

## Proposed Solutions

### Option 1: Extract to Named Constants (Recommended)

**Effort:** Trivial (10 minutes)

```typescript
const CLEANUP_INTERVAL_CALLS = 100;
const MAX_CIRCUIT_BREAKERS = 1000;
```

## Acceptance Criteria

- [ ] Extract cleanup interval (100) to named constant
- [ ] Extract max circuit breakers (1000) to named constant
- [ ] Add JSDoc comments explaining rationale

## Work Log

| Date       | Action                   | Learnings                   |
| ---------- | ------------------------ | --------------------------- |
| 2026-01-01 | Created from code review | Simplicity Reviewer flagged |
