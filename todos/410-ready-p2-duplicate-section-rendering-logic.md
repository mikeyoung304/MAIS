---
status: complete
priority: p2
issue_id: '410'
tags:
  - code-review
  - code-quality
  - duplication
  - locked-template-system
dependencies: []
---

# Duplicate Section Rendering in TenantLandingPage

## Problem Statement

`TenantLandingPage.tsx` contains ~200 lines of inline section implementations that duplicate the new section components in `sections/*.tsx`. This creates maintenance burden and potential for drift.

**Why This Matters:**

- Double the code to maintain
- Changes to one location may not be reflected in the other
- Inconsistent behavior between section components and inline sections
- Violates DRY principle

## Findings

**Location:** `apps/web/src/components/tenant/TenantLandingPage.tsx`

**Evidence:**

- Lines 83-121: Inline Hero section (duplicates `HeroSection.tsx`)
- Lines 218-249: Inline About section (duplicates `TextSection.tsx`)
- Lines 251-290: Inline Testimonials section (duplicates `TestimonialsSection.tsx`)
- Lines 292-330: Inline Gallery section (duplicates `GallerySection.tsx`)
- Lines 332-352: Inline FAQ section (duplicates `FAQSection.tsx`)
- Lines 354-380: Inline Final CTA section (duplicates `CTASection.tsx`)

**Impact:** ~200 lines of duplicated code

**Agent:** Code Simplicity Reviewer

## Proposed Solutions

### Solution 1: Refactor to Use SectionRenderer (Recommended)

Convert `TenantLandingPage.tsx` to use `SectionRenderer` for section display.

```tsx
// Before: 384 lines with inline sections
// After: ~180 lines using SectionRenderer

export function TenantLandingPage({ tenant, packages, segments }: Props) {
  // Keep unique logic: packages/tier cards

  return (
    <>
      <SectionRenderer sections={homeSections} tenant={tenant} />
      {/* Package cards - unique to this component */}
      <PackagesGrid packages={packages} segments={segments} />
      <SectionRenderer sections={ctaSections} tenant={tenant} />
    </>
  );
}
```

**Pros:**

- Eliminates ~200 lines of duplication
- Single source of truth for section rendering
- Easier maintenance

**Cons:**

- Refactor required
- May need to extract packages logic

**Effort:** Medium
**Risk:** Low (mostly moving code)

### Solution 2: Keep Both, Add Deprecation Warning

Mark inline sections as deprecated in JSDoc.

**Pros:**

- No immediate code changes
- Documents intent

**Cons:**

- Duplication persists
- Technical debt accumulates

**Effort:** Small
**Risk:** None

## Technical Details

**Affected Files:**

- `apps/web/src/components/tenant/TenantLandingPage.tsx`

## Acceptance Criteria

- [ ] TenantLandingPage uses SectionRenderer for applicable sections
- [ ] Inline section code removed
- [ ] Visual output unchanged
- [ ] Package card logic preserved (unique to this component)
- [ ] TypeScript passes

## Work Log

| Date       | Action                   | Learnings                                          |
| ---------- | ------------------------ | -------------------------------------------------- |
| 2025-12-25 | Created from code review | Major duplication between new and legacy rendering |
