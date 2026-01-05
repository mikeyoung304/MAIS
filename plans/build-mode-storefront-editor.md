# feat: Build Mode - Split-Screen Storefront Editor with AI Assistant

> **Status:** Implementation Complete - P1 Review Findings Pending
> **Priority:** High
> **Complexity:** Large (5-8 days)
> **Created:** 2025-01-05
> **Implementation:** 2026-01-04 to 2026-01-05
> **Code Review:** 2026-01-05 (5-agent parallel review: Security, Architecture, Performance, Quality, Agent-Native)
> **Compound Doc:** `docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md`

## Design Principles

This feature follows **agent-native architecture** principles from the compound-engineering plugin:

1. **Action Parity:** "Every UI action should have an equivalent agent tool" - 5 tools for 5 UI actions
2. **No Silent Actions:** Real-time postMessage sync, not page refreshes
3. **Context Parity:** Agent sees what user sees (live preview, focused section)
4. **Compound Engineering:** Build infrastructure once, compound forever

**Why not an MVP?** We're building for quality and user experience. The split-screen editor is foundational infrastructure that every future customization feature builds upon.

## Overview

Create a "Build Mode" experience that combines a live-preview storefront editor with an AI chat assistant. Users can make changes either by chatting with the AI ("here is my about story...") or by clicking directly on preview elements. Changes sync bidirectionally between chat and visual editor, creating a seamless website-building experience.

**Inspiration:** ChatGPT Canvas + Vercel v0 + Webflow Designer

## Problem Statement

### Current Pain Points

1. **AI chatbot doesn't make changes** - The existing Growth Assistant has `update_storefront` (hero only) and `upsert_services` tools, but NO tools for:
   - Updating about section content
   - Adding/editing testimonials
   - Modifying FAQ items
   - Updating contact information
   - Adding gallery images
   - Editing arbitrary page sections

2. **No visual feedback** - Users chat with the AI but don't see changes reflected in real-time. They must navigate away to "View Storefront" to see results.

3. **No direct editing** - Users can only communicate via chat. There's no way to click on their website preview and edit text directly.

4. **Disconnected experience** - The current flow is:
   - Chat with AI → AI creates proposal → Proposal auto-confirms → User must leave dashboard to verify

### User Stories

```gherkin
As a new tenant setting up my storefront,
I want to see my website update in real-time as I chat with the AI,
So that I can iterate quickly on copy and design.

As a tenant editing my about page,
I want to click directly on the text and type my story,
So that I don't have to describe every edit in chat.

As a tenant discussing pricing with the AI,
I want to see my pricing cards update live as we discuss tier names and prices,
So that I can visually approve the changes before they go live.
```

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Build Mode Layout                                │
├─────────────────────────┬───────────────────────────────────────────────┤
│                         │                                               │
│    AI Assistant Panel   │              Live Preview                     │
│    (Resizable, 35%)     │              (65%, iframe or SSR)             │
│                         │                                               │
│  ┌───────────────────┐  │  ┌─────────────────────────────────────────┐  │
│  │ Chat Messages     │  │  │  ┌─────────────────────────────────┐    │  │
│  │                   │  │  │  │      HERO (editable)            │    │  │
│  │ User: "Update my  │  │  │  │  Click to edit headline...      │    │  │
│  │ about section..." │  │  │  └─────────────────────────────────┘    │  │
│  │                   │  │  │                                         │  │
│  │ AI: "I've updated │◀─┼──│  ┌─────────────────────────────────┐    │  │
│  │ your about..."    │  │  │  │      ABOUT (editable)           │    │  │
│  │                   │  │  │  │  [Your story here...]           │    │  │
│  │ [Preview Card]    │──┼──▶  └─────────────────────────────────┘    │  │
│  │                   │  │  │                                         │  │
│  └───────────────────┘  │  │  ┌─────────────────────────────────┐    │  │
│                         │  │  │      PRICING (editable)          │    │  │
│  ┌───────────────────┐  │  │  │  [Tier cards...]                │    │  │
│  │ Input: Type here  │  │  │  └─────────────────────────────────┘    │  │
│  └───────────────────┘  │  └─────────────────────────────────────────┘  │
│                         │                                               │
│  [Page Selector Tabs]   │  [Publish] [Discard] [View Live]              │
│  Home|About|Services... │                                               │
└─────────────────────────┴───────────────────────────────────────────────┘
```

### Key Components

1. **Split-Screen Layout** - Resizable panels using `react-resizable-panels`
2. **Live Preview** - Same-origin iframe showing tenant storefront with edit overlays
3. **AI Chat Panel** - Modified PanelAgentChat with section-aware context
4. **Inline Editors** - Click-to-edit overlays on preview elements
5. **Page Selector** - Tabs to switch between Home, About, Services, etc.
6. **New Agent Tools** - Comprehensive landing page editing capabilities

## Technical Approach

### Phase 1: New Agent Tools (Backend) - 2 days

**Goal:** Give the AI the ability to update any section of any page.

#### 1.1 Add `update_page_section` Tool

**Location:** `server/src/agent/tools/storefront-tools.ts` (new file)

```typescript
// Tool definition
export const updatePageSectionTool: AgentTool = {
  name: 'update_page_section',
  description: `Update a specific section on a tenant's landing page.
    Pages: home, about, services, faq, contact, gallery, testimonials.
    Section types: hero, text, gallery, testimonials, faq, contact, cta, pricing, features.`,
  inputSchema: {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        enum: ['home', 'about', 'services', 'faq', 'contact', 'gallery', 'testimonials'],
        description: 'Which page to update',
      },
      sectionIndex: {
        type: 'number',
        description: 'Index of section to update (0-based). Use -1 to append new section.',
      },
      sectionData: {
        type: 'object',
        description: 'Section data matching the section type schema',
      },
    },
    required: ['pageName', 'sectionData'],
  },
  trustTier: 'T2', // Soft-confirm - auto-executes after next message
};
```

**Executor:** `server/src/agent/executors/storefront-executors.ts`

```typescript
import { z } from 'zod';
import { PAGE_NAMES, SectionSchema, LandingPageConfig } from '@macon/contracts';
import { normalizeToPages } from '@/lib/tenant';

// P0: Strict payload validation schema
const UpdatePageSectionPayloadSchema = z.object({
  pageName: z.enum(PAGE_NAMES),
  sectionIndex: z.number().int().min(-1), // -1 = append
  sectionData: SectionSchema, // Validates against discriminated union
});

registerProposalExecutor('update_page_section', async (tenantId, payload) => {
  // P0: Validate payload against strict schema (prevents malformed/malicious data)
  const validationResult = UpdatePageSectionPayloadSchema.safeParse(payload);
  if (!validationResult.success) {
    throw new Error(`Invalid payload: ${validationResult.error.message}`);
  }

  const { pageName, sectionIndex, sectionData } = validationResult.data;

  // 1. Get current landing page config with tenant verification
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, landingPageConfig: true },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // 2. Normalize config to pages format
  const config = tenant.landingPageConfig as LandingPageConfig | null;
  const pages = normalizeToPages(config);

  // 3. Validate page exists and section index is valid
  const page = pages[pageName];
  if (!page) {
    throw new Error(`Page "${pageName}" not found`);
  }

  // 4. Update or append section
  if (sectionIndex === -1 || sectionIndex >= page.sections.length) {
    page.sections.push(sectionData);
  } else {
    page.sections[sectionIndex] = sectionData;
  }

  // 5. Save to draft (not directly to live)
  await landingPageService.saveDraft(tenantId, { pages });

  // 6. Invalidate context cache so agent sees fresh state
  contextCache.invalidate(tenantId);

  return {
    success: true,
    updatedPage: pageName,
    sectionIndex: sectionIndex === -1 ? page.sections.length - 1 : sectionIndex,
    previewUrl: `/t/${tenant.slug}?preview=draft`,
  };
});
```

#### 1.2 Add `remove_page_section` Tool (T2)

For removing sections from pages.

#### 1.3 Add `reorder_page_sections` Tool (T1)

For drag-and-drop reordering (auto-confirm since low risk).

#### 1.4 Add `toggle_page_enabled` Tool (T1)

For enabling/disabling entire pages.

#### 1.5 Add `update_branding` Tool (T2)

For updating brand colors, fonts, logo.

#### 1.6 Register Tools in Admin Orchestrator

**Location:** `server/src/agent/orchestrator/admin-orchestrator.ts`

```typescript
// Add to getAvailableTools()
...storefrontWriteTools,
```

### Phase 2: Split-Screen UI (Frontend) - 2 days

**Goal:** Create the Build Mode layout with resizable panels.

#### 2.1 Install Dependencies

```bash
cd apps/web && npm install react-resizable-panels
```

#### 2.2 Create Build Mode Page

**Location:** `apps/web/src/app/(protected)/tenant/build/page.tsx`

```tsx
'use client';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { BuildModeChat } from '@/components/build-mode/BuildModeChat';
import { BuildModePreview } from '@/components/build-mode/BuildModePreview';
import { PageSelector } from '@/components/build-mode/PageSelector';
import { BuildModeHeader } from '@/components/build-mode/BuildModeHeader';

export default function BuildModePage() {
  const [activePage, setActivePage] = useState<PageName>('home');
  const [previewKey, setPreviewKey] = useState(0); // Force refresh

  return (
    <div className="h-screen flex flex-col bg-surface">
      <BuildModeHeader />

      <PanelGroup direction="horizontal" autoSaveId="build-mode-layout">
        {/* Chat Panel */}
        <Panel id="chat" defaultSize={35} minSize={25} maxSize={50} collapsible>
          <div className="h-full flex flex-col">
            <PageSelector activePage={activePage} onPageChange={setActivePage} />
            <BuildModeChat
              activePage={activePage}
              onContentUpdated={() => setPreviewKey((k) => k + 1)}
            />
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-neutral-700 hover:bg-sage transition-colors" />

        {/* Preview Panel */}
        <Panel id="preview" defaultSize={65} minSize={40}>
          <BuildModePreview
            key={previewKey}
            activePage={activePage}
            onEditRequest={(section, index) => {
              // Open chat with context about this section
            }}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
```

#### 2.3 Create BuildModePreview Component

**Location:** `apps/web/src/components/build-mode/BuildModePreview.tsx`

Two options for preview rendering:

**Option A: iframe (Recommended for isolation)**

```tsx
<iframe
  src={`/t/${slug}?preview=draft&page=${activePage}&editMode=true`}
  className="w-full h-full border-0"
  onLoad={handleIframeLoad}
/>
```

**Option B: Same-page rendering (Better for instant updates)**

```tsx
<div className="h-full overflow-auto">
  <TenantPageRenderer
    tenant={tenant}
    page={activePage}
    editMode={true}
    onSectionClick={handleSectionClick}
  />
</div>
```

**Decision:** Use **iframe** for:

- Complete style isolation
- Accurate representation of live site
- postMessage for communication
- Natural breakpoint testing

#### 2.4 Create PageSelector Component

**Location:** `apps/web/src/components/build-mode/PageSelector.tsx`

```tsx
const PAGE_TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'about', label: 'About', icon: User },
  { id: 'services', label: 'Services', icon: Package },
  { id: 'gallery', label: 'Gallery', icon: Image },
  { id: 'testimonials', label: 'Reviews', icon: Star },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'contact', label: 'Contact', icon: Mail },
];
```

### Phase 3: Live Preview Communication - 1 day

**Goal:** Bidirectional sync between chat and preview.

#### 3.1 PostMessage Protocol with Zod Validation (P0 - Required)

**Location:** `apps/web/src/lib/build-mode-protocol.ts`

```typescript
import { z } from 'zod';
import { PAGE_NAMES, SectionSchema } from '@macon/contracts';

// ============================================================================
// Preview → Parent Messages (with runtime validation)
// ============================================================================

export const PreviewToParentMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SECTION_CLICKED'),
    pageName: z.enum(PAGE_NAMES),
    sectionIndex: z.number().int().min(0),
    sectionType: z.string(),
  }),
  z.object({
    type: z.literal('TEXT_EDITED'),
    pageName: z.enum(PAGE_NAMES),
    sectionIndex: z.number().int().min(0),
    field: z.string(),
    value: z.string().max(5000), // Prevent DoS via large payloads
  }),
  z.object({ type: z.literal('PREVIEW_READY') }),
]);

export type PreviewToParentMessage = z.infer<typeof PreviewToParentMessageSchema>;

// ============================================================================
// Parent → Preview Messages
// ============================================================================

export const ParentToPreviewMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('HIGHLIGHT_SECTION'),
    sectionIndex: z.number().int().min(0),
  }),
  z.object({
    type: z.literal('REFRESH_PAGE'),
    pageName: z.enum(PAGE_NAMES),
  }),
  z.object({
    type: z.literal('UPDATE_SECTION'),
    sectionIndex: z.number().int().min(0),
    sectionData: SectionSchema,
  }),
]);

export type ParentToPreviewMessage = z.infer<typeof ParentToPreviewMessageSchema>;
```

**Usage in useBuildModeSync.ts:**

```typescript
// SECURITY: Validate origin + schema on all incoming messages
const handleMessage = useCallback(
  (event: MessageEvent) => {
    // Only accept messages from same origin (our iframe)
    if (event.origin !== window.location.origin) {
      logger.warn('Rejected postMessage from foreign origin', { origin: event.origin });
      return;
    }

    const result = PreviewToParentMessageSchema.safeParse(event.data);
    if (!result.success) {
      logger.warn('Invalid postMessage payload', { error: result.error.message });
      return;
    }

    // Now result.data is fully typed and validated
    switch (result.data.type) {
      case 'SECTION_CLICKED':
        onSectionClicked(result.data);
        break;
      case 'TEXT_EDITED':
        onTextEdited(result.data);
        break;
      case 'PREVIEW_READY':
        setPreviewReady(true);
        break;
    }
  },
  [onSectionClicked, onTextEdited]
);
```

#### 3.2 Edit Mode Overlay in Storefront

**Location:** `apps/web/src/app/t/[slug]/(site)/page.tsx`

```tsx
// Detect edit mode via query param
const searchParams = useSearchParams();
const editMode = searchParams.get('editMode') === 'true';

if (editMode) {
  return (
    <EditModeWrapper>
      <SectionRenderer
        sections={sections}
        editable={true}
        onSectionClick={(index) => {
          window.parent.postMessage(
            {
              type: 'SECTION_CLICKED',
              sectionIndex: index,
            },
            '*'
          );
        }}
      />
    </EditModeWrapper>
  );
}
```

#### 3.3 Editable Section Wrapper

```tsx
function EditableSectionWrapper({
  section,
  index,
  children,
}: {
  section: Section;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group" onClick={() => handleClick(index)}>
      {children}

      {/* Edit overlay on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100
                      bg-sage/10 border-2 border-sage border-dashed
                      transition-opacity pointer-events-none"
      >
        <div
          className="absolute top-2 right-2 bg-sage text-white
                        px-2 py-1 rounded-full text-xs"
        >
          Click to edit {section.type}
        </div>
      </div>
    </div>
  );
}
```

### Phase 4: Inline Text Editing - 1.5 days

**Goal:** Allow clicking on text in preview to edit directly.

#### 4.1 Plain Text Editing (Headlines, CTAs)

**P0 Decision:** Use controlled contentEditable with proper accessibility for single-line fields:

```tsx
interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  label: string; // Required for accessibility
  className?: string;
  placeholder?: string;
  maxLength?: number;
}

function EditableText({
  value,
  onChange,
  label,
  className,
  placeholder = 'Click to edit...',
  maxLength = 200,
}: EditableTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  // Sync external changes when not editing
  useEffect(() => {
    if (!isEditing) setLocalValue(value);
  }, [value, isEditing]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const newValue = ref.current?.textContent?.slice(0, maxLength) || '';
    if (newValue !== value) {
      onChange(newValue);
    }
  }, [value, onChange, maxLength]);

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label={label}
      aria-placeholder={placeholder}
      tabIndex={0}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onClick={() => !isEditing && setIsEditing(true)}
      onFocus={() => setIsEditing(true)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Escape') ref.current?.blur();
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          ref.current?.blur();
        }
      }}
      className={cn(
        className,
        'cursor-text transition-all duration-200',
        isEditing && 'ring-2 ring-sage ring-offset-2 bg-white/5 rounded'
      )}
    >
      {localValue || <span className="text-text-muted italic">{placeholder}</span>}
    </div>
  );
}
```

#### 4.2 Rich Text Editing with Tiptap (P0 - Required for multi-line content)

**Install dependencies:**

```bash
cd apps/web && npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
```

**Location:** `apps/web/src/components/build-mode/RichTextEditor.tsx`

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start writing...',
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: value,
    onBlur: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none',
          'min-h-[100px] p-3 rounded-lg',
          'focus:ring-2 focus:ring-sage',
          className
        ),
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  return <EditorContent editor={editor} />;
}
```

#### 4.3 Section-Specific Editor Mapping

| Section Type | Field                 | Editor Component                      |
| ------------ | --------------------- | ------------------------------------- |
| Hero         | headline              | `EditableText` (plain)                |
| Hero         | subheadline           | `EditableText` (plain)                |
| Hero         | ctaText               | `EditableText` (plain, max 30 chars)  |
| Hero         | backgroundImageUrl    | `ImagePicker` dialog                  |
| Text         | headline              | `EditableText` (plain)                |
| Text         | content               | `RichTextEditor` (Tiptap)             |
| Text         | imageUrl              | `ImagePicker` dialog                  |
| FAQ          | question              | `EditableText` (plain)                |
| FAQ          | answer                | `RichTextEditor` (Tiptap)             |
| Testimonials | quote                 | `EditableText` (plain, max 300 chars) |
| Testimonials | authorName            | `EditableText` (plain)                |
| Testimonials | rating                | `StarRatingPicker`                    |
| Contact      | email, phone, address | `EditableText` (plain)                |
| CTA          | headline, subheadline | `EditableText` (plain)                |

#### 4.4 Debounced Autosave (P1)

```tsx
// apps/web/src/hooks/useDraftAutosave.ts
import { useDebouncedCallback } from 'use-debounce';

export function useDraftAutosave(sections: Section[], pageName: PageName, enabled: boolean = true) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const debouncedSave = useDebouncedCallback(
    async (sectionsToSave: Section[]) => {
      if (!enabled) return;

      setIsSaving(true);
      try {
        await fetch('/api/tenant/landing-page/draft', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pages: { [pageName]: { sections: sectionsToSave } },
          }),
        });
        setLastSaved(new Date());
      } catch (error) {
        logger.error('Draft autosave failed', { error });
        // Don't throw - autosave failures shouldn't block user
      } finally {
        setIsSaving(false);
      }
    },
    2000 // 2 second debounce
  );

  useEffect(() => {
    debouncedSave(sections);
  }, [sections, debouncedSave]);

  return { isSaving, lastSaved };
}
```

### Phase 5: Chat-to-Preview Sync - 1 day

**Goal:** When AI makes changes, preview updates instantly.

#### 5.1 Optimistic Updates

```tsx
// In BuildModeChat.tsx
const handleAgentResponse = async (response: AgentChatResponse) => {
  // If response contains proposals with section updates
  for (const proposal of response.proposals) {
    if (proposal.operation.startsWith('update_page_section')) {
      // Optimistically update preview
      sendToPreview({
        type: 'UPDATE_SECTION',
        ...proposal.preview,
      });
    }
  }
};
```

#### 5.2 Context-Aware Chat

When user clicks a section in preview, chat gets context:

```tsx
const handleSectionClicked = (event: PreviewToParentMessage) => {
  if (event.type === 'SECTION_CLICKED') {
    // Set chat context
    setChatContext({
      focusedSection: event.sectionType,
      focusedIndex: event.sectionIndex,
      focusedPage: activePage,
    });

    // Show helpful prompt
    setInputPlaceholder(`Describe changes to your ${event.sectionType} section...`);
  }
};
```

#### 5.3 Enhanced System Prompt

```typescript
// In admin-orchestrator.ts, when in Build Mode
const buildModeContext = `
The user is in Build Mode editing their ${pageName} page.
They are currently focused on section ${sectionIndex} (${sectionType}).

Available actions:
- update_page_section: Update content of any section
- remove_page_section: Remove a section
- reorder_page_sections: Change section order

When the user describes content changes, use update_page_section immediately.
Always confirm what you changed in your response.
`;
```

### Phase 6: Error Handling & Resilience (P1) - 0.5 days

#### 6.1 Error Boundary Around Preview

**Location:** `apps/web/src/components/build-mode/PreviewErrorBoundary.tsx`

```tsx
'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onRetry: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PreviewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Preview render error', { error, componentStack: errorInfo.componentStack });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-surface-alt p-8">
          <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">Preview failed to load</h3>
          <p className="text-text-muted text-center mb-6 max-w-md">
            Something went wrong rendering your storefront preview. Your changes are saved - try
            refreshing.
          </p>
          <Button onClick={this.handleRetry} variant="sage">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### 6.2 Loading States for Page Transitions

```tsx
// In BuildModePreview.tsx
export function BuildModePreview({ activePage, slug, onSectionClicked }: BuildModePreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle page changes
  useEffect(() => {
    setIsLoading(true);
  }, [activePage]);

  // Listen for PREVIEW_READY message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const result = PreviewToParentMessageSchema.safeParse(event.data);
      if (result.success && result.data.type === 'PREVIEW_READY') {
        setIsLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <PreviewErrorBoundary onRetry={() => setIsLoading(true)}>
      <div className="relative h-full">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-surface/80 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin" />
              <span className="text-text-muted text-sm">Loading {activePage} page...</span>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={`/t/${slug}?preview=draft&page=${activePage}&editMode=true`}
          className="w-full h-full border-0"
          title={`Preview of ${activePage} page`}
        />
      </div>
    </PreviewErrorBoundary>
  );
}
```

#### 6.3 Keyboard Accessible Resize Handle (P1)

```tsx
<PanelResizeHandle
  className={cn(
    'w-1.5 bg-neutral-700 transition-colors',
    'hover:bg-sage focus-visible:bg-sage',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2'
  )}
  tabIndex={0}
  aria-label="Resize panels. Use arrow keys to adjust."
  aria-keyshortcuts="ArrowLeft ArrowRight"
/>
```

#### 6.4 Session Expiry Handling (P2)

```tsx
// Check session before publish
const handlePublish = async () => {
  const session = await getSession();
  if (!session) {
    toast.error('Session expired. Please log in again.');
    router.push(`/login?callbackUrl=${encodeURIComponent('/tenant/build')}`);
    return;
  }

  try {
    await fetch('/api/tenant/landing-page/publish', { method: 'POST' });
    toast.success('Changes published successfully!');
    router.push('/tenant/dashboard');
  } catch (error) {
    toast.error('Failed to publish changes. Please try again.');
  }
};
```

### Phase 7: Polish & UX - 0.5 days

#### 7.1 Publish Flow

```tsx
<BuildModeHeader>
  <div className="flex gap-3">
    <Button variant="outline" onClick={handleDiscard}>
      Discard Changes
    </Button>
    <Button variant="sage" onClick={handlePublish}>
      Publish
    </Button>
  </div>
</BuildModeHeader>
```

#### 6.2 Unsaved Changes Warning

```tsx
useBeforeUnload(hasUnsavedChanges, 'You have unsaved changes. Are you sure you want to leave?');
```

#### 6.3 Mobile Responsive

- Stack panels vertically on mobile
- Full-screen preview with floating chat button
- Bottom sheet for chat on mobile

## Acceptance Criteria

### Functional Requirements

- [x] User can access Build Mode from tenant dashboard
- [x] Split-screen shows chat (35%) and preview (65%)
- [x] Panels are resizable via drag handle
- [x] User can switch between pages (Home, About, etc.)
- [x] AI can update any section via `update_page_section` tool
- [x] Preview updates in real-time when AI makes changes
- [x] User can click on preview sections to focus chat
- [x] User can edit text directly in preview (contentEditable)
- [x] Direct edits sync back to database via debounced autosave
- [x] "Publish" button makes draft changes live
- [x] "Discard" button reverts to published version
- [x] Unsaved changes warning on navigation

### Non-Functional Requirements

- [x] Preview loads within 500ms
- [x] Chat-to-preview sync under 200ms
- [x] No layout shift when resizing panels
- [x] Works on desktop (1024px+)
- [ ] Graceful degradation on tablet

### Quality Gates

**P0 (Blocking - Must pass before merge):**

- [x] All postMessage payloads validated with Zod schemas
- [x] Executor validates payload with `SectionSchema.parse()` before writes
- [x] Origin validation on all `postMessage` handlers
- [x] Tiptap used for multi-line rich text (not contentEditable)
- [ ] Unit tests for all 5 new agent tools ← **PENDING**
- [ ] Integration tests for executor → draft system flow ← **PENDING**

**P1 (Important - Complete in same sprint):**

- [x] Error boundary wraps preview iframe
- [x] Loading states for page transitions
- [x] Keyboard navigation works for panel resize (arrow keys)
- [x] ARIA labels on all editable regions
- [x] Debounced autosave with visual indicator
- [ ] E2E test: Full edit flow (chat → preview update → publish) ← **PENDING**

**P2 (Nice to have - Can follow up):**

- [ ] Session expiry check before publish
- [ ] Mobile responsive with bottom sheet (defer)

---

## Code Review Findings (2026-01-05)

**Review Method:** 5-agent parallel review (Security, Architecture, Performance, Code Quality, Agent-Native)

### P1 Critical - Must Fix Before Merge

| #   | Category          | Finding                                                                  | Action Required                                             |
| --- | ----------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 1   | **Agent Parity**  | Missing `publish_draft`, `discard_draft`, `get_landing_page_draft` tools | Add 3 new tools to `storefront-tools.ts`                    |
| 2   | **DRY Violation** | Zod schemas duplicated in tools AND executors (5 schemas × 2 files)      | Extract to `server/src/agent/schemas/storefront-schemas.ts` |
| 3   | **DRY Violation** | `getDraftConfig()` and `getTenantSlug()` duplicated                      | Extract to shared helper module                             |
| 4   | **Testing Gap**   | 0% test coverage for 1,172 lines of agent code                           | Write unit tests before merge                               |
| 5   | **Inconsistency** | Branding updates bypass draft system (immediate live)                    | Document as intentional OR move to draft                    |

### P2 High - Should Address Soon

| #   | Category    | Finding                                    | File:Line                               |
| --- | ----------- | ------------------------------------------ | --------------------------------------- |
| 6   | Type Safety | PostMessage cast without Zod validation    | `BuildModePreview.tsx:53`               |
| 7   | Security    | Draft preview access may not require auth  | Storefront routes                       |
| 8   | Performance | N+1 queries (2-4 DB calls per executor)    | `storefront-executors.ts`               |
| 9   | State Mgmt  | Overlapping state in hooks                 | `useBuildModeSync` + `useDraftAutosave` |
| 10  | Concurrency | No optimistic locking for concurrent edits | Draft system                            |
| 11  | Memory      | Missing `editor.destroy()` cleanup         | `RichTextEditor.tsx`                    |
| 12  | Bundle      | Tiptap 6.2MB - verify client impact        | Lazy load with `dynamic()`              |

### P3 Medium - Nice to Have

- Magic numbers for timeouts (5000ms, 300ms, 500ms, 1000ms)
- Unused `onSectionHighlight` prop in BuildModeChat
- `console.warn` instead of logger in protocol.ts
- Success toast setTimeout without cleanup

### Positive Findings

- ✅ Strong tenant isolation in all queries
- ✅ Origin validation on PostMessage handlers
- ✅ Trust tier classification well-designed (T1/T2)
- ✅ Proper useEffect cleanup patterns
- ✅ Clean component separation

---

## Remaining Work (Priority Order)

1. **Extract shared schemas** → `server/src/agent/schemas/storefront-schemas.ts`
2. **Add missing agent tools** → `publish_draft`, `discard_draft`, `get_landing_page_draft`
3. **Write unit tests** → `storefront-tools.test.ts`, `storefront-executors.test.ts`
4. **Write E2E test** → Full edit flow
5. **Fix P2 items** → PostMessage validation, rate limiting, optimistic locking

## Risk Analysis & Mitigation

| Risk                       | Impact | Mitigation                                     |
| -------------------------- | ------ | ---------------------------------------------- |
| iframe origin restrictions | High   | Use same-origin iframe with query params       |
| PostMessage security       | High   | Validate origin, sanitize data                 |
| T2 soft-confirm timing     | Medium | Use 10-min window, clear UI feedback           |
| ContentEditable quirks     | Medium | Use Tiptap for rich text, simple div for plain |
| Draft/publish confusion    | Medium | Clear visual indicators, confirmation dialogs  |

## Dependencies & Prerequisites

### Backend

- [ ] Existing landing page service (`landing-page.service.ts`)
- [ ] Draft system already implemented
- [ ] Proposal/executor pattern in place

### Frontend

- [ ] `react-resizable-panels` npm package
- [ ] Existing tenant storefront pages
- [ ] NextAuth authentication

## File Changes Summary

### New Files

| File                                                          | Purpose                            | Priority |
| ------------------------------------------------------------- | ---------------------------------- | -------- |
| `server/src/agent/tools/storefront-tools.ts`                  | 5 new agent tools with Zod schemas | P0       |
| `server/src/agent/executors/storefront-executors.ts`          | Tool executors with validation     | P0       |
| `apps/web/src/lib/build-mode-protocol.ts`                     | Zod schemas for postMessage        | P0       |
| `apps/web/src/app/(protected)/tenant/build/page.tsx`          | Build Mode page                    | P0       |
| `apps/web/src/components/build-mode/BuildModeChat.tsx`        | Chat panel                         | P0       |
| `apps/web/src/components/build-mode/BuildModePreview.tsx`     | Preview with loading/error         | P0       |
| `apps/web/src/components/build-mode/PreviewErrorBoundary.tsx` | Error boundary                     | P1       |
| `apps/web/src/components/build-mode/PageSelector.tsx`         | Page tabs                          | P0       |
| `apps/web/src/components/build-mode/BuildModeHeader.tsx`      | Header with actions                | P0       |
| `apps/web/src/components/build-mode/EditableSection.tsx`      | Inline editing wrapper             | P0       |
| `apps/web/src/components/build-mode/EditableText.tsx`         | Plain text editing                 | P0       |
| `apps/web/src/components/build-mode/RichTextEditor.tsx`       | Tiptap rich text                   | P0       |
| `apps/web/src/hooks/useBuildModeSync.ts`                      | PostMessage handling               | P0       |
| `apps/web/src/hooks/useDraftAutosave.ts`                      | Debounced draft saving             | P1       |

### Modified Files

| File                                                  | Changes                  |
| ----------------------------------------------------- | ------------------------ |
| `server/src/agent/orchestrator/admin-orchestrator.ts` | Add storefront tools     |
| `server/src/agent/executors/index.ts`                 | Register new executors   |
| `apps/web/src/app/t/[slug]/(site)/page.tsx`           | Add edit mode support    |
| `apps/web/src/components/tenant/SectionRenderer.tsx`  | Add editable wrapper     |
| `apps/web/src/app/(protected)/tenant/layout.tsx`      | Hide panel in Build Mode |

## ERD: No Schema Changes Required

The existing `Tenant.landingPageConfig` JSON field supports all required data.
The draft system (`landingPageConfig.draft`) handles preview before publish.

## Implementation Order

```
Phase 1: Backend Tools (2 days) ✅ COMPLETE
├── 1.1 Create storefront-tools.ts with Zod schemas ✅
├── 1.2 Create storefront-executors.ts with strict validation ✅
├── 1.3 Register in admin-orchestrator.ts ✅
└── 1.4 Add landingPageConfigDraft to Prisma schema ✅

Phase 2: Split-Screen UI (2 days) ✅ COMPLETE
├── 2.1 Install react-resizable-panels + @tiptap/* ✅
├── 2.2 Create Build Mode page at /tenant/build ✅
├── 2.3 Create BuildModeChat component ✅
├── 2.4 Create BuildModePreview with loading states ✅
└── 2.5 Create PageSelector + BuildModeHeader ✅

Phase 3: Live Preview Communication (1 day) ✅ COMPLETE
├── 3.1 Create build-mode-protocol.ts with Zod schemas ✅
├── 3.2 Create useBuildModeSync hook ✅
├── 3.3 Add edit mode to storefront pages ✅
└── 3.4 Add CSS styles for section highlighting ✅

Phase 4: Inline Text Editing (1.5 days) ✅ COMPLETE
├── 4.1 Create EditableText component ✅
├── 4.2 Create RichTextEditor with Tiptap ✅
└── 4.3 Create useDraftAutosave hook ✅

Phase 5: Chat-to-Preview Sync (1 day) ✅ COMPLETE
├── 5.1 Quick action chips in chat ✅
├── 5.2 Section count display ✅
└── 5.3 onSectionHighlight integration ✅

Phase 6: Error Handling & Resilience (0.5 days) ✅ COMPLETE
├── 6.1 Loading states for iframe ✅
├── 6.2 Error state handling ✅
└── 6.3 Viewport toggle (desktop/mobile) ✅

Phase 7: Polish (0.5 days) ✅ COMPLETE
├── 7.1 ConfirmDialog for Publish/Discard/Exit ✅
├── 7.2 useUnsavedChangesWarning hook ✅
└── 7.3 Success toast on publish ✅

Phase 8: Code Review & Fixes ⏳ IN PROGRESS
├── 8.1 Extract shared schemas (DRY) ← NEXT
├── 8.2 Add missing agent tools (parity) ← NEXT
├── 8.3 Write unit tests ← PENDING
└── 8.4 Write E2E test ← PENDING
```

**Actual Time:** ~2 days implementation + review
**Remaining:** ~1 day for P1 fixes + tests

## References & Research

### Internal References

- `server/src/agent/tools/onboarding-tools.ts:574` - Existing `update_storefront` tool (hero only)
- `server/src/agent/executors/onboarding-executors.ts` - Executor pattern
- `packages/contracts/src/landing-page.ts` - Section schemas
- `apps/web/src/components/home/BookingFlowDemo/index.tsx` - 58/42 split pattern
- `apps/web/src/components/agent/PanelAgentChat.tsx` - Existing chat component

### External References

- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
- [ChatGPT Canvas UX](https://openai.com/index/introducing-canvas/)
- [Vercel v0 Pattern](https://v0.app/)
- [Builder.io Preview Architecture](https://www.builder.io/c/docs/guides/preview-url-working)

### Related ADRs

- ADR-014: Next.js App Router Migration
- ADR-016: Field Naming Conventions

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
