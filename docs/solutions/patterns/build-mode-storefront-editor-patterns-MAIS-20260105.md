---
slug: build-mode-storefront-editor-patterns
date_discovered: 2026-01-05
severity: medium
component: build-mode
related_issues:
  - chatbot-proposal-execution-flow-MAIS-20251229
  - circular-dependency-executor-registry-MAIS-20251229
  - PATTERN-ANALYSIS-LANDING-PAGE-EDITOR
tags:
  - agent-native
  - postmessage
  - draft-system
  - multi-agent-review
  - code-review
  - action-parity
  - zod-validation
  - trust-tiers
---

# Build Mode Storefront Editor Patterns

## Context

Build Mode is a split-screen storefront editor with AI chat assistant. Users edit their landing page content in real-time with:

- Left panel: AI chat assistant (35% width)
- Right panel: Live storefront preview in iframe (65% width)
- PostMessage communication between parent and iframe
- Draft system for unpublished changes

**Implementation Stats:**

- 7 development phases completed
- ~1,172 lines of new agent code (tools + executors)
- 5 agent tools created
- Multi-agent code review identified 22 findings

## Key Architecture Decisions

### 1. Trust Tier Classification

| Tool                         | Trust Tier | Rationale                                |
| ---------------------------- | ---------- | ---------------------------------------- |
| `update_page_section`        | T2         | Content changes affect public storefront |
| `remove_page_section`        | T2         | Destructive but reversible via discard   |
| `reorder_page_sections`      | T1         | Low risk, easily reversible              |
| `toggle_page_enabled`        | T1         | Visibility toggle is low risk            |
| `update_storefront_branding` | T2         | Visual changes affect entire storefront  |

### 2. PostMessage Protocol Design

Uses discriminated unions with Zod validation:

```typescript
// Parent → Iframe messages
type BuildModeParentMessage =
  | { type: 'BUILD_MODE_INIT'; data: { draftConfig: PagesConfig } }
  | { type: 'BUILD_MODE_CONFIG_UPDATE'; data: { pages: PagesConfig } }
  | { type: 'BUILD_MODE_HIGHLIGHT_SECTION'; data: { sectionIndex: number } };

// Iframe → Parent messages
type BuildModeChildMessage =
  | { type: 'BUILD_MODE_READY' }
  | {
      type: 'BUILD_MODE_SECTION_EDIT';
      data: { sectionIndex: number; field: string; value: string };
    }
  | { type: 'BUILD_MODE_PAGE_CHANGE'; data: { page: PageName } };
```

### 3. Draft System

- All content changes save to `landingPageConfigDraft` field
- Users explicitly publish to make changes live
- Discard reverts to published config
- **Exception Found:** Branding updates bypass draft (immediately live)

## Critical Findings from Code Review

### P1 - Agent Parity Gap

**Problem:** Users can publish/discard via UI buttons, but agent cannot.

**Missing Tools:**

- `publish_draft` - Make draft changes live
- `discard_draft` - Revert to published config
- `get_landing_page_draft` - Read current draft (not just published)

**Prevention Pattern:**

```markdown
## Agent Tool Parity Checklist

For every UI action, verify:

- [ ] Corresponding agent tool exists
- [ ] Tool has same capabilities as UI
- [ ] Tool respects same validation rules
- [ ] Tool goes through same draft/proposal flow
```

### P1 - DRY Violations

**Problem:** Zod schemas and helpers duplicated between tools and executors.

**Files Affected:**

- `server/src/agent/tools/storefront-tools.ts` (700 lines)
- `server/src/agent/executors/storefront-executors.ts` (472 lines)

**Duplicated Code:**

- 5 Zod schemas (UpdatePageSectionPayloadSchema, etc.)
- `getDraftConfig()` helper (28 lines)
- `getTenantSlug()` helper (10 lines)

**Solution Pattern:**

```typescript
// Extract to shared module
// server/src/agent/schemas/storefront-schemas.ts
export const UpdatePageSectionPayloadSchema = z.object({
  pageName: z.enum(PAGE_NAMES as [PageName, ...PageName[]]),
  sectionIndex: z.number().int().min(0).optional(),
  // ... rest of schema
});

// Import in both files
import { UpdatePageSectionPayloadSchema } from '../schemas/storefront-schemas';
```

### P2 - PostMessage Type Safety

**Problem:** Type casting without runtime validation.

```typescript
// BAD - unsafe type casting
const message = event.data as BuildModeChildMessage;

// GOOD - runtime validation with existing parser
import { parseChildMessage } from '@/lib/build-mode/protocol';

const message = parseChildMessage(event.data);
if (!message) return; // Invalid message, ignore
```

### P2 - N+1 Database Queries

**Problem:** Each executor makes 2-4 separate DB calls.

```typescript
// Current: 3 separate queries per operation
const draft = await getDraftConfig(prisma, tenantId); // Query 1
await saveDraftConfig(prisma, tenantId, draft); // Query 2
const slug = await getTenantSlug(prisma, tenantId); // Query 3

// Better: Single query with all needed fields
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: {
    slug: true,
    landingPageConfig: true,
    landingPageConfigDraft: true,
  },
});
```

### P2 - Branding Bypass Draft System (Intentional)

**Observation:** Branding updates go live immediately while content goes to draft.

```typescript
// Content: Goes to draft (correct)
await prisma.tenant.update({
  where: { id: tenantId },
  data: { landingPageConfigDraft: updatedDraft },
});

// Branding: Goes live immediately (intentional!)
await prisma.tenant.update({
  where: { id: tenantId },
  data: { primaryColor, secondaryColor, ... }, // Direct to tenant
});
```

**Design Decision: Option B - Document as Intentional**

Branding changes (colors, fonts, logo) bypass the draft system by design:

1. **Simpler UX:** Colors preview instantly in the browser. Having a separate "publish" step for branding adds friction without clear benefit.
2. **Visual Feedback Loop:** Users want to see color changes immediately as they experiment. Draft → Publish → Reload interrupts this flow.
3. **Low Risk:** Branding changes are easily reversible (just pick new colors). Unlike content deletion, there's no data loss risk.
4. **Separation of Concerns:** Content (sections, text, structure) is complex and benefits from staging. Branding is atomic and simple.

**Tool Documentation:** The `update_storefront_branding` tool description explicitly states:

> "NOTE: Branding changes take effect immediately and are NOT part of the draft system. Changes cannot be discarded - they are applied directly to the live storefront."

**Future Consideration (Option A):** If users request undo capability for branding, consider adding `brandingDraft` fields. This would require:

- New `primaryColorDraft`, `secondaryColorDraft`, etc. fields on Tenant
- Branding publish/discard buttons in UI
- Updated executor to write to draft fields
- Tool description update

## Prevention Checklist

### Before Building Agent Tools

- [ ] Enumerate all UI actions users can perform
- [ ] Create corresponding agent tool for each action (parity)
- [ ] Define trust tiers (T1/T2/T3) based on risk level
- [ ] Extract shared schemas to dedicated module (`schemas/`)
- [ ] Plan test coverage (minimum 70% for agent code)

### Before Building PostMessage Protocol

- [ ] Define all message types with Zod schemas
- [ ] Create discriminated unions for type safety
- [ ] Implement `parseMessage()` functions for validation
- [ ] Add origin validation on every message handler
- [ ] Consider iframe sandbox attributes carefully

### Before Building Draft Systems

- [ ] Define clearly what goes to draft vs live
- [ ] Document any exceptions and rationale (e.g., branding goes live immediately for faster visual feedback)
- [ ] Update tool descriptions to reflect draft vs immediate behavior
- [ ] Add optimistic locking for concurrent edits
- [ ] Authenticate all draft preview URLs
- [ ] Implement publish/discard confirmation dialogs

### Before Code Review

- [ ] Run multi-agent review (security, architecture, performance, quality, agent-native)
- [ ] Verify agent can do everything user can do
- [ ] Check for DRY violations between tools and executors
- [ ] Validate all PostMessage handlers use Zod parsing

## Code Examples

### Safe PostMessage Handling

```typescript
// apps/web/src/components/build-mode/BuildModePreview.tsx

import { parseChildMessage, isSameOrigin } from '@/lib/build-mode/protocol';

useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    // 1. Origin validation
    if (!isSameOrigin(event.origin)) return;

    // 2. Zod validation (not type casting!)
    const message = parseChildMessage(event.data);
    if (!message) {
      logger.warn('[BuildMode] Invalid message received', { data: event.data });
      return;
    }

    // 3. Now safe to use discriminated union
    switch (message.type) {
      case 'BUILD_MODE_READY':
        setIsReady(true);
        break;
      case 'BUILD_MODE_SECTION_EDIT':
        onSectionEdit?.(message.data);
        break;
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [onSectionEdit]);
```

### Shared Schema Module

```typescript
// server/src/agent/schemas/storefront-schemas.ts

import { z } from 'zod';
import { PAGE_NAMES, SECTION_TYPES, PageName, SectionType } from '@macon/contracts';

// Reusable page name enum
export const PageNameSchema = z.enum(PAGE_NAMES as [PageName, ...PageName[]]);

// Reusable section type enum
export const SectionTypeSchema = z.enum(SECTION_TYPES as [SectionType, ...SectionType[]]);

// Tool payload schemas
export const UpdatePageSectionPayloadSchema = z.object({
  pageName: PageNameSchema,
  sectionIndex: z.number().int().min(0).optional(),
  sectionType: SectionTypeSchema.optional(),
  content: z.record(z.unknown()).optional(),
});

export const RemovePageSectionPayloadSchema = z.object({
  pageName: PageNameSchema,
  sectionIndex: z.number().int().min(0),
});

// Helper for formatting Zod errors
export function formatZodErrors(error: z.ZodError): string {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
}
```

### Draft Config Service

```typescript
// server/src/services/draft-config.service.ts

import { PrismaClient } from '@prisma/client';
import { DEFAULT_PAGES_CONFIG, PagesConfig } from '@macon/contracts';

export class DraftConfigService {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreateDraft(tenantId: string): Promise<{
    pages: PagesConfig;
    hasDraft: boolean;
    slug: string;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        slug: true,
        landingPageConfig: true,
        landingPageConfigDraft: true,
      },
    });

    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

    const hasDraft = tenant.landingPageConfigDraft !== null;
    const pages = (tenant.landingPageConfigDraft ??
      tenant.landingPageConfig ??
      DEFAULT_PAGES_CONFIG) as unknown as PagesConfig;

    return { pages, hasDraft, slug: tenant.slug };
  }

  async saveDraft(tenantId: string, pages: PagesConfig): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { landingPageConfigDraft: pages as unknown as Prisma.JsonValue },
    });
  }

  async publishDraft(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfigDraft: true },
    });

    if (!tenant?.landingPageConfigDraft) {
      throw new Error('No draft to publish');
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        landingPageConfig: tenant.landingPageConfigDraft,
        landingPageConfigDraft: null,
      },
    });
  }

  async discardDraft(tenantId: string): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { landingPageConfigDraft: null },
    });
  }
}
```

## Related Documentation

| Document                                                                                                          | Relevance                                      |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [chatbot-proposal-execution-flow-MAIS-20251229](../logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md) | T2 execution patterns, field normalization     |
| [circular-dependency-executor-registry-MAIS-20251229](./circular-dependency-executor-registry-MAIS-20251229.md)   | Registry pattern for breaking circular imports |
| [mais-critical-patterns](./mais-critical-patterns.md)                                                             | Agent-native action parity principle           |
| [PATTERN-ANALYSIS-LANDING-PAGE-EDITOR](../PATTERN-ANALYSIS-LANDING-PAGE-EDITOR.md)                                | Draft/publish architecture foundation          |
| [AGENT-NATIVE-DESIGN-PATTERNS](../agent-design/AGENT-NATIVE-DESIGN-PATTERNS.md)                                   | Trust tier design, tool consolidation          |

## Test Coverage Requirements

Minimum coverage for agent tools/executors:

```typescript
// server/test/agent/tools/storefront-tools.test.ts

describe('storefront-tools', () => {
  describe('update_page_section', () => {
    it('creates proposal for new section', async () => {
      /* ... */
    });
    it('creates proposal for updating existing section', async () => {
      /* ... */
    });
    it('validates section type', async () => {
      /* ... */
    });
    it('rejects invalid page name', async () => {
      /* ... */
    });
    it('uses T2 trust tier', async () => {
      /* ... */
    });
  });

  describe('remove_page_section', () => {
    it('creates proposal for section removal', async () => {
      /* ... */
    });
    it('rejects out-of-bounds section index', async () => {
      /* ... */
    });
  });

  describe('reorder_page_sections', () => {
    it('uses T1 trust tier (auto-confirm)', async () => {
      /* ... */
    });
    it('validates new order length matches section count', async () => {
      /* ... */
    });
  });
});

// server/test/agent/executors/storefront-executors.test.ts

describe('storefront-executors', () => {
  describe('update_page_section executor', () => {
    it('adds new section to draft', async () => {
      /* ... */
    });
    it('updates existing section in draft', async () => {
      /* ... */
    });
    it('creates draft from live config if none exists', async () => {
      /* ... */
    });
    it('maintains tenant isolation', async () => {
      /* ... */
    });
  });
});
```

## Summary

The Build Mode implementation demonstrates solid security fundamentals (tenant isolation, Zod validation, origin checks) but revealed important patterns:

1. **Agent Parity is Critical:** Every UI action needs a corresponding agent tool
2. **DRY Applies to Agent Code:** Shared schemas belong in dedicated modules
3. **PostMessage Needs Runtime Validation:** Never type-cast without parsing
4. **Draft Systems Need Consistency:** All modifications should follow same flow
5. **Multi-Agent Review Catches More:** 5 parallel reviewers found 22 issues

These patterns compound future development by establishing clear guidelines for AI-assisted editor features.
