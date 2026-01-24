# Fix: AI Agent Storefront Update System

**Created:** 2026-01-10
**Priority:** P1 (Critical - User-facing feature broken)
**Type:** Bug Fix + Architecture Consolidation
**Reviewed By:** 6 Specialized Agents (DHH, TypeScript, Simplicity, AI Architect, Security, Observability)

---

## Executive Summary

The AI agent on the tenant dashboard **claims** to update the storefront but **fails silently**. Additionally, switching dashboard tabs causes the agent to **lose conversation context**. After extensive multi-agent investigation with 6 specialized reviewers + targeted research, we found:

| Finding                                                                    | Severity        | Phase |
| -------------------------------------------------------------------------- | --------------- | ----- |
| Executor writes to `landingPageConfig` instead of `landingPageConfigDraft` | **P0 Critical** | 1     |
| Frontend discards session history on component remount                     | **P1 High**     | 1.7   |
| Duplicate implementations (onboarding vs storefront tools)                 | **P1 High**     | 1     |
| Missing Zod validation schema for `update_storefront`                      | P2 Medium       | 1     |
| T2 soft-confirm regex is fragile and bypassable                            | P2 Medium       | 2     |
| Missing agent kill switch                                                  | P2 Medium       | 2     |
| No version history for rollback                                            | P3 Low          | 3     |

**Good News:** The backend already implements unified sessions correctly. The "context loss" is a frontend bug where `useAgentChat.ts` ignores existing message history and shows only the greeting on remount.

---

## Review Synthesis

### Verdicts from 6 Reviewers

| Reviewer                     | Verdict              | Key Concern                                                                |
| ---------------------------- | -------------------- | -------------------------------------------------------------------------- |
| **DHH (Architecture)**       | REQUEST_CHANGES      | "Patching one executor when two exist guarantees future bugs"              |
| **TypeScript Architect**     | REQUEST_CHANGES      | "Missing Zod schema, unsafe type assertions, no unit test for draft field" |
| **Simplicity**               | APPROVE_WITH_CHANGES | "6-line fix is sufficient for P1; consolidation is P2"                     |
| **AI Agent Architect**       | APPROVE_WITH_CHANGES | "Foundation is solid; tool consolidation and T2 modernization needed"      |
| **Security Specialist**      | APPROVE_WITH_CHANGES | "T2 soft-confirm is highest risk; add kill switch before production scale" |
| **Observability Specialist** | APPROVE_WITH_CHANGES | "Tracing is excellent; add kill switch and Claude API latency metrics"     |

### Consensus Decision

**The reviewers are SPLIT on scope:**

- **Simplicity says:** Fix the bug (6 lines), consolidate later
- **DHH says:** Consolidate NOW or institutionalize the disease
- **Everyone agrees:** The bug diagnosis is correct, fix is straightforward

**Resolution:** We will implement a **phased approach** where Phase 1 fixes the critical bug AND extracts shared logic (DHH's requirement), but defers full tool deprecation to Phase 2.

---

## Root Cause Analysis

**File:** `server/src/agent/executors/onboarding-executors.ts`

```typescript
// Line 192-195 - WRONG READ
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { landingPageConfig: true },  // ❌ Should be landingPageConfigDraft
});

// Line 228 - WRONG WRITE
tenantUpdates.landingPageConfig = { ... } // ❌ Should be landingPageConfigDraft
```

**Correct Pattern (from storefront-executors.ts:101):**

```typescript
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    landingPageConfigDraft: draftConfig as unknown as Prisma.JsonObject, // ✅
  },
});
```

---

## Implementation Plan

### Phase 1: Critical Bug Fix + Shared Service (This Sprint)

**Goal:** Fix the bug AND prevent future divergence by extracting shared logic.

#### Step 1.1: Add Missing Validation Schema (15 min)

**File:** `server/src/agent/proposals/executor-schemas.ts`

```typescript
// Add alongside other schemas
export const UpdateStorefrontPayloadSchema = z
  .object({
    headline: z.string().max(200).optional(),
    tagline: z.string().max(300).optional(),
    brandVoice: z
      .enum(['professional', 'friendly', 'luxurious', 'approachable', 'bold'])
      .optional(),
    heroImageUrl: z.string().url().optional(),
    primaryColor: HexColorSchema.optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

// Add to registry
export const executorSchemaRegistry: Record<string, z.ZodSchema> = {
  // ... existing entries
  update_storefront: UpdateStorefrontPayloadSchema,
};
```

#### Step 1.2: Extract Shared Draft Update Service (45 min)

**New File:** `server/src/agent/services/draft-update.service.ts`

```typescript
import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { hashTenantStorefront } from '../../lib/advisory-locks';
import { getDraftConfigWithSlug } from '../tools/utils';
import { ResourceNotFoundError } from '../errors';
import type { LandingPageConfig, PagesConfig, Section, PageName } from '@macon/contracts';
import { logger } from '../../lib/core/logger';

// Transaction configuration (shared across all storefront operations)
export const STOREFRONT_TRANSACTION_CONFIG = {
  timeout: 5000,
  isolationLevel: 'ReadCommitted' as const,
};

export interface DraftUpdateResult {
  action: 'created' | 'updated';
  updatedFields: string[];
  previewUrl?: string;
  hasDraft: true;
}

export class DraftUpdateService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Update hero section in draft config
   * Used by both onboarding and storefront tools
   */
  async updateHeroSection(
    tenantId: string,
    updates: {
      headline?: string;
      tagline?: string;
      heroImageUrl?: string;
    }
  ): Promise<DraftUpdateResult> {
    return this.prisma.$transaction(async (tx) => {
      // P1-FIX: Acquire advisory lock
      const lockId = hashTenantStorefront(tenantId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

      // P1-FIX: Get DRAFT config (not live)
      const { pages, slug } = await getDraftConfigWithSlug(tx, tenantId);

      // Find or create home page
      const homePage = pages.home || { enabled: true, sections: [] };
      const sections = [...(homePage.sections || [])];

      // Find hero section
      const heroIndex = sections.findIndex((s) => s.type === 'hero');
      const updatedFields: string[] = [];

      if (heroIndex >= 0) {
        // Update existing hero
        const currentHero = sections[heroIndex];
        sections[heroIndex] = {
          ...currentHero,
          ...(updates.headline && { headline: updates.headline }),
          ...(updates.tagline && { subheadline: updates.tagline }),
          ...(updates.heroImageUrl && { backgroundImageUrl: updates.heroImageUrl }),
        } as Section;
      } else {
        // Create hero section
        sections.unshift({
          id: 'home-hero-main',
          type: 'hero',
          headline: updates.headline || '[Hero Headline]',
          subheadline: updates.tagline || '[Hero Subheadline]',
          ctaText: '[CTA Button Text]',
          ...(updates.heroImageUrl && { backgroundImageUrl: updates.heroImageUrl }),
        } as Section);
      }

      // Track what was updated
      if (updates.headline) updatedFields.push('headline');
      if (updates.tagline) updatedFields.push('tagline');
      if (updates.heroImageUrl) updatedFields.push('heroImageUrl');

      // P1-FIX: Write to DRAFT config
      const updatedConfig: LandingPageConfig = {
        pages: {
          ...pages,
          home: { ...homePage, sections },
        } as PagesConfig,
      };

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          landingPageConfigDraft: updatedConfig as unknown as Prisma.JsonObject,
        },
      });

      logger.info(
        { tenantId, updatedFields, source: 'DraftUpdateService' },
        'Hero section updated'
      );

      return {
        action: heroIndex >= 0 ? 'updated' : 'created',
        updatedFields,
        previewUrl: slug ? `/t/${slug}?preview=draft` : undefined,
        hasDraft: true,
      };
    }, STOREFRONT_TRANSACTION_CONFIG);
  }

  /**
   * Update branding (NOT part of draft system - applies immediately)
   */
  async updateBranding(
    tenantId: string,
    updates: {
      primaryColor?: string;
      brandVoice?: string;
    }
  ): Promise<{ updatedFields: string[] }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { branding: true },
    });

    if (!tenant) {
      throw new ResourceNotFoundError('tenant', tenantId, 'Please contact support.');
    }

    const brandingUpdates: Prisma.TenantUpdateInput = {};
    const updatedFields: string[] = [];

    if (updates.primaryColor) {
      brandingUpdates.primaryColor = updates.primaryColor;
      updatedFields.push('primaryColor');
    }

    if (updates.brandVoice) {
      const currentBranding = (tenant.branding as Record<string, unknown>) || {};
      brandingUpdates.branding = {
        ...currentBranding,
        voice: updates.brandVoice,
      } as Prisma.JsonObject;
      updatedFields.push('brandVoice');
    }

    if (Object.keys(brandingUpdates).length > 0) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: brandingUpdates,
      });
    }

    return { updatedFields };
  }
}
```

#### Step 1.3: Refactor Executor to Use Shared Service (30 min)

**File:** `server/src/agent/executors/onboarding-executors.ts`

Replace lines 172-287 with:

```typescript
import { DraftUpdateService } from '../services/draft-update.service';
import { UpdateStorefrontPayloadSchema } from '../proposals/executor-schemas';
import { ValidationError, ResourceNotFoundError } from '../errors';

// ... inside registerOnboardingExecutors()

registerProposalExecutor('update_storefront', async (tenantId, payload) => {
  // P0: Validate payload against strict schema (TypeScript reviewer requirement)
  const validationResult = UpdateStorefrontPayloadSchema.safeParse(payload);
  if (!validationResult.success) {
    throw new ValidationError(
      `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
    );
  }

  const { headline, tagline, brandVoice, heroImageUrl, primaryColor } = validationResult.data;

  // Use shared service (DHH requirement: single source of truth)
  const draftService = new DraftUpdateService(prisma);

  const allUpdatedFields: string[] = [];

  // Update hero section in draft
  if (headline || tagline || heroImageUrl) {
    const result = await draftService.updateHeroSection(tenantId, {
      headline,
      tagline,
      heroImageUrl,
    });
    allUpdatedFields.push(...result.updatedFields);
  }

  // Update branding (applies immediately, not part of draft)
  if (primaryColor || brandVoice) {
    const result = await draftService.updateBranding(tenantId, {
      primaryColor,
      brandVoice,
    });
    allUpdatedFields.push(...result.updatedFields);
  }

  // Get preview URL
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });

  logger.info({ tenantId, updatedFields: allUpdatedFields }, 'Storefront updated via onboarding');

  return {
    action: 'updated',
    updatedFields: allUpdatedFields,
    previewUrl: tenant?.slug ? `/t/${tenant.slug}?preview=draft` : undefined,
    hasDraft: true, // Signal for frontend cache invalidation
  };
});
```

#### Step 1.4: Add Unit Tests (30 min)

**File:** `server/test/agent/services/draft-update.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DraftUpdateService } from '../../../src/agent/services/draft-update.service';
import { createMockPrismaClient } from '../../helpers/prisma-mock';

describe('DraftUpdateService', () => {
  let service: DraftUpdateService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = new DraftUpdateService(mockPrisma);
  });

  describe('updateHeroSection', () => {
    it('should write to landingPageConfigDraft, NOT landingPageConfig', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        slug: 'test-tenant',
        landingPageConfigDraft: null,
      });
      mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
      mockPrisma.$executeRaw.mockResolvedValue(null);

      // Act
      await service.updateHeroSection('tenant-1', { headline: 'New Headline' });

      // Assert
      const updateCall = mockPrisma.tenant.update.mock.calls[0][0];

      // CRITICAL: Verify we're writing to DRAFT, not LIVE
      expect(updateCall.data).toHaveProperty('landingPageConfigDraft');
      expect(updateCall.data).not.toHaveProperty('landingPageConfig');

      // Verify the draft has the new headline
      const draft = updateCall.data.landingPageConfigDraft as Record<string, unknown>;
      expect(draft.pages.home.sections[0].headline).toBe('New Headline');
    });

    it('should acquire advisory lock before reading draft', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        slug: 'test-tenant',
        landingPageConfigDraft: null,
      });
      mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
      mockPrisma.$executeRaw.mockResolvedValue(null);

      await service.updateHeroSection('tenant-1', { headline: 'Test' });

      // Verify advisory lock was acquired
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
      const lockCall = mockPrisma.$executeRaw.mock.calls[0];
      expect(lockCall[0].strings.join('')).toContain('pg_advisory_xact_lock');
    });

    it('should return hasDraft: true for frontend cache invalidation', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        slug: 'test-tenant',
        landingPageConfigDraft: null,
      });
      mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
      mockPrisma.$executeRaw.mockResolvedValue(null);

      const result = await service.updateHeroSection('tenant-1', { headline: 'Test' });

      expect(result.hasDraft).toBe(true);
    });

    it('should include preview URL with ?preview=draft suffix', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        slug: 'test-tenant',
        landingPageConfigDraft: null,
      });
      mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
      mockPrisma.$executeRaw.mockResolvedValue(null);

      const result = await service.updateHeroSection('tenant-1', { headline: 'Test' });

      expect(result.previewUrl).toBe('/t/test-tenant?preview=draft');
    });
  });
});
```

**Update Existing Test:** `server/test/agent/executors/onboarding-executors.test.ts`

```typescript
// Line 543-551: Change assertion from landingPageConfig to landingPageConfigDraft
it('should write to landingPageConfigDraft not landingPageConfig', async () => {
  // ... existing setup ...

  const updateCall = mockPrisma.tenant.update.mock.calls[0][0];

  // CRITICAL: This test ensures the bug never regresses
  expect(updateCall.data).toHaveProperty('landingPageConfigDraft');
  expect(updateCall.data).not.toHaveProperty('landingPageConfig');
});
```

#### Step 1.5: Add E2E Test (45 min)

**File:** `e2e/tests/agent-storefront-update.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { withAuth } from '../fixtures/auth.fixture';

test.describe('Agent Storefront Update', () => {
  test('agent update_storefront writes to draft and updates preview', async ({ page }) => {
    await withAuth(page, async ({ tenantId, slug }) => {
      // 1. Navigate to dashboard with preview
      await page.goto('/tenant/dashboard?showPreview=true');
      await page.waitForSelector('[data-testid="preview-iframe"]', { timeout: 10000 });

      // 2. Wait for hydration
      await page.waitForTimeout(500);

      // 3. Send message requesting headline update
      const input = page.locator('[data-testid="agent-chat-input"]');
      await input.fill('Update my hero headline to "E2E Test Headline"');
      await input.press('Enter');

      // 4. Wait for agent response
      await page.waitForResponse(
        (resp) => resp.url().includes('/api/agent/chat') && resp.status() === 200,
        { timeout: 30000 }
      );

      // 5. Wait for draft config refresh
      await page.waitForResponse((resp) => resp.url().includes('/api/tenant/draft'), {
        timeout: 5000,
      });

      // 6. Verify preview shows new headline
      const iframe = page.frameLocator('[data-testid="preview-iframe"]');
      await expect(iframe.locator('h1, [data-section-type="hero"] h1')).toContainText(
        'E2E Test Headline',
        { timeout: 10000 }
      );

      // 7. Verify database has draft (not live)
      const draftCheck = await page.evaluate(async () => {
        const resp = await fetch('/api/tenant/draft');
        return resp.json();
      });

      expect(draftCheck.pages?.home?.sections?.[0]?.headline).toBe('E2E Test Headline');

      // 8. Verify live config was NOT modified
      const liveCheck = await page.evaluate(async (s) => {
        const resp = await fetch(`/api/public/tenant/${s}`);
        return resp.json();
      }, slug);

      // Live config should still have original headline (not the test one)
      expect(liveCheck.landingPageConfig?.pages?.home?.sections?.[0]?.headline).not.toBe(
        'E2E Test Headline'
      );
    });
  });
});
```

#### Step 1.6: Add Prevention Checklist (10 min)

**File:** `docs/solutions/patterns/STOREFRONT_DRAFT_SYSTEM_CHECKLIST.md`

```markdown
# Storefront Draft System Checklist

## Before Merging Code That Touches Tenant Landing Page Configuration

- [ ] Am I **reading** from `landingPageConfigDraft`? (not `landingPageConfig`)
- [ ] Am I **writing** to `landingPageConfigDraft`? (not `landingPageConfig`)
- [ ] Am I using `DraftUpdateService` for hero/section updates? (DRY)
- [ ] Am I returning `hasDraft: true` after draft writes?
- [ ] Is there a unit test asserting the correct field name?
- [ ] Does the preview URL include `?preview=draft`?

## Exceptions

- `publish_draft` executor: Reads draft, writes to live (intentional)
- `update_storefront_branding`: Branding applies immediately (documented)

## Root Cause of 2026-01-10 Bug

The `update_storefront` executor in `onboarding-executors.ts` wrote to `landingPageConfig` (live) instead of `landingPageConfigDraft` (draft). The preview system reads from draft, so changes appeared to fail silently.

See: `plans/fix-agent-storefront-update-system.md`
```

---

### Phase 2: Tool Consolidation + Security Hardening (Next Sprint)

#### Step 2.1: Deprecate `update_storefront` Tool

The onboarding orchestrator should use `update_page_section` with mode awareness instead of a separate tool.

#### Step 2.2: Add Agent Kill Switch (Security Requirement)

```typescript
// server/src/agent/middleware/kill-switch.ts
export async function checkAgentKillSwitch(tenantId: string): Promise<boolean> {
  const globalKill = await redis.get('agent:kill_switch:global');
  if (globalKill === 'true') return true;

  const tenantKill = await redis.get(`agent:kill_switch:tenant:${tenantId}`);
  return tenantKill === 'true';
}
```

#### Step 2.3: Replace T2 Soft-Confirm Regex with UI Buttons

Instead of inferring confirmation from natural language, add explicit UI buttons.

---

### Phase 3: Enterprise Hardening (Future)

- Version history for config rollback
- Claude API latency metrics
- Per-tenant cost aggregation
- Session replay capability

---

## Verification Checklist

### Backend Fix (Phase 1.1-1.6)

- [ ] `update_storefront` reads from `landingPageConfigDraft`
- [ ] `update_storefront` writes to `landingPageConfigDraft`
- [ ] Advisory lock prevents TOCTOU race conditions
- [ ] Preview URL includes `?preview=draft`
- [ ] `hasDraft: true` returned for cache invalidation
- [ ] Zod schema validates executor payload
- [ ] Unit test verifies correct field name
- [ ] E2E test verifies agent→preview flow
- [ ] Existing tests still pass
- [ ] Manual test: Agent updates headline → preview shows change

### Agent Unification (Phase 1.7)

- [ ] Switching tabs does NOT reset chat history
- [ ] Same session ID maintained across tab changes
- [ ] Messages persist through React component remount
- [ ] Agent has context of previous conversation on tab switch
- [ ] Onboarding mode tools still available during onboarding phase
- [ ] Admin mode tools available after onboarding complete
- [ ] No duplicate session creation on tab navigation

---

## Key Files Changed

### Backend Fix (Phase 1.1-1.6)

| File                                                           | Change                   |
| -------------------------------------------------------------- | ------------------------ |
| `server/src/agent/services/draft-update.service.ts`            | **NEW** - Shared service |
| `server/src/agent/executors/onboarding-executors.ts`           | Refactor to use service  |
| `server/src/agent/proposals/executor-schemas.ts`               | Add validation schema    |
| `server/test/agent/services/draft-update.service.test.ts`      | **NEW** - Unit tests     |
| `server/test/agent/executors/onboarding-executors.test.ts`     | Update assertions        |
| `e2e/tests/agent-storefront-update.spec.ts`                    | **NEW** - E2E test       |
| `docs/solutions/patterns/STOREFRONT_DRAFT_SYSTEM_CHECKLIST.md` | **NEW** - Prevention     |

### Agent Unification (Phase 1.7)

| File                                           | Change                                      |
| ---------------------------------------------- | ------------------------------------------- |
| `apps/web/src/hooks/useAgentChat.ts`           | Load history on mount instead of discarding |
| `apps/web/src/stores/agent-session-store.ts`   | **NEW** - Persist sessionId across routes   |
| `apps/web/src/components/agent/AgentPanel.tsx` | Use session store for continuity            |

---

## Risk Assessment

| Risk                               | Mitigation                                      |
| ---------------------------------- | ----------------------------------------------- |
| Breaking existing onboarding       | Same data, different field; tests verify        |
| Shared service introduces coupling | Service is focused, single responsibility       |
| Cache invalidation timing          | `hasDraft: true` flag explicit, not inferred    |
| TOCTOU race conditions             | Advisory lock pattern from storefront-executors |

---

---

## Agent Unification Research (Added 2026-01-10)

### Problem Statement

The user reported that switching tabs in the tenant dashboard causes the agent to "lose context" and appear to operate with different prompts. The expected behavior is **ONE unified agent per tenant** that maintains conversation continuity regardless of which dashboard tab is active.

### Research Findings

#### 1. Backend Is Already Unified ✅

Contrary to initial assumptions, the **backend correctly maintains a single session per tenant**:

- Sessions scoped by `(tenantId + sessionType)` - one ADMIN session per tenant
- `getOrCreateSession()` finds existing session within TTL (24 hours)
- Same session returned regardless of which tab/panel initiated the request
- Mode switching (onboarding vs admin) uses AsyncLocalStorage for dynamic behavior

**Evidence:** `server/src/agent/orchestrator/base-orchestrator.ts:432-520`

#### 2. Root Cause: Frontend Discards History 🐛

The actual bug is in `useAgentChat.ts`:

```typescript
// apps/web/src/hooks/useAgentChat.ts:224-231
// BUG: Only adds greeting, ignores existing messages!
const greeting = initialGreeting || data.greeting || fallbackGreeting;
setMessages([
  {
    role: 'assistant',
    content: greeting,
    timestamp: new Date(), // ❌ Discards full history from backend
  },
]);
```

When users navigate between tabs:

1. React remounts components (Next.js App Router treats routes as separate trees)
2. `useAgentChat` re-initializes, calling `GET /api/agent/session`
3. Backend returns SAME session with full history
4. Frontend **ignores history**, shows only greeting

#### 3. 2026 Industry Best Practices

| Practice                               | Description                                                     | Source                    |
| -------------------------------------- | --------------------------------------------------------------- | ------------------------- |
| **Single Thread + Context Injection**  | One conversation per user, dynamic system prompt per view       | Cursor, GitHub Copilot    |
| **Model Context Protocol (MCP)**       | Standard for context sharing adopted by OpenAI/Google/Anthropic | Wikipedia, Red Hat        |
| **Stateless Agent + Stateful Thread**  | Agent instances reusable; thread maintains history              | Microsoft Agent Framework |
| **Persona Switching > Mode Switching** | Same thread, different "voice" based on task                    | Vanderbilt Research       |

**Key Insight:** Industry has moved from "multiple specialized assistants" to "one unified agent with dynamic context" - this preserves conversation continuity while allowing context-appropriate behavior.

#### 4. Current vs. Recommended Architecture

| Aspect                   | Current State         | 2026 Recommendation                 |
| ------------------------ | --------------------- | ----------------------------------- |
| Backend session          | ✅ Unified per tenant | ✅ Already correct                  |
| Frontend history loading | ❌ Discarded on mount | Load from session                   |
| View-aware context       | ✅ AsyncLocalStorage  | ✅ Already correct                  |
| Message persistence      | ❌ React state only   | TanStack Query or Zustand           |
| Greeting message         | ❌ Overwrites history | Show history OR contextual greeting |

### Implementation Plan: Session Continuity (Phase 1.7)

#### Step 1.7.1: Load History on Mount (30 min)

**File:** `apps/web/src/hooks/useAgentChat.ts`

```typescript
// In initializeChat(), replace lines 224-231 with:

// Fetch session with history
const sessionResponse = await fetch(`${apiUrl}/session`, {
  headers: { Authorization: `Bearer ${token}` },
});
const sessionData = await sessionResponse.json();

// Load existing messages OR show greeting
if (sessionData.messages && sessionData.messages.length > 0) {
  // Session has history - load it
  setMessages(
    sessionData.messages.map((m: { role: string; content: string; timestamp?: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }))
  );

  // Add contextual "Welcome back" message if appropriate
  if (showWelcomeBack) {
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: getContextualWelcomeBack(currentView),
        timestamp: new Date(),
      },
    ]);
  }
} else {
  // New session - show greeting
  const greeting = initialGreeting || sessionData.greeting || fallbackGreeting;
  setMessages([
    {
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
    },
  ]);
}

setSessionId(sessionData.sessionId);
```

#### Step 1.7.2: Add Session History Endpoint (20 min)

The endpoint already exists at `/v1/agent/session/:sessionId/history`. Ensure it's properly utilized.

#### Step 1.7.3: Persist Session ID Across Routes (15 min)

**Option A: Zustand Store (Recommended)**

```typescript
// apps/web/src/stores/agent-session-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AgentSessionStore {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
}

export const useAgentSessionStore = create<AgentSessionStore>()(
  persist(
    (set) => ({
      sessionId: null,
      setSessionId: (id) => set({ sessionId: id }),
    }),
    { name: 'agent-session' }
  )
);
```

**Option B: TanStack Query Cache**

```typescript
// Use staleTime to persist session across route changes
const { data: session } = useQuery({
  queryKey: ['agentSession', tenantId],
  queryFn: fetchSession,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

#### Step 1.7.4: View-Aware Contextual Messages (10 min)

Instead of losing context, inject view-specific notes when user switches tabs:

```typescript
function getContextualNote(fromView: string, toView: string): string | null {
  if (fromView === 'dashboard' && toView === 'branding') {
    return "I see you've switched to branding settings. I can help you update colors, logos, and brand voice here too.";
  }
  return null; // No note needed for most transitions
}
```

### Verification Checklist (Agent Unification)

- [ ] Switching tabs does NOT reset chat history
- [ ] Same session ID maintained across tab changes
- [ ] Messages persist through React component remount
- [ ] Agent has context of previous conversation on tab switch
- [ ] Onboarding mode tools still available during onboarding phase
- [ ] Admin mode tools available after onboarding complete
- [ ] No duplicate session creation on tab navigation

### Files Changed (Agent Unification)

| File                                           | Change                      |
| ---------------------------------------------- | --------------------------- |
| `apps/web/src/hooks/useAgentChat.ts`           | Load history on mount       |
| `apps/web/src/stores/agent-session-store.ts`   | **NEW** - Persist sessionId |
| `apps/web/src/components/agent/AgentPanel.tsx` | Use session store           |

---

## References

### From Reviewers

- DHH: "Convention over configuration - ONE canonical way to update draft config"
- TypeScript: "Add Zod validation schema to executor-schemas.ts"
- Simplicity: "Fix BOTH read and write - both are wrong"
- AI Architect: "Consolidate related operations per Anthropic guidance"
- Security: "Add kill switch before production scale"
- Observability: "Tracing infrastructure is excellent"

### External Sources

- [Anthropic: Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Vercel AI SDK Human-in-the-Loop](https://sdk.vercel.ai/cookbook/next/75-human-in-the-loop)
- [LangGraph Interrupt Pattern](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/wait-user-input/)
- [Model Context Protocol](https://en.wikipedia.org/wiki/Model_Context_Protocol) - 2026 standard for AI context sharing
- [Microsoft Agent Framework](https://learn.microsoft.com/en-us/agent-framework/user-guide/agents/multi-turn-conversation) - Stateless agent, stateful thread pattern
- [Vercel Chat SDK](https://vercel.com/blog/introducing-chat-sdk) - Message persistence patterns

### Prevention Strategies

- `docs/solutions/patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md`
- `docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md`
