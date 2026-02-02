---
title: 'feat: Real-Time Storefront Preview'
type: feat
date: 2026-02-01
status: ready
priority: P1
---

# Real-Time Storefront Preview

## Overview

Enable instant preview updates when the AI agent modifies storefront content. Currently, Zod validation failures on incomplete sections cause silent fallback to live content, breaking the real-time editing experience. This plan introduces lenient draft schemas, unified storage columns, and proper preview refresh infrastructure.

**Problem:** User says "add a pricing section" → Agent confirms "Added!" → Preview shows... nothing new (silently fell back to live content because empty pricing section failed validation).

**Solution:** Drafts allow incomplete sections. Strict validation only at publish time. Preview always shows the draft, with placeholder UI for incomplete sections.

## Problem Statement

### Current Behavior (Bug)

```
1. User: "Add a pricing section to my homepage"
2. Agent: Writes section with tiers: [] to landingPageConfigDraft
3. Agent: Returns success with dashboardAction
4. Frontend: Invalidates draft query, fetches preview data
5. Backend: LandingPageConfigSchema.safeParse(draft) → FAILS (tiers.min(1))
6. Backend: Returns { hasDraft: false } (graceful degradation)
7. Preview: Shows live/default content instead of draft
8. User: "Why didn't anything change?"
```

**Server log evidence:**

```
WARN: Invalid draft config in findBySlugForPreview
  errors: [{ path: ["pages", "home", "sections", 6, "tiers"],
             message: "Array must contain at least 1 element(s)" }]
INFO: Preview data served
  hasDraft: false  ← THE BUG
```

### Root Cause

Four section schemas require non-empty arrays:

| Schema                      | Field      | Constraint        | Location                                     |
| --------------------------- | ---------- | ----------------- | -------------------------------------------- |
| `PricingSectionSchema`      | `tiers`    | `.min(1).max(5)`  | `packages/contracts/src/landing-page.ts:517` |
| `FeaturesSectionSchema`     | `features` | `.min(1).max(12)` | `packages/contracts/src/landing-page.ts:541` |
| `TestimonialsSectionSchema` | `items`    | `.min(1).max(12)` | `packages/contracts/src/landing-page.ts:427` |
| `FAQSectionSchema`          | `items`    | `.min(1).max(20)` | `packages/contracts/src/landing-page.ts:447` |

When **any** section is invalid, the **entire** config fails validation, triggering fallback.

## Proposed Solution

### Design Decisions (from brainstorm)

| Decision            | Choice                | Rationale                                                             |
| ------------------- | --------------------- | --------------------------------------------------------------------- |
| Draft validation    | **Lenient**           | Drafts are work-in-progress. Empty arrays = valid draft.              |
| Strict validation   | **Publish-time only** | Block publishing incomplete content, not editing.                     |
| Schema approach     | **Dual schemas**      | `LenientSectionSchema` for drafts, `StrictSectionSchema` for publish. |
| Storage             | **Unified columns**   | `storefrontDraft` + `storefrontPublished` replace legacy fields.      |
| Preview refresh     | **dashboardAction**   | Tool returns `{ type: 'REFRESH_PREVIEW', sectionId }`.                |
| Auto-scroll         | **Yes**               | Scroll preview to updated section after refresh.                      |
| Incomplete sections | **Placeholder UI**    | "Add pricing tiers to complete this section" message.                 |
| Undo                | **Agent handles**     | No infrastructure needed. Conversational undo.                        |

### Scope

- **In scope:** AI agent editing path, preview system, unified storage, placeholder UI
- **Out of scope:** Visual Editor updates (deprecated, can be done later)
- **No data migration:** No real user data exists yet

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DRAFT VALIDATION FLOW                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Agent Tool                 Backend                   Frontend      │
│  ──────────                 ───────                   ────────      │
│                                                                     │
│  storefront-write.ts        landing-page.service.ts  PreviewPanel   │
│       │                           │                       │         │
│       │ write section             │                       │         │
│       ├──────────────────────────►│                       │         │
│       │                           │                       │         │
│       │                     ┌─────┴─────┐                 │         │
│       │                     │ LENIENT   │                 │         │
│       │                     │ VALIDATION│                 │         │
│       │                     │ (allows   │                 │         │
│       │                     │  empty)   │                 │         │
│       │                     └─────┬─────┘                 │         │
│       │                           │                       │         │
│       │                     Save to                       │         │
│       │                     storefrontDraft               │         │
│       │                           │                       │         │
│       │◄──────────────────────────┤                       │         │
│       │ { success, dashboardAction }                      │         │
│       │                           │                       │         │
│       │ return dashboardAction    │                       │         │
│       ├───────────────────────────┼──────────────────────►│         │
│       │                           │                       │         │
│       │                           │          REFRESH_PREVIEW        │
│       │                           │          + sectionId  │         │
│       │                           │                       ▼         │
│       │                           │              ┌────────────────┐ │
│       │                           │              │ Refetch draft  │ │
│       │                           │              │ Render section │ │
│       │                           │              │ Scroll to view │ │
│       │                           │              └────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        PUBLISH VALIDATION FLOW                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Agent Tool                 Backend                   Frontend      │
│  ──────────                 ───────                   ────────      │
│                                                                     │
│  storefront-publish.ts      landing-page.service.ts                 │
│       │                           │                                 │
│       │ publish                   │                                 │
│       ├──────────────────────────►│                                 │
│       │                           │                                 │
│       │                     ┌─────┴─────┐                           │
│       │                     │ STRICT    │                           │
│       │                     │ VALIDATION│                           │
│       │                     │ (requires │                           │
│       │                     │  content) │                           │
│       │                     └─────┬─────┘                           │
│       │                           │                                 │
│       │                     ┌─────┴─────┐                           │
│       │                     │  VALID?   │                           │
│       │                     └─────┬─────┘                           │
│       │                       YES │ NO                              │
│       │                     ┌─────┴─────┐                           │
│       │                     │           │                           │
│       │◄────────────────────┤   ┌───────┴───────┐                   │
│       │ { success }         │   │ { error,      │                   │
│       │                     │   │   incomplete: │                   │
│       │                     │   │   ['pricing'] │                   │
│       │                     │   │ }             │                   │
│       │                     │   └───────────────┘                   │
│       │                     │                                       │
│       │ Agent explains:     │                                       │
│       │ "Pricing needs at   │                                       │
│       │  least one tier"    │                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: Dual Schema Infrastructure (Backend)

Create lenient schemas that allow empty arrays for draft validation.

**Files to modify:**

- `packages/contracts/src/landing-page.ts` - Add lenient section schemas
- `server/src/lib/landing-page-validation.ts` - NEW: Validation utilities

**Tasks:**

- [ ] Create `LenientPricingSectionSchema` with `tiers: z.array(...).max(5).default([])`
- [ ] Create `LenientFeaturesSectionSchema` with `features: z.array(...).max(12).default([])`
- [ ] Create `LenientTestimonialsSectionSchema` with `items: z.array(...).max(12).default([])`
- [ ] Create `LenientFAQSectionSchema` with `items: z.array(...).max(20).default([])`
- [ ] Create `LenientSectionSchema` discriminated union of all lenient sections
- [ ] Create `LenientLandingPageConfigSchema` using lenient sections
- [ ] Export validation helpers: `validateDraft()`, `validateForPublish()`
- [ ] Add `getIncompleteSections()` helper for publish-time error messages

**Example schema structure:**

```typescript
// packages/contracts/src/landing-page.ts

// ─────────────────────────────────────────────────────────────────
// LENIENT SCHEMAS (for drafts - allow empty arrays)
// ─────────────────────────────────────────────────────────────────

export const LenientPricingSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('pricing'),
  headline: z.string().max(60).default(''),
  subheadline: z.string().max(150).optional(),
  tiers: z.array(PricingTierSchema).max(5).default([]), // No .min(1)
  backgroundColor: z.enum(['white', 'neutral']).optional(),
});

export const LenientFeaturesSectionSchema = z.object({
  id: SectionIdSchema.optional(),
  type: z.literal('features'),
  headline: z.string().max(60).default(''),
  subheadline: z.string().max(150).optional(),
  features: z.array(FeatureItemSchema).max(12).default([]), // No .min(1)
  layout: z.enum(['grid', 'list']).optional(),
  backgroundColor: z.enum(['white', 'neutral']).optional(),
});

// ... similar for Testimonials, FAQ

export const LenientSectionSchema = z.discriminatedUnion('type', [
  HeroSectionSchema, // No changes needed (no .min() constraint)
  TextSectionSchema, // No changes needed
  GallerySectionSchema, // No changes needed
  LenientTestimonialsSectionSchema,
  LenientFAQSectionSchema,
  ContactSectionSchema, // No changes needed
  CTASectionSchema, // No changes needed
  LenientPricingSectionSchema,
  LenientFeaturesSectionSchema,
]);

export const LenientPageConfigSchema = z.object({
  sections: z.array(LenientSectionSchema).default([]),
});

export const LenientLandingPageConfigSchema = z.object({
  pages: z
    .object({
      home: LenientPageConfigSchema.optional(),
    })
    .default({ home: { sections: [] } }),
});

// ─────────────────────────────────────────────────────────────────
// STRICT SCHEMAS (for publish - existing schemas, renamed for clarity)
// ─────────────────────────────────────────────────────────────────

// Keep existing schemas as "strict" versions
export const StrictPricingSectionSchema = PricingSectionSchema;
export const StrictSectionSchema = SectionSchema;
export const StrictLandingPageConfigSchema = LandingPageConfigSchema;
```

**Validation utilities:**

```typescript
// server/src/lib/landing-page-validation.ts

import {
  LenientLandingPageConfigSchema,
  StrictLandingPageConfigSchema,
  LandingPageConfig,
} from '@macon/contracts';

// Generic to preserve schema-specific types
export interface ValidationResult<T = LandingPageConfig> {
  valid: boolean;
  data?: T;
  errors?: z.ZodError;
}

// Type-safe overloads
export function validateDraft(config: unknown): ValidationResult<LenientLandingPageConfig>;
export function validateForPublish(config: unknown): ValidationResult<StrictLandingPageConfig>;

export interface IncompleteSection {
  pageKey: string;
  sectionIndex: number;
  sectionType: string;
  reason: string;
}

/**
 * Validate draft config with lenient rules (allows empty arrays)
 */
export function validateDraft(config: unknown): ValidationResult {
  const result = LenientLandingPageConfigSchema.safeParse(config);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error };
}

/**
 * Validate config for publishing with strict rules
 */
export function validateForPublish(config: unknown): ValidationResult {
  const result = StrictLandingPageConfigSchema.safeParse(config);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error };
}

/**
 * Get list of incomplete sections that block publishing
 */
export function getIncompleteSections(config: LandingPageConfig): IncompleteSection[] {
  const incomplete: IncompleteSection[] = [];

  // Guard against undefined pages (defensive)
  if (!config.pages) return incomplete;

  for (const [pageKey, page] of Object.entries(config.pages)) {
    if (!page?.sections) continue;

    page.sections.forEach((section, index) => {
      switch (section.type) {
        case 'pricing':
          if (!section.tiers || section.tiers.length === 0) {
            incomplete.push({
              pageKey,
              sectionIndex: index,
              sectionType: 'pricing',
              reason: 'Pricing section needs at least one tier',
            });
          }
          break;
        case 'features':
          if (!section.features || section.features.length === 0) {
            incomplete.push({
              pageKey,
              sectionIndex: index,
              sectionType: 'features',
              reason: 'Features section needs at least one feature',
            });
          }
          break;
        case 'testimonials':
          if (!section.items || section.items.length === 0) {
            incomplete.push({
              pageKey,
              sectionIndex: index,
              sectionType: 'testimonials',
              reason: 'Testimonials section needs at least one testimonial',
            });
          }
          break;
        case 'faq':
          if (!section.items || section.items.length === 0) {
            incomplete.push({
              pageKey,
              sectionIndex: index,
              sectionType: 'faq',
              reason: 'FAQ section needs at least one question',
            });
          }
          break;
      }
    });
  }

  return incomplete;
}
```

**Success criteria:**

- [ ] `validateDraft({ pages: { home: { sections: [{ type: 'pricing', tiers: [] }] } } })` returns `{ valid: true }`
- [ ] `validateForPublish({ pages: { home: { sections: [{ type: 'pricing', tiers: [] }] } } })` returns `{ valid: false }`
- [ ] `getIncompleteSections()` returns human-readable list

---

#### Phase 2: Unified Storage Migration (Database)

Replace dual-column storage with clean `storefrontDraft` + `storefrontPublished` columns.

**Files to modify:**

- `server/prisma/schema.prisma` - Add new columns
- `server/prisma/migrations/YYYYMMDDHHMMSS_storefront_columns/migration.sql` - Migration
- `server/src/adapters/prisma/tenant.repository.ts` - Update queries

**Tasks:**

- [ ] Add `storefrontDraft Json?` column to Tenant model
- [ ] Add `storefrontPublished Json?` column to Tenant model
- [ ] Add `storefrontDraftVersion Int @default(0)` for optimistic locking
- [ ] Create migration that copies existing data:
  - `landingPageConfigDraft` → `storefrontDraft`
  - `landingPageConfig.published` → `storefrontPublished`
- [ ] Update `TenantRepository.saveDraft()` to use new columns
- [ ] Update `TenantRepository.publish()` to use new columns
- [ ] Update preview endpoint to read from `storefrontDraft`

**Migration SQL:**

```sql
-- server/prisma/migrations/YYYYMMDDHHMMSS_storefront_unified_columns/migration.sql

-- Add new unified columns
ALTER TABLE "Tenant" ADD COLUMN "storefrontDraft" JSONB;
ALTER TABLE "Tenant" ADD COLUMN "storefrontPublished" JSONB;
ALTER TABLE "Tenant" ADD COLUMN "storefrontDraftVersion" INTEGER NOT NULL DEFAULT 0;

-- Copy existing data (handle wrapper format)
UPDATE "Tenant"
SET "storefrontDraft" = "landingPageConfigDraft"
WHERE "landingPageConfigDraft" IS NOT NULL;

UPDATE "Tenant"
SET "storefrontPublished" = "landingPageConfig"->'published'
WHERE "landingPageConfig"->'published' IS NOT NULL;

-- If no published wrapper, use raw config as published
UPDATE "Tenant"
SET "storefrontPublished" = "landingPageConfig"
WHERE "storefrontPublished" IS NULL
  AND "landingPageConfig" IS NOT NULL
  AND "landingPageConfig"->'published' IS NULL;

-- Add index for preview queries
CREATE INDEX "Tenant_storefrontDraft_idx" ON "Tenant" USING GIN ("storefrontDraft");
```

**Repository updates:**

```typescript
// server/src/adapters/prisma/tenant.repository.ts

async saveStorefrontDraft(
  tenantId: string,
  config: LandingPageConfig,
  expectedVersion?: number
): Promise<{ version: number }> {
  const tenant = await this.prisma.tenant.update({
    where: {
      id: tenantId,
      ...(expectedVersion !== undefined && { storefrontDraftVersion: expectedVersion }),
    },
    data: {
      storefrontDraft: config as Prisma.JsonValue,
      storefrontDraftVersion: { increment: 1 },
    },
    select: { storefrontDraftVersion: true },
  });

  return { version: tenant.storefrontDraftVersion };
}

async publishStorefront(tenantId: string): Promise<void> {
  // NOTE: Prisma doesn't support field references like SQL's "column = other_column"
  // Must fetch-then-update pattern
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { storefrontDraft: true },
  });

  if (!tenant?.storefrontDraft) {
    throw new Error('No draft to publish');
  }

  await this.prisma.tenant.update({
    where: { id: tenantId },
    data: {
      storefrontPublished: tenant.storefrontDraft,
      storefrontDraft: Prisma.JsonNull,  // Clear the draft
      storefrontDraftVersion: { increment: 1 },
    },
  });
}

async getStorefrontDraft(tenantId: string): Promise<LandingPageConfig | null> {
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { storefrontDraft: true },
  });

  if (!tenant?.storefrontDraft) return null;

  // IMPORTANT: Validate at boundary - don't trust `as` casts from Prisma JSON
  // Use lenient validation since this is a draft
  const result = LenientLandingPageConfigSchema.safeParse(tenant.storefrontDraft);
  if (!result.success) {
    logger.error({ tenantId, errors: result.error }, 'Corrupt draft in database');
    return null;
  }
  return result.data;
}

async getStorefrontPublished(tenantId: string): Promise<LandingPageConfig | null> {
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { storefrontPublished: true },
  });

  if (!tenant?.storefrontPublished) return null;

  // IMPORTANT: Validate at boundary - use strict schema for published content
  const result = StrictLandingPageConfigSchema.safeParse(tenant.storefrontPublished);
  if (!result.success) {
    logger.error({ tenantId, errors: result.error }, 'Corrupt published config in database');
    return null;
  }
  return result.data;
}
```

**Success criteria:**

- [ ] Migration runs without error
- [ ] Existing draft data preserved in new column
- [ ] Existing published data preserved in new column
- [ ] Preview endpoint returns draft from `storefrontDraft`

---

#### Phase 3: Preview Service Updates (Backend)

Update preview data fetching to use lenient validation and new columns.

**Files to modify:**

- `server/src/services/landing-page.service.ts` - Use lenient validation for drafts
- `server/src/routes/public-tenant.routes.ts` - Preview endpoint
- `server/src/routes/internal-agent.routes.ts` - Agent preview endpoint

**Tasks:**

- [ ] Update `findBySlugForPreview()` to use `validateDraft()` instead of strict validation
- [ ] Update preview endpoint to read from `storefrontDraft` column
- [ ] Return `{ hasDraft: true, draft: config }` even when sections are incomplete
- [ ] Add `incompleteSections` array to preview response for UI placeholders
- [ ] Remove silent fallback - if draft exists, always return it

**Service updates:**

```typescript
// server/src/services/landing-page.service.ts

async getPreviewData(tenantId: string): Promise<PreviewData> {
  const tenant = await this.tenantRepo.findById(tenantId);
  if (!tenant) throw new NotFoundError('Tenant not found');

  // Read from new unified column
  const draft = tenant.storefrontDraft as LandingPageConfig | null;
  const published = tenant.storefrontPublished as LandingPageConfig | null;

  if (draft) {
    // Use LENIENT validation for drafts
    const validation = validateDraft(draft);

    if (validation.valid) {
      // Get incomplete sections for UI placeholders
      const incompleteSections = getIncompleteSections(draft);

      return {
        hasDraft: true,
        config: draft,
        incompleteSections,  // NEW: Tell frontend which sections need placeholders
        source: 'draft',
      };
    } else {
      // Even lenient validation failed - log error but still return draft
      logger.error({ tenantId, errors: validation.errors },
        'Draft failed even lenient validation - returning anyway for debugging');
      return {
        hasDraft: true,
        config: draft,
        incompleteSections: [],
        source: 'draft',
        validationErrors: validation.errors,  // Include for debugging
      };
    }
  }

  // No draft - return published
  return {
    hasDraft: false,
    config: published,
    incompleteSections: [],
    source: 'published',
  };
}
```

**Success criteria:**

- [ ] Preview returns draft with empty pricing section (not fallback)
- [ ] `incompleteSections` array populated correctly
- [ ] No more "Invalid draft config" warnings for empty arrays

---

#### Phase 4: Agent Tool Updates (Backend)

Update storefront tools to use new storage and return proper dashboardActions.

**Files to modify:**

- `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts` - Write tool
- `server/src/agent-v2/deploy/tenant/src/tools/storefront-publish.ts` - Publish tool
- `server/src/agent-v2/deploy/tenant/src/tools/navigate.ts` - Add REFRESH_PREVIEW type

**Tasks:**

- [ ] Add `REFRESH_PREVIEW` to `DashboardAction` type union
- [ ] Update `storefront-write.ts` to:
  - Write to `storefrontDraft` column via new repository method
  - Return `dashboardAction: { type: 'REFRESH_PREVIEW', sectionId }`
  - Include `sectionId` for auto-scroll targeting
- [ ] Update `storefront-publish.ts` to:
  - Use strict validation before publish
  - Return detailed error with `incompleteSections` on failure
  - Agent can then explain what's missing conversationally
- [ ] Generate stable section IDs (UUID) when creating new sections

**DashboardAction type update:**

```typescript
// server/src/agent-v2/deploy/tenant/src/tools/navigate.ts

export type DashboardAction =
  | { type: 'NAVIGATE'; section: DashboardSection }
  | { type: 'SCROLL_TO_SECTION'; sectionId: string; highlight?: boolean }
  | { type: 'SHOW_PREVIEW'; fullScreen?: boolean }
  | { type: 'SHOW_CONFIRMATION'; message: string; confirmAction: string }
  | { type: 'REFRESH' }
  | { type: 'REFRESH_PREVIEW'; sectionId?: string }; // NEW
```

**Storefront write tool update:**

```typescript
// server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts

// In execute function, after successful write:
return {
  success: true,
  verified: true,
  visibility: 'draft',
  hasDraft: true,
  updatedSection: {
    id: section.id, // Stable UUID
    type: section.type,
    // ... section data
  },
  message: 'Section updated in draft.',
  dashboardAction: {
    type: 'REFRESH_PREVIEW',
    sectionId: section.id, // For auto-scroll
  },
};
```

**Storefront publish tool update:**

```typescript
// server/src/agent-v2/deploy/tenant/src/tools/storefront-publish.ts

// In execute function:
const draft = await landingPageService.getStorefrontDraft(tenantId);
if (!draft) {
  return { success: false, error: 'No draft to publish' };
}

// Use STRICT validation for publish
const validation = validateForPublish(draft);
if (!validation.valid) {
  const incomplete = getIncompleteSections(draft);
  return {
    success: false,
    cannotPublish: true,
    incompleteSections: incomplete,
    // Agent-friendly message
    message: `Cannot publish yet. ${incomplete.map((s) => s.reason).join('. ')}.`,
    suggestion: 'Would you like me to help complete these sections?',
  };
}

// Validation passed - publish
await landingPageService.publishStorefront(tenantId);
return {
  success: true,
  message: 'Your storefront is now live!',
  dashboardAction: { type: 'REFRESH_PREVIEW' },
};
```

**Success criteria:**

- [ ] Writing empty pricing section succeeds and returns `REFRESH_PREVIEW`
- [ ] Publishing with empty pricing section returns friendly error
- [ ] Section IDs are stable UUIDs

---

#### Phase 5: Frontend Preview Refresh (Frontend)

Wire up `REFRESH_PREVIEW` action and implement auto-scroll.

**Files to modify:**

- `apps/web/src/hooks/useConciergeChat.ts` - Add REFRESH_PREVIEW to type
- `apps/web/src/components/agent/AgentPanel.tsx` - Handle REFRESH_PREVIEW
- `apps/web/src/components/preview/PreviewPanel.tsx` - Add scroll-to-section

**Tasks:**

- [ ] Add `REFRESH_PREVIEW` to `DashboardAction` interface
- [ ] Handle `REFRESH_PREVIEW` in `handleDashboardActions`:
  - Invalidate draft query
  - Wait for refetch
  - Scroll iframe to `sectionId`
- [ ] Implement `scrollToSection(sectionId)` in PreviewPanel
- [ ] Use `postMessage` to communicate scroll target to iframe

**DashboardAction handler update:**

```typescript
// apps/web/src/components/agent/AgentPanel.tsx

const handleDashboardActions = useCallback(
  (actions: DashboardAction[]) => {
    for (const action of actions) {
      switch (action.type) {
        case 'NAVIGATE':
          if (action.section === 'website') {
            agentUIActions.showPreview('home');
          }
          break;

        case 'SCROLL_TO_SECTION':
          if (action.sectionId) {
            agentUIActions.highlightSection(action.sectionId);
          }
          break;

        case 'SHOW_PREVIEW':
          agentUIActions.showPreview('home');
          agentUIActions.refreshPreview();
          break;

        case 'REFRESH':
          agentUIActions.refreshPreview();
          break;

        case 'REFRESH_PREVIEW': // NEW
          // Invalidate cache and wait for refetch before scrolling
          // NOTE: Don't use setTimeout - use proper async chaining
          queryClient
            .invalidateQueries({
              queryKey: getDraftConfigQueryKey(),
              refetchType: 'active',
            })
            .then(() => {
              // Scroll after data is refreshed
              if (action.sectionId) {
                agentUIActions.scrollToSection(action.sectionId);
              }
            });
          break;
      }
    }
  },
  [queryClient, agentUIActions]
);
```

**Scroll implementation:**

```typescript
// apps/web/src/components/preview/PreviewPanel.tsx

const scrollToSection = useCallback((sectionId: string) => {
  if (!iframeRef.current?.contentWindow) return;

  // Send message to iframe to scroll to section
  iframeRef.current.contentWindow.postMessage(
    {
      type: 'SCROLL_TO_SECTION',
      sectionId,
    },
    '*'
  );
}, []);

// In iframe content (storefront page):
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data.type === 'SCROLL_TO_SECTION') {
      const element = document.getElementById(event.data.sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

**Success criteria:**

- [ ] `REFRESH_PREVIEW` triggers query invalidation
- [ ] Preview iframe scrolls to updated section
- [ ] Scroll is smooth and positions section at top

---

#### Phase 6: Placeholder UI for Incomplete Sections (Frontend)

Display helpful placeholders when sections are incomplete.

**Files to modify:**

- `apps/web/src/components/storefront/sections/PricingSection.tsx`
- `apps/web/src/components/storefront/sections/FeaturesSection.tsx`
- `apps/web/src/components/storefront/sections/TestimonialsSection.tsx`
- `apps/web/src/components/storefront/sections/FAQSection.tsx`
- `apps/web/src/components/storefront/SectionPlaceholder.tsx` - NEW

**Tasks:**

- [ ] Create `SectionPlaceholder` component with:
  - Icon matching section type
  - Helpful message ("Add pricing tiers to complete this section")
  - Subtle styling that indicates incompleteness
- [ ] Update each section component to show placeholder when empty
- [ ] Only show placeholders in preview mode (not live site)

**Placeholder component:**

```tsx
// apps/web/src/components/storefront/SectionPlaceholder.tsx

import { DollarSign, Star, MessageSquare, HelpCircle, Sparkles } from 'lucide-react';

interface SectionPlaceholderProps {
  sectionType: 'pricing' | 'features' | 'testimonials' | 'faq';
  className?: string;
}

const PLACEHOLDER_CONFIG = {
  pricing: {
    icon: DollarSign,
    message: 'Add pricing tiers to complete this section',
    hint: 'Ask the AI to add a tier, e.g., "Add a basic tier for $99/month"',
  },
  features: {
    icon: Sparkles,
    message: 'Add features to complete this section',
    hint: 'Ask the AI to add features, e.g., "Add 3 key features"',
  },
  testimonials: {
    icon: Star,
    message: 'Add testimonials to complete this section',
    hint: 'Ask the AI to add testimonials, e.g., "Add a testimonial from a happy customer"',
  },
  faq: {
    icon: HelpCircle,
    message: 'Add FAQ items to complete this section',
    hint: 'Ask the AI to add questions, e.g., "Add common questions about booking"',
  },
};

export function SectionPlaceholder({ sectionType, className }: SectionPlaceholderProps) {
  const config = PLACEHOLDER_CONFIG[sectionType];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'py-16 px-8 border-2 border-dashed border-sage-300 rounded-3xl',
        'bg-sage-50/50 text-center',
        className
      )}
    >
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sage-100 mb-4">
        <Icon className="w-6 h-6 text-sage-600" />
      </div>
      <p className="text-lg font-medium text-sage-700 mb-2">{config.message}</p>
      <p className="text-sm text-sage-500">{config.hint}</p>
    </div>
  );
}
```

**Section component update example:**

```tsx
// apps/web/src/components/storefront/sections/PricingSection.tsx

interface PricingSectionProps {
  section: PricingSection;
  isPreview?: boolean; // NEW: Know if we're in preview mode
}

export function PricingSection({ section, isPreview }: PricingSectionProps) {
  // Show placeholder in preview mode if no tiers
  if (section.tiers.length === 0) {
    if (isPreview) {
      return (
        <section id={section.id} className="py-24">
          <div className="container mx-auto px-4">
            {section.headline && (
              <h2 className="text-3xl font-serif text-center mb-8">{section.headline}</h2>
            )}
            <SectionPlaceholder sectionType="pricing" />
          </div>
        </section>
      );
    }
    // On live site, don't render empty section at all
    return null;
  }

  // Normal rendering with tiers
  return (
    <section id={section.id} className="py-24">
      {/* ... existing implementation ... */}
    </section>
  );
}
```

**Success criteria:**

- [ ] Empty pricing section shows placeholder with helpful message
- [ ] Placeholder includes hint on how to complete
- [ ] Live site hides empty sections entirely
- [ ] Preview shows placeholders with dashed border styling

---

#### Phase 7: Integration Testing (Quality)

Verify end-to-end flow works as expected.

**Files to create:**

- `server/src/__tests__/integration/storefront-preview.test.ts`
- `apps/web/e2e/storefront-preview.spec.ts`

**Tasks:**

- [ ] Unit tests for `validateDraft()` vs `validateForPublish()`
- [ ] Unit tests for `getIncompleteSections()`
- [ ] Integration test: Write empty section → Preview shows placeholder
- [ ] Integration test: Add content to section → Preview updates
- [ ] Integration test: Publish with incomplete → Returns error
- [ ] Integration test: Complete section → Publish succeeds
- [ ] E2E test: Full flow from brainstorm test scenario

**Test scenario from brainstorm:**

```typescript
// apps/web/e2e/storefront-preview.spec.ts

test('real-time storefront preview with incomplete sections', async ({ page }) => {
  // 1. Login as tenant
  await loginAsTenant(page);

  // 2. Go to Website tab
  await page.click('[data-testid="nav-website"]');

  // 3. Verify preview iframe visible
  await expect(page.frameLocator('[data-testid="preview-iframe"]')).toBeVisible();

  // 4. Send message to add pricing section
  await page.fill('[data-testid="chat-input"]', 'Add a pricing section to my homepage');
  await page.click('[data-testid="chat-send"]');

  // 5. Wait for agent response
  await expect(page.locator('[data-testid="agent-message"]')).toContainText('Added');

  // 6. CRITICAL: Verify preview shows placeholder (not fallback)
  const iframe = page.frameLocator('[data-testid="preview-iframe"]');
  await expect(iframe.locator('[data-testid="section-placeholder-pricing"]')).toContainText(
    'Add pricing tiers to complete this section'
  );

  // 7. Add a tier
  await page.fill('[data-testid="chat-input"]', 'Add a basic tier for $99/month');
  await page.click('[data-testid="chat-send"]');

  // 8. Verify preview shows actual pricing section
  await expect(iframe.locator('[data-testid="pricing-tier"]')).toContainText('$99');

  // 9. Try to publish (should fail)
  await page.fill('[data-testid="chat-input"]', 'Publish my site');
  await page.click('[data-testid="chat-send"]');

  // 10. Agent should explain what's incomplete (if other sections missing)
  // or publish should succeed if all sections complete
});
```

**Success criteria:**

- [ ] All unit tests pass
- [ ] E2E test passes end-to-end
- [ ] No regression in existing tests

---

## Alternative Approaches Considered

### 1. Single Schema with Runtime Mode Flag

**Approach:** One schema with a `mode: 'draft' | 'publish'` parameter that toggles `.min()` constraints.

**Rejected because:**

- Zod doesn't support conditional constraints cleanly
- Runtime mode flags are error-prone (easy to forget to pass)
- Two schemas are explicit and type-safe at compile time

### 2. Partial Validation (Section-by-Section)

**Approach:** Validate each section independently, return partial results.

**Rejected because:**

- More complex than needed for this use case
- Brainstorm decision was "lenient drafts, strict publish" - binary, not partial
- Would require significant refactoring of storage layer

### 3. Keep Existing Storage, Fix Validation Only

**Approach:** Just add lenient schemas, don't change storage columns.

**Rejected because:**

- Dual storage columns (`landingPageConfigDraft` + wrapper in `landingPageConfig`) cause confusion
- Source of bugs documented in pitfalls 56-57
- Clean slate with unified columns is worth the migration effort
- No real user data to migrate

## Acceptance Criteria

### Functional Requirements

- [ ] **FR1:** Adding an empty section via AI shows in preview immediately
- [ ] **FR2:** Preview auto-scrolls to updated section
- [ ] **FR3:** Incomplete sections show placeholder UI with helpful message
- [ ] **FR4:** Publishing with incomplete sections returns detailed error
- [ ] **FR5:** Agent explains what's incomplete conversationally
- [ ] **FR6:** Completing all sections allows publish to succeed
- [ ] **FR7:** Live site never shows placeholder UI

### Non-Functional Requirements

- [ ] **NFR1:** Preview updates within 1 second of agent confirmation
- [ ] **NFR2:** No silent fallback to live content when draft exists
- [ ] **NFR3:** Lenient validation doesn't allow invalid field values (just empty arrays)
- [ ] **NFR4:** Storage migration is idempotent (can run multiple times safely)

### Quality Gates

- [ ] All existing tests pass (no regression)
- [ ] New unit tests for validation utilities
- [ ] E2E test for complete flow
- [ ] TypeScript strict mode passes
- [ ] No new ESLint warnings

## Success Metrics

| Metric                 | Current                | Target    | Measurement                                          |
| ---------------------- | ---------------------- | --------- | ---------------------------------------------------- |
| Preview update latency | N/A (broken)           | <1 second | Time from agent response to preview change           |
| Silent fallback rate   | ~100% for new sections | 0%        | Log analysis for "hasDraft: false" when draft exists |
| User confusion reports | (qualitative)          | 0         | User feedback about preview not updating             |

## Dependencies & Prerequisites

### Technical Dependencies

- [ ] Prisma 7 migration tooling (already installed)
- [ ] TanStack Query for cache invalidation (already installed)
- [ ] Zod 3.x for schema definitions (already installed)

### Human Dependencies

- None - all decisions made in brainstorm

### Blocked By

- Nothing - can start immediately

## Risk Analysis & Mitigation

| Risk                               | Likelihood | Impact | Mitigation                                            |
| ---------------------------------- | ---------- | ------ | ----------------------------------------------------- |
| Migration breaks existing drafts   | Low        | High   | Test migration on staging first; data is minimal      |
| Lenient validation too permissive  | Medium     | Medium | Only relax array `.min()`, keep all other constraints |
| Auto-scroll doesn't work in iframe | Medium     | Low    | Fallback to manual scroll; use postMessage API        |
| Publish validation bypass          | Low        | High   | Strict validation in service layer, not just tool     |

## Resource Requirements

### Effort Estimate

| Phase                      | Files | Complexity | Estimate      |
| -------------------------- | ----- | ---------- | ------------- |
| Phase 1: Dual Schemas      | 2     | Medium     | 2 hours       |
| Phase 2: Storage Migration | 3     | Medium     | 2.5 hours     |
| Phase 3: Preview Service   | 3     | Low        | 1 hour        |
| Phase 4: Agent Tools       | 3     | Medium     | 2 hours       |
| Phase 5: Frontend Refresh  | 3     | Medium     | 2 hours       |
| Phase 6: Placeholder UI    | 5     | Low        | 2 hours       |
| Phase 7: Testing           | 2     | Medium     | 2.5 hours     |
| **Total**                  |       |            | **~14 hours** |

_Note: +1 hour from original estimate to account for boundary validation and async chaining refinements from code review._

### Infrastructure

- No new infrastructure required
- Uses existing database, no new services

## Future Considerations

### Extensibility

1. **Visual Editor integration:** Once AI path works, can update Visual Editor to use same unified storage
2. **Section-level undo:** Could add undo stack per section if conversational undo proves insufficient
3. **Real-time collaboration:** Unified storage makes multi-user editing easier to add later

### Technical Debt Created

- Old columns (`landingPageConfigDraft`, `landingPageConfig`) left in schema temporarily
- Can be removed in follow-up migration after verification
- Visual Editor still uses old columns (out of scope)

### Not Included (Intentionally)

- Visual Editor updates (deprecated for now)
- Complex undo infrastructure (agent handles conversationally)
- Section-level validation indicators in preview (just placeholders)

## Documentation Plan

### Code Documentation

- [ ] JSDoc comments on `validateDraft()` and `validateForPublish()`
- [ ] Inline comments explaining lenient vs strict schema choice
- [ ] Update `CLAUDE.md` pitfalls section with new pattern

### User-Facing Documentation

- None needed (invisible improvement to UX)

### Internal Documentation

- [ ] Add to `docs/solutions/patterns/` after implementation if novel patterns emerge
- [ ] Update `docs/architecture/BUILD_MODE_VISION.md` with unified storage design

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-01-realtime-storefront-preview-brainstorm.md`
- Section schemas: `packages/contracts/src/landing-page.ts:365-545`
- Landing page service: `server/src/services/landing-page.service.ts`
- Storefront write tool: `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts`
- Dashboard actions: `apps/web/src/components/agent/AgentPanel.tsx:197-225`
- Wrapper format utils: `server/src/lib/landing-page-utils.ts:73-80`

### Prevention Patterns

- Pitfall #56: Wrapper format WRITE - use `createPublishedWrapper()`
- Pitfall #57: Wrapper format READ - extract `config.published ?? config`
- Pitfall #52: Tool responses must return state, not just success
- `docs/solutions/WRAPPER_FORMAT_PREVENTION.md`

### Related Work

- Agent tool consolidation (Phase 4): `docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md`
- Data integrity analysis: `docs/solutions/LANDING-PAGE-EDITOR-DATA-INTEGRITY-ANALYSIS.md`

---

## Review Feedback (2026-02-01)

Plan reviewed by 3 specialized agents. Key changes incorporated:

### Technical Fixes Applied

| Issue                                         | Source                      | Resolution                                                 |
| --------------------------------------------- | --------------------------- | ---------------------------------------------------------- |
| Prisma field reference syntax invalid         | @kieran-typescript-reviewer | Changed `publishStorefront()` to fetch-then-update pattern |
| Unsafe `as` casts from Prisma JSON            | @kieran-typescript-reviewer | Added `safeParse()` validation at repository boundaries    |
| `setTimeout` for scroll timing                | @kieran-typescript-reviewer | Use `invalidateQueries().then()` for proper async chaining |
| `ValidationResult` loses type info            | @kieran-typescript-reviewer | Made generic: `ValidationResult<T>` with typed overloads   |
| Missing null check in `getIncompleteSections` | @kieran-typescript-reviewer | Added guard: `if (!config.pages) return []`                |

### Feedback Considered But Not Applied

| Suggestion                       | Source              | Decision                                                                                             |
| -------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Kill Phase 2 (storage migration) | @dhh-rails-reviewer | **Kept** - Pitfalls 56-57 document real bugs from dual-column confusion; no user data = free cleanup |
| Collapse to 3 phases             | @dhh-rails-reviewer | **Kept 7 phases** - Layer separation aids debugging and incremental verification                     |
| Remove `storefrontDraftVersion`  | @dhh-rails-reviewer | **Kept** - Low cost (1 column, ~5 lines); enables future concurrent edit detection                   |

### Reviewer Verdicts

- **DHH-Style:** "Solid foundation, but Phase 2 is YAGNI" → Disagreed on tech debt timing
- **TypeScript Expert:** "Well-structured, minor refinements needed" → All refinements applied
- **Code Simplicity:** "Approved - complexity justified for P1 bug"

---

## Checklist for Implementation

```
Phase 1: Dual Schema Infrastructure
[ ] Create lenient section schemas in landing-page.ts
[ ] Create validation utilities in landing-page-validation.ts
[ ] Export validateDraft(), validateForPublish(), getIncompleteSections()
[ ] Write unit tests for validation utilities

Phase 2: Unified Storage Migration
[ ] Add storefrontDraft, storefrontPublished columns to schema.prisma
[ ] Create migration SQL with data copy
[ ] Run migration on dev database
[ ] Update TenantRepository methods

Phase 3: Preview Service Updates
[ ] Update getPreviewData() to use lenient validation
[ ] Add incompleteSections to response
[ ] Remove silent fallback behavior
[ ] Test preview endpoint

Phase 4: Agent Tool Updates
[ ] Add REFRESH_PREVIEW to DashboardAction type
[ ] Update storefront-write.ts to return REFRESH_PREVIEW
[ ] Update storefront-publish.ts to use strict validation
[ ] Generate stable section IDs

Phase 5: Frontend Preview Refresh
[ ] Add REFRESH_PREVIEW to useConciergeChat types
[ ] Handle REFRESH_PREVIEW in AgentPanel
[ ] Implement scrollToSection via postMessage
[ ] Add message listener in iframe

Phase 6: Placeholder UI
[ ] Create SectionPlaceholder component
[ ] Update PricingSection for empty state
[ ] Update FeaturesSection for empty state
[ ] Update TestimonialsSection for empty state
[ ] Update FAQSection for empty state

Phase 7: Integration Testing
[ ] Unit tests for schemas
[ ] Integration tests for service
[ ] E2E test for full flow
[ ] Verify no regression
```
