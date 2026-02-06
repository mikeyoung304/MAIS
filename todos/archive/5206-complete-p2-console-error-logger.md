---
status: ready
priority: p2
issue_id: 5206
tags: [code-review, logging, dashboard-rebuild]
dependencies: []
---

# console.error Instead of logger in useTenantAgentChat

## Problem Statement

`apps/web/src/hooks/useTenantAgentChat.ts:280` uses `console.error` instead of the project's `logger` utility. Per Pitfall #8 in CLAUDE.md, all logging should use the `logger` utility for consistent structured logging.

## Findings

- Line 280: `console.error(...)` in error handler
- Project standard: use `logger` from `@/lib/logger`

## Proposed Solutions

### Option A: Replace with logger.error (Recommended)

- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] No `console.error` in useTenantAgentChat.ts
- [ ] Uses `logger.error()` instead

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review |
