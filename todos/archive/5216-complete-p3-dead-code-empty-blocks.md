---
status: ready
priority: p3
issue_id: '5216'
tags: [code-review, quality, dead-code, guided-refinement]
dependencies: []
---

# P3: Empty Code Blocks and Dead Code

## Problem Statement

Several files contain empty code blocks, unused functions, and tautological logic that should be cleaned up.

**Why it matters:** Dead code confuses future maintainers and suggests incomplete implementation.

## Findings

**Source:** Code Quality Reviewer + Code Simplicity Reviewer

### 1. Empty Block in markComplete

**Location:** `apps/web/src/stores/refinement-store.ts:252-255`

```typescript
// Mark variant set as having a selection (preserve selected variant)
if (state.sectionVariants[sectionId]) {
  // Keep the selected variant  ← Empty block!
}
```

**Issue:** Comment suggests something should happen but code is empty.

### 2. Tautological shouldPushContent

**Location:** `apps/web/src/app/(protected)/tenant/layout.tsx:184`

```typescript
const shouldPushContent = isMounted ? true : true; // ← Always true
```

**Issue:** Conditional that always evaluates to `true`.

### 3. Unused isAgentChatReady Function

**Location:** `apps/web/src/lib/tenant-agent-dispatch.ts:74-76`

```typescript
export function isAgentChatReady(): boolean {
  return registeredSender !== null;
}
```

**Issue:** Zero usages found in codebase.

### 4. Incomplete hydrate Implementation

**Location:** `apps/web/src/stores/refinement-store.ts:296-315`

```typescript
if (data.completedSections !== undefined) {
  // Convert count to empty array (we don't have the IDs from hint)
  // The actual IDs will come from subsequent tool calls
  // ← No actual code here
}
```

**Issue:** Comment describes behavior that isn't implemented.

### 5. Possibly Unused unmarkComplete

**Location:** `apps/web/src/stores/refinement-store.ts:263-271`

**Issue:** No current callers found. May be pre-built for future "undo" feature.

## Proposed Solutions

### Option A: Clean Up All (Recommended)

1. **Empty markComplete block:** Remove the empty if block and comment
2. **Tautological logic:** Replace with `const shouldPushContent = true;`
3. **isAgentChatReady:** Delete the unused function
4. **hydrate stub:** Either implement or remove the dead code path
5. **unmarkComplete:** Keep if planned feature, document as "reserved"

**Effort:** Small (30 minutes)
**Risk:** Very Low

## Recommended Action

**APPROVED: Option A - Clean up all dead code**

Remove all 5 items listed above. For `unmarkComplete`, add JSDoc: `@reserved For future "undo section approval" feature`

**Triaged:** 2026-02-04 | **Decision:** Fix | **Rationale:** Dead code confuses maintainers

## Acceptance Criteria

- [ ] Empty code blocks removed or implemented
- [ ] Tautological expressions simplified
- [ ] Unused exports removed
- [ ] Incomplete implementations either completed or removed
- [ ] TypeScript build passes

## Work Log

| Date       | Action                   | Learnings                           |
| ---------- | ------------------------ | ----------------------------------- |
| 2026-02-04 | Created from code review | Identified by code-quality reviewer |

## Resources

- PR: Guided Refinement Integration
