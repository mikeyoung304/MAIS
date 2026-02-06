# Dashboard & Onboarding Rebuild — Planning Handoff

> **Context:** This document captures decisions and findings from a production testing + brainstorming session on 2026-02-06. Use this as the starting brief for `/workflows:plan` in a fresh context window.

## The Vision

HANDLED sells an **Apple-style closed system** for service professionals. We handle everything — the user just chats with our AI agent, and by the end of the conversation, they have a website optimized for booking conversions. No decisions to make, no templates to pick, no drag-and-drop. Just talk to us and we've got it handled.

### The Onboarding Experience (4 Phases)

#### Phase 1: Discovery (Chat + "Coming Soon" Display)

- New tenant lands directly on the **build panel** (not a stats dashboard)
- Display window shows a sleek **"Your website is being created"** placeholder
- Agent asks all questions upfront — business type, services, style, pricing, story, values, testimonials
- Agent knows **exactly what information it needs** and **which section each piece maps to**
- Minimal UI: just the preview display + AI chat panel. No toolbars, no nav tabs.

#### Phase 2: The Reveal (The "Wow" Moment)

- Agent has gathered enough info → "Building your site..."
- Generates the **entire single-page scrolling site** as draft (all sections at once)
- Display window **animates** → boom, user is looking at their complete website
- This is the emotional peak of onboarding

#### Phase 3: Guided Review (Agent Drives the Preview)

- Agent scrolls preview to hero → "This is your hero section. It's designed to capture attention and communicate your transformation promise. Here's what I wrote..."
- User confirms or requests changes
- **Real-time updates** when user asks for adjustments — they see changes live in the display
- Agent moves through each section sequentially until all reviewed
- Section-by-section approval tracking

#### Phase 4: Publish

- All sections approved → "Ready to go live?" → publish everything at once
- User's storefront is live at `gethandled.ai/t/{slug}`

---

## Current Architecture (What Exists Today)

### Section System (Solid Foundation)

- **11 section types** in `BlockType` enum: HERO, ABOUT, SERVICES, PRICING, TESTIMONIALS, FAQ, CONTACT, CTA, GALLERY, FEATURES, CUSTOM
- **SectionContent table** with `isDraft` flag for draft/published state
- **SectionContentService** as single source of truth
- **Zod schemas** per section type (hero needs headline/subheadline/CTA, about needs title/body/image, etc.)
- **Default template** seeds 5 core sections visible + 6 optional

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (72px)  │  Main Content (flex)  │  AgentPanel (400px)  │
│  - Dashboard     │  ContentArea switches: │  - Always visible     │
│  - Website       │    'dashboard' → stats │  - Chat interface     │
│  - Scheduling    │    'preview' → iframe  │  - Tool results       │
│  - Revenue       │    'loading' → spinner │                       │
│  - Settings      │    'error' → error     │                       │
└─────────────────────────────────────────────────────────┘
```

### Agent Infrastructure

- **3-agent architecture**: customer-agent, tenant-agent, research-agent (Cloud Run)
- **Tenant agent tools**: 34 tools including `update_section`, `add_section`, `build_first_draft`, `store_discovery_fact`
- **Slot machine state engine**: deterministic phase advancement based on discovery fact counts
- **Session management**: localStorage persistence with backend validation
- **dashboardAction protocol**: Tools return `{type: 'NAVIGATE'|'SCROLL_TO_SECTION'|'SHOW_PREVIEW'|'REFRESH', ...}` for UI control

### Preview System

- **PreviewPanel** renders storefront in iframe with `?preview=draft&edit=true&token=JWT`
- **PostMessage protocol**: Parent ↔ iframe communication for config sync, section highlighting, click events
- **useBuildModeSync** hook on iframe side handles handshake
- **agentUIActions** (Zustand store): `showPreview()`, `highlightSection()`, `showDashboard()`, `refreshPreview()`

---

## Known Problems (From Production Testing 2026-02-06)

### Confirmed Fixed (3 bugs from PR #38)

1. ~~Preview 401~~ — Token sent as query param now (was header). **FIXED.**
2. ~~.map() crash~~ — Null guards on array fields. **FIXED.**
3. ~~build_first_draft response mismatch~~ — Matches actual API shape. **FIXED.**

### New Bugs Found During Testing

4. **PostMessage handshake failure (P0)** — Build mode iframe shows "Preview Connection Failed" every time. Root cause: timing race + 5s timeout too aggressive + draftConfig may be null during handshake. Race fix #2 from archived todo #817 was never completed.
5. **Chat appears to reset on navigation (P1)** — Session IS persisted in localStorage, but callback dependency chain instability causes re-initialization + "Connecting..." loading state on page navigation. Not actually lost, just looks like a reset.
6. **Preview shows placeholders instead of real content (P0)** — Consequence of #4. PostMessage fails → iframe never receives draft config → shows seed data instead of real content. Direct URL with `?token=` works fine.

### Architectural Debt

7. **Multi-page nav tabs** — Build mode toolbar has Home/About/Services/FAQ/Contact/Gallery/Testimonials page tabs, but architecture is now single scrolling page
8. **Dashboard default is stats, not preview** — User lands on metrics/quick-actions, not their website
9. **Full toolbar in build mode** — Has desktop/mobile toggle, refresh, open-in-new-tab, shred, save, close. Vision is minimal: just preview + chat.
10. **Agent doesn't map info → sections** — Stores facts generically but doesn't have explicit "hero needs X, about needs Y" mapping
11. **Agent doesn't drive the preview** — dashboardAction infrastructure exists but agent inconsistently triggers it
12. **No "Coming Soon" state** — No placeholder display for pre-build onboarding phase
13. **No animated reveal** — No transition from placeholder to completed site
14. **No section-by-section approval workflow** — Agent doesn't walk through sections sequentially
15. **No full-site publish** — Current model is section-by-section isDraft toggling, not "publish everything"
16. **Sidebar should be redesigned** — Current 5-item nav may not match new dashboard-first architecture

---

## Decisions Already Made

| Decision          | Choice                                                  | Rationale                            |
| ----------------- | ------------------------------------------------------- | ------------------------------------ |
| Page model        | **Single scrolling page**                               | Simpler, modern, mobile-friendly     |
| Onboarding flow   | **Questions first → build all at once → guided review** | Maximum wow factor, minimum friction |
| Preview sync      | **Agent drives the preview** (auto-scroll + highlight)  | Apple-style guided experience        |
| Build reveal      | **Animate full site at once** (not incremental)         | Emotional peak moment                |
| Draft model       | **Full-site publish** with section-by-section review    | Review individually, ship together   |
| Build mode UI     | **Minimal — just preview + chat**                       | Agent handles everything             |
| Nav tabs          | **Remove** — single page, no page tabs                  | Debt from multi-page era             |
| Dashboard default | **Preview/display window** (not stats)                  | Your site IS the dashboard           |
| Scope             | **Full stack** — agent prompt + frontend + preview      | Complete experience redesign         |
| Entire dashboard  | **Can be redesigned from scratch**                      | Set current dashboard on fire        |

---

## Section Template: What the Agent Needs to Know

### Core Sections (Every Tenant Gets These)

| #   | Section          | Agent Needs                                    | Maps From Discovery Facts                   |
| --- | ---------------- | ---------------------------------------------- | ------------------------------------------- |
| 1   | **HERO**         | Transformation headline, subheadline, CTA text | businessType, targetMarket, uniqueValue     |
| 2   | **ABOUT**        | Personal story, bio, photo description         | yearsInBusiness, personalStory, approach    |
| 3   | **SERVICES**     | Service list with descriptions + pricing       | servicesOffered, priceRange, specialization |
| 4   | **TESTIMONIALS** | Client quotes, names, context                  | testimonials (if provided)                  |
| 5   | **FAQ**          | Common questions + answers                     | Auto-generated from business context        |
| 6   | **CONTACT**      | Location, hours, contact method                | location, businessHours, contactPreference  |
| 7   | **CTA**          | Final call-to-action, booking prompt           | Same as HERO (reinforcement)                |

### Optional Sections (Agent Enables Based on Tenant)

| #   | Section      | When to Add                                                      |
| --- | ------------ | ---------------------------------------------------------------- |
| 8   | **GALLERY**  | Photographers, designers, visual portfolios                      |
| 9   | **FEATURES** | When "why choose us" differentiators are strong                  |
| 10  | **PRICING**  | When detailed tier comparison adds value (vs inline in services) |
| 11  | **CUSTOM**   | Edge cases, unique content needs                                 |

### What the Agent Should Know Per Section

For each section, the agent prompt should include:

1. **Purpose** — What this section accomplishes for conversion
2. **Required fields** — What content fields need to be filled
3. **Discovery facts needed** — Which facts from the conversation map here
4. **Quality bar** — What "good" looks like for this section type
5. **Review talking points** — What to say when walking the user through it

---

## Technical Files to Reference

### Frontend

| File                                                     | Purpose                                            |
| -------------------------------------------------------- | -------------------------------------------------- |
| `apps/web/src/app/(protected)/tenant/layout.tsx`         | Dashboard layout (sidebar + content + agent panel) |
| `apps/web/src/app/(protected)/tenant/dashboard/page.tsx` | Dashboard landing page                             |
| `apps/web/src/app/(protected)/tenant/build/page.tsx`     | Build mode redirect                                |
| `apps/web/src/components/preview/PreviewPanel.tsx`       | Preview iframe + toolbar                           |
| `apps/web/src/components/agent/AgentPanel.tsx`           | Agent chat panel + dashboardAction handling        |
| `apps/web/src/components/layouts/AdminSidebar.tsx`       | Sidebar navigation                                 |
| `apps/web/src/hooks/useTenantAgentChat.ts`               | Agent session management                           |
| `apps/web/src/stores/agent-ui-store.ts`                  | Preview/dashboard view state                       |
| `apps/web/src/lib/build-mode/protocol.ts`                | PostMessage protocol types                         |
| `apps/web/src/lib/build-mode/useBuildModeSync.ts`        | Iframe-side PostMessage handler                    |

### Backend

| File                                                       | Purpose                                |
| ---------------------------------------------------------- | -------------------------------------- |
| `server/src/services/section-content.service.ts`           | Section CRUD + publish                 |
| `server/src/lib/tenant-defaults.ts`                        | Default section template (11 sections) |
| `server/src/lib/slot-machine.ts`                           | Onboarding phase state engine          |
| `server/src/lib/block-type-mapper.ts`                      | Section type conversions               |
| `server/src/routes/internal-agent.routes.ts`               | Agent API endpoints                    |
| `packages/contracts/src/schemas/section-content.schema.ts` | Section content Zod schemas            |

### Agent

| File                                                              | Purpose                    |
| ----------------------------------------------------------------- | -------------------------- |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`         | Tenant agent system prompt |
| `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts`      | Full site generation tool  |
| `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts` | Section update tools       |
| `server/src/agent-v2/deploy/tenant/src/tools/storefront-read.ts`  | Section read tools         |

### Design Reference

| File                                     | Purpose                                      |
| ---------------------------------------- | -------------------------------------------- |
| `docs/design/VOICE_QUICK_REFERENCE.md`   | Brand voice rules                            |
| `docs/design/BRAND_VOICE_GUIDE.md`       | Extended UI/UX standards                     |
| `docs/architecture/BUILD_MODE_VISION.md` | Original build mode vision (may be outdated) |

### Compound Engineering Assets

| File                                                                                               | Purpose                                      |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `docs/solutions/patterns/POSTMESSAGE_QUICK_REFERENCE.md`                                           | PostMessage patterns                         |
| `docs/solutions/agent-issues/AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md`                                   | First draft workflow                         |
| `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`                                 | Context injection                            |
| `docs/solutions/agent-issues/ONBOARDING_AGENT_PRODUCTION_BUGS_AUTH_TRANSFORM_RESPONSE_MISMATCH.md` | Recent bug fixes                             |
| `todos/archive/817-complete-p1-preview-postmessage-race-condition.md`                              | PostMessage race condition (partially fixed) |

---

## Skills to Invoke During Planning

| Skill                                       | When                                                  |
| ------------------------------------------- | ----------------------------------------------------- |
| `frontend-design`                           | Dashboard UI/UX redesign, component architecture      |
| `agent-native-architecture`                 | Agent prompt redesign, tool behavior, onboarding flow |
| `create-agent-skills`                       | If new skills/workflows are needed                    |
| Read `docs/design/VOICE_QUICK_REFERENCE.md` | Before any UI copy decisions                          |
| Read `docs/design/BRAND_VOICE_GUIDE.md`     | For Apple-quality design standards                    |

---

## Prompt for Fresh Context Window

```
I need to plan a complete rebuild of the HANDLED tenant dashboard and onboarding experience.

Read `docs/plans/2026-02-06-dashboard-rebuild-handoff.md` for the full context — it contains:
- The vision (4-phase onboarding: discovery → reveal → guided review → publish)
- Current architecture and what exists
- 16 known problems to solve
- Decisions already made
- Technical files to reference
- Section template mapping

Then run /workflows:plan to create the implementation plan. This is a full-stack rebuild:
- Agent prompt (questions-first, knows what info maps to which section)
- Frontend (dashboard = preview by default, minimal UI, animated reveal)
- Preview system (fix PostMessage, remove multi-page tabs, agent-driven scrolling)
- Publish workflow (section-by-section review → full-site publish)

Load the `frontend-design` and `agent-native-architecture` skills for this planning session.

The current dashboard, sidebar, and build mode UI can all be redesigned from scratch.
Philosophy: Apple closed system. We've got it handled. User just chats.
```

---

## Branch Info

- **Current branch:** `feat/dashboard-onboarding-rebuild` (created from `main` at `985970a2`)
- **Working tree:** 8 modified files, UNCOMMITTED — Phase 1 complete, needs commit
- **Phase 1 status:** ALL 4 TASKS COMPLETE (1.1, 1.2, 1.3, 1.4)
- **Clean typecheck:** Both workspaces pass (`apps/web` + `server`)
