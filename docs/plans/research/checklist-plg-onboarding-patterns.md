# Checklist-Driven Onboarding & PLG Setup Patterns

Research compiled 2026-02-20. Sources: UserPilot, ProductLed, Appcues, Chameleon, Amplitude, GrowthMates.

## 1. Derive Checklist State from Data, Don't Store It Separately

- Compute completion from actual DB state (e.g., `hasLogo: !!tenant.branding?.logo`). Single source of truth, never stale.
- Store only user-initiated overrides: explicit skips (`skippedAt` timestamp) and manual dismissals.
- Pattern: `ChecklistItem { id, label, check: (tenant) => boolean, skippable, weight, action }`.
- Re-derive on every dashboard load. Cheap query, eliminates sync bugs between checklist table and real data.

## 2. Progress Calculation: Weighted, Not Equal

- Weight items by business impact: connecting Stripe (weight 3) matters more than uploading a logo (weight 1).
- Formula: `completedWeight / totalWeight * 100`, excluding skipped items from denominator.
- Display as percentage + fraction ("4 of 7 steps" alongside "68% complete"). Users respond to both.

## 3. Checklist Positioning

- **Best: Collapsible sidebar panel** on dashboard. Always visible, never blocking. Stripe and Linear use this.
- **Alternative: Top banner** with progress bar that collapses to a pill showing "3 of 7 done" after first interaction.
- **Avoid: Full-page overlay** post-signup. It blocks exploration. Notion moved away from this.
- **Mobile: Bottom sheet** that slides up, showing next 2 items. Full list accessible via "See all steps".

## 4. Dismissable Items and Skip Logic

- Every non-critical item gets a "Skip for now" action. Skipping stores `{ itemId, skippedAt, reason? }`.
- Skipped items move to a "Skipped" section at bottom, recoverable with one click.
- Critical items (e.g., connect payment processor) cannot be skipped -- mark with a lock icon and explain why.
- "Dismiss entire checklist" option after 60%+ completion. Saves preference, resurfaces only on new feature launches.

## 5. One-Click Actionable Items

Each checklist item maps to exactly one action type:

- **navigate**: Route to the relevant settings page (`/settings/branding`).
- **modal**: Open inline modal (e.g., connect Stripe OAuth flow).
- **agent-prompt**: Pre-load an AI chat message ("Help me write my About section") and open the chat panel.
- **external**: Open external link in new tab (e.g., domain DNS setup guide).
- Never require more than one click to start the task from the checklist.

## 6. Celebration Moments

- **Per-item**: Subtle checkmark animation + brief toast ("Branding updated. Nice."). No confetti per item.
- **Milestones**: Confetti burst at 50% and 100%. Match brand voice -- "Your site is halfway there" / "You're live."
- **100% completion**: Celebratory full-width banner that auto-dismisses after 10 seconds. CTA: "View your live site."
- Asana's flying unicorn works because it's rare. Overuse kills delight. Max 3 celebration moments per onboarding.

## 7. Auto-Dismissal

- When all non-skipped items complete, show the 100% celebration for one session, then auto-hide checklist.
- Replace with a persistent "Setup complete" badge in sidebar that links to a settings hub.
- If user adds a new integration later that creates new checklist items, resurface the checklist panel.

## 8. Agent-Driven Checklist Awareness

- AI agent reads checklist state and suggests the highest-impact incomplete item contextually.
- Example: User opens chat, agent says "Your services page has no pricing yet. Want me to help set that up?"
- Agent should not nag. Suggest once per session, only when the user initiates conversation.
- Agent can auto-complete checklist items via tool calls (e.g., `updateBranding` tool marks branding step done).

## 9. Gamification: What Works vs What Feels Forced

**Works:** Progress bars, completion percentages, milestone celebrations, "streak" indicators for daily logins.
**Forced:** Points systems, leaderboards, badges for basic setup tasks. B2SMB users want efficiency, not games.
Guideline: Gamification should reduce perceived effort, not add artificial reward layers.

## 10. Status-Based Routing (When Checklist vs Dashboard)

```
CREATED -> ONBOARDING -> SETUP -> ACTIVE -> CHURNED
```

- `CREATED`: Redirect to onboarding conversation (AI-guided initial setup).
- `ONBOARDING`: Show onboarding flow, block dashboard access.
- `SETUP`: Show dashboard WITH checklist panel prominently open. This is the key PLG state.
- `ACTIVE`: Show dashboard, checklist hidden (accessible from settings).
- Route guard: middleware checks `tenant.onboardingStatus` on every authed request.
- Transition `SETUP -> ACTIVE` at 80%+ completion OR explicit "I'm done" click. Don't require 100%.

## 11. Data Migration: Boolean to Enum Status

- Add `onboardingStatus` enum column with default `SETUP` (safe for existing tenants).
- Backfill: `UPDATE tenant SET onboardingStatus = 'ACTIVE' WHERE onboardingComplete = true`.
- Deploy code that reads new enum. Verify in production for 1 week.
- Drop old `onboardingComplete` boolean column in follow-up migration.
- Never rename columns in Prisma -- add new, migrate data, remove old.

## 12. A/B Testing Checklist Order

- Test "quick wins first" (logo, colors) vs "high impact first" (Stripe, services) ordering.
- Metric: Time to ACTIVE status and 30-day retention rate.
- Segment by persona: photographers may prefer visual tasks first, coaches prefer content tasks.
- Implementation: Store `checklistVariant` on tenant, randomize at creation time.

## 13. Mobile Responsiveness

- Checklist renders as a bottom sheet (slide-up panel), not sidebar.
- Show only the next incomplete item + progress bar. "See all" expands to full list.
- Action buttons must be thumb-reachable (bottom 60% of screen).
- Progress pill persists in mobile nav bar showing "4/7".
