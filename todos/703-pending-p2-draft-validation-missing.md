---
status: pending
priority: p2
issue_id: '703'
tags: [code-review, validation, data-integrity]
dependencies: []
---

# Missing Schema Validation for Draft Config Reads

## Problem Statement

The `getDraftConfig` and `getDraftConfigWithSlug` functions in AI tools cast draft data directly without validation:

```typescript
const draft = tenant.landingPageConfigDraft as unknown as LandingPageConfig;
```

Malformed draft data could be read without validation, leading to runtime errors in tools/executors.

## Findings

### Validated Read Paths

- `getLandingPageConfig()` - validates on read
- `extractPublishedLandingPage()` - validates on read
- `findBySlugPublic()` - validates full response

### Unvalidated Read Paths

- `getDraftConfig()` in utils.ts - casts directly
- `getDraftConfigWithSlug()` - casts directly

### Risk

If draft JSON is malformed (e.g., from manual DB edit, bug in write path), tools will fail with confusing errors rather than graceful fallback.

## Proposed Solutions

### Option A: Add Validation to Draft Read Functions

**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
export async function getDraftConfig(prisma, tenantId) {
  const tenant = await prisma.tenant.findUnique({...});

  if (tenant.landingPageConfigDraft) {
    const result = LandingPageConfigSchema.safeParse(tenant.landingPageConfigDraft);
    if (!result.success) {
      logger.warn({ tenantId, errors: result.error.issues }, 'Invalid draft config');
      return { pages: DEFAULT_PAGES_CONFIG, hasDraft: false };
    }
    return { pages: result.data.pages || DEFAULT_PAGES_CONFIG, hasDraft: true };
  }
  // ...
}
```

## Recommended Action

Add Zod validation with graceful fallback to defaults.

## Acceptance Criteria

- [ ] Malformed draft data doesn't crash AI tools
- [ ] Validation failures logged as warnings
- [ ] Graceful fallback to defaults on validation failure

## Resources

- Data integrity review: agent a4342eb
- Affected file: server/src/agent/tools/utils.ts
