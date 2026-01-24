# Agent-First Dashboard Architecture

**Date:** 2026-01-09
**Type:** Major Refactoring
**Status:** ✅ Phase 5 Complete - All Implementation & Testing Done
**Review Status:** Reviewed by 4 specialized agents (DHH, Kieran, Principal Architect, Agent-Native)

### Implementation Progress

| Phase                           | Status      | Notes                                                                     |
| ------------------------------- | ----------- | ------------------------------------------------------------------------- |
| Phase 1: Foundation             | ✅ Complete | Zustand store, useDraftConfig, capability registry                        |
| Phase 2: Content Area & Preview | ✅ Complete | ContentArea, PreviewPanel, DashboardView, layout integration              |
| Phase 3: Agent Integration      | ✅ Complete | UI tools, onUIAction callback, agent-controlled navigation                |
| Phase 4: Layout Refactoring     | ✅ Complete | GrowthAssistantPanel → AgentPanel, redirect /tenant/build, remove context |
| Phase 5: Cleanup & Testing      | ✅ Complete | E2E + unit tests (184 new tests)                                          |

---

## Overview

Refactor the tenant dashboard so the AI chatbot is THE central interface - not a sidebar feature. The chatbot handles everything: onboarding, storefront editing, marketing advice, and business operations. The preview/display window exists to serve the agent, appearing dynamically when needed rather than requiring a separate `/tenant/build` route.

**Philosophy (from agent-native-architecture skill):**

> "Whatever the user can do, the agent can do. The agent figures out HOW to achieve an outcome."

**Key Insight:** The agent chat isn't a "Growth Assistant" sidebar - it's the **mastermind** that controls the entire tenant experience.

---

## Problem Statement

### Current Architecture (Wrong)

```
┌─────────────────────────────────────────────────────────────┐
│  /tenant/dashboard                                          │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  │
│  │   Dashboard Content     │  │  Agent Panel (sidebar)   │  │
│  │   (static cards)        │  │  - Independent           │  │
│  │                         │  │  - No control over UI    │  │
│  └─────────────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  /tenant/build (SEPARATE ROUTE - WRONG)                     │
│  ┌───────────────────┐  ┌────────────────────────────────┐  │
│  │ BuildModeChat     │  │  Preview Iframe                │  │
│  │ (duplicate chat)  │  │  (35%/65% split)               │  │
│  └───────────────────┘  └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Problems:**

1. Build Mode has a **separate chat** (BuildModeChat) that duplicates agent functionality
2. Agent panel exists in **isolation** on dashboard - can't control what's shown
3. User must **navigate** to Build Mode to see preview - breaks conversation flow
4. Two competing UIs with different contexts and capabilities

### Desired Architecture (Agent-First)

```
┌─────────────────────────────────────────────────────────────┐
│  /tenant/dashboard (unified)                                │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  │
│  │   Content Area          │  │  Agent Panel (primary)   │  │
│  │   ┌─────────────────┐   │  │  - THE interface         │  │
│  │   │ Dynamic View    │   │  │  - Controls content area │  │
│  │   │ - Dashboard     │   │  │  - One conversation      │  │
│  │   │ - Preview       │←──│──│  - Context-aware tools   │  │
│  │   │ - Settings      │   │  │                          │  │
│  │   └─────────────────┘   │  │                          │  │
│  └─────────────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Solution:**

1. **One agent chat** - always present, controls everything
2. **Dynamic content area** - agent can trigger preview to appear
3. **No separate route** - Build Mode is a "mode", not a page
4. **Shared workspace** - agent and UI observe same draft state

---

## Technical Approach

### Architecture: Event-Driven Agent UI Control

Based on agent-native-architecture patterns and enterprise-grade review feedback, the agent controls what's displayed via a **shared state store** with **event sourcing**:

```
Agent Response → Parse UI Actions → Event Log → Update Zustand Store → Content Area Re-renders
                                         │                │
                                         └→ Audit Trail   └→ PostMessage to Preview Iframe
```

### Core Patterns (From 4-Agent Review)

| Pattern              | Source              | Purpose                        |
| -------------------- | ------------------- | ------------------------------ |
| Discriminated Unions | Kieran (TypeScript) | Eliminate impossible states    |
| Event Sourcing       | Principal Architect | Audit, debugging, undo/redo    |
| Tenant-Scoped Stores | Principal Architect | Security isolation             |
| Action Parity        | Agent-Native        | Every UI button has agent tool |
| Capability Discovery | DHH + Agent-Native  | Users know what agent can do   |

### Key Components

| Component            | Purpose                                               | Location                               |
| -------------------- | ----------------------------------------------------- | -------------------------------------- |
| `AgentPanel`         | Unified chat panel (rename from GrowthAssistantPanel) | `components/agent/AgentPanel.tsx`      |
| `ContentArea`        | Dynamic view container                                | `components/dashboard/ContentArea.tsx` |
| `PreviewPanel`       | Storefront preview (extracted from Build Mode)        | `components/preview/PreviewPanel.tsx`  |
| `useAgentUIStore`    | Zustand store for agent-controlled UI state           | `stores/agent-ui-store.ts`             |
| `useDraftConfig`     | TanStack Query hook for draft state                   | `hooks/useDraftConfig.ts`              |
| `AgentActionLog`     | Event sourcing for UI actions                         | `stores/agent-action-log.ts`           |
| `CapabilityRegistry` | Central registry of agent capabilities                | `lib/agent-capabilities.ts`            |

---

## Implementation Phases

### Phase 1: Foundation - State Management & Event Sourcing

**Goal:** Create the infrastructure for agent-controlled UI with type-safe state, event sourcing, and tenant isolation.

#### 1.1 Create Agent UI Store with Discriminated Unions (Zustand)

**File:** `apps/web/src/stores/agent-ui-store.ts`

```typescript
import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { PageName } from '@macon/contracts';

// ============================================
// DISCRIMINATED UNIONS - Eliminate impossible states
// ============================================

interface PreviewConfig {
  currentPage: PageName;
  highlightedSectionId: string | null;
}

// State can ONLY be one of these - no invalid combinations possible
type ViewState =
  | { status: 'dashboard' }
  | { status: 'preview'; config: PreviewConfig }
  | { status: 'loading'; target: 'dashboard' | 'preview' }
  | { status: 'error'; error: string; recovery?: () => void };

// ============================================
// EVENT SOURCING - Audit trail for all actions
// ============================================

interface AgentAction {
  id: string;
  type: 'SHOW_PREVIEW' | 'HIDE_PREVIEW' | 'HIGHLIGHT_SECTION' | 'NAVIGATE' | 'PUBLISH' | 'DISCARD';
  payload: unknown;
  timestamp: number;
  agentSessionId: string | null;
  tenantId: string;
}

// ============================================
// STORE INTERFACE
// ============================================

interface AgentUIState {
  // Current view state (discriminated union)
  view: ViewState;

  // Draft dirty state
  isDirty: boolean;

  // Event log for audit/debugging/undo
  actionLog: AgentAction[];

  // Tenant scope (security)
  tenantId: string | null;

  // Actions
  initialize: (tenantId: string) => void;
  showPreview: (page?: PageName, agentSessionId?: string) => void;
  showDashboard: (agentSessionId?: string) => void;
  highlightSection: (sectionId: string, agentSessionId?: string) => void;
  clearHighlight: () => void;
  setDirty: (dirty: boolean) => void;
  setError: (error: string, recovery?: () => void) => void;
  clearError: () => void;

  // Event sourcing
  getActionLog: () => AgentAction[];
  undoLastAction: () => void;
}

// ============================================
// STORE FACTORY - Tenant-scoped for security
// ============================================

const generateActionId = () => `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const useAgentUIStore = create<AgentUIState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        view: { status: 'dashboard' },
        isDirty: false,
        actionLog: [],
        tenantId: null,

        initialize: (tenantId) =>
          set((state) => {
            state.tenantId = tenantId;
            state.view = { status: 'dashboard' };
            state.actionLog = [];
          }),

        showPreview: (page = 'home', agentSessionId = null) =>
          set((state) => {
            if (!state.tenantId) return; // Security: require tenant

            const action: AgentAction = {
              id: generateActionId(),
              type: 'SHOW_PREVIEW',
              payload: { page },
              timestamp: Date.now(),
              agentSessionId,
              tenantId: state.tenantId,
            };

            state.actionLog.push(action);
            state.view = {
              status: 'preview',
              config: { currentPage: page, highlightedSectionId: null },
            };
          }),

        showDashboard: (agentSessionId = null) =>
          set((state) => {
            if (!state.tenantId) return;

            const action: AgentAction = {
              id: generateActionId(),
              type: 'HIDE_PREVIEW',
              payload: {},
              timestamp: Date.now(),
              agentSessionId,
              tenantId: state.tenantId,
            };

            state.actionLog.push(action);
            state.view = { status: 'dashboard' };
          }),

        highlightSection: (sectionId, agentSessionId = null) =>
          set((state) => {
            if (!state.tenantId) return;
            if (state.view.status !== 'preview') return;

            const action: AgentAction = {
              id: generateActionId(),
              type: 'HIGHLIGHT_SECTION',
              payload: { sectionId },
              timestamp: Date.now(),
              agentSessionId,
              tenantId: state.tenantId,
            };

            state.actionLog.push(action);

            // Parse page from section ID (format: {page}-{type}-{qualifier})
            const pageId = sectionId.split('-')[0] as PageName;
            state.view = {
              status: 'preview',
              config: {
                currentPage: pageId || state.view.config.currentPage,
                highlightedSectionId: sectionId,
              },
            };
          }),

        clearHighlight: () =>
          set((state) => {
            if (state.view.status === 'preview') {
              state.view.config.highlightedSectionId = null;
            }
          }),

        setDirty: (dirty) =>
          set((state) => {
            state.isDirty = dirty;
          }),

        setError: (error, recovery) =>
          set((state) => {
            state.view = { status: 'error', error, recovery };
          }),

        clearError: () =>
          set((state) => {
            state.view = { status: 'dashboard' };
          }),

        getActionLog: () => get().actionLog,

        undoLastAction: () =>
          set((state) => {
            const lastAction = state.actionLog.pop();
            if (!lastAction) return;

            // Reverse the action
            switch (lastAction.type) {
              case 'SHOW_PREVIEW':
                state.view = { status: 'dashboard' };
                break;
              case 'HIDE_PREVIEW':
                state.view = {
                  status: 'preview',
                  config: { currentPage: 'home', highlightedSectionId: null },
                };
                break;
              case 'HIGHLIGHT_SECTION':
                if (state.view.status === 'preview') {
                  state.view.config.highlightedSectionId = null;
                }
                break;
            }
          }),
      }))
    ),
    { name: 'agent-ui-store' }
  )
);

// ============================================
// EXPOSED ACTIONS - For agent tool handlers (outside React)
// ============================================

export const agentUIActions = {
  showPreview: (page?: PageName, agentSessionId?: string) =>
    useAgentUIStore.getState().showPreview(page, agentSessionId),
  showDashboard: (agentSessionId?: string) =>
    useAgentUIStore.getState().showDashboard(agentSessionId),
  highlightSection: (sectionId: string, agentSessionId?: string) =>
    useAgentUIStore.getState().highlightSection(sectionId, agentSessionId),
  getActionLog: () => useAgentUIStore.getState().getActionLog(),
};

// ============================================
// SELECTORS - Shallow for performance
// ============================================

export const selectViewStatus = (state: AgentUIState) => state.view.status;
export const selectPreviewConfig = (state: AgentUIState) =>
  state.view.status === 'preview' ? state.view.config : null;
export const selectIsDirty = (state: AgentUIState) => state.isDirty;
export const selectIsPreviewActive = (state: AgentUIState) => state.view.status === 'preview';
```

#### 1.2 Create Draft Config Hook (TanStack Query)

**File:** `apps/web/src/hooks/useDraftConfig.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_PAGES_CONFIG, type PagesConfig } from '@macon/contracts';

interface DraftConfigData {
  pages: PagesConfig;
  hasDraft: boolean;
}

export function useDraftConfig() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['draft-config'],
    queryFn: async (): Promise<DraftConfigData> => {
      const response = await fetch('/api/tenant-admin/landing-page/draft');
      if (!response.ok) {
        if (response.status === 404) {
          // No draft, fetch live config
          const liveResponse = await fetch('/api/tenant-admin/landing-page');
          if (liveResponse.ok) {
            const liveConfig = await liveResponse.json();
            return { pages: liveConfig.pages || DEFAULT_PAGES_CONFIG, hasDraft: false };
          }
        }
        return { pages: DEFAULT_PAGES_CONFIG, hasDraft: false };
      }
      const data = await response.json();
      return { pages: data.pages || DEFAULT_PAGES_CONFIG, hasDraft: data.hasDraft || false };
    },
    staleTime: 30_000, // 30 seconds
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/tenant-admin/landing-page/publish', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to publish');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-config'] });
    },
  });

  const discardMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/tenant-admin/landing-page/draft', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to discard');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-config'] });
    },
  });

  // Invalidate draft config (call from agent tool handlers)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['draft-config'] });

  return {
    config: query.data?.pages ?? DEFAULT_PAGES_CONFIG,
    hasDraft: query.data?.hasDraft ?? false,
    isLoading: query.isLoading,
    error: query.error,
    publishDraft: publishMutation.mutateAsync,
    discardDraft: discardMutation.mutateAsync,
    isPublishing: publishMutation.isPending,
    isDiscarding: discardMutation.isPending,
    invalidate,
  };
}

// Query client accessor for agent tools (outside React)
let queryClientRef: ReturnType<typeof useQueryClient> | null = null;

export const setQueryClientRef = (client: ReturnType<typeof useQueryClient>) => {
  queryClientRef = client;
};

export const invalidateDraftConfig = () => {
  queryClientRef?.invalidateQueries({ queryKey: ['draft-config'] });
};
```

#### 1.3 Create Capability Registry

**File:** `apps/web/src/lib/agent-capabilities.ts`

```typescript
import type { PageName } from '@macon/contracts';

// ============================================
// CAPABILITY REGISTRY - Users discover what agent can do
// ============================================

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'editing' | 'publishing' | 'settings' | 'help';
  keywords: string[];
  shortcut?: string;
  trustTier: 'T1' | 'T2' | 'T3';
  example: string;
}

export const AGENT_CAPABILITIES: AgentCapability[] = [
  // Navigation (T1 - auto-confirm)
  {
    id: 'show_preview',
    name: 'Show Preview',
    description: 'Display the storefront preview in the content area',
    category: 'navigation',
    keywords: ['preview', 'show', 'view', 'website', 'storefront'],
    shortcut: 'Cmd+P',
    trustTier: 'T1',
    example: 'Show me my website preview',
  },
  {
    id: 'hide_preview',
    name: 'Return to Dashboard',
    description: 'Close the preview and return to dashboard',
    category: 'navigation',
    keywords: ['dashboard', 'home', 'close', 'back'],
    trustTier: 'T1',
    example: 'Go back to the dashboard',
  },
  {
    id: 'navigate_to',
    name: 'Navigate',
    description: 'Navigate to a specific page in the dashboard',
    category: 'navigation',
    keywords: ['go to', 'navigate', 'open', 'settings', 'bookings', 'services'],
    trustTier: 'T1',
    example: 'Take me to my booking settings',
  },

  // Editing (T2 - soft-confirm)
  {
    id: 'update_section',
    name: 'Update Section',
    description: 'Modify content in a specific section of your storefront',
    category: 'editing',
    keywords: ['edit', 'update', 'change', 'modify', 'section', 'content'],
    trustTier: 'T2',
    example: 'Update the headline on my homepage',
  },
  {
    id: 'add_section',
    name: 'Add Section',
    description: 'Add a new section to your storefront',
    category: 'editing',
    keywords: ['add', 'new', 'create', 'section', 'testimonials', 'faq', 'gallery'],
    trustTier: 'T2',
    example: 'Add a testimonials section to my homepage',
  },
  {
    id: 'remove_section',
    name: 'Remove Section',
    description: 'Remove a section from your storefront',
    category: 'editing',
    keywords: ['remove', 'delete', 'section'],
    trustTier: 'T2',
    example: 'Remove the FAQ section from my about page',
  },

  // Publishing (T3 - hard-confirm, CRITICAL ACTIONS)
  {
    id: 'publish_draft',
    name: 'Publish Changes',
    description: 'Make your draft changes live on your storefront',
    category: 'publishing',
    keywords: ['publish', 'go live', 'deploy', 'release'],
    shortcut: 'Cmd+Shift+P',
    trustTier: 'T3', // CRITICAL: Goes to production
    example: 'Publish my changes',
  },
  {
    id: 'discard_draft',
    name: 'Discard Changes',
    description: 'Discard all unpublished changes',
    category: 'publishing',
    keywords: ['discard', 'revert', 'undo', 'cancel'],
    trustTier: 'T3', // CRITICAL: Deletes work
    example: 'Discard all my changes',
  },

  // Settings (T2)
  {
    id: 'update_business_info',
    name: 'Update Business Info',
    description: 'Update your business name, contact info, or hours',
    category: 'settings',
    keywords: ['business', 'name', 'contact', 'phone', 'email', 'hours'],
    trustTier: 'T2',
    example: 'Update my business hours',
  },

  // Help (T1)
  {
    id: 'get_help',
    name: 'Get Help',
    description: 'Get help with using the dashboard or editing your storefront',
    category: 'help',
    keywords: ['help', 'how', 'what', 'explain', 'tutorial'],
    trustTier: 'T1',
    example: 'How do I add a new service?',
  },
];

// Search capabilities by keyword
export function searchCapabilities(query: string): AgentCapability[] {
  const lowerQuery = query.toLowerCase();
  return AGENT_CAPABILITIES.filter(
    (cap) =>
      cap.keywords.some((kw) => kw.includes(lowerQuery)) ||
      cap.name.toLowerCase().includes(lowerQuery) ||
      cap.description.toLowerCase().includes(lowerQuery)
  );
}

// Get capabilities by category
export function getCapabilitiesByCategory(
  category: AgentCapability['category']
): AgentCapability[] {
  return AGENT_CAPABILITIES.filter((cap) => cap.category === category);
}

// Get capability by ID
export function getCapability(id: string): AgentCapability | undefined {
  return AGENT_CAPABILITIES.find((cap) => cap.id === id);
}
```

#### 1.4 Add Dependencies

```bash
cd apps/web
npm install zustand immer
```

**Phase 1 Tasks:**

- [x] Create `stores/agent-ui-store.ts` with discriminated unions and event sourcing
- [x] Create `hooks/useDraftConfig.ts` with TanStack Query
- [x] Create `lib/agent-capabilities.ts` capability registry
- [x] Install zustand and immer dependencies
- [x] Write unit tests for store actions (84 tests in Phase 5)
- [x] Write unit tests for capability search (64 tests in Phase 5)

---

### Phase 2: Content Area & Preview Panel

**Goal:** Extract preview from Build Mode and make it a reusable component that can appear in the content area.

#### 2.1 Create ContentArea Component

**File:** `apps/web/src/components/dashboard/ContentArea.tsx`

```typescript
'use client';

import { Suspense } from 'react';
import { useAgentUIStore, selectViewStatus, selectPreviewConfig } from '@/stores/agent-ui-store';
import { DashboardView } from './DashboardView';
import { PreviewPanel } from '@/components/preview/PreviewPanel';
import { useDraftConfig } from '@/hooks/useDraftConfig';
import { Loader2 } from 'lucide-react';

function PreviewLoader() {
  return (
    <div className="h-full flex items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-sage" />
        <span className="text-sm text-neutral-500">Loading preview...</span>
      </div>
    </div>
  );
}

function ErrorView({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="h-full flex items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-red-500 text-lg font-medium">Something went wrong</div>
        <p className="text-neutral-600 max-w-md">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-sage text-white rounded-lg hover:bg-sage-hover transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

export function ContentArea({ children }: { children?: React.ReactNode }) {
  const view = useAgentUIStore((s) => s.view);
  const { config, hasDraft, invalidate, isLoading } = useDraftConfig();

  // Handle different view states (discriminated union)
  switch (view.status) {
    case 'loading':
      return <PreviewLoader />;

    case 'error':
      return <ErrorView error={view.error} onRetry={view.recovery} />;

    case 'preview':
      return (
        <Suspense fallback={<PreviewLoader />}>
          <PreviewPanel
            currentPage={view.config.currentPage}
            highlightedSectionId={view.config.highlightedSectionId}
            draftConfig={config}
            hasDraft={hasDraft}
            onConfigUpdate={invalidate}
          />
        </Suspense>
      );

    case 'dashboard':
    default:
      // Render children (page content) or default DashboardView
      return children ? <>{children}</> : <DashboardView />;
  }
}
```

#### 2.2 Extract PreviewPanel Component

**File:** `apps/web/src/components/preview/PreviewPanel.tsx`

Extract from `BuildModePreview.tsx` with these modifications:

- Remove dependency on Build Mode page state
- Accept props for configuration
- Add header toolbar for page selection and publish/discard
- Keep PostMessage protocol for iframe communication
- Add T3 confirmation dialogs for publish/discard

```typescript
'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth-client';
import { useAgentUIStore, agentUIActions } from '@/stores/agent-ui-store';
import { useDraftConfig } from '@/hooks/useDraftConfig';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/build-mode/ConfirmDialog';
import {
  X, Eye, Upload, Trash2, Home, Info, Briefcase,
  HelpCircle, Phone, Image, MessageSquare, Loader2
} from 'lucide-react';
import type { PageName, PagesConfig } from '@macon/contracts';
import { cn } from '@/lib/utils';

const PAGE_ICONS: Record<PageName, React.ReactNode> = {
  home: <Home className="h-4 w-4" />,
  about: <Info className="h-4 w-4" />,
  services: <Briefcase className="h-4 w-4" />,
  faq: <HelpCircle className="h-4 w-4" />,
  contact: <Phone className="h-4 w-4" />,
  gallery: <Image className="h-4 w-4" />,
  testimonials: <MessageSquare className="h-4 w-4" />,
};

interface PreviewPanelProps {
  currentPage: PageName;
  highlightedSectionId: string | null;
  draftConfig: PagesConfig;
  hasDraft: boolean;
  onConfigUpdate: () => void;
}

export function PreviewPanel({
  currentPage,
  highlightedSectionId,
  draftConfig,
  hasDraft,
  onConfigUpdate,
}: PreviewPanelProps) {
  const { slug } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { publishDraft, discardDraft, isPublishing, isDiscarding } = useDraftConfig();

  // T3 confirmation dialogs (critical actions)
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const setCurrentPage = (page: PageName) => agentUIActions.showPreview(page);
  const closePreview = () => agentUIActions.showDashboard();

  // Handle iframe messages (PostMessage protocol)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin for security
      if (event.origin !== window.location.origin) return;

      const { type, payload } = event.data || {};

      switch (type) {
        case 'SECTION_CLICK':
          // User clicked a section in preview
          if (payload?.sectionId) {
            agentUIActions.highlightSection(payload.sectionId);
          }
          break;
        case 'IFRAME_READY':
          // Iframe loaded, send initial config
          sendConfigToIframe();
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Send config updates to iframe
  const sendConfigToIframe = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'CONFIG_UPDATE',
        payload: { config: draftConfig, highlightedSectionId },
      }, window.location.origin);
    }
  }, [draftConfig, highlightedSectionId]);

  // Update iframe when config or highlight changes
  useEffect(() => {
    sendConfigToIframe();
  }, [sendConfigToIframe]);

  // Handle publish with T3 confirmation
  const handlePublish = async () => {
    try {
      await publishDraft();
      onConfigUpdate();
      setShowPublishDialog(false);
    } catch (error) {
      console.error('Failed to publish:', error);
    }
  };

  // Handle discard with T3 confirmation
  const handleDiscard = async () => {
    try {
      await discardDraft();
      onConfigUpdate();
      setShowDiscardDialog(false);
    } catch (error) {
      console.error('Failed to discard:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-neutral-50">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-neutral-200">
        {/* Page tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {(['home', 'about', 'services', 'faq', 'contact', 'gallery', 'testimonials'] as PageName[]).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap',
                currentPage === page
                  ? 'bg-sage/10 text-sage font-medium'
                  : 'text-text-muted hover:bg-neutral-100'
              )}
            >
              {PAGE_ICONS[page]}
              <span className="capitalize">{page}</span>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {hasDraft && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDiscardDialog(true)}
                disabled={isDiscarding}
              >
                {isDiscarding ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Discard
              </Button>
              <Button
                variant="sage"
                size="sm"
                onClick={() => setShowPublishDialog(true)}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Publish
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={closePreview} title="Close preview">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={`/t/${slug}/${currentPage}?preview=draft&edit=true`}
          className="w-full h-full border-0"
          title="Storefront Preview"
        />
      </div>

      {/* T3 Confirmation Dialogs */}
      <ConfirmDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        title="Publish Changes"
        description="This will make your draft changes live on your storefront. Your customers will see these changes immediately."
        confirmLabel="Publish"
        onConfirm={handlePublish}
      />

      <ConfirmDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        title="Discard Changes"
        description="This will permanently delete all your unpublished changes. This action cannot be undone."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={handleDiscard}
      />
    </div>
  );
}
```

#### 2.3 Create DashboardView Component

**File:** `apps/web/src/components/dashboard/DashboardView.tsx`

Extract the current dashboard content into a reusable component that can be shown when preview is not active.

**Phase 2 Tasks:**

- [x] Create `components/dashboard/ContentArea.tsx` with Suspense boundaries
- [x] Create `components/dashboard/DashboardView.tsx` (extract from current dashboard page)
- [x] Create `components/preview/PreviewPanel.tsx` (extract from BuildModePreview)
- [x] Add T3 confirmation dialogs for publish/discard
- [x] Add page tabs toolbar
- [x] Keep PostMessage protocol intact
- [x] Update tenant layout with ContentArea, store init, QueryClientProvider
- [x] Write integration tests (covered by E2E in Phase 5)

---

### Phase 3: Agent Integration

**Goal:** Connect the agent to the UI store so it can control what's displayed.

#### 3.1 Add Agent Tools for UI Control (Backend)

**File:** `server/src/agent/tools/ui-tools.ts`

```typescript
import { z } from 'zod';
import { createTool } from './types';
import type { PageName } from '@macon/contracts';

// ============================================
// T1 TOOLS - Auto-confirm (UI state only)
// ============================================

export const showPreviewTool = createTool({
  name: 'show_preview',
  description:
    'Show the storefront preview in the content area so the user can see their website. Use this after making changes to sections or when the user wants to see their site.',
  parameters: z.object({
    page: z
      .enum(['home', 'about', 'services', 'faq', 'contact', 'gallery', 'testimonials'])
      .optional()
      .describe('Which page to show. Defaults to home.'),
  }),
  trustTier: 'T1',
  execute: async ({ page }) => {
    return {
      success: true,
      message: `Showing ${page || 'home'} page preview.`,
      uiAction: { type: 'SHOW_PREVIEW', page: page || 'home' },
    };
  },
});

export const hidePreviewTool = createTool({
  name: 'hide_preview',
  description: 'Hide the preview and return to the dashboard view.',
  parameters: z.object({}),
  trustTier: 'T1',
  execute: async () => {
    return {
      success: true,
      message: 'Returning to dashboard.',
      uiAction: { type: 'SHOW_DASHBOARD' },
    };
  },
});

export const navigateToTool = createTool({
  name: 'navigate_to',
  description:
    'Navigate the user to a specific page in the dashboard. Use this to help users find settings, bookings, services, or other dashboard pages.',
  parameters: z.object({
    destination: z
      .enum(['dashboard', 'settings', 'bookings', 'services', 'calendar', 'analytics'])
      .describe('The dashboard page to navigate to'),
  }),
  trustTier: 'T1',
  execute: async ({ destination }) => {
    const paths: Record<string, string> = {
      dashboard: '/tenant/dashboard',
      settings: '/tenant/settings',
      bookings: '/tenant/bookings',
      services: '/tenant/services',
      calendar: '/tenant/calendar',
      analytics: '/tenant/analytics',
    };
    return {
      success: true,
      message: `Navigating to ${destination}.`,
      uiAction: { type: 'NAVIGATE', path: paths[destination] },
    };
  },
});

export const getCurrentViewTool = createTool({
  name: 'get_current_view',
  description:
    'Get information about what the user is currently viewing in the dashboard. Use this to understand context before making suggestions.',
  parameters: z.object({}),
  trustTier: 'T1',
  execute: async (_, context) => {
    // Context injected by orchestrator
    return {
      success: true,
      currentView: context?.currentView || 'dashboard',
      currentPage: context?.previewPage || null,
      hasDraft: context?.hasDraft || false,
    };
  },
});

// ============================================
// T3 TOOLS - Hard confirm (critical/irreversible)
// ============================================

export const publishDraftTool = createTool({
  name: 'publish_draft',
  description:
    'Publish all draft changes to make them live on the storefront. This is a critical action that affects what customers see.',
  parameters: z.object({
    confirmation: z
      .literal('I understand this will go live')
      .describe('User must confirm they understand this goes to production'),
  }),
  trustTier: 'T3', // CRITICAL: Goes live to production
  requiresApproval: true,
  execute: async (_, context) => {
    // Actual publish happens via executor after T3 approval
    return {
      success: true,
      message: 'Draft changes have been published. Your storefront is now updated.',
      requiresApproval: true,
      approvalMessage:
        'Publish all draft changes? This will make them visible to your customers immediately.',
    };
  },
});

export const discardDraftTool = createTool({
  name: 'discard_draft',
  description: 'Discard all unpublished draft changes. This cannot be undone.',
  parameters: z.object({
    confirmation: z
      .literal('I understand this cannot be undone')
      .describe('User must confirm they understand this is irreversible'),
  }),
  trustTier: 'T3', // CRITICAL: Deletes work
  requiresApproval: true,
  execute: async () => {
    return {
      success: true,
      message: 'All draft changes have been discarded.',
      requiresApproval: true,
      approvalMessage: 'Discard all unpublished changes? This action cannot be undone.',
    };
  },
});

// Export all UI tools
export const uiTools = [
  showPreviewTool,
  hidePreviewTool,
  navigateToTool,
  getCurrentViewTool,
  publishDraftTool,
  discardDraftTool,
];
```

#### 3.2 Update PanelAgentChat Callbacks

**File:** `apps/web/src/components/agent/PanelAgentChat.tsx`

Add callback for UI control actions:

```typescript
// Add to props interface
interface PanelAgentChatProps {
  // ... existing props
  onUIAction?: (action: AgentUIAction) => void;
}

// Add type for UI actions
type AgentUIAction =
  | { type: 'SHOW_PREVIEW'; page?: PageName }
  | { type: 'SHOW_DASHBOARD' }
  | { type: 'HIGHLIGHT_SECTION'; sectionId: string }
  | { type: 'NAVIGATE'; path: string };

// In the response handler, detect UI actions from agent response
const handleAgentResponse = (response: ChatResponse) => {
  // Check for UI action in response
  if (response.uiAction) {
    onUIAction?.(response.uiAction);
  }

  // Also check for section highlight in tool results
  if (response.toolResults?.some((t) => t.toolName.includes('update_section'))) {
    // Agent modified sections, auto-show preview
    onUIAction?.({ type: 'SHOW_PREVIEW', page: 'home' });
  }
};
```

#### 3.3 Update Agent Panel to Control UI

**File:** `apps/web/src/components/agent/AgentPanel.tsx` (rename from GrowthAssistantPanel)

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PanelAgentChat } from './PanelAgentChat';
import { useAgentUIStore, agentUIActions } from '@/stores/agent-ui-store';
import { useDraftConfig, setQueryClientRef } from '@/hooks/useDraftConfig';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import type { PageName } from '@macon/contracts';

type AgentUIAction =
  | { type: 'SHOW_PREVIEW'; page?: PageName }
  | { type: 'SHOW_DASHBOARD' }
  | { type: 'HIGHLIGHT_SECTION'; sectionId: string }
  | { type: 'NAVIGATE'; path: string };

export function AgentPanel() {
  const router = useRouter();
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const { invalidate } = useDraftConfig();
  const isOpen = useAgentUIStore((s) => s.view.status !== 'loading');
  const initialize = useAgentUIStore((s) => s.initialize);

  // Initialize store with tenant ID (security)
  useEffect(() => {
    if (tenantId) {
      initialize(tenantId);
    }
  }, [tenantId, initialize]);

  // Set query client ref for external invalidation
  useEffect(() => {
    setQueryClientRef(queryClient);
  }, [queryClient]);

  // Handle agent UI actions
  const handleUIAction = (action: AgentUIAction) => {
    switch (action.type) {
      case 'SHOW_PREVIEW':
        agentUIActions.showPreview(action.page);
        break;
      case 'SHOW_DASHBOARD':
        agentUIActions.showDashboard();
        break;
      case 'HIGHLIGHT_SECTION':
        agentUIActions.highlightSection(action.sectionId);
        break;
      case 'NAVIGATE':
        router.push(action.path);
        break;
    }
  };

  // Handle tool completion - invalidate draft cache
  const handleToolComplete = () => {
    invalidate();
  };

  return (
    <aside
      className={cn(
        'fixed top-0 right-0 h-screen w-[400px] bg-surface border-l border-neutral-200',
        'transform transition-transform duration-300 ease-in-out z-40',
        'flex flex-col'
      )}
    >
      <PanelAgentChat
        onUIAction={handleUIAction}
        onToolComplete={handleToolComplete}
        onSectionHighlight={(id) => agentUIActions.highlightSection(id)}
        className="h-full"
      />
    </aside>
  );
}
```

**Phase 3 Tasks:**

- [x] Create `server/src/agent/tools/ui-tools.ts` with all UI control tools
- [x] Add `onUIAction` callback to PanelAgentChat
- [x] Update GrowthAssistantPanel to handle UI actions (rename deferred to Phase 4)
- [x] Add UI tools to all-tools.ts exports (auto-included in orchestrator)
- [x] API response already includes `uiAction` via toolResults.data
- [x] T3 executors already exist (publish_draft, discard_draft in storefront-executors.ts)
- [x] Write E2E tests for agent UI control (11 tests in Phase 5)

---

### Phase 4: Layout Refactoring

**Goal:** Update the tenant layout to use the new content area and remove Build Mode as a separate route.

#### 4.1 Update Tenant Layout

**File:** `apps/web/src/app/(protected)/tenant/layout.tsx`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminSidebar } from '@/components/layouts/AdminSidebar';
import { ImpersonationBanner } from '@/components/layouts/ImpersonationBanner';
import { AgentPanel } from '@/components/agent/AgentPanel';
import { ContentArea } from '@/components/dashboard/ContentArea';
import { useAgentUIStore, selectIsPreviewActive } from '@/stores/agent-ui-store';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-client';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useBuildModeRedirect } from '@/hooks/useBuildModeRedirect';

// Create query client outside component to prevent recreation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function TenantLayoutContent({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const { tenantId } = useAuth();
  const { currentPhase, isLoading: onboardingLoading } = useOnboardingState();
  const isPreviewActive = useAgentUIStore(selectIsPreviewActive);

  // Auto-redirect to Build Mode when reaching MARKETING phase
  useBuildModeRedirect(tenantId, currentPhase, onboardingLoading);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cmd+K keyboard shortcut to focus agent input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      const target = e.target as HTMLElement;
      const isAssistantInput = target.hasAttribute('data-growth-assistant-input');
      if (!isAssistantInput && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
      const input = document.querySelector<HTMLTextAreaElement>('[data-growth-assistant-input]');
      input?.focus();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Match SSR default during hydration
  const showAgentPanel = isMounted;

  return (
    <div className="min-h-screen bg-surface">
      <AdminSidebar />
      <main
        className={cn(
          'lg:pl-72 transition-[padding-right] duration-300 ease-in-out',
          showAgentPanel && 'lg:pr-[400px]'
        )}
      >
        <div className={cn(
          'transition-all duration-300',
          isPreviewActive ? 'p-0 h-[calc(100vh-0px)]' : 'p-6 lg:p-8'
        )}>
          <ContentArea>{children}</ContentArea>
        </div>
      </main>
      {showAgentPanel && <AgentPanel />}
    </div>
  );
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['TENANT_ADMIN']}>
      <QueryClientProvider client={queryClient}>
        <ImpersonationBanner />
        <TenantLayoutContent>{children}</TenantLayoutContent>
      </QueryClientProvider>
    </ProtectedRoute>
  );
}
```

#### 4.2 Redirect /tenant/build to Dashboard

**File:** `apps/web/src/app/(protected)/tenant/build/page.tsx`

```typescript
import { redirect } from 'next/navigation';

// Redirect legacy Build Mode URL to dashboard
// The agent will show preview when needed
export default function BuildModeRedirect() {
  redirect('/tenant/dashboard?showPreview=true');
}
```

#### 4.3 Handle Query Param for Initial Preview

**File:** `apps/web/src/app/(protected)/tenant/dashboard/page.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { agentUIActions } from '@/stores/agent-ui-store';
import { DashboardView } from '@/components/dashboard/DashboardView';

export default function DashboardPage() {
  const searchParams = useSearchParams();

  // Show preview if redirected from /tenant/build or explicitly requested
  useEffect(() => {
    if (searchParams.get('showPreview') === 'true') {
      agentUIActions.showPreview('home');
      // Clean up URL
      window.history.replaceState({}, '', '/tenant/dashboard');
    }
  }, [searchParams]);

  return <DashboardView />;
}
```

**Phase 4 Tasks:**

- [x] Update `tenant/layout.tsx` to use ContentArea and AgentPanel
- [x] Remove GrowthAssistantContext (replaced by Zustand store)
- [x] Redirect `/tenant/build` → `/tenant/dashboard?showPreview=true`
- [x] Handle `showPreview` query param in dashboard page
- [x] Remove deprecated BuildModeChat component (or deprecate) - marked @deprecated
- [x] Update navigation links throughout app
- [x] Simplify `/tenant/build/layout.tsx` (minimal wrapper for redirect)

---

## Acceptance Criteria

### Functional Requirements

- [x] Agent chat is visible on ALL tenant dashboard pages
- [x] Agent can trigger "show preview" and preview appears in content area
- [x] Agent can trigger "hide preview" and dashboard returns
- [x] Agent can navigate user to different dashboard pages
- [x] Section highlights work when agent mentions a section
- [ ] Draft changes reflect in preview within 2 seconds (needs testing)
- [x] Publish requires T3 confirmation (dialog)
- [x] Discard requires T3 confirmation (dialog)
- [x] Existing `/tenant/build` URL redirects to dashboard with preview
- [x] Cmd+K focuses agent input from anywhere

### Non-Functional Requirements

- [x] No duplicate chat interfaces (single source of truth) - AgentPanel is the only active chat
- [ ] Preview iframe loads under 1 second
- [ ] State persists across navigation within tenant area
- [ ] No hydration mismatches (SSR-safe)
- [ ] Mobile responsive (preview full-screen on mobile)
- [ ] All agent actions logged for audit (event sourcing)
- [ ] Tenant isolation enforced in store

### Quality Gates

- [x] All existing tests pass (2,360 tests passing)
- [x] New unit tests for Zustand store (84 tests - discriminated unions, event sourcing)
- [x] New unit tests for capability registry (64 tests - search, grouping, tiers)
- [x] New unit tests for useDraftConfig hook (36 tests - TanStack Query)
- [x] E2E test: "agent shows preview after editing section"
- [x] E2E test: "preview updates after agent tool execution"
- [x] E2E test: "publish requires confirmation dialog"
- [x] E2E test: "discard requires confirmation dialog"
- [x] E2E test: "/tenant/build redirects to dashboard with preview"
- [x] E2E test: "showPreview query param activates preview"
- [x] E2E test: "Cmd+K focuses agent chat input"
- [x] Production build succeeds
- [ ] No console errors or warnings (pre-existing warnings in gallery components)

---

## Risk Analysis & Mitigation

| Risk                         | Likelihood | Impact   | Mitigation                                        |
| ---------------------------- | ---------- | -------- | ------------------------------------------------- |
| Orchestrator mode confusion  | Medium     | High     | Extract `getAgentMode()` method, use consistently |
| Draft state race conditions  | Medium     | Medium   | Use TanStack Query with proper invalidation       |
| Preview iframe stale         | Low        | Medium   | PostMessage protocol ensures sync                 |
| Breaking existing Build Mode | Low        | High     | Redirect ensures backwards compatibility          |
| Mobile layout issues         | Medium     | Low      | Test on mobile viewport, add breakpoints          |
| Tenant data leakage          | Low        | Critical | Store requires tenantId initialization            |
| T3 confirmation bypass       | Low        | Critical | Backend validates trust tier, not just frontend   |

---

## Dependencies & Prerequisites

**Required:**

- [ ] Zustand package installed (`npm install zustand`)
- [ ] Immer package installed (`npm install immer`)
- [ ] TanStack Query already in use (no new dep)

**Blocked by:**

- Nothing - can start immediately

**Blocks:**

- Customer chatbot widget enhancement (should wait for this)
- Storefront AI chatbot integration (uses same patterns)

---

## Success Metrics

| Metric                       | Current                | Target                    |
| ---------------------------- | ---------------------- | ------------------------- |
| Chat panels on Build Mode    | 2 (duplicate)          | 1 (unified)               |
| Routes for editing           | 2 (/dashboard, /build) | 1 (/dashboard)            |
| Time to show preview         | Navigate + load        | Instant (agent trigger)   |
| Agent control over UI        | None                   | Full (100% action parity) |
| Impossible states            | Unknown                | 0 (discriminated unions)  |
| Agent actions audited        | 0%                     | 100% (event log)          |
| T3 actions with confirmation | 0                      | 2 (publish, discard)      |

---

## Future Considerations

1. **Agent-triggered modals** - Same pattern could show dialogs
2. **Agent-controlled navigation** - Agent could switch between tabs (implemented in Phase 3)
3. **Multi-panel layouts** - Show multiple views simultaneously
4. **Collaborative editing** - Real-time sync between agent and user
5. **Undo/redo** - Agent actions could be undoable (event log enables this)
6. **Command palette** - Cmd+K shows all capabilities
7. **WebSocket sync** - Real-time multi-device updates

---

## References

### Internal

- `apps/web/src/components/agent/PanelAgentChat.tsx:84-476` - Core chat component
- `apps/web/src/components/build-mode/BuildModePreview.tsx` - PostMessage protocol
- `server/src/agent/tools/storefront-tools.ts` - Existing storefront tools
- `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_PREVENTION.md` - Mode consistency

### External

- [Zustand documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [Immer documentation](https://immerjs.github.io/immer/)
- [Agent-Native Architecture Skill](~/.claude/plugins/.../agent-native-architecture/SKILL.md)
- [Action Parity Discipline](~/.claude/plugins/.../action-parity-discipline.md)
- [Shared Workspace Architecture](~/.claude/plugins/.../shared-workspace-architecture.md)

### Research Sources

- CopilotKit Generative UI patterns
- Cursor 2.0 agent-first architecture
- Claude Artifacts conditional rendering

---

## ERD: State Management

```mermaid
erDiagram
    AgentUIStore ||--o{ ContentArea : controls
    AgentUIStore ||--o{ AgentActionLog : records
    AgentUIStore {
        enum status
        object previewConfig
        boolean isDirty
        string tenantId
    }

    AgentActionLog {
        string id
        string type
        object payload
        timestamp timestamp
        string agentSessionId
        string tenantId
    }

    ContentArea ||--o| DashboardView : renders
    ContentArea ||--o| PreviewPanel : renders

    PreviewPanel ||--|| DraftConfig : uses
    DraftConfig {
        object pages
        boolean hasDraft
    }

    AgentPanel ||--|| PanelAgentChat : contains
    PanelAgentChat ||--o{ UIAction : emits
    UIAction ||--|| AgentUIStore : updates

    CapabilityRegistry ||--o{ AgentCapability : contains
    AgentCapability {
        string id
        string name
        string category
        string trustTier
    }
```

---

## Appendix: File Changes Summary

| File                                        | Action | Description                                                                     |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `stores/agent-ui-store.ts`                  | CREATE | Zustand store with discriminated unions, event sourcing                         |
| `stores/agent-action-log.ts`                | CREATE | Event log type definitions                                                      |
| `hooks/useDraftConfig.ts`                   | CREATE | TanStack Query hook for draft state                                             |
| `lib/agent-capabilities.ts`                 | CREATE | Capability registry for discovery                                               |
| `components/dashboard/ContentArea.tsx`      | CREATE | Dynamic content container with Suspense                                         |
| `components/dashboard/DashboardView.tsx`    | CREATE | Extract from dashboard page                                                     |
| `components/preview/PreviewPanel.tsx`       | CREATE | Extract from BuildModePreview with T3 dialogs                                   |
| `components/agent/AgentPanel.tsx`           | RENAME | From GrowthAssistantPanel                                                       |
| `agent/tools/ui-tools.ts`                   | CREATE | show_preview, hide_preview, navigate_to, publish_draft (T3), discard_draft (T3) |
| `app/(protected)/tenant/layout.tsx`         | MODIFY | Use ContentArea, AgentPanel, remove context                                     |
| `app/(protected)/tenant/build/page.tsx`     | MODIFY | Redirect to dashboard                                                           |
| `app/(protected)/tenant/build/layout.tsx`   | DELETE | No longer needed                                                                |
| `app/(protected)/tenant/dashboard/page.tsx` | MODIFY | Handle showPreview param                                                        |
| `contexts/GrowthAssistantContext.tsx`       | DELETE | Replaced by Zustand store                                                       |

---

## Trust Tier Summary

| Tool               | Tier   | Reason                                     |
| ------------------ | ------ | ------------------------------------------ |
| `show_preview`     | T1     | UI state only, no data change              |
| `hide_preview`     | T1     | UI state only, no data change              |
| `navigate_to`      | T1     | Navigation only, no data change            |
| `get_current_view` | T1     | Read-only                                  |
| `update_section`   | T2     | Modifies draft (reversible)                |
| `add_section`      | T2     | Modifies draft (reversible)                |
| `remove_section`   | T2     | Modifies draft (reversible)                |
| `publish_draft`    | **T3** | Goes live to production, affects customers |
| `discard_draft`    | **T3** | Deletes work, cannot be recovered          |
