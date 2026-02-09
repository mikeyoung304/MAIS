# Dashboard UI Issues — Production Observations (2026-02-08)

> **Context:** `feat/dashboard-onboarding-rebuild` merged to `main` at commit `6f0f4f6f` (PR #41).
> All 4 onboarding phases were built (ComingSoon → Reveal → Guided Review → Publish)
> plus code review todos resolved. These issues were observed in production at gethandled.ai.

## Screenshot Reference

Taken from real browser at `gethandled.ai/tenant/dashboard` — dashboard loads correctly
with storefront preview (left) + agent panel (right). Agent connected, chat history present.

## P1 — Wrong Behavior

### 1. "Build Mode Preview" banner still showing

Green banner at top of iframe: "Build Mode Preview — Click sections to select them".
Phase 1 stripped the parent toolbar to a floating refresh button, but this banner is
rendered INSIDE the storefront iframe (build mode overlay in the storefront code at
`apps/web/src/app/t/[slug]/`). The user shouldn't see "Build Mode" language.

**Fix:** Either remove the banner entirely when in edit mode, or replace with something
subtle (e.g., thin indicator line). The storefront code that renders this banner needs
to check for the new onboarding flow and suppress it.

### 2. Multi-page nav tabs in iframe

Storefront nav shows Home / Services / About / FAQ / Contact / Book Now as separate links.
Architecture is single scrolling page — these are anchor links but visually look like page tabs.
Doesn't match the "minimal UI" vision.

**Fix:** These are part of the storefront template's navigation component. For build mode,
could hide the nav entirely or make it minimal. The storefront already has `?edit=true` param.

### 3. Old onboarding progress UI persists

Shows "●●●● Services (3/4)" with green dots and "Skip setup" button. This is the OLD
progress tracker. For a tenant mid-onboarding, should this be the ComingSoonDisplay slot
machine? For a tenant who already has content, should it show at all?

**Location:** `apps/web/src/components/agent/AgentPanel.tsx` — onboarding progress section

### 4. Agent asks instead of continuing

Agent says "Want to pick up where we left off?" instead of just continuing. Onboarding
should feel seamless — agent should continue gathering remaining facts (Services is 3/4,
meaning 1 more fact needed).

**Fix:** Agent system prompt should instruct: on return visit, summarize briefly then
immediately ask the next question. Don't ask permission to continue.

### 5. Customer chat widget visible in build mode

Teal chat bubble (bottom-right of iframe) shows in the preview. Clicking would open the
customer-facing chat inside the tenant's own preview — confusing.

**Fix:** Storefront should hide the chat widget when `?edit=true` is in the URL.
Check `apps/web/src/app/t/[slug]/` components for the chat widget rendering logic.

### 6. $0 placeholder packages in storefront

"Basic Package $0/session", "Standard Package $0/session", "Premium Package $0/session"
alongside real packages ($1,500, $2,500, $4,000). Default seed packages never cleaned up.

**Fix:** Either the agent should remove/replace seed packages during first draft, or
the seed template in `server/src/lib/tenant-defaults.ts` should not include $0 packages.

### 7. Sidebar completely gone for existing tenants

No way to navigate to Settings, Scheduling, Revenue, etc. Sidebar hidden (correct during
onboarding) but no mechanism to restore it after onboarding completes. Existing tenants
with content are stuck in onboarding-only mode.

**Location:** `apps/web/src/app/(protected)/tenant/layout.tsx` — sidebar visibility logic
tied to `useOnboardingState.ts` and `revealCompletedAt` field.

## P2 — Polish

### 8. "View your storefront" link feels redundant

The preview IS the storefront. Link opens in new tab (useful) but placed between progress
dots and chat — feels disconnected.

### 9. No FAQ or Testimonials generated

Storefront shows placeholder testimonials: "[Client Name]", "[Paste a real client
testimonial here...]". FAQ section missing entirely. Agent should generate these during
first draft based on business context.

### 10. Contact section empty

Shows "Contact information coming soon. Check back later!" despite tenant having completed
onboarding. Agent or first-draft tool should populate this.

## Architecture Issues

### 11. AgentPanel god component (746 lines)

Deferred todo #5204. Handles chat, tool results, dashboard actions, onboarding progress,
and review UI all in one file. Makes debugging extremely difficult.

### 12. ViewState doesn't match tenant lifecycle

Tenant with real content and completed onboarding still sees onboarding UI (progress dots,
skip setup, no sidebar) instead of full dashboard with navigation.

**Root cause:** `useOnboardingState.ts` phase detection may not correctly identify
post-onboarding tenants. The `revealCompletedAt` field should trigger the transition
but sidebar visibility logic may not check it.

### 13. No post-onboarding dashboard experience

After onboarding+publish, there's no transition back to a normal dashboard with sidebar,
stats, and preview. The current flow is onboarding-only — no "graduated" state.

## Key Files

| File                                                      | Purpose                         |
| --------------------------------------------------------- | ------------------------------- |
| `apps/web/src/app/(protected)/tenant/layout.tsx`          | Sidebar visibility logic        |
| `apps/web/src/components/agent/AgentPanel.tsx`            | God component (746 lines)       |
| `apps/web/src/stores/agent-ui-store.ts`                   | ViewState discriminated union   |
| `apps/web/src/hooks/useOnboardingState.ts`                | Onboarding phase detection      |
| `apps/web/src/components/dashboard/ContentArea.tsx`       | ViewState switch                |
| `apps/web/src/hooks/useTenantAgentChat.ts`                | Agent session/connection        |
| `apps/web/src/components/preview/ComingSoonDisplay.tsx`   | New onboarding display          |
| `apps/web/src/components/preview/RevealTransition.tsx`    | Animated reveal                 |
| `apps/web/src/stores/refinement-store.ts`                 | Guided review state             |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` | Agent system prompt             |
| `server/src/lib/slot-machine.ts`                          | Onboarding phase engine         |
| `server/src/lib/tenant-defaults.ts`                       | Seed template (has $0 packages) |
| `server/src/services/context-builder.service.ts`          | Bootstrap data                  |

## Prior Documentation

- `docs/plans/2026-02-06-dashboard-rebuild-handoff.md` — Original vision + decisions
- `docs/plans/2026-02-06-feat-dashboard-onboarding-rebuild-plan.md` — 1025-line impl plan
- Phase 1-4 commits: see `git log --oneline main~10..main`
