# Tenant Dashboard Redesign - Planning Context

## Handoff Document for Implementation Planning

**Date**: January 13, 2026
**Project**: MAIS (gethandled.ai)
**Task**: Create implementation plan for tenant dashboard redesign
**Status**: Design validated, ready for implementation planning

---

## Executive Summary

We are redesigning the tenant dashboard from an 8-item sidebar with fragmented form-based editing to a 5-item sidebar with a unified "Website" tab that combines visual preview + AI agent editing. This addresses cognitive overload, disconnected workflows, and underutilized agent capabilities.

**Key Metrics:**

- Sidebar navigation: 8 items → 5 items (37.5% reduction)
- Clicks to edit website: 3-5 clicks → 1-2 clicks
- Preview updates: ~10 seconds → Instant (optimistic updates)

**Critical Constraint:** Dashboard must remain **LLM-provider-agnostic** (frontend talks to `/api/agent/*`, backend handles provider routing). The backend is migrating to multi-provider orchestration (Anthropic + Vertex AI) in parallel, so dashboard cannot depend on specific LLM implementation details.

---

## Current State Analysis

### Existing Sidebar (8 items)

1. Dashboard - `/tenant/dashboard`
2. Packages - `/tenant/packages`
3. Scheduling - `/tenant/scheduling`
4. Branding - `/tenant/branding`
5. Pages - `/tenant/pages`
6. Payments - `/tenant/payments`
7. Domains - `/tenant/domains`
8. Settings - `/tenant/settings`

### Problems Identified

1. **Cognitive overload** - Too many top-level navigation items
2. **Disconnected workflow** - Edit in forms, preview separately via fake "Site Builder" page
3. **Fake pages** - `/tenant/build` just redirects to dashboard with `?showPreview=true`
4. **Unfinished features shown** - "Coming soon" placeholders, disabled buttons
5. **Redundant navigation** - Multiple paths to same destinations (3 ways to reach Scheduling)
6. **Developer features cluttering UI** - API Keys shown to all users (most never need it)
7. **Not Apple-quality** - Shows disabled buttons, unfinished features, bloat

**See full audit:** `/docs/audits/tenant-dashboard-audit-2026-01-13.md`

---

## Target State

### New Sidebar (5 items)

| #   | Item           | Path                 | What It Includes                                                  | Justification                                                    |
| --- | -------------- | -------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | **Dashboard**  | `/tenant/dashboard`  | Overview, stats, quick actions, trial status                      | Central hub for business metrics                                 |
| 2   | **Website**    | `/tenant/website`    | **Branding + Pages + Packages** (consolidated)                    | Visual editor with AI - all customer-facing content in one place |
| 3   | **Scheduling** | `/tenant/scheduling` | Appointments, availability, blackouts, appointment types (tabbed) | Time-based functionality                                         |
| 4   | **Revenue**    | `/tenant/revenue`    | **Payments + Billing** (consolidated)                             | All money-related: Stripe Connect + subscription + invoices      |
| 5   | **Settings**   | `/tenant/settings`   | Account, domains (advanced), API keys (advanced)                  | Configuration with progressive disclosure                        |

### Key Consolidations

| What Changed                          | Why                                          |
| ------------------------------------- | -------------------------------------------- |
| Branding + Pages + Packages → Website | All are customer-facing content editing      |
| Payments + Billing → Revenue          | All money-related functionality              |
| Domains → Settings (Advanced)         | Power user feature, not everyday use         |
| API Keys → Settings (Advanced)        | Developer-only, clutters UI for 95% of users |

---

## Website Tab - Detailed Design Specification

### Layout (Desktop 1920px)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Existing      │  Page Switcher │     Live Preview      │  Existing   │
│  Sidebar       │  (NEW)         │     (NEW)            │  Agent Panel│
│  288px         │  240px         │     992px            │  400px      │
│  (unchanged)   │                │     (flex-1)         │  (unchanged)│
├────────────────┼────────────────┼──────────────────────┼─────────────┤
│                │                │                      │             │
│  Dashboard     │  [●] Home      │  ┌────────────────┐  │  Chat       │
│  Website       │  [ ] About     │  │                │  │  messages   │
│  Scheduling    │  [ ] Services  │  │  Live preview  │  │  ...        │
│  Revenue       │  [ ] Gallery   │  │  (iframe       │  │             │
│  Settings      │  [●] Packages  │  │   showing      │  │  "Change    │
│                │  [ ] FAQ       │  │   /t/{slug})   │  │   my logo"  │
│  [User]        │  [ ] Contact   │  │                │  │             │
│  [Logout]      │                │  │  Scrollable,   │  │  [Preview   │
│                │  ────────────  │  │  responsive)   │  │   updates]  │
│                │                │  │                │  │             │
│                │  📦 8 Packages │  │  [Viewport     │  │  [Input]    │
│                │  🎨 Branding   │  │   controls]    │  │             │
│                │  🔍 SEO        │  │  [View Live ↗] │  │             │
│                │                │  └────────────────┘  │             │
└────────────────┴────────────────┴──────────────────────┴─────────────┘
```

### Components Breakdown

#### 1. **Page Switcher** (Left, 240px)

**Visual Design:**

```tsx
// Active page
<div className="px-4 py-3 bg-sage/10 border-l-4 border-sage rounded-r-xl">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 rounded-full bg-sage" /> {/* Enabled indicator */}
      <span className="font-medium text-sage">Home</span>
    </div>
    <span className="text-xs text-sage bg-sage/20 px-2 py-0.5 rounded-full">
      4 sections
    </span>
  </div>
</div>

// Disabled page
<div className="px-4 py-3 opacity-50">
  <div className="flex items-center gap-3">
    <div className="w-2 h-2 rounded-full bg-neutral-500" />
    <span className="text-text-muted">Gallery</span>
  </div>
</div>
```

**Features:**

- Click page → iframe navigates to `/t/{slug}/{page}`
- Active page: sage left border + sage bg + sage text
- Disabled page: 50% opacity, no click handler
- Section count badge per page
- Enabled/disabled dot indicator
- Search bar at top (for scalability)
- Quick stats at bottom (packages, published pages, sections)

#### 2. **Live Preview** (Center, flex-1, min 768px)

**Structure:**

```tsx
<div className="flex-1 bg-neutral-800 p-4">
  {/* Viewport controls - top left */}
  <div className="absolute top-4 left-4 z-10 bg-surface-alt rounded-full shadow-lg">
    <Button onClick={() => setViewport('mobile')}>📱</Button>
    <Button onClick={() => setViewport('tablet')}>📲</Button>
    <Button onClick={() => setViewport('desktop')}>🖥️</Button>
  </div>

  {/* URL bar - top center */}
  <div className="bg-surface-alt border-b border-neutral-700 px-4 py-2">
    <span className="text-xs font-mono">
      gethandled.ai/t/{slug}/{page}
    </span>
    <Button onClick={copyURL}>📋</Button>
  </div>

  {/* Iframe */}
  <iframe
    src={`/t/${slug}/${currentPage}`}
    className="w-full h-full bg-white rounded-2xl shadow-2xl"
  />

  {/* Quick actions - top right (floating) */}
  <div className="absolute top-4 right-4 z-10">
    <Button variant="sage" asChild>
      <a href={`/t/${slug}`} target="_blank">
        View Live ↗
      </a>
    </Button>
    <DropdownMenu>
      <DropdownMenuItem>Manual Branding</DropdownMenuItem>
      <DropdownMenuItem>SEO Settings</DropdownMenuItem>
    </DropdownMenu>
  </div>

  {/* Loading overlay - during updates */}
  {isUpdating && (
    <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm">
      <Spinner />
      <p>Updating preview...</p>
    </div>
  )}
</div>
```

**Features:**

- Responsive viewport controls (mobile/tablet/desktop)
- URL indicator with copy button
- Floating "View Live" button (sage, primary action)
- Dropdown for manual fallbacks (branding, SEO)
- Loading overlay during agent updates
- postMessage communication with iframe for refresh

#### 3. **Agent Panel** (Right, 400px - ALREADY EXISTS)

**No changes needed** - Existing `AgentPanel` component at `/apps/web/src/components/agent/AgentPanel.tsx`

**Integration points:**

- Uses `useAgentChat({ apiUrl: '/api/agent' })`
- Calls `agentUIActions.showPreview()` when tools complete
- Receives tool results and triggers preview refresh
- postMessage to iframe: `{ type: 'reload' }`

---

## Mobile Responsive Strategy

### Mobile (< 768px): Tab Navigation

```
┌──────────────────────────┐
│ [Pages] [Preview] [AI]   │ ← Tabs
├──────────────────────────┤
│                          │
│  Full-screen tab content │
│                          │
└──────────────────────────┘
```

**Behavior:**

- Pages tab: Full list of pages
- Preview tab: Full-width iframe
- AI tab: Full-screen agent chat (existing Vaul drawer)
- Tap page in Pages tab → auto-switch to Preview tab

### Tablet (768px - 1023px): 2-Column

```
┌────────────────────────────────┐
│ [Page Dropdown ▼] [Agent Toggle] │
├──────────────────┬─────────────┤
│  Preview (60%)   │ Agent (40%) │
└──────────────────┴─────────────┘
```

**Behavior:**

- Page switcher → dropdown in header
- Agent panel → collapsible (toggle button)
- Preview takes majority of space

---

## Interaction Patterns

### Pattern 1: Agent-First Editing

```
User: "Change my headline to 'Award-winning wedding photography'"

Agent: "got it. updating."
→ Optimistic UI: Preview shows loading overlay
→ API: PATCH /api/tenant/branding { headline: "Award-winning..." }
→ Response: 200 OK
→ Preview: iframe.contentWindow.postMessage({ type: 'reload' })
Agent: "done. [highlight home-hero-main] check it."
```

**Key:** Optimistic updates with loading states (NOT instant, there's latency)

### Pattern 2: Package Management (Hybrid)

```
Creation (Agent):
User: "Add a new wedding package for $3,500"
Agent: "got it. creating."
→ POST /api/tenant/packages { name: "Wedding", price: 3500 }
Agent: "done. want to customize? click it in preview or keep chatting."

Editing (Inline):
- Hover package card in preview → edit icon overlay
- Click → inline editor pops up
- Changes save immediately: PATCH /api/tenant/packages/:id
```

**Rationale:** Agent for fast creation, visual for precise editing

### Pattern 3: Page Switching

```
User clicks "About" in page switcher
→ setCurrentPage('about')
→ iframe.src = `/t/${slug}/about`
→ Active state updates (sage border + bg)
→ Preview scrolls to top
```

### Pattern 4: Manual Branding Fallback

```
User clicks "Manual Branding" in dropdown
→ Modal opens with existing branding form
→ Color pickers, font dropdown, logo URL
→ Save → PATCH /api/tenant/branding
→ Preview refreshes
```

**Rationale:** Power users want direct control, graceful degradation if agent fails

---

## Revenue Tab - Consolidation Design

### Current State

- `/tenant/payments` - Stripe Connect status, onboarding
- `/tenant/billing` - Subscription tiers, AI usage

### New State: `/tenant/revenue` with tabs

```tsx
<div>
  <Tabs defaultValue="stripe">
    <TabsList>
      <TabsTrigger value="stripe">Stripe Connect</TabsTrigger>
      <TabsTrigger value="subscription">Subscription</TabsTrigger>
    </TabsList>

    <TabsContent value="stripe">
      {/* Existing Payments page content */}
      <Card>
        <CardHeader>Stripe Status</CardHeader>
        <CardContent>
          Status: ✅ Connected Charges Enabled: Yes Payouts Enabled: Yes
          <Button>Open Stripe Dashboard ↗</Button>
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="subscription">
      {/* Existing Billing page content */}
      <Card>
        <CardHeader>Current Plan</CardHeader>
        <CardContent>
          Growth Plan - $150/month AI Messages: 523 / 5,000
          <Button>Manage Subscription</Button>
          <Button>View Invoice History</Button>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
</div>
```

**Benefits:** All money-related functionality in one place

---

## Scheduling - Consolidation Design

### Current State (4 separate pages)

1. `/tenant/scheduling/appointments`
2. `/tenant/scheduling/availability`
3. `/tenant/scheduling/blackouts`
4. `/tenant/scheduling/appointment-types`

### New State: `/tenant/scheduling` with tabs

```tsx
<Tabs defaultValue="appointments">
  <TabsList>
    <TabsTrigger value="appointments">Appointments</TabsTrigger>
    <TabsTrigger value="availability">Availability</TabsTrigger>
    <TabsTrigger value="blackouts">Blackouts</TabsTrigger>
    <TabsTrigger value="types">Appointment Types</TabsTrigger>
  </TabsList>

  <TabsContent value="appointments">{/* Existing appointments page content */}</TabsContent>

  {/* ... other tabs */}
</Tabs>
```

**Benefits:** Less clicking, everything visible at once

---

## Settings - Simplification Design

### Current Issues

- API Keys shown to all users (most never need it)
- Tenant ID displayed (debug info)
- "Coming soon" Business Settings card
- Disabled Delete Account button
- Duplicate Sign Out button

### New Structure

```tsx
<div className="space-y-6">
  {/* Account Information */}
  <Card>
    <CardHeader>Account</CardHeader>
    <CardContent>
      <Label>Email</Label>
      <Input value={user.email} disabled />
    </CardContent>
  </Card>

  {/* Advanced (Collapsible) */}
  <Collapsible>
    <CollapsibleTrigger>
      <ChevronDown /> Advanced
    </CollapsibleTrigger>
    <CollapsibleContent>
      {/* Tenant ID */}
      <div>
        <Label>Tenant ID</Label>
        <Input value={tenantId} disabled className="font-mono" />
      </div>

      {/* Custom Domains */}
      <div>
        <Label>Custom Domains</Label>
        {/* Existing domains page content moved here */}
      </div>

      {/* API Keys */}
      <div>
        <Label>API Keys (Developer)</Label>
        <Input value={publicKey} disabled />
        <Button>Copy</Button>
      </div>
    </CollapsibleContent>
  </Collapsible>
</div>
```

**Changes:**

- ❌ Remove "Business Settings" card (unfinished)
- ❌ Remove "Delete Account" button (not implemented)
- ❌ Remove "Sign Out" button (duplicate of sidebar)
- ✅ Move Domains to Advanced
- ✅ Move API Keys to Advanced
- ✅ Move Tenant ID to Advanced

---

## Technical Architecture

### Frontend Integration Points (PROVIDER-AGNOSTIC)

```typescript
// Current implementation - DO NOT CHANGE
useAgentChat({ apiUrl: '/api/agent' })
  → POST /api/agent/chat
  → POST /api/agent/proposals/:id/confirm
  → GET /api/agent/health
```

**Critical:** Frontend talks to `/api/agent/*`, which proxies to `/v1/agent/*` on backend. Backend handles LLM provider routing (Anthropic, Vertex AI, etc.). Dashboard must remain provider-agnostic.

### API Routes (Next.js)

```
/api/agent/[...path]/route.ts
  → Proxies to ${API_BASE_URL}/v1/agent/${path}
  → Adds auth token from session
  → Handles all HTTP methods (GET, POST, PUT, PATCH, DELETE)

/api/tenant-admin/[...path]/route.ts
  → Proxies to ${API_BASE_URL}/v1/tenant-admin/${path}
  → For tenant-scoped endpoints (packages, branding, etc.)
```

**No changes needed** - Existing proxy routes work for redesign

### Agent UI Store (Zustand)

```typescript
// apps/web/src/stores/agent-ui-store.ts
interface AgentUIStore {
  tenantId: string | null;
  currentView: 'dashboard' | 'preview' | 'loading' | 'error';
  previewConfig: {
    currentPage: PageName;
    highlightedSectionId: string | null;
  };

  // Actions
  initialize(tenantId: string): void;
  showPreview(page: PageName): void;
  hidePreview(): void;
  goToDashboard(): void;
}

export const agentUIActions = {
  showPreview: (page: PageName) => useAgentUIStore.getState().showPreview(page),
  // ... other actions
};
```

**Usage in agent tools:**

```typescript
// When agent completes branding update
agentUIActions.showPreview('home');
// Triggers preview mode in UI
```

### React Query Cache

```typescript
// TanStack Query config
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds
      retry: 1,
    },
  },
});

// Cache invalidation after agent updates
queryClient.invalidateQueries({ queryKey: ['branding'] });
queryClient.invalidateQueries({ queryKey: ['packages'] });
```

---

## File Structure Changes

### New Files to Create

```
apps/web/src/app/(protected)/tenant/
├── website/
│   ├── page.tsx                    # NEW - Website tab with 3-column layout
│   ├── components/
│   │   ├── PageSwitcher.tsx        # NEW - Left sidebar with page list
│   │   ├── LivePreview.tsx         # NEW - Center iframe with controls
│   │   ├── ViewportControls.tsx    # NEW - Mobile/tablet/desktop toggle
│   │   └── QuickActions.tsx        # NEW - View Live + dropdowns
│   └── hooks/
│       ├── usePageNavigation.ts    # NEW - Page switching logic
│       └── usePreviewRefresh.ts    # NEW - postMessage to iframe
```

### Files to Modify

```
apps/web/src/app/(protected)/tenant/
├── revenue/
│   └── page.tsx                    # MODIFY - Add tabs (Stripe | Subscription)
├── scheduling/
│   └── page.tsx                    # MODIFY - Add tabs (Appointments | Availability | Blackouts | Types)
├── settings/
│   └── page.tsx                    # MODIFY - Collapsible Advanced section
└── dashboard/
    └── page.tsx                    # MODIFY - Remove "Site Builder" + "Manage Pages" cards
```

### Files to Delete

```
apps/web/src/app/(protected)/tenant/
├── branding/
│   └── page.tsx                    # DELETE - Merged into /website
├── pages/
│   └── page.tsx                    # DELETE - Merged into /website
├── packages/
│   └── page.tsx                    # DELETE - Merged into /website
├── payments/
│   └── page.tsx                    # DELETE - Merged into /revenue
├── billing/
│   └── page.tsx                    # DELETE - Merged into /revenue
├── domains/
│   └── page.tsx                    # DELETE - Moved to Settings (Advanced)
└── build/
    └── page.tsx                    # DELETE - Fake redirect page
```

### Component Updates

```
apps/web/src/components/layouts/AdminSidebar.tsx
  # MODIFY - Update tenantNavItems array (8 → 5 items)

  const tenantNavItems: NavItem[] = [
    { href: '/tenant/dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
    { href: '/tenant/website', label: 'Website', icon: <Globe /> },        // NEW
    { href: '/tenant/scheduling', label: 'Scheduling', icon: <Calendar /> },
    { href: '/tenant/revenue', label: 'Revenue', icon: <DollarSign /> },   // NEW
    { href: '/tenant/settings', label: 'Settings', icon: <Settings /> },
  ];
```

---

## Implementation Phases

### Phase 1: Core Layout (P0) - Week 1

**Goal:** Build 3-column Website tab, route consolidation, basic navigation

**Tasks:**

1. Create `/tenant/website/page.tsx` with 3-column layout
2. Build `PageSwitcher` component (240px left sidebar)
3. Build `LivePreview` component (center iframe)
4. Integrate existing `AgentPanel` (right, 400px)
5. Implement page navigation (click page → iframe updates)
6. Update `AdminSidebar` nav items (8 → 5)
7. Add redirects: `/tenant/branding` → `/tenant/website`, etc.

**Success Metric:** Can navigate between pages and see preview

### Phase 2: Agent Integration (P0) - Week 1-2

**Goal:** Agent edits trigger preview updates in real-time

**Tasks:**

1. Add optimistic UI (loading overlay during updates)
2. Implement postMessage to iframe for refresh
3. Connect agent tools to preview actions (`agentUIActions.showPreview()`)
4. Cache invalidation after tool execution
5. Error states if preview fails to load

**Success Metric:** Agent can edit, preview updates in real-time

### Phase 3: Consolidation Pages (P1) - Week 2

**Goal:** Revenue and Scheduling use tabs instead of separate pages

**Tasks:**

1. Merge `/tenant/payments` + `/tenant/billing` → `/tenant/revenue` (tabs)
2. Consolidate `/tenant/scheduling/*` sub-pages → single page with tabs
3. Move Domains to Settings (Advanced, collapsible)
4. Clean up Settings (remove unfinished features, move API Keys to Advanced)
5. Update dashboard (remove "Site Builder" and "Manage Pages" cards)

**Success Metric:** All 5 nav items functional, no dead pages

### Phase 4: Mobile Responsive (P1) - Week 3

**Goal:** Usable on mobile and tablet

**Tasks:**

1. Implement tab navigation for mobile (< 768px)
2. Implement 2-column layout for tablet (768-1023px)
3. Breakpoint detection (`useBreakpoint` hook)
4. Test on actual iOS/Android devices

**Success Metric:** Usable on iPhone + iPad

### Phase 5: Polish (P2) - Week 3-4

**Goal:** Apple-quality finish

**Tasks:**

1. Viewport controls (mobile/tablet/desktop toggle)
2. URL bar with copy button
3. Search bar in page switcher
4. Quick stats in page switcher footer
5. Welcome tour (5-step, skippable)
6. Manual branding modal (power user fallback)
7. Package inline editing in preview

**Success Metric:** Feels polished, matches brand standards

---

## Brand Standards (CRITICAL)

From `/docs/design/BRAND_VOICE_GUIDE.md`:

### Colors (Graphite Dark Theme)

- **Surface:** `#18181B` (bg-surface)
- **Cards:** `#27272A` (bg-surface-alt)
- **Borders:** `#3F3F46` (border-neutral-700)
- **Text Primary:** `#FAFAFA` (text-text-primary)
- **Text Muted:** `#A1A1AA` (text-text-muted)
- **Sage Accent:** `#45B37F` (#45B37F, used for active states, CTAs)
- **Teal CTAs:** (for important actions)

### Typography

- **Headlines:** Serif (Playfair Display or similar) - **NOT in admin UI**
- **Body:** Sans-serif (Inter)
- **Monospace:** Tenant ID, API keys (`font-mono`)

### Components

- **Cards:** `rounded-3xl shadow-lg`
- **Buttons Primary:** `rounded-full` (sage or teal)
- **Buttons Secondary:** `rounded-xl` (outline)
- **Hover states:** `-translate-y-1` with shadow increase

### Spacing

- **Card padding:** `p-6` to `p-8`
- **Grid gaps:** `gap-6` to `gap-8`
- **Page padding:** `p-6 lg:p-8`

### Principles

- ✅ Every element has a purpose
- ✅ No dead ends or unfinished features
- ✅ No redundancy
- ✅ Progressive disclosure (advanced features hidden by default)
- ✅ Generous whitespace
- ✅ Always include hover states

---

## Risk Areas to Validate Early

1. **Iframe performance** - Test postMessage on slow networks, ensure preview loads fast
2. **Agent tool latency** - Measure P95, add loading states if >500ms
3. **Mobile tab switching** - Test on actual iOS devices (not just browser sim)
4. **Package inline editing** - Ensure edit modal doesn't break on mobile
5. **Route redirects** - Test old URLs redirect properly (no 404s for bookmarked pages)

---

## Success Metrics

### Quantitative

- Navigation depth: 8 items → 5 items (37.5% reduction) ✅
- Clicks to edit website: 3-5 → 1-2 ✅
- Preview update time: ~10s → <1s (optimistic) ✅

### Qualitative

- Apple-quality bar: No unfinished features, no disabled buttons ✅
- Intuitive mental model: Users understand without tutorial ✅
- Agent integration: Users prefer chat over forms ✅

---

## Key References

### Documents

- **Audit:** `/docs/audits/tenant-dashboard-audit-2026-01-13.md`
- **Design Brief:** `/docs/design/tenant-dashboard-redesign-brief.md`
- **Brand Guide:** `/docs/design/BRAND_VOICE_GUIDE.md`
- **Vertex AI Context:** `/plans/vertex-ai-migration-executive-report.md`

### Current Implementation

- **Layout:** `/apps/web/src/app/(protected)/tenant/layout.tsx`
- **Dashboard:** `/apps/web/src/app/(protected)/tenant/dashboard/page.tsx`
- **Agent Panel:** `/apps/web/src/components/agent/AgentPanel.tsx`
- **Agent UI Store:** `/apps/web/src/stores/agent-ui-store.ts`
- **Agent Hook:** `/apps/web/src/hooks/useAgentChat.ts`
- **API Proxy:** `/apps/web/src/app/api/agent/[...path]/route.ts`

---

## Questions for Planning Agent

When creating the implementation plan, please address:

1. **Route Migration Strategy:** How to handle old URLs? (redirects, backwards compatibility)
2. **Component Reuse:** Which existing components can be reused vs need rebuild?
3. **Testing Strategy:** What needs E2E tests vs unit tests?
4. **Rollout Plan:** Big bang or incremental? (e.g., feature flag for new dashboard)
5. **Breaking Changes:** Any API contract changes needed?
6. **Performance:** Bundle size impact of new components?
7. **Migration Path:** How do existing users transition? (guide, announcement, etc.)

---

## Planning Directive

**Task:** Create a comprehensive implementation plan for this dashboard redesign using `/workflows:plan`.

**Output Should Include:**

1. **Phase-by-phase breakdown** (P0, P1, P2) with specific tasks
2. **File changes** (create, modify, delete) with file paths
3. **Component specifications** (props, state, hooks)
4. **Testing requirements** (E2E, unit, integration)
5. **Risk mitigation** (what to validate early)
6. **Rollout strategy** (feature flag, incremental, etc.)
7. **Timeline estimate** (realistic weeks per phase)
8. **Breaking changes** (if any)
9. **Migration guide** (for existing users)

**Context:** This is a foundational UX improvement. The backend is simultaneously migrating to multi-provider LLM orchestration (Anthropic + Vertex AI), but the frontend must remain provider-agnostic. Dashboard work can proceed in parallel with backend migration.

**Priority:** Ship Phase 1 (core layout) ASAP to validate UX direction, then iterate based on user feedback.

---

## End of Context Document

**This document contains everything needed to create the implementation plan. Good luck!** 🚀
