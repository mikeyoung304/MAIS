---
status: pending
priority: p3
issue_id: 5247
tags: [code-review, security]
dependencies: []
---

# Dev-Mode Error Messages Lack Denylist

## Problem Statement

The centralized error handler shows full error messages in development mode (`NODE_ENV !== 'production'`). While this is standard practice, there's no denylist to filter sensitive patterns (e.g., connection strings, API keys that might appear in error messages) even in dev mode.

## Proposed Solutions

### Option A: Add regex denylist for sensitive patterns

- Strip patterns matching `postgres://`, `sk_live_`, API keys from dev error messages
- **Effort:** Small | **Risk:** Low

### Option B: Accept current behavior (Recommended)

- Dev mode is for developers who already have access to these values
- Adding a denylist adds complexity for minimal security benefit
- **Effort:** None | **Risk:** None

## Work Log

- 2026-02-08: Created from PR #43 review (6-agent parallel review)
