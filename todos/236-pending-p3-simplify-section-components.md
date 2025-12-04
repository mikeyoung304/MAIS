---
status: pending
priority: p3
issue_id: '236'
tags: [simplification, code-review, landing-page, yagni]
dependencies: []
source: 'code-review-landing-page-visual-editor'
---

# TODO-236: Consider Generic EditableSection Wrapper

## Priority: P3 (Nice-to-Have)

## Status: Pending

## Source: Simplicity Review - Landing Page Visual Editor Plan

## Problem Statement

The plan creates 7 separate editable section components with similar patterns, creating code duplication. A generic wrapper could reduce boilerplate by 40-50%.

**Why It Matters:**

- 7 component files with similar logic
- Maintenance burden across multiple files
- Inconsistent implementations possible

## Proposed Solution

Create one generic `EditableSection` wrapper:

```typescript
<EditableSection
  type="hero"
  config={heroConfig}
  schema={heroSchema}
  onUpdate={handler}
/>
```

**Savings:**

- Eliminate ~6 component files
- 40-50% reduction in Phase 2 effort
- 800+ lines of code reduction

## Decision

**DEFER** - Evaluate after implementing first 2-3 sections. If patterns emerge, extract generic wrapper.

## Work Log

| Date       | Action  | Notes                                      |
| ---------- | ------- | ------------------------------------------ |
| 2025-12-04 | Created | Simplicity review - potential optimization |

## Tags

simplification, code-review, landing-page, yagni
