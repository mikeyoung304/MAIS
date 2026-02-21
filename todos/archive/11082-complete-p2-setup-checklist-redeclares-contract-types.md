---
status: pending
priority: p2
issue_id: '11082'
tags: [code-review, typescript]
pr: 68
---

# F-018: SetupChecklist Re-declares Types Locally Instead of Importing from Contracts

## Problem Statement

The `SetupChecklist` component defines its own local TypeScript types for checklist items and status instead of importing the canonical types from `@macon/contracts`. This creates type drift risk where the frontend and backend types can diverge silently.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `apps/web/src/components/dashboard/SetupChecklist.tsx:33-57`
- **Impact:** Type drift between frontend and backend. If the contract types change, the local copies will not be updated, leading to runtime errors that TypeScript cannot catch. Violates the single-source-of-truth principle that ts-rest + Zod contracts are designed to enforce.

## Proposed Solution

Delete the local type declarations in `SetupChecklist.tsx` and import the corresponding types from `@macon/contracts`. If the types do not yet exist in contracts, define them there first, then import.

## Effort

Small

## Acceptance Criteria

- [ ] Local type declarations in `SetupChecklist.tsx` are removed
- [ ] Types are imported from `@macon/contracts`
- [ ] If types were missing from contracts, they are added there first
- [ ] `npm run typecheck` passes for both workspaces
