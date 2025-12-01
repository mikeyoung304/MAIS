---
title: "React Hooks Performance & WCAG Accessibility Code Review Patterns"
category: "code-review-patterns"
severity: ["p1", "p2"]
components:
  - "TenantDashboard"
  - "TenantPackagesManager"
  - "useDashboardData"
tags:
  - "react-hooks"
  - "performance"
  - "accessibility"
  - "wcag-compliance"
  - "useCallback"
  - "useMemo"
  - "focus-visible"
  - "pr-12"
date_solved: "2025-12-01"
total_issues: 12
p1_issues: 6
p2_issues: 6
related_pr: "https://github.com/mikeyoung304/MAIS/pull/12"
---

# React Hooks Performance & WCAG Accessibility Code Review Patterns

## Problem Statement

Multi-agent code review of PR #12 (Tenant Dashboard Segment-Package Hierarchy) identified 12 issues: 6 P1 blockers (performance + accessibility violations) and 6 P2 items (verified as false positives or already implemented). This document captures the patterns for future code reviews.

## Issues Identified

### P1 Critical (Fixed)

| ID | Issue | Category | WCAG |
|----|-------|----------|------|
| #119 | Missing useCallback for load functions | Performance | - |
| #120 | useEffect missing dependencies | Performance | - |
| #121 | Unstable event handlers break React.memo | Performance | - |
| #122 | Missing keyboard focus indicator | Accessibility | 2.4.7 |
| #123 | No chevron icon for accordion state | Accessibility | 1.3.1 |
| #124 | Button clicks toggle accordion | UX | - |

### P2 Verified (No Action Needed)

| ID | Issue | Resolution |
|----|-------|------------|
| #125 | Duplicate header blocks | FALSE POSITIVE - intentionally different |
| #126 | Duplicate success message | FALSE POSITIVE - correct reuse |
| #127 | Type export location | DEFERRED - acceptable location |
| #128 | Missing toast notifications | NOT NEEDED - hooks handle errors |
| #129 | console.error usage | NOT FOUND - no console.error |
| #130 | Accordion default state | ALREADY IMPLEMENTED |

## Solutions Applied

### 1. useCallback for Load Functions (#119)

**Before:**
```typescript
const loadPackagesAndSegments = async () => {
  setIsLoading(true);
  // ... implementation
};

return { loadPackages: loadPackagesAndSegments }; // New reference every render!
```

**After:**
```typescript
import { useCallback } from "react";

const loadPackagesAndSegments = useCallback(async () => {
  setIsLoading(true);
  // ... implementation
}, []); // Stable reference

return { loadPackages: loadPackagesAndSegments };
```

### 2. useEffect Dependencies (#120)

**Before:**
```typescript
useEffect(() => {
  if (activeTab === "packages") {
    loadPackagesAndSegments(); // Not in deps!
  }
}, [activeTab]); // ESLint warning
```

**After:**
```typescript
useEffect(() => {
  if (activeTab === "packages") {
    loadPackagesAndSegments();
  }
}, [activeTab, loadPackagesAndSegments, loadBlackouts, loadBookings, loadBranding]);
```

### 3. Event Handler Stability (#121)

**Before:**
```typescript
const handleEdit = async (pkg: PackageDto) => {
  packageForm.loadPackage(pkg);
  await packageManager.handleEdit(pkg);
}; // New reference every render - breaks memo!
```

**After:**
```typescript
const handleEdit = useCallback(async (pkg: PackageDto) => {
  packageForm.loadPackage(pkg);
  await packageManager.handleEdit(pkg);
}, [packageForm.loadPackage, packageManager.handleEdit]);
```

### 4. Keyboard Focus Indicator (#122 - WCAG 2.4.7)

**Before:**
```typescript
<summary className="... hover:bg-sage-light/5 ...">
```

**After:**
```typescript
<summary className="... hover:bg-sage-light/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 ...">
```

### 5. Visual State Indicator (#123 - WCAG 1.3.1)

**Before:**
```typescript
<span className="text-text-primary">
  {segment.name}
</span>
```

**After:**
```typescript
<span className="flex items-center gap-2">
  <ChevronRight className="w-5 h-5 text-sage transition-transform duration-200 group-open:rotate-90" />
  <span className="text-text-primary">
    {segment.name}
  </span>
</span>
```

### 6. Event Propagation (#124)

**Pattern (already implemented):**
```typescript
<summary>
  <span>Content</span>
  <div onClick={e => e.stopPropagation()}>
    <Button onClick={handleDelete}>Delete</Button>
  </div>
</summary>
```

## Prevention Checklist

### Pre-Commit

```markdown
- [ ] All callbacks passed to children wrapped in useCallback
- [ ] All useEffect dependencies complete (run `npm run lint`)
- [ ] Tab through component - focus visible on all interactive elements
- [ ] Accordion/collapsible icons indicate state (chevron rotates)
- [ ] Nested button clicks don't trigger parent handlers
```

### Code Review

```markdown
## Performance
- [ ] Callbacks to memoized components use useCallback
- [ ] useEffect dependency arrays are complete
- [ ] No ESLint exhaustive-deps warnings

## Accessibility (WCAG AA)
- [ ] Focus ring visible on keyboard navigation (2.4.7)
- [ ] Interactive state communicated visually (1.3.1)
- [ ] Color is not the only indicator
- [ ] Touch targets >= 44x44px (2.5.5)

## UX
- [ ] Button clicks in containers don't trigger parent
- [ ] Accordion default state appropriate for UX
```

## ESLint Rules

Add to `.eslintrc`:

```json
{
  "plugins": ["react-hooks", "jsx-a11y"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error",
    "jsx-a11y/interactive-supports-focus": "warn",
    "jsx-a11y/click-events-have-key-events": "warn"
  }
}
```

## Quick Patterns Reference

### useCallback Template
```typescript
const handler = useCallback(async (param: Type) => {
  // implementation
}, [dep1, dep2]);
```

### Focus Visible Classes
```typescript
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
```

### Rotating Icon (Accordion)
```typescript
<ChevronRight className="transition-transform duration-200 group-open:rotate-90" />
```

### Stop Propagation Wrapper
```typescript
<div onClick={e => e.stopPropagation()}>
  {/* buttons here */}
</div>
```

## Related Documentation

- [REACT-COMPONENT-REVIEW-QUICK-REF.md](../REACT-COMPONENT-REVIEW-QUICK-REF.md) - Component review checklist
- [COMPONENT-DUPLICATION-PREVENTION.md](../COMPONENT-DUPLICATION-PREVENTION.md) - Pre-implementation checklist
- [00-MASTER-DESIGN-AUDIT.md](../../design/00-MASTER-DESIGN-AUDIT.md) - WCAG audit baseline
- [TESTING-QUICK-REFERENCE.md](../TESTING-QUICK-REFERENCE.md) - Test coverage requirements

## Resolution Summary

| Metric | Value |
|--------|-------|
| Total Issues | 12 |
| P1 Fixed | 5 |
| P1 Already Implemented | 1 |
| P2 False Positives | 3 |
| P2 Deferred | 1 |
| P2 Already Implemented | 2 |
| Files Modified | 2 |
| Resolution Time | ~55 minutes |

**Commit:** `c763cf0` - "fix(pr-12): resolve all P1 review findings"
