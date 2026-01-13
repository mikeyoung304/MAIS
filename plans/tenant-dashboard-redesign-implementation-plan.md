# Tenant Dashboard Redesign - Implementation Plan

**Project**: MAIS (gethandled.ai)
**Date**: January 13, 2026
**Status**: Ready for Implementation
**Priority**: P0 (Ship Phase 1 ASAP to validate UX direction)

---

## Overview

This plan details the implementation of a comprehensive tenant dashboard redesign that consolidates an 8-item sidebar into a streamlined 5-item structure with a unified "Website" tab featuring visual preview + AI agent editing. The redesign addresses cognitive overload, disconnected workflows, and underutilized agent capabilities while maintaining Apple-quality standards.

**Key Transformation:**

- Navigation: 8 items → 5 items (37.5% reduction)
- Clicks to edit: 3-5 clicks → 1-2 clicks
- Preview updates: ~10 seconds → Instant (optimistic)
- Edit workflow: Form-based → Agent + visual editing

**Critical Constraint:** Frontend must remain **LLM-provider-agnostic** (talks to `/api/agent/*`, backend handles provider routing). Dashboard work can proceed in parallel with backend's Vertex AI migration.

---

## Problem Statement

### Current Issues

1. **Cognitive Overload** - 8 top-level navigation items create decision fatigue
2. **Disconnected Workflow** - Edit in forms, preview separately via fake "Site Builder" page
3. **Fake Pages** - `/tenant/build` just redirects to dashboard with `?showPreview=true`
4. **Unfinished Features** - "Coming soon" placeholders, disabled buttons shown to users
5. **Redundant Navigation** - Multiple paths to same destinations (3 ways to reach Scheduling)
6. **Developer Clutter** - API Keys shown to all users (95% never need it)
7. **Not Apple-Quality** - Shows disabled buttons, unfinished features, unnecessary complexity

### User Impact

- **Service professionals** waste time navigating fragmented interface
- **Editing workflow** requires 3-5 clicks and context switching between forms and preview
- **Agent capabilities** underutilized - users don't realize AI can make changes directly
- **Mobile experience** degraded - too many navigation items for small screens

### Business Impact

- Increased support burden from confused users
- Reduced feature adoption (agent editing, package management)
- Negative brand perception (unfinished UI doesn't match "Apple-quality" positioning)
- Slower time-to-value for new customers

**Full audit**: `/docs/audits/tenant-dashboard-audit-2026-01-13.md`

---

## Proposed Solution

### Target State: 5-Item Sidebar with Unified Website Tab

| #   | Item           | Path                 | What It Includes                                      | Justification                                                    |
| --- | -------------- | -------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | **Dashboard**  | `/tenant/dashboard`  | Overview, stats, quick actions, trial status          | Central hub for business metrics                                 |
| 2   | **Website**    | `/tenant/website`    | **Branding + Pages + Packages** (NEW)                 | Visual editor with AI - all customer-facing content in one place |
| 3   | **Scheduling** | `/tenant/scheduling` | Appointments, availability, blackouts, types (tabbed) | Time-based functionality consolidated                            |
| 4   | **Revenue**    | `/tenant/revenue`    | **Payments + Billing** (NEW)                          | All money-related: Stripe Connect + subscription + invoices      |
| 5   | **Settings**   | `/tenant/settings`   | Account, domains (advanced), API keys (advanced)      | Configuration with progressive disclosure                        |

### Key Consolidations

| What Changed                              | Why                                                             |
| ----------------------------------------- | --------------------------------------------------------------- |
| Branding + Pages + Packages → **Website** | All customer-facing content editing in unified visual workspace |
| Payments + Billing → **Revenue**          | All money-related functionality in one place                    |
| Domains → Settings (Advanced)             | Power user feature, not everyday use                            |
| API Keys → Settings (Advanced)            | Developer-only, clutters UI for 95% of users                    |

### Website Tab Architecture (3-Column Layout)

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

**Component Breakdown:**

1. **Page Switcher** (240px left) - Page list with active state, search, quick stats
2. **Live Preview** (center, flex-1) - Iframe showing `/t/{slug}/{page}` with viewport controls
3. **Agent Panel** (400px right) - Existing component, no changes needed

---

## Technical Approach

### Architecture Overview

**Provider-Agnostic Design:**

```
Frontend (React/Next.js)
  ↓ POST /api/agent/chat
  ↓ POST /api/agent/proposals/:id/confirm

Next.js API Proxy (/api/agent/[...path]/route.ts)
  ↓ Proxies to ${API_BASE_URL}/v1/agent/*
  ↓ Adds auth token from session

Backend (Express)
  ↓ Multi-provider orchestration
  ↓ Routes to Anthropic OR Vertex AI

LLM Providers (backend decides)
```

**Key Principle:** Frontend never knows which LLM provider is handling requests. All provider logic lives in backend.

### State Management Strategy

**Zustand Store** (`agent-ui-store.ts`):

```typescript
interface AgentUIStore {
  tenantId: string | null;
  view: ViewState; // Discriminated union
  actionLog: ActionLogEntry[];

  // Actions
  initialize(tenantId: string): void;
  showPreview(page?: PageName): void;
  hidePreview(): void;
  highlightSection(sectionId: string): void;
  setPreviewPage(page: PageName): void;
  setError(error: string, recovery?: () => void): void;
}

type ViewState =
  | { status: 'dashboard' }
  | { status: 'preview'; config: PreviewConfig }
  | { status: 'loading'; target: 'dashboard' | 'preview' }
  | { status: 'error'; error: string; recovery?: () => void };
```

**Pattern:** Discriminated unions prevent impossible states (can't be in dashboard AND preview simultaneously).

**TanStack Query** (cache management):

- Query keys: `['branding', tenantId]`, `['packages', tenantId]`, `['pages', tenantId]`
- Optimistic updates with rollback on error
- Cache invalidation after agent tool execution (100ms delay for consistency)

### Component Architecture

**New Components:**

```
/apps/web/src/app/(protected)/tenant/website/
├── page.tsx                              # Main Website tab (3-column layout)
├── components/
│   ├── PageSwitcher.tsx                  # Left sidebar with page list
│   ├── PageSwitcherItem.tsx              # Individual page item
│   ├── PageSwitcherSearch.tsx            # Search bar for pages
│   ├── PageSwitcherStats.tsx             # Footer stats (packages, pages, sections)
│   ├── LivePreview.tsx                   # Center iframe wrapper
│   ├── LivePreviewIframe.tsx             # Iframe with postMessage handling
│   ├── LivePreviewControls.tsx           # Viewport toggle + URL bar
│   ├── LivePreviewQuickActions.tsx       # View Live + dropdown menu
│   └── LivePreviewLoadingOverlay.tsx     # Loading state during updates
└── hooks/
    ├── usePageNavigation.ts              # Page switching logic
    ├── usePreviewRefresh.ts              # postMessage to iframe
    ├── useViewportControl.ts             # Mobile/tablet/desktop toggle
    └── useLivePreviewSync.ts             # Sync store → iframe state
```

**Modified Components:**

```
/apps/web/src/components/layouts/AdminSidebar.tsx
  # Update tenantNavItems array (8 → 5 items)

/apps/web/src/app/(protected)/tenant/dashboard/page.tsx
  # Remove "Site Builder" and "Manage Pages" cards

/apps/web/src/app/(protected)/tenant/revenue/page.tsx
  # NEW - Merge Payments + Billing with tabs

/apps/web/src/app/(protected)/tenant/scheduling/page.tsx
  # MODIFY - Add tabs for sub-pages

/apps/web/src/app/(protected)/tenant/settings/page.tsx
  # MODIFY - Add collapsible Advanced section
```

### Data Flow

**Agent Editing Workflow:**

```
1. User: "Change my headline to 'Award-winning photography'"
2. AgentPanel sends: POST /api/agent/chat
3. Agent responds with tool: updateBranding({ headline: "..." })
4. Frontend shows: Loading overlay on preview
5. API call: PATCH /api/tenant-admin/branding
6. Response: 200 OK
7. Cache: queryClient.invalidateQueries(['branding'])
8. Preview: iframe.contentWindow.postMessage({ type: 'reload' })
9. Loading clears, preview shows updated headline
```

**Page Navigation Workflow:**

```
1. User clicks "About" in PageSwitcher
2. setCurrentPage('about')
3. iframe.src = `/t/${slug}/about`
4. Active state updates (sage border + bg)
5. Preview scrolls to top
```

### Iframe Communication Pattern

**Security-First PostMessage:**

```typescript
// Parent → Iframe
sendToIframe(iframe, {
  type: 'BUILD_MODE_INIT',
  config: draftConfig,
});

// Iframe → Parent
window.parent.postMessage(
  {
    type: 'BUILD_MODE_READY',
  },
  window.location.origin
);

// Origin validation (REQUIRED)
window.addEventListener('message', (event) => {
  if (!isSameOrigin(event.origin)) return; // Reject cross-origin
  const message = parseChildMessage(event.data); // Zod validation
  if (!message) return; // Reject invalid schema
  // Handle message
});
```

**Message Types:**

- `RELOAD` - Refresh iframe after API update
- `HIGHLIGHT_SECTION` - Scroll to and highlight section by ID
- `CLEAR_HIGHLIGHT` - Remove highlight
- `PAGE_CHANGE` - User navigated within iframe

---

## Implementation Phases

### Phase 1: Core Layout & Navigation (Week 1) - P0

**Goal:** Build 3-column Website tab with basic page navigation and route consolidation.

**Success Criteria:**

- ✅ Can navigate to `/tenant/website` and see 3-column layout
- ✅ Can click pages in PageSwitcher and see iframe update
- ✅ Sidebar shows 5 items (not 8)
- ✅ Old routes redirect properly (no 404s)

#### Task 1.1: Create Website Tab Route & Layout

**Files to Create:**

- `/apps/web/src/app/(protected)/tenant/website/page.tsx`

**Implementation:**

```typescript
'use client';

import { useAuth } from '@/lib/auth-client';
import { PageSwitcher } from './components/PageSwitcher';
import { LivePreview } from './components/LivePreview';
import { AgentPanel } from '@/components/agent/AgentPanel';
import { useAgentUIStore } from '@/stores/agent-ui-store';

export default function WebsitePage() {
  const { tenantId, slug } = useAuth();
  const currentPage = useAgentUIStore((state) =>
    state.view.status === 'preview' ? state.view.config.currentPage : 'home'
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Left: Page Switcher (240px) */}
      <aside className="w-60 border-r border-neutral-700 bg-surface-alt">
        <PageSwitcher currentPage={currentPage} />
      </aside>

      {/* Center: Live Preview (flex-1) */}
      <main className="flex-1 bg-neutral-800">
        <LivePreview tenantSlug={slug} currentPage={currentPage} />
      </main>

      {/* Right: Agent Panel (400px) - Already exists */}
      {/* Handled by layout.tsx */}
    </div>
  );
}
```

**Dependencies:** None
**Risk:** Low - Standard Next.js page
**Testing:** E2E test navigation to `/tenant/website`, verify layout renders

---

#### Task 1.2: Build PageSwitcher Component

**Files to Create:**

- `/apps/web/src/app/(protected)/tenant/website/components/PageSwitcher.tsx`
- `/apps/web/src/app/(protected)/tenant/website/components/PageSwitcherItem.tsx`
- `/apps/web/src/app/(protected)/tenant/website/components/PageSwitcherStats.tsx`

**PageSwitcher.tsx Implementation:**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { PageSwitcherItem } from './PageSwitcherItem';
import { PageSwitcherStats } from './PageSwitcherStats';
import { usePageNavigation } from '../hooks/usePageNavigation';

interface Page {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  sectionCount: number;
}

export function PageSwitcher({ currentPage }: { currentPage: string }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { navigateToPage } = usePageNavigation();

  useEffect(() => {
    fetch('/api/tenant-admin/pages')
      .then((res) => res.json())
      .then((data) => {
        setPages(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load pages:', err);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-neutral-700">
        <h2 className="font-semibold text-text-primary">Pages</h2>
      </div>

      {/* Page List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-surface animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {pages.map((page) => (
              <PageSwitcherItem
                key={page.id}
                page={page}
                isActive={currentPage === page.slug}
                onClick={() => navigateToPage(page.slug)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <PageSwitcherStats pages={pages} />
    </div>
  );
}
```

**PageSwitcherItem.tsx Implementation:**

```typescript
'use client';

interface PageSwitcherItemProps {
  page: {
    name: string;
    enabled: boolean;
    sectionCount: number;
  };
  isActive: boolean;
  onClick: () => void;
}

export function PageSwitcherItem({ page, isActive, onClick }: PageSwitcherItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={!page.enabled}
      className={`
        w-full px-4 py-3 rounded-xl text-left transition-all duration-200
        ${isActive
          ? 'bg-sage/10 border-l-4 border-sage text-sage'
          : 'hover:bg-surface-alt'
        }
        ${!page.enabled && 'opacity-50 cursor-not-allowed'}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${page.enabled ? 'bg-sage' : 'bg-neutral-500'}`} />
          <span className={`font-medium ${isActive ? 'text-sage' : 'text-text-primary'}`}>
            {page.name}
          </span>
        </div>
        <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full">
          {page.sectionCount} sections
        </span>
      </div>
    </button>
  );
}
```

**Dependencies:** Task 1.1 (page structure)
**Risk:** Low - Standard list component
**Testing:** Unit test active state, disabled state, click handler

---

#### Task 1.3: Build LivePreview Component

**Files to Create:**

- `/apps/web/src/app/(protected)/tenant/website/components/LivePreview.tsx`
- `/apps/web/src/app/(protected)/tenant/website/components/LivePreviewIframe.tsx`
- `/apps/web/src/app/(protected)/tenant/website/components/LivePreviewControls.tsx`
- `/apps/web/src/app/(protected)/tenant/website/components/LivePreviewQuickActions.tsx`

**LivePreview.tsx Implementation:**

```typescript
'use client';

import { useRef, useState } from 'react';
import { LivePreviewIframe } from './LivePreviewIframe';
import { LivePreviewControls } from './LivePreviewControls';
import { LivePreviewQuickActions } from './LivePreviewQuickActions';
import { LivePreviewLoadingOverlay } from './LivePreviewLoadingOverlay';

export function LivePreview({
  tenantSlug,
  currentPage
}: {
  tenantSlug: string;
  currentPage: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  return (
    <div className="relative h-full bg-neutral-800 p-4">
      {/* Top Controls */}
      <LivePreviewControls viewport={viewport} setViewport={setViewport} />

      {/* Quick Actions (top right) */}
      <LivePreviewQuickActions tenantSlug={tenantSlug} currentPage={currentPage} />

      {/* Iframe */}
      <LivePreviewIframe
        ref={iframeRef}
        tenantSlug={tenantSlug}
        currentPage={currentPage}
        viewport={viewport}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
      />

      {/* Loading Overlay */}
      {isLoading && <LivePreviewLoadingOverlay />}
    </div>
  );
}
```

**LivePreviewIframe.tsx Implementation:**

```typescript
'use client';

import { forwardRef, useEffect } from 'react';
import { usePreviewRefresh } from '../hooks/usePreviewRefresh';

interface LivePreviewIframeProps {
  tenantSlug: string;
  currentPage: string;
  viewport: 'mobile' | 'tablet' | 'desktop';
  onLoadStart: () => void;
  onLoadEnd: () => void;
}

export const LivePreviewIframe = forwardRef<HTMLIFrameElement, LivePreviewIframeProps>(
  ({ tenantSlug, currentPage, viewport, onLoadStart, onLoadEnd }, ref) => {
    const iframeUrl = `/t/${tenantSlug}/${currentPage}`;

    usePreviewRefresh(ref);  // Listen for refresh messages from agent

    const viewportClasses = {
      mobile: 'max-w-[375px]',
      tablet: 'max-w-[768px]',
      desktop: 'w-full',
    };

    return (
      <div className="flex items-center justify-center h-[calc(100%-4rem)] pt-16">
        <iframe
          ref={ref}
          src={iframeUrl}
          title="Tenant Storefront Preview"
          className={`
            h-full bg-white rounded-2xl shadow-2xl
            transition-all duration-300
            ${viewportClasses[viewport]}
          `}
          onLoad={onLoadEnd}
          onLoadStart={onLoadStart}
        />
      </div>
    );
  }
);

LivePreviewIframe.displayName = 'LivePreviewIframe';
```

**Dependencies:** Task 1.2 (page navigation triggers iframe updates)
**Risk:** Medium - Iframe performance on slow networks
**Testing:** E2E test iframe loads, viewport controls work, navigation updates URL

---

#### Task 1.4: Create Page Navigation Hook

**Files to Create:**

- `/apps/web/src/app/(protected)/tenant/website/hooks/usePageNavigation.ts`

**Implementation:**

```typescript
'use client';

import { useCallback } from 'react';
import { useAgentUIStore } from '@/stores/agent-ui-store';

export function usePageNavigation() {
  const setPreviewPage = useAgentUIStore((state) => state.setPreviewPage);
  const showPreview = useAgentUIStore((state) => state.showPreview);

  const navigateToPage = useCallback(
    (page: string) => {
      // If already in preview mode, just change page
      const currentView = useAgentUIStore.getState().view;
      if (currentView.status === 'preview') {
        setPreviewPage(page);
      } else {
        // Enter preview mode with specific page
        showPreview(page);
      }
    },
    [setPreviewPage, showPreview]
  );

  return { navigateToPage };
}
```

**Dependencies:** Agent UI store (already exists)
**Risk:** Low - Simple state update
**Testing:** Unit test state transitions

---

#### Task 1.5: Update AdminSidebar Navigation

**Files to Modify:**

- `/apps/web/src/components/layouts/AdminSidebar.tsx`

**Changes:**

```typescript
// BEFORE (8 items)
const tenantNavItems: NavItem[] = [
  { href: '/tenant/dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
  { href: '/tenant/packages', label: 'Packages', icon: <Package /> },
  { href: '/tenant/scheduling', label: 'Scheduling', icon: <Calendar /> },
  { href: '/tenant/branding', label: 'Branding', icon: <Palette /> },
  { href: '/tenant/pages', label: 'Pages', icon: <FileText /> },
  { href: '/tenant/payments', label: 'Payments', icon: <CreditCard /> },
  { href: '/tenant/domains', label: 'Domains', icon: <Globe /> },
  { href: '/tenant/settings', label: 'Settings', icon: <Settings /> },
];

// AFTER (5 items)
const tenantNavItems: NavItem[] = [
  { href: '/tenant/dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
  { href: '/tenant/website', label: 'Website', icon: <Globe />, description: 'Pages, branding, packages' },
  { href: '/tenant/scheduling', label: 'Scheduling', icon: <Calendar />, description: 'Appointments & availability' },
  { href: '/tenant/revenue', label: 'Revenue', icon: <DollarSign />, description: 'Payments & billing' },
  { href: '/tenant/settings', label: 'Settings', icon: <Settings />, description: 'Account & advanced' },
];
```

**Dependencies:** None
**Risk:** Low - Simple array update
**Testing:** Visual test - verify 5 items appear, correct labels/icons

---

#### Task 1.6: Add Route Redirects

**Files to Create:**

- `/apps/web/src/middleware.ts` (if not exists) or update existing

**Implementation:**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect old routes to new consolidated pages
  const redirects: Record<string, string> = {
    '/tenant/branding': '/tenant/website',
    '/tenant/pages': '/tenant/website',
    '/tenant/packages': '/tenant/website',
    '/tenant/payments': '/tenant/revenue',
    '/tenant/billing': '/tenant/revenue',
    '/tenant/domains': '/tenant/settings',
    '/tenant/build': '/tenant/website', // Fake "Site Builder" page
  };

  if (redirects[pathname]) {
    return NextResponse.redirect(new URL(redirects[pathname], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/tenant/:path*',
};
```

**Dependencies:** None
**Risk:** Low - Standard Next.js middleware
**Testing:** E2E test all old URLs redirect properly, no 404s

---

#### Task 1.7: Update Dashboard Page

**Files to Modify:**

- `/apps/web/src/app/(protected)/tenant/dashboard/page.tsx`

**Changes:**

```typescript
// REMOVE these quick action cards:
<Card>
  <CardHeader>Site Builder</CardHeader>
  <CardContent>
    <Button asChild>
      <Link href="/tenant/build">Open Site Builder</Link>
    </Button>
  </CardContent>
</Card>

<Card>
  <CardHeader>Manage Pages</CardHeader>
  <CardContent>
    <Button asChild>
      <Link href="/tenant/pages">Manage Pages</Link>
    </Button>
  </CardContent>
</Card>

// REPLACE with:
<Card>
  <CardHeader>Edit Website</CardHeader>
  <CardContent>
    <p className="text-sm text-text-muted mb-4">
      Visual editor with AI - manage branding, pages, and packages
    </p>
    <Button variant="sage" asChild>
      <Link href="/tenant/website">Open Website Editor</Link>
    </Button>
  </CardContent>
</Card>
```

**Dependencies:** Task 1.1 (Website route exists)
**Risk:** Low - Simple content update
**Testing:** Visual test - verify cards updated, link works

---

### Phase 2: Agent Integration (Week 1-2) - P0

**Goal:** Agent edits trigger preview updates in real-time with optimistic UI.

**Success Criteria:**

- ✅ Agent can update branding and preview refreshes automatically
- ✅ Loading overlay shows during API calls
- ✅ Cache invalidates after successful updates
- ✅ Error states handle failures gracefully

#### Task 2.1: Implement Preview Refresh Hook

**Files to Create:**

- `/apps/web/src/app/(protected)/tenant/website/hooks/usePreviewRefresh.ts`

**Implementation:**

```typescript
'use client';

import { useEffect, RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function usePreviewRefresh(iframeRef: RefObject<HTMLIFrameElement>) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Listen for cache invalidation events
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'updated' && event.action.type === 'success') {
        // Wait 100ms for READ COMMITTED isolation level
        setTimeout(() => {
          // Refresh iframe
          iframeRef.current?.contentWindow?.postMessage({ type: 'RELOAD' }, window.location.origin);
        }, 100);
      }
    });

    return () => unsubscribe();
  }, [iframeRef, queryClient]);
}
```

**Dependencies:** Task 1.3 (LivePreview iframe exists)
**Risk:** Low - Standard postMessage pattern
**Testing:** Integration test - trigger cache invalidation, verify iframe reloads

---

#### Task 2.2: Add Loading Overlay Component

**Files to Create:**

- `/apps/web/src/app/(protected)/tenant/website/components/LivePreviewLoadingOverlay.tsx`

**Implementation:**

```typescript
'use client';

import { Loader2 } from 'lucide-react';

export function LivePreviewLoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="bg-surface-alt rounded-2xl p-8 shadow-2xl border border-neutral-700">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-sage animate-spin" />
          <p className="text-text-primary font-medium">Updating preview...</p>
          <p className="text-text-muted text-sm">This may take a few seconds</p>
        </div>
      </div>
    </div>
  );
}
```

**Dependencies:** Task 1.3 (LivePreview structure)
**Risk:** Low - Simple overlay component
**Testing:** Visual test - verify overlay appears during loading

---

#### Task 2.3: Connect Agent Tools to Preview

**Files to Modify:**

- `/apps/web/src/components/agent/AgentPanel.tsx` (if needed)
- Agent tool handlers (backend - no changes needed if already using cache invalidation)

**Frontend Integration:**

```typescript
// In AgentPanel or wherever agent responses are handled
import { useQueryClient } from '@tanstack/react-query';

function handleToolCompletion(toolName: string, result: any) {
  const queryClient = useQueryClient();

  // Invalidate relevant caches based on tool
  const cacheMap: Record<string, string[]> = {
    updateBranding: ['branding'],
    createPackage: ['packages'],
    updatePackage: ['packages'],
    deletePackage: ['packages'],
    updatePage: ['pages'],
    updateSection: ['pages'],
  };

  const queryKeys = cacheMap[toolName] || [];
  queryKeys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });

  // Show preview if not already visible
  const currentView = useAgentUIStore.getState().view;
  if (currentView.status !== 'preview') {
    agentUIActions.showPreview();
  }
}
```

**Dependencies:** Task 2.1 (preview refresh hook listens to cache events)
**Risk:** Low - Uses existing cache invalidation pattern
**Testing:** Integration test - agent updates data, verify cache invalidates and preview refreshes

---

#### Task 2.4: Implement Error Handling

**Files to Modify:**

- `/apps/web/src/app/(protected)/tenant/website/components/LivePreview.tsx`

**Add Error State:**

```typescript
const [error, setError] = useState<string | null>(null);

// In iframe onError handler
const handleIframeError = () => {
  setError('Failed to load preview. Please try again.');
};

// Error UI
{error && (
  <div className="absolute inset-0 bg-surface/95 flex items-center justify-center z-10">
    <Card className="max-w-md">
      <CardHeader>
        <AlertCircle className="w-6 h-6 text-red-500" />
        <CardTitle>Preview Error</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-text-muted mb-4">{error}</p>
        <Button onClick={() => setError(null)}>Retry</Button>
      </CardContent>
    </Card>
  </div>
)}
```

**Dependencies:** Task 1.3 (LivePreview component)
**Risk:** Low - Standard error handling
**Testing:** Unit test error state, visual test error UI

---

### Phase 3: Consolidation Pages (Week 2) - P1

**Goal:** Revenue and Scheduling use tabs instead of separate pages. Settings simplified with collapsible Advanced section.

**Success Criteria:**

- ✅ `/tenant/revenue` shows Stripe + Subscription tabs
- ✅ `/tenant/scheduling` consolidates 4 sub-pages into tabs
- ✅ Settings has collapsible Advanced section with domains and API keys
- ✅ Dashboard no longer shows unfinished/disabled features

#### Task 3.1: Create Revenue Page with Tabs

**Files to Create:**

- `/apps/web/src/app/(protected)/tenant/revenue/page.tsx`

**Files to Delete:**

- `/apps/web/src/app/(protected)/tenant/payments/page.tsx`
- `/apps/web/src/app/(protected)/tenant/billing/page.tsx`

**Implementation:**

```typescript
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StripeConnectSection } from './components/StripeConnectSection';
import { SubscriptionSection } from './components/SubscriptionSection';

export default function RevenuePage() {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">Revenue</h1>
        <p className="text-text-muted mt-2">Manage payments and subscription</p>
      </div>

      <Tabs defaultValue="stripe" className="space-y-6">
        <TabsList className="bg-surface-alt">
          <TabsTrigger value="stripe">Stripe Connect</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>

        <TabsContent value="stripe">
          <StripeConnectSection />
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Dependencies:** None
**Risk:** Low - Tab consolidation pattern
**Testing:** E2E test both tabs render, content migrated correctly

---

#### Task 3.2: Update Scheduling Page with Tabs

**Files to Modify:**

- `/apps/web/src/app/(protected)/tenant/scheduling/page.tsx`

**Files to Delete:**

- `/apps/web/src/app/(protected)/tenant/scheduling/appointments/page.tsx`
- `/apps/web/src/app/(protected)/tenant/scheduling/availability/page.tsx`
- `/apps/web/src/app/(protected)/tenant/scheduling/blackouts/page.tsx`
- `/apps/web/src/app/(protected)/tenant/scheduling/appointment-types/page.tsx`

**Implementation:**

```typescript
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppointmentsSection } from './components/AppointmentsSection';
import { AvailabilitySection } from './components/AvailabilitySection';
import { BlackoutsSection } from './components/BlackoutsSection';
import { AppointmentTypesSection } from './components/AppointmentTypesSection';

export default function SchedulingPage() {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">Scheduling</h1>
        <p className="text-text-muted mt-2">Manage appointments and availability</p>
      </div>

      <Tabs defaultValue="appointments" className="space-y-6">
        <TabsList className="bg-surface-alt">
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="blackouts">Blackouts</TabsTrigger>
          <TabsTrigger value="types">Appointment Types</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments">
          <AppointmentsSection />
        </TabsContent>

        <TabsContent value="availability">
          <AvailabilitySection />
        </TabsContent>

        <TabsContent value="blackouts">
          <BlackoutsSection />
        </TabsContent>

        <TabsContent value="types">
          <AppointmentTypesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Dependencies:** None
**Risk:** Low - Tab consolidation pattern
**Testing:** E2E test all 4 tabs render, functionality preserved

---

#### Task 3.3: Simplify Settings Page

**Files to Modify:**

- `/apps/web/src/app/(protected)/tenant/settings/page.tsx`

**Files to Delete:**

- `/apps/web/src/app/(protected)/tenant/domains/page.tsx`

**Implementation:**

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { AccountSection } from './components/AccountSection';
import { DomainsSection } from './components/DomainsSection';
import { APIKeysSection } from './components/APIKeysSection';

export default function SettingsPage() {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-muted mt-2">Manage your account and preferences</p>
      </div>

      {/* Account Information */}
      <AccountSection />

      {/* Advanced (Collapsible) */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Advanced</CardTitle>
              <ChevronDown className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0">
              {/* Tenant ID */}
              <div>
                <label className="text-sm font-medium text-text-muted">Tenant ID</label>
                <input
                  type="text"
                  value={tenantId}
                  disabled
                  className="font-mono w-full mt-1 px-3 py-2 bg-surface border border-neutral-700 rounded-lg"
                />
              </div>

              {/* Custom Domains */}
              <DomainsSection />

              {/* API Keys */}
              <APIKeysSection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
```

**Changes Summary:**

- ❌ Remove "Business Settings" card (unfinished)
- ❌ Remove "Delete Account" button (not implemented)
- ❌ Remove duplicate "Sign Out" button
- ✅ Move Domains to Advanced collapsible
- ✅ Move API Keys to Advanced collapsible
- ✅ Move Tenant ID to Advanced collapsible

**Dependencies:** None
**Risk:** Low - Standard collapsible pattern
**Testing:** Visual test - verify Advanced section collapses/expands, all features work

---

### Phase 4: Mobile Responsive (Week 3) - P1

**Goal:** Usable on mobile and tablet devices with adaptive layouts.

**Success Criteria:**

- ✅ Mobile (< 768px): Tab navigation between Pages/Preview/AI
- ✅ Tablet (768-1023px): 2-column layout with collapsible agent
- ✅ Desktop (≥ 1024px): 3-column layout (unchanged)
- ✅ Tested on actual iOS and Android devices

#### Task 4.1: Create Mobile Layout with Tabs

**Files to Create:**

- `/apps/web/src/app/(protected)/tenant/website/components/MobileWebsiteLayout.tsx`

**Implementation:**

```typescript
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageSwitcher } from './PageSwitcher';
import { LivePreview } from './LivePreview';
import { AgentPanel } from '@/components/agent/AgentPanel';

export function MobileWebsiteLayout({ tenantSlug, currentPage }: any) {
  const [activeTab, setActiveTab] = useState('preview');

  return (
    <div className="h-screen flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full bg-surface-alt border-b border-neutral-700">
          <TabsTrigger value="pages" className="flex-1">Pages</TabsTrigger>
          <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
          <TabsTrigger value="ai" className="flex-1">AI</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="flex-1 overflow-auto m-0">
          <PageSwitcher currentPage={currentPage} />
        </TabsContent>

        <TabsContent value="preview" className="flex-1 overflow-auto m-0">
          <LivePreview tenantSlug={tenantSlug} currentPage={currentPage} />
        </TabsContent>

        <TabsContent value="ai" className="flex-1 overflow-auto m-0">
          <AgentPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Dependencies:** All Phase 1 components
**Risk:** Medium - Tab navigation must feel natural
**Testing:** E2E test on mobile simulator, verify tab switching works, page navigation auto-switches to Preview tab

---

#### Task 4.2: Create Tablet Layout

**Files to Create:**

- `/apps/web/src/app/(protected)/tenant/website/components/TabletWebsiteLayout.tsx`

**Implementation:**

```typescript
'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LivePreview } from './LivePreview';
import { AgentPanel } from '@/components/agent/AgentPanel';

export function TabletWebsiteLayout({ tenantSlug, currentPage, pages }: any) {
  const [agentVisible, setAgentVisible] = useState(false);

  return (
    <div className="h-screen flex flex-col">
      {/* Header with page dropdown + agent toggle */}
      <div className="border-b border-neutral-700 p-4 flex items-center gap-4 bg-surface-alt">
        <Select value={currentPage} onValueChange={(page) => navigateToPage(page)}>
          <SelectTrigger className="w-48">
            <span>{pages.find((p) => p.slug === currentPage)?.name || 'Home'}</span>
          </SelectTrigger>
          <SelectContent>
            {pages.map((page) => (
              <SelectItem key={page.id} value={page.slug}>
                {page.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => setAgentVisible(!agentVisible)}
          className="ml-auto"
        >
          {agentVisible ? 'Hide' : 'Show'} AI Assistant
        </Button>
      </div>

      {/* Content: Preview (60%) + Agent (40%) */}
      <div className="flex-1 flex">
        <div className={agentVisible ? 'w-3/5' : 'w-full'}>
          <LivePreview tenantSlug={tenantSlug} currentPage={currentPage} />
        </div>

        {agentVisible && (
          <div className="w-2/5 border-l border-neutral-700">
            <AgentPanel />
          </div>
        )}
      </div>
    </div>
  );
}
```

**Dependencies:** Phase 1 components
**Risk:** Low - Standard responsive pattern
**Testing:** E2E test on tablet viewport, verify dropdown works, agent panel toggles

---

#### Task 4.3: Add Breakpoint Detection

**Files to Modify:**

- `/apps/web/src/app/(protected)/tenant/website/page.tsx`

**Implementation:**

```typescript
'use client';

import { useBreakpoint } from '@/hooks/useBreakpoint';
import { DesktopWebsiteLayout } from './components/DesktopWebsiteLayout';
import { TabletWebsiteLayout } from './components/TabletWebsiteLayout';
import { MobileWebsiteLayout } from './components/MobileWebsiteLayout';

export default function WebsitePage() {
  const breakpoint = useBreakpoint();

  if (breakpoint.status === 'pending') {
    return <LoadingSkeleton />;
  }

  if (breakpoint.isMobile) {
    return <MobileWebsiteLayout />;
  }

  if (breakpoint.isTablet) {
    return <TabletWebsiteLayout />;
  }

  return <DesktopWebsiteLayout />;
}
```

**Dependencies:** Task 4.1, 4.2, existing useBreakpoint hook
**Risk:** Low - Hook already exists
**Testing:** E2E test at different viewport widths, verify correct layout renders

---

#### Task 4.4: Test on Actual Devices

**Testing Checklist:**

- [ ] iPhone 14 Pro (iOS 17) - Mobile layout
- [ ] iPad Air (iPadOS 17) - Tablet layout
- [ ] Samsung Galaxy S23 (Android 14) - Mobile layout
- [ ] Samsung Galaxy Tab S9 (Android 14) - Tablet layout

**Risk Areas to Validate:**

- [ ] Page switcher scrolling on mobile
- [ ] Iframe performance on mobile networks
- [ ] Tab switching feels natural
- [ ] Agent panel usable on mobile
- [ ] Touch targets meet WCAG 2.5.8 (minimum 24x24px)

**Dependencies:** Tasks 4.1-4.3
**Risk:** High - Real device testing often reveals issues
**Testing:** Manual testing on physical devices + BrowserStack

---

### Phase 5: Polish & Advanced Features (Week 3-4) - P2

**Goal:** Apple-quality finish with viewport controls, search, manual fallbacks, and welcome tour.

**Success Criteria:**

- ✅ Viewport controls (mobile/tablet/desktop toggle)
- ✅ URL bar with copy button
- ✅ Search bar in page switcher
- ✅ Quick stats in page switcher footer
- ✅ Manual branding modal (power user fallback)
- ✅ Welcome tour (5 steps, skippable)

#### Task 5.1: Add Viewport Controls

**Files to Modify:**

- `/apps/web/src/app/(protected)/tenant/website/components/LivePreviewControls.tsx`

**Implementation:**

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { Monitor, Smartphone, Tablet } from 'lucide-react';

export function LivePreviewControls({ viewport, setViewport }: any) {
  const viewports = [
    { value: 'mobile', icon: Smartphone, label: 'Mobile' },
    { value: 'tablet', icon: Tablet, label: 'Tablet' },
    { value: 'desktop', icon: Monitor, label: 'Desktop' },
  ];

  return (
    <div className="absolute top-4 left-4 z-10 bg-surface-alt rounded-full shadow-lg border border-neutral-700 p-1 flex gap-1">
      {viewports.map((v) => (
        <Button
          key={v.value}
          variant={viewport === v.value ? 'sage' : 'ghost'}
          size="sm"
          onClick={() => setViewport(v.value)}
          className="rounded-full"
        >
          <v.icon className="w-4 h-4" />
          <span className="ml-2 hidden sm:inline">{v.label}</span>
        </Button>
      ))}
    </div>
  );
}
```

**Dependencies:** Task 1.3 (LivePreview)
**Risk:** Low - Standard button group
**Testing:** Visual test - verify viewport changes iframe width

---

#### Task 5.2: Add URL Bar with Copy Button

**Files to Modify:**

- `/apps/web/src/app/(protected)/tenant/website/components/LivePreview.tsx`

**Implementation:**

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

function URLBar({ url }: { url: string }) {
  const copyURL = () => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-surface-alt rounded-full shadow-lg border border-neutral-700 px-4 py-2 flex items-center gap-2">
      <span className="text-xs font-mono text-text-muted max-w-[300px] truncate">
        {url}
      </span>
      <Button variant="ghost" size="sm" onClick={copyURL} className="h-6 w-6 p-0">
        <Copy className="w-3 h-3" />
      </Button>
      <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="w-3 h-3" />
        </a>
      </Button>
    </div>
  );
}
```

**Dependencies:** Task 1.3 (LivePreview)
**Risk:** Low - Standard copy button
**Testing:** Unit test copy functionality, toast appears

---

#### Task 5.3: Add Search Bar to Page Switcher

**Files to Create:**

- `/apps/web/src/app/(protected)/tenant/website/components/PageSwitcherSearch.tsx`

**Files to Modify:**

- `/apps/web/src/app/(protected)/tenant/website/components/PageSwitcher.tsx`

**Implementation:**

```typescript
'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function PageSwitcherSearch({
  pages,
  onFilteredPagesChange
}: {
  pages: any[];
  onFilteredPagesChange: (pages: any[]) => void;
}) {
  const [search, setSearch] = useState('');

  const filteredPages = useMemo(() => {
    if (!search) return pages;
    return pages.filter((page) =>
      page.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [pages, search]);

  useEffect(() => {
    onFilteredPagesChange(filteredPages);
  }, [filteredPages, onFilteredPagesChange]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
      <Input
        type="text"
        placeholder="Search pages..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-10 bg-surface border-neutral-700"
      />
    </div>
  );
}
```

**Dependencies:** Task 1.2 (PageSwitcher)
**Risk:** Low - Standard search filter
**Testing:** Unit test filtering logic, E2E test search works

---

#### Task 5.4: Add Quick Stats Footer

**Files to Modify:**

- `/apps/web/src/app/(protected)/tenant/website/components/PageSwitcherStats.tsx`

**Implementation:**

```typescript
'use client';

import { FileText, Package, Layout } from 'lucide-react';

export function PageSwitcherStats({ pages }: { pages: any[] }) {
  const enabledPages = pages.filter((p) => p.enabled).length;
  const totalSections = pages.reduce((sum, p) => sum + p.sectionCount, 0);
  const packageCount = 8; // TODO: Fetch from API

  return (
    <div className="p-4 border-t border-neutral-700 bg-surface space-y-2">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <FileText className="w-3 h-3" />
          <span>{enabledPages} pages</span>
        </div>
        <div className="flex items-center gap-2">
          <Layout className="w-3 h-3" />
          <span>{totalSections} sections</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Package className="w-3 h-3" />
        <span>{packageCount} packages</span>
      </div>

      <div className="pt-2 border-t border-neutral-700">
        <button className="text-xs text-sage hover:underline w-full text-left">
          🎨 Edit Branding
        </button>
        <button className="text-xs text-sage hover:underline w-full text-left mt-1">
          🔍 SEO Settings
        </button>
      </div>
    </div>
  );
}
```

**Dependencies:** Task 1.2 (PageSwitcher)
**Risk:** Low - Simple stats display
**Testing:** Visual test - verify stats accurate

---

#### Task 5.5: Add Manual Branding Modal

**Files to Create:**

- `/apps/web/src/app/(protected)/tenant/website/components/ManualBrandingDialog.tsx`

**Implementation:**

```typescript
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ManualBrandingDialog({ open, onOpenChange }: any) {
  const [form, setForm] = useState({
    primaryColor: '#45B37F',
    secondaryColor: '#1F3A3D',
    headlineFont: 'Playfair Display',
    bodyFont: 'Inter',
    logoUrl: '',
  });

  const handleSave = async () => {
    const response = await fetch('/api/tenant-admin/branding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      toast.success('Branding updated');
      onOpenChange(false);
    } else {
      toast.error('Failed to update branding');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manual Branding Editor</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="w-12 h-10 p-1"
                />
                <Input
                  type="text"
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="flex-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label>Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                  className="w-12 h-10 p-1"
                />
                <Input
                  type="text"
                  value={form.secondaryColor}
                  onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                  className="flex-1 font-mono"
                />
              </div>
            </div>
          </div>

          {/* More fields... */}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="sage" onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Dependencies:** None
**Risk:** Low - Standard form modal
**Testing:** E2E test modal opens, form submits, cache invalidates

---

#### Task 5.6: Create Welcome Tour

**Files to Create:**

- `/apps/web/src/app/(protected)/tenant/website/components/WelcomeTour.tsx`
- `/apps/web/src/hooks/useWelcomeTour.ts`

**Implementation:**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const tourSteps = [
  {
    title: 'Welcome to the Website Editor',
    content: 'Edit your entire website visually with AI assistance. Let me show you around.',
    position: 'center',
  },
  {
    title: 'Page Switcher',
    content: 'Click any page to preview it. The green dot means it\'s published.',
    position: 'left',
    target: '[data-tour="page-switcher"]',
  },
  {
    title: 'Live Preview',
    content: 'See changes instantly. Use viewport controls to test mobile/tablet.',
    position: 'center',
    target: '[data-tour="preview"]',
  },
  {
    title: 'AI Assistant',
    content: 'Just tell me what to change. "Update my headline" or "Add a new package".',
    position: 'right',
    target: '[data-tour="agent-panel"]',
  },
  {
    title: 'You\'re all set!',
    content: 'Start by telling me what you want to change, or explore on your own.',
    position: 'center',
  },
];

export function WelcomeTour({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(true);

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setVisible(false);
      onComplete();
    }
  };

  const skip = () => {
    setVisible(false);
    onComplete();
  };

  if (!visible) return null;

  const step = tourSteps[currentStep];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <Card className="max-w-md relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={skip}
          className="absolute top-2 right-2"
        >
          <X className="w-4 h-4" />
        </Button>

        <CardContent className="pt-6">
          <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
          <p className="text-text-muted mb-6">{step.content}</p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {currentStep + 1} / {tourSteps.length}
            </span>

            <div className="flex gap-2">
              <Button variant="outline" onClick={skip}>
                Skip Tour
              </Button>
              <Button variant="sage" onClick={nextStep}>
                {currentStep < tourSteps.length - 1 ? 'Next' : 'Get Started'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Hook Implementation:**

```typescript
'use client';

import { useState, useEffect } from 'react';

export function useWelcomeTour() {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('website-tour-completed');
    if (!hasSeenTour) {
      setShowTour(true);
    }
  }, []);

  const completeTour = () => {
    localStorage.setItem('website-tour-completed', 'true');
    setShowTour(false);
  };

  return { showTour, completeTour };
}
```

**Dependencies:** None
**Risk:** Low - Standard onboarding pattern
**Testing:** Visual test - verify tour appears for new users, skippable, doesn't reappear

---

## Alternative Approaches Considered

### Option 1: Separate Branding, Pages, Packages Tabs (REJECTED)

**Approach:** Keep 8 items but convert to tabbed sub-navigation within Website section.

**Pros:**

- Less radical change
- Existing routes preserved
- Easier migration

**Cons:**

- Still too many navigation items
- Doesn't address core cognitive overload issue
- Tabs add extra click (worse UX)
- Doesn't leverage visual preview + agent combo

**Decision:** Rejected - Doesn't solve core problem

---

### Option 2: Modal-Based Editing (REJECTED)

**Approach:** Keep existing pages, open preview in modal overlay.

**Pros:**

- No route changes needed
- Quick implementation
- Familiar modal pattern

**Cons:**

- Modals feel cramped for full preview
- Can't see preview + form simultaneously
- Doesn't match "Apple-quality" bar
- Modal fatigue (adds friction)

**Decision:** Rejected - Doesn't meet quality bar

---

### Option 3: Separate Preview Window (REJECTED)

**Approach:** Open preview in new browser window/tab.

**Pros:**

- Unlimited preview space
- Can use multiple monitors
- No iframe performance concerns

**Cons:**

- Window management burden (users forget about window)
- Sync state across windows complex
- Mobile unusable
- Not integrated experience

**Decision:** Rejected - Poor mobile UX, complex state sync

---

### Option 4: Feature Flag with A/B Test (CONSIDERED)

**Approach:** Ship new dashboard behind feature flag, test with subset of users.

**Pros:**

- Safe rollout
- Collect real user feedback early
- Can revert if issues found
- Measure engagement metrics

**Cons:**

- Maintains two codebases temporarily
- Feature flag complexity
- Split user experience (confusion)

**Decision:** RECOMMENDED - See Rollout Strategy below

---

## Acceptance Criteria

### Functional Requirements

#### Phase 1 (Core Layout)

- [ ] Navigate to `/tenant/website` and see 3-column layout
- [ ] Click page in PageSwitcher, iframe updates to `/t/{slug}/{page}`
- [ ] Active page shows sage border + background
- [ ] Disabled page shows 50% opacity, no click handler
- [ ] Sidebar shows 5 items (Dashboard, Website, Scheduling, Revenue, Settings)
- [ ] Old routes redirect properly (`/tenant/branding` → `/tenant/website`)
- [ ] Dashboard "Site Builder" card removed, replaced with "Edit Website"

#### Phase 2 (Agent Integration)

- [ ] Agent updates branding, preview shows loading overlay
- [ ] After API call completes, preview refreshes automatically
- [ ] Cache invalidates after successful updates (verified with React Query DevTools)
- [ ] Error states show if preview fails to load
- [ ] postMessage communication works between parent and iframe

#### Phase 3 (Consolidation Pages)

- [ ] `/tenant/revenue` shows Stripe + Subscription tabs
- [ ] Both tabs render content correctly, no missing features
- [ ] `/tenant/scheduling` shows 4 tabs (Appointments, Availability, Blackouts, Types)
- [ ] All 4 tabs functional, no broken features
- [ ] Settings has collapsible Advanced section with domains and API keys
- [ ] Unfinished features removed (Business Settings card, disabled Delete Account button)

#### Phase 4 (Mobile Responsive)

- [ ] Mobile (< 768px): Tab navigation shows Pages/Preview/AI tabs
- [ ] Tap page in Pages tab, auto-switch to Preview tab
- [ ] Tablet (768-1023px): Dropdown page selector + agent toggle button
- [ ] Desktop (≥ 1024px): 3-column layout (unchanged)
- [ ] Tested on iPhone, iPad, Android phone, Android tablet

#### Phase 5 (Polish)

- [ ] Viewport controls toggle between mobile/tablet/desktop widths
- [ ] URL bar shows current page URL with copy button
- [ ] Search bar in PageSwitcher filters pages
- [ ] Quick stats footer shows accurate counts
- [ ] Manual branding modal opens from dropdown
- [ ] Welcome tour appears for new users, skippable

### Non-Functional Requirements

#### Performance

- [ ] Preview iframe loads in < 2 seconds on 3G network
- [ ] Page switching feels instant (< 100ms perceived latency)
- [ ] Agent updates complete in < 3 seconds (P95)
- [ ] No layout shift during loading states
- [ ] Bundle size increase < 50 KB gzipped

#### Accessibility

- [ ] All interactive elements have 24x24px minimum touch target (WCAG 2.5.8)
- [ ] Color contrast meets WCAG AA (sage on dark: 4.5:1 minimum)
- [ ] Keyboard navigation works for all controls
- [ ] Screen reader announces page changes
- [ ] Focus management correct in modals

#### Security

- [ ] All iframe postMessage validates origin (`isSameOrigin()`)
- [ ] All API calls include auth token from session
- [ ] All queries filter by tenantId (no data leakage)
- [ ] Cache keys include tenantId (no cross-tenant pollution)

#### Browser Compatibility

- [ ] Works in Safari 17+ (iOS and macOS)
- [ ] Works in Chrome 120+
- [ ] Works in Firefox 120+
- [ ] Works in Edge 120+

### Quality Gates

- [ ] All TypeScript errors resolved (strict mode)
- [ ] All ESLint warnings addressed
- [ ] All unit tests pass (80% coverage minimum)
- [ ] All E2E tests pass on CI
- [ ] Manual testing completed on 4 devices (iPhone, iPad, Android phone, Android tablet)
- [ ] Code review approved by 2 reviewers
- [ ] QA sign-off received
- [ ] Documentation updated

---

## Success Metrics

### Quantitative

**Navigation Efficiency:**

- Sidebar items: 8 → 5 (37.5% reduction) ✅
- Clicks to edit website: 3-5 → 1-2 (60% reduction) 🎯
- Time to first edit: 15s → 5s (67% reduction) 🎯

**Performance:**

- Preview update time: ~10s → <1s (90% improvement) 🎯
- Agent tool latency (P95): < 3s 🎯
- Iframe load time (3G): < 2s 🎯

**Engagement:**

- Agent usage (daily active sessions): +50% 🎯
- Preview mode adoption: 90% of users 🎯
- Mobile usage: +30% 🎯

### Qualitative

**Apple-Quality Bar:**

- ✅ No unfinished features visible (no "Coming soon", disabled buttons)
- ✅ No redundant navigation (single path to each destination)
- ✅ Progressive disclosure (advanced features hidden by default)
- ✅ Generous whitespace (p-6 to p-8 spacing)
- ✅ Smooth animations (300ms transitions, ease-smooth timing)
- ✅ Hover states on all interactive elements

**User Feedback:**

- "Intuitive" rating: > 4.5/5 🎯
- "Fast" rating: > 4.5/5 🎯
- Support tickets (confusion): -40% 🎯

**Business Impact:**

- Time to value (onboarding): -30% 🎯
- Feature adoption (packages, branding): +50% 🎯
- Churn (first 30 days): -20% 🎯

---

## Dependencies & Prerequisites

### Internal Dependencies

**Required Before Starting:**

- [ ] Agent UI store working (`agent-ui-store.ts`)
- [ ] Agent Panel component functional (`AgentPanel.tsx`)
- [ ] API proxy routes active (`/api/tenant-admin/*`)
- [ ] TanStack Query configured in layout
- [ ] Auth session working (`useAuth()` hook)

**Required During Phase 1:**

- [ ] Pages API endpoint exists (`GET /api/tenant-admin/pages`)
- [ ] Branding API endpoint exists (`GET /api/tenant-admin/branding`)
- [ ] Packages API endpoint exists (`GET /api/tenant-admin/packages`)

**Required During Phase 2:**

- [ ] Agent tools trigger cache invalidation (backend)
- [ ] postMessage protocol defined (`protocol.ts`)

### External Dependencies

**NPM Packages (Already Installed):**

- `@tanstack/react-query@5.56.2` - Cache management
- `zustand@5.0.9` - State management
- `@radix-ui/react-*` - UI primitives
- `next@14` - App Router
- `react@18` - Core framework

**No New Dependencies Required** - All features use existing packages

### API Changes

**No Breaking Changes** - All existing API endpoints remain unchanged.

**Optional Enhancements (Future):**

- `GET /api/tenant-admin/pages/:pageId/sections` - For section-level editing
- `PATCH /api/tenant-admin/sections/:sectionId` - Direct section updates

---

## Risk Analysis & Mitigation

### High Risk Areas

#### 1. Iframe Performance on Mobile

**Risk:** Iframe loading slow on mobile networks, poor UX.

**Likelihood:** Medium
**Impact:** High

**Mitigation:**

- Add loading skeleton during iframe load
- Implement progressive enhancement (show static preview first)
- Use service worker for offline caching
- Test on actual 3G network (not throttled 4G)
- Set timeout and show error state after 5 seconds

**Validation:** Load test on 3G network, measure P95 load time

---

#### 2. Agent Tool Latency

**Risk:** Agent updates take >3 seconds, users lose confidence in AI.

**Likelihood:** Medium
**Impact:** Medium

**Mitigation:**

- Show optimistic updates immediately (before API call completes)
- Add progress indicators ("Updating headline...")
- Implement rollback on error
- Cache agent responses for common requests
- Use streaming for long-running operations

**Validation:** Measure P95 latency in production, set alerts for >3s

---

#### 3. Route Migration Breaking Bookmarks

**Risk:** Users have bookmarked old URLs, get confused by redirects.

**Likelihood:** High
**Impact:** Low

**Mitigation:**

- Implement permanent redirects (301) in middleware
- Add banner on first visit: "We've consolidated the dashboard!"
- Track redirect analytics to identify high-traffic old URLs
- Keep redirects indefinitely (no cleanup)

**Validation:** Monitor 404 errors, ensure zero increase after launch

---

#### 4. Mobile Tab Navigation Feels Unnatural

**Risk:** Users expect different interaction on mobile, tabs feel desktop-y.

**Likelihood:** Medium
**Impact:** Medium

**Mitigation:**

- Use Vaul drawer for agent (bottom sheet feels native)
- Auto-switch to Preview tab when page selected
- Add swipe gestures for tab switching
- Test with 10+ non-technical users before launch

**Validation:** User testing with 10 photographers/coaches (target audience)

---

#### 5. Cross-Browser Iframe Issues

**Risk:** Safari handles iframes differently, postMessage fails.

**Likelihood:** Low
**Impact:** High

**Mitigation:**

- Test in Safari 17+ on iOS and macOS
- Use standard postMessage API (no polyfills needed)
- Add origin validation on every message
- Implement fallback: "Refresh preview" button if postMessage fails

**Validation:** Manual testing in Safari, Chrome, Firefox, Edge

---

### Medium Risk Areas

#### 6. Cache Invalidation Race Conditions

**Risk:** Preview refreshes before backend commit, shows stale data.

**Likelihood:** Medium
**Impact:** Low

**Mitigation:**

- Add 100ms delay after cache invalidation (READ COMMITTED isolation)
- Use optimistic updates with rollback on error
- Show "Syncing..." indicator during delay

**Validation:** Integration test with simulated latency

---

#### 7. TypeScript Strict Mode Errors

**Risk:** Strict mode catches errors in existing code during refactor.

**Likelihood:** High
**Impact:** Low

**Mitigation:**

- Run `npm run typecheck` before each commit
- Use discriminated unions (impossible states prevented by types)
- Add `// @ts-expect-error` with comment if library limitation

**Validation:** CI fails on TypeScript errors

---

#### 8. Bundle Size Increase

**Risk:** New components increase bundle, slow page load.

**Likelihood:** Low
**Impact:** Low

**Mitigation:**

- Lazy-load PreviewPanel and ManualBrandingDialog
- Use dynamic imports for heavy components
- Analyze bundle with `next build --analyze`
- Set budget: < 50 KB gzipped increase

**Validation:** Compare bundle size before/after, block if >50 KB increase

---

### Low Risk Areas

#### 9. Welcome Tour Annoys Power Users

**Risk:** Tour appears every time, users can't dismiss permanently.

**Likelihood:** Low
**Impact:** Low

**Mitigation:**

- Use localStorage to track completion
- Add "Don't show again" checkbox
- Allow dismissal with Escape key or X button

**Validation:** Manual testing, verify tour doesn't reappear

---

#### 10. Manual Branding Modal Conflicts with Agent

**Risk:** User edits in modal, agent edits same field, conflict.

**Likelihood:** Low
**Impact:** Low

**Mitigation:**

- Show warning if agent recently edited branding
- Merge changes intelligently (last-write-wins for each field)
- Add timestamp to branding API response

**Validation:** Integration test with simulated conflict

---

## Resource Requirements

### Team

**Frontend Developer (Lead):**

- Phase 1-2: 5 days
- Phase 3-5: 5 days
- **Total:** 10 days (2 weeks)

**Backend Developer (Support):**

- No API changes needed
- Cache invalidation verification: 1 day
- **Total:** 1 day

**Designer (Review):**

- Review mockups: 2 hours
- Approve color scheme: 1 hour
- **Total:** 0.5 days

**QA Engineer:**

- E2E test creation: 2 days
- Manual device testing: 2 days
- Regression testing: 1 day
- **Total:** 5 days (1 week)

**Product Manager:**

- User research: 1 day
- Acceptance criteria review: 0.5 days
- Launch planning: 0.5 days
- **Total:** 2 days

### Timeline

**Total Duration:** 3-4 weeks

| Phase                       | Duration | Dependencies     |
| --------------------------- | -------- | ---------------- |
| Phase 1 (Core Layout)       | Week 1   | None             |
| Phase 2 (Agent Integration) | Week 1-2 | Phase 1          |
| Phase 3 (Consolidation)     | Week 2   | Phase 1          |
| Phase 4 (Mobile)            | Week 3   | Phase 1, 2, 3    |
| Phase 5 (Polish)            | Week 3-4 | Phase 1, 2, 3, 4 |
| Testing & QA                | Week 4   | All phases       |

**Parallelization:**

- Phase 2 & 3 can run in parallel (different files)
- Phase 5 tasks can start during Phase 4 (independent)

### Infrastructure

**No Infrastructure Changes Required**

- Same hosting (Vercel/similar)
- Same database (PostgreSQL)
- Same API endpoints
- Same CDN

**Optional Enhancements:**

- Service worker for offline preview caching
- Redis cache for agent responses (if latency issues)

---

## Future Considerations

### Phase 6: Package Inline Editing (P2)

**Goal:** Edit packages directly in preview (hover overlay + inline editor).

**Approach:**

- Hover package card → edit icon overlay
- Click → inline editor modal
- Save → PATCH `/api/tenant-admin/packages/:id`

**Benefits:**

- Faster package editing
- Visual feedback (see changes in context)
- Less context switching

**Timeline:** 1 week after Phase 5 stable

---

### Phase 7: Section-Level Highlighting (P2)

**Goal:** Agent can highlight specific sections in preview.

**Approach:**

- Agent returns section ID in tool response
- Frontend sends postMessage: `{ type: 'HIGHLIGHT_SECTION', sectionId }`
- Iframe scrolls to section + adds highlight overlay

**Benefits:**

- User knows exactly what changed
- Better feedback loop (agent → user)

**Timeline:** 2 weeks after Phase 5 stable

---

### Phase 8: Real-Time Collaboration (P3)

**Goal:** Multiple users can edit same website simultaneously.

**Approach:**

- WebSocket connection for real-time updates
- Operational transforms for conflict resolution
- Cursor presence indicators

**Benefits:**

- Team collaboration
- Coach + service professional editing together

**Timeline:** 6+ months (major feature)

---

### Phase 9: Version History & Undo (P3)

**Goal:** Users can view previous versions and revert changes.

**Approach:**

- Event sourcing already scaffolded in agent-ui-store
- Store snapshots of branding/pages/packages
- Add "History" tab with timeline

**Benefits:**

- Safety net for mistakes
- Audit trail for compliance

**Timeline:** 3 months (requires backend changes)

---

## Documentation Plan

### Developer Documentation

**Files to Create:**

- `/docs/architecture/WEBSITE_TAB_ARCHITECTURE.md` - Technical deep dive
- `/docs/guides/IFRAME_COMMUNICATION.md` - PostMessage protocol guide
- `/docs/guides/MOBILE_RESPONSIVE_PATTERNS.md` - Breakpoint strategies

**Files to Update:**

- `/ARCHITECTURE.md` - Add Website tab section
- `/DEVELOPING.md` - Update routes list
- `/docs/design/BRAND_VOICE_GUIDE.md` - Add new components

### User Documentation

**Files to Create:**

- `/docs/user-guides/WEBSITE_EDITOR.md` - User-facing guide
- `/docs/user-guides/MOBILE_EDITING.md` - Mobile-specific tips

**In-App Help:**

- Welcome tour (5 steps, skippable)
- Tooltips on key UI elements
- Help icon → knowledge base link

### Code Comments

**JSDoc for Complex Logic:**

- Discriminated union narrowing patterns
- Cache invalidation timing (100ms delay explanation)
- PostMessage origin validation rationale

**README Updates:**

- Add Website tab to features list
- Update screenshots
- Add troubleshooting section

---

## References & Research

### Internal References

**Architecture Decisions:**

- Agent UI store: `/apps/web/src/stores/agent-ui-store.ts:1-250`
- Admin sidebar: `/apps/web/src/components/layouts/AdminSidebar.tsx:1-273`
- Tenant layout: `/apps/web/src/app/(protected)/tenant/layout.tsx:1-150`
- Content area: `/apps/web/src/components/dashboard/ContentArea.tsx:1-166`

**Existing Patterns:**

- Dashboard page: `/apps/web/src/app/(protected)/tenant/dashboard/page.tsx:1-322`
- Branding page: `/apps/web/src/app/(protected)/tenant/branding/page.tsx:1-357`
- Agent panel: `/apps/web/src/components/agent/AgentPanel.tsx:1-555`

**State Management:**

- Zustand store: `/apps/web/src/stores/agent-ui-store.ts`
- Draft config hook: `/apps/web/src/hooks/useDraftConfig.ts`
- Breakpoint hook: `/apps/web/src/hooks/useBreakpoint.ts`

**API Integration:**

- Tenant admin proxy: `/apps/web/src/app/api/tenant-admin/[...path]/route.ts:1-144`
- Agent proxy: `/apps/web/src/app/api/agent/[...path]/route.ts`

**Styling:**

- Tailwind config: `/apps/web/tailwind.config.js`
- Card component: `/apps/web/src/components/ui/card.tsx:1-118`
- Global styles: `/apps/web/src/app/globals.css`

### External References

**Framework Documentation:**

- Next.js 14 App Router: https://nextjs.org/docs/app
- React 18 Hooks: https://react.dev/reference/react
- Zustand Best Practices: https://docs.pmnd.rs/zustand/getting-started/introduction
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/overview
- Radix UI: https://www.radix-ui.com/primitives/docs/overview/introduction

**Best Practices:**

- Discriminated Unions in TypeScript: https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions
- PostMessage Security: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
- WCAG 2.5.8 Target Size: https://www.w3.org/WAI/WCAG21/Understanding/target-size.html
- React Query Optimistic Updates: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

**Design References:**

- Apple HIG (Navigation): https://developer.apple.com/design/human-interface-guidelines/navigation
- Material Design (Bottom Navigation): https://m3.material.io/components/navigation-bar/overview
- Responsive Design Patterns: https://responsivedesign.is/patterns/

### Related Work

**Previous PRs:**

- (No direct PRs yet - greenfield feature)

**Related Issues:**

- #XXX - "Dashboard navigation too complex"
- #XXX - "Preview mode doesn't update"
- #XXX - "Mobile dashboard unusable"

**Design Documents:**

- `/docs/audits/tenant-dashboard-audit-2026-01-13.md` - Current state audit
- `/docs/design/tenant-dashboard-redesign-brief.md` - Design brief
- `/docs/design/BRAND_VOICE_GUIDE.md` - Brand standards
- `/plans/tenant-dashboard-redesign-planning-context.md` - Planning context

---

## Rollout Strategy

### Option A: Feature Flag with Gradual Rollout (RECOMMENDED)

**Approach:** Ship behind feature flag, enable for subset of users, monitor metrics, roll out to 100%.

**Implementation:**

```typescript
// Feature flag check
const useNewDashboard = useFeatureFlag('new-dashboard-ui');

if (useNewDashboard) {
  return <NewWebsitePage />;
} else {
  return <OldDashboardPages />;
}
```

**Rollout Stages:**

1. **Internal (Week 1):** Enable for team only (5 users)
   - Dogfood testing
   - Fix critical bugs
   - Refine UX based on team feedback

2. **Beta (Week 2):** Enable for 10% of users (opt-in)
   - Invite power users to beta test
   - Collect qualitative feedback
   - Measure engagement metrics (session duration, agent usage)

3. **Gradual Rollout (Week 3-4):** 25% → 50% → 75% → 100%
   - Monitor error rates, latency, user satisfaction
   - Pause if metrics degrade
   - Revert if critical issues found

**Metrics to Monitor:**

- Error rate (< 1% increase)
- Agent usage (> 50% increase)
- Session duration (> 20% increase)
- Support tickets (< 10% increase)
- User satisfaction (> 4.5/5)

**Rollback Plan:**

- Toggle feature flag off if error rate > 2%
- Revert to old dashboard within 5 minutes
- No data loss (API unchanged)

**Timeline:** 4 weeks from dev complete to 100% rollout

---

### Option B: Big Bang Deployment (NOT RECOMMENDED)

**Approach:** Ship to 100% of users on launch day.

**Pros:**

- Faster time to value (no gradual rollout delay)
- Single codebase (no feature flag complexity)
- Clear launch date for marketing

**Cons:**

- High risk (no safety net if critical issue)
- Can't revert without full rollback
- No early feedback from real users
- Support team unprepared for sudden change

**Decision:** NOT RECOMMENDED - Too risky for such a major UX change

---

### Option C: Parallel Deployment with User Toggle (ALTERNATIVE)

**Approach:** Ship both old and new dashboards, let users toggle in settings.

**Pros:**

- Users can revert if they prefer old UX
- Collect direct feedback ("Why did you switch back?")
- Safe rollout (users in control)

**Cons:**

- Maintains two codebases indefinitely
- Split user experience (support complexity)
- Users may not discover new dashboard

**Decision:** ALTERNATIVE - Consider if feature flag rollout shows resistance

---

## Migration Guide for Users

### What's Changing?

**You'll see:**

- ✅ 5 navigation items instead of 8 (simpler!)
- ✅ New "Website" tab with visual preview + AI editing
- ✅ All branding, pages, and packages in one place
- ✅ Instant preview updates when AI makes changes
- ✅ Mobile-friendly layout with tabs

**You won't lose:**

- ❌ Any data (everything stays in database)
- ❌ Any features (just reorganized)
- ❌ Any bookmarks (old URLs redirect automatically)

### Where Did Things Go?

| Old Location   | New Location                         |
| -------------- | ------------------------------------ |
| Branding →     | Website tab (left sidebar)           |
| Pages →        | Website tab (left sidebar)           |
| Packages →     | Website tab (preview + quick stats)  |
| Payments →     | Revenue tab (Stripe Connect section) |
| Billing →      | Revenue tab (Subscription section)   |
| Domains →      | Settings → Advanced (collapsible)    |
| Site Builder → | Website tab (unified editor)         |

### Tips for Success

1. **Start with the Website tab** - This is where you'll spend most of your time
2. **Try the AI** - Tell it "Change my headline" or "Add a new package"
3. **Use the preview** - See changes instantly without publishing
4. **Explore the viewport controls** - Test how your site looks on mobile
5. **Take the welcome tour** - 2-minute intro to new features

### Need Help?

- **In-app help**: Click the ? icon in top right
- **Knowledge base**: https://docs.gethandled.ai/dashboard-redesign
- **Support**: support@gethandled.ai or chat in bottom right

---

## Breaking Changes

**NONE** - This is a non-breaking change.

**API contracts unchanged:**

- All existing API endpoints work identically
- No database migrations required
- No environment variable changes

**Frontend changes only:**

- New routes added (`/tenant/website`, `/tenant/revenue`)
- Old routes redirect (no 404s)
- Components reorganized (no functional changes)

**Backwards compatibility:**

- Old URLs redirect permanently (301)
- Feature flag allows rollback if needed
- No user data migration required

---

## Appendix: Component Specifications

### PageSwitcher Component

**File:** `/apps/web/src/app/(protected)/tenant/website/components/PageSwitcher.tsx`

**Props:**

```typescript
interface PageSwitcherProps {
  currentPage: string;
}
```

**State:**

```typescript
const [pages, setPages] = useState<Page[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [searchQuery, setSearchQuery] = useState('');
```

**Hooks:**

- `usePageNavigation()` - Navigate to page
- `useEffect()` - Fetch pages on mount

**Subcomponents:**

- `PageSwitcherItem` - Individual page row
- `PageSwitcherSearch` - Search bar
- `PageSwitcherStats` - Footer stats

---

### LivePreview Component

**File:** `/apps/web/src/app/(protected)/tenant/website/components/LivePreview.tsx`

**Props:**

```typescript
interface LivePreviewProps {
  tenantSlug: string;
  currentPage: string;
}
```

**State:**

```typescript
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
```

**Hooks:**

- `usePreviewRefresh(iframeRef)` - Listen for cache events, refresh iframe
- `useRef<HTMLIFrameElement>()` - Iframe reference

**Subcomponents:**

- `LivePreviewIframe` - Iframe wrapper
- `LivePreviewControls` - Viewport toggle
- `LivePreviewQuickActions` - View Live + dropdown
- `LivePreviewLoadingOverlay` - Loading state

---

### usePageNavigation Hook

**File:** `/apps/web/src/app/(protected)/tenant/website/hooks/usePageNavigation.ts`

**Returns:**

```typescript
interface UsePageNavigationReturn {
  navigateToPage: (page: string) => void;
}
```

**Dependencies:**

- `useAgentUIStore` - Update preview state
- `useCallback` - Stable function reference

---

### usePreviewRefresh Hook

**File:** `/apps/web/src/app/(protected)/tenant/website/hooks/usePreviewRefresh.ts`

**Params:**

```typescript
iframeRef: RefObject<HTMLIFrameElement>;
```

**Logic:**

- Subscribe to TanStack Query cache events
- On successful mutation, wait 100ms
- Send postMessage to iframe: `{ type: 'RELOAD' }`

**Dependencies:**

- `useQueryClient()` - Access query cache
- `useEffect()` - Subscribe on mount

---

## End of Implementation Plan

**Next Steps:**

1. ✅ Present plan to team for feedback
2. ⏳ Create GitHub issue with this plan
3. ⏳ Break down into tickets (one per task)
4. ⏳ Begin Phase 1 implementation
5. ⏳ Set up feature flag infrastructure

**Questions? Contact:**

- Product: [PM name]
- Engineering Lead: [Lead name]
- Design: [Designer name]

---

**This plan is ready for implementation.** 🚀
