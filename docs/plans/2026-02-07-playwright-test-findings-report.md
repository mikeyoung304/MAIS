---
title: 'Onboarding Reveal Flow - Playwright E2E Test Findings'
type: investigation
date: 2026-02-07
status: ready-for-planning
priority: P0
test-run: production (gethandled.ai)
test-time: '2026-02-07 17:27-17:32 UTC'
---

# Onboarding Reveal Flow - Playwright Test Findings Report

## Executive Summary

E2E testing on production **AFTER** deploying PR #40 fixes revealed **5 critical content/UX issues** that prevent a viable onboarding experience. The core infrastructure works (auto-reveal triggers, preview loads, Coming Soon displays, logout button exists) but the REVEALED CONTENT is broken.

**Bottom Line:** Users see duplicate packages, placeholder sections that should be hidden, and a jarring flash instead of smooth animation.

---

## Test Environment

| Attribute         | Value                                        |
| ----------------- | -------------------------------------------- |
| **URL**           | https://gethandled.ai                        |
| **Account**       | test-pw-2026-02-07@example.com               |
| **Business**      | Test Photography Studio                      |
| **Location**      | Portland, Oregon                             |
| **Packages**      | 3 services provided ($1,500, $2,500, $4,000) |
| **Test Duration** | ~5 minutes                                   |
| **Browser**       | Chromium (Playwright MCP)                    |

---

## Issue #1: Duplicate Services (P0 - BLOCKS LAUNCH)

### Symptom

Services section shows **6 packages** instead of 3:

- ❌ Basic Package - $0/session (placeholder)
- ❌ Standard Package - $0/session (placeholder)
- ❌ Premium Package - $0/session (placeholder)
- ✅ Elopement Package - $1,500/session (correct)
- ✅ Half Day Coverage - $2,500/session (correct)
- ✅ Full Day Coverage - $4,000/session (correct)

### Impact

- **User trust:** Site looks broken, unprofessional
- **Business logic:** $0 packages undermine done-for-you value proposition
- **Conversion:** Users won't book if they see fake/placeholder packages

### Root Cause

The agent successfully created 3 packages using `manage_packages` tool (verified by 3x "Storefront ✓" in agent panel). These packages exist in the `Package` table. However, the Services section in the iframe renders BOTH:

1. Default/seed packages (Basic, Standard, Premium at $0)
2. Real agent-created packages (Elopement, Half Day, Full Day)

**Investigation Questions:**

1. Where do the $0 packages come from?
   - NOT from `SectionContentService.getDefaultContent()` (SERVICES case returns no packages array)
   - Likely seeded during tenant provisioning (`tenant-provisioning.service.ts`)
   - OR frontend hardcoded defaults in `ServicesSection.tsx`
2. Does the agent have logic to DELETE existing packages before creating new ones?
   - NO - the `manage_packages` tool only has `create` action, no "replace all" logic
3. Should the frontend filter out $0 packages if real packages exist?
   - Possible workaround but not ideal (should fix at source)

### Files to Investigate

- `server/src/services/tenant-provisioning.service.ts` - Check if default packages are seeded
- `apps/web/src/components/storefront/sections/ServicesSection.tsx` - Check rendering logic
- `server/src/agent-v2/deploy/tenant/src/tools/packages.ts` - Confirm no "replace" logic
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` - Check if agent is instructed to clear defaults

---

## Issue #2: Contact Section Shows with Placeholder (P0)

### Symptom

The revealed storefront displays a **CONTACT section** with placeholder text:

> "Contact information coming soon. Check back later!"

**Problem:** The agent did NOT gather contact information during discovery (only business name, location, services). This section should be HIDDEN, not shown with "coming soon" text.

### Impact

- **Trust erosion:** "Coming soon" undermines done-for-you promise ("I built your website!")
- **Incomplete feel:** Users expect a complete, personalized site after the reveal
- **Cognitive load:** Users see sections they didn't discuss, wonder what's missing

### Root Cause

**Visibility Logic Missing:**
All sections default to `visible: true` in `SectionContentService.getDefaultContent()`:

```typescript
case 'CONTACT':
  return {
    title: 'Get in Touch',
    showForm: true,
    formFields: ['name', 'email', 'message'],
    visible: true,  // ❌ ALWAYS TRUE
  };
```

**First Draft Scope Too Broad:**
The `build_first_draft` tool returns ALL placeholder sections:

```typescript
const placeholderSections = allSections.filter((s) => s.hasPlaceholder);
```

The agent is instructed to update ALL of them, regardless of whether data was gathered.

**No Slot-Based Visibility:**
The slot machine tracks which slots have sufficient data (`SectionReadiness`), but this isn't used to HIDE sections that shouldn't show in reveal.

### Expected Behavior

During reveal, ONLY show:

1. **HERO** - Always show (mandatory)
2. **ABOUT** - Always show (mandatory)
3. **SERVICES** - Always show (mandatory)
4. **CONTACT** - ONLY if agent gathered contact info (email, phone, address, or social links)
5. **FAQ** - ONLY if agent gathered FAQs or common questions
6. **TESTIMONIALS** - ONLY if agent gathered testimonials/reviews
7. **CTA** - Optional, can hide for MVP reveal

### Files to Change

- `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts` - Filter to MVP sections only (HERO, ABOUT, SERVICES)
- `server/src/services/section-content.service.ts` - Add `shouldShowInReveal()` helper
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` - Update first draft instructions

---

## Issue #3: Reveal Animation Flash (P0 - UX KILLER)

### Symptom

User reported:

> "It flashed a placeholder website, and then after about one second, reloaded with the correct website."

**Expected:** Smooth 3-second animation (fade-out ComingSoon → white flash → fade-in preview → scroll)
**Actual:** Brief flash of stale/placeholder content → reload → correct content

### Impact

- **"Wow moment" destroyed:** The reveal should be magical, not jarring
- **User confusion:** Looks like a bug or loading error
- **Trust damage:** If the animation glitches, users doubt the whole system

### Root Cause Hypotheses

**Hypothesis A: Auto-Reveal Fires Too Early**

From `AgentPanel.tsx:397-403`:

```typescript
const isContentWrite = toolCalls.some(
  (call) => call.name === 'update_section' || call.name === 'add_section'
);
if (currentView.status === 'coming_soon' && isContentWrite) {
  agentUIActions.revealSite(); // ❌ Fires after FIRST update_section
}
```

**Analysis:**

- Agent made 5 "Storefront ✓" calls (likely HERO, ABOUT, SERVICES + 2 others)
- Auto-reveal triggered after the FIRST `update_section`
- Iframe started loading while agent was still updating other sections
- Result: Iframe shows partial content, then reloads when more updates arrive

**Hypothesis B: Race Condition in handleRevealComplete**

From `ContentArea.tsx:124-135`:

```typescript
const handleRevealComplete = useCallback(async () => {
  try {
    await fetch(`${API_PROXY}/mark-reveal-completed`, { method: 'POST' });
  } catch {}
  await queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.state });
  agentUIActions.showPreview(); // ❌ Does this wait for refetch?
}, [queryClient]);
```

**Analysis:**

- `invalidateQueries()` triggers a refetch, but does NOT wait for it to complete
- `showPreview()` fires immediately, potentially before fresh data loads
- Iframe might render with stale cache while React Query is mid-refetch

**Hypothesis C: Iframe Pre-Load Shows Stale Data**

From `RevealTransition.tsx:254-261`:

```typescript
<iframe
  ref={iframeRef}
  src={iframeUrl}
  onLoad={handleIframeLoad}
/>
```

**Analysis:**

- Iframe pre-loads behind ComingSoon overlay (by design for smooth reveal)
- It fetches `/api/storefront/config` before backend writes complete
- The 100ms delay in `AgentPanel.tsx:383` might not be enough for multi-section updates
- Browser caching might serve stale config even after invalidation

### Recommended Fix

**Option 1: Wait for Agent Completion Signal (BEST)**

- Don't trigger auto-reveal after first `update_section`
- Wait for agent to announce completion ("Done — take a look")
- Extract `REVEAL_SITE` dashboard action from tool results
- Fire reveal only when agent explicitly says to

**Option 2: Add Minimum Section Count Guard**

```typescript
const contentWriteCount = toolCalls.filter(
  (call) => call.name === 'update_section' || call.name === 'add_section'
).length;

if (currentView.status === 'coming_soon' && contentWriteCount >= 3) {
  agentUIActions.revealSite();
}
```

**Option 3: Await Refetch in handleRevealComplete**

```typescript
await queryClient.invalidateQueries({
  queryKey: queryKeys.onboarding.state,
  refetchType: 'active',
});
await queryClient.refetchQueries({ queryKey: getDraftConfigQueryKey() });
agentUIActions.showPreview();
```

---

## Issue #4: Green Footer CTA Section (P1)

### Symptom

A large **green CTA section** appears at bottom of revealed storefront:

> "Ready to Get Started? Book your session today"

### Impact

- **Visual clutter:** Not part of MVP reveal scope
- **User confusion:** Didn't discuss CTAs during discovery
- **Branding mismatch:** Green background doesn't match photography brand

### Root Cause

The CTA section is either:

1. Part of default page structure (seeded during provisioning)
2. Added by agent as part of first draft (agent updated 5 sections, not 3)

Looking at `SectionContentService.getDefaultContent()`:

```typescript
case 'CTA':
  return {
    headline: 'Ready to Get Started?',
    buttonText: 'Contact Us',
    style: 'primary',
    visible: true,
  };
```

### Fix

- Add CTA to "hide during reveal" list
- OR: Don't create CTA section during tenant provisioning
- OR: Agent should remove/hide CTA before triggering reveal

---

## Issue #5: Reveal Scope - Too Many Sections (P0)

### Symptom

The revealed storefront shows MORE than the MVP scope (HERO, ABOUT, SERVICES):

- ✅ HERO
- ✅ ABOUT
- ✅ SERVICES (with duplicate packages)
- ❌ CONTACT (placeholder)
- ❌ CTA (green footer)
- ❌ Possibly FAQ, TESTIMONIALS (need to verify)

### Impact

- **Looks unfinished:** Placeholder sections undermine "done-for-you" promise
- **User confusion:** Sections they didn't discuss appear
- **Trust damage:** "You said you built my site, but half of it says 'coming soon'"

### Root Cause

**Plan says reveal should show HERO + ABOUT + SERVICES only:**

From `2026-02-06-feat-dashboard-onboarding-rebuild-plan.md`:

> **Reveal** — Animated full-site generation ("the wow moment")

But `first-draft.ts` returns ALL placeholder sections:

```typescript
const placeholderSections = allSections.filter((s) => s.hasPlaceholder);
```

**No MVP filtering.** Agent updates every section it finds.

### Fix

Filter `first-draft.ts` to return ONLY:

```typescript
const MVP_SECTIONS = ['HERO', 'ABOUT', 'SERVICES'];
const mvpSections = allSections.filter(
  (s) => s.hasPlaceholder && MVP_SECTIONS.includes(s.blockType)
);
```

---

## Summary of Findings

| Issue               | Severity | User Impact                     | Fix Complexity                            |
| ------------------- | -------- | ------------------------------- | ----------------------------------------- |
| Duplicate packages  | **P0**   | Looks broken, blocks booking    | Medium (find package source, add cleanup) |
| Placeholder CONTACT | **P0**   | Undermines done-for-you promise | Medium (add visibility logic)             |
| Flash animation     | **P0**   | Destroys "wow moment"           | Medium (fix timing/race condition)        |
| Green CTA footer    | **P1**   | Visual clutter                  | Low (hide CTA in reveal)                  |
| Too many sections   | **P0**   | Looks unfinished                | Low (filter first-draft scope)            |

**All 5 issues share a common root:** No concept of "reveal scope" or "section visibility based on gathered facts."

---

## Recommended Fix Strategy

### Phase 1: Minimum Viable Reveal (P0 - This Sprint)

**Goal:** First reveal shows ONLY HERO, ABOUT, SERVICES — all fully personalized, no duplicates.

**Changes:**

1. **Filter first-draft scope** (`first-draft.ts`)
   - Return only HERO, ABOUT, SERVICES sections
   - Add comment: "MVP reveal scope - expand later for refinement phase"

2. **Remove duplicate packages** (investigate + fix)
   - Find where $0 packages come from (provisioning vs seed vs hardcode)
   - Agent should call `manage_packages(action: 'list')` first
   - If default packages exist, agent deletes them before creating real ones
   - OR: Frontend filters out $0 packages when real packages exist

3. **Fix reveal timing** (auto-reveal logic)
   - Option A: Wait for agent completion signal (best)
   - Option B: Require 3+ section updates before triggering (quick fix)
   - Option C: Add explicit delay (500ms) after last update before reveal

4. **Hide CTA section** (one-line fix)
   - Add `CTA` to "hide during reveal" list
   - OR: Set `visible: false` in default content
   - OR: Don't create CTA during provisioning

### Phase 2: Smooth Animation (P0 - Same Sprint)

**Goal:** Reveal animation doesn't flash or reload.

**Changes:**

1. **Await refetch before showPreview** (`ContentArea.tsx`)

   ```typescript
   await queryClient.refetchQueries({ queryKey: getDraftConfigQueryKey() });
   agentUIActions.showPreview();
   ```

2. **Add cache-busting to iframe** (`RevealTransition.tsx`)

   ```typescript
   const iframeUrl = useMemo(
     () => `${buildPreviewUrl(slug, previewToken)}?t=${Date.now()}`,
     [slug, previewToken]
   );
   ```

3. **Increase delay before refetch** (`AgentPanel.tsx`)
   ```typescript
   await new Promise((resolve) => setTimeout(resolve, 300)); // was 100ms
   ```

### Phase 3: Section Visibility Model (P1 - Next Sprint)

**Goal:** Support FAQ, CONTACT, TESTIMONIALS when agent gathers data for them.

**Changes:**

1. Add `SectionReadiness` check in rendering
2. Sections with `MINIMAL` readiness → hidden
3. Agent can upgrade readiness by gathering more facts

---

## Files Requiring Changes

### Backend Changes

| File                                                         | Priority | Change Type | Description                                          |
| ------------------------------------------------------------ | -------- | ----------- | ---------------------------------------------------- |
| `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts` | **P0**   | Major       | Filter to MVP sections (HERO, ABOUT, SERVICES)       |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`    | **P0**   | Medium      | Update first draft instructions (3 sections minimum) |
| `server/src/services/tenant-provisioning.service.ts`         | **P0**   | Investigate | Find where $0 packages come from                     |
| `server/src/services/section-content.service.ts`             | P1       | Minor       | Add `shouldShowInReveal()` helper                    |

### Frontend Changes

| File                                                              | Priority | Change Type | Description                                   |
| ----------------------------------------------------------------- | -------- | ----------- | --------------------------------------------- |
| `apps/web/src/components/agent/AgentPanel.tsx`                    | **P0**   | Medium      | Wait for completion signal before auto-reveal |
| `apps/web/src/components/dashboard/ContentArea.tsx`               | **P0**   | Minor       | Await refetch in `handleRevealComplete`       |
| `apps/web/src/components/preview/RevealTransition.tsx`            | P1       | Minor       | Add cache-busting to iframe URL               |
| `apps/web/src/components/storefront/sections/ServicesSection.tsx` | **P0**   | Investigate | Check package rendering logic                 |

---

## Test Plan

### Unit Tests

- [ ] `first-draft.ts` returns only HERO, ABOUT, SERVICES
- [ ] `shouldShowInReveal()` logic (when implemented)
- [ ] Package deduplication logic

### Integration Tests

- [ ] Agent builds first draft → only 3 sections updated
- [ ] Services section shows only real packages (no $0 duplicates)

### E2E Tests (Playwright)

1. **Full onboarding flow**
   - Fresh signup → discovery → first draft → reveal → preview
   - Verify only HERO, ABOUT, SERVICES visible
   - Verify packages match user input ($1,500, $2,500, $4,000)
   - Verify no flash during reveal animation

2. **Returning user flow**
   - User with `revealCompletedAt` set → skips Coming Soon → shows preview
   - (Already tested, passes with PR #40 fixes)

3. **Negative tests**
   - No duplicate packages at any point
   - CONTACT hidden if not discussed
   - CTA section hidden during reveal

---

## Success Criteria

### Must Have (P0)

- [ ] Services section shows ONLY agent-created packages (3 packages, no $0 duplicates)
- [ ] Reveal shows ONLY HERO, ABOUT, SERVICES sections
- [ ] CONTACT section hidden (placeholder content not shown)
- [ ] CTA/green footer hidden during reveal
- [ ] Reveal animation smooth (no flash/reload)

### Should Have (P1)

- [ ] Cache-busting prevents stale iframe content
- [ ] Agent announces completion before reveal triggers
- [ ] Section visibility model supports future expansion (FAQ, TESTIMONIALS when ready)

### Nice to Have (P2)

- [ ] Visual regression test for reveal animation
- [ ] Metrics tracking: onboarding completion rate, time-to-preview
- [ ] User feedback on "wow moment" quality

---

## Next Steps

1. **Run `/workflows:plan`** with this report as input
2. Create detailed implementation plan
3. Branch from `main`: `git checkout -b fix/onboarding-reveal-content-issues`
4. Implement P0 fixes (duplicate packages, section scope, animation timing)
5. Test locally with fresh account
6. Deploy to staging and run E2E suite
7. Manual QA with 2-3 test accounts (different business types)
8. Deploy to production
9. Monitor metrics and user feedback

---

## Appendix: Test Transcript

**Account Created:** test-pw-2026-02-07@example.com
**Business:** Test Photography Studio
**Location:** Portland, Oregon
**Packages:** 3 packages ($1,500, $2,500, $4,000)

**Timeline:**

- 17:27 UTC: Signed up
- 17:28 UTC: Landed on Coming Soon, agent asked first question
- 17:29 UTC: Answered 3 questions (business type, name, location, packages)
- 17:30 UTC: Agent processed, built first draft (5x Storefront ✓)
- 17:30 UTC: Reveal flashed, then showed preview
- 17:32 UTC: Inspected preview — found 5 issues

**Console Errors:** Only 1 unrelated error (Stripe status 404)

**Agent Tool Calls:**

- 2x "Tool ✓" (store_discovery_fact)
- 1x "Research ✓" (research agent delegation)
- 5x "Storefront ✓" (update_section calls)
- 3x "Tool ✓" (unknown - possibly package creation)

Total: ~11 tool executions

---

**END OF REPORT**

Ready for `/workflows:plan` to create fix implementation plan.
