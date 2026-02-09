# Onboarding Flow Fix — Investigation & Handoff

**Date:** 2026-02-07
**Branch:** `main` (fixes should branch from here)
**Investigation by:** Two sessions of deep-dive analysis + Supabase/Cloud Run log verification
**Status:** Root causes confirmed, ready for `/workflows:plan`

---

## Executive Summary

The onboarding "wow moment" reveal is completely broken in production. A demo user (Rio's Plans, wedding planner in Macon, GA) went through the full agent conversation, but sees "Coming Soon" forever with no way to see their storefront. Three cascading bugs were identified — none of which match the initial misdiagnosis of "database writes silently failing."

**The database is fine.** 11 SectionContent rows exist. The HERO section was successfully updated with custom content. The real bugs are in **timing**, **state communication**, and **incomplete workflow execution**.

---

## The 3 Root Cause Bugs

### Bug 1: `revealCompletedAt` fires 6 seconds after signup (PREMATURE)

**Evidence (from Supabase production database):**

| Event                              | Timestamp (UTC)           |
| ---------------------------------- | ------------------------- |
| Tenant `createdAt`                 | `2026-02-07 01:16:19.130` |
| `revealCompletedAt`                | `2026-02-07 01:16:25.915` |
| First `update_section` call (HERO) | `2026-02-07 01:26:01.463` |

The reveal flag was set **6.7 seconds** after signup — impossible for the normal flow (agent must ask questions, collect facts, then build). The first actual content write happened **10 minutes AFTER** the reveal was already marked complete.

**Root cause:** The `build_first_draft` tool fires `/mark-reveal-completed` as a **fire-and-forget** side effect the moment it runs. It doesn't wait for any `update_section` calls to complete. The LLM calls `build_first_draft` early (to get the section list), and the reveal flag is immediately burned.

**Code location:** `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts` — line ~153, the fire-and-forget call to `/mark-reveal-completed`.

**Fix approach:** Move `/mark-reveal-completed` out of `build_first_draft`. Either:

- (A) Make it a separate agent tool that fires AFTER all MVP sections are confirmed written
- (B) Have the backend check that MVP sections (HERO, ABOUT, SERVICES) have draft content before allowing reveal
- (C) Have the frontend trigger `/mark-reveal-completed` after the reveal animation completes (component already owns the timer)

### Bug 2: Frontend has NO concept of `revealCompletedAt` (returning users stuck)

**Evidence:** The `OnboardingStateResponse` interface in `useOnboardingState.ts` returns `phase`, `isComplete`, `isReturning`, summaries, and memory — but **no `revealCompleted` field**. The frontend layout always calls `showComingSoon()` for any user whose phase is before COMPLETED/SKIPPED, regardless of whether the reveal already happened.

**The stuck loop:**

1. Page loads → `initialize(tenantId)` sets view to `dashboard`
2. Onboarding state loads → `isOnboarding` is `true` (phase is not COMPLETED)
3. Layout calls `showComingSoon()` → view becomes `coming_soon`
4. Guards prevent ALL transitions away from `coming_soon` except `revealSite()`
5. `revealSite()` is only called when agent fires `REVEAL_SITE` dashboardAction
6. Agent won't fire reveal again — it's a one-shot guard (`mark-reveal-completed` only writes if null)
7. **User is stuck in Coming Soon forever on every page load**

**Code locations:**

- `apps/web/src/hooks/useOnboardingState.ts` — `OnboardingStateResponse` interface (missing `revealCompleted`)
- `apps/web/src/app/(protected)/tenant/layout.tsx` — lines 138-145 (the `useEffect` that always calls `showComingSoon()` during onboarding)
- `apps/web/src/stores/agent-ui-store.ts` — lines 341-345, 368-372, 456-457 (the `coming_soon` guards)
- `server/src/routes/internal-agent.routes.ts` — the `/onboarding-state` endpoint (needs to include `revealCompleted`)

**Fix approach:**

1. Add `revealCompleted: boolean` to the `/onboarding-state` response (check `tenant.revealCompletedAt !== null`)
2. In layout.tsx, change the logic: if `isOnboarding && revealCompleted` → `showPreview('home')` instead of `showComingSoon()`
3. This way returning users who already had their reveal skip straight to preview

### Bug 3: First draft only updated 1 of 3 MVP sections

**Evidence (from Supabase SectionContent table for tenant `cmlbmify200002xg3q3hkx36u`):**

| blockType | isDraft  | Content                                                           |
| --------- | -------- | ----------------------------------------------------------------- |
| HERO      | **true** | "Your Dream Wedding, Beautifully Planned in Macon." (CUSTOMIZED)  |
| ABOUT     | false    | "Share your story, experience, and passion here..." (PLACEHOLDER) |
| SERVICES  | false    | Generic "Our Services" (PLACEHOLDER)                              |
| PRICING   | false    | Default pricing (PLACEHOLDER)                                     |
| + 7 more  | false    | All defaults                                                      |

The agent successfully updated HERO with personalized content but never got to ABOUT or SERVICES. The MVP flow requires all 3 before the reveal is meaningful.

**Root cause:** The agent's first draft workflow in the system prompt was recently updated (commit `d9f26097`) to use explicit field lists per section and to use `manage_packages` for SERVICES. But the flow may be fragile — if any step fails or the agent context window fills up, it stops after the first section.

**Code location:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` — the MVP Sections / first draft workflow section.

**Fix approach:** The system prompt should instruct the agent more explicitly to:

1. Update HERO, then ABOUT, then SERVICES — in that order
2. Only fire the reveal AFTER all 3 are confirmed (check tool results)
3. If any update fails, retry before moving on

---

## Additional Issues (P0-P2)

### P0: No Logout Button During Onboarding

During onboarding, the full dashboard layout (with sidebar/header) is hidden. The only UI is ComingSoon + Agent panel + "Skip setup". There is no logout button anywhere. Users are trapped.

**Code location:** `apps/web/src/app/(protected)/tenant/layout.tsx` — the onboarding layout branch hides the sidebar/header.

**Fix:** Add a minimal "Log out" link or button in the top-right corner of the onboarding layout. Could be in the agent panel header or as a standalone element.

### P1: Session 404 on Return (conversation history lost)

```
GET /api/tenant-admin/agent/tenant/session/2457e9b7-... => 404
```

Old ADK session expired or was purged. Frontend caches stale session ID, tries to load it, gets 404, then creates a new session. User loses conversation history and only sees a "Welcome back" summary.

**Fix:** Handle 404 gracefully — create a new session silently, don't show error. Consider persisting key conversation context in the bootstrap data so it survives session loss.

### P1: Agent State Mismatch

Agent tells user "Look at your hero section!" but the UI shows Coming Soon. This is a consequence of Bug 1 + Bug 2 — the agent thinks content was written (it was, for HERO) and that the reveal happened (it did, per the backend flag), but the frontend can't display it.

**Resolves automatically when Bug 2 is fixed.**

### P2: Stripe Status 404

```
GET /api/tenant-admin/stripe/status => 404
```

Endpoint returns 404 instead of `200 { connected: false }` for tenants without Stripe setup.

---

## Database State (Verified 2026-02-07 via Supabase)

### Tenant Record

| Field                   | Value                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                      | `cmlbmify200002xg3q3hkx36u`                                                                                                                        |
| slug                    | `rerererer-1770426978827`                                                                                                                          |
| name                    | `rerererer`                                                                                                                                        |
| email                   | `ererer@rere.com`                                                                                                                                  |
| revealCompletedAt       | `2026-02-07 01:16:25.915` (SET)                                                                                                                    |
| onboardingCompletedAt   | `NULL` (not set)                                                                                                                                   |
| branding.discoveryFacts | `{"location":"Macon, GA","businessName":"Rio's Plans","businessType":"wedding planner","servicesOffered":"Day of, full planning, and consulting"}` |
| createdAt               | `2026-02-07 01:16:19.13`                                                                                                                           |

### SectionContent (11 rows exist)

| blockType    | isDraft | Status                                                           |
| ------------ | ------- | ---------------------------------------------------------------- |
| HERO         | true    | CUSTOMIZED ("Your Dream Wedding, Beautifully Planned in Macon.") |
| ABOUT        | false   | PLACEHOLDER                                                      |
| SERVICES     | false   | PLACEHOLDER                                                      |
| PRICING      | false   | PLACEHOLDER                                                      |
| TESTIMONIALS | false   | PLACEHOLDER (hidden)                                             |
| FAQ          | false   | PLACEHOLDER (hidden)                                             |
| CONTACT      | false   | PLACEHOLDER                                                      |
| CTA          | false   | PLACEHOLDER (hidden)                                             |
| GALLERY      | false   | PLACEHOLDER (hidden)                                             |
| FEATURES     | false   | PLACEHOLDER (hidden)                                             |
| CUSTOM       | false   | PLACEHOLDER (hidden)                                             |

### SectionContent Table (total: 73 rows across 7 tenants)

All 7 tenants have 11 rows each (except 1 with 7). The provisioning flow works correctly for creating initial sections.

---

## Key Code Locations

### Frontend (apps/web/src/)

| File                                | Lines                                    | Relevance                                                       |
| ----------------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| `app/(protected)/tenant/layout.tsx` | 138-145                                  | **BUG 2**: Always calls `showComingSoon()` during onboarding    |
| `stores/agent-ui-store.ts`          | 341-345, 368-372, 456-457                | `coming_soon` guards that block transitions                     |
| `stores/agent-ui-store.ts`          | 413-431                                  | `revealSite()` action (sets `revealing` status)                 |
| `hooks/useOnboardingState.ts`       | 13-34                                    | `OnboardingStateResponse` interface (missing `revealCompleted`) |
| `components/agent/AgentPanel.tsx`   | (search `handleTenantAgentToolComplete`) | Where dashboardActions from agent tools are processed           |

### Backend (server/src/)

| File                                      | Lines                           | Relevance                                                  |
| ----------------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| `routes/internal-agent.routes.ts`         | search `/onboarding-state`      | Bootstrap endpoint (needs `revealCompleted` field)         |
| `routes/internal-agent.routes.ts`         | search `/mark-reveal-completed` | One-shot reveal flag setter                                |
| `services/section-content.service.ts`     | 331-400                         | `updateSection()` method (working correctly)               |
| `services/tenant-provisioning.service.ts` | 104-184                         | Creates 11 default SectionContent rows (working correctly) |

### Agent (server/src/agent-v2/deploy/tenant/src/)

| File                        | Lines                  | Relevance                                                            |
| --------------------------- | ---------------------- | -------------------------------------------------------------------- |
| `tools/first-draft.ts`      | ~153                   | **BUG 1**: Fire-and-forget `/mark-reveal-completed`                  |
| `tools/storefront-write.ts` | 101-195                | `update_section` tool (working correctly, has FIX #812 verification) |
| `prompts/system.ts`         | (MVP Sections section) | **BUG 3**: First draft workflow instructions                         |

---

## Architecture Context

### View State Machine (agent-ui-store.ts)

```
coming_soon ──(revealSite())──> revealing ──(timer 2.5s)──> preview
    ↑                                                          |
    |                                                          |
    └──── showComingSoon() ←──── (only during onboarding) ─────┘
                                                               |
                                                          dashboard
```

Guards: `showPreview()`, `showDashboard()`, `highlightSection()` all return early if `status === 'coming_soon'`. Only `revealSite()` can transition out.

### Reveal Flow (intended)

1. Agent collects facts → `store_discovery_fact` tool
2. Agent decides enough facts → calls `build_first_draft` tool
3. `build_first_draft` returns section list for agent to fill
4. Agent calls `update_section` for HERO, ABOUT, SERVICES
5. Agent calls reveal (fires `REVEAL_SITE` dashboardAction)
6. Frontend plays 2.5s animation → transitions to `preview`
7. `/mark-reveal-completed` writes timestamp (one-shot)

### Reveal Flow (actual broken behavior)

1. Agent collects facts
2. Agent calls `build_first_draft` → **immediately fires `/mark-reveal-completed`** (Bug 1)
3. `build_first_draft` returns section list
4. Agent updates HERO... then stops (Bug 3)
5. User returns later → frontend always shows Coming Soon (Bug 2)
6. Agent can't re-trigger reveal (one-shot already burned)
7. **User stuck forever**

---

## Deployment Architecture

| Component   | Platform                            | Auto-Deploy                 | Notes                                      |
| ----------- | ----------------------------------- | --------------------------- | ------------------------------------------ |
| Backend API | Render (`srv-d4j5ehngi27c739f0nd0`) | Yes (on push to main)       | Build does NOT run `prisma migrate deploy` |
| Frontend    | Vercel                              | Yes (on push to main)       | Next.js 14                                 |
| Agents      | Google Cloud Run                    | Via GitHub Actions workflow | Separate deploy from backend               |
| Database    | Supabase (`gpyvdknhmevcfdbgtqir`)   | N/A                         | PostgreSQL, East US (Ohio)                 |

**Important:** Migrations must be run manually. The Render build command only runs `prisma generate`, not `prisma migrate deploy`.

---

## What the Previous Investigation Got Wrong

The previous session concluded "update_section reports success but writes nothing to database" based on a Supabase query showing "0 SectionContent rows." This was **incorrect**:

- The tenant actually has **11 SectionContent rows** (verified via Supabase Table Editor)
- The HERO section WAS successfully updated with custom content
- The "0 rows" claim was either a query error, a timing issue, or a misread

The real bugs are structural (timing, state communication, incomplete workflow) — not a silent write failure.

---

## Proposed Fix Phases

### Phase 1: Fix Returning User Stuck in Coming Soon (Bug 2) — HIGHEST IMPACT

**Why first:** This is the simplest fix and immediately unblocks ALL returning users whose reveal already completed. Even with Bugs 1 and 3 still present, users who had a partial first draft would at least see SOMETHING instead of Coming Soon forever.

1. Add `revealCompleted: boolean` to `/onboarding-state` endpoint response
2. Update `OnboardingStateResponse` interface in `useOnboardingState.ts`
3. In `layout.tsx`, change: `if (isOnboarding && !revealCompleted) showComingSoon()` else `showPreview()`
4. Return `revealCompleted` from the hook

### Phase 2: Fix Premature Reveal (Bug 1)

1. Remove fire-and-forget `/mark-reveal-completed` from `build_first_draft` tool
2. Option A: Frontend fires `/mark-reveal-completed` after reveal animation completes (RevealTransition component)
3. Option B: Create a separate `complete_reveal` agent tool that fires after all sections are updated
4. Option C: Backend checks that MVP sections have `isDraft: true` before allowing reveal

### Phase 3: Ensure Complete First Draft (Bug 3)

1. Review and tighten the system prompt's first draft workflow
2. Agent should confirm each section update succeeded before moving to the next
3. Only trigger reveal after HERO + ABOUT + SERVICES all return `verified: true`
4. Add retry logic in the prompt for failed section updates

### Phase 4: P0/P1 Polish

1. Add logout button during onboarding
2. Handle session 404 gracefully (create new session, don't lose context)
3. Stripe status endpoint: return 200 `{ connected: false }` instead of 404

---

## Test Plan

After fixes, create a fresh demo tenant and verify:

1. **Fresh signup:** Agent asks questions → collects facts → builds first draft (HERO + ABOUT + SERVICES) → reveal animation plays → preview shows personalized content
2. **Return visit:** Close browser → reopen dashboard → should see preview (NOT Coming Soon)
3. **Partial draft:** If agent only updates 1 section before disconnect → return shows Coming Soon (reveal hasn't been triggered yet)
4. **Logout:** Logout button visible during onboarding, works correctly
5. **Session recovery:** Old session 404 → new session created → "Welcome back" message with context
