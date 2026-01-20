---
title: 'Storefront Agent Wrapper Prevention Checklist'
slug: storefront-agent-wrapper-prevention
category: checklist
tags:
  - agent-integration
  - storefront
  - wrapper-format
  - data-integrity
---

# Storefront Agent Wrapper Prevention Checklist

**Related Issue:** #697 - Storefront agent claimed success but changes didn't persist

## Quick Summary

**Problem:** Agent said "✓ Storefront published" but headlines didn't appear in preview.

**Root Cause:** Published wrapper was missing `publishedAt` timestamp field, causing validation to fail silently.

**Solution:** Always use `createPublishedWrapper()` helper from `landing-page-utils.ts`.

---

## Prevention Checklist

### When Publishing Landing Page Configuration

- [ ] **Use the helper function**

  ```typescript
  import { createPublishedWrapper } from '../lib/landing-page-utils';

  // CORRECT
  const published = createPublishedWrapper(draftConfig);

  // WRONG - missing publishedAt
  const published = { published: draftConfig };
  ```

- [ ] **Verify all wrapper fields are present**

  ```typescript
  {
    draft: null,              // ✓ Always null when publishing
    draftUpdatedAt: null,     // ✓ Always null when publishing
    published: draftConfig,   // ✓ The actual content
    publishedAt: string       // ✓ ISO 8601 timestamp - CRITICAL
  }
  ```

- [ ] **Check timestamp format**

  ```typescript
  // ✓ CORRECT - from new Date().toISOString()
  publishedAt: '2026-01-20T14:30:00.000Z';

  // ✗ WRONG - milliseconds missing
  publishedAt: '2026-01-20T14:30:00Z';

  // ✗ WRONG - Unix timestamp
  publishedAt: 1705779000000;
  ```

- [ ] **Clear the draft fields**
  ```typescript
  await db.tenant.update(tenantId, {
    landingPageConfig: createPublishedWrapper(draftConfig),
    landingPageConfigDraft: null, // ✓ Clear draft
  });
  ```

---

## Code Locations to Check

If adding new publish endpoints, verify they use the helper:

| File                                                 | Endpoint                                     | Status         |
| ---------------------------------------------------- | -------------------------------------------- | -------------- |
| `server/src/routes/internal-agent.routes.ts`         | `POST /v1/internal/agent/storefront/publish` | ✓ FIXED        |
| `server/src/services/landing-page.service.ts`        | `publishBuildModeDraft()`                    | ✓ Using helper |
| `server/src/agent/executors/storefront-executors.ts` | `publish_draft` executor                     | ✓ Using helper |
| _Future endpoints_                                   | TBD                                          | Use helper     |

---

## Testing for This Bug

### Manual Test

```bash
# 1. Start servers
npm run dev:all

# 2. Use storefront agent to publish changes

# 3. Query the published wrapper
curl -X POST http://localhost:3001/v1/internal/agent/storefront/preview \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: dev_secret" \
  -d '{"tenantId":"test-tenant"}'

# 4. Verify response includes:
# - publishedAt field (ISO timestamp)
# - published.pages with content
# - draft: null, draftUpdatedAt: null
```

### E2E Test Points

- [ ] Publish headline changes
- [ ] Navigate to preview URL
- [ ] Verify headlines appear (not placeholders)
- [ ] Navigate away and back (persistence check)
- [ ] Verify agent didn't claim success falsely

---

## Common Mistakes

| Mistake                              | Problem                | Solution                                                             |
| ------------------------------------ | ---------------------- | -------------------------------------------------------------------- |
| `{ published: config }`              | Missing `publishedAt`  | Use `createPublishedWrapper()`                                       |
| `publishedAt: Date.now()`            | Unix timestamp not ISO | Use `new Date().toISOString()`                                       |
| `draft: draftConfig` when publishing | Draft not cleared      | Set `draft: null`                                                    |
| Manual wrapper construction          | Inconsistent format    | Always use the helper                                                |
| Missing import                       | Helper not available   | `import { createPublishedWrapper } from '../lib/landing-page-utils'` |

---

## The Helper Function

**Source:** `/server/src/lib/landing-page-utils.ts`

```typescript
export function createPublishedWrapper(draftConfig: unknown): PublishedWrapper {
  return {
    draft: null,
    draftUpdatedAt: null,
    published: draftConfig,
    publishedAt: new Date().toISOString(),
  };
}

export interface PublishedWrapper {
  draft: null;
  draftUpdatedAt: null;
  published: unknown;
  publishedAt: string;
}
```

---

## Why This Matters

1. **Validation depends on it** - Downstream code validates the wrapper format; incomplete wrappers fail silently
2. **UI shows placeholders** - When validation fails, the UI can't deserialize content and shows default text
3. **Agent reports false success** - The agent says "✓ published" but changes don't appear
4. **Silent data loss** - Users see their changes weren't persisted, but no error message explains why

---

## Cross-Endpoint Consistency

All three endpoints that publish landing page configuration must use the same helper:

```typescript
// 1. Service layer (landing-page.service.ts)
const wrapper = createPublishedWrapper(draftConfig);

// 2. Agent executor (storefront-executors.ts)
const wrapper = createPublishedWrapper(draftConfig);

// 3. Agent routes (internal-agent.routes.ts)
const wrapper = createPublishedWrapper(draftConfig); // ← Previously broken
```

This ensures consistency and prevents divergence.

---

## Related Pitfalls

- **Pitfall #56 (CLAUDE.md):** Incomplete landingPageConfig wrapper
- **Pitfall #15 (CLAUDE.md):** Missing cache invalidation after writes
- **TODO #725:** Duplicate publish/discard logic (DRY extraction)

---

## Quick Reference

```typescript
// ALWAYS THIS:
import { createPublishedWrapper } from '../lib/landing-page-utils';

await tenantRepo.update(tenantId, {
  landingPageConfig: createPublishedWrapper(draftConfig),
  landingPageConfigDraft: null,
});

// NEVER THIS:
await tenantRepo.update(tenantId, {
  landingPageConfig: { published: draftConfig }, // Missing publishedAt!
  landingPageConfigDraft: null,
});
```

---

## Related Documentation

- [`/docs/solutions/STOREFRONT-AGENT-PUBLISH-WRAPPER-FIX.md`](../STOREFRONT-AGENT-PUBLISH-WRAPPER-FIX.md) - Full analysis
- [`/docs/solutions/patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md`](./DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md) - Dual draft patterns
- `/server/src/lib/landing-page-utils.ts` - Source code
- `/CLAUDE.md` - Pitfall #56
