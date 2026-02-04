---
title: 'fix: Build Mode AI Agent Onboarding Flow & Real-Time Preview'
type: fix
date: 2026-02-02
priority: P1
estimated_effort: 1-2 days (revised down from 2-3 after review)
reviewers: DHH, Kieran (TypeScript), Code Simplicity
review_date: 2026-02-02
---

# Build Mode AI Agent - Onboarding Flow & Real-Time Preview Fixes

## Overview

The Build Mode dashboard allows tenants to edit their storefront via conversation with an AI agent. Testing revealed several issues preventing the agent from successfully guiding tenants to a live, bookable website.

**Product Vision:** Complete 0→1 activation where tenant ends with:

1. Website sections filled out (Hero, About, Services, FAQ, Testimonials, Contact)
2. Services defined with real pricing (Package records)
3. Stripe Connect for payments
4. Google Calendar for availability
5. **End state:** Live website taking real bookings

## Issues Summary

| Priority | Issue                                     | Root Cause                               | Files Affected                                            |
| -------- | ----------------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| P1       | FAQ/Testimonials not appearing in preview | Missing Zod validation at boundary       | `internal-agent.routes.ts`                                |
| P1       | Section tabs navigate to live site        | Missing PostMessage scroll protocol      | `PreviewPanel.tsx`, `protocol.ts`, `BuildModeWrapper.tsx` |
| P2       | Agent asks known questions                | forbiddenSlots not logged/debugged       | `system.ts`, `vertex-agent.service.ts`                    |
| P2       | Agent doesn't continue flow               | LLM behavior issue                       | `system.ts` (minimal changes)                             |
| P2       | Progress indicator stuck at "1/4"         | Phase computed on frontend, not reactive | `useOnboardingState.ts`                                   |
| P3       | No Stripe/Calendar guidance               | Premature - defer                        | (deferred)                                                |

## Related Context

- **Brainstorm:** `docs/brainstorms/2026-02-01-realtime-storefront-preview-brainstorm.md`
- **Pitfalls:** #30 (cache race), #88 (fact-to-storefront), #90 (dashboardAction), #91 (forbiddenSlots), #92 (code drift)
- **Solutions:** `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`

---

## Reviewer Feedback Summary (2026-02-02)

Three reviewers analyzed this plan in parallel. Key changes incorporated:

### Consensus Decisions

| Topic                | Original Plan           | Revised Approach                                 |
| -------------------- | ----------------------- | ------------------------------------------------ |
| Section validation   | 50-line switch-case     | Use existing `validateBlockContent()` (~5 lines) |
| Phase storage        | Store in database       | Compute as pure function (no stored column)      |
| Scroll target typing | Overloaded `page` param | Discriminated union `ScrollTarget`               |
| 100ms delay          | Scattered `setTimeout`  | Encapsulated utility function                    |
| Phase 3              | Day 3 implementation    | **DEFERRED** - no users at this stage yet        |

### Key Additions Required

1. **ts-rest contracts** - Add route definitions to `packages/contracts/`
2. **PostMessage schema format** - Match existing `z.object({ type: z.literal(...) })` pattern
3. **Logging before prompt changes** - Verify forbiddenSlots is being sent correctly
4. **Error types** - Define `OnboardingError` interface

### Estimated LOC Reduction

| Phase     | Original | Revised | Reduction       |
| --------- | -------- | ------- | --------------- |
| Phase 1   | ~170     | ~100    | 41%             |
| Phase 2   | ~190     | ~50     | 74%             |
| Phase 3   | ~125     | 0       | 100% (deferred) |
| **Total** | ~485     | ~150    | **69%**         |

---

## Phase 1: P1 Fixes - Preview Updates & Navigation (Day 1)

### 1.1 Fix Section Content Validation

**Problem:** Agent says "Updated FAQ ✓" but content doesn't appear because validation is missing.

**Files:**

- `server/src/routes/internal-agent.routes.ts` (lines 1310-1337)

**REVISED: Use Existing Infrastructure**

The contracts already have `validateBlockContent()` in `packages/contracts/src/schemas/section-content.schema.ts` (lines 251-257). Don't write a new switch-case.

**Current Code (Broken):**

```typescript
// internal-agent.routes.ts ~line 1325
const newSection = { id, type, ...content };
// Just spreads content - no validation, items[] may be malformed
```

**Fix (5 lines):**

```typescript
// internal-agent.routes.ts - in add-section/update-section handlers
import { validateBlockContent, BlockType } from '@macon/contracts';

// Validate at boundary (per Pitfall #70)
const blockType = sectionType.toUpperCase() as BlockType;
const validation = validateBlockContent(blockType, content);

if (!validation.success) {
  return res.status(400).json({
    success: false,
    error: `Invalid ${sectionType} content: ${validation.error.errors[0]?.message}`,
  });
}

const newSection = {
  id: `${pageName}-${sectionType}-${Date.now()}`,
  type: sectionType,
  ...validation.data, // Use validated data, not raw content
};
```

**Why this works:** `validateBlockContent()` already handles FAQ `items[]`, testimonials `items[]`, contact fields, etc. The schema knows the structure.

**Add ts-rest Contract:**

```typescript
// packages/contracts/src/routes/internal-agent.contract.ts

import { c } from '../client';
import { BlockTypeSchema, PageNameSchema } from '../schemas';

export const internalAgentContract = c.router({
  addSection: {
    method: 'POST',
    path: '/v1/internal/agent/storefront/add-section',
    body: z.object({
      tenantId: z.string().min(1),
      pageName: PageNameSchema,
      sectionType: BlockTypeSchema,
      content: z.unknown(), // Validated per-type in handler
      position: z.number().int().min(0).optional(),
    }),
    responses: {
      200: z.object({
        success: z.literal(true),
        sectionId: z.string(),
        page: PageNameSchema,
        hasDraft: z.literal(true),
      }),
      400: z.object({
        success: z.literal(false),
        error: z.string(),
      }),
    },
  },
});
```

**Tests:**

```typescript
// server/src/routes/__tests__/internal-agent.routes.test.ts
describe('POST /storefront/add-section', () => {
  it('creates FAQ section with items array', async () => {
    const response = await request(app)
      .post('/v1/internal/agent/storefront/add-section')
      .send({
        tenantId,
        pageName: 'home',
        sectionType: 'faq',
        content: {
          headline: 'FAQs',
          items: [
            { id: 'faq-1', question: 'Q1?', answer: 'A1' },
            { id: 'faq-2', question: 'Q2?', answer: 'A2' },
          ],
        },
      });

    expect(response.body.success).toBe(true);
    expect(response.body.section.items).toHaveLength(2);
  });

  it('rejects malformed FAQ content', async () => {
    const response = await request(app)
      .post('/v1/internal/agent/storefront/add-section')
      .send({
        tenantId,
        pageName: 'home',
        sectionType: 'faq',
        content: {
          headline: 'FAQs',
          items: 'not an array', // Invalid
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid faq content');
  });
});
```

### 1.2 Add SCROLL_TO_SECTION PostMessage Protocol

**Problem:** Clicking section tabs navigates to live site URL instead of scrolling within preview iframe.

**Files:**

- `apps/web/src/lib/build-mode/protocol.ts`
- `apps/web/src/components/preview/PreviewPanel.tsx`
- `apps/web/src/components/tenant/BuildModeWrapper.tsx`

**Step 1: Add protocol message type (match existing pattern)**

```typescript
// apps/web/src/lib/build-mode/protocol.ts

// Add new schema (after BuildModeHighlightSectionByIdSchema ~line 66)
// REVISED: Match existing z.object({ type: z.literal(...) }) pattern per Kieran's review
export const BuildModeScrollToSectionSchema = z.object({
  type: z.literal('BUILD_MODE_SCROLL_TO_SECTION'),
  data: z.object({
    sectionId: z.string().min(1).max(50),
    behavior: z.enum(['smooth', 'instant']).default('smooth'),
  }),
});

export type BuildModeScrollToSection = z.infer<typeof BuildModeScrollToSectionSchema>;

// Add to discriminated union
export const BuildModeParentMessageSchema = z.discriminatedUnion('type', [
  BuildModeInitSchema,
  BuildModeConfigUpdateSchema,
  BuildModeHighlightSectionSchema,
  BuildModeHighlightSectionByIdSchema,
  BuildModeScrollToSectionSchema, // ← Add here
  BuildModeClearHighlightSchema,
]);
```

**Step 2: Create typed navigation handler (per DHH/Kieran feedback)**

```typescript
// apps/web/src/lib/build-mode/navigation.ts (NEW FILE)

import type { PageName } from '@macon/contracts';

/**
 * Discriminated union for navigation targets.
 * Makes caller intent explicit - no overloaded parameters.
 */
export type ScrollTarget =
  | { type: 'page'; page: PageName }
  | { type: 'section'; sectionId: string };

/**
 * Encapsulates cache invalidation delay (Pitfall #30).
 * Document the delay in one place, not scattered throughout code.
 */
export async function invalidateWithCacheBuffer(
  queryClient: QueryClient,
  queryKey: QueryKey
): Promise<void> {
  // 100ms delay for cache consistency (see Pitfall #30)
  await new Promise((resolve) => setTimeout(resolve, 100));
  await queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
}
```

**Step 3: Send scroll message from PreviewPanel**

```typescript
// apps/web/src/components/preview/PreviewPanel.tsx

import { ScrollTarget, invalidateWithCacheBuffer } from '@/lib/build-mode/navigation';

// Add scroll function (~line 270)
const scrollToSection = useCallback(
  (sectionId: string) => {
    if (!isIframeReady || !iframeRef.current?.contentWindow) {
      console.warn('[PreviewPanel] Cannot scroll - iframe not ready');
      return;
    }

    const message: BuildModeScrollToSection = {
      type: 'BUILD_MODE_SCROLL_TO_SECTION',
      data: { sectionId, behavior: 'smooth' },
    };
    iframeRef.current.contentWindow.postMessage(message, window.location.origin);
  },
  [isIframeReady]
);

// REVISED: Use discriminated union for clarity
const handleNavigation = useCallback(
  (target: ScrollTarget) => {
    switch (target.type) {
      case 'page':
        agentUIActions.setPreviewPage(target.page);
        break;
      case 'section':
        scrollToSection(target.sectionId);
        break;
    }
  },
  [scrollToSection]
);

// Update tab click handler to dispatch correct type
const handleTabClick = (tabId: string) => {
  const isPage = ['home', 'services', 'about', 'contact'].includes(tabId);

  if (isPage) {
    handleNavigation({ type: 'page', page: tabId as PageName });
  } else {
    // It's a section within the current page
    handleNavigation({ type: 'section', sectionId: `${currentPage}-${tabId}-primary` });
  }
};

// Wire up dashboardAction scroll handling
useEffect(() => {
  if (highlightedSectionId) {
    scrollToSection(highlightedSectionId);
  }
}, [highlightedSectionId, scrollToSection]);
```

**Step 4: Handle scroll message in BuildModeWrapper**

```typescript
// apps/web/src/components/tenant/BuildModeWrapper.tsx

// In the message handler useEffect (~line 45)
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;

    // Parse with schema for type safety
    const parseResult = BuildModeParentMessageSchema.safeParse(event.data);
    if (!parseResult.success) return;

    const message = parseResult.data;

    switch (message.type) {
      case 'BUILD_MODE_SCROLL_TO_SECTION': {
        const { sectionId, behavior } = message.data;
        const element = document.querySelector(`[data-section-id="${sectionId}"]`);

        if (element) {
          element.scrollIntoView({
            behavior: behavior ?? 'smooth',
            block: 'start',
          });
          // Add temporary highlight
          element.classList.add('build-mode-scroll-target');
          setTimeout(() => {
            element.classList.remove('build-mode-scroll-target');
          }, 2000);
        } else {
          console.warn(`[BuildModeWrapper] Section not found: ${sectionId}`);
          // REVISED: Send failure message back to parent (per Kieran's feedback)
          window.parent.postMessage(
            {
              type: 'BUILD_MODE_SCROLL_FAILED',
              data: { sectionId, reason: 'Section not found' },
            },
            window.location.origin
          );
        }
        break;
      }
      case 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID':
        // Existing highlight logic
        break;
      // ... other cases
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

**Step 5: Add CSS for scroll target highlight**

```css
/* apps/web/src/styles/build-mode.css */

/* REVISED: Verify --sage-rgb exists or use fallback (per DHH's review) */
.build-mode-scroll-target {
  animation: scroll-highlight 2s ease-out;
}

@keyframes scroll-highlight {
  0% {
    box-shadow: 0 0 0 4px hsl(var(--sage) / 0.5);
  }
  100% {
    box-shadow: 0 0 0 0px hsl(var(--sage) / 0);
  }
}
```

**Tests:**

```typescript
// e2e/tests/build-mode-scroll.spec.ts
test('section tab scrolls within iframe, does not reload', async ({ page }) => {
  await page.goto('/dashboard/website');

  // Wait for preview iframe
  const iframe = page.frameLocator('[data-testid="preview-iframe"]');
  await iframe.locator('[data-section-id="home-hero-primary"]').waitFor();

  // Click FAQ tab
  await page.click('[data-testid="section-tab-faq"]');

  // Verify no navigation (same URL)
  await expect(page).toHaveURL(/\/dashboard\/website/);

  // Verify FAQ section is in viewport
  const faqSection = iframe.locator('[data-section-id="home-faq-primary"]');
  await expect(faqSection).toBeInViewport();
});

// ADDED: Negative test per Kieran's feedback
test('scroll to non-existent section logs warning', async ({ page }) => {
  await page.goto('/dashboard/website');

  // Listen for console warnings
  const warnings: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'warning') warnings.push(msg.text());
  });

  // Trigger scroll to non-existent section via direct postMessage
  await page.evaluate(() => {
    const iframe = document.querySelector('[data-testid="preview-iframe"]') as HTMLIFrameElement;
    iframe?.contentWindow?.postMessage(
      {
        type: 'BUILD_MODE_SCROLL_TO_SECTION',
        data: { sectionId: 'nonexistent-section' },
      },
      window.location.origin
    );
  });

  await page.waitForTimeout(500);
  expect(warnings.some((w) => w.includes('Section not found'))).toBe(true);
});
```

### 1.3 Fix dashboardAction Extraction

**Problem:** Per Pitfall #90, dashboardAction is returned but not always extracted properly.

**File:** `apps/web/src/components/agent/AgentPanel.tsx`

**Fix:**

```typescript
// apps/web/src/components/agent/AgentPanel.tsx

import { invalidateWithCacheBuffer } from '@/lib/build-mode/navigation';

// In handleConciergeToolComplete
case 'SCROLL_TO_SECTION':
  // Handle both sectionId and blockType patterns
  const targetSectionId = action.sectionId
    ?? (action.blockType ? `home-${action.blockType}-primary` : null);

  if (targetSectionId) {
    // REVISED: Use utility function (per DHH's review)
    await invalidateWithCacheBuffer(queryClient, getDraftConfigQueryKey());
    agentUIActions.highlightSection(targetSectionId);
  } else {
    console.warn('[AgentPanel] SCROLL_TO_SECTION missing sectionId and blockType');
  }
  break;
```

---

## Phase 2: P2 Fixes - Agent Intelligence (Day 1-2)

### REVISED APPROACH

Per the Code Simplicity review, we should **add logging first** before making prompt changes. The issue may be that forbiddenSlots isn't being populated correctly, not that the prompt is too weak.

### 2.1 Add Logging to Diagnose forbiddenSlots

**Files:**

- `server/src/services/vertex-agent.service.ts`

**Add Logging First:**

```typescript
// server/src/services/vertex-agent.service.ts
async createSession(tenantId: string): Promise<SessionResult> {
  const bootstrap = await this.contextBuilder.getBootstrapData(tenantId);

  // CRITICAL: Log for debugging (Pitfall #91)
  logger.info('[VertexAgent] Session created', {
    tenantId,
    forbiddenSlots: bootstrap.forbiddenSlots,
    forbiddenSlotsCount: bootstrap.forbiddenSlots?.length ?? 0,
    knownFactsKeys: Object.keys(bootstrap.discoveryFacts ?? {}),
  });

  // ... rest of session creation
}
```

**Verification Step:** After deploying, check Cloud Run logs for `forbiddenSlots` array. If it's empty when it shouldn't be, the bug is in `context-builder.service.ts`, not the prompt.

### 2.2 Minimal Prompt Improvement (If Logging Shows Data Is Correct)

**File:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

**REVISED: Move rule to TOP of prompt, keep it brief (~10 lines, not 60)**

```typescript
// server/src/agent-v2/deploy/tenant/src/prompts/system.ts

// Add at the VERY TOP of the prompt, before identity section
const ABSOLUTE_RULES = `
## Absolute Rules (Check EVERY Turn)

1. Check \`forbiddenSlots\` BEFORE any discovery question
2. If slot is forbidden, DO NOT ask - acknowledge what you know instead

| Forbidden Key | Never Ask |
|---------------|-----------|
| businessType | "What do you do?", "What kind of business?" |
| location | "Where are you located?" |
| targetAudience | "Who's your dream client?" |
| businessDescription | "Tell me about your business" |
| priceRange | "What do you charge?" |
`;

// Remove the verbose "Self-Check Before Responding" section - LLMs don't use checklists
```

### 2.3 Fix Progress Indicator (Computed, Not Stored)

**Problem:** Progress shows "1/4" throughout session despite completing sections.

**REVISED: Compute phase as pure function, don't store in database**

Per all three reviewers: phase is a pure function of existing data. Storing it adds complexity and sync issues.

**File:** `apps/web/src/hooks/useOnboardingState.ts`

```typescript
// apps/web/src/hooks/useOnboardingState.ts

export type OnboardingPhase =
  | 'DISCOVERY'
  | 'MARKET_RESEARCH'
  | 'SERVICES'
  | 'MARKETING'
  | 'COMPLETED';

/**
 * Pure function to compute phase from existing data.
 * No stored column = no race conditions, no sync issues.
 */
const computePhase = (
  draft: LandingPageConfig | null,
  tenant: { packages: Package[]; stripeAccountId?: string; calendarConnected?: boolean }
): OnboardingPhase => {
  const hasContent = (type: string): boolean => {
    const section = draft?.pages?.home?.sections?.find((s) => s.type === type);
    if (!section) return false;
    // Simple check: has any non-placeholder content
    const content = JSON.stringify(section);
    return !content.includes('[Your') && !content.includes('[Tell') && content.length > 50;
  };

  if (!hasContent('hero') || !hasContent('about')) return 'DISCOVERY';
  if (tenant.packages.length === 0) return 'MARKET_RESEARCH';
  if (!hasContent('faq') || !hasContent('testimonials')) return 'SERVICES';
  if (!tenant.stripeAccountId || !tenant.calendarConnected) return 'MARKETING';
  return 'COMPLETED';
};

export const useOnboardingState = (tenantId: string) => {
  const { data: draft } = useDraftConfig(tenantId);
  const { data: tenant } = useTenant(tenantId);

  // REVISED: Compute phase on every render, not stored
  const phase = useMemo(() => computePhase(draft, tenant ?? { packages: [] }), [draft, tenant]);

  const phaseNumber = useMemo(() => {
    const phases: OnboardingPhase[] = [
      'DISCOVERY',
      'MARKET_RESEARCH',
      'SERVICES',
      'MARKETING',
      'COMPLETED',
    ];
    return phases.indexOf(phase) + 1;
  }, [phase]);

  return {
    phase,
    phaseNumber,
    totalPhases: 4,
    progressPercent: (phaseNumber / 4) * 100,
  };
};
```

**Why this is better:**

1. No database column to update = no race conditions
2. Always consistent with current data
3. Automatically updates when sections complete
4. 20 lines vs 80 lines

---

## Phase 3: P3 - Integration Guidance

### DEFERRED

Per the Code Simplicity review: zero users are currently reaching post-completion because Phases 1-2 aren't working. Fix the foundation before building the penthouse.

**When to revisit:** After Phase 1 ships and we confirm users are completing website sections.

**Tracking:** Create todo for future implementation:

```
todos/817-pending-p3-post-completion-integration-guidance.md
```

---

## Acceptance Criteria

### P1: Preview Updates

- [ ] FAQ section updates appear in preview within 2 seconds
- [ ] Testimonials with items[] array render correctly
- [ ] Contact section fields (email, phone, address) display
- [ ] Section tabs scroll within iframe, don't reload page
- [ ] dashboardAction SCROLL_TO_SECTION handles missing sectionId gracefully
- [ ] Cache invalidation delay encapsulated in utility function (Pitfall #30)
- [ ] ts-rest contracts added for internal agent routes

### P2: Agent Intelligence

- [ ] forbiddenSlots logged at session creation for debugging
- [ ] Cloud Run logs show forbiddenSlots array with expected values
- [ ] If data correct: Minimal prompt rule at TOP of system prompt
- [ ] Progress indicator updates reactively when sections complete
- [ ] Phase computed on frontend, not stored in database

### P3: Integration Guidance (DEFERRED)

- [ ] Tracking todo created
- [ ] Will revisit after Phase 1-2 validation

---

## Testing Strategy

### Unit Tests

```bash
# Section validation
npm test -- server/src/routes/__tests__/internal-agent.routes.test.ts

# Phase computation (new)
npm test -- apps/web/src/hooks/__tests__/useOnboardingState.test.ts
```

### E2E Tests

```bash
# New test file
npm run test:e2e -- e2e/tests/build-mode-onboarding.spec.ts
```

**Key E2E Scenarios:**

1. FAQ items array update → preview shows items within 2s
2. Section tab click → scrolls within iframe, no navigation
3. Complete hero section → progress shows 2/4 (reactive)
4. Malformed content → 400 error with helpful message

### Manual Testing Checklist

```
[ ] Start as new tenant, go to Website tab
[ ] Say "Add FAQ with 3 questions"
[ ] Verify FAQ appears in preview
[ ] Click FAQ tab → verify scroll, not reload
[ ] Complete hero + about → verify progress shows 2/4 (no refresh needed)
[ ] Check Cloud Run logs → verify forbiddenSlots is populated
```

---

## Risk Analysis

| Risk                                    | Likelihood | Impact | Mitigation                                   |
| --------------------------------------- | ---------- | ------ | -------------------------------------------- |
| PostMessage scroll fails silently       | Medium     | High   | Console warnings + failure message to parent |
| Computed phase disagrees with stored    | N/A        | N/A    | No stored phase = no disagreement            |
| forbiddenSlots still empty              | Medium     | Medium | Logging will reveal root cause               |
| Cache race condition returns stale data | Medium     | High   | Encapsulated 100ms delay utility             |

---

## Rollback Plan

Each change is independently revertible:

1. **Validation fix:** Revert to `{ id, type, ...content }` (but data may be malformed)
2. **Scroll protocol:** Revert PostMessage changes (tabs will navigate)
3. **Computed phase:** Revert to stored column (if added back)

---

## Dependencies

- No external API changes required
- No database migrations (computed phase removes need)
- Agent prompt deployed via GitHub Actions workflow

---

## References

- Brainstorm: `docs/brainstorms/2026-02-01-realtime-storefront-preview-brainstorm.md`
- Pitfall #30: `docs/solutions/react-performance/AGENT-TOOL-CACHE-INVALIDATION-RACE-CONDITION.md`
- Pitfall #70: `docs/solutions/patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md`
- Pitfall #91: `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`
- Schema definitions: `packages/contracts/src/schemas/section-content.schema.ts`
- Existing validateBlockContent: lines 251-257 of section-content.schema.ts
- Agent prompt: `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
