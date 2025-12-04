---
status: wontfix
priority: p1
issue_id: '238'
tags: [api-design, data-integrity, landing-page, validation]
dependencies: []
source: 'code-review-pr-14'
resolved_at: '2025-12-04'
resolved_by: 'claude-code'
resolution: 'already-addressed'
---

# TODO-238: Replace Silent URL Validation Failure with Error

## Priority: P1 (Critical - Blocks Merge)

## Status: Won't Fix (Already Addressed)

## Source: Code Review - PR #14 (Code Philosopher + Code Simplicity Reviewer)

## Resolution

**This issue was already addressed in the initial implementation.** The code review finding was based on incorrect analysis.

The current implementation at `tenant.repository.ts:441-447` already:

1. Uses `safeParse` to avoid throwing directly
2. Checks `!result.success` to detect validation failures
3. Logs a warning with the path and truncated URL
4. **Throws `ValidationError`** with a clear message including the field path

```typescript
// ACTUAL current code (lines 441-447):
for (const { path, url } of urlsToValidate) {
  const result = SafeImageUrlSchema.safeParse(url);
  if (!result.success) {
    logger.warn({ path, url: url.substring(0, 100) }, 'Invalid image URL rejected');
    throw new ValidationError(`Invalid image URL at ${path}: ${result.error.issues[0]?.message}`);
  }
}
```

There is **no silent failure** - invalid URLs are rejected with a clear error message.

## Original Problem Statement (Incorrect)

The `validateImageUrls` method in `tenant.repository.ts` catches validation errors and silently replaces invalid URLs with empty strings. This violates the principle of fail-fast and causes silent data loss that users won't notice until viewing their live page.

**Why It Matters:**

- User uploads malicious URL → saved as '' → user sees broken image with no explanation
- Debugging nightmare: "Why is my image missing?"
- API should reject invalid data, not silently transform it

## Original Findings (Incorrect)

**Evidence:**

```typescript
// tenant.repository.ts:708-712 - THIS CODE DOES NOT EXIST
try {
  SafeImageUrlSchema.parse(url);
} catch {
  // Silent failure - URL becomes ''
}
```

**Better Pattern (from route handler):**

```typescript
// Route handler throws ZodError with details
if (error instanceof ZodError) {
  res.status(400).json({
    error: 'Validation error',
    details: error.issues,
  });
}
```

## Proposed Solution

**Option A: Throw ValidationError (Recommended)**

```typescript
private validateImageUrls(config: LandingPageConfig): void {
  const urlsToValidate: { path: string; url: string | undefined }[] = [
    { path: 'hero.backgroundImageUrl', url: config.hero?.backgroundImageUrl },
    { path: 'about.imageUrl', url: config.about?.imageUrl },
    // ... other URLs
  ];

  const errors: string[] = [];
  for (const { path, url } of urlsToValidate) {
    if (url) {
      const result = SafeImageUrlSchema.safeParse(url);
      if (!result.success) {
        errors.push(`${path}: ${result.error.issues[0].message}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(`Invalid image URLs: ${errors.join(', ')}`);
  }
}
```

**Option B: Return Validation Result**

```typescript
private validateImageUrls(config: LandingPageConfig): { valid: boolean; errors: string[] } {
  // ... validation logic
  return { valid: errors.length === 0, errors };
}

// Caller decides what to do with errors
const validation = this.validateImageUrls(config);
if (!validation.valid) {
  throw new ValidationError(validation.errors.join(', '));
}
```

## Acceptance Criteria

- [x] Invalid URLs throw ValidationError instead of becoming '' - **Already implemented**
- [x] Error message includes which field failed validation - **Already implemented**
- [x] Route handler catches ValidationError and returns 400 - **Already implemented**
- [x] Unit test: Malicious URL returns 400 with clear error message - **Verified by existing tests**
- [x] No silent data loss in any code path - **Confirmed**

## Work Log

| Date       | Action    | Notes                                                                                                                                       |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-12-04 | Created   | Code review of PR #14                                                                                                                       |
| 2025-12-04 | Won't Fix | Investigation revealed the code already throws ValidationError. The finding was based on incorrect analysis of a non-existent code pattern. |

## Tags

api-design, data-integrity, landing-page, validation
