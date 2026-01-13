# Tenant Dashboard Redesign - Design Brief

## January 13, 2026

**Status:** Pre-Implementation Design Phase
**Priority:** P0 - Foundational UX Improvement

---

## Context

### Current State

- **8 navigation items** in sidebar (Dashboard, Packages, Scheduling, Branding, Pages, Payments, Domains, Settings)
- **Fragmented editing experience** - users navigate between multiple pages to edit different aspects of their website
- **Form-based editing** - color pickers, toggles, CRUD grids, separate from preview
- **Fake "Site Builder" page** - redirects to dashboard with query param to trigger preview mode
- **Redundant navigation** - multiple ways to reach the same destinations
- **Unfinished features shown** - "Coming soon" placeholders, disabled buttons

### Problems Identified

1. **Cognitive overload** - Too many top-level navigation items
2. **Disconnected workflow** - Edit in forms, preview separately
3. **Doesn't leverage agent** - AI assistant exists but editing is still manual
4. **Not Apple-quality** - Shows unfinished features, disabled buttons, bloat

---

## Proposed Solution

### **5-Item Sidebar** (down from 8)

```
1. Dashboard     - Business overview, stats, quick actions
2. Website       - Visual editor + AI (Branding + Pages + Packages consolidated)
3. Scheduling    - Appointments, availability, blackouts (consolidate sub-pages)
4. Revenue       - Stripe + Billing merged
5. Settings      - Account, domains (advanced), API keys (advanced)
```

### **Key Consolidations**

| Removed  | Merged Into         | Rationale                                       |
| -------- | ------------------- | ----------------------------------------------- |
| Branding | Website             | Color/logo/fonts are website customization      |
| Pages    | Website             | Content management is website customization     |
| Packages | Website             | Service offerings are customer-facing content   |
| Payments | Revenue             | Money-related: Stripe + subscription + invoices |
| Billing  | Revenue             | See above                                       |
| Domains  | Settings → Advanced | Power user feature, not everyday use            |

---

## Design Goals

### 1. **Agent-First Editing**

- **Current:** Navigate → Fill form → Save → Preview (separate)
- **Proposed:** Navigate → See preview → Chat to edit → Updates live

**Example flows:**

```
User: "Change my primary color to sage"
Agent: [Updates preview in real-time]

User: "Add a new wedding package for $3,500"
Agent: [Package appears in preview]

User: "Move the testimonials section above the gallery"
Agent: [Reorders sections in preview]
```

### 2. **Visual-First Interface**

The "Website" tab should feel like:

- **Left:** Page switcher (Home, About, Services, Gallery, Packages, etc.)
- **Center:** Full-page live preview (iframe showing actual site)
- **Right:** Agent panel (already exists, needs tool updates)
- **Bottom:** Quick actions (View Live Site, Manual Branding, SEO)

### 3. **Progressive Disclosure**

- **Everyday features:** Dashboard, Website, Scheduling - highly visible
- **Power user features:** Domains, API Keys - hidden in Settings → Advanced (collapsible)
- **Unfinished features:** Completely removed until ready

### 4. **Apple-Quality Standards**

Per `BRAND_VOICE_GUIDE.md`:

- No "coming soon" placeholders
- No disabled buttons in production
- No redundant navigation
- Every element has a clear purpose
- Generous whitespace (`py-32`)
- 80% neutral / 20% sage accent
- Serif headlines, sans body text
- `rounded-3xl shadow-lg` cards
- Always include hover states

---

## Website Tab - Detailed Vision

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Website Tab                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌────────────────────┐  ┌─────────────┐ │
│  │ Page Switcher   │  │                    │  │ Agent Panel │ │
│  │ (Left Sidebar)  │  │   Live Preview     │  │ (Right)     │ │
│  ├─────────────────┤  │   (Center, Full)   │  ├─────────────┤ │
│  │                 │  │                    │  │             │ │
│  │ [●] Home        │  │  ┌──────────────┐  │  │ "Change my  │ │
│  │ [ ] About       │  │  │  Your actual │  │  │  logo to... │ │
│  │ [ ] Services    │  │  │  storefront  │  │  │             │ │
│  │ [ ] Gallery     │  │  │  rendered in │  │  │ [Preview    │ │
│  │ [ ] Testimonials│  │  │  iframe      │  │  │  updated]   │ │
│  │ [●] Packages    │  │  │              │  │  │             │ │
│  │ [ ] FAQ         │  │  │  Scrollable, │  │  │ "Add a new  │ │
│  │ [ ] Contact     │  │  │  interactive │  │  │  package... │ │
│  │                 │  │  │              │  │  │             │ │
│  │ ─────────────   │  │  │              │  │  │ [Package    │ │
│  │                 │  │  │              │  │  │  appears]   │ │
│  │ 📦 8 Packages   │  │  │              │  │  │             │ │
│  │ 🎨 Branding     │  │  └──────────────┘  │  │ "Save it"   │ │
│  │ 🔍 SEO          │  │                    │  │             │ │
│  │                 │  │                    │  │ [Saved!]    │ │
│  └─────────────────┘  └────────────────────┘  └─────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┤
│  │  Quick Actions:                                             │
│  │  [View Live Site ↗] [Manual Branding] [SEO Settings]       │
│  └─────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

### Interaction Patterns

#### 1. **Page Switching**

- Click "About" in left sidebar → Center iframe navigates to `/t/{slug}/about`
- Active page highlighted (sage background)
- Badge shows section count per page
- Enabled/disabled indicator (colored dot)

#### 2. **Agent Editing**

```
User types: "Change my headline to 'Award-winning wedding photography'"
→ Agent calls branding tool with { headline: "Award-winning..." }
→ Preview updates in real-time (optimistic update)
→ API call completes → Success message
→ No page navigation required
```

#### 3. **Quick Actions**

- **"View Live Site"** - Opens `/t/{slug}` in new tab (external validation)
- **"Manual Branding"** - Opens modal with color pickers (power user fallback)
- **"SEO Settings"** - Opens modal with meta tags, descriptions

#### 4. **Package Management**

- Packages appear as sections within the "Services" or "Packages" page
- Click package in preview → Highlights in agent panel
- Agent can CRUD packages conversationally
- Delete confirmation via agent: "Are you sure? Type 'yes' to confirm"

---

## Revenue Tab - Consolidation

### Current State

- **Payments page** (`/tenant/payments`) - Stripe Connect status, onboarding
- **Billing page** (`/tenant/billing`) - Subscription tiers, AI usage

### Proposed Layout

```
┌─────────────────────────────────────────┐
│  Revenue                                │
├─────────────────────────────────────────┤
│  [Tab] Stripe Connect  |  Subscription  │
│                                         │
│  ┌─────────────────────────────────────┐
│  │  Stripe Connect Tab                 │
│  ├─────────────────────────────────────┤
│  │  Status: ✅ Connected               │
│  │  Account ID: acct_abc123...         │
│  │                                     │
│  │  ✓ Charges Enabled                  │
│  │  ✓ Payouts Enabled                  │
│  │  ✓ Details Submitted                │
│  │                                     │
│  │  [Open Stripe Dashboard ↗]          │
│  └─────────────────────────────────────┘
│                                         │
│  ┌─────────────────────────────────────┐
│  │  Subscription Tab                   │
│  ├─────────────────────────────────────┤
│  │  Current Plan: Growth ($150/mo)     │
│  │  Active since Jan 1, 2026           │
│  │                                     │
│  │  AI Messages: 523 / 5,000           │
│  │  [View Usage Details]               │
│  │                                     │
│  │  [Manage Subscription]              │
│  │  [View Invoice History]             │
│  │                                     │
│  │  ─── Change Plan ───                │
│  │  [ ] Starter ($49/mo)               │
│  │  [●] Growth ($150/mo) - Current     │
│  └─────────────────────────────────────┘
└─────────────────────────────────────────┘
```

**Benefits:**

- All money-related functionality in one place
- Tabs reduce vertical scrolling
- Invoice history added (new feature)

---

## Scheduling - Consolidation

### Current State

4 separate pages:

1. `/tenant/scheduling/appointments`
2. `/tenant/scheduling/availability`
3. `/tenant/scheduling/blackouts`
4. `/tenant/scheduling/appointment-types`

### Proposed: Single Page with Tabs

```
┌─────────────────────────────────────────┐
│  Scheduling                             │
├─────────────────────────────────────────┤
│  [Tab] Appointments | Availability |    │
│        Blackouts | Appointment Types    │
│                                         │
│  [Content for selected tab shows here]  │
└─────────────────────────────────────────┘
```

**Benefits:**

- Less clicking between pages
- Related functionality grouped visually
- Faster overview of scheduling status

---

## Settings - Simplification

### Current Issues

- API Keys section shown to all users (most never need it)
- Tenant ID displayed (debug info)
- Business Settings "coming soon" card (unfinished feature)
- Delete Account button (disabled, non-functional)
- Sign Out button (duplicate of sidebar footer)

### Proposed Structure

```
┌─────────────────────────────────────────┐
│  Settings                               │
├─────────────────────────────────────────┤
│  Account Information                    │
│  ┌─────────────────────────────────────┐
│  │  Email: user@example.com            │
│  │  Plan: Growth Plan                  │
│  └─────────────────────────────────────┘
│                                         │
│  [Collapsible] Advanced ▼               │
│  ┌─────────────────────────────────────┐
│  │  Tenant ID: cuid_abc123...          │
│  │                                     │
│  │  Custom Domains                     │
│  │  [www.example.com] [Add Domain]     │
│  │                                     │
│  │  API Keys (Developer)               │
│  │  Public Key: pk_live_...            │
│  │  [Generate Secret Key]              │
│  └─────────────────────────────────────┘
└─────────────────────────────────────────┘
```

**Changes:**

- ❌ Remove "Business Settings" card (unfinished)
- ❌ Remove "Delete Account" button (not implemented)
- ❌ Remove "Sign Out" button (duplicate)
- ✅ Move Domains to Advanced (collapsible)
- ✅ Move API Keys to Advanced (collapsible)
- ✅ Move Tenant ID to Advanced (debug info)

**Result:** Clean, focused Settings page with power features hidden by default

---

## Responsive Behavior

### Desktop (1024px+)

- Sidebar: Fixed left, 288px wide
- Website Tab: 3-column layout (page switcher | preview | agent)
- Agent Panel: Fixed right, 400px wide

### Tablet (768px - 1023px)

- Sidebar: Auto-collapsed to icons only (72px)
- Website Tab: 2-column (preview | agent stacked or side-by-side)
- Agent Panel: Collapsible overlay

### Mobile (<768px)

- Sidebar: Hamburger menu with overlay
- Website Tab: Single column, tabs for page/agent/preview
- Agent Panel: Full-screen modal

---

## Color & Typography

Per `BRAND_VOICE_GUIDE.md`:

### Colors

- **Primary:** Sage (`#6B7C5E`)
- **Accent:** Teal (CTAs, important actions)
- **Neutral:** Dark surface (`bg-surface`, `bg-surface-alt`)
- **Text:** `text-primary`, `text-muted`
- **Status:** Green (success), Amber (warning), Red (error)

### Typography

- **Headlines:** Serif (Playfair Display or similar)
- **Body:** Sans-serif (Inter)
- **Monospace:** Tenant ID, API keys, code

### Spacing

- **Generous whitespace:** `py-32` for hero sections
- **Card padding:** `p-6` to `p-8`
- **Grid gaps:** `gap-6` to `gap-8`

### Components

- **Buttons:** `rounded-full` for primary, `rounded-xl` for secondary
- **Cards:** `rounded-3xl shadow-lg`
- **Hover states:** `-translate-y-1` with shadow increase

---

## Technical Constraints

### Must Maintain

1. **Agent Panel architecture** - Already exists, works well
2. **TanStack Query caching** - 30s stale time for queries
3. **Multi-tenant isolation** - All queries scoped by tenantId
4. **Next.js App Router** - File-based routing

### Must Update

1. **Agent tools** - Add package CRUD tools for conversational editing
2. **Preview integration** - Embed storefront in iframe with postMessage communication
3. **Real-time updates** - Optimistic UI updates + cache invalidation
4. **Route structure** - Consolidate `/tenant/branding`, `/tenant/pages`, `/tenant/packages` → `/tenant/website`

---

## Success Metrics

### Quantitative

1. **Navigation depth reduced** - 8 items → 5 items (37.5% reduction)
2. **Clicks to edit website** - Currently 3-5 clicks → Target 1-2 clicks
3. **Time to preview changes** - Currently ~10 seconds → Target instant (optimistic updates)

### Qualitative

1. **Apple-quality bar** - No unfinished features, no disabled buttons
2. **Intuitive mental model** - Users understand website editing without tutorial
3. **Agent integration** - Users prefer chat over forms for common edits

---

## Open Questions for Design Review

1. **Website Tab Layout:** Should page switcher be left sidebar, top tabs, or bottom drawer?
2. **Manual Fallback:** Should "Manual Branding" modal be accessible, or force all edits through agent?
3. **Package Editing:** Should packages be editable inline in preview, or only via agent chat?
4. **Mobile Strategy:** Full parity with desktop, or simplified mobile-first workflow?
5. **Onboarding:** How do we teach users the new agent-first editing model?
6. **Search/Filter:** Does Website tab need search for large sites (100+ pages/packages)?
7. **Version History:** Should we show undo/redo or version history for website edits?

---

## Next Steps

### Phase 1: Design Review (This Phase)

1. Load `frontend-design` skill
2. Invoke `design-iterator` agent to iterate on layout mockups
3. Review with `design-implementation-reviewer` for consistency
4. Get Mike's approval on final design direction

### Phase 2: Implementation Planning

1. Run `/workflows:plan` to create technical implementation plan
2. Break down into stories (P0 quick wins, P1 consolidations, P2 enhancements)
3. Identify breaking changes and migration path

### Phase 3: Build

1. Run `/workflows:work` to execute systematically
2. Iterate on feedback
3. Run `/workflows:review` before merge

### Phase 4: Compound

1. Run `/workflows:compound` to document the redesign
2. Update onboarding to teach new interface
3. Create migration guide for existing users

---

## References

- **Audit:** `/docs/audits/tenant-dashboard-audit-2026-01-13.md`
- **Brand Guide:** `/docs/design/BRAND_VOICE_GUIDE.md`
- **Current Layout:** `/apps/web/src/app/(protected)/tenant/layout.tsx`
- **Agent Panel:** `/apps/web/src/components/agent/AgentPanel.tsx`
- **Agent UI Store:** `/apps/web/src/stores/agent-ui-store.ts`
