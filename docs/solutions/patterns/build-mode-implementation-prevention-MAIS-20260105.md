---
title: Build Mode Implementation Prevention Strategies
category: patterns
severity: P1
component: server/src/agent/tools, apps/web/src/components/build-mode
date: 2026-01-05
symptoms:
  - Agent tools missing for UI actions
  - Zod schemas duplicated across files
  - PostMessage validation gaps
  - Inconsistent draft vs live data flow
  - Zero test coverage on agent tools
root_cause: Missing architectural patterns for agent tool development and iframe communication
solution_pattern: Comprehensive checklists and code patterns for agent-integrated features
tags: [agent-tools, draft-system, postmessage, testing, dry-principle, prevention]
---

# Build Mode Implementation Prevention Strategies

**Purpose:** Prevent recurring issues when building agent-integrated features with draft systems and iframe communication.

**When to use:** Before implementing any feature with:

- AI agent tools (read/write operations)
- Draft/publish workflows
- PostMessage iframe communication
- Multi-state configurations

---

## Summary of Issues Found

| ID   | Severity | Issue              | Root Cause                                  |
| ---- | -------- | ------------------ | ------------------------------------------- |
| P1-1 | Critical | Agent Parity Gap   | Missing publish_draft, discard_draft tools  |
| P1-2 | Critical | DRY Violations     | Zod schemas duplicated in tools + executors |
| P1-3 | Critical | Testing Gap        | 1,172 lines with zero test coverage         |
| P1-4 | Critical | Inconsistent Draft | Branding goes live, content goes to draft   |
| P2-1 | High     | Type Safety        | PostMessage cast without Zod validation     |
| P2-2 | High     | Security           | Draft preview without authentication        |
| P2-3 | High     | Performance        | N+1 queries (2-4 DB calls per executor)     |
| P2-4 | High     | State Management   | Overlapping hooks for sync                  |
| P2-5 | High     | Concurrency        | No optimistic locking                       |

---

## Prevention Checklist

### Before Building Agent Tools

**Agent Parity Principle:** Whatever the user can do in UI, the agent must be able to do.

- [ ] **Enumerate all UI actions** before writing any tool code
- [ ] **Map each UI action to an agent tool** (use table below)
- [ ] **Include lifecycle operations** (create, update, delete, publish, discard)
- [ ] **Define trust tiers** based on reversibility and impact
- [ ] **Extract shared schemas** to `@macon/contracts` or dedicated module

```markdown
| UI Action         | Agent Tool             | Trust Tier | Reason                     |
| ----------------- | ---------------------- | ---------- | -------------------------- |
| Edit section      | update_page_section    | T2         | Content change             |
| Delete section    | remove_page_section    | T2         | Destructive but reversible |
| Reorder sections  | reorder_page_sections  | T1         | Low risk, easy undo        |
| Toggle page       | toggle_page_enabled    | T1         | Visibility toggle          |
| Publish draft     | publish_draft          | T2         | Makes changes live         |
| Discard draft     | discard_draft          | T2         | Loses unsaved work         |
| Get current state | get_landing_page_draft | T1         | Read-only                  |
```

### Trust Tier Decision Tree

```
Is it read-only?
├── Yes → T1 (auto-confirm)
└── No → Is it easily reversible?
    ├── Yes → Is it structural (reorder, toggle)?
    │   ├── Yes → T1 (auto-confirm)
    │   └── No → T2 (soft confirm)
    └── No → Is it destructive?
        ├── Yes → T3 (explicit user confirm)
        └── No → T2 (soft confirm)
```

### DRY Schema Pattern

**NEVER** duplicate Zod schemas between tools and executors.

```typescript
// packages/contracts/src/schemas/build-mode-payloads.ts
import { z } from 'zod';
import { SectionSchema, PAGE_NAMES } from './landing-page.schema';

// Single source of truth for all payload schemas
export const UpdatePageSectionPayloadSchema = z.object({
  pageName: z.enum(PAGE_NAMES as unknown as [string, ...string[]]),
  sectionIndex: z.number().int().min(-1),
  sectionData: SectionSchema,
});

export const RemovePageSectionPayloadSchema = z.object({
  pageName: z.enum(PAGE_NAMES as unknown as [string, ...string[]]),
  sectionIndex: z.number().int().min(0),
});

// Export types derived from schemas
export type UpdatePageSectionPayload = z.infer<typeof UpdatePageSectionPayloadSchema>;
export type RemovePageSectionPayload = z.infer<typeof RemovePageSectionPayloadSchema>;
```

```typescript
// server/src/agent/tools/storefront-tools.ts
import { UpdatePageSectionPayloadSchema, type UpdatePageSectionPayload } from '@macon/contracts';

// Use imported schema, don't redefine
const validationResult = UpdatePageSectionPayloadSchema.safeParse(payload);
```

```typescript
// server/src/agent/executors/storefront-executors.ts
import { UpdatePageSectionPayloadSchema } from '@macon/contracts';

// Same schema, different file - no duplication
const validationResult = UpdatePageSectionPayloadSchema.safeParse(payload);
```

### Shared Helper Pattern

**NEVER** duplicate utility functions. Extract to shared module.

```typescript
// server/src/agent/tools/shared/tenant-helpers.ts
import type { PrismaClient } from '../../../generated/prisma';
import type { LandingPageConfig, PagesConfig } from '@macon/contracts';
import { DEFAULT_PAGES_CONFIG } from '@macon/contracts';

/**
 * Get or initialize draft config from tenant
 * Single source of truth - used by both tools and executors
 */
export async function getDraftConfig(
  prisma: PrismaClient,
  tenantId: string
): Promise<{ pages: PagesConfig; hasDraft: boolean }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { landingPageConfig: true, landingPageConfigDraft: true },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  if (tenant.landingPageConfigDraft) {
    const draft = tenant.landingPageConfigDraft as unknown as LandingPageConfig;
    return {
      pages: draft.pages || DEFAULT_PAGES_CONFIG,
      hasDraft: true,
    };
  }

  const live = tenant.landingPageConfig as unknown as LandingPageConfig | null;
  return {
    pages: live?.pages || DEFAULT_PAGES_CONFIG,
    hasDraft: false,
  };
}

/**
 * Get tenant slug for preview URL
 */
export async function getTenantSlug(
  prisma: PrismaClient,
  tenantId: string
): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  return tenant?.slug ?? null;
}
```

---

## Before Building PostMessage Protocol

### PostMessage Security Checklist

- [ ] **Define Zod schemas for ALL message types** (both directions)
- [ ] **Create parse functions** that return `null` on invalid input
- [ ] **Always validate origin** before processing any message
- [ ] **Use discriminated unions** to prevent type confusion
- [ ] **Never cast `event.data`** without validation

### Correct PostMessage Pattern

```typescript
// apps/web/src/lib/build-mode/protocol.ts
import { z } from 'zod';

// Define schemas with discriminator
export const BuildModeReadySchema = z.object({
  type: z.literal('BUILD_MODE_READY'),
});

export const BuildModeSectionEditSchema = z.object({
  type: z.literal('BUILD_MODE_SECTION_EDIT'),
  data: z.object({
    pageId: z.string(),
    sectionIndex: z.number().int().min(0),
    field: z.string().min(1).max(50),
    value: z.string().max(10000),
  }),
});

// Discriminated union for type-safe parsing
export const BuildModeChildMessageSchema = z.discriminatedUnion('type', [
  BuildModeReadySchema,
  BuildModeSectionEditSchema,
]);

export type BuildModeChildMessage = z.infer<typeof BuildModeChildMessageSchema>;

// Parse function returns typed message or null
export function parseChildMessage(data: unknown): BuildModeChildMessage | null {
  const result = BuildModeChildMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}
```

```typescript
// Component using PostMessage
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    // SECURITY: Always validate origin first
    if (event.origin !== window.location.origin) {
      console.warn('[BuildMode] Ignoring message from untrusted origin:', event.origin);
      return;
    }

    // SECURITY: Always parse through Zod, never cast
    const message = parseChildMessage(event.data);
    if (!message) {
      console.warn('[BuildMode] Invalid message format, ignoring');
      return;
    }

    // Now safely use typed message
    switch (message.type) {
      case 'BUILD_MODE_READY':
        handleReady();
        break;
      case 'BUILD_MODE_SECTION_EDIT':
        handleEdit(message.data);
        break;
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

### Common PostMessage Mistakes

```typescript
// BAD: Casting without validation (P2-1 issue)
const message = event.data as BuildModeChildMessage;

// BAD: No origin check
const handleMessage = (event: MessageEvent) => {
  const message = parseChildMessage(event.data);
  // Missing origin validation!
};

// BAD: Partial validation
if (event.data.type === 'BUILD_MODE_READY') {
  // Trusting type field without full validation
}
```

---

## Before Building Draft Systems

### Draft System Consistency Checklist

- [ ] **Document what goes to draft vs live** (create decision table)
- [ ] **All write operations target same destination** (draft OR live, not mixed)
- [ ] **Add optimistic locking** for concurrent edit scenarios
- [ ] **Authenticate all draft preview URLs**
- [ ] **Provide publish and discard operations**

### Draft vs Live Decision Table

| Data Type             | Destination | Reason                               |
| --------------------- | ----------- | ------------------------------------ |
| Section content       | Draft       | Content needs preview before publish |
| Section order         | Draft       | Structural change needs verification |
| Page enabled/disabled | Draft       | Affects navigation, needs preview    |
| **Brand colors**      | **Draft**   | Visual change affects entire site    |
| **Font family**       | **Draft**   | Visual change affects entire site    |
| **Logo URL**          | **Draft**   | Visual change needs preview          |

**Key Rule:** If it affects how the site looks, it goes to draft.

### Branding Fix Pattern

```typescript
// WRONG: Branding goes directly to live
registerProposalExecutor('update_storefront_branding', async (tenantId, payload) => {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      primaryColor: payload.primaryColor, // Goes live immediately!
    },
  });
});

// CORRECT: Branding goes to draft like everything else
registerProposalExecutor('update_storefront_branding', async (tenantId, payload) => {
  const { pages } = await getDraftConfig(prisma, tenantId);

  // Store branding in draft config alongside pages
  const draftConfig: LandingPageConfig = {
    pages,
    branding: {
      primaryColor: payload.primaryColor,
      secondaryColor: payload.secondaryColor,
      // ...
    },
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      landingPageConfigDraft: draftConfig as unknown as Prisma.JsonObject,
    },
  });
});
```

### Optimistic Locking Pattern

```typescript
// Add version field to draft config
interface DraftConfig {
  version: number; // Increment on each save
  pages: PagesConfig;
  branding?: BrandingConfig;
}

// Check version before applying changes
async function updateDraft(
  prisma: PrismaClient,
  tenantId: string,
  expectedVersion: number,
  updater: (config: DraftConfig) => DraftConfig
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { landingPageConfigDraft: true },
  });

  const current = tenant?.landingPageConfigDraft as unknown as DraftConfig;

  if (current?.version !== expectedVersion) {
    throw new ConcurrencyError(
      `Draft was modified. Expected version ${expectedVersion}, found ${current?.version}. Please refresh and retry.`
    );
  }

  const updated = updater(current);
  updated.version = expectedVersion + 1;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      landingPageConfigDraft: updated as unknown as Prisma.JsonObject,
    },
  });
}
```

### Draft Preview Authentication

```typescript
// apps/web/src/app/t/[slug]/page.tsx
export default async function StorefrontPage({
  params,
  searchParams
}: Props) {
  const isPreviewMode = searchParams?.preview === 'draft';

  if (isPreviewMode) {
    // SECURITY: Draft preview requires authentication
    const session = await getServerSession(authConfig);

    if (!session?.user) {
      // Not logged in - redirect to login
      redirect(`/login?callbackUrl=/t/${params.slug}?preview=draft`);
    }

    // Verify user owns this tenant
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant || tenant.ownerId !== session.user.id) {
      // User doesn't own this tenant
      notFound();
    }

    // Load draft config
    const config = await getDraftConfig(tenant.id);
    return <StorefrontRenderer config={config} />;
  }

  // Public view - load live config
  const config = await getLiveConfig(params.slug);
  return <StorefrontRenderer config={config} />;
}
```

---

## Test Requirements

### Minimum Coverage Requirements

| Component            | Coverage | Critical Tests                     |
| -------------------- | -------- | ---------------------------------- |
| Agent tools          | 80%      | All trust tier behaviors           |
| Executors            | 80%      | Payload validation, state changes  |
| PostMessage handlers | 90%      | Origin validation, schema parsing  |
| Draft system         | 80%      | Publish, discard, concurrent edits |

### Agent Tool Test Template

```typescript
// server/test/agent/tools/storefront-tools.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updatePageSectionTool } from '../../../src/agent/tools/storefront-tools';
import { createMockToolContext } from '../../helpers/mock-tool-context';

describe('updatePageSectionTool', () => {
  let mockContext: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    mockContext = createMockToolContext();
  });

  describe('input validation', () => {
    it('should reject invalid pageName', async () => {
      const result = await updatePageSectionTool.execute(mockContext, {
        pageName: 'invalid-page',
        sectionType: 'hero',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should reject invalid sectionType', async () => {
      const result = await updatePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionType: 'not-a-real-type',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('trust tier behavior', () => {
    it('should return T2 proposal for content updates', async () => {
      const result = await updatePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionType: 'hero',
        headline: 'New Headline',
      });

      expect(result.success).toBe(true);
      expect(result.trustTier).toBe('T2');
      expect(result.requiresApproval).toBe(false); // T2 soft-confirms
    });
  });

  describe('tenant isolation', () => {
    it('should only access current tenant data', async () => {
      await updatePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionType: 'hero',
      });

      // Verify all queries included tenantId
      expect(mockContext.prisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockContext.tenantId },
        })
      );
    });
  });
});
```

### Executor Test Template

```typescript
// server/test/agent/executors/storefront-executors.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { registerStorefrontExecutors } from '../../../src/agent/executors/storefront-executors';
import { getProposalExecutor } from '../../../src/agent/proposals/executor-registry';
import { createTestPrisma } from '../../helpers/test-prisma';
import { createTestTenant } from '../../helpers/test-tenant';

describe('storefront executors', () => {
  let prisma: ReturnType<typeof createTestPrisma>;

  beforeEach(() => {
    prisma = createTestPrisma();
    registerStorefrontExecutors(prisma);
  });

  describe('update_page_section executor', () => {
    it('should validate payload strictly', async () => {
      const executor = getProposalExecutor('update_page_section');
      const { tenantId } = await createTestTenant(prisma);

      await expect(executor(tenantId, { invalid: 'payload' })).rejects.toThrow('Invalid payload');
    });

    it('should append section when sectionIndex is -1', async () => {
      const executor = getProposalExecutor('update_page_section');
      const { tenantId } = await createTestTenant(prisma, {
        landingPageConfigDraft: {
          pages: {
            home: { enabled: true, sections: [{ type: 'hero' }] },
          },
        },
      });

      await executor(tenantId, {
        pageName: 'home',
        sectionIndex: -1,
        sectionData: { type: 'text', content: 'New section' },
      });

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { landingPageConfigDraft: true },
      });

      const draft = tenant!.landingPageConfigDraft as any;
      expect(draft.pages.home.sections).toHaveLength(2);
    });
  });
});
```

### PostMessage Test Template

```typescript
// apps/web/src/components/build-mode/__tests__/BuildModePreview.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BuildModePreview } from '../BuildModePreview';

describe('BuildModePreview', () => {
  let messageHandler: (event: MessageEvent) => void;

  beforeEach(() => {
    // Capture the message handler
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'message') {
        messageHandler = handler as (event: MessageEvent) => void;
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('origin validation', () => {
    it('should ignore messages from different origin', async () => {
      const onSectionSelect = vi.fn();

      render(
        <BuildModePreview
          tenantSlug="test"
          currentPage="home"
          draftConfig={null}
          onSectionSelect={onSectionSelect}
        />
      );

      // Simulate message from different origin
      messageHandler({
        origin: 'https://malicious.com',
        data: {
          type: 'BUILD_MODE_SECTION_SELECTED',
          data: { pageId: 'home', sectionIndex: 0 },
        },
      } as MessageEvent);

      expect(onSectionSelect).not.toHaveBeenCalled();
    });

    it('should process messages from same origin', async () => {
      const onSectionSelect = vi.fn();

      render(
        <BuildModePreview
          tenantSlug="test"
          currentPage="home"
          draftConfig={null}
          onSectionSelect={onSectionSelect}
        />
      );

      // Simulate message from same origin
      messageHandler({
        origin: window.location.origin,
        data: {
          type: 'BUILD_MODE_SECTION_SELECTED',
          data: { pageId: 'home', sectionIndex: 0 },
        },
      } as MessageEvent);

      await waitFor(() => {
        expect(onSectionSelect).toHaveBeenCalledWith('home', 0);
      });
    });
  });

  describe('message validation', () => {
    it('should ignore malformed messages', async () => {
      const onSectionSelect = vi.fn();

      render(
        <BuildModePreview
          tenantSlug="test"
          currentPage="home"
          draftConfig={null}
          onSectionSelect={onSectionSelect}
        />
      );

      // Simulate malformed message
      messageHandler({
        origin: window.location.origin,
        data: { type: 'UNKNOWN_TYPE' },
      } as MessageEvent);

      expect(onSectionSelect).not.toHaveBeenCalled();
    });
  });
});
```

### Concurrent Edit Test

```typescript
// server/test/integration/build-mode-concurrency.test.ts
import { describe, it, expect } from 'vitest';

describe('build mode concurrency', () => {
  it('should handle concurrent section edits', async () => {
    const { tenantId, apiClient } = await createTestTenantWithClient();

    // Start with initial draft
    await apiClient.initializeDraft(tenantId);

    // Simulate two concurrent edits
    const edit1 = apiClient.updateSection(tenantId, {
      pageName: 'home',
      sectionIndex: 0,
      headline: 'Edit from User A',
      expectedVersion: 1,
    });

    const edit2 = apiClient.updateSection(tenantId, {
      pageName: 'home',
      sectionIndex: 0,
      headline: 'Edit from User B',
      expectedVersion: 1, // Same version - conflict
    });

    const results = await Promise.allSettled([edit1, edit2]);

    // One should succeed, one should fail with conflict
    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason.message).toContain('version');
  });
});
```

---

## Performance Pattern

### N+1 Query Prevention

```typescript
// BAD: Multiple queries per executor (P2-3 issue)
async function executor(tenantId: string, payload: any) {
  const tenant = await prisma.tenant.findUnique({ ... }); // Query 1
  const draft = await getDraftConfig(prisma, tenantId);   // Query 2
  const slug = await getTenantSlug(prisma, tenantId);     // Query 3
  // ...
  await prisma.tenant.update({ ... });                    // Query 4
}

// GOOD: Single query with all needed fields
async function executor(tenantId: string, payload: any) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      slug: true,
      landingPageConfig: true,
      landingPageConfigDraft: true,
    },
  });

  if (!tenant) throw new ResourceNotFoundError('tenant', tenantId);

  // Use data from single query
  const draft = tenant.landingPageConfigDraft || tenant.landingPageConfig;
  const slug = tenant.slug;

  // Single update
  await prisma.tenant.update({ ... });
}
```

---

## Quick Reference Card

Print this and keep near your workspace:

```
BUILD MODE PREVENTION QUICK REFERENCE
=====================================

BEFORE WRITING TOOLS:
[ ] List ALL UI actions
[ ] Create tool for EACH action
[ ] Include publish_draft, discard_draft, get_draft
[ ] Define trust tiers (T1=auto, T2=soft, T3=explicit)
[ ] Put schemas in @macon/contracts

BEFORE POSTMESSAGE:
[ ] Zod schema for EVERY message type
[ ] parseChildMessage() returns typed | null
[ ] if (origin !== window.location.origin) return;
[ ] NEVER: event.data as SomeType

BEFORE DRAFT SYSTEM:
[ ] ALL visual changes → draft (including branding!)
[ ] Add optimistic locking (version field)
[ ] Auth required for ?preview=draft
[ ] publish_draft, discard_draft tools exist

TESTING:
[ ] 80% coverage on tools/executors
[ ] Origin validation tests
[ ] Schema parsing tests
[ ] Concurrent edit tests
```

---

## Related Documentation

- [Chatbot Proposal Execution Flow](../logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md) - T2 execution patterns
- [Circular Dependency Executor Registry](./circular-dependency-executor-registry-MAIS-20251229.md) - Registry pattern
- [MAIS Critical Patterns](./mais-critical-patterns.md) - Multi-tenant isolation

---

**Last Updated:** 2026-01-05
**Maintainer:** Auto-generated from code review findings
