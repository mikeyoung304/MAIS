# fix: Build Mode Preview Not Updating With Changes

**Status:** Ready for Implementation
**Priority:** P0 (Critical)
**Type:** Bug Fix
**Estimated Complexity:** High
**Date:** 2026-01-09

---

## Overview

Build Mode tool execution appears to work (agent shows tool pills, claims changes were made) but the preview iframe never updates. After "publishing", the public storefront still shows placeholder text like `[Hero Headline]`. This is the primary blocking issue for the onboarding flow.

---

## Problem Statement

### Observed Symptoms

1. **Preview Never Updates** - Agent calls `update_page_section`, preview shows `[Hero Headline]` placeholder
2. **Publish Has No Effect** - Agent announces "Your hero section is now live" but public storefront unchanged
3. **Tool Pills Show Success** - UI shows tools were called, no visible errors
4. **Progress Indicator Stuck** - Always shows "Getting Started (1/4)" despite completing phases

### Evidence from Playwright Testing

| Step | Action                       | Expected                          | Actual                                |
| ---- | ---------------------------- | --------------------------------- | ------------------------------------- |
| 8    | `update_page_section` called | Preview updates with new headline | Preview still shows `[Hero Headline]` |
| 9    | `publish_draft` called       | Public storefront shows changes   | Still shows `[Hero Headline]`         |
| 10   | View public `/t/slug`        | Shows configured content          | Shows placeholder text                |

**Test Report:** `docs/test-reports/ONBOARDING_FLOW_TEST_REPORT_20260109.md`

---

## Root Cause Analysis

### Issue 1: Preview Iframe Loads Published Data, Not Draft (P0)

**File:** `apps/web/src/app/t/[slug]/(site)/page.tsx`

The page component fetches from the public API which returns `landingPageConfig` (published), ignoring the `?preview=draft` query parameter:

```typescript
// page.tsx line 70
const data = await getTenantStorefrontData(slug);
// This calls /v1/public/tenants/:slug which returns PUBLISHED config only
```

**File:** `apps/web/src/lib/tenant.ts`

```typescript
// getTenantBySlug (line 247) - Only fetches published data
const url = `${API_URL}/v1/public/tenants/${encodeURIComponent(slug)}`;
// No parameter to request draft data
```

**The Result:** Build Mode sends `?preview=draft&edit=true` to the iframe, but the server-side rendering fetches published data and the client component receives it. PostMessage updates are received but applied on top of wrong baseline.

### Issue 2: No Draft Endpoint for Storefront Preview (P0)

**Current State:**

- Draft is stored in `tenant.landingPageConfigDraft` (database)
- Published is in `tenant.landingPageConfig`
- There's NO public endpoint that returns draft data for preview

**Expected:** When `?preview=draft` is set, fetch from `/v1/tenant-admin/landing-page/draft` (authenticated) and render that instead.

### Issue 3: Cache Invalidation Missing After Publish (P1)

**File:** `server/src/agent/executors/storefront-executors.ts`

After `publish_draft` executor runs, there's no call to revalidate the Next.js ISR cache:

```typescript
// publish_draft executor - missing cache invalidation
// ISR has 60-second cache, users see stale data
```

### Issue 4: T2/T3 Proposal Deferred Execution UX (P2)

Users don't understand the proposal system:

- T2 tools (like `update_page_section`) create PENDING proposals
- Proposals only confirm on the user's NEXT message
- No visual indicator that changes are "pending"

### Issue 5: Dual-Mode Orchestrator Consistency (P1)

**Evidence:** During testing, agent used admin-style instructions during onboarding phase.

**Possible Cause:** `buildSystemPrompt()` may not be checking `isOnboardingMode` consistently with `getTools()`.

---

## Architecture Understanding

### How Build Mode Preview SHOULD Work

```
┌─────────────────────────────────────────────────────────────────────┐
│  Build Mode Page (/tenant/build)                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐    ┌────────────────────────────────────┐  │
│  │  Build Mode Chat    │    │  Preview Iframe                    │  │
│  │                     │    │  /t/{slug}?preview=draft&edit=true │  │
│  │  [User types]       │    │                                    │  │
│  │  "Change headline"  │    │  ┌────────────────────────────┐   │  │
│  │                     │───▶│  │  Should show DRAFT data    │   │  │
│  │  [Agent responds]   │    │  │  Currently shows PUBLISHED │   │  │
│  │  "Done! Updated."   │    │  └────────────────────────────┘   │  │
│  │                     │    │                                    │  │
│  │  [Tool: update_     │───▶│  PostMessage: CONFIG_UPDATE       │  │
│  │   page_section]     │    │  (but baseline is wrong!)         │  │
│  │                     │    │                                    │  │
│  └─────────────────────┘    └────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow Problem

```
Current:
1. Page SSR fetches /v1/public/tenants/:slug → returns PUBLISHED config
2. TenantLandingPageClient receives PUBLISHED data
3. PostMessage sends UPDATE with new section data
4. Client applies UPDATE to PUBLISHED baseline = partial/wrong result

Correct:
1. Page SSR detects ?preview=draft
2. Fetch draft config (authenticated internal API)
3. TenantLandingPageClient receives DRAFT data
4. PostMessage sends UPDATE
5. Client applies UPDATE to DRAFT baseline = correct preview
```

---

## Proposed Solution

### Phase 1: Enable Draft Data for Preview (Critical)

**Goal:** When `?preview=draft` is present, render from draft config instead of published.

#### Task 1.1: Add Internal Draft Fetch Function

**File:** `apps/web/src/lib/tenant.ts`

```typescript
/**
 * Fetch tenant draft config for Build Mode preview
 *
 * This is called when ?preview=draft is in the URL.
 * Uses the tenant-admin API which requires authentication.
 *
 * @param slug - Tenant slug
 * @param sessionToken - User's session token for auth
 * @returns Draft landing page config
 */
export async function getTenantDraftConfig(
  slug: string,
  sessionToken: string
): Promise<LandingPageConfig | null> {
  const url = `${API_URL}/v1/tenant-admin/landing-page/draft`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    cache: 'no-store', // Drafts change frequently
  });

  if (!response.ok) {
    return null; // Fall back to published
  }

  const data = await response.json();
  return data.draftConfig;
}
```

#### Task 1.2: Modify Page to Check Preview Mode

**File:** `apps/web/src/app/t/[slug]/(site)/page.tsx`

```typescript
interface TenantPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; edit?: string }>;
}

export default async function TenantPage({ params, searchParams }: TenantPageProps) {
  const { slug } = await params;
  const { preview, edit } = await searchParams;

  const isPreviewMode = preview === 'draft' && edit === 'true';

  try {
    const data = await getTenantStorefrontData(slug);

    // If in preview mode, try to fetch draft config
    if (isPreviewMode) {
      const session = await getServerSession(authOptions);
      if (session?.backendToken) {
        const draftConfig = await getTenantDraftConfig(slug, session.backendToken);
        if (draftConfig) {
          // Merge draft config into tenant data
          data.tenant = {
            ...data.tenant,
            branding: {
              ...data.tenant.branding,
              landingPage: draftConfig,
            },
          };
        }
      }
    }

    return (
      <>
        <script type="application/ld+json" ... />
        <TenantLandingPageClient data={data} basePath={`/t/${slug}`} />
      </>
    );
  } catch (error) {
    // ... error handling
  }
}
```

#### Task 1.3: Disable ISR for Preview Mode

**File:** `apps/web/src/app/t/[slug]/(site)/page.tsx`

```typescript
// Dynamic route segment config based on searchParams
export async function generateMetadata({
  params,
  searchParams,
}: TenantPageProps): Promise<Metadata> {
  const { preview } = await searchParams;

  // Disable ISR for preview mode
  if (preview === 'draft') {
    return {
      // ... metadata
      other: {
        'x-revalidate': 'false', // Signal to disable caching
      },
    };
  }

  // ... normal metadata
}

// Make the page dynamic when preview param is present
export const dynamic = 'auto';
export const dynamicParams = true;
```

### Phase 2: Add Cache Invalidation After Publish (P1)

**Goal:** Clear ISR cache when content is published so users see changes immediately.

#### Task 2.1: Add Revalidation Endpoint

**File:** `apps/web/src/app/api/revalidate/route.ts`

```typescript
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Revalidate endpoint for cache busting after publish
 * Called by the Express API after publish_draft executes
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');

  // Validate secret to prevent abuse
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  const body = await request.json();
  const { slug, paths } = body;

  if (!slug) {
    return NextResponse.json({ error: 'Slug required' }, { status: 400 });
  }

  // Revalidate all tenant pages
  const pathsToRevalidate = paths || [
    `/t/${slug}`,
    `/t/${slug}/about`,
    `/t/${slug}/services`,
    `/t/${slug}/gallery`,
    `/t/${slug}/faq`,
    `/t/${slug}/contact`,
    `/t/${slug}/testimonials`,
  ];

  for (const path of pathsToRevalidate) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true, paths: pathsToRevalidate });
}
```

#### Task 2.2: Call Revalidation from Executor

**File:** `server/src/agent/executors/storefront-executors.ts`

```typescript
// In publish_draft executor, after publishing to database
async function publishDraftExecutor(tenantId: string, payload: unknown) {
  // ... existing publish logic ...

  // Trigger cache invalidation
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });

  if (tenant?.slug) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_URL}/api/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': process.env.REVALIDATE_SECRET!,
        },
        body: JSON.stringify({ slug: tenant.slug }),
      });

      logger.info({ tenantId, slug: tenant.slug }, 'ISR cache revalidated after publish');
    } catch (error) {
      logger.warn({ tenantId, error }, 'Failed to revalidate ISR cache');
      // Non-blocking - content will eventually refresh via TTL
    }
  }

  return { success: true };
}
```

### Phase 3: Fix Dual-Mode Orchestrator Consistency (P1)

**Goal:** Ensure all mode-dependent methods check isOnboardingMode.

#### Task 3.1: Add Centralized Mode Check

**File:** `server/src/agent/orchestrator/base-orchestrator.ts`

```typescript
/**
 * Check if onboarding mode is active.
 * Must be called consistently by ALL mode-dependent methods.
 */
protected async isOnboardingActive(): Promise<boolean> {
  const tenant = await this.getTenant();
  const activePhases = ['NOT_STARTED', 'DISCOVERY', 'MARKET_RESEARCH', 'SERVICES', 'MARKETING'];
  return activePhases.includes(tenant.onboardingPhase);
}

// Every mode-aware method must call this
async getTools(): Promise<Tool[]> {
  if (await this.isOnboardingActive()) {
    return this.getOnboardingTools();
  }
  return this.getAdminTools();
}

async buildSystemPrompt(): Promise<string> {
  if (await this.isOnboardingActive()) {
    return buildOnboardingSystemPrompt(/* ... */);
  }
  return buildAdminSystemPrompt(/* ... */);
}

async getGreeting(): Promise<string> {
  if (await this.isOnboardingActive()) {
    return this.getOnboardingGreeting();
  }
  return this.getAdminGreeting();
}
```

### Phase 4: Improve Proposal Execution Visibility (P2)

**Goal:** Help users understand deferred execution.

#### Task 4.1: Add "Pending Changes" Indicator

**File:** `apps/web/src/components/build-mode/BuildModeHeader.tsx`

```typescript
// Show when T2 proposals are pending
{pendingProposals.length > 0 && (
  <div className="flex items-center gap-2 text-amber-600">
    <ClockIcon className="h-4 w-4" />
    <span className="text-sm">
      {pendingProposals.length} pending change{pendingProposals.length > 1 ? 's' : ''}
    </span>
    <span className="text-xs text-neutral-500">
      (confirm with your next message)
    </span>
  </div>
)}
```

#### Task 4.2: Extend T2 Window for Onboarding

Already documented in `plans/fix-t2-onboarding-proposal-execution.md` - extend from 2 to 10 minutes for onboarding flows.

---

## Files to Modify

| File                                                 | Changes                                          |
| ---------------------------------------------------- | ------------------------------------------------ |
| `apps/web/src/app/t/[slug]/(site)/page.tsx`          | Add searchParams, fetch draft when preview=draft |
| `apps/web/src/lib/tenant.ts`                         | Add `getTenantDraftConfig()` function            |
| `apps/web/src/app/api/revalidate/route.ts`           | New file - cache invalidation endpoint           |
| `server/src/agent/executors/storefront-executors.ts` | Add revalidation call after publish              |
| `server/src/agent/orchestrator/base-orchestrator.ts` | Centralize mode checking                         |
| `.env.example`                                       | Add REVALIDATE_SECRET                            |

---

## Acceptance Criteria

### Functional Requirements

- [ ] Preview iframe shows draft content when `?preview=draft` is set
- [ ] Changes made via `update_page_section` appear in preview within 2 seconds
- [ ] Published changes appear on public storefront immediately (no 60s wait)
- [ ] Onboarding agent uses correct system prompt for current phase

### Non-Functional Requirements

- [ ] No security vulnerabilities (draft access requires authentication)
- [ ] Preview mode doesn't affect public site caching
- [ ] Revalidation failures are non-blocking (logged, not thrown)

### Quality Gates

- [ ] Existing storefront tests pass
- [ ] Manual E2E: Complete onboarding flow, verify preview updates
- [ ] Manual E2E: Publish content, verify immediate visibility on public site

---

## Testing Plan

### Manual E2E Test Flow

1. Create new tenant via `/signup`
2. Navigate to Build Mode (`/tenant/build`)
3. Verify preview iframe shows current draft (or published if no draft)
4. Send message: "Change my headline to 'Welcome to My Business'"
5. Verify preview updates within 2 seconds
6. Click Publish button
7. Open public storefront in new tab
8. Verify headline shows "Welcome to My Business" immediately

### Unit Tests

```typescript
describe('getTenantDraftConfig', () => {
  it('returns draft config when authenticated', async () => {
    // Mock authenticated session
    // Call getTenantDraftConfig
    // Verify draft config returned
  });

  it('returns null when unauthenticated', async () => {
    // No session
    // Call getTenantDraftConfig
    // Verify null returned
  });
});
```

---

## Rollback Plan

If issues arise:

1. Remove `searchParams` check from page.tsx (revert to always using published)
2. Disable revalidation endpoint
3. Issues are contained - public storefront continues working

---

## Related Documentation

- [Test Report](../docs/test-reports/ONBOARDING_FLOW_TEST_REPORT_20260109.md) - Evidence of bugs
- [Build Mode Patterns](../docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md)
- [Dual Mode Orchestrator Prevention](../docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_PREVENTION.md)
- [T2 Proposal Execution Fix](./fix-t2-onboarding-proposal-execution.md)
- [Chatbot Proposal Execution Flow](../docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)

---

## Key Insights

`★ Insight ─────────────────────────────────────`

1. **Preview mode needs different data sources** - The same component serves two purposes (public viewing vs editing preview) but was only wired to one data source. This is a common oversight in "mode" features where the mode flag exists but doesn't actually change behavior.

2. **ISR and real-time editing conflict** - Incremental Static Regeneration is great for public performance but actively works against real-time editing. Solution: bypass ISR for preview mode and invalidate caches after writes.

3. **Deferred execution needs visibility** - T2 soft-confirm is invisible to users. They say "change this" and expect it changed NOW. Either make execution immediate (which may not be safe) or make the pending state visible.

4. **Test the full loop, not just endpoints** - Tools may work, API may return success, but if the client never receives the update, users see nothing. Playwright testing caught this when unit tests would not have.

`─────────────────────────────────────────────────`

---

**Author:** Claude Code
**Created:** 2026-01-09
**Last Updated:** 2026-01-09
