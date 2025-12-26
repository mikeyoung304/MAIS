---
status: ready
priority: p2
issue_id: "401"
tags:
  - ui
  - design-system
  - code-review
dependencies: []
---

# Design System Violations - Wrong Border Radius on Card and Button

## Problem Statement

The Card and Button base components use different border radius values than specified in the Brand Voice Guide, causing visual inconsistency across the entire application.

## Findings

**Found by:** Best Practices Auditor agent

### Issue 1: Card Component Uses rounded-xl Instead of rounded-3xl

**Location:** `apps/web/src/components/ui/card.tsx:9`

**Brand Voice Guide Requirement:**
```tsx
// Cards use rounded-3xl with shadow-lg
<div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100 ...">
```

**Actual Implementation:**
```tsx
const cardVariants = cva(
  'rounded-xl transition-all duration-300 ease-smooth relative overflow-hidden',
  // ...
```

### Issue 2: Button Component Uses rounded-lg Instead of rounded-full

**Location:** `apps/web/src/components/ui/button.tsx:10`

**Brand Voice Guide Requirement:**
```tsx
// Buttons use rounded-full
<Button className="bg-sage hover:bg-sage-hover text-white rounded-full px-10 py-4 ...">
```

**Actual Implementation:**
```tsx
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold ...',
```

**Note:** The `sage` variant correctly uses `rounded-full` (line 62-64), but all other variants use `rounded-lg`.

### Issue 3: Input Component Uses rounded-lg Instead of rounded-full

**Location:** `apps/web/src/components/ui/input.tsx:23`

**Brand Voice Guide Requirement:**
```tsx
<input className="px-6 py-4 border-2 border-neutral-200 rounded-full text-lg bg-white ..."/>
```

**Actual:**
```tsx
'flex h-11 w-full rounded-lg border bg-white px-4 py-2.5 text-sm ...'
```

## Proposed Solutions

### Option 1: Update base component classes (Recommended)
- Change Card default to `rounded-3xl`
- Change Button default to `rounded-full`
- Change Input to `rounded-full`

**Pros:** Fixes all instances at once, design consistency
**Cons:** Visual change across app, may need review
**Effort:** Small
**Risk:** Low (visual only)

### Option 2: Add variant for proper styling
- Keep current defaults
- Add "brand" variant that follows guide

**Pros:** Non-breaking, gradual migration
**Cons:** Two patterns to maintain
**Effort:** Small
**Risk:** Very Low

## Recommended Action

Option 1 - Update base component classes to match Brand Voice Guide.

## Technical Details

**Files to modify:**
- `apps/web/src/components/ui/card.tsx` - Line 9: `rounded-xl` → `rounded-3xl`
- `apps/web/src/components/ui/button.tsx` - Line 10: `rounded-lg` → `rounded-full`
- `apps/web/src/components/ui/input.tsx` - Line 23: `rounded-lg` → `rounded-full`

**Also fix inconsistent transition duration:**
- Button variants use `duration-150` but should use `duration-300` per guide

## Acceptance Criteria

- [ ] Card uses `rounded-3xl` by default
- [ ] Button uses `rounded-full` by default
- [ ] Input uses `rounded-full`
- [ ] All transition durations are `duration-300`
- [ ] Visual review confirms brand consistency
- [ ] TypeScript compiles without errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from best practices audit | Component defaults must match design system |
| 2025-12-25 | **Approved for work** - Status: ready | P2 - Design consistency |

## Resources

- Best Practices Auditor report
- `docs/design/BRAND_VOICE_GUIDE.md`
