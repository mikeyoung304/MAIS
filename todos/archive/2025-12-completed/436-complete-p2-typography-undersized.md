# Typography Undersized vs Brand Voice Guide

## Metadata

- **ID:** 436
- **Status:** pending
- **Priority:** P2
- **Tags:** design, brand, frontend
- **Source:** Brand Review - Frontend Design Specialist

## Problem Statement

The homepage headlines are consistently one size smaller than the Brand Voice Guide specifies. This reduces visual impact and doesn't match the "Apple-quality" design standard the guide establishes.

## Findings

| Element      | Current                                        | Brand Guide Spec                               |
| ------------ | ---------------------------------------------- | ---------------------------------------------- |
| Hero h1      | `text-4xl sm:text-5xl md:text-6xl lg:text-7xl` | `text-5xl sm:text-6xl md:text-7xl lg:text-8xl` |
| Section h2   | `text-3xl md:text-4xl`                         | `text-4xl sm:text-5xl md:text-6xl`             |
| Subheadlines | `text-lg`                                      | `text-xl md:text-2xl`                          |

**Affected Lines in page.tsx:**

- Line 189: Hero headline
- Lines 254, 284, 351, 374: Section headlines
- Lines 257, 287: Subheadlines

## Proposed Solutions

### Option A: Update to Match Brand Guide (Recommended)

Update all typography to match specifications in `docs/design/BRAND_VOICE_GUIDE.md`

```tsx
// Hero
className = 'font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold...';

// Sections
className = 'font-serif text-4xl sm:text-5xl md:text-6xl font-bold...';

// Subheadlines
className = 'text-xl md:text-2xl text-text-muted font-light...';
```

**Pros:** Matches documented standard, stronger visual impact
**Cons:** May require spacing adjustments
**Effort:** Small
**Risk:** Low

### Option B: Update Brand Guide to Match Current

If current sizes were intentional, update the guide to reflect reality.

**Pros:** No code changes
**Cons:** Reduces visual impact, admits guide was aspirational
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A — Update code to match guide

## Technical Details

**Affected Files:**

- `apps/web/src/app/page.tsx` — lines 189, 254, 257, 284, 287, 351, 374

**Changes:**

```diff
// Line 189 - Hero
- text-4xl sm:text-5xl md:text-6xl lg:text-7xl
+ text-5xl sm:text-6xl md:text-7xl lg:text-8xl

// Lines 254, 284, 351, 374 - Section headlines
- text-3xl md:text-4xl
+ text-4xl sm:text-5xl md:text-6xl

// Lines 257, 287 - Subheadlines
- text-lg
+ text-xl md:text-2xl
```

## Acceptance Criteria

- [ ] Hero headline uses `text-5xl sm:text-6xl md:text-7xl lg:text-8xl`
- [ ] All section headlines use `text-4xl sm:text-5xl md:text-6xl`
- [ ] All subheadlines use `text-xl md:text-2xl font-light`
- [ ] Visual hierarchy is clear at all breakpoints
- [ ] No text overflow or awkward wrapping

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2025-12-27 | Created | From brand review - Design Specialist |

## Resources

- `docs/design/BRAND_VOICE_GUIDE.md` — Typography Scale section
