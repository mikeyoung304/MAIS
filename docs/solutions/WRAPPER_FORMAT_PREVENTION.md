# Wrapper Format Prevention - Publishing Configuration Bug

**Bug Reference:** The `/storefront/publish` endpoint used `{ published: draftConfig }` instead of `createPublishedWrapper(draftConfig)`, causing headline updates to not persist because the `publishedAt` timestamp was missing.

**Pattern:** When saving `landingPageConfig`, must use the helper function that creates the full wrapper with all required fields (`draft`, `draftUpdatedAt`, `published`, `publishedAt`).

**Severity:** P1 - Data loss (published changes are lost)

**Related Issues:** #697 (Dual draft system publish mismatch fix)

---

## 1. Code Review Checklist Items

Use these checklist items when reviewing landing page publish operations:

### Landing Page Config Updates

- [ ] **Wrapper format required** - All `landingPageConfig` updates must use `createPublishedWrapper()` or preserve existing wrapper structure
- [ ] **Check timestamp inclusion** - `publishedAt` field MUST be present and set to current ISO timestamp (`new Date().toISOString()`)
- [ ] **Verify all fields** - Wrapper must have exactly 4 fields: `draft`, `draftUpdatedAt`, `published`, `publishedAt`
- [ ] **No partial updates** - Don't set only `published` field; use the complete wrapper
- [ ] **Draft nulling** - When publishing, `draftUpdatedAt` MUST be null (only matters when there's an actual draft)
- [ ] **Source verification** - Confirm the config is from `landingPageConfigDraft` (Build Mode) or existing `landingPageConfig` (Visual Editor)
- [ ] **Atomic transaction** - Both `landingPageConfig` and `landingPageConfigDraft` should update in same operation
- [ ] **No direct object literals** - Audit for patterns like `{ published: config }` without wrapper helper

### Data Mutation Review

- [ ] **Single responsibility** - Publishing should ONLY call `createPublishedWrapper()`, nothing custom
- [ ] **Consistency check** - Service method calls use same wrapper function as routes
- [ ] **Test data verification** - Mock/test data includes complete wrapper structure with timestamps
- [ ] **Migration impact** - If schema changes, verify existing records have valid wrapper format

### Post-Publish Verification

- [ ] **Timestamp is ISO string** - Verify format with `.toISOString()` check (e.g., `2026-01-20T15:30:45.123Z`)
- [ ] **Draft actually clears** - Confirm `landingPageConfigDraft` is set to `null`, not empty object
- [ ] **Public API reads correctly** - If changes made to public API, verify `extractPublishedLandingPage()` still works

---

## 2. ESLint Rule & TypeScript Pattern Proposals

### TypeScript: Branded Type for Published Wrapper

Create a branded type to prevent accidental plain object usage:

```typescript
// server/src/lib/landing-page-utils.ts

/**
 * Branded type for validated published wrapper format.
 * Prevents accidental use of plain objects missing required fields.
 */
export type ValidatedPublishedWrapper = PublishedWrapper & {
  readonly __brand: 'ValidatedPublishedWrapper';
};

/**
 * Create the published wrapper format for storing in landingPageConfig
 * Returns branded type that can only come from this factory function.
 */
export function createPublishedWrapper(draftConfig: unknown): ValidatedPublishedWrapper {
  const wrapper: PublishedWrapper = {
    draft: null,
    draftUpdatedAt: null,
    published: draftConfig,
    publishedAt: new Date().toISOString(),
  };

  return wrapper as ValidatedPublishedWrapper;
}

// Tenant repository type constraint
export interface TenantUpdatePayload {
  landingPageConfig?: ValidatedPublishedWrapper; // Only accepts branded wrapper
}
```

### ESLint Rule: Detect Direct landingPageConfig Assignment

Create a custom ESLint rule to catch pattern `landingPageConfig: {`:

```typescript
// .eslintrc.custom-rules/landing-page-config-wrapper.js

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure landingPageConfig updates use createPublishedWrapper()',
      category: 'Security & Data Quality',
    },
  },
  create(context) {
    return {
      ObjectExpression(node) {
        // Find patterns like: { landingPageConfig: { published: ... } }
        node.properties.forEach((prop) => {
          if (
            prop.key &&
            prop.key.name === 'landingPageConfig' &&
            prop.value.type === 'ObjectExpression'
          ) {
            // Check if it looks like a manually constructed wrapper
            const keys = prop.value.properties.map((p) => p.key?.name);
            if (keys.includes('published') && keys.includes('publishedAt')) {
              context.report({
                node: prop.value,
                message:
                  'Use createPublishedWrapper() helper instead of manual object construction for landingPageConfig',
                fix(fixer) {
                  return fixer.replaceText(prop.value, 'createPublishedWrapper(draftConfig)');
                },
              });
            }
          }
        });
      },
    };
  },
};
```

Add to eslintrc:

```json
{
  "rules": {
    "landing-page-config-wrapper": "error"
  }
}
```

### Type-Safe Prisma Update Helper

Add type-safe wrapper to repository to make incorrect usage harder:

```typescript
// server/src/adapters/prisma/tenant.repository.ts

/**
 * Publish landing page config with guaranteed wrapper format
 *
 * This method ensures the wrapper is ALWAYS created correctly.
 * Caller cannot accidentally bypass or manually construct format.
 */
async publishLandingPageDraft(
  tenantId: string,
  draftConfig: unknown
): Promise<{ publishedAt: string }> {
  const wrapper = createPublishedWrapper(draftConfig);

  const result = await this.prisma.tenant.update({
    where: { id: tenantId },
    data: {
      landingPageConfig: wrapper,
      landingPageConfigDraft: null,
    },
    select: { id: true }, // Minimal select
  });

  return { publishedAt: wrapper.publishedAt };
}
```

---

## 3. Test Case Suggestions

### Unit Tests: Wrapper Format Validation

```typescript
// server/test/lib/landing-page-utils.test.ts

describe('createPublishedWrapper', () => {
  it('creates wrapper with all required fields', () => {
    const config = { pages: { home: { sections: [] } } };
    const wrapper = createPublishedWrapper(config);

    expect(wrapper).toHaveProperty('draft', null);
    expect(wrapper).toHaveProperty('draftUpdatedAt', null);
    expect(wrapper).toHaveProperty('published', config);
    expect(wrapper).toHaveProperty('publishedAt');
  });

  it('sets publishedAt to ISO timestamp', () => {
    const config = { pages: { home: { sections: [] } } };
    const before = new Date();
    const wrapper = createPublishedWrapper(config);
    const after = new Date();

    const timestamp = new Date(wrapper.publishedAt);
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('preserves draft config in published field', () => {
    const config = {
      pages: {
        home: {
          sections: [{ id: 'hero', type: 'hero', headline: 'Welcome' }],
        },
      },
    };
    const wrapper = createPublishedWrapper(config);

    expect(wrapper.published).toEqual(config);
  });

  it('never creates wrapper with publishedAt null', () => {
    const config = { pages: { home: { sections: [] } } };
    const wrapper = createPublishedWrapper(config);

    expect(wrapper.publishedAt).not.toBeNull();
    expect(wrapper.publishedAt).not.toBeUndefined();
    expect(typeof wrapper.publishedAt).toBe('string');
  });
});
```

### Integration Tests: Publish Endpoint

```typescript
// server/test/routes/internal-agent-storefront.test.ts

describe('POST /v1/internal/agent/storefront/publish', () => {
  it('creates wrapper with publishedAt timestamp', async () => {
    const tenant = await createTestTenant();
    const draftConfig = { pages: { home: { sections: [] } } };

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { landingPageConfigDraft: draftConfig },
    });

    const response = await request(app)
      .post('/v1/internal/agent/storefront/publish')
      .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET)
      .send({ tenantId: tenant.id });

    expect(response.status).toBe(200);

    const updated = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    const config = updated.landingPageConfig as any;

    // Verify wrapper structure
    expect(config).toHaveProperty('published', draftConfig);
    expect(config).toHaveProperty('publishedAt');
    expect(config.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(config.draft).toBeNull();
    expect(config.draftUpdatedAt).toBeNull();
  });

  it('clears draft after publishing', async () => {
    const tenant = await createTestTenant();
    const draftConfig = { pages: { home: { sections: [] } } };

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { landingPageConfigDraft: draftConfig },
    });

    await request(app)
      .post('/v1/internal/agent/storefront/publish')
      .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET)
      .send({ tenantId: tenant.id });

    const updated = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(updated.landingPageConfigDraft).toBeNull();
  });

  it('preserves published content on next read', async () => {
    const tenant = await createTestTenant();
    const draftConfig = {
      pages: {
        home: {
          sections: [{ id: 'hero', type: 'hero', headline: 'My Site' }],
        },
      },
    };

    // Publish initial content
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { landingPageConfigDraft: draftConfig },
    });

    await request(app)
      .post('/v1/internal/agent/storefront/publish')
      .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET)
      .send({ tenantId: tenant.id });

    // Read published config via service
    const published = await landingPageService.getPublished(tenant.id);
    expect(published).toEqual(draftConfig);
  });

  it('prevents manual object construction pattern', async () => {
    // This test documents what NOT to do
    const badPattern = {
      published: { pages: { home: { sections: [] } } },
      // Missing: draft, draftUpdatedAt, publishedAt
    };

    const isValid = (obj: any) => {
      return (
        'draft' in obj &&
        'draftUpdatedAt' in obj &&
        'published' in obj &&
        'publishedAt' in obj &&
        obj.publishedAt !== null &&
        obj.publishedAt !== undefined
      );
    };

    expect(isValid(badPattern)).toBe(false);

    // Correct way
    const correctWrapper = createPublishedWrapper(badPattern.published);
    expect(isValid(correctWrapper)).toBe(true);
  });
});
```

### Schema Validation Test

```typescript
// server/test/schemas/landing-page-wrapper.test.ts

describe('Published Wrapper Schema', () => {
  it('validates complete wrapper structure', () => {
    const config = { pages: { home: { sections: [] } } };
    const wrapper = createPublishedWrapper(config);

    const schema = z.object({
      draft: z.null(),
      draftUpdatedAt: z.null(),
      published: z.any(),
      publishedAt: z.string().datetime(),
    });

    const result = schema.safeParse(wrapper);
    expect(result.success).toBe(true);
  });

  it('rejects wrapper missing publishedAt', () => {
    const invalidWrapper = {
      draft: null,
      draftUpdatedAt: null,
      published: { pages: { home: { sections: [] } } },
      // Missing: publishedAt
    };

    const schema = z.object({
      draft: z.null(),
      draftUpdatedAt: z.null(),
      published: z.any(),
      publishedAt: z.string().datetime(),
    });

    const result = schema.safeParse(invalidWrapper);
    expect(result.success).toBe(false);
  });

  it('rejects wrapper with null publishedAt', () => {
    const invalidWrapper = {
      draft: null,
      draftUpdatedAt: null,
      published: { pages: { home: { sections: [] } } },
      publishedAt: null,
    };

    const schema = z.object({
      draft: z.null(),
      draftUpdatedAt: z.null(),
      published: z.any(),
      publishedAt: z.string().datetime(),
    });

    const result = schema.safeParse(invalidWrapper);
    expect(result.success).toBe(false);
  });
});
```

---

## 4. Documentation Updates Needed

### A. CLAUDE.md Update

Add to "Critical Security Rules" or new section "Data Format Rules":

````markdown
### Landing Page Publish Format

**CRITICAL:** When publishing landing page config, must use complete wrapper format with `publishedAt` timestamp.

**Correct:**

```typescript
import { createPublishedWrapper } from '../lib/landing-page-utils';

const wrapper = createPublishedWrapper(tenant.landingPageConfigDraft);
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    landingPageConfig: wrapper,
    landingPageConfigDraft: null,
  },
});
```
````

**Wrong:**

```typescript
// ❌ Missing publishedAt timestamp
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    landingPageConfig: { published: draftConfig },
  },
});
```

**Why:** The public API's `extractPublishedLandingPage()` expects wrapper format with `publishedAt`.
Without it, published changes are not visible to visitors.

See: `docs/solutions/WRAPPER_FORMAT_PREVENTION.md`

````

### B. Architecture Document

Add new section `docs/architecture/LANDING_PAGE_WRAPPER_FORMAT.md`:

```markdown
# Landing Page Wrapper Format Architecture

## Overview

Landing page config in the `tenant.landingPageConfig` field uses a wrapper format:

```json
{
  "draft": null,
  "draftUpdatedAt": null,
  "published": { "pages": {...} },
  "publishedAt": "2026-01-20T15:30:45.123Z"
}
````

This wrapper exists because of the **dual draft system**:

- Visual Editor: Saves draft to wrapper's `draft` field, publishes to `published` field
- Build Mode: Saves draft to separate `landingPageConfigDraft` column, publishes to wrapper's `published` field

## Single Source of Truth

`createPublishedWrapper()` in `lib/landing-page-utils.ts` is the **only** way to create the wrapper format.

All code paths must import and use this function:

- `LandingPageService.publishBuildModeDraft()`
- Agent executors in `storefront-executors.ts`
- Routes in `internal-agent.routes.ts`

## Field Semantics

| Field          | Type       | Semantics                  | Notes                                                  |
| -------------- | ---------- | -------------------------- | ------------------------------------------------------ |
| draft          | null       | Always null after publish  | Only populated during edit session for Visual Editor   |
| draftUpdatedAt | null       | Always null after publish  | Timestamp of last draft save                           |
| published      | object     | Live landing page config   | What visitors see                                      |
| publishedAt    | ISO string | When content was published | Required - without it, changes invisible to public API |

## Public API Integration

The public-facing `extractPublishedLandingPage()` reads from `config.published`.
The `publishedAt` field is used for audit logging and cache invalidation.

## Related Issues

- #697 - Dual draft system publish mismatch fix
- TODO-704 - Landing page service abstraction consolidation
- TODO-725 - Prevent duplication between service and executors

````

### C. Code Comment Enhancement

Update the helper function documentation in `landing-page-utils.ts`:

```typescript
/**
 * Create the published wrapper format for storing in landingPageConfig
 *
 * The public API (findBySlugPublic) expects the wrapper format:
 * `{ draft, draftUpdatedAt, published, publishedAt }`
 *
 * When publishing, the draft config becomes published and draft is cleared.
 *
 * @param draftConfig - The draft configuration to publish
 * @returns Wrapper object ready for storing in landingPageConfig
 *
 * @throws Never - Always succeeds and includes publishedAt timestamp
 *
 * @example
 * ```typescript
 * const wrapper = createPublishedWrapper(tenant.landingPageConfigDraft);
 * await prisma.tenant.update({
 *   where: { id: tenantId },
 *   data: {
 *     landingPageConfig: wrapper,
 *     landingPageConfigDraft: null,
 *   },
 * });
 * ```
 *
 * @see #697 - Dual draft system publish mismatch fix
 * @see docs/architecture/LANDING_PAGE_WRAPPER_FORMAT.md
 *
 * CRITICAL: Do not manually construct wrapper format like `{ published: config }`.
 * The publishedAt timestamp MUST be present - without it, changes won't be visible to visitors.
 */
export function createPublishedWrapper(draftConfig: unknown): ValidatedPublishedWrapper {
  return {
    draft: null,
    draftUpdatedAt: null,
    published: draftConfig,
    publishedAt: new Date().toISOString(),
  };
}
````

### D. Prevention Quick Reference Entry

Add to `docs/solutions/PREVENTION-QUICK-REFERENCE.md`:

````markdown
## Landing Page Wrapper Format Bug (#697)

**Issue:** Publishing without wrapper format loses `publishedAt` timestamp, breaking public API visibility

**Prevention:** Always use `createPublishedWrapper()` helper - never manually construct `landingPageConfig` objects

**Pattern:**

```typescript
// ✅ Correct
import { createPublishedWrapper } from '../lib/landing-page-utils';
await tenantRepo.update(tenantId, {
  landingPageConfig: createPublishedWrapper(draftConfig),
  landingPageConfigDraft: null,
});

// ❌ Wrong
await tenantRepo.update(tenantId, {
  landingPageConfig: { published: draftConfig }, // Missing publishedAt!
  landingPageConfigDraft: null,
});
```
````

**Checklist:**

- [ ] Publishing uses `createPublishedWrapper()`
- [ ] `publishedAt` is ISO string format
- [ ] `draft` and `draftUpdatedAt` are null after publish
- [ ] Both fields update in same atomic operation
- [ ] Tests verify timestamp presence and format

**Related:** WRAPPER_FORMAT_PREVENTION.md

````

### E. API Documentation

Update endpoint documentation in `internal-agent.routes.ts`:

```typescript
/**
 * POST /v1/internal/agent/storefront/publish - Publish draft to live
 *
 * Atomically publishes draft config to live landing page.
 * Uses wrapper format with publishedAt timestamp.
 *
 * Request body:
 * {
 *   "tenantId": "string (required)"
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "action": "published",
 *   "liveUrl": "/t/tenant-slug" or null,
 *   "note": "Draft changes are now live."
 * }
 *
 * CRITICAL: The publishedAt timestamp is required for public API visibility.
 * This endpoint uses createPublishedWrapper() to ensure the timestamp is always set.
 *
 * See: docs/solutions/WRAPPER_FORMAT_PREVENTION.md
 */
router.post('/storefront/publish', async (req: Request, res: Response) => {
  // ... implementation
});
````

---

## 5. Implementation Checklist

When implementing these prevention strategies:

- [ ] Add `ValidatedPublishedWrapper` branded type to `landing-page-utils.ts`
- [ ] Update `TenantRepository` to use branded type on `publishLandingPageDraft()`
- [ ] Create ESLint rule for detecting direct `landingPageConfig` assignments
- [ ] Add ESLint rule to project config with `error` severity
- [ ] Write unit tests for wrapper format validation
- [ ] Write integration tests for publish endpoint with timestamp verification
- [ ] Add schema validation test for wrapper format
- [ ] Update CLAUDE.md with wrapper format rules
- [ ] Create new `docs/architecture/LANDING_PAGE_WRAPPER_FORMAT.md`
- [ ] Update `docs/solutions/PREVENTION-QUICK-REFERENCE.md`
- [ ] Enhance code comments in `landing-page-utils.ts`
- [ ] Run `npm test` to ensure all tests pass
- [ ] Run ESLint to catch any existing violations: `npx eslint --rule 'landing-page-config-wrapper: error'`
- [ ] Audit all callers of `createPublishedWrapper()` - should be exactly 2: service + routes

---

## 6. Related Patterns

Similar multi-field wrapper concerns found in:

1. **Booking Data** - Uses transaction locks + advisory locks to ensure atomic updates
2. **Event Sourcing** - Build Mode uses dual-source (events + JSON field) for discovery facts
3. **Cache Keys** - Must include tenantId to prevent cross-tenant collisions

All require audit logging and atomic transaction patterns.

---

## 7. Quick Diagnosis

If published changes aren't visible to visitors:

1. Check `publishedAt` field exists and is ISO string: `tenant.landingPageConfig.publishedAt`
2. Verify wrapper has all 4 fields: `draft`, `draftUpdatedAt`, `published`, `publishedAt`
3. Confirm `landingPageConfigDraft` is null (draft was cleared)
4. Check public API's `extractPublishedLandingPage()` still works correctly
5. Verify timestamp is recent (within last 5 minutes if just published)
6. Check logs for "Build Mode draft published" message with section count
