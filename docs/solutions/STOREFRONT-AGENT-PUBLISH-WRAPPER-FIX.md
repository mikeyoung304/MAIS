---
title: 'Storefront Agent Draft Publish Wrapper Fix (#697)'
slug: storefront-agent-publish-wrapper-fix
category: data-integrity
severity: p1
component: storefront-agent
symptoms:
  - Agent claims "Storefront ✓" publish success but landing page headlines don't persist
  - Preview shows placeholder text like "[Your Transformation Headline]" after publish
  - Packages save correctly, but landing page configuration (headlines, sections) lost
  - publishedAt timestamp missing from landingPageConfig field
root_cause: incomplete-wrapper-format
solution_type: architecture-fix
date_solved: '2026-01-20'
pr_url: null
related_issues:
  - '#725'
  - '#724'
tags:
  - agent-integration
  - data-persistence
  - wrapper-format
  - dual-draft-system
---

# Storefront Agent Draft Publish Wrapper Fix

## The Problem

The storefront agent would report successful publication with a green checkmark ("Storefront ✓"), but when users checked their preview, the published headlines and sections were missing. They would see placeholder text like `[Your Transformation Headline]` instead of what the agent claimed to have published.

Packages _were_ saving correctly—the issue only affected landing page configuration (headlines, branding, sections).

### Symptoms Checklist

- Agent message: "Done. Check your preview - headline's updated." with "Storefront ✓"
- Preview still shows: `[Your Transformation Headline]` (placeholder)
- Package count shows correctly (3 packages visible, persisted)
- Landing page sections don't appear
- Navigating away and back shows no changes persisted

## Root Cause Analysis

The `/storefront/publish` endpoint in `internal-agent.routes.ts` was using an incomplete wrapper format when storing published configuration:

```typescript
// BROKEN (line 1500 - before fix)
landingPageConfig: {
  published: draftConfig;
} // Missing publishedAt!
```

The public API endpoint `findBySlugPublic()` and the validation layer expect a complete `PublishedWrapper` object:

```typescript
interface PublishedWrapper {
  draft: null;
  draftUpdatedAt: null;
  published: unknown; // Draft config
  publishedAt: string; // ISO timestamp - CRITICAL
}
```

Without the `publishedAt` timestamp, the wrapper failed validation in downstream code. The data was technically stored, but the validation layer couldn't deserialize it properly, causing the UI to display placeholders.

## The Fix

**Location:** `/server/src/routes/internal-agent.routes.ts` lines 1496-1500

**Change:** Use the `createPublishedWrapper()` helper function instead of manual object construction.

### Before (Broken)

```typescript
// Publish: copy draft to live
const draftConfig = tenant.landingPageConfigDraft;
await tenantRepo.update(tenantId, {
  landingPageConfig: { published: draftConfig }, // Missing publishedAt!
  landingPageConfigDraft: null,
});
```

### After (Fixed)

```typescript
// Publish: copy draft to live (using wrapper format for compatibility)
// Must use createPublishedWrapper to include publishedAt timestamp
// See: docs/solutions/integration-issues/agent-deployment-ci-cd-gap.md
const draftConfig = tenant.landingPageConfigDraft;
await tenantRepo.update(tenantId, {
  landingPageConfig: createPublishedWrapper(draftConfig), // ✓ Includes publishedAt
  landingPageConfigDraft: null,
});
```

## Why This Happened

1. **Wrapper format extracted during DRY refactor (TODO #725)** - `createPublishedWrapper()` was extracted into `landing-page-utils.ts` to prevent duplication between the service layer and agent executors.

2. **Not updated in agent routes** - The `/storefront/publish` endpoint was written before the utility was extracted, and didn't get updated to use the new helper.

3. **Silent failure** - The validation layer couldn't deserialize the incomplete wrapper, but the error wasn't obvious—the UI just showed placeholders instead of the published content.

## The Helper Function

**File:** `/server/src/lib/landing-page-utils.ts`

```typescript
/**
 * Create the published wrapper format for storing in landingPageConfig
 *
 * The public API (findBySlugPublic) expects the wrapper format:
 * `{ draft, draftUpdatedAt, published, publishedAt }`
 *
 * @param draftConfig - The draft configuration to publish
 * @returns Wrapper object ready for storing in landingPageConfig
 */
export function createPublishedWrapper(draftConfig: unknown): PublishedWrapper {
  return {
    draft: null,
    draftUpdatedAt: null,
    published: draftConfig,
    publishedAt: new Date().toISOString(), // ← Critical timestamp
  };
}
```

The function ensures all four fields are present and correctly formatted.

## Impact

- **Service Layer** (`landing-page.service.ts` - `publishBuildModeDraft()`) - Already using `createPublishedWrapper()`
- **Agent Executors** (`storefront-executors.ts` - `publish_draft` executor) - Already using `createPublishedWrapper()`
- **Agent Routes** (`internal-agent.routes.ts` - `/storefront/publish` endpoint) - **NOW FIXED** to use `createPublishedWrapper()`

All three paths now use the same single source of truth for the wrapper format.

## Prevention Rule (Pitfall #56)

**Added to CLAUDE.md:**

> 56. Incomplete landingPageConfig wrapper - When publishing storefront drafts, must use `createPublishedWrapper(draftConfig)` from `lib/landing-page-utils.ts`, NOT bare `{ published: draftConfig }` - missing `publishedAt` timestamp causes data not to round-trip through validation

### Checklist for Future Publish Operations

- [ ] Use `createPublishedWrapper(draftConfig)` helper, never manual `{ published: ... }`
- [ ] Import from `../lib/landing-page-utils.ts` - single source of truth
- [ ] Verify `publishedAt` is ISO 8601 format (from `new Date().toISOString()`)
- [ ] Set `draft: null` and `draftUpdatedAt: null` when publishing
- [ ] Test round-trip: publish → query → validate

## Testing Scenarios

### Before Fix (Would Fail)

1. Agent publishes headline changes
2. Database stores: `{ published: {...}, landingPageConfigDraft: null }`
3. Public API queries: `findBySlugPublic(slug)`
4. Validation layer fails: `publishedAt` is missing
5. UI shows placeholders
6. **Result:** Agent says ✓ but changes don't appear

### After Fix (Passes)

1. Agent publishes headline changes
2. Database stores: `{ published: {...}, publishedAt: "2026-01-20T14:30:00Z", landingPageConfigDraft: null }`
3. Public API queries: `findBySlugPublic(slug)`
4. Validation layer passes: all required fields present
5. UI renders: headlines show published content
6. **Result:** Agent says ✓ and changes appear correctly

## Architecture Context

This fix is part of the **dual draft system** architecture:

```
Tenant Model:
├── landingPageConfig
│   ├── draft: null (when published)
│   ├── draftUpdatedAt: null (when published)
│   ├── published: {...}  (the live content)
│   └── publishedAt: "2026-01-20..."  (publish timestamp)
├── landingPageConfigDraft
│   └── {...}  (working copy before publish)
```

When the storefront agent publishes:

1. `landingPageConfigDraft` (working copy) → moves to `published` field
2. `draft` field → set to `null`
3. `publishedAt` → set to current ISO timestamp
4. `landingPageConfigDraft` → set to `null`

## Files Modified

1. **`server/src/routes/internal-agent.routes.ts`** (line 53, lines 1496-1500)
   - Added import: `import { createPublishedWrapper } from '../lib/landing-page-utils'`
   - Changed publish endpoint to use helper

2. **`CLAUDE.md`** (pitfall #56)
   - Added prevention rule for incomplete wrappers

## Related Documentation

- `/docs/solutions/patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md` - Dual draft patterns
- `/todos/725-resolved-p2-duplicate-publish-discard-executors.md` - DRY refactor that extracted the utility
- `/server/src/lib/landing-page-utils.ts` - Single source of truth for wrapper format

## Verification Steps

```bash
# 1. Verify import is present
grep -n "createPublishedWrapper" server/src/routes/internal-agent.routes.ts

# 2. Verify endpoint uses it
grep -A5 "storefront/publish" server/src/routes/internal-agent.routes.ts | grep createPublishedWrapper

# 3. TypeScript check
npm run typecheck

# 4. Manual test:
# - Start dev servers: npm run dev:all
# - Use storefront agent to publish a headline
# - Query the published wrapper: curl http://localhost:3001/v1/internal/agent/storefront/preview
# - Verify publishedAt is present and recent
```

## Key Learnings

1. **Single source of truth matters** - When a format is extracted to a utility (as done in #725), ALL code paths must use that utility, including API endpoints.

2. **Silent failures with validation** - When a wrapper is incomplete, the validation layer silently drops the data rather than throwing an error. This makes debugging harder.

3. **Test the round-trip** - Just storing data isn't enough; test that reading it back deserializes correctly.

4. **Timestamp is not optional** - The `publishedAt` field isn't just metadata—it's used by validation and sorting logic downstream.

## Prevention for Similar Issues

When implementing publish/draft operations:

1. Always use helpers/utilities for wrapper formats
2. Never construct wrappers inline in API endpoints
3. Include all required timestamp fields
4. Test the round-trip: write → read → validate
5. Document which fields are critical (like `publishedAt`)
