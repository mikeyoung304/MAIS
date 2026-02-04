---
status: ready
priority: p2
issue_id: '5211'
tags: [code-review, quality, typescript, guided-refinement]
dependencies: []
---

# P2: Interface Naming Typo - UseConciergeChatchatOptions

## Problem Statement

The interface names in `useConciergeChat.ts` contain a typo - "Chatchat" (doubled "chat"). This creates a confusing API surface and poor developer experience.

**Why it matters:** Developers importing these types will be confused by the naming. This is a public API that should be correct.

## Findings

**Source:** Code Quality Reviewer (TypeScript/React)

**Location:** `apps/web/src/hooks/useConciergeChat.ts:96, 112`

**Evidence:**

```typescript
// Line 96 - TYPO
export interface UseConciergeChatchatOptions {

// Line 112 - TYPO
export interface UseConciergeChatchatReturn {
```

## Proposed Solutions

### Option A: Fix Typo Now (Recommended)

**Approach:** Rename to `UseConciergeChat Options` (single "chat")

**Pros:** Immediate fix, correct API
**Cons:** Breaking change if these types are exported/used elsewhere
**Effort:** Small (10 minutes)
**Risk:** Low - check imports first

### Option B: Fix During Naming Migration

**Approach:** Fix when renaming from "Concierge" to "TenantAgent"

**Pros:** Only one breaking change instead of two
**Cons:** Leaves typo in place longer
**Effort:** Part of larger effort
**Risk:** N/A

## Recommended Action

**APPROVED: Option A - Fix the typo now**

Rename `UseConciergeChatchatOptions` → `UseConciergeChat Options` and `UseConciergeChatchatReturn` → `UseConciergeChat Return`. Search and update all imports.

**Triaged:** 2026-02-04 | **Decision:** Fix | **Rationale:** Public API should be correct

## Technical Details

**Affected Files:**

- `apps/web/src/hooks/useConciergeChat.ts` (definitions)
- Any files importing these types

**Search for usages:**

```bash
grep -rn "UseConciergeChatchat" apps/web/src/
```

## Acceptance Criteria

- [ ] `UseConciergeChatchatOptions` renamed to `UseConciergeChat Options`
- [ ] `UseConciergeChatchatReturn` renamed to `UseConciergeChat Return`
- [ ] All imports updated
- [ ] TypeScript build passes

## Work Log

| Date       | Action                   | Learnings                           |
| ---------- | ------------------------ | ----------------------------------- |
| 2026-02-04 | Created from code review | Identified by code-quality reviewer |

## Resources

- PR: Guided Refinement Integration
