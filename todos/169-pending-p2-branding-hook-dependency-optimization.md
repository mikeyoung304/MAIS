---
status: pending
priority: p2
issue_id: "169"
tags: [code-review, performance, react-hooks, batch-5-review]
dependencies: []
---

# Optimize useTenantBranding Hook Dependency Array

## Problem Statement

The `useTenantBranding` hook's useEffect dependency array captures the entire `branding` object. This causes unnecessary re-renders when the object reference changes even if the actual values haven't changed.

**Why it matters:**
- DOM manipulation (creating/updating style tags) on every render
- Performance impact on component updates
- Unnecessary CSS variable recalculations

## Findings

**Source:** Performance Specialist agent code review

**File:** `client/src/hooks/useTenantBranding.ts`
**Lines:** ~45-50 (useEffect dependency array)

**Current code:**
```typescript
useEffect(() => {
  if (!branding) return;

  // Creates style element and sets CSS variables
  const style = document.createElement('style');
  // ... sets CSS variables from branding properties

}, [branding]); // Triggers on any object reference change
```

## Proposed Solution

Destructure specific branding properties in the dependency array:

```typescript
const { primaryColor, secondaryColor, fontFamily, logoUrl, accentColor } = branding || {};

useEffect(() => {
  if (!primaryColor) return;

  const style = document.createElement('style');
  // ... apply CSS variables

}, [primaryColor, secondaryColor, fontFamily, logoUrl, accentColor]);
```

Alternatively, use JSON.stringify for deep comparison (less optimal but simpler):

```typescript
const brandingKey = branding ? JSON.stringify(branding) : null;

useEffect(() => {
  if (!branding) return;
  // ...
}, [brandingKey]);
```

**Effort:** Small (15 minutes)
**Risk:** Low

## Acceptance Criteria

- [ ] useEffect only triggers when actual branding values change
- [ ] No visual regression in branding display
- [ ] TypeScript passes
- [ ] Tests pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-02 | Created | From batch 5 code review |

## Resources

- Related TODO: 089-092 (branding refactoring)
- Commit: 8ef3a7d
