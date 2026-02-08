---
status: closed
closed_date: '2026-02-08'
closed_reason: 'Dead code — concierge agent retired in Phase 4 (Jan 2026). Per-session circuit breaker pattern no longer exists.'
priority: p2
issue_id: '536'
tags: [code-review, agent-ecosystem, security]
dependencies: []
---

# Circuit Breaker Per-Session Only - Bypassable

## Problem Statement

Circuit breaker is created per-session. A malicious user could create new sessions to bypass limits.

## Findings

**Agent-Native Reviewer:**

> "A malicious user could create new sessions to bypass the circuit breaker... The 'max turns per session' limit can be circumvented by creating new sessions."

## Proposed Solutions

Track circuit breaker metrics per tenant (not just per session) for abuse detection. Consider a tenant-level daily budget.

## Acceptance Criteria

- [ ] Tenant-level abuse detection
- [ ] Cannot bypass limits by creating sessions
- [ ] Tests pass
