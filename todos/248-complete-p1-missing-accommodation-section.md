---
status: complete
priority: p1
issue_id: '248'
tags: [code-review, landing-page, plan, schema-mismatch]
dependencies: ['246']
source: 'plan-review-2025-12-04'
---

# TODO-248: Plan Missing EditableAccommodationSection Component

## Priority: P1 (Critical - Schema Mismatch)

## Status: Pending

## Source: Plan Review - Landing Page Visual Editor (Architecture Review)

## Problem Statement

The feature plan lists 7 editable section components but **omits `EditableAccommodationSection`** despite the accommodation section being defined in the schema and already implemented in the backend.

**Why It Matters:**

- Schema validation will fail when accommodation section is enabled but can't be edited
- Sidebar won't show accommodation toggle
- Incomplete feature vs backend capabilities
- Accommodation has unique requirements not shared by other sections

## Findings

### Evidence of Accommodation Section in Schema

**1. Contract defines accommodation (landing-page.ts lines 157-166):**
```typescript
export const AccommodationSectionConfigSchema = z.object({
  headline: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  imageUrl: SafeImageUrlOptionalSchema,
  ctaText: z.string().min(1).max(50),
  ctaUrl: SafeUrlSchema,  // External URL to booking platform
  highlights: z.array(z.string().max(100)).max(8),
});
```

**2. Backend validates accommodation as valid section:**
- `tenant-admin-landing-page.routes.ts` line 125 includes 'accommodation' in section enum

**3. Read-only component exists:**
- `client/src/features/storefront/landing/sections/AccommodationSection.tsx`

### Plan Lists Only 7 Sections (line 255-263)

1. EditableHeroSection ✓
2. EditableSocialProofBar ✓
3. EditableAboutSection ✓
4. EditableTestimonialsSection ✓
5. EditableGallerySection ✓
6. EditableFaqSection ✓
7. EditableFinalCtaSection ✓
8. **EditableAccommodationSection ❌ MISSING**

### Unique Requirements for Accommodation

Unlike other sections, accommodation has:
- `ctaUrl` - External URL to booking platform (needs URL validation UI)
- `highlights` - Array of string bullets (needs EditableList)
- `imageUrl` - Background image (needs EditableImage)

## Proposed Solutions

### Option A: Add to Plan Phase 2 (Recommended)
- **Effort:** 3-4 hours implementation
- **Risk:** Low
- Add `EditableAccommodationSection.tsx` to Phase 2 file list
- Document unique requirements (URL validation, highlights array)
- **Pros:** Complete feature, matches schema
- **Cons:** Slightly extends Phase 2

### Option B: Defer to Future Phase
- **Effort:** 30 minutes documentation
- **Risk:** Medium
- Document as known gap
- Add separate follow-up TODO
- **Pros:** Faster MVP
- **Cons:** Incomplete feature, schema mismatch risk

## Recommended Action

**Execute Option A:** Add to plan Phase 2:

```markdown
### Phase 2 Files to Create (add to list):

client/src/features/tenant-admin/landing-page-editor/
├── sections/
│   ├── EditableAccommodationSection.tsx  # NEW

### Phase 2 Tasks (add):

- [ ] Create EditableAccommodationSection.tsx with:
  - EditableText for headline, description
  - EditableImage for accommodation background image
  - EditableText for CTA text
  - EditableText for CTA URL (with URL validation feedback)
  - EditableList for highlights (add/remove bullet points)

### Demo Data (add to section-defaults.ts):

accommodation: {
  headline: 'Local Accommodations',
  description: 'We partner with these excellent local accommodations for your stay.',
  imageUrl: undefined,
  ctaText: 'View Accommodations',
  ctaUrl: 'https://airbnb.com',
  highlights: ['Wifi', 'Free Parking', 'Pet Friendly'],
},
```

## Acceptance Criteria

- [ ] Plan updated to include EditableAccommodationSection
- [ ] Component spec includes URL validation for ctaUrl
- [ ] Component spec includes highlights array editing
- [ ] Demo data includes accommodation section defaults
- [ ] Phase 2 time estimate adjusted if needed

## Work Log

| Date       | Action  | Notes                                          |
|------------|---------|------------------------------------------------|
| 2025-12-04 | Created | Plan review identified missing accommodation   |
| 2025-12-05 | Closed  | Verified: EditableAccommodationSection.tsx exists (182 lines, commit 1647a40) |

## Tags

code-review, landing-page, plan, schema-mismatch
