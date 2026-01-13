# Tenant Dashboard Redesign - Implementation Plan v2 (Simplified)

**Project**: MAIS (gethandled.ai)
**Date**: January 13, 2026
**Status**: Ready for Implementation
**Priority**: P0 (Ship Phase 1-3 in Week 1)
**Version**: 2.0 (Revised based on review feedback)

---

## Revision Summary

**Changes from v1:**

- ✂️ Removed Phase 5 (Polish) - defer to v2 based on user feedback
- 📦 Consolidated 15+ components into 3 core files
- 🪝 Removed 4 trivial hooks - logic inlined in components
- 📱 Simplified responsive with CSS Grid (not 3 separate layouts)
- 🔒 Added TypeScript improvements (no `any` types, Zod validation)
- ⚡ Aggressive timeline: Phase 1-3 in Week 1

**Result:** ~1,800 lines (down from 3,500), 8 files (down from 25)

---

## Overview

This plan details the implementation of a tenant dashboard redesign that consolidates an 8-item sidebar into a streamlined 5-item structure with a unified "Website" tab featuring visual preview + AI agent editing.

**Key Transformation:**

- Navigation: 8 items → 5 items (37.5% reduction)
- Clicks to edit: 3-5 clicks → 1-2 clicks
- Preview updates: ~10 seconds → Instant (optimistic)
- Edit workflow: Form-based → Agent + visual editing

**Critical Constraint:** Frontend must remain **LLM-provider-agnostic** (talks to `/api/agent/*`, backend handles provider routing).

---

## Problem Statement

### Current Issues

1. **Cognitive Overload** - 8 top-level navigation items create decision fatigue
2. **Disconnected Workflow** - Edit in forms, preview separately via fake "Site Builder" page
3. **Fake Pages** - `/tenant/build` just redirects to dashboard with `?showPreview=true`
4. **Unfinished Features** - "Coming soon" placeholders, disabled buttons shown to users
5. **Redundant Navigation** - Multiple paths to same destinations
6. **Developer Clutter** - API Keys shown to all users (95% never need it)

**Full audit**: `/docs/audits/tenant-dashboard-audit-2026-01-13.md`

---

## Proposed Solution

### Target State: 5-Item Sidebar with Unified Website Tab

| #   | Item           | Path                 | What It Includes                      |
| --- | -------------- | -------------------- | ------------------------------------- |
| 1   | **Dashboard**  | `/tenant/dashboard`  | Overview, stats, quick actions        |
| 2   | **Website**    | `/tenant/website`    | **Branding + Pages + Packages** (NEW) |
| 3   | **Scheduling** | `/tenant/scheduling` | Appointments (tabbed)                 |
| 4   | **Revenue**    | `/tenant/revenue`    | **Payments + Billing** (NEW)          |
| 5   | **Settings**   | `/tenant/settings`   | Account, domains (advanced)           |

### Website Tab Architecture (3-Column Layout)

```
┌──────────────────────────────────────────────────────────┐
│  Sidebar │  Page Switcher │  Live Preview │  Agent Panel│
│  288px   │  240px         │  flex-1       │  400px      │
├──────────┼────────────────┼───────────────┼─────────────┤
│          │  [●] Home      │  ┌──────────┐ │  Chat       │
│ Dashboard│  [ ] About     │  │ iframe   │ │  messages   │
│ Website  │  [ ] Services  │  │ showing  │ │  ...        │
│ Scheduling│ [●] Packages  │  │ /t/slug  │ │             │
│ Revenue  │  [ ] FAQ       │  └──────────┘ │  [Input]    │
│ Settings │                │               │             │
└──────────┴────────────────┴───────────────┴─────────────┘
```

---

## Technical Approach

### Architecture

**Provider-Agnostic Design:**

```
Frontend → /api/agent/* → Backend → LLM Provider (Anthropic/Vertex AI)
```

Frontend never knows which LLM provider is handling requests.

### State Management

**Zustand Store** (`agent-ui-store.ts`) - Already exists, no changes needed:

```typescript
type ViewState =
  | { status: 'dashboard' }
  | { status: 'preview'; config: PreviewConfig }
  | { status: 'loading'; target: 'dashboard' | 'preview' }
  | { status: 'error'; error: string; recovery?: () => void };
```

**TanStack Query** - Cache management:

- Query keys: `['branding', tenantId]`, `['packages', tenantId]`, `['pages', tenantId]`
- Optimistic updates with rollback on error
- Cache invalidation triggers preview refresh

### Component Architecture (Simplified)

**New Files (8 total):**

```
/apps/web/src/app/(protected)/tenant/website/
├── page.tsx                      # Main Website tab (~100 lines)
└── components/
    ├── PageSwitcher.tsx          # Left sidebar (~200 lines, includes items/search/stats)
    └── LivePreview.tsx           # Center iframe (~200 lines, includes controls/loading)

/apps/web/src/app/(protected)/tenant/
├── revenue/page.tsx              # Stripe + Billing tabs (~150 lines)
├── scheduling/page.tsx           # Appointments tabs (~150 lines)
└── settings/page.tsx             # Account + Advanced collapsible (~150 lines)

/apps/web/src/components/layouts/
└── AdminSidebar.tsx              # MODIFY: Update nav items (8 → 5)
```

**Removed from v1:**

- ❌ `PageSwitcherItem.tsx` - Inlined in `PageSwitcher.tsx`
- ❌ `PageSwitcherSearch.tsx` - Inlined in `PageSwitcher.tsx`
- ❌ `PageSwitcherStats.tsx` - Inlined in `PageSwitcher.tsx`
- ❌ `LivePreviewIframe.tsx` - Inlined in `LivePreview.tsx`
- ❌ `LivePreviewControls.tsx` - Inlined in `LivePreview.tsx`
- ❌ `LivePreviewQuickActions.tsx` - Inlined in `LivePreview.tsx`
- ❌ `LivePreviewLoadingOverlay.tsx` - Inlined in `LivePreview.tsx`
- ❌ `usePageNavigation.ts` - Logic inlined in components
- ❌ `usePreviewRefresh.ts` - Logic inlined in components
- ❌ `useViewportControl.ts` - Just useState, not needed
- ❌ `useLivePreviewSync.ts` - Covered by React Query
- ❌ `MobileWebsiteLayout.tsx` - Using CSS Grid instead
- ❌ `TabletWebsiteLayout.tsx` - Using CSS Grid instead
- ❌ All of Phase 5 (welcome tour, manual modal, etc.)

---

## Implementation Phases

### Phase 1: Core Layout & Navigation (Days 1-2) - P0

**Goal:** Build 3-column Website tab with page navigation and route consolidation.

**Success Criteria:**

- ✅ Navigate to `/tenant/website` and see 3-column layout
- ✅ Click pages in PageSwitcher, iframe updates
- ✅ Sidebar shows 5 items
- ✅ Old routes redirect properly

#### Task 1.1: Create Website Tab Page

**File:** `/apps/web/src/app/(protected)/tenant/website/page.tsx`

**Implementation:**

```typescript
'use client';

import { useAuth } from '@/lib/auth-client';
import { PageSwitcher } from './components/PageSwitcher';
import { LivePreview } from './components/LivePreview';
import { useAgentUIStore } from '@/stores/agent-ui-store';

export default function WebsitePage(): JSX.Element {
  const { slug } = useAuth();
  const currentPage = useAgentUIStore((state) =>
    state.view.status === 'preview' ? state.view.config.currentPage : 'home'
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] h-[calc(100vh-4rem)] gap-0">
      {/* Left: Page Switcher - hidden on mobile, shown in drawer */}
      <aside className="hidden lg:block border-r border-neutral-700 bg-surface-alt">
        <PageSwitcher currentPage={currentPage} />
      </aside>

      {/* Center: Live Preview */}
      <main className="bg-neutral-800">
        <LivePreview tenantSlug={slug} currentPage={currentPage} />
      </main>

      {/* Right: Agent Panel handled by layout.tsx (400px) */}
    </div>
  );
}
```

**Key Points:**

- ✅ CSS Grid responsive layout (not 3 separate components)
- ✅ Explicit return type (`JSX.Element`)
- ✅ Zustand selector for current page
- ✅ Mobile: PageSwitcher hidden (drawer added in Phase 4)

**Time:** 2 hours
**Testing:** E2E test navigation to `/tenant/website`

---

#### Task 1.2: Build PageSwitcher Component (Consolidated)

**File:** `/apps/web/src/app/(protected)/tenant/website/components/PageSwitcher.tsx`

**Implementation (~200 lines, includes everything):**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAgentUIStore } from '@/stores/agent-ui-store';
import { Package, FileText, Layout } from 'lucide-react';

interface Page {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  sectionCount: number;
}

interface PageSwitcherProps {
  currentPage: string;
}

export function PageSwitcher({ currentPage }: PageSwitcherProps): JSX.Element {
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get store actions
  const setPreviewPage = useAgentUIStore((state) => state.setPreviewPage);
  const showPreview = useAgentUIStore((state) => state.showPreview);

  // Fetch pages
  useEffect(() => {
    fetch('/api/tenant-admin/pages')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch pages');
        return res.json();
      })
      .then((data) => {
        setPages(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  // Handle page click (inlined navigation logic)
  const handlePageClick = useCallback((pageSlug: string) => {
    const currentView = useAgentUIStore.getState().view;
    if (currentView.status === 'preview') {
      setPreviewPage(pageSlug);
    } else {
      showPreview(pageSlug);
    }
  }, [setPreviewPage, showPreview]);

  // Calculate stats
  const enabledPages = pages.filter((p) => p.enabled).length;
  const totalSections = pages.reduce((sum, p) => sum + p.sectionCount, 0);

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
        ) : error ? (
          <div className="p-4 text-center text-red-400">
            <p>Failed to load pages</p>
            <button onClick={() => window.location.reload()} className="text-sm text-sage hover:underline mt-2">
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => handlePageClick(page.slug)}
                disabled={!page.enabled}
                className={`
                  w-full px-4 py-3 rounded-xl text-left transition-all duration-200
                  ${currentPage === page.slug
                    ? 'bg-sage/10 border-l-4 border-sage text-sage'
                    : 'hover:bg-surface-alt'
                  }
                  ${!page.enabled && 'opacity-50 cursor-not-allowed'}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${page.enabled ? 'bg-sage' : 'bg-neutral-500'}`} />
                    <span className={`font-medium ${currentPage === page.slug ? 'text-sage' : 'text-text-primary'}`}>
                      {page.name}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full">
                    {page.sectionCount} sections
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats (inlined, simplified) */}
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
      </div>
    </div>
  );
}
```

**Key Changes from v1:**

- ✅ Consolidated 4 files → 1 file (~200 lines)
- ✅ No separate hook - navigation logic inlined
- ✅ No separate item component - JSX inlined
- ✅ No separate stats component - calculated inline
- ✅ Error handling included
- ✅ Proper TypeScript (no `any` types)

**Time:** 3 hours
**Testing:** Unit test page clicking, loading states

---

#### Task 1.3: Build LivePreview Component (Consolidated)

**File:** `/apps/web/src/app/(protected)/tenant/website/components/LivePreview.tsx`

**Implementation (~200 lines, includes everything):**

```typescript
'use client';

import { useRef, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LivePreviewProps {
  tenantSlug: string;
  currentPage: string;
}

export function LivePreview({ tenantSlug, currentPage }: LivePreviewProps): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const iframeUrl = `/t/${tenantSlug}/${currentPage}`;
  const publicUrl = `${window.location.origin}/t/${tenantSlug}/${currentPage}`;

  // Listen for cache invalidation and refresh iframe (inlined refresh hook logic)
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type !== 'updated' || event.action.type !== 'success') {
        return;
      }

      // Only refresh on relevant data changes
      const relevantKeys = ['branding', 'pages', 'packages'];
      const queryKey = event.query.queryKey[0];

      if (!relevantKeys.includes(queryKey as string)) {
        return;
      }

      // Wait 100ms for READ COMMITTED isolation level
      setIsLoading(true);
      setTimeout(() => {
        const iframe = iframeRef.current;
        if (iframe?.contentWindow) {
          try {
            iframe.contentWindow.postMessage(
              { type: 'RELOAD' },
              window.location.origin
            );
          } catch (err) {
            console.error('Failed to send reload message:', err);
          }
        }
        setIsLoading(false);
      }, 100);
    });

    return () => unsubscribe();
  }, [queryClient]);

  const handleIframeError = () => {
    setError('Failed to load preview');
    setIsLoading(false);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  return (
    <div className="relative h-full bg-neutral-800 p-4 flex items-center justify-center">
      {/* URL Bar (top center, simplified) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-surface-alt rounded-full shadow-lg border border-neutral-700 px-4 py-2 flex items-center gap-3">
        <span className="text-xs font-mono text-text-muted max-w-[300px] truncate">
          {publicUrl}
        </span>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-6 w-6 p-0"
        >
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3 h-3" />
          </a>
        </Button>
      </div>

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        title="Tenant Storefront Preview"
        className="w-full h-[calc(100%-4rem)] bg-white rounded-2xl shadow-2xl"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
      />

      {/* Loading Overlay (inlined) */}
      {isLoading && (
        <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="bg-surface-alt rounded-2xl p-8 shadow-2xl border border-neutral-700">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-sage animate-spin" />
              <p className="text-text-primary font-medium">Updating preview...</p>
            </div>
          </div>
        </div>
      )}

      {/* Error State (inlined) */}
      {error && (
        <div className="absolute inset-0 bg-surface/95 flex items-center justify-center z-10">
          <div className="bg-surface-alt rounded-2xl p-8 shadow-2xl border border-neutral-700 max-w-md">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <h3 className="text-xl font-semibold text-text-primary">Preview Error</h3>
              <p className="text-text-muted text-center">{error}</p>
              <Button onClick={() => setError(null)}>Retry</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Key Changes from v1:**

- ✅ Consolidated 5 files → 1 file (~200 lines)
- ✅ No separate iframe component - inlined
- ✅ No separate controls component - simplified URL bar only
- ✅ No separate loading overlay - inlined
- ✅ No separate hook - refresh logic inlined
- ✅ Proper TypeScript with explicit return types
- ✅ Security: origin validation in postMessage

**Time:** 4 hours
**Testing:** E2E test iframe loads, cache invalidation triggers refresh

---

#### Task 1.4: Update AdminSidebar Navigation

**File:** `/apps/web/src/components/layouts/AdminSidebar.tsx`

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
  {
    href: '/tenant/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard />,
    description: 'Overview & quick actions'
  },
  {
    href: '/tenant/website',
    label: 'Website',
    icon: <Globe />,
    description: 'Pages, branding, packages'
  },
  {
    href: '/tenant/scheduling',
    label: 'Scheduling',
    icon: <Calendar />,
    description: 'Appointments & availability'
  },
  {
    href: '/tenant/revenue',
    label: 'Revenue',
    icon: <DollarSign />,
    description: 'Payments & billing'
  },
  {
    href: '/tenant/settings',
    label: 'Settings',
    icon: <Settings />,
    description: 'Account & advanced'
  },
];
```

**Time:** 1 hour
**Testing:** Visual test - verify 5 items show correctly

---

#### Task 1.5: Add Route Redirects

**File:** `/apps/web/src/middleware.ts` (create or update)

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

**Time:** 1 hour
**Testing:** E2E test all old URLs redirect, no 404s

---

#### Task 1.6: Update Dashboard Page

**File:** `/apps/web/src/app/(protected)/tenant/dashboard/page.tsx`

**Changes:**

```typescript
// REMOVE these cards:
<Card>
  <CardHeader>Site Builder</CardHeader>
  {/* ... */}
</Card>

<Card>
  <CardHeader>Manage Pages</CardHeader>
  {/* ... */}
</Card>

// REPLACE with:
<Card className="hover:-translate-y-1 transition-transform">
  <CardHeader>
    <Globe className="w-6 h-6 text-sage mb-2" />
    <CardTitle>Edit Website</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-text-muted mb-4">
      Visual editor with AI - manage branding, pages, and packages
    </p>
    <Button variant="sage" asChild className="w-full">
      <Link href="/tenant/website">Open Website Editor</Link>
    </Button>
  </CardContent>
</Card>
```

**Time:** 1 hour
**Testing:** Visual test - verify new card appears, links correctly

---

### Phase 2: Agent Integration (Days 3-4) - P0

**Goal:** Agent edits trigger preview updates automatically.

**Success Criteria:**

- ✅ Agent updates branding, preview refreshes
- ✅ Loading overlay shows during updates
- ✅ Cache invalidates after successful updates
- ✅ Error states handle failures

**No New Tasks Required** - Already implemented in Task 1.3:

- ✅ LivePreview subscribes to React Query cache events
- ✅ Cache invalidation triggers 100ms delayed refresh
- ✅ Loading overlay shows during updates
- ✅ Error state handles preview failures
- ✅ postMessage with origin validation

**Time:** 0 hours (built into Phase 1)
**Testing:** E2E test agent updates → preview refreshes

---

### Phase 3: Consolidation Pages (Day 5) - P0

**Goal:** Revenue and Scheduling use tabs. Settings has collapsible Advanced.

**Success Criteria:**

- ✅ `/tenant/revenue` shows Stripe + Subscription tabs
- ✅ `/tenant/scheduling` shows 4 tabs
- ✅ Settings has collapsible Advanced section

#### Task 3.1: Create Revenue Page with Tabs

**File:** `/apps/web/src/app/(protected)/tenant/revenue/page.tsx`

**Implementation:**

```typescript
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StripeConnectSection } from './components/StripeConnectSection';
import { SubscriptionSection } from './components/SubscriptionSection';

export default function RevenuePage(): JSX.Element {
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

**Components to Create:**

- `StripeConnectSection.tsx` - Move content from old `/tenant/payments/page.tsx`
- `SubscriptionSection.tsx` - Move content from old `/tenant/billing/page.tsx`

**Time:** 2 hours
**Testing:** E2E test both tabs render, functionality preserved

---

#### Task 3.2: Update Scheduling Page with Tabs

**File:** `/apps/web/src/app/(protected)/tenant/scheduling/page.tsx`

**Implementation:**

```typescript
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppointmentsSection } from './components/AppointmentsSection';
import { AvailabilitySection } from './components/AvailabilitySection';
import { BlackoutsSection } from './components/BlackoutsSection';
import { AppointmentTypesSection } from './components/AppointmentTypesSection';

export default function SchedulingPage(): JSX.Element {
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

**Components to Create:**

- `AppointmentsSection.tsx` - Move from `/tenant/scheduling/appointments/page.tsx`
- `AvailabilitySection.tsx` - Move from `/tenant/scheduling/availability/page.tsx`
- `BlackoutsSection.tsx` - Move from `/tenant/scheduling/blackouts/page.tsx`
- `AppointmentTypesSection.tsx` - Move from `/tenant/scheduling/appointment-types/page.tsx`

**Time:** 2 hours
**Testing:** E2E test all 4 tabs work

---

#### Task 3.3: Simplify Settings Page

**File:** `/apps/web/src/app/(protected)/tenant/settings/page.tsx`

**Implementation:**

```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronDown, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage(): JSX.Element {
  const { user, tenantId } = useAuth();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-muted mt-2">Manage your account and preferences</p>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={user.email} disabled className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Advanced (Collapsible) */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Advanced</CardTitle>
              <ChevronDown
                className={`w-5 h-5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0">
              {/* Tenant ID */}
              <div>
                <Label>Tenant ID</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={tenantId}
                    disabled
                    className="font-mono flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(tenantId, 'Tenant ID')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Custom Domains (move from /tenant/domains) */}
              <div>
                <Label>Custom Domains</Label>
                <p className="text-sm text-text-muted mt-1">
                  Contact support to set up a custom domain
                </p>
              </div>

              {/* API Keys */}
              <div>
                <Label>API Keys (Developer)</Label>
                <p className="text-sm text-text-muted mt-1">
                  For developers integrating with HANDLED API
                </p>
                {/* API key management UI */}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
```

**Changes:**

- ❌ Remove "Business Settings" card (unfinished)
- ❌ Remove "Delete Account" button (not implemented)
- ❌ Remove duplicate "Sign Out" button
- ✅ Move Domains to Advanced
- ✅ Move API Keys to Advanced
- ✅ Move Tenant ID to Advanced

**Time:** 2 hours
**Testing:** Visual test - verify collapsible works

---

### Phase 4: Mobile Responsive (Week 3) - P1

**Goal:** Mobile-friendly with CSS Grid + drawer pattern.

**Success Criteria:**

- ✅ Desktop (≥1024px): 3-column layout
- ✅ Tablet (768-1023px): 2-column with collapsible sidebar
- ✅ Mobile (<768px): PageSwitcher in drawer

#### Task 4.1: Add Mobile Drawer for PageSwitcher

**File:** `/apps/web/src/app/(protected)/tenant/website/page.tsx`

**Updates:**

```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-client';
import { PageSwitcher } from './components/PageSwitcher';
import { LivePreview } from './components/LivePreview';
import { useAgentUIStore } from '@/stores/agent-ui-store';
import { Button } from '@/components/ui/button';
import { Drawer } from 'vaul';  // Already installed for AgentPanel
import { Menu } from 'lucide-react';

export default function WebsitePage(): JSX.Element {
  const { slug } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const currentPage = useAgentUIStore((state) =>
    state.view.status === 'preview' ? state.view.config.currentPage : 'home'
  );

  return (
    <>
      {/* Desktop/Tablet: CSS Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] h-[calc(100vh-4rem)] gap-0">
        {/* Left: Page Switcher - hidden on mobile */}
        <aside className="hidden lg:block border-r border-neutral-700 bg-surface-alt">
          <PageSwitcher currentPage={currentPage} onPageSelect={() => {}} />
        </aside>

        {/* Center: Live Preview */}
        <main className="bg-neutral-800 relative">
          {/* Mobile: Floating menu button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden fixed top-20 left-4 z-10"
          >
            <Menu className="w-4 h-4 mr-2" />
            Pages
          </Button>

          <LivePreview tenantSlug={slug} currentPage={currentPage} />
        </main>
      </div>

      {/* Mobile: Drawer for PageSwitcher */}
      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 lg:hidden" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-surface-alt rounded-t-3xl lg:hidden">
            <div className="mx-auto w-12 h-1.5 bg-neutral-700 rounded-full mt-4 mb-2" />
            <PageSwitcher
              currentPage={currentPage}
              onPageSelect={() => setDrawerOpen(false)}  // Close drawer on selection
            />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
```

**Update PageSwitcher:**

```typescript
interface PageSwitcherProps {
  currentPage: string;
  onPageSelect?: () => void; // NEW: callback when page selected
}

// In handlePageClick:
const handlePageClick = useCallback(
  (pageSlug: string) => {
    // ... existing logic ...
    onPageSelect?.(); // Close drawer on mobile
  },
  [setPreviewPage, showPreview, onPageSelect]
);
```

**Time:** 3 hours
**Testing:** E2E test on mobile simulator

---

## Acceptance Criteria

### Functional Requirements

#### Phase 1 (Core Layout)

- [ ] Navigate to `/tenant/website` and see responsive layout
- [ ] Click page in PageSwitcher, iframe updates
- [ ] Active page shows sage border + background
- [ ] Disabled page shows 50% opacity
- [ ] Sidebar shows 5 items
- [ ] Old routes redirect properly

#### Phase 2 (Agent Integration)

- [ ] Agent updates branding, preview refreshes automatically
- [ ] Loading overlay shows during updates
- [ ] Cache invalidates after successful updates
- [ ] Error states show if preview fails

#### Phase 3 (Consolidation)

- [ ] `/tenant/revenue` shows Stripe + Subscription tabs
- [ ] `/tenant/scheduling` shows 4 tabs
- [ ] Settings has collapsible Advanced section
- [ ] All features functional, no missing functionality

#### Phase 4 (Mobile)

- [ ] Desktop: 3-column layout
- [ ] Tablet: 2-column layout with collapsible sidebar
- [ ] Mobile: Drawer for page switcher
- [ ] Tested on iOS Safari and Android Chrome

### Non-Functional Requirements

#### Performance

- [ ] Preview iframe loads in < 2 seconds
- [ ] Page switching feels instant (< 100ms)
- [ ] Agent updates complete in < 3 seconds (P95)
- [ ] Bundle size increase < 50 KB gzipped

#### Security

- [ ] All postMessage validates origin
- [ ] All API calls include auth token
- [ ] All queries filter by tenantId
- [ ] Cache keys include tenantId

#### Accessibility

- [ ] 24x24px minimum touch targets
- [ ] WCAG AA color contrast
- [ ] Keyboard navigation works
- [ ] Screen reader support

### Quality Gates

- [ ] TypeScript strict mode (no `any` types)
- [ ] ESLint passing
- [ ] Unit tests pass (80% coverage)
- [ ] E2E tests pass
- [ ] Code review approved
- [ ] QA sign-off

---

## Success Metrics

### Quantitative

- Navigation items: 8 → 5 (37.5% reduction) ✅
- Clicks to edit: 3-5 → 1-2 (60% reduction) 🎯
- Preview update time: ~10s → <1s (90% improvement) 🎯

### Qualitative

- ✅ No unfinished features (no "Coming soon")
- ✅ No redundant navigation
- ✅ Progressive disclosure (Advanced hidden)
- ✅ Generous whitespace
- ✅ Smooth animations

---

## Risk Analysis & Mitigation

### High Risk

**1. Iframe Performance on Mobile**

- **Mitigation:** Loading overlay, 2s timeout with error state
- **Validation:** Test on actual 3G network

**2. Agent Tool Latency**

- **Mitigation:** Optimistic updates, progress indicators
- **Validation:** Measure P95 in production, alert if >3s

**3. Route Migration Breaking Bookmarks**

- **Mitigation:** Permanent redirects (301), track 404s
- **Validation:** Monitor analytics, ensure zero 404 increase

### Medium Risk

**4. Cache Invalidation Race Conditions**

- **Mitigation:** 100ms delay, optimistic updates
- **Validation:** Integration test with simulated latency

**5. TypeScript Strict Mode Errors**

- **Mitigation:** Fix during Phase 1
- **Validation:** CI blocks on TS errors

---

## Resource Requirements

### Team

- **Frontend Developer (Lead):** 10 days (2 weeks)
- **Backend Developer (Support):** 1 day (cache verification)
- **QA Engineer:** 5 days (testing)
- **Product Manager:** 2 days (acceptance, rollout)

### Timeline

**Total Duration:** 4 weeks

| Phase                       | Duration | When                 |
| --------------------------- | -------- | -------------------- |
| Phase 1 (Core Layout)       | Days 1-2 | Week 1               |
| Phase 2 (Agent Integration) | Days 3-4 | Week 1               |
| Phase 3 (Consolidation)     | Day 5    | Week 1               |
| Beta Testing                | Week 2   | Internal → 10% users |
| Phase 4 (Mobile)            | Week 3   | Responsive           |
| Full Rollout                | Week 4   | 25% → 100%           |

---

## Phase 5: Polish (v2 - DEFERRED)

**Removed from MVP, add based on user feedback:**

- ⏸️ Welcome tour (5 steps)
- ⏸️ Manual branding modal (form fallback)
- ⏸️ Viewport controls (mobile/tablet/desktop toggle)
- ⏸️ Search bar in PageSwitcher
- ⏸️ Package inline editing in preview
- ⏸️ Section-level highlighting

**Rationale:** Ship core experience first, measure usage, add polish based on real data.

---

## Rollout Strategy

### Feature Flag with Gradual Rollout (RECOMMENDED)

**Stages:**

1. **Internal (Week 1):** 5 users (team dogfooding)
2. **Beta (Week 2):** 10% opt-in users
3. **Gradual (Week 3-4):** 25% → 50% → 75% → 100%

**Metrics to Monitor:**

- Error rate (< 1% increase)
- Agent usage (> 50% increase)
- Session duration (> 20% increase)
- Support tickets (< 10% increase)

**Rollback Plan:** Toggle off if error rate > 2%

---

## Migration Guide for Users

### What's Changing?

**You'll see:**

- ✅ 5 navigation items (simpler!)
- ✅ New "Website" tab with live preview
- ✅ Instant preview updates

**You won't lose:**

- ❌ Any data
- ❌ Any features
- ❌ Any bookmarks (redirects work)

### Where Did Things Go?

| Old        | New                        |
| ---------- | -------------------------- |
| Branding → | Website tab                |
| Pages →    | Website tab                |
| Packages → | Website tab                |
| Payments → | Revenue (Stripe tab)       |
| Billing →  | Revenue (Subscription tab) |
| Domains →  | Settings (Advanced)        |

---

## Breaking Changes

**NONE** - This is a non-breaking change.

- API contracts unchanged
- No database migrations
- Old URLs redirect (301)

---

## References

### Internal

- **Audit:** `/docs/audits/tenant-dashboard-audit-2026-01-13.md`
- **Design Brief:** `/docs/design/tenant-dashboard-redesign-brief.md`
- **Brand Guide:** `/docs/design/BRAND_VOICE_GUIDE.md`
- **Agent UI Store:** `/apps/web/src/stores/agent-ui-store.ts`

### External

- Next.js 14: https://nextjs.org/docs
- TanStack Query: https://tanstack.com/query
- Zustand: https://docs.pmnd.rs/zustand

---

## Summary of Simplifications

**Removed from v1:**

- ❌ Phase 5 (490 lines, 6 files)
- ❌ 7 tiny components (consolidated into 2)
- ❌ 4 custom hooks (logic inlined)
- ❌ 3 responsive layouts (using CSS Grid)
- ❌ Manual branding modal
- ❌ Welcome tour

**Result:**

- **Before:** 3,500+ lines, 25 files
- **After:** ~1,800 lines, 8 files
- **Savings:** 50% reduction

**Core functionality:** 100% maintained

---

## Next Steps

1. ✅ Present plan to team
2. ⏳ Create GitHub issue
3. ⏳ Begin Phase 1 implementation
4. ⏳ Ship Phase 1-3 in Week 1

**This plan is ready for implementation.** 🚀
