---
status: pending
priority: p3
issue_id: 5246
tags: [code-review, code-quality]
dependencies: []
---

# Delegating Wrapper Anti-Pattern in Agent Services

## Problem Statement

After extracting shared functions to `adk-client.ts`, three agent services still have wrapper methods that simply delegate to the shared functions without adding any value:

- `customer-agent.service.ts`
- `project-hub-agent.service.ts`
- `vertex-agent.service.ts`

These wrappers add indirection without benefit.

## Proposed Solutions

### Option A: Remove wrappers, import shared functions directly at call sites

- Callers import from `adk-client.ts` directly
- Remove wrapper methods from services
- **Effort:** Small | **Risk:** Low

### Option B: Keep wrappers for service boundary

- Wrappers provide a stable API if shared module changes
- **Effort:** None | **Risk:** None (status quo)

## Work Log

- 2026-02-08: Created from PR #43 review (6-agent parallel review)
