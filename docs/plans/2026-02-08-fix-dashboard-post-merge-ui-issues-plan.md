---
title: 'fix: Dashboard Post-Merge UI Issues (13 Production Bugs)'
type: fix
date: 2026-02-08
reviewed: 2026-02-08 (5-agent review — kieran-typescript, code-simplicity, architecture-strategist, security-sentinel, data-integrity-guardian)
---

# fix: Dashboard Post-Merge UI Issues (13 Production Bugs)

## Overview

After merging the 4-phase dashboard rebuild (PR #41, commit `6f0f4f6f`), 13 production UI issues were observed at `gethandled.ai/tenant/dashboard`. The rebuild built new onboarding components (ComingSoon → Reveal → Guided Review → Publish) but didn't fully wire the **tenant lifecycle transitions** — specifically, pre-rebuild tenants and "graduated" tenants are stuck in onboarding mode with no sidebar.

**Root cause:** THREE methods in `context-builder.service.ts` use `tenant.onboardingPhase || 'NOT_STARTED'`. Pre-rebuild tenants have `onboardingPhase: null` → resolves to `'NOT_STARTED'` → `isOnboarding = true` → sidebar hidden, old onboarding UI shown, agent thinks tenant is new.

**Affected methods:**

- `getOnboardingState()` (line 448) — feeds frontend `useOnboardingState()` hook
- `getBootstrapData()` (line 400) — feeds agent at session start
- `build()` (line 328) — feeds full `AgentContext` to Cloud Run agents

## Problem Statement

The dashboard rebuild assumed all tenants would enter through the new onboarding flow. In reality:

1. **Existing tenants** with real content have `onboardingPhase: null` and `revealCompletedAt: null` (columns didn't exist pre-rebuild)
2. **The storefront iframe** renders nav, chat widget, and sticky CTA because the server layout has no edit mode awareness
3. **The agent prompt** asks returning users for permission to continue instead of resuming seamlessly
4. **Seed data** ($0 packages) persists alongside real content — existing deletion code filters by price only, not by name

## Design Decisions (Validated by 5-Agent Review)

| Decision                                                  | Verdict | Rationale                                                                                                                  |
| --------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| Runtime phase detection + lazy-write backfill             | YES     | Zero-downtime fix. Lazy-write eliminates perpetual query cost.                                                             |
| No new `'graduated'` ViewState                            | YES     | `preview` + sidebar visible IS graduated. Exhaustive `never` switch catches future additions at compile time.              |
| `useSearchParams()` client component for iframe isolation | YES     | Next.js 14 layouts do NOT receive `searchParams`. Options A (layout searchParams) and B (Referer sniffing) are both wrong. |
| Gate chrome suppression on JWT token + `edit=true`        | YES     | Prevents public degradation vector where attacker appends `?edit=true` to live storefront URL.                             |
| Use `OnboardingPhase` type from contracts, not `string`   | YES     | Type already exists with `parseOnboardingPhase()` helper. No reason to use `string`.                                       |

## Technical Approach

Ship as **one commit**. Test together, revert together. The original 4-batch structure added deployment complexity without independence (cross-batch dependencies invalidated the claim).

### Step 1: Backend — Fix phase detection in ALL THREE methods (`context-builder.service.ts`)

**File:** `server/src/services/context-builder.service.ts`

Extract a shared `resolveOnboardingPhase()` method. Call it from `getOnboardingState()`, `getBootstrapData()`, AND `build()`. This is the single most critical fix.

```typescript
import { OnboardingPhase, parseOnboardingPhase } from '@macon/contracts';

/**
 * Resolve the effective onboarding phase for a tenant.
 *
 * Waterfall logic:
 * 1. Explicit phase set in database → trust it
 * 2. onboardingCompletedAt set (old flow) → COMPLETED
 * 3. Has real content (pre-rebuild tenant) → COMPLETED + lazy-write backfill
 * 4. Truly new tenant → NOT_STARTED
 */
private resolveOnboardingPhase(
  tenant: {
    onboardingPhase: string | null;
    onboardingCompletedAt: Date | null;
  },
  hasRealContent: boolean
): OnboardingPhase {
  // 1. Explicit phase → trust it (uses Zod safeParse for type safety)
  if (tenant.onboardingPhase) {
    return parseOnboardingPhase(tenant.onboardingPhase);
  }
  // 2. Completed via old flow
  if (tenant.onboardingCompletedAt) return 'COMPLETED';
  // 3. Has real content (pre-rebuild tenant with real packages)
  if (hasRealContent) return 'COMPLETED';
  // 4. Truly new tenant
  return 'NOT_STARTED';
}
```

**CRITICAL: `hasNonPlaceholderContent()` must NOT count seed sections.**

Seed sections are created with `isDraft: false` at provisioning time (line 170 of `tenant-provisioning.service.ts`). Counting `sectionContent.count({ isDraft: false })` returns `true` for EVERY provisioned tenant — including brand-new tenants who have never spoken to the agent. This would cause new tenants to skip onboarding entirely.

**Enterprise-grade content detection:**

```typescript
/**
 * Detect if a tenant has real (non-seed) content.
 *
 * IMPORTANT: Cannot use sectionContent count — seed sections are created
 * as isDraft: false at provisioning time (tenant-provisioning.service.ts:170).
 * Every provisioned tenant has published sections regardless of content quality.
 *
 * Instead, check for signals that ONLY exist after real user interaction:
 * - Packages with basePrice > 0 (seed packages are always $0)
 * - onboardingCompletedAt is set (completed any onboarding flow)
 */
private async hasNonPlaceholderContent(tenantId: string): Promise<boolean> {
  const realPackageCount = await this.prisma.package.count({
    where: { tenantId, basePrice: { gt: 0 } },
  });
  return realPackageCount > 0;
}
```

**Why only packages, not sections?** Seed sections are noise — every tenant has them. Packages with `basePrice > 0` are the strongest signal of real tenant engagement because:

- Seed packages are always $0 (`tenant-defaults.ts:33,40,47`)
- The agent creates priced packages during onboarding
- A tenant who manually edited packages has clearly graduated

**Lazy-write backfill — eliminate perpetual query cost:**

After `resolveOnboardingPhase()` determines `COMPLETED` for a null-phase tenant, write it back so the heuristic only runs once per tenant:

```typescript
// In getOnboardingState(), getBootstrapData(), and build():
const effectivePhase = this.resolveOnboardingPhase(tenant, hasRealContent);

// Lazy backfill: set the phase permanently so heuristic becomes a no-op
if (effectivePhase === 'COMPLETED' && !tenant.onboardingPhase) {
  this.prisma.tenant
    .update({
      where: { id: tenantId },
      data: { onboardingPhase: 'COMPLETED', onboardingCompletedAt: new Date() },
    })
    .catch((err) =>
      logger.warn({ tenantId, err }, '[ContextBuilder] Lazy backfill failed — non-fatal')
    );
}
```

This is idempotent, non-blocking (fire-and-forget), and converts a perpetual per-load cost into a one-time cost per tenant.

**Also fix `revealCompleted` in `getBootstrapData()`:**

The plan must apply the `|| hasRealContent` fallback to `getBootstrapData()` at line 409, not just `getOnboardingState()`. Otherwise the agent receives `revealCompleted: false` while the frontend sees `true`, and the agent may trigger a reveal animation for a tenant with published content.

```typescript
// getOnboardingState() — line 452:
revealCompleted: tenant.revealCompletedAt !== null || hasRealContent,

// getBootstrapData() — line 409 (MUST MATCH):
revealCompleted: tenant.revealCompletedAt !== null || hasRealContent,
```

**Return type fix:** Change `getOnboardingState()` return type from `phase: string` to `phase: OnboardingPhase`. The type already exists in `packages/contracts/src/schemas/onboarding.schema.ts`.

**Verification:**

- [ ] `resolveOnboardingPhase()` called from ALL THREE methods (getOnboardingState, getBootstrapData, build)
- [ ] `hasNonPlaceholderContent()` does NOT count seed sections (uses package price only)
- [ ] Lazy-write fires for null-phase tenants resolved as COMPLETED
- [ ] `revealCompleted` fallback applied in BOTH getOnboardingState AND getBootstrapData
- [ ] Return types use `OnboardingPhase`, not `string`
- [ ] New tenant with only seed data → returns `NOT_STARTED` (onboarding flow starts)
- [ ] Pre-rebuild tenant with real packages → returns `COMPLETED` (sidebar shown)

---

### Step 2: Iframe isolation — `EditModeGate` client component (`apps/web/src/app/t/[slug]/(site)/`)

**IMPORTANT:** Next.js 14 App Router layouts do NOT receive `searchParams`. Only `page.tsx` components receive them. This is a fundamental constraint of the App Router caching model — layouts persist across navigations. The original plan's Option A (layout searchParams) would silently fail.

**Security concern:** `?edit=true` is publicly accessible. Anyone can append it to a storefront URL. Chrome suppression must be gated on BOTH `edit=true` AND a valid JWT preview token. The token is already part of the `buildPreviewUrl()` pattern in `apps/web/src/lib/preview-utils.ts`.

**Approach:** Create an `<EditModeGate>` client component that wraps the chrome elements in the layout.

**File:** `apps/web/src/components/tenant/EditModeGate.tsx` (new)

```typescript
'use client';

import { useSearchParams } from 'next/navigation';

interface EditModeGateProps {
  children: React.ReactNode;
}

/**
 * Suppresses storefront chrome (nav, chat, CTA, footer) when in edit mode.
 *
 * Gate: BOTH `?edit=true` AND `?token=<present>` AND inside an iframe.
 * - edit=true alone is not sufficient (public URL degradation vector)
 * - token presence confirms this is a legitimate preview from the dashboard
 * - iframe check confirms this is embedded, not a direct visit
 */
export function EditModeGate({ children }: EditModeGateProps) {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const hasToken = !!searchParams.get('token');
  const isInIframe = typeof window !== 'undefined' && window.parent !== window;

  // All three conditions must be true to suppress chrome
  if (isEditMode && hasToken && isInIframe) {
    return null;
  }

  return <>{children}</>;
}
```

**File:** `apps/web/src/app/t/[slug]/(site)/layout.tsx` (modify)

Wrap nav, footer, chat widget, and sticky CTA in `<EditModeGate>`:

```typescript
import { EditModeGate } from '@/components/tenant/EditModeGate';

// ... existing layout code ...

return (
  <div className="flex min-h-screen flex-col bg-surface">
    <EditModeGate>
      <TenantNav tenant={tenant} />
    </EditModeGate>

    <div className="flex-1">{children}</div>

    <EditModeGate>
      <TenantFooter tenant={tenant} />
    </EditModeGate>

    <EditModeGate>
      <TenantChatWidget
        tenantApiKey={tenant.apiKeyPublic}
        businessName={tenant.name}
        primaryColor={tenant.primaryColor}
        chatEnabled={tenant.chatEnabled}
      />
    </EditModeGate>

    <EditModeGate>
      <StickyMobileCTA
        ctaText={tenant.branding?.landingPage?.hero?.ctaText || 'View Packages'}
        href="#packages"
        observeElementId="main-content"
      />
    </EditModeGate>
  </div>
);
```

**Why `return null` instead of CSS hiding?** The `TenantChatWidget` creates an agent session when it **mounts** (Pitfall #5 from issues doc). CSS `display: none` does not prevent mount. Returning `null` prevents mount entirely — no session creation, no wasted resources.

**Why three conditions (edit + token + iframe)?**

- `edit=true` only: attacker appends to public URL → strips nav/chat from live storefront (M1 from security review)
- `edit=true` + `token`: slightly better, but direct visits with token should still show full storefront
- `edit=true` + `token` + `isInIframe`: only suppresses chrome when legitimately embedded by the dashboard. Direct visits always show full chrome.

**Build mode banner:** Remove the green banner in `BuildModeWrapper.tsx` (line 52-56) and its compensating `mt-10` spacing (line 59). Replace with a subtle 2px sage line:

```typescript
{isEditMode && (
  <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-sage/40" />
)}
```

**Verification:**

- [ ] Iframe preview (`?edit=true&token=JWT`): no TenantNav, no TenantChatWidget, no StickyMobileCTA, no TenantFooter
- [ ] Live storefront (no params): all chrome renders normally
- [ ] Public URL with `?edit=true` but no token: all chrome renders normally (security gate)
- [ ] `SCROLL_TO_SECTION` PostMessage still works (anchors preserved)
- [ ] No agent session created in iframe (TenantChatWidget not mounted)
- [ ] Build mode banner removed, replaced with thin sage indicator

---

### Step 3: Remove old onboarding UI (`AgentPanel.tsx`, `OnboardingProgress.tsx`)

**File:** `apps/web/src/components/agent/AgentPanel.tsx` (lines 74-112)

Remove the `OnboardingSection` component (local function, not exported) and its rendering. This component renders the OLD green dots progress tracker and "Skip setup" button. The NEW onboarding uses `ComingSoonDisplay` in `ContentArea`.

**Verified safe to delete:** Only 2 files reference these components:

- `AgentPanel.tsx` — defines and renders `OnboardingSection`
- `OnboardingProgress.tsx` — defines `OnboardingProgress`, imported only by `AgentPanel.tsx`

**File:** `apps/web/src/components/onboarding/OnboardingProgress.tsx` — delete entirely.

**Also clean up:** Remove orphan imports in `AgentPanel.tsx` (`ExternalLink`, `OnboardingProgress`).

**Skip functionality:** Preserve the `skipOnboarding` mutation. Add a minimal "Skip" text link in the agent panel header (not the old progress dots). This gives users an escape hatch without the heavy old UI.

**Verification:**

- [ ] No green dots or "Skip setup" button visible
- [ ] Skip onboarding still accessible via minimal text link
- [ ] `OnboardingProgress.tsx` deleted
- [ ] No orphan imports in `AgentPanel.tsx`
- [ ] Clean build passes: `rm -rf server/dist && npm run --workspace=apps/web typecheck`

---

### Step 4: Harden seed package deletion (`first-draft.ts`)

**Existing code at `first-draft.ts:178` already deletes $0 packages but filters by price only:**

```typescript
// CURRENT (too aggressive — deletes ALL $0 packages including legitimate free consultations)
const defaultPackages = packages.filter((pkg) => pkg.basePrice === 0);
```

**Fix: Add name filter using constants from `tenant-defaults.ts`.**

Since the Cloud Run agent has a separate build and cannot directly import from `server/src/lib/`, extract the seed package names:

```typescript
// Source of truth: server/src/lib/tenant-defaults.ts:28-50
// If these names ever change, update BOTH files. Add a cross-reference comment.
const SEED_PACKAGE_NAMES = ['Basic Package', 'Standard Package', 'Premium Package'] as const;

// Fix: match by name AND price, not just price
const defaultPackages = packages.filter(
  (pkg) =>
    pkg.basePrice === 0 &&
    SEED_PACKAGE_NAMES.includes(pkg.name as (typeof SEED_PACKAGE_NAMES)[number])
);
```

**Also add frontend safety net at the data-fetching layer:**

**File:** `apps/web/src/app/t/[slug]/(site)/page.tsx` or the services section component

```typescript
// Safety net: never show $0 seed packages to visitors
// Cross-ref: server/src/lib/tenant-defaults.ts:28-50
const SEED_PACKAGE_NAMES = ['Basic Package', 'Standard Package', 'Premium Package'];
const displayPackages = packages.filter(
  (pkg) => !(pkg.basePrice === 0 && SEED_PACKAGE_NAMES.includes(pkg.name))
);
```

**Verification:**

- [ ] Seed packages deleted during first draft (name + price match)
- [ ] Legitimate $0 packages with non-seed names preserved
- [ ] Frontend never shows $0 seed packages to storefront visitors
- [ ] Deletion failure is non-fatal (existing try/catch preserved)

---

### Step 5: Update agent system prompt (`system.ts`)

**File:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

All prompt changes in a single edit. Requires Cloud Run redeployment (auto-triggered by `deploy-agents.yml` workflow when changes in `server/src/agent-v2/deploy/tenant/src/**` are pushed to `main`).

**Note:** There is a ~5-minute deployment lag between frontend changes (Render/Vercel, ~2 min) and agent changes (Cloud Run, ~5-10 min). The behavioral changes below are in response style, not API contracts, so the timing gap is non-breaking.

**5a. Returning users — resume without asking permission (Issue #4):**

Replace the returning user section (~line 141-145):

```
### Returning Users

When a user returns to an in-progress onboarding session:

1. Briefly acknowledge their return: "Welcome back."
2. Summarize what's done in ONE sentence: "We've got your hero and about sections locked in."
3. Immediately continue with the next question or action. Do NOT ask "Want to pick up where we left off?" or "Shall we continue?"
4. If the slot machine says BUILD_FIRST_DRAFT, start building immediately.
5. If more facts are needed, ask the next question directly.

Example:
> "Welcome back. Your hero and about sections are looking great. Now let's talk about your services — what packages do you offer?"

Exception: If the user says "wait", "stop", "hold on", or "I need a minute" — pause and let them lead.
```

**5b. Post-reveal content generation (Issues #9, #10):**

Add to the post-reveal workflow section:

```
### Post-Reveal Content (After Guided Review)

After the guided review of MVP sections (Hero, About, Services), generate additional content:

1. **FAQ Section:** Generate 4-5 FAQs based on the business type and services. Use facts from discovery.
   - Call `update_section` with blockType: FAQ, visible: true
   - Include questions about booking, pricing, availability, and process

2. **Testimonials Section:** Create a placeholder with instructions:
   - "Share your best client testimonials and I'll format them beautifully."
   - Set visible: false until tenant provides real testimonials

3. **Contact Section:** Populate with available info:
   - If location fact exists: include address
   - If email/phone from discovery: include
   - Always include: business hours placeholder, contact form
   - Call `update_section` with blockType: CONTACT, visible: true
```

**Verification:**

- [ ] Agent on return: "Welcome back. [summary]. [next question]" — no "shall we continue?"
- [ ] Agent on fresh session: normal discovery flow (unchanged)
- [ ] After guided review: FAQ section generated with 4-5 questions
- [ ] Contact section populated with available info
- [ ] Testimonials section has guidance text, not placeholder

---

## Deferred

| Issue                                               | Why Deferred                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| #11 (AgentPanel god component)                      | Architecture debt, no user-facing impact. Track as separate todo.                                                             |
| #8 ("View your storefront" link)                    | Removed along with `OnboardingSection` in Step 3. No replacement needed — sidebar has navigation.                             |
| `isSeeded` boolean on Package/SectionContent models | Correct long-term discriminator for seed data. Not needed for this fix — name+price matching is adequate. Track as tech debt. |

---

## Testing Matrix

**5 tenant states to verify after deployment:**

| #   | Tenant State                          | Expected Behavior                                               |
| --- | ------------------------------------- | --------------------------------------------------------------- |
| 1   | New (no data, no onboarding)          | Coming Soon + hidden sidebar + agent starts discovery           |
| 2   | Mid-onboarding (some facts, no draft) | Coming Soon + hidden sidebar + agent continues without asking   |
| 3   | Pre-rebuild with real packages        | Preview + visible sidebar + no onboarding UI + lazy-write fires |
| 4   | Just published (via new flow)         | Preview + sidebar fades in + publish celebration                |
| 5   | Skipped onboarding                    | Preview + visible sidebar + no onboarding UI                    |

**Iframe isolation:**

| Element           | Iframe (`?edit=true&token=JWT`) | Public `?edit=true` (no token) | Live storefront          |
| ----------------- | ------------------------------- | ------------------------------ | ------------------------ |
| TenantNav         | Not mounted                     | Visible                        | Visible                  |
| TenantFooter      | Not mounted                     | Visible                        | Visible                  |
| TenantChatWidget  | Not mounted                     | Visible (if chatEnabled)       | Visible (if chatEnabled) |
| StickyMobileCTA   | Not mounted                     | Visible                        | Visible                  |
| Build mode banner | Thin sage line                  | Never shown                    | Never shown              |

---

## Key Files

| File                                                         | Change                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `server/src/services/context-builder.service.ts`             | `resolveOnboardingPhase()` + `hasNonPlaceholderContent()` + lazy-write in 3 methods |
| `apps/web/src/components/tenant/EditModeGate.tsx`            | NEW — client component, `useSearchParams()` + token + iframe triple gate            |
| `apps/web/src/app/t/[slug]/(site)/layout.tsx`                | Wrap chrome in `<EditModeGate>`                                                     |
| `apps/web/src/components/tenant/BuildModeWrapper.tsx`        | Remove green banner, add thin sage indicator                                        |
| `apps/web/src/components/agent/AgentPanel.tsx`               | Remove `OnboardingSection`, clean orphan imports                                    |
| `apps/web/src/components/onboarding/OnboardingProgress.tsx`  | DELETE                                                                              |
| `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts` | Add `SEED_PACKAGE_NAMES` filter to existing $0 deletion                             |
| `apps/web/src/app/t/[slug]/(site)/page.tsx`                  | Frontend $0 seed filter safety net                                                  |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`    | Returning user + post-reveal content generation                                     |

## Pitfalls Referenced

- #1 (tenant scoping), #5 (trust tier `as any`), #56 (Zod safeParse)
- #79 (orphan imports after deletion — run clean build)
- #83 (agent asking known questions — fix ALL THREE methods)
- #92 (coming_soon state guards)
- #94 (prompt-only LLM enforcement — belt-and-suspenders for seed deletion)

## Review History

**2026-02-08 — 5-agent parallel review:**

- **Kieran (TypeScript):** Caught searchParams bug (B2), found 3 code paths not 1 (B3), typed return as OnboardingPhase
- **Code Simplicity:** Confirmed seed deletion already exists in code, merged 4 batches → 1 commit, identified plan-to-code ratio was 4:1
- **Architecture Strategist:** Quantified query cost at scale, recommended hybrid runtime + lazy-write, confirmed no graduated ViewState needed
- **Security Sentinel:** Found `?edit=true` public degradation vector (M1), recommended triple-gate (edit + token + iframe)
- **Data Integrity Guardian:** Found seed section false positive (B1 — the most critical finding), caught `revealCompleted` inconsistency in getBootstrapData
