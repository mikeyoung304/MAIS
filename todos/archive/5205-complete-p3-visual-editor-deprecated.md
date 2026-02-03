---
status: ready
priority: p3
issue_id: '5205'
tags: [code-review, testing, cleanup]
dependencies: []
---

# Visual Editor Tests for Deprecated Feature

## Problem Statement

`e2e/tests/visual-editor.spec.ts` (293 lines) tests a deprecated feature. Per CLAUDE.md: "Visual Editor is deprecated. All storefront editing happens through the AI agent chatbot (Build Mode)."

## Findings

**Location:** `e2e/tests/visual-editor.spec.ts`
**Lines:** 293

If visual editor is truly deprecated, these tests waste CI time.

## Proposed Solutions

### Option A: Delete (Recommended)

If visual editor code is removed, delete tests.

**Effort:** Small (15 min) | **Risk:** Low

### Option B: Skip with Reason

```typescript
test.describe.skip('Visual Editor (deprecated)', () => {
```

**Effort:** Small (5 min) | **Risk:** Low

## Acceptance Criteria

- [ ] Tests removed or skipped with reason
- [ ] CI time reduced by ~30 seconds
