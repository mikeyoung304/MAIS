---
status: complete
priority: p3
issue_id: "088"
tags:
  - code-review
  - accessibility
  - a11y
  - storefront
dependencies: []
---

# Accessibility Gaps in Storefront Components

## Problem Statement

The storefront components have several accessibility issues that could affect users with disabilities:
- Missing ARIA attributes on dynamic content
- Image fallback lacks role="img"
- Warning messages need aria-live
- Icon accessibility not handled

## Findings

### Discovery
Code quality review identified these a11y gaps:

1. **Missing role on gradient fallback** (ChoiceCardBase line 87-90)
   ```typescript
   <div className="w-full h-full bg-gradient-to-br ...">
     <span>{categoryLabel}</span>
   </div>
   ```
   Should have `role="img"` and `aria-label` when acting as image replacement.

2. **Warning not announced** (TierSelector line 110-125)
   ```typescript
   {!isComplete && configuredTiers.length > 0 && (
     <div className="mb-8 p-4 bg-amber-50 ...">
   ```
   Should have `aria-live="polite"` and `role="alert"`.

3. **Icon accessibility** (TierSelector line 90-96)
   ```typescript
   <ArrowLeft className="w-4 h-4 mr-2" />
   ```
   Decorative icon should have `aria-hidden="true"`.

4. **Badge accessibility** (ChoiceCardBase line 68)
   ```typescript
   <Badge>Most Popular</Badge>
   ```
   Works for visual users but could use explicit aria-label.

### Impact
- Screen reader users may miss important context
- WCAG 2.1 AA compliance at risk
- Legal liability in some jurisdictions

## Proposed Solutions

### Solution 1: Add ARIA attributes (RECOMMENDED)

Fix each issue with appropriate ARIA markup:

```typescript
// Image fallback
<div role="img" aria-label={`${categoryLabel} category`} className="...">

// Warning
<div role="alert" aria-live="polite" className="...">

// Icon
<ArrowLeft aria-hidden="true" className="..." />
```

**Pros:**
- Proper accessibility compliance
- Minimal code changes
- No visual impact

**Cons:**
- Need to test with screen readers

**Effort:** Small (30 min)
**Risk:** Low

### Solution 2: Document current behavior

Add comments explaining accessibility decisions made.

**Pros:**
- Documents intent
- No code changes

**Cons:**
- Doesn't fix issues
- Compliance risk remains

**Effort:** Small (15 min)
**Risk:** High (doesn't fix issue)

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

### Affected Files
- `client/src/features/storefront/ChoiceCardBase.tsx`
- `client/src/features/storefront/TierSelector.tsx`

### Components
- ChoiceCardBase
- TierSelector

### Database Changes
None

## Acceptance Criteria

- [x] Gradient fallback has role="img" and aria-label
- [x] Warning message has role="alert" and aria-live (N/A - warning was removed in previous refactor)
- [x] Decorative icons have aria-hidden="true"
- [ ] Tested with screen reader (VoiceOver/NVDA) - Manual testing required
- [x] No visual changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-29 | Created during code review | Quality review identified a11y gaps |
| 2025-12-02 | Implemented ARIA attributes | Added role="img", aria-label, aria-hidden to improve screen reader experience |

## Resources

- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
