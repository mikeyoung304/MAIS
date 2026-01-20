# Wrapper Format Bug - Quick Reference

**Bug:** Missing `publishedAt` timestamp when publishing landing page config
**Fix:** Always use `createPublishedWrapper()` helper function
**Status:** Prevention patterns documented

---

## The Problem

```typescript
// ❌ WRONG - Missing publishedAt timestamp
const draftConfig = tenant.landingPageConfigDraft;
await tenantRepo.update(tenantId, {
  landingPageConfig: { published: draftConfig }, // Lost timestamp!
  landingPageConfigDraft: null,
});

// Result: Public API can't see published changes
// Cause: extractPublishedLandingPage() needs publishedAt field
```

## The Solution

```typescript
// ✅ CORRECT - Using wrapper helper
import { createPublishedWrapper } from '../lib/landing-page-utils';

const draftConfig = tenant.landingPageConfigDraft;
await tenantRepo.update(tenantId, {
  landingPageConfig: createPublishedWrapper(draftConfig), // Includes timestamp!
  landingPageConfigDraft: null,
});

// Helper creates:
// {
//   draft: null,
//   draftUpdatedAt: null,
//   published: draftConfig,
//   publishedAt: "2026-01-20T15:30:45.123Z"  ← Required!
// }
```

---

## Code Review Checklist

**3-Second Check:** Search PR for `landingPageConfig:` pattern

```typescript
// Search for these patterns in review:
1. landingPageConfig: createPublishedWrapper(  ✅ GOOD
2. landingPageConfig: { published:           ❌ BAD - needs wrapper
3. landingPageConfig: draftConfig            ❌ BAD - needs wrapper
4. publishedAt: new Date()                   ❌ BAD - must be ISO string
```

**Verify After Merge:**

```bash
# Check all update calls to landingPageConfig
grep -r "landingPageConfig:" server/src/routes
grep -r "landingPageConfig:" server/src/services
grep -r "landingPageConfig:" server/src/agent/executors

# Should only see: createPublishedWrapper( in each file
```

---

## Type Safety Pattern

```typescript
// Define branded type to prevent bypass
export type ValidatedPublishedWrapper = PublishedWrapper & {
  readonly __brand: 'ValidatedPublishedWrapper';
};

// Force all callers to use the factory
export function createPublishedWrapper(draftConfig: unknown): ValidatedPublishedWrapper {
  return {
    draft: null,
    draftUpdatedAt: null,
    published: draftConfig,
    publishedAt: new Date().toISOString(),
  } as ValidatedPublishedWrapper;
}

// Repository accepts branded type
async update(tenantId: string, data: {
  landingPageConfig?: ValidatedPublishedWrapper;  // Only accepts branded wrapper
}) {
  // Caller cannot pass plain object without using createPublishedWrapper()
}
```

---

## Test Pattern

```typescript
describe('Publishing', () => {
  it('includes publishedAt timestamp', async () => {
    const wrapper = createPublishedWrapper(draftConfig);

    expect(wrapper.publishedAt).toBeDefined();
    expect(wrapper.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    expect(wrapper.draft).toBeNull();
    expect(wrapper.draftUpdatedAt).toBeNull();
  });

  it('persists timestamp to database', async () => {
    const before = new Date();
    await landingPageService.publishBuildModeDraft(tenantId);
    const after = new Date();

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const published = tenant.landingPageConfig as any;

    const ts = new Date(published.publishedAt);
    expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
```

---

## Where This Matters

1. **Service layer:** `LandingPageService.publishBuildModeDraft()`
2. **Routes:** `POST /v1/internal/agent/storefront/publish`
3. **Agent executors:** `storefront-executors.ts` publish_draft
4. **Repository:** Any method that sets `landingPageConfig`

---

## Emergency Diagnosis

If published changes aren't visible:

```typescript
// Check the wrapper structure
const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
const config = tenant.landingPageConfig as any;

console.log('Has all fields?', {
  hasDraft: 'draft' in config,
  hasDraftUpdatedAt: 'draftUpdatedAt' in config,
  hasPublished: 'published' in config,
  hasPublishedAt: 'publishedAt' in config,
});

console.log(
  'publishedAt is ISO?',
  typeof config.publishedAt === 'string' &&
    config.publishedAt.includes('T') &&
    config.publishedAt.includes('Z')
);

// If any false: need to republish with correct wrapper
```

---

## Related Files

- **Implementation:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/landing-page-utils.ts`
- **Service:** `/Users/mikeyoung/CODING/MAIS/server/src/services/landing-page.service.ts`
- **Routes:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/internal-agent.routes.ts` (line 1477)
- **Full Guide:** `docs/solutions/WRAPPER_FORMAT_PREVENTION.md`
