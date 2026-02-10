---
status: complete
priority: p3
issue_id: '5241'
tags: [code-review, architecture, routes, enterprise-review]
dependencies: []
---

# internal-agent.routes.ts Is a 2,895-Line Monolith

## Problem Statement

`server/src/routes/internal-agent.routes.ts` handles 25+ endpoints covering bootstrap, discovery, storefront CRUD, project hub, vocabulary resolution, and booking. It defines its own Zod schemas (duplicating contracts) and mixes business logic with HTTP handling.

**Why it matters:** Any change to agent-backend communication requires navigating ~3000 lines. Schemas can drift from `packages/contracts`. No type-safe client for these endpoints.

## Findings

**Source:** Architecture Strategist + Code Simplicity reviews (PR #42, 2026-02-08)

**Current state:**

- 2,895 lines — largest non-generated source file
- 25+ endpoints (tool backends for ADK agents)
- Hand-written Zod schemas (not using ts-rest contracts)
- Business logic mixed with HTTP handling
- No auto-generated API docs

## Proposed Solutions

### Option A: Domain-based split (Recommended)

- `internal-agent-discovery.routes.ts` — bootstrap, store_discovery_fact, get_bootstrap
- `internal-agent-storefront.routes.ts` — update_section, get_sections, manage_packages
- `internal-agent-project-hub.routes.ts` — project CRUD, timeline
- `internal-agent-booking.routes.ts` — booking tools
- Move Zod schemas to `packages/contracts/src/internal-agent.ts`
- **Pros:** Navigable, domain-isolated, schemas in contracts
- **Cons:** Medium effort, need to verify all imports
- **Effort:** Medium-Large
- **Risk:** Low (pure restructuring)

### Option B: Adopt ts-rest contracts

- Define all 25+ internal agent endpoints in `packages/contracts`
- Generate type-safe server router + client
- **Pros:** Full type safety, auto-docs, contract enforcement
- **Cons:** Large effort, may not suit tool-backend pattern
- **Effort:** Large
- **Risk:** Medium

## Acceptance Criteria

- [ ] No single route file exceeds 800 LOC
- [ ] Agent tool schemas defined in `packages/contracts`
- [ ] Each domain-specific file is independently navigable

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2026-02-08 | Created | Found during enterprise review PR #42 |
