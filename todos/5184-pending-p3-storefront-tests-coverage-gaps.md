---
status: pending
priority: p3
issue_id: '5184'
tags: [code-review, testing, coverage]
dependencies: []
---

# Storefront Tools Tests - Coverage Gaps for Edge Cases

## Problem Statement

The test coverage analysis revealed several untested code paths, helper functions, and edge cases in storefront-tools.ts. While the main happy paths are tested, some edge cases and error paths lack coverage.

**Why it matters:** Untested code paths can harbor bugs that only appear in production under specific conditions.

## Findings

### 1. Untested Helper Functions

| Function                  | Gap                                              |
| ------------------------- | ------------------------------------------------ |
| `findPlaceholderFields()` | No test for nested `items[0].question` format    |
| `getItemCount()`          | No test for `images`, `tiers`, `features` arrays |
| `getSectionHeadline()`    | No test for content truncation (>50 chars)       |
| `getFieldValue()`         | No test for nested path resolution edge cases    |

### 2. Untested Branches

| Tool                    | Branch                                     | Gap                                         |
| ----------------------- | ------------------------------------------ | ------------------------------------------- |
| `updatePageSectionTool` | Append new section (`sectionIndex === -1`) | Tests update but not append                 |
| `updatePageSectionTool` | All `fieldsToCopy` fields                  | Missing: backgroundImageUrl, imageUrl, etc. |
| `removePageSectionTool` | Negative sectionIndex                      | No validation test                          |
| `removePageSectionTool` | Section without ID (legacy)                | No fallback ID test                         |
| `listSectionIdsTool`    | Combined filters                           | Tests filters individually, not combined    |

### 3. Untested Error Paths

| Tool                           | Error Path                                            |
| ------------------------------ | ----------------------------------------------------- |
| `removePageSectionTool`        | `RemovePageSectionPayloadSchema` validation failure   |
| `reorderPageSectionsTool`      | `ReorderPageSectionsPayloadSchema` validation failure |
| `togglePageEnabledTool`        | `TogglePageEnabledPayloadSchema` validation failure   |
| `updateStorefrontBrandingTool` | Invalid hex color format                              |

### 4. Untested Section Types

No specific tests for:

- FAQ sections with items array
- Pricing sections with tiers
- Features sections with columns
- Gallery sections with images
- Contact sections with all fields
- Testimonials sections with items

## Proposed Solutions

### Option 1: Comprehensive Edge Case Suite (Recommended)

Add targeted tests for each gap:

```typescript
describe('Edge Cases', () => {
  describe('Section Type Variations', () => {
    it.each([
      { type: 'faq', data: { headline: 'FAQ', items: [{ question: 'Q?', answer: 'A' }] } },
      {
        type: 'pricing',
        data: { headline: 'Plans', tiers: [{ name: 'Basic', price: 100, features: [] }] },
      },
      {
        type: 'features',
        data: {
          headline: 'Features',
          features: [{ icon: 'star', title: 'Fast', description: 'Quick' }],
        },
      },
    ])('should handle $type section with all fields', async ({ type, data }) => {
      // Test...
    });
  });

  describe('Index Boundaries', () => {
    it('should handle sectionIndex: -1 to append', async () => {
      // Test append behavior
    });

    it('should handle last valid index', async () => {
      // Test removing/updating last section
    });
  });
});
```

**Pros:** Complete coverage, catches regression
**Cons:** More tests to maintain
**Effort:** Large (4-5 hours)
**Risk:** Low

### Option 2: Parameterized Field Tests

Use parameterized tests for `fieldsToCopy`:

```typescript
const SECTION_FIELDS = [
  'headline',
  'subheadline',
  'content',
  'ctaText',
  'backgroundImageUrl',
  'imageUrl',
  'imagePosition',
  'items',
  'images',
  'instagramHandle',
  'email',
  'phone',
  'address',
  'hours',
  'tiers',
  'features',
  'columns',
  'backgroundColor',
];

it.each(SECTION_FIELDS)('should copy %s field to section data', async (field) => {
  // Test that field is copied
});
```

**Pros:** DRY, comprehensive field coverage
**Cons:** May need different fixtures per field
**Effort:** Medium (2-3 hours)
**Risk:** Low

### Option 3: Prioritize Error Paths Only

Focus on just the error path tests (validation failures).

**Pros:** Faster, high-value tests
**Cons:** Leaves edge cases untested
**Effort:** Small (1-2 hours)
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/test/agent/tools/storefront-tools.test.ts`
- `server/src/agent/tools/storefront-tools.ts`

## Acceptance Criteria

- [ ] Section type variations tested (FAQ, pricing, features, etc.)
- [ ] Append behavior (`sectionIndex: -1`) tested
- [ ] All `fieldsToCopy` fields tested
- [ ] Payload validation error paths tested
- [ ] Legacy section ID fallback tested

## Work Log

| Date       | Action                   | Learnings                                  |
| ---------- | ------------------------ | ------------------------------------------ |
| 2026-01-15 | Created from code review | Coverage analyzer found ~20 untested paths |

## Resources

- Test file: `server/test/agent/tools/storefront-tools.test.ts`
- Source file: `server/src/agent/tools/storefront-tools.ts`
- Section schemas: `packages/contracts/src/landing-page.ts`
