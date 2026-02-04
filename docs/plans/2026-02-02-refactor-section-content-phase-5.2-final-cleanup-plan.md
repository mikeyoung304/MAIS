---
title: 'refactor: Section Content Migration Phase 5.2 - Final Cleanup'
type: refactor
date: 2026-02-02
parent: 2026-02-02-refactor-section-content-migration-plan.md
status: ready
constraints:
  - NO real users - clean cutover opportunity
  - NO backward compatibility shims - delete legacy code
  - DEFER NOTHING - complete the migration
specflow_reviewed: true
---

# Section Content Migration Phase 5.2 - Final Cleanup

## Overview

Complete the Section Content Migration by making `SectionContent` table the **single source of truth** and dropping legacy `landingPageConfig` JSON columns from the Tenant model.

**Critical Context:** NO real users, NO real data. This is a clean cutover opportunity where we can delete legacy code without migration concerns.

---

## ⚠️ Critical Gaps Identified (SpecFlow Review)

The following issues MUST be addressed during implementation:

### Gap 1: Response Format Mismatch

**Problem:** Service methods return different field names than legacy endpoints. Agent tools expect legacy format.

| Legacy Response | Service Response          | Agent Tool Expects |
| --------------- | ------------------------- | ------------------ |
| `section`       | `content`                 | `section`          |
| `page`          | `pageName`                | `page`             |
| `index`         | (calculated from `order`) | `index`            |
| `type`          | `sectionType`             | `type`             |

**Solution:** Create response adapter functions in routes to transform service results to legacy format.

### Gap 2: Public Routes Need Landing Page Data

**Problem:** `findBySlugPublic()` and `findByDomainPublic()` merge `landingPageConfig` into `branding.landingPage`. After dropping columns, this field disappears.

**Solution:** Update public routes to NOT include `branding.landingPage` (frontend already uses `/sections` API from Phase 4). Verify no consumers depend on this field before dropping.

### Gap 3: togglePage Edge Cases

**Problem:** Proposed implementation doesn't handle:

- Page with NO sections (0 rows updated = no effect)
- Home page constraint enforcement
- Determining page visibility on READ

**Solution:** Enhanced togglePage implementation (see Task 1.7 details below).

### Gap 4: New Tenant Bootstrap

**Problem:** Agent calls `/storefront/structure` on new tenant with no SectionContent rows → returns empty array → agent tools fail.

**Solution:** Service should bootstrap DEFAULT_PAGES_CONFIG sections when tenant has no sections. Add `ensureDefaultSections(tenantId)` helper.

## Already Completed (Phases 0-5.1)

| Phase     | Work                                                                    | Status |
| --------- | ----------------------------------------------------------------------- | ------ |
| Phase 0   | BlockType enum alignment, `pageName` field, block-type-mapper.ts        | ✅     |
| Phase 1   | `SectionContentRepository`, `SectionContentService` (64 tests)          | ✅     |
| Phase 2   | Agent tools: `publish_section`, `discard_section` (T3)                  | ✅     |
| Phase 3   | Backend routes for section-level operations                             | ✅     |
| Phase 4   | Frontend migration, PostMessage protocol                                | ✅     |
| Phase 5.0 | `/storefront/publish` and `/storefront/discard` → SectionContentService | ✅     |
| Phase 5.1 | Deleted: `LandingPageService`, legacy routes, 1929 lines removed        | ✅     |

**Lines deleted:** 1929 across 7 files

---

## Remaining Work (Phase 5.2)

### Task 1: Migrate Legacy Endpoints in `internal-agent.routes.ts`

**Location:** `server/src/routes/internal-agent.routes.ts` lines 1089-1616

These endpoints still read from / write to `landingPageConfigDraft` JSON column. Migrate to `SectionContentService`:

| Endpoint                                   | Current Implementation                   | Replace With                                                                           |
| ------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `/storefront/structure` (line 1089)        | Reads `tenant.landingPageConfigDraft`    | `sectionContentService.getPageStructure(tenantId)`                                     |
| `/storefront/section` (line 1162)          | Extracts section from JSON               | `sectionContentService.getSectionContent(tenantId, sectionId)`                         |
| `/storefront/update-section` (line 1209)   | Mutates draft JSON                       | `sectionContentService.updateSection(tenantId, sectionId, updates)`                    |
| `/storefront/add-section` (line 1284)      | Appends to draft JSON                    | `sectionContentService.addSection(tenantId, pageName, sectionType, content, position)` |
| `/storefront/remove-section` (line 1356)   | Splices from draft JSON                  | `sectionContentService.removeSection(tenantId, sectionId)`                             |
| `/storefront/reorder-sections` (line 1426) | Reorders draft JSON                      | `sectionContentService.reorderSection(tenantId, sectionId, newPosition)`               |
| `/storefront/toggle-page` (line 1495)      | Sets `page.enabled` in JSON              | **NEW:** `sectionContentService.togglePage(tenantId, pageName, enabled)`               |
| `/storefront/preview` (line 1596)          | Checks `!!tenant.landingPageConfigDraft` | `sectionContentService.hasDraft(tenantId)`                                             |

**Note:** `/storefront/update-branding` (line 1553) stays as-is - it uses `tenant.branding`, not `landingPageConfig`.

#### Implementation Details

**Pre-requisite: Response Adapter Functions**

Create adapter functions to transform service responses to legacy format (Gap 1 fix):

```typescript
// server/src/routes/internal-agent.routes.ts - add at top

/**
 * Transform service PageStructureResult to legacy endpoint format.
 * Maintains backward compatibility with agent tools.
 */
function adaptPageStructureResponse(
  result: PageStructureResult,
  slug: string | undefined,
  includeOnlyPlaceholders?: boolean
): LegacyStructureResponse {
  const sections = result.pages.flatMap((p) =>
    p.sections
      .filter((s) => !includeOnlyPlaceholders || s.isPlaceholder)
      .map((s) => ({
        id: s.sectionId,
        page: s.pageName, // Legacy: 'page' not 'pageName'
        type: s.sectionType, // Legacy: 'type' not 'blockType'
        headline: s.headline || '',
        hasPlaceholder: s.isPlaceholder,
      }))
  );

  return {
    sections,
    totalCount: sections.length,
    hasDraft: result.hasDraft,
    previewUrl: slug ? `/t/${slug}?preview=draft` : undefined,
  };
}

/**
 * Transform service SectionContentResult to legacy endpoint format.
 */
function adaptSectionContentResponse(
  result: SectionContentResult,
  hasDraft: boolean
): LegacySectionResponse {
  return {
    section: result.content, // Legacy: 'section' not 'content'
    page: result.pageName, // Legacy: 'page' not 'pageName'
    index: result.order ?? 0, // From SectionContent.order
    hasDraft,
  };
}
```

**1.1 `/storefront/structure`**

Current (reads JSON):

```typescript
const draftConfig = tenant.landingPageConfigDraft as Record<string, unknown> | null;
const liveConfig = tenant.landingPageConfig as Record<string, unknown> | null;
const workingConfig = draftConfig || liveConfig;
```

After (uses service + adapter):

```typescript
// Ensure tenant has default sections if none exist (Gap 4 fix)
await sectionContentService.ensureDefaultSections(tenantId);

const result = await sectionContentService.getPageStructure(tenantId, { pageName });
const tenant = await tenantRepo.findById(tenantId);

res.json(adaptPageStructureResponse(result, tenant?.slug, includeOnlyPlaceholders));
```

**1.2 `/storefront/section`**

Current (extracts from JSON loop):

```typescript
for (const [pageName, pageConfig] of Object.entries(pages)) {
  // Find section by ID in JSON structure
}
```

After (uses service + adapter):

```typescript
const result = await sectionContentService.getSectionContent(tenantId, sectionId);
if (!result) {
  res.status(404).json({ error: `Section '${sectionId}' not found` });
  return;
}
const hasDraft = await sectionContentService.hasDraft(tenantId);
res.json(adaptSectionContentResponse(result, hasDraft));
```

**1.3-1.6 Write Operations**

All write operations follow the same pattern - delegate to service, return enriched result:

```typescript
// Example: update-section
const result = await sectionContentService.updateSection(tenantId, sectionId, updates);
res.json({
  success: result.success,
  sectionId,
  hasDraft: result.hasDraft,
  previewUrl: tenant.slug ? `/t/${tenant.slug}?preview=draft` : undefined,
  note: result.message,
});
```

**1.7 `/storefront/toggle-page` - NEW METHOD NEEDED (Gap 3 Fix)**

The service doesn't have a `togglePage` method. Enhanced implementation to handle edge cases:

```typescript
// server/src/services/section-content.service.ts

export interface TogglePageResult extends StorefrontResult {
  pageName: string;
  enabled: boolean;
  sectionsUpdated: number;
}

/**
 * Enable or disable a page by setting visible flag on all its sections.
 *
 * Edge cases handled:
 * - Home page cannot be disabled (throws ValidationError)
 * - Page with no sections: creates a placeholder section with visible=enabled
 * - Page visibility on READ: determined by first section's visible flag
 */
async togglePage(
  tenantId: string,
  pageName: string,
  enabled: boolean
): Promise<TogglePageResult> {
  // Constraint: Home page cannot be disabled
  if (pageName === 'home' && !enabled) {
    throw new ValidationError('Home page cannot be disabled');
  }

  // Get all draft sections for this page
  const sections = await this.repository.findAllForTenant(tenantId, {
    draftsOnly: true,
  });
  const pageSections = sections.filter(s => s.pageName === pageName);

  // Edge case: Page has no sections - create a placeholder
  if (pageSections.length === 0) {
    // Create a minimal CTA section as page placeholder
    await this.addSection(tenantId, pageName as PageName, 'cta', { visible: enabled });
    return {
      success: true,
      hasDraft: true,
      visibility: 'draft',
      message: enabled
        ? `Page "${pageName}" enabled with placeholder section.`
        : `Page "${pageName}" disabled.`,
      pageName,
      enabled,
      sectionsUpdated: 1,
    };
  }

  // Update all sections' visible flag
  let updatedCount = 0;
  for (const section of pageSections) {
    const content = section.content as Record<string, unknown>;
    if (content.visible !== enabled) {
      await this.updateSection(tenantId, section.id, { visible: enabled });
      updatedCount++;
    }
  }

  return {
    success: true,
    hasDraft: true,
    visibility: 'draft',
    message: enabled
      ? `Page "${pageName}" enabled. ${updatedCount} sections updated.`
      : `Page "${pageName}" disabled. ${updatedCount} sections hidden.`,
    pageName,
    enabled,
    sectionsUpdated: updatedCount,
  };
}

/**
 * Check if a page is enabled (has at least one visible section).
 * Used by getPageStructure to determine page state.
 */
isPageEnabled(sections: SectionContentEntity[], pageName: string): boolean {
  const pageSections = sections.filter(s => s.pageName === pageName);
  if (pageSections.length === 0) return false; // No sections = disabled
  const firstSection = pageSections[0];
  const content = firstSection.content as Record<string, unknown>;
  return content.visible !== false; // Default to visible if not set
}
```

**Route implementation:**

```typescript
router.post('/storefront/toggle-page', async (req: Request, res: Response) => {
  try {
    const { tenantId, pageName, enabled } = TogglePageSchema.parse(req.body);

    const result = await sectionContentService.togglePage(tenantId, pageName, enabled);

    res.json({
      success: result.success,
      pageName: result.pageName,
      enabled: result.enabled,
      hasDraft: result.hasDraft,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    handleError(res, error, '/storefront/toggle-page');
  }
});
```

**1.8 `/storefront/preview`**

Current:

```typescript
const hasDraft = !!tenant.landingPageConfigDraft;
```

After:

```typescript
const hasDraft = await sectionContentService.hasDraft(tenantId);
```

---

### Task 2: Update Repository Methods in `tenant.repository.ts`

**Location:** `server/src/adapters/prisma/tenant.repository.ts`

#### 2.1 Remove `landingPageConfig` from Queries

These methods still SELECT `landingPageConfig` column:

| Method                   | Line | Change                                                                                    |
| ------------------------ | ---- | ----------------------------------------------------------------------------------------- |
| `findBySlugPublic()`     | 619  | Remove `landingPageConfig: true` from select, remove `extractPublishedLandingPage()` call |
| `findBySlugForPreview()` | 496  | Remove both `landingPageConfig` and `landingPageConfigDraft` from select                  |
| `findByDomainPublic()`   | 393  | Remove `landingPageConfig` from select, remove `extractPublishedLandingPage()` call       |

**Important:** These methods merge `landingPageConfig` into `branding.landingPage`. After migration:

- Public routes should fetch sections via `SectionContentService.getPublishedSections()`
- The `branding.landingPage` field will no longer exist
- Frontend already uses `/sections` API (Phase 4 complete)

#### 2.2 Delete Helper Methods (lines 751-846)

| Method                          | Line | Reason                                       |
| ------------------------------- | ---- | -------------------------------------------- |
| `extractPublishedLandingPage()` | 751  | Only used by methods we're updating          |
| `getLandingPageWrapper()`       | 765  | Only used by `extractPublishedLandingPage()` |

#### 2.3 Delete Types

| Interface                 | Line | Reason                       |
| ------------------------- | ---- | ---------------------------- |
| `LandingPageDraftWrapper` | ~846 | Only used by deleted methods |

#### 2.4 Update `UpdateTenantInput` Interface

Remove fields from `UpdateTenantInput` (line 30):

```typescript
// DELETE these lines:
landingPageConfig?: any;
landingPageConfigDraft?: any | null;
```

---

### Task 3: Prisma Schema Migration

**Location:** `server/prisma/schema.prisma` lines 98-101

Create migration to drop columns from `Tenant` model:

```sql
-- Migration: drop_landing_page_config_columns
-- Date: 2026-02-02
-- Description: Complete Section Content Migration Phase 5.2
-- CRITICAL: No data migration needed - no real users

ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "landingPageConfig";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "landingPageConfigDraft";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "landingPageConfigDraftVersion";
```

**Schema changes:**

```prisma
model Tenant {
  // DELETE these lines (98-101):
  // landingPageConfig             Json?
  // landingPageConfigDraft        Json?
  // landingPageConfigDraftVersion Int   @default(0)
}
```

---

### Task 4: Update Imports and Contracts

#### 4.1 Check for Orphan Imports

Run after route/repository changes:

```bash
# Find any remaining references to deleted code
grep -rn "landingPageConfig\|landingPageConfigDraft\|extractPublishedLandingPage\|getLandingPageWrapper" \
  server/src/ apps/web/src/ packages/contracts/src/ \
  --include="*.ts" --include="*.tsx"
```

#### 4.2 Update Contracts (if needed)

Check `packages/contracts/src/` for any schemas that reference:

- `landingPageConfig`
- `LandingPageConfig` type (may still be used for branding - verify)

---

### Task 5: Verification

#### 5.1 Type Checking

```bash
rm -rf server/dist packages/*/dist && npm run typecheck
```

**Why clean build?** Pitfall #87 - Orphan imports after large deletions can pass incremental builds but fail clean builds.

#### 5.2 Test Suite

```bash
npm test
```

Expected passing:

- 41 repository tests (section-content.repository.test.ts)
- 64 service tests (section-content.service.test.ts)
- 7 route tests (internal-agent-storefront.test.ts)
- 8 tenant isolation tests

#### 5.3 Agent Tool Verification

Agent tools call the endpoints we're updating. Verify they still work:

| Tool                  | Endpoint                       | Expected Behavior                          |
| --------------------- | ------------------------------ | ------------------------------------------ |
| `get_page_structure`  | `/storefront/structure`        | Returns sections from SectionContent table |
| `get_section_content` | `/storefront/section`          | Returns section content from service       |
| `update_section`      | `/storefront/update-section`   | Updates SectionContent row                 |
| `add_section`         | `/storefront/add-section`      | Creates new SectionContent row             |
| `remove_section`      | `/storefront/remove-section`   | Deletes SectionContent row                 |
| `reorder_sections`    | `/storefront/reorder-sections` | Updates order field                        |
| `preview_draft`       | `/storefront/preview`          | Returns hasDraft from service              |

---

## Implementation Order

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Add new service methods (Gap fixes)                 │
│ - togglePage() with edge case handling (Gap 3)              │
│ - ensureDefaultSections() for new tenants (Gap 4)           │
│ - isPageEnabled() helper                                    │
│ - Add comprehensive tests                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Add response adapter functions                      │
│ - adaptPageStructureResponse() (Gap 1)                      │
│ - adaptSectionContentResponse() (Gap 1)                     │
│ - Type definitions for legacy response formats              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Migrate internal-agent.routes.ts endpoints          │
│ - Replace JSON reads/writes with service calls              │
│ - Use adapter functions to maintain response format         │
│ - Call ensureDefaultSections() in /structure endpoint       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Verify agent tools work                             │
│ - npm test                                                  │
│ - Manual verification with agent chat                       │
│ - Test new tenant bootstrap scenario                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Update tenant.repository.ts (Gap 2)                 │
│ - Remove landingPageConfig from SELECT queries              │
│ - Stop merging into branding.landingPage                    │
│ - Delete helper methods                                     │
│ - Update UpdateTenantInput interface                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 6: Clean build verification                            │
│ - rm -rf server/dist && npm run typecheck                   │
│ - Fix any orphan imports                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 7: Create Prisma migration                             │
│ - npx prisma migrate dev --name drop_landing_page_columns   │
│ - Verify migration runs cleanly                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 8: Final verification                                  │
│ - npm run typecheck                                         │
│ - npm test                                                  │
│ - grep verification script                                  │
│ - E2E test with agent chat                                  │
└─────────────────────────────────────────────────────────────┘
```

### New Service Methods Required (Gap 4 Fix)

Add to `SectionContentService`:

```typescript
/**
 * Ensure tenant has default sections if none exist.
 * Called by /storefront/structure to bootstrap new tenants.
 *
 * Uses DEFAULT_PAGES_CONFIG from tenant-defaults.ts
 */
async ensureDefaultSections(tenantId: string): Promise<void> {
  const existingSections = await this.repository.findAllForTenant(tenantId);

  if (existingSections.length > 0) {
    return; // Already has sections, nothing to do
  }

  // Import DEFAULT_PAGES_CONFIG
  const { DEFAULT_PAGES_CONFIG } = await import('../lib/tenant-defaults');

  // Create sections from default config
  for (const [pageName, pageConfig] of Object.entries(DEFAULT_PAGES_CONFIG)) {
    const sections = (pageConfig as { sections?: unknown[] }).sections || [];
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i] as Record<string, unknown>;
      await this.addSection(
        tenantId,
        pageName as PageName,
        section.type as string,
        section,
        i
      );
    }
  }

  logger.info({ tenantId }, '[SectionContentService] Bootstrapped default sections');
}
```

---

## Files to Modify

| File                                                  | Changes                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `server/src/services/section-content.service.ts`      | Add `togglePage()` method                                      |
| `server/src/services/section-content.service.test.ts` | Add tests for `togglePage()`                                   |
| `server/src/routes/internal-agent.routes.ts`          | Replace 8 endpoints with service calls                         |
| `server/src/adapters/prisma/tenant.repository.ts`     | Remove landingPageConfig from queries, delete helpers          |
| `server/prisma/schema.prisma`                         | Remove 3 columns from Tenant model                             |
| `CLAUDE.md`                                           | Update "Storefront Storage" section to mark Phase 5.2 complete |

## Files to Delete

None - all legacy files were deleted in Phase 5.1.

---

## Success Criteria

### Service Layer

- [ ] `togglePage()` method added with edge case handling (home page constraint, empty page)
- [ ] `ensureDefaultSections()` method added for new tenant bootstrap
- [ ] `isPageEnabled()` helper added
- [ ] Tests added for all new methods (target: 10+ new tests)

### Response Format Compatibility

- [ ] `adaptPageStructureResponse()` adapter function created
- [ ] `adaptSectionContentResponse()` adapter function created
- [ ] Legacy response format types defined
- [ ] Agent tools receive same response schema as before

### Route Migration

- [ ] All 8 legacy endpoints migrated to SectionContentService
- [ ] `/storefront/structure` calls `ensureDefaultSections()` first
- [ ] Response formats verified with adapter functions

### Repository Cleanup

- [ ] Repository no longer references landingPageConfig columns
- [ ] `branding.landingPage` no longer populated (Gap 2)
- [ ] Helper methods deleted: `extractPublishedLandingPage()`, `getLandingPageWrapper()`
- [ ] `UpdateTenantInput` interface updated

### Schema Migration

- [ ] Prisma migration drops 3 columns from Tenant
- [ ] Migration runs cleanly on fresh database

### Verification

- [ ] Clean build passes: `rm -rf server/dist && npm run typecheck`
- [ ] All tests pass: `npm test`
- [ ] Grep verification returns zero matches:
  ```bash
  grep -rn "landingPageConfigDraft\|extractPublishedLandingPage\|getLandingPageWrapper" \
    server/src/ --include="*.ts" | grep -v "test\|\.d\.ts"
  ```
- [ ] E2E test: Agent can edit sections on new tenant

---

## Risk Assessment

| Risk                                              | Likelihood | Impact | Mitigation                                                                         |
| ------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------- |
| Agent tools break due to response format mismatch | **High**   | High   | Adapter functions transform service responses to legacy format (Gap 1)             |
| New tenant bootstrap fails                        | Medium     | High   | `ensureDefaultSections()` creates defaults before structure query (Gap 4)          |
| togglePage doesn't handle edge cases              | Medium     | Medium | Enhanced implementation with home constraint, empty page handling (Gap 3)          |
| Public routes break without branding.landingPage  | Medium     | Medium | Frontend already uses `/sections` API; verify no consumers depend on field (Gap 2) |
| Orphan imports cause CI failure                   | Medium     | Low    | Run clean build locally before commit (Pitfall #87)                                |

**Overall Risk:** Medium → Low (with gap fixes)

Without the gap fixes, risk would be HIGH due to response format mismatches. With adapter functions and bootstrap logic, risk drops to LOW.

---

## Test Plan

### New Tests Required

```typescript
// section-content.service.test.ts

describe('togglePage', () => {
  it('should disable page by setting all sections visible: false', async () => {});
  it('should enable page by setting all sections visible: true', async () => {});
  it('should throw ValidationError when disabling home page', async () => {});
  it('should create placeholder section when toggling empty page', async () => {});
  it('should not update sections already at target visibility', async () => {});
});

describe('ensureDefaultSections', () => {
  it('should create default sections for new tenant', async () => {});
  it('should not modify tenant with existing sections', async () => {});
  it('should create sections from DEFAULT_PAGES_CONFIG', async () => {});
});

describe('isPageEnabled', () => {
  it('should return true if first section is visible', async () => {});
  it('should return false if first section has visible: false', async () => {});
  it('should return false if page has no sections', async () => {});
});
```

### Integration Tests

```typescript
// internal-agent-storefront.integration.test.ts

describe('/storefront/structure', () => {
  it('should return legacy response format with adapter', async () => {
    // Verify: sections[].page, sections[].type, sections[].id
  });
  it('should bootstrap default sections for new tenant', async () => {});
});

describe('/storefront/section', () => {
  it('should return legacy response format with adapter', async () => {
    // Verify: section (not content), page (not pageName), index
  });
});
```

---

## References

- Parent plan: `docs/plans/2026-02-02-refactor-section-content-migration-plan.md`
- Brainstorm: `docs/brainstorms/2026-01-30-semantic-storefront-architecture-brainstorm.md`
- CLAUDE.md "Storefront Storage (Phase 5)" section
- Agent tool implementations: `server/src/agent-v2/deploy/tenant/src/tools/`
