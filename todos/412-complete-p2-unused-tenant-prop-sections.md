---
status: complete
priority: p2
issue_id: '412'
tags:
  - code-review
  - code-quality
  - typescript
  - locked-template-system
dependencies: []
---

# Unused tenant Prop in Section Components

## Problem Statement

Several section components accept a `tenant: TenantPublicDto` prop but never use it. This suggests incomplete implementation or over-engineering.

**Why This Matters:**

- Props should be used or removed
- Unused props create confusion
- May indicate missing functionality (e.g., alt text)

## Findings

**Affected Components:**

- `HeroSection.tsx` - `tenant` in interface, only `basePath` used
- `FAQSection.tsx` - `tenant` in interface, never used
- `CTASection.tsx` - `tenant` in interface, never used
- `TestimonialsSection.tsx` - `tenant` in interface, never used
- `GallerySection.tsx` - `tenant` in interface, never used

**Components that correctly use tenant:**

- `TextSection.tsx` - Uses `tenant.name` for alt text
- `ContactSection.tsx` - Uses `tenant.name` for heading fallback

**Agent:** Pattern Recognition Specialist, Code Simplicity Reviewer

## Proposed Solutions

### Solution 1: Use tenant for Alt Text/Accessibility (Recommended)

Use `tenant.name` for image alt text and ARIA labels.

```typescript
// GallerySection.tsx
alt={image.alt || `Work by ${tenant.name}`}

// HeroSection.tsx
aria-label={`Welcome to ${tenant.name}`}
```

**Pros:**

- Improves accessibility
- Consistent with TextSection/ContactSection pattern
- Makes use of available data

**Cons:**

- Minor code changes

**Effort:** Small
**Risk:** None

### Solution 2: Remove Unused Props

Remove `tenant` prop from components that don't need it.

**Pros:**

- Cleaner interfaces
- No confusion

**Cons:**

- Inconsistent props across sections
- May need it later

**Effort:** Small
**Risk:** Low

## Technical Details

**Affected Files:**

- `apps/web/src/components/tenant/sections/HeroSection.tsx`
- `apps/web/src/components/tenant/sections/FAQSection.tsx`
- `apps/web/src/components/tenant/sections/CTASection.tsx`
- `apps/web/src/components/tenant/sections/TestimonialsSection.tsx`
- `apps/web/src/components/tenant/sections/GallerySection.tsx`

## Acceptance Criteria

- [ ] Each component either uses `tenant` prop or has it removed
- [ ] Alt text/accessibility improved where applicable
- [ ] Consistent pattern across all section components
- [ ] TypeScript passes

## Work Log

| Date       | Action                   | Learnings                                       |
| ---------- | ------------------------ | ----------------------------------------------- |
| 2025-12-25 | Created from code review | Pattern inconsistency across section components |
