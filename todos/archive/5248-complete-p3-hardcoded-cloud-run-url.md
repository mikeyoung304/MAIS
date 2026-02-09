---
status: pending
priority: p3
issue_id: 5248
tags: [code-review, deployment, adk]
dependencies: []
---

# Hardcoded Cloud Run URL in Agent Service

## Problem Statement

One or more agent service files contain hardcoded Cloud Run URLs instead of using environment variables. Per CLAUDE.md Pitfall #34, Cloud Run URLs contain project numbers that change between environments.

## Proposed Solutions

### Option A: Replace with environment variable (Recommended)

- Use `process.env.TENANT_AGENT_URL` / `CUSTOMER_AGENT_URL` pattern
- Fail-fast at startup if env var is missing
- **Effort:** Small | **Risk:** Low

## Work Log

- 2026-02-08: Created from PR #43 review (6-agent parallel review)
