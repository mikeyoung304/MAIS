# Code Simplicity Review: Production Storefront Hardening Plan

**Reviewer:** code-simplicity-reviewer
**Date:** 2026-02-18
**Target:** `docs/plans/2026-02-18-fix-production-storefront-hardening-plan.md`
**Findings:** 0 P1 / 3 P2 / 3 P3

---

## Summary

The plan is well-scoped and correctly ordered (data fixes → component fixes → polish). No P1 blockers. Three P2 simplification opportunities that reduce maintenance surface, and three P3 cosmetic issues. The biggest concern is leaving `getAnchorNavigationItems()` as dead code after switching `TenantNav` to the new function — it should be deleted in the same commit.

---

## P2 Findings

### P2-1: Dead code — `getAnchorNavigationItems()` not deleted after replacement

**Section:** Phase 2c (navigation fix)

The plan switches `TenantNav.tsx` to call `getNavItemsFromHomeSections()` but leaves `getAnchorNavigationItems()` in `navigation.ts`. After the switch, `getAnchorNavigationItems` has zero callers. The plan does not mention deleting it or exporting it for future multi-page use.

**Why this matters:** Dead exported functions mislead future contributors into thinking there are two valid nav derivation paths. The function comment says "single-page" use, same as the new function — there's no meaningful distinction in intent. If multi-page navigation is ever needed, the correct fix is `getNavigationItems()` (already in the file, using `PAGE_PATHS`).

**Recommendation:** Delete `getAnchorNavigationItems()` in the same commit as the `TenantNav` switch. Add a one-line comment to `getNavItemsFromHomeSections()` noting it supersedes the old function.

---

### P2-2: Nav derivation iterates sections (DB order) instead of `PAGE_ORDER` (canonical order)

**Section:** Phase 2c, `getNavItemsFromHomeSections()` proposed code

The plan iterates `pages.home.sections` and builds a `seen` Set. This means nav order is determined by section insertion order in the database — not the canonical `PAGE_ORDER` already defined in `navigation.ts`. If a testimonials section appears before an about section in the DB, testimonials precedes about in the nav. That ordering inconsistency is subtle and won't be caught by tests.

The simpler and more correct approach: iterate `PAGE_ORDER` and check membership. This guarantees nav order matches the canonical display order regardless of DB insertion order, and eliminates the `seen` Set entirely. It also makes the `hero` skip check unnecessary — `hero` doesn't appear in `PAGE_ORDER` under any page name that would produce a nav item.

**Recommended loop structure:**

```typescript
const items: NavItem[] = [{ label: 'Home', path: '' }];
for (const page of PAGE_ORDER) {
  if (page === 'home') continue;
  const hasSection = pages.home.sections.some((s) => SECTION_TYPE_TO_PAGE[s.type] === page);
  if (hasSection) {
    items.push({ label: PAGE_LABELS[page], path: PAGE_ANCHORS[page] });
  }
}
```

This is 7 lines instead of 12, and is provably correct for ordering.

---

### P2-3: Testimonials transform sets `name: undefined` — use `delete` instead

**Section:** Phase 2b, testimonials transform in `storefront-utils.ts`

The proposed transform uses spread to set keys to `undefined`:

```typescript
...(item.name && !item.authorName ? { authorName: item.name, name: undefined } : {}),
```

Setting `name: undefined` via spread does NOT remove the key — it sets the key's value to `undefined`. The key remains enumerable. This is inconsistent with every other case in `transformContentForSection()`, which uses `delete transformed.fieldName` (lines 57, 70, 77, 84, 88, 94). The downstream component doesn't access `testimonial.name` today, but ghost keys cause confusion if types are tightened or the component is extended.

**Recommendation:** Match the existing pattern — use `delete` on a mutable copy:

```typescript
transformed.items = (transformed.items as Record<string, unknown>[]).map((item) => {
  const out = { ...item };
  if (out.name && !out.authorName) {
    out.authorName = out.name;
    delete out.name;
  }
  if (out.role && !out.authorRole) {
    out.authorRole = out.role;
    delete out.role;
  }
  return out;
});
```

---

## P3 Findings

### P3-1: Redundant `hero` skip — unreachable dead code

**Section:** Phase 2c, proposed `getNavItemsFromHomeSections()` code

```typescript
if (!pageName || seen.has(pageName)) continue;
if (section.type === 'hero') continue; // unreachable
```

`hero` is not in `SECTION_TYPE_TO_PAGE`, so `pageName` is `undefined` for hero sections. The `!pageName` guard above already skips them. The second check is unreachable. If the P2-2 recommendation is adopted (iterate `PAGE_ORDER` instead), this line disappears naturally. If the original loop structure is kept, remove the check and document the exclusion in a comment on `SECTION_TYPE_TO_PAGE`.

---

### P3-2: Price explanation wording encodes Little Bit Farm's business model in a shared component

**Section:** Phase 3b, `DateBookingWizard.ReviewStep` proposed JSX

```tsx
{
  tier.displayPriceCents > effectiveTotal && <> Accommodation booked separately after purchase.</>;
}
```

This wording is Little Bit Farm-specific. Macon Headshots won't have accommodation fees — their price difference has a different cause. Hardcoding accommodation language in a shared `DateBookingWizard` makes the component tenant-aware in the wrong way.

**Recommendation:** Either (a) store the explanation in tier data (`tier.priceNote`) and render it generically, or (b) simplify to a tenant-neutral phrase: `"Experience fee only. Additional costs may apply."` The simpler approach avoids encoding business-model assumptions into shared wizard UI.

---

### P3-3: Font investigation scope is open-ended — add a concrete first check

**Section:** Phase 3a, font loading investigation

The plan lists three options without a decision tree. The investigation note correctly observes that root `layout.tsx` already loads Playfair Display (the `classic` preset font). If both tenants use `classic`, the `<link>` in `TenantSiteShell` is purely redundant for current tenants.

**Recommendation:** Add a concrete first step: verify the `googleFontsUrl` value for the `classic` preset in `packages/contracts/src/constants/font-presets.ts` and cross-check against what root `layout.tsx` loads. If they match, the minimal fix is a guard that skips the `<link>` when the preset is already loaded by the root layout. This narrows the investigation to a 5-minute check before deciding whether CSP or placement changes are needed.

---

## What the Plan Gets Right

- Phase ordering (data → components → polish) is correct and minimizes test noise.
- `Array.isArray(transformed.items)` guard in testimonials transform correctly applies the null-defeats-defaults pattern from the compound doc.
- Deleting `HowItWorksSection.tsx` entirely rather than conditionally hiding it — appropriately ruthless.
- The `seen` Set for deduplication is correct in intent (`features` + `services` both mapping to one nav item needs deduplication); the P2-2 recommendation preserves correctness while fixing ordering.
- Risk matrix correctly identifies the "tenants without FEATURES section" gap and notes it's covered by `build_first_draft`.
- `effectiveTotal ?? pkg.priceCents` fallback in ReviewStep correctly handles undefined `effectiveTotal`.

---

---

# Code Simplicity Review: Production Smoke Test 6-Bug Fix Plan

**Reviewer:** code-simplicity-reviewer
**Date:** 2026-02-16
**Target:** `docs/plans/2026-02-16-fix-production-smoke-test-6-bugs-plan.md`

---

## Summary

The plan addresses 6 real bugs discovered in production smoke testing. However, several phases propose more machinery than the bug warrants. 3 findings are P1 (will introduce unnecessary complexity), 4 are P2 (over-scoped but lower risk), and 2 are P3 (minor suggestions).

**Totals: 3 P1 | 4 P2 | 2 P3**

---

## Phase 1: Storefront Crash Fix (Bug 1)

### P1-1: ErrorBoundary is unnecessary — fix the data, not the symptom

**The plan proposes three layers of defense:** (1.1) Add pricing transform case, (1.2) Add null guards to ALL 5 section components, (1.3) Wrap every section in a per-section ErrorBoundary.

**Only 1.1 is needed to fix the bug.** The transform case is the actual fix. The rest is speculative defensive programming against future bugs that don't exist yet.

**Analysis of each layer:**

- **1.1 (pricing transform case):** Yes. This is the root cause. The `switch` statement in `transformContentForSection()` has no `'pricing'` case, so `items` never maps to `tiers`. This is a 6-line fix.

- **1.2 (null guards in ALL section components):** Partially redundant. `PricingSection.tsx` already has `tiers = []` default AND `if (tiers.length === 0) return null` at line 28. The plan claims "null defeats default params" but this only matters if the transform doesn't fix the mapping. With 1.1 in place, `tiers` arrives as a proper array. The `null` scenario is a backend data integrity issue, not a frontend concern. If we must guard, guard only in `PricingSection` since that's where the bug manifested — not all 5 components. `FeaturesSection` (line 76) and `GallerySection` (line 54) already have identical `if (x.length === 0) return null` guards.

- **1.3 (per-section ErrorBoundary):** This adds a new dependency (`react-error-boundary` is not installed) or requires writing a class component ErrorBoundary. The existing `TenantErrorBoundary` at `apps/web/src/components/tenant/TenantErrorBoundary.tsx` is a Next.js error boundary (function component for `error.tsx` files), NOT a React ErrorBoundary class — it cannot be used inline. Adding ErrorBoundary per-section means one broken section renders as `null` silently, which makes debugging harder in production. The entire crash is caused by a missing switch case — fix the switch case.

**Recommendation:** Implement only 1.1. Add a single `?? []` null coalesce in PricingSection as a one-liner safety net (`const safeTiers = tiers ?? [];`). Drop the ErrorBoundary entirely. **Net change: ~8 lines instead of ~40+ lines across 6 files + a new dependency.**

### P3-1: Transform case could be even simpler

The proposed transform:

```typescript
case 'pricing':
  if ('items' in content && !('tiers' in content)) {
    transformed.tiers = content.items;
    delete transformed.items;
  }
  if (transformed.tiers === null || transformed.tiers === undefined) {
    transformed.tiers = [];
  }
  break;
```

The null/undefined guard on `transformed.tiers` can be moved to the component (where it already belongs — `PricingSection` already has `tiers = []`). The transform should only handle field renaming, not data validation. Keep the transform case to just the `items` -> `tiers` mapping.

---

## Phase 2: Agent Chat Hang Fix (Bug 2)

### P2-1: Investigation scope is disproportionate to the likely root cause

**The plan proposes 4 sub-tasks:** (2.1) diagnostic logging at 5 locations, (2.2) sessionId lifecycle audit, (2.3) fetch timeout with AbortController, (2.4) recovery button after 60s.

**The disabled condition is `disabled={isLoading || !sessionId}` (line 273).** The `finally` block at line 493 always sets `setIsLoading(false)`. The plan correctly identifies that `!sessionId` is the more likely culprit — if the response doesn't return a sessionId, or if it becomes null during a tool call.

**The real issue is likely simpler:** Look at `sendMessageCore` (line 414-505). The guard at line 416 is `if (!message.trim() || isLoading || !sessionId) return;`. If `sessionId` is truthy when the message is sent but the response doesn't update it (which it shouldn't — sessionId is set once during init), then `isLoading` goes false in `finally` and the input should re-enable. The only way input stays disabled permanently is if `sessionId` somehow becomes null/undefined after init.

**Recommendation:**

- Skip 2.1 (diagnostic logging) — this is dev-time debugging, not a code change. Do it during development, don't plan it as a deliverable.
- Do 2.2 (sessionId audit) — this is where the bug lives. Check if any code path sets `sessionId` to null after initialization.
- Skip 2.3 (fetch timeout) — the hook has no fetch timeout, true, but that's not what causes "hangs after tool calls." Tool calls complete (the agent responds), then the input stays disabled. A timeout for slow responses is a separate improvement, not this bug.
- 2.4 (recovery button) is reasonable as a UX safety net, but frame it as a separate enhancement, not part of this bug fix.

**Net: Fix the root cause (likely sessionId becoming null), add the recovery button as a separate nice-to-have.**

---

## Phase 3: Session Context Filtering (Bug 3)

### P1-2: Strip context on the backend, not the frontend

**The plan proposes:** regex stripping in `ChatMessage.tsx` + also stripping in `useTenantAgentChat.ts` when loading history.

**The simpler approach:** The context is injected into the user's first message at `tenant-admin-tenant-agent.routes.ts:529`. When the chat history is returned to the frontend (via `GET /session/:id`), the backend should strip the context prefix from user messages before sending them. This is one change in one place — the backend route that returns chat history.

**Why frontend stripping is worse:**

1. It applies a regex on every render of every user message, forever.
2. The regex `\[SESSION CONTEXT\][\s\S]*?\[END CONTEXT\]\s*` is fragile — if the format changes, the frontend and backend both need updating.
3. Two locations need the strip (ChatMessage + history loading) vs. one backend location.
4. The context was injected by the backend; the backend should clean up after itself.

**The context is only in the FIRST user message.** The backend knows which message has it (it's the one it injected). Strip it when returning history. For the live message in the current session, the frontend sends `message` (clean), and the backend prepends context before sending to the agent. The response comes back clean. The only place the dirty message exists is in the ADK session history.

**Recommendation:** Single backend change: when returning session history, strip `[SESSION CONTEXT]...[END CONTEXT]` from user messages. Zero frontend changes needed.

### P2-2: If frontend stripping is kept, one location is enough

If the backend approach is rejected for some reason, strip only in `ChatMessage.tsx` (the display layer). Stripping in `useTenantAgentChat.ts` during history loading is double-stripping — the display component already handles it.

---

## Phase 4: Tenant-Admin Tier Routes (Bug 4)

### P1-3: The dashboard only needs GET, not full CRUD

**The plan proposes 5 routes:** GET (list), POST (create), PUT (update), DELETE, PATCH (reorder).

**What the dashboard actually calls:**

- `DashboardView.tsx:88` → `fetch('/api/tenant-admin/tiers')` — GET only, for counting tiers.
- `dashboard/page.tsx:95` → Same GET call.

The Dashboard fetches tiers to display `tiersCount` (line 102: `tiersCount: Array.isArray(tiers) ? tiers.length : 0`). It does NOT create, update, delete, or reorder tiers from the dashboard. All tier CRUD happens through the agent tools (`manage_tiers` → `internal-agent-content-tiers.routes.ts`).

**Recommendation:** Create only `GET /tiers` for the tenant-admin API. This is ~20 lines of code. POST/PUT/DELETE/PATCH can be added when (and if) a manual tier editor UI is built. Building 5 CRUD routes for a feature that only reads is textbook over-engineering.

### P2-3: Stripe status route needs investigation, not assumption

The plan says "Check if `/api/tenant-admin/stripe/status` exists or needs creation" (4.3). This should be investigated BEFORE writing the plan, not during implementation. From the grep results, `payments/page.tsx` calls multiple stripe endpoints (`/stripe/status`, `/stripe/account`, `/stripe/onboard-link`, `/stripe/dashboard-link`). These likely already exist somewhere or are genuinely missing. The plan should state clearly whether they exist.

---

## Phase 5: Agent Anti-Parroting (Bug 5)

### P3-2: The examples use emojis, which contradicts project conventions

The proposed prompt addition includes:

```
- "Got it, you want a Hero section with a dark background..."
- "On it -- updating your hero."
- "Bet, creating those 3 tiers now."
```

The examples are clean and appropriate. The addition is minimal (~6 lines to the system prompt). **This phase is well-scoped.** No over-engineering concerns.

One minor note: the existing system prompt already has `Confirmation vocabulary: got it | done | on it | heard | bet | take a look` and the Lead Partner Rule says "State your recommendation directly." The parroting behavior might be a model-level issue that a prompt addition can't reliably fix. Consider whether this is actually a prompt problem or if the model is ignoring existing instructions. If it's the latter, adding more prompt text won't help.

---

## Phase 6: Slug Sanitization (Bug 6)

### P2-4: The plan misidentifies the root cause and proposes a workaround instead of a fix

**The plan proposes:** `validator.unescape()` + `& -> and` mapping in slug generation.

**The actual root cause (confirmed by code review):** Global middleware at `server/src/app.ts:203` applies `sanitizeInput()` to ALL requests. `sanitizeInput` calls `sanitizeObject(req.body)`, which calls `sanitizePlainText()` on every string field. `sanitizePlainText` calls `validator.escape()`, which converts `&` to `&amp;`. This happens BEFORE the signup route handler receives `req.body.businessName`.

So by the time `auth-signup.routes.ts:82` sees `businessName`, it's already `Ember &amp; Ash Photography`. The slug regex `[^a-z0-9]+` turns `&amp;` into `-amp-`.

**The right fix is one of:**

1. **Best: Don't HTML-escape the businessName for slug generation.** Read the raw value before sanitization, or unescape it. The plan's `validator.unescape()` approach does this, but it's a band-aid — every new route that uses `req.body` strings for non-HTML purposes will hit the same trap.

2. **Better: Skip sanitization for the signup route's businessName field specifically.** The global sanitizer already skips internal agent routes (line 200). The signup route could use `sanitizeInput({ skip: true })` and do field-level sanitization manually.

3. **Root cause fix: The global sanitizer shouldn't HTML-escape form data that isn't rendered as HTML.** `validator.escape()` is for HTML output contexts. Applying it at the input layer is defense-in-wrong-depth. However, changing the global sanitizer is a larger refactor that affects all routes — not appropriate for a bug fix plan.

**For this plan, option 1 (`validator.unescape()` before slug generation) is acceptable as a targeted fix.** But the plan should acknowledge this is a workaround for overly aggressive global sanitization, not the root cause fix. Also, the `& -> and` mapping is a nice touch for readability but should be documented as an intentional choice (some businesses might prefer `ember-ash` over `ember-and-ash`).

**The plan also proposes fixing `internal-agent-shared.ts:slugify()`.** This is correct IF that function also receives pre-sanitized input. Verify before changing.

---

## Cross-Cutting Concerns

### P2-5: The plan proposes 2 new files but could be 0

- Phase 4 proposes a new `tenant-admin-tiers.routes.ts` — if reduced to GET-only, this could be added as ~15 lines inside the existing `tenant-admin.routes.ts` aggregator (like the `/profile` endpoint that already lives there).
- No other new files are truly needed.

---

## Verdict

| Phase | Plan LOC (est.)               | Minimum LOC                                 | Over-engineering factor |
| ----- | ----------------------------- | ------------------------------------------- | ----------------------- |
| 1     | ~40+ across 6 files           | ~8 in 1-2 files                             | 5x                      |
| 2     | ~60 across 2 files            | ~15 in 1 file (root cause) + ~20 (recovery) | 2x                      |
| 3     | ~20 across 2 files            | ~5 in 1 backend file                        | 4x                      |
| 4     | ~120 new file + registrations | ~15 inline in aggregator                    | 8x                      |
| 5     | ~6 in 1 file                  | ~6 in 1 file                                | 1x (appropriate)        |
| 6     | ~15 in 2 files                | ~10 in 1 file                               | 1.5x                    |

**Phases 5 and 6 are appropriately scoped.** Phases 1, 3, and 4 have the most unnecessary complexity. Phase 2 conflates debugging with deliverables.
