---
title: 'refactor: Migrate to Section-by-Section Storefront Storage'
type: refactor
date: 2026-02-02
supersedes: AGENT_FIRST_ARCHITECTURE_SPEC.md (Phase 2 storage consolidation)
status: approved
constraints:
  - NO real users - all demo data, clean cutover
  - NO time pressure - enterprise quality priority
  - DEFER NOTHING that improves codebase
---

# Migrate to Section-by-Section Storefront Storage

## Overview

Migrate from monolithic JSON columns (`landingPageConfig`, `landingPageConfigDraft`) to the normalized `SectionContent` table. This enables:

1. **Section-level publishing** - Publish hero without publishing about
2. **Granular agent operations** - CRUD one row, not read/modify/write entire JSON
3. **Natural opt-out** - Unpublished sections don't render (no explicit "hide" flag)
4. **Future A2A** - Different agents can own different sections
5. **Version history per section** - Already in schema (`versions` JSON field)

## Constraints Applied

| Constraint       | Implication                                                                    |
| ---------------- | ------------------------------------------------------------------------------ |
| NO real users    | Clean cutover, no gradual migration, no backward compatibility complexity      |
| NO time pressure | Enterprise quality: proper abstractions, comprehensive tests, correct patterns |
| DEFER NOTHING    | Complete cleanup of legacy code, no tech debt carried forward                  |

---

## Phase 0: Type System Alignment (Prerequisites)

### 0.1 BlockType Enum Mismatch

**Problem:** Prisma `BlockType` enum doesn't match contracts `SECTION_TYPES`:

| Prisma BlockType | contracts SectionType | Issue            |
| ---------------- | --------------------- | ---------------- |
| `ABOUT`          | `text`                | Different naming |
| `SERVICES`       | (missing)             | Not in contracts |
| `CUSTOM`         | (missing)             | Not in contracts |
| (missing)        | `features`            | Not in Prisma    |

**Solution:** Add `FEATURES` to Prisma enum and create mapping utilities.

### 0.2 Schema Migration

**File:** `server/prisma/migrations/[timestamp]_section_content_enhancements/migration.sql`

```sql
-- Add FEATURES to BlockType enum
ALTER TYPE "BlockType" ADD VALUE 'FEATURES';

-- Add pageName field for multi-page support
ALTER TABLE "SectionContent" ADD COLUMN "pageName" TEXT NOT NULL DEFAULT 'home';

-- Update unique constraint
ALTER TABLE "SectionContent" DROP CONSTRAINT "SectionContent_tenantId_segmentId_blockType_key";
ALTER TABLE "SectionContent" ADD CONSTRAINT "SectionContent_tenantId_segmentId_blockType_pageName_key"
  UNIQUE ("tenantId", "segmentId", "blockType", "pageName");

-- Add index for query patterns
CREATE INDEX "SectionContent_tenantId_pageName_order_idx"
  ON "SectionContent"("tenantId", "pageName", "order");
```

### 0.3 Block Type Mapper

**New file:** `server/src/lib/block-type-mapper.ts`

```typescript
/**
 * Bidirectional mapping between frontend section types and database BlockType enum.
 * Handles legacy 'text' -> 'ABOUT' conversion.
 */
const SECTION_TO_BLOCK_MAP: Record<string, BlockType> = {
  hero: 'HERO',
  text: 'ABOUT', // 'text' sections map to ABOUT block
  about: 'ABOUT',
  gallery: 'GALLERY',
  testimonials: 'TESTIMONIALS',
  faq: 'FAQ',
  contact: 'CONTACT',
  cta: 'CTA',
  pricing: 'PRICING',
  services: 'SERVICES',
  features: 'FEATURES',
  custom: 'CUSTOM',
};

export function sectionTypeToBlockType(sectionType: string): BlockType | null;
export function blockTypeToSectionType(blockType: BlockType): string;
export function isValidBlockType(value: string): value is BlockType;
```

### Files to Create (Phase 0)

- `server/src/lib/block-type-mapper.ts`
- `server/src/lib/block-type-mapper.test.ts`
- `server/prisma/migrations/[timestamp]_section_content_enhancements/migration.sql`

---

## Phase 1: Service Layer

### 1.1 Port Interface

**Location:** `server/src/lib/ports.ts`

```typescript
/**
 * Section Content Repository Port
 *
 * SECURITY: All methods require tenantId for multi-tenant isolation.
 */
export interface ISectionContentRepository {
  // Read Operations
  findByBlockType(
    tenantId: string,
    blockType: BlockType,
    segmentId?: string | null
  ): Promise<SectionContentEntity | null>;
  findAllForTenant(
    tenantId: string,
    options?: { publishedOnly?: boolean; draftsOnly?: boolean; segmentId?: string | null }
  ): Promise<SectionContentEntity[]>;
  hasDrafts(tenantId: string): Promise<boolean>;

  // Write Operations (always create/update draft)
  upsert(tenantId: string, input: UpsertSectionInput): Promise<SectionContentEntity>;
  reorder(
    tenantId: string,
    blockType: BlockType,
    newOrder: number,
    segmentId?: string | null
  ): Promise<SectionContentEntity>;
  delete(tenantId: string, blockType: BlockType, segmentId?: string | null): Promise<void>;

  // Publish Operations (T3 - require confirmation)
  publishSection(
    tenantId: string,
    blockType: BlockType,
    segmentId?: string | null
  ): Promise<SectionContentEntity>;
  publishAll(tenantId: string): Promise<{ count: number }>;

  // Discard Operations (T3 - require confirmation)
  discardSection(tenantId: string, blockType: BlockType, segmentId?: string | null): Promise<void>;
  discardAll(tenantId: string): Promise<{ count: number }>;

  // Version History
  getVersionHistory(
    tenantId: string,
    blockType: BlockType,
    segmentId?: string | null
  ): Promise<VersionEntry[]>;
  restoreVersion(
    tenantId: string,
    blockType: BlockType,
    versionIndex: number,
    segmentId?: string | null
  ): Promise<SectionContentEntity>;
}
```

### 1.2 Service Interface

**Location:** `server/src/services/section-content.service.ts`

```typescript
/**
 * Section Content Service
 *
 * Business logic layer for storefront section management.
 * This is the SINGLE SOURCE OF TRUTH for section operations.
 *
 * Key Responsibilities:
 * - Content validation via Zod schemas
 * - Sanitization (XSS prevention)
 * - Audit logging
 * - Version history management
 * - Block type mapping (text -> ABOUT)
 */
export interface ISectionContentService {
  // Read (T1)
  getPageStructure(
    tenantId: string,
    options?: { pageName?: PageName }
  ): Promise<PageStructureResult>;
  getSectionContent(tenantId: string, sectionId: string): Promise<SectionContentResult>;
  getPublishedSections(tenantId: string): Promise<SectionContentEntity[]>;
  getPreviewSections(tenantId: string): Promise<SectionContentEntity[]>;
  hasDraft(tenantId: string): Promise<boolean>;

  // Write (T2)
  updateSection(
    tenantId: string,
    sectionId: string,
    updates: Partial<SectionContent>
  ): Promise<UpdateSectionResult>;
  addSection(
    tenantId: string,
    pageName: PageName,
    sectionType: string,
    content?: Partial<SectionContent>,
    position?: number
  ): Promise<AddSectionResult>;
  removeSection(tenantId: string, sectionId: string): Promise<RemoveSectionResult>;
  reorderSection(
    tenantId: string,
    sectionId: string,
    newPosition: number
  ): Promise<ReorderSectionResult>;

  // Publish (T3 - require confirmation)
  publishSection(
    tenantId: string,
    sectionId: string,
    confirmationReceived: boolean
  ): Promise<PublishSectionResult>;
  publishAll(tenantId: string, confirmationReceived: boolean): Promise<PublishAllResult>;
  discardAll(tenantId: string, confirmationReceived: boolean): Promise<DiscardAllResult>;
}
```

### 1.3 Result Types

All write operations return consistent results for agent state management:

```typescript
interface StorefrontResult {
  success: boolean;
  hasDraft: boolean; // CRITICAL: Agent needs this (Pitfall #52)
  visibility: 'draft' | 'live';
  message: string;
  dashboardAction?: DashboardAction;
}

interface UpdateSectionResult extends StorefrontResult {
  verified: boolean;
  updatedSection: SectionContentEntity;
  canUndo: boolean;
}

interface PublishSectionResult extends StorefrontResult {
  requiresConfirmation?: boolean; // T3 pattern
  blockType?: BlockType;
  publishedAt?: string;
}
```

### 1.4 Transaction Boundaries

| Operation           | Transaction    | Reason                    |
| ------------------- | -------------- | ------------------------- |
| Single section CRUD | None needed    | Prisma handles atomically |
| `publishAll()`      | `$transaction` | All-or-nothing publishing |
| `discardAll()`      | `$transaction` | All-or-nothing discard    |
| `restoreVersion()`  | `$transaction` | Consistency guarantee     |

### Files to Create (Phase 1)

- `server/src/adapters/prisma/section-content.repository.ts`
- `server/src/adapters/prisma/section-content.repository.test.ts`
- `server/src/services/section-content.service.ts`
- `server/src/services/section-content.service.test.ts`

### Files to Modify (Phase 1)

- `server/src/lib/ports.ts` - Add `ISectionContentRepository`
- `server/src/di.ts` - Wire up new service and repository

---

## Phase 2: Agent Tools Migration

### 2.1 Enhanced Response Formats

All storefront tools return enriched metadata:

```typescript
interface SectionMetadata {
  sectionId: string;
  blockType: BlockType;
  isDraft: boolean;
  isPublished: boolean;
  hasUnpublishedChanges: boolean;
  canUndo: boolean;
  undoSteps: number;
}
```

### 2.2 New Tool: `publish_section` (T3)

```typescript
export const publishSectionTool = new FunctionTool({
  name: 'publish_section',
  description: `Publish a single section to make it live.

**T3 ACTION - REQUIRES EXPLICIT CONFIRMATION**

Only call with confirmationReceived=true if user explicitly said:
- "publish this section", "publish the hero"
- "make it live", "ship it"
- "yes" (in response to section publish confirmation)

This publishes ONLY the specified section - other drafts remain.`,
  parameters: z.object({
    sectionId: z.string().min(1),
    confirmationReceived: z.boolean(),
  }),
});
```

### 2.3 New Tool: `discard_section` (T3)

```typescript
export const discardSectionTool = new FunctionTool({
  name: 'discard_section',
  description: `Discard unpublished changes to a single section.

**T3 ACTION - REQUIRES EXPLICIT CONFIRMATION**

**WARNING:** This loses unpublished changes. Cannot be undone.`,
  parameters: z.object({
    sectionId: z.string().min(1),
    confirmationReceived: z.boolean(),
  }),
});
```

### 2.4 Updated Tool Responses

| Tool                  | New Response Fields                                                                   |
| --------------------- | ------------------------------------------------------------------------------------- |
| `get_page_structure`  | `sectionsWithDrafts[]`, per-section `isDraft`, `isPublished`, `hasUnpublishedChanges` |
| `get_section_content` | `canUndo`, `undoSteps`, `publishedAt`, `lastModified`                                 |
| `update_section`      | `canUndo: true`, `hasUnpublishedChanges: true`                                        |
| `publish_section`     | `remainingDrafts`, `publishedAt`                                                      |
| `discard_section`     | `revertedTo`, `remainingDrafts`                                                       |

### Files to Modify (Phase 2)

- `server/src/agent-v2/deploy/tenant/src/tools/storefront-read.ts`
- `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts`
- `server/src/agent-v2/deploy/tenant/src/tools/index.ts`

### Files to Create (Phase 2)

- `server/src/agent-v2/deploy/tenant/src/tools/storefront-read.test.ts`
- `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.test.ts`
- `server/src/agent-v2/deploy/tenant/src/tools/storefront.integration.test.ts`

---

## Phase 3: Backend Routes

### 3.1 Route Migration

All storefront routes refactored to call `SectionContentService`:

| Endpoint                     | Current            | After                                       |
| ---------------------------- | ------------------ | ------------------------------------------- |
| `/storefront/structure`      | Reads JSON columns | `sectionContentService.getPageStructure()`  |
| `/storefront/section`        | Extracts from JSON | `sectionContentService.getSectionContent()` |
| `/storefront/update-section` | Mutates JSON       | `sectionContentService.updateSection()`     |
| `/storefront/add-section`    | Pushes to JSON     | `sectionContentService.addSection()`        |
| `/storefront/remove-section` | Splices JSON       | `sectionContentService.removeSection()`     |
| `/storefront/publish`        | Wraps JSON         | `sectionContentService.publishAll()`        |

### 3.2 New Endpoints

**`POST /storefront/publish-section`**

```typescript
router.post('/storefront/publish-section', async (req, res) => {
  const { tenantId, sectionId, confirmationReceived } = PublishSectionSchema.parse(req.body);

  if (!confirmationReceived) {
    return res.json({ requiresConfirmation: true, message: 'Publish this section?' });
  }

  const result = await sectionContentService.publishSection(tenantId, sectionId, true);
  return res.json(result);
});
```

**`POST /storefront/discard-section`**

```typescript
router.post('/storefront/discard-section', async (req, res) => {
  const { tenantId, sectionId, confirmationReceived } = DiscardSectionSchema.parse(req.body);

  if (!confirmationReceived) {
    return res.json({ requiresConfirmation: true, message: 'Discard changes to this section?' });
  }

  await sectionContentService.discardSection(tenantId, sectionId);
  return res.json({ success: true });
});
```

### 3.3 New Public API Endpoints

**`GET /v1/public/tenants/:slug/sections`**

- Returns published sections for storefront rendering
- ISR cacheable (60s revalidation)
- Timing attack mitigation (min 100ms response)

**`GET /v1/public/tenants/:slug/sections/preview`**

- Returns draft sections for preview
- Requires valid preview token
- `Cache-Control: no-store`

### Files to Modify (Phase 3)

- `server/src/routes/internal-agent.routes.ts`
- `server/src/routes/public-tenant.routes.ts`
- `packages/contracts/src/api.v1.ts` - Add new contracts
- `packages/contracts/src/schemas/section-content.schema.ts` - Add response schemas

---

## Phase 4: Frontend Migration

### 4.1 Build Mode Protocol Updates

**New message types:**

```typescript
// Parent → Iframe: Single section update (more efficient than full config)
export const BuildModeSectionUpdateSchema = z.object({
  type: z.literal('BUILD_MODE_SECTION_UPDATE'),
  data: z.object({
    sectionId: z.string(),
    blockType: BlockTypeSchema,
    content: z.unknown(),
    action: z.enum(['create', 'update', 'delete']),
  }),
});

// Parent → Iframe: Publish notification
export const BuildModePublishNotificationSchema = z.object({
  type: z.literal('BUILD_MODE_PUBLISH_NOTIFICATION'),
  data: z.object({
    sectionId: z.string().optional(),
    publishedAt: z.string().datetime(),
  }),
});

// Iframe → Parent: Section rendered confirmation
export const BuildModeSectionRenderedSchema = z.object({
  type: z.literal('BUILD_MODE_SECTION_RENDERED'),
  data: z.object({
    sectionId: z.string(),
    blockType: z.string(),
  }),
});
```

### 4.2 React Query Cache Keys

```typescript
export const queryKeys = {
  sections: {
    published: (slug: string) => ['sections', 'published', slug] as const,
    draft: (slug: string) => ['sections', 'draft', slug] as const,
    byId: (tenantId: string, blockType: string) => ['sections', tenantId, blockType] as const,
  },
  buildMode: {
    draft: (tenantId: string) => ['buildMode', 'draft', tenantId] as const,
  },
};
```

### 4.3 Transformation Utilities

**New file:** `server/src/lib/section-transforms.ts`

```typescript
/**
 * Bidirectional conversion between SectionContent[] and PagesConfig.
 * Used for backward compatibility with existing frontend components.
 */
export function sectionsToPages(sections: SectionContent[]): PagesConfig;
export function pagesToSections(tenantId: string, pages: PagesConfig): SectionContentInput[];
```

### Files to Modify (Phase 4)

- `apps/web/src/lib/build-mode/protocol.ts`
- `apps/web/src/hooks/useBuildModeSync.ts`
- `apps/web/src/app/t/[slug]/(site)/page.tsx`
- `apps/web/src/lib/query-client.ts`

### Files to Create (Phase 4)

- `apps/web/src/lib/sections-api.ts`
- `server/src/lib/section-transforms.ts`
- `server/src/lib/section-transforms.test.ts`

---

## Phase 5: Complete Legacy Removal

### 5.1 Files to DELETE Completely

| File                                                 | Reason                      |
| ---------------------------------------------------- | --------------------------- |
| `server/src/lib/landing-page-utils.ts`               | Wrapper format utilities    |
| `server/src/services/landing-page.service.ts`        | Legacy JSON service         |
| `server/eslint-rules/landing-page-config-wrapper.js` | Obsolete ESLint rule        |
| `server/test/services/landing-page.service.test.ts`  | Tests legacy service        |
| All `docs/solutions/*WRAPPER*` files                 | References deleted patterns |

### 5.2 Code to Remove from Files

| File                                              | Code to Remove                                  |
| ------------------------------------------------- | ----------------------------------------------- |
| `server/src/adapters/prisma/tenant.repository.ts` | Lines 713-1086: All `landingPageConfig` methods |
| `apps/web/src/lib/tenant.client.ts`               | `normalizeToPages()` function (lines 75-282)    |
| `packages/contracts/src/landing-page.ts`          | Legacy schemas                                  |

### 5.3 Schema Migration

```sql
-- Drop legacy JSON columns
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "landingPageConfig";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "landingPageConfigDraft";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "landingPageConfigDraftVersion";
```

### 5.4 CLAUDE.md Updates

**Pitfalls to REMOVE:**

- #25 (Multi-path data format mismatch)
- #26 (AI tool responses missing state guidance)
- #56 (Incomplete landingPageConfig wrapper)
- #57 (Wrapper format not extracted on READ)
- #92 (Code path drift)

**New documentation:**

```markdown
### Storefront Storage

| Storage                           | Purpose            | Access            |
| --------------------------------- | ------------------ | ----------------- |
| `SectionContent` (isDraft: true)  | Draft sections     | Agent editing     |
| `SectionContent` (isDraft: false) | Published sections | Public storefront |
```

### 5.5 Verification Script

```bash
#!/bin/bash
# Must return zero matches after cleanup
grep -rn "landingPageConfig\|createPublishedWrapper\|normalizeToPages" \
  server/src/ apps/web/src/ packages/contracts/src/ \
  --include="*.ts" --include="*.tsx"
```

---

## Test Coverage Requirements

### Repository Tests (100% coverage)

- Tenant isolation (CRITICAL)
- CRUD operations
- Draft/publish workflow
- Version history
- Edge cases (empty tenant, not found)

### Service Tests (100% coverage on public methods)

- Input validation with Zod
- Section ID parsing
- T2 operations (update, add, remove, reorder)
- T3 operations with confirmation
- Integration with repository

### Agent Tool Tests

- Parameter validation (Pitfall #62)
- Tool results include metadata
- T3 confirmation flow (Pitfall #49)
- Dashboard actions included

### E2E Tests

- Agent edit updates preview in real-time
- Section-level publish reflects immediately
- Discard reverts to published state
- PostMessage protocol handles new message types

---

## Files Summary

### Create (15 files)

| File                                                            | Purpose                                  |
| --------------------------------------------------------------- | ---------------------------------------- |
| `server/src/lib/block-type-mapper.ts`                           | Type mapping utilities                   |
| `server/src/lib/block-type-mapper.test.ts`                      | Mapping tests                            |
| `server/src/lib/section-transforms.ts`                          | PagesConfig ↔ SectionContent conversion |
| `server/src/lib/section-transforms.test.ts`                     | Transform tests                          |
| `server/src/adapters/prisma/section-content.repository.ts`      | Repository implementation                |
| `server/src/adapters/prisma/section-content.repository.test.ts` | Repository tests                         |
| `server/src/services/section-content.service.ts`                | Service implementation                   |
| `server/src/services/section-content.service.test.ts`           | Service tests                            |
| `apps/web/src/lib/sections-api.ts`                              | Frontend API client                      |
| `server/src/agent-v2/.../storefront-read.test.ts`               | Read tool tests                          |
| `server/src/agent-v2/.../storefront-write.test.ts`              | Write tool tests                         |
| `server/src/agent-v2/.../storefront.integration.test.ts`        | Integration tests                        |
| `e2e/tests/build-mode-sections.spec.ts`                         | E2E tests                                |
| Schema migration (add pageName)                                 | Prisma migration                         |
| Schema migration (drop JSON columns)                            | Prisma migration                         |

### Modify (15 files)

| File                                                 | Changes                                                |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `server/prisma/schema.prisma`                        | Add FEATURES enum, pageName field, remove JSON columns |
| `server/src/lib/ports.ts`                            | Add ISectionContentRepository                          |
| `server/src/di.ts`                                   | Wire up new service                                    |
| `server/src/routes/internal-agent.routes.ts`         | Refactor to use service                                |
| `server/src/routes/public-tenant.routes.ts`          | Add sections endpoints                                 |
| `server/src/agent-v2/.../storefront-read.ts`         | Enhanced responses                                     |
| `server/src/agent-v2/.../storefront-write.ts`        | Add publish_section, discard_section                   |
| `server/src/agent-v2/.../index.ts`                   | Export new tools                                       |
| `apps/web/src/lib/build-mode/protocol.ts`            | New message types                                      |
| `apps/web/src/hooks/useBuildModeSync.ts`             | Handle new messages                                    |
| `apps/web/src/app/t/[slug]/(site)/page.tsx`          | Use sections API                                       |
| `apps/web/src/lib/query-client.ts`                   | Add sections query keys                                |
| `packages/contracts/src/api.v1.ts`                   | Add contracts                                          |
| `CLAUDE.md`                                          | Update pitfalls                                        |
| `docs/architecture/AGENT_FIRST_ARCHITECTURE_SPEC.md` | Revise Phase 2                                         |

### Delete (Phase 5)

| File                                                 | Reason                   |
| ---------------------------------------------------- | ------------------------ |
| `server/src/lib/landing-page-utils.ts`               | Legacy wrapper utilities |
| `server/src/services/landing-page.service.ts`        | Legacy service           |
| `server/eslint-rules/landing-page-config-wrapper.js` | Obsolete rule            |
| Legacy methods in `tenant.repository.ts`             | No longer needed         |
| `normalizeToPages()` in frontend                     | No longer needed         |
| Wrapper format documentation                         | Obsolete                 |

---

## Success Criteria

- [x] All repository tests pass (100% coverage) ✅ 41 tests passing
- [ ] All service tests pass (100% coverage on public methods)
- [ ] Agent tools work with new service layer
- [ ] `publish_section` and `discard_section` tools implemented
- [ ] No direct JSON column access from routes
- [x] Multi-tenant isolation verified in tests ✅ 8 isolation tests passing
- [x] TypeScript strict mode passes ✅
- [ ] No `any` types without justification
- [ ] All legacy code removed (grep verification passes)
- [ ] CLAUDE.md updated with new patterns
- [ ] E2E tests pass

---

## References

- Current schema: `server/prisma/schema.prisma:298-324`
- Provisioning: `server/src/services/tenant-provisioning.service.ts`
- Default content: `server/src/lib/tenant-defaults.ts:119-213`
- Superseded spec: `docs/architecture/AGENT_FIRST_ARCHITECTURE_SPEC.md`
