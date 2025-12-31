---
status: complete
priority: p2
issue_id: '411'
tags:
  - code-review
  - architecture
  - technical-debt
  - locked-template-system
dependencies:
  - '407'
---

# Dual Schema Architecture Adds Complexity

## Problem Statement

The landing page contracts maintain TWO parallel schema systems (legacy + new page-based), adding ~150 lines of duplicated schema definitions and requiring format conversion in multiple places.

**Why This Matters:**

- Schema definitions duplicated (e.g., hero section defined twice)
- Frontend must handle both formats with conversion logic
- Increased testing surface
- Migration complexity increases over time

## Findings

**Location:** `packages/contracts/src/landing-page.ts`

**Evidence:**

**Legacy System (Lines 99-222):**

- HeroSectionConfigSchema
- SocialProofBarConfigSchema
- AboutSectionConfigSchema
- TestimonialsSectionConfigSchema
- AccommodationSectionConfigSchema
- GallerySectionConfigSchema
- FaqSectionConfigSchema
- FinalCtaSectionConfigSchema

**New Page-Based System (Lines 231-370):**

- HeroSectionSchema
- TextSectionSchema
- GallerySectionSchema
- TestimonialsSectionSchema
- FAQSectionSchema
- ContactSectionSchema
- CTASectionSchema

**Format conversion** appears in:

- `apps/web/src/app/t/[slug]/(site)/gallery/page.tsx` (lines 70-83)
- `apps/web/src/app/t/[slug]/(site)/testimonials/page.tsx` (lines 70-85)
- Similar pattern in about, faq pages

**Agent:** Code Simplicity Reviewer, Architecture Strategist

## Proposed Solutions

### Solution 1: Complete Migration, Remove Legacy (Long-term)

After migration script runs on all tenants:

1. Remove legacy schema definitions
2. Remove format conversion code
3. Update all consumers to use new format only

**Pros:**

- ~150 lines removed from contracts
- ~50 lines removed from page components
- Simpler mental model

**Cons:**

- Requires migration complete first
- Breaking change for any external consumers

**Effort:** Large
**Risk:** Medium (requires coordination)

### Solution 2: Centralize Format Conversion (Short-term)

Create `normalizeConfig()` helper to handle conversion in one place.

```typescript
// lib/tenant.ts
export function normalizeConfig(config: LandingPageConfig): NormalizedConfig {
  if (config.pages) return config.pages;
  // Convert legacy to new format
  return convertLegacyToPages(config);
}
```

**Pros:**

- Reduces duplication across pages
- Single conversion logic
- Non-breaking

**Cons:**

- Dual schemas still exist

**Effort:** Small
**Risk:** Low

## Recommended Action

Start with Solution 2 (centralize conversion), plan Solution 1 for after migration completes.

## Technical Details

**Affected Files:**

- `packages/contracts/src/landing-page.ts`
- `apps/web/src/lib/tenant.ts`
- Multiple page components

## Acceptance Criteria

**Short-term:**

- [ ] `normalizeConfig()` helper created
- [ ] Page components use helper instead of inline conversion
- [ ] TypeScript passes

**Long-term (after migration):**

- [ ] Legacy schemas removed
- [ ] Format conversion code removed
- [ ] All tests passing

## Work Log

| Date       | Action                   | Learnings                               |
| ---------- | ------------------------ | --------------------------------------- |
| 2025-12-25 | Created from code review | Dual schema adds significant complexity |

## Resources

- Depends on: #407 (migration script fixes)
