# Storefront Draft System Checklist

**Created:** 2026-01-10
**Status:** Active
**Priority:** P1 Prevention

## Quick Reference: Before Merging Code That Touches Landing Page Config

### Read Operations

- [ ] Am I **reading** from `landingPageConfigDraft`? (not `landingPageConfig`)
- [ ] Am I using `getDraftConfigWithSlug()` from `agent/tools/utils.ts`?

### Write Operations

- [ ] Am I **writing** to `landingPageConfigDraft`? (not `landingPageConfig`)
- [ ] Am I using `DraftUpdateService` for hero/section updates?
- [ ] Am I wrapping read-check-write in a transaction with advisory lock?

### Return Values

- [ ] Am I returning `hasDraft: true` after draft writes?
- [ ] Does the preview URL include `?preview=draft`?

### Testing

- [ ] Is there a unit test asserting the correct field name (`landingPageConfigDraft`)?
- [ ] Does the test verify `landingPageConfig` was NOT modified?

---

## Correct Patterns

### Reading Draft Config

```typescript
// ✅ CORRECT - Uses shared utility
import { getDraftConfigWithSlug } from '../tools/utils';

const { pages, slug } = await getDraftConfigWithSlug(prisma, tenantId);
```

```typescript
// ❌ WRONG - Reads from live config
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { landingPageConfig: true }, // BUG: Should be landingPageConfigDraft
});
```

### Writing Draft Config

```typescript
// ✅ CORRECT - Writes to draft
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    landingPageConfigDraft: updatedConfig as unknown as Prisma.JsonObject,
  },
});
```

```typescript
// ❌ WRONG - Writes to live (bypasses preview!)
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    landingPageConfig: updatedConfig, // BUG: Changes won't show in preview
  },
});
```

### Using DraftUpdateService (Recommended)

```typescript
// ✅ CORRECT - Uses shared service (DRY, handles locking)
import { DraftUpdateService } from '../services/draft-update.service';

const draftService = new DraftUpdateService(prisma);
const result = await draftService.updateHeroSection(tenantId, {
  headline: 'New Headline',
  tagline: 'New Tagline',
});
// result.hasDraft === true
// result.previewUrl === '/t/{slug}?preview=draft'
```

---

## Exceptions (Intentional Live Writes)

These executors intentionally write to `landingPageConfig`:

| Executor                     | Reason                                          |
| ---------------------------- | ----------------------------------------------- |
| `publish_draft`              | Copies draft to live (that's its job)           |
| `update_storefront_branding` | Branding applies immediately, not page-specific |

---

## Root Cause of 2026-01-10 Bug

The `update_storefront` executor in `onboarding-executors.ts` read from `landingPageConfig`
and wrote to `landingPageConfig` instead of `landingPageConfigDraft`.

**Symptoms:**

- AI agent says "I've updated your headline"
- Preview shows no change
- Live storefront shows no change (until publish)
- User thinks feature is broken

**Root Cause:**

```typescript
// Line 192-195 - WRONG READ
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { landingPageConfig: true },  // ❌ Should be landingPageConfigDraft
});

// Line 228 - WRONG WRITE
tenantUpdates.landingPageConfig = { ... } // ❌ Should be landingPageConfigDraft
```

**Fix:**

- Refactored to use `DraftUpdateService` which correctly uses `getDraftConfigWithSlug()` and writes to `landingPageConfigDraft`
- Added advisory lock for TOCTOU prevention
- Added unit tests that assert on correct field name

---

## Related Files

| File                                                 | Purpose                           |
| ---------------------------------------------------- | --------------------------------- |
| `server/src/agent/services/draft-update.service.ts`  | Shared service for draft updates  |
| `server/src/agent/tools/utils.ts`                    | `getDraftConfigWithSlug()` helper |
| `server/src/agent/executors/onboarding-executors.ts` | Uses DraftUpdateService           |
| `server/src/agent/executors/storefront-executors.ts` | Reference implementation          |
| `plans/fix-agent-storefront-update-system.md`        | Full bug analysis and fix plan    |

---

## Test Pattern

```typescript
it('should write to landingPageConfigDraft, NOT landingPageConfig', async () => {
  // ... setup ...

  const updateCall = mockPrisma.tenant.update.mock.calls[0][0];

  // CRITICAL: Verify we're writing to DRAFT, not LIVE
  expect(updateCall.data).toHaveProperty('landingPageConfigDraft');
  expect(updateCall.data).not.toHaveProperty('landingPageConfig');
});
```

---

## See Also

- `docs/solutions/patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md`
- `docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md`
