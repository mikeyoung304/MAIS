---
status: wontfix
priority: p1
issue_id: '239'
tags: [code-quality, landing-page, duplication, maintainability]
dependencies: ['238']
source: 'code-review-pr-14'
resolved_at: '2025-12-04'
resolved_by: 'claude-code'
resolution: 'already-addressed'
---

# TODO-239: Simplify URL Validation Code (55 Lines → ~15 Lines)

## Priority: P1 → Downgraded to P3 (Nice to Have)

## Status: Won't Fix (Already Well-Structured)

## Source: Code Review - PR #14 (Code Simplicity Reviewer)

## Resolution

**The current implementation already uses the proposed pattern.** The code review finding was based on a hypothetical "bad pattern" that doesn't exist in the codebase.

The actual implementation at `tenant.repository.ts:393-448`:

1. **Already uses declarative URL collection** (lines 394-438)
2. **Already uses a validation loop** (lines 440-447)
3. **Already provides path information** in error messages

The "55 lines" includes JSDoc comments (10 lines) and the loop itself. The core URL collection logic is straightforward and adding a separate `extractImageUrls` method would add minimal value while increasing indirection.

**Actual current code structure:**

```typescript
private validateImageUrls(config: LandingPageConfig): void {
  const urlsToValidate: { path: string; url: string }[] = [];

  // Collect URLs with paths (clear, declarative)
  if (config.hero?.backgroundImageUrl) {
    urlsToValidate.push({ path: 'hero.backgroundImageUrl', url: config.hero.backgroundImageUrl });
  }
  // ... other fields

  // Validate all URLs in a loop (exactly as proposed)
  for (const { path, url } of urlsToValidate) {
    const result = SafeImageUrlSchema.safeParse(url);
    if (!result.success) {
      logger.warn({ path, url: url.substring(0, 100) }, 'Invalid image URL rejected');
      throw new ValidationError(`Invalid image URL at ${path}: ${result.error.issues[0]?.message}`);
    }
  }
}
```

## Original Problem Statement (Incorrect Premise)

The `validateImageUrls` method in `tenant.repository.ts` is 55 lines of repetitive if-statements. Each image field is validated individually with the same pattern. This violates DRY and makes adding new image fields error-prone.

**Why It Matters:**

- Adding a new section with images requires adding 5+ lines in multiple places
- Easy to forget a field when copy-pasting
- Code review burden increases with repetitive code

## Original Findings (Incorrect - This Pattern Doesn't Exist)

**Current Pattern (55 lines):**

```typescript
// THIS CODE DOES NOT EXIST IN THE CODEBASE
private validateImageUrls(config: LandingPageConfig): void {
  if (config.hero?.backgroundImageUrl) {
    try {
      SafeImageUrlSchema.parse(config.hero.backgroundImageUrl);
    } catch {
      // handle error
    }
  }
  if (config.about?.imageUrl) {
    try {
      SafeImageUrlSchema.parse(config.about.imageUrl);
    } catch {
      // handle error
    }
  }
  // ... 40 more lines of the same pattern
}
```

## Proposed Solution

**Declarative URL extraction + loop:**

```typescript
private validateImageUrls(config: LandingPageConfig): void {
  const imageUrls = this.extractImageUrls(config);

  const errors: string[] = [];
  for (const { path, url } of imageUrls) {
    const result = SafeImageUrlSchema.safeParse(url);
    if (!result.success) {
      errors.push(`${path}: ${result.error.issues[0].message}`);
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(`Invalid image URLs: ${errors.join(', ')}`);
  }
}

private extractImageUrls(config: LandingPageConfig): { path: string; url: string }[] {
  const urls: { path: string; url: string }[] = [];

  if (config.hero?.backgroundImageUrl) {
    urls.push({ path: 'hero.backgroundImageUrl', url: config.hero.backgroundImageUrl });
  }
  if (config.about?.imageUrl) {
    urls.push({ path: 'about.imageUrl', url: config.about.imageUrl });
  }
  if (config.accommodation?.imageUrl) {
    urls.push({ path: 'accommodation.imageUrl', url: config.accommodation.imageUrl });
  }

  // Handle arrays
  config.gallery?.images?.forEach((img, i) => {
    if (img.url) urls.push({ path: `gallery.images[${i}].url`, url: img.url });
  });
  config.testimonials?.items?.forEach((item, i) => {
    if (item.imageUrl) urls.push({ path: `testimonials.items[${i}].imageUrl`, url: item.imageUrl });
  });

  return urls;
}
```

**Benefits:**

- Validation logic in one place (loop)
- URL extraction clearly shows all image fields
- Adding new field = one line in extractImageUrls
- Better error messages with paths

## Acceptance Criteria

- [x] validateImageUrls reduced from 55 lines to ~15-20 lines - **N/A: Already well-structured**
- [x] All image fields still validated (hero, about, accommodation, gallery, testimonials) - **Confirmed**
- [x] Error messages include field path (e.g., "gallery.images[2].url") - **Already implemented**
- [x] Unit tests pass for all image fields - **Confirmed**
- [x] No functionality change, only code organization - **No change needed**

## Work Log

| Date       | Action    | Notes                                                                                                                                                                                       |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-12-04 | Created   | Code review of PR #14                                                                                                                                                                       |
| 2025-12-04 | Won't Fix | Investigation revealed the code already uses the proposed pattern (declarative collection + loop). The finding was based on an incorrect description of a "bad pattern" that doesn't exist. |

## Tags

code-quality, landing-page, duplication, maintainability
