---
status: complete
priority: p2
issue_id: '7005'
tags: [code-review, type-safety, architecture, pr-45]
dependencies: []
---

# 7005: GenericRecordResponse Bypasses Typed Validation in 6 Tools

## Problem Statement

`GenericRecordResponse` is defined as `z.record(z.unknown())` which accepts literally any object. It's used in 6 tool files as the response schema for `callMaisApiTyped`, effectively making those calls untyped despite using the typed API wrapper. This defeats the purpose of Wave 4's typed contracts.

**Impact:** Medium. These 6 tools get no runtime validation benefit — a backend schema change would silently pass through with potentially wrong data shapes, and the agent would see unexpected formats.

## Findings

### Agent: Architecture Strategist + Code Simplicity Reviewer

- **File:** `server/src/agent-v2/deploy/tenant/src/types/api-responses.ts`, line 226
- **Evidence:** `export const GenericRecordResponse = z.record(z.unknown());`
- Used in: `storefront-read.ts` (get_page_structure), `storefront-write.ts` (multiple tools), and other endpoints
- These tools previously used untyped `callMaisApi` — the migration to `callMaisApiTyped` + `GenericRecordResponse` is a stepping stone, not a final state

### Proposed Solutions

**Option A: Create specific Zod schemas for each endpoint (Recommended)**

- Define proper response schemas: `StorefrontStructureResponse`, `UpdateSectionResponse`, etc.
- Replace `GenericRecordResponse` usage in each tool file
- Pros: Full type safety, catches backend changes at runtime
- Cons: Must inspect each backend response to define schema
- Effort: Medium (6 schemas to define)
- Risk: Low

**Option B: Use `.passthrough()` with partial schemas**

- Define schemas with known fields plus `.passthrough()` for unknown extras
- Pros: Validates critical fields while tolerating new ones
- Cons: Still partial validation
- Effort: Small-Medium
- Risk: Low

**Option C: Leave as-is, add TODO comments**

- Document that GenericRecordResponse is intentionally loose as a migration stepping stone
- Pros: No code change risk
- Cons: Doesn't improve safety
- Effort: Small
- Risk: None (but doesn't fix the issue)

## Recommended Action

Option A — define specific schemas. This was the stated goal of Wave 4; GenericRecordResponse is the remaining gap.

## Technical Details

- **Affected files:** 6 tool files using `GenericRecordResponse` + `api-responses.ts`
- **Components:** Agent tools, callMaisApiTyped
- **Database:** No changes

## Acceptance Criteria

- [ ] All 6 tools using GenericRecordResponse replaced with specific Zod schemas
- [ ] GenericRecordResponse removed from api-responses.ts (or marked deprecated)
- [ ] Backend responses validated at runtime for each endpoint
- [ ] No regression in tool behavior

## Work Log

| Date       | Action                     | Learnings                                                 |
| ---------- | -------------------------- | --------------------------------------------------------- |
| 2026-02-11 | Created from PR #45 review | Found by Architecture Strategist + Code Simplicity agents |

## Resources

- PR #45: refactor/agent-debt-cleanup
- File: `server/src/agent-v2/deploy/tenant/src/types/api-responses.ts:226`
- Wave 4 commit: `21c637d9`
