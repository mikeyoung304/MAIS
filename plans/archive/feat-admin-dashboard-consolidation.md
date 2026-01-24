# feat: Consolidate Admin Dashboard UI/UX into Next.js App Router

## Overview

The MAIS platform currently has **two separate admin dashboards** that are misaligned:

1. **Legacy Vite Client** (`client/`) - Feature-complete landing page editor with WYSIWYG
2. **Next.js App** (`apps/web/`) - Production admin with broken landing page route

This plan consolidates all tenant admin features into Next.js App Router, eliminating the legacy Vite client dependency and providing a unified, high-quality admin experience.

> **Design Principles:** Quality and scalability over speed. Industry best practices guide all decisions. No shortcuts that create technical debt.

## Problem Statement

### Current Broken Flows

| Issue                                      | Severity | Impact                                      |
| ------------------------------------------ | -------- | ------------------------------------------- |
| Dashboard "Edit Landing Page" button → 404 | P0       | Tenant admins cannot access page editor     |
| `/tenant/pages` not in sidebar navigation  | P1       | Multi-page toggle UI is undiscoverable      |
| No visual section editor in Next.js        | P1       | Must use legacy Vite client                 |
| No draft/publish workflow                  | P2       | Changes go live immediately without preview |
| No section reordering                      | P2       | Must delete and recreate to reorder         |

### Architecture Misalignment

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Current State                                 │
├────────────────────────────┬────────────────────────────────────────┤
│     Legacy Vite Client     │           Next.js App                  │
│     (client/)              │           (apps/web/)                  │
├────────────────────────────┼────────────────────────────────────────┤
│ ✅ Landing page editor     │ ❌ Route doesn't exist                 │
│ ✅ WYSIWYG sections        │ ❌ No editor components                │
│ ✅ Draft/publish flow      │ ❌ Simple PUT only                     │
│ ⚠️ Legacy localStorage JWT │ ✅ NextAuth HTTP-only cookies          │
│ ⚠️ 9 legacy section types  │ ✅ 7 new section types                 │
└────────────────────────────┴────────────────────────────────────────┘
```

## Proposed Solution

Consolidate all admin features into Next.js with a phased approach:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Target State                                  │
├─────────────────────────────────────────────────────────────────────┤
│                      Next.js App Router                              │
│                      (apps/web/src/app)                              │
├─────────────────────────────────────────────────────────────────────┤
│ /tenant/dashboard      → "Edit Pages" button → /tenant/pages        │
│ /tenant/pages          → Page list with enable/disable toggles      │
│ /tenant/pages/[type]   → Section editor with inline preview         │
│ Sidebar                → Includes "Pages" navigation item           │
│ Draft/Publish          → Save as draft, preview, then publish       │
│ Drag-and-Drop          → Reorder sections within pages              │
└─────────────────────────────────────────────────────────────────────┘
```

## Technical Approach

### Architecture

```
apps/web/src/
├── app/(protected)/tenant/
│   ├── dashboard/page.tsx          # Fix link to /tenant/pages
│   ├── pages/
│   │   ├── page.tsx                # Page list with toggles (exists)
│   │   └── [pageType]/
│   │       └── page.tsx            # NEW: Section editor
│   └── landing-page/
│       └── page.tsx                # Redirect to /tenant/pages
├── components/
│   ├── layouts/
│   │   └── AdminSidebar.tsx        # Add "Pages" nav item
│   └── tenant/
│       ├── editors/                 # NEW: Section editor forms
│       │   ├── HeroEditor.tsx
│       │   ├── TextEditor.tsx
│       │   ├── GalleryEditor.tsx
│       │   ├── TestimonialsEditor.tsx
│       │   ├── FAQEditor.tsx
│       │   ├── ContactEditor.tsx
│       │   └── CTAEditor.tsx
│       └── SectionRenderer.tsx      # EXISTS: Display sections
└── lib/
    └── tenant.ts                    # EXISTS: normalizeToPages()
```

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Next.js UI  │────▶│  API Route   │────▶│ Express API  │
│ (React Query)│     │ /api/tenant/ │     │ /v1/tenant-  │
│              │◀────│ landing-page │◀────│ admin/...    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                                         │
       │              ┌──────────────┐           │
       └─────────────▶│   Prisma     │◀──────────┘
                      │  (Postgres)   │
                      └──────────────┘
```

### Key Design Decisions

1. **Form-based editing, not WYSIWYG** - Structured content with Zod schemas is better served by forms with inline preview than full WYSIWYG canvas
2. **Draft stored in same JSON column** - Use existing `landingPageConfig.draft` pattern from contracts
3. **hello-pangea/dnd for drag-and-drop** - Simple list reordering, Trello-style, a11y built-in
4. **Server Components for data fetching** - Client Components only for interactivity

## Implementation Phases

### Phase 1: Fix Navigation (P0) - 2 hours

**Goal:** Eliminate 404 error, make multi-page UI discoverable

**Tasks:**

- [ ] Change dashboard quick action from `/tenant/landing-page` → `/tenant/pages`
  - File: `apps/web/src/app/(protected)/tenant/dashboard/page.tsx:152`
- [ ] Add "Pages" to AdminSidebar navigation
  - File: `apps/web/src/components/layouts/AdminSidebar.tsx:31`
- [ ] Create redirect from `/tenant/landing-page` → `/tenant/pages`
  - File: `apps/web/src/app/(protected)/tenant/landing-page/page.tsx` (new)

**Acceptance Criteria:**

- [ ] Dashboard "Edit Landing Page" button loads `/tenant/pages`
- [ ] Sidebar shows "Pages" link with icon
- [ ] Direct navigation to `/tenant/landing-page` redirects to `/tenant/pages`

---

### Phase 2: Page Management Enhancement (P1) - 4 hours

**Goal:** Polish the existing page toggle UI

**Tasks:**

- [ ] Add page preview links (eye icon → opens `/t/[slug]/[pageType]`)
- [ ] Add "Edit Sections" button per page → `/tenant/pages/[pageType]`
- [ ] Add section count badge per page
- [ ] Implement empty state when all pages disabled
- [ ] Add mobile-responsive layout adjustments

**Acceptance Criteria:**

- [ ] Each page row shows: name, description, section count, toggle, edit button
- [ ] Clicking edit navigates to section editor (Phase 3)
- [ ] Empty state shows helpful guidance

---

### Phase 3: Section Editor (P1) - 16 hours

**Goal:** Form-based section editing with inline preview

**Tasks:**

- [ ] Create `/tenant/pages/[pageType]/page.tsx` route
- [ ] Build section list component with add/remove buttons
- [ ] Create editor components for each section type:
  - [ ] `HeroEditor.tsx` - headline, subheadline, CTA, background
  - [ ] `TextEditor.tsx` - headline, content (markdown), image
  - [ ] `GalleryEditor.tsx` - headline, image array
  - [ ] `TestimonialsEditor.tsx` - headline, testimonial items
  - [ ] `FAQEditor.tsx` - headline, FAQ items
  - [ ] `ContactEditor.tsx` - headline, contact info
  - [ ] `CTAEditor.tsx` - headline, subheadline, CTA
- [ ] Implement form validation with Zod
- [ ] Add save/cancel actions with confirmation

**File Structure:**

```typescript
// apps/web/src/app/(protected)/tenant/pages/[pageType]/page.tsx
export default async function PageEditorPage({ params }: Props) {
  const config = await getTenantLandingPage();
  const pageConfig = config.pages?.[params.pageType];

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <SectionEditorList sections={pageConfig.sections} />
      <SectionPreview sections={pageConfig.sections} />
    </div>
  );
}
```

**Acceptance Criteria:**

- [ ] Can add/remove sections from any page
- [ ] Each section type has working form
- [ ] Validation errors shown inline
- [ ] Changes persist to database on save

---

### Phase 4: Preview Integration (P2) - 2 hours

**Goal:** Easy access to preview changes on live storefront

**Tasks:**

- [ ] Add "Open Preview" button that opens `/t/[slug]/[pageType]` in new tab
- [ ] Add visual indicator showing last saved timestamp
- [ ] Ensure preview reflects saved state accurately

**Acceptance Criteria:**

- [ ] "Open Preview" button opens storefront in new tab
- [ ] Preview shows saved content (not unsaved edits)
- [ ] Clear UX that preview shows saved state

**Rationale:** Inline live preview adds complexity (form state sync, CSS duplication) without proportional value. "Open in new tab" leverages existing storefront components with zero new code, following the principle of reuse over rebuild.

---

### Phase 5: Drag-and-Drop Reordering (P2) - 8 hours

**Goal:** Intuitive section reordering

**Tasks:**

- [ ] Install `@hello-pangea/dnd` package
- [ ] Wrap section list with DragDropContext
- [ ] Add drag handle UI to each section card
- [ ] Implement touch-friendly handlers
- [ ] Persist order on drag end

**Acceptance Criteria:**

- [ ] Sections reorderable via drag handle
- [ ] Works on mobile (touch)
- [ ] Order persists on save
- [ ] Keyboard accessible (Tab + arrows)

---

### Phase 6: Draft/Publish Workflow (P2) - 12 hours

**Goal:** Industry-standard content management workflow with preview before publish

**Rationale:** Every major CMS (WordPress, Contentful, Sanity, Strapi) implements draft/publish workflows. This is table-stakes for professional content management:

- Prevents accidental publication of incomplete changes
- Enables review workflows (future: team approvals)
- Provides rollback capability
- Builds user confidence in making changes

**Tasks:**

- [ ] Wire Next.js API routes to existing draft endpoints
- [ ] Create `DraftStatusBanner` component showing draft vs published state
- [ ] Add "Save Draft" (primary) and "Publish" (secondary) buttons
- [ ] Create visual diff indicator (optional: show what changed)
- [ ] Add "Discard Draft" action with confirmation dialog
- [ ] Add "Revert to Published" action

**Backend Endpoints (already implemented):**

```
GET  /v1/tenant-admin/landing-page/draft   → Get draft + published
PUT  /v1/tenant-admin/landing-page/draft   → Save draft (auto-save target)
POST /v1/tenant-admin/landing-page/publish → Publish draft to live
DELETE /v1/tenant-admin/landing-page/draft → Discard draft
```

**Acceptance Criteria:**

- [ ] All edits save as draft automatically (debounced auto-save)
- [ ] Clear visual distinction between draft and published state
- [ ] "Publish" button makes draft live with confirmation
- [ ] "Discard Draft" reverts to last published state
- [ ] Storefront only shows published content (never draft)

**Auto-Save Pattern (Industry Standard):**

```typescript
// Debounced auto-save to draft - no manual "Save" button needed
const debouncedSave = useDebouncedCallback(
  async (config) => {
    await saveDraft(config);
    setLastSaved(new Date());
  },
  1000 // 1 second debounce
);
```

---

### Phase 7: Legacy Deprecation & Cleanup (P3) - 4 hours

**Goal:** Clean migration path from Vite client to Next.js admin

**Rationale:** Industry best practice is to have explicit deprecation timelines. Dual systems create:

- Developer confusion about which to modify
- Maintenance burden (bug fixes in two places)
- User confusion (different UX patterns)
- Technical debt accumulation

**Tasks:**

- [ ] Add deprecation banner to Vite client: "This admin interface is deprecated. Please use [link to Next.js admin]"
- [ ] Redirect Vite `/tenant/landing-page` to Next.js equivalent
- [ ] Document migration guide for any remaining Vite-only features
- [ ] Create ticket to remove `client/` directory after 30-day deprecation period
- [ ] Update `ARCHITECTURE.md` to reflect consolidated admin

**Acceptance Criteria:**

- [ ] Users accessing Vite admin see clear deprecation notice
- [ ] All admin routes have Next.js equivalents
- [ ] Removal timeline documented (30 days after Phase 6 ships)

---

## Section Type Alignment Strategy

**Issue Identified:** Legacy Vite editor uses 9 section types, new system uses 7.

| Legacy (Vite)     | New (Next.js)    | Migration                    |
| ----------------- | ---------------- | ---------------------------- |
| `hero`            | `hero`           | Direct mapping               |
| `about`           | `text`           | Rename, same structure       |
| `testimonials`    | `testimonials`   | Direct mapping               |
| `gallery`         | `gallery`        | Direct mapping               |
| `faq`             | `faq`            | Direct mapping               |
| `finalCta`        | `cta`            | Rename, same structure       |
| `contact`         | `contact`        | Direct mapping               |
| `socialProofBar`  | (defer)          | Low usage, add if requested  |
| `segmentSelector` | (auto-generated) | Not editable, system-managed |
| `accommodation`   | `text`           | Merge into text section      |

**Migration Strategy:**

1. `normalizeToPages()` in `apps/web/src/lib/tenant.ts` handles translation
2. New section editor supports 7 types
3. Legacy types auto-map on read, save as new types on write
4. No data migration needed - handled at runtime

## Alternative Approaches Considered

### Option A: Port Vite Editor to Next.js (Rejected)

**Pros:** Reuse existing WYSIWYG code
**Cons:** WYSIWYG complexity, technical debt, localStorage auth conflicts

### Option B: Embed Vite Editor as iframe (Rejected)

**Pros:** Zero rewrite
**Cons:** Auth handoff issues, inconsistent UX, maintenance burden

### Option C: Form-Based Editor (Selected)

**Pros:** Cleaner architecture, better Zod integration, maintainable
**Cons:** Less "visual" editing experience

**Rationale:** MAIS content is structured (sections with typed fields). Form-based editing with inline preview is more appropriate than WYSIWYG for this use case.

## Acceptance Criteria

### Functional Requirements

- [ ] Tenant admin can access page editor from dashboard
- [ ] Tenant admin can enable/disable pages
- [ ] Tenant admin can add/edit/remove sections
- [ ] Tenant admin can reorder sections
- [ ] Changes can be previewed before publishing
- [ ] All 7 section types have working editors

### Non-Functional Requirements

- [ ] Page editor loads in <2s
- [ ] Auto-save triggers within 1s of edit
- [ ] Works on mobile devices (responsive)
- [ ] Keyboard accessible (WCAG 2.1 AA)
- [ ] XSS-safe content handling

### Quality Gates

- [ ] E2E tests for all user flows
- [ ] Unit tests for editor components
- [ ] Security review for tenant isolation
- [ ] Design review for brand consistency

## Success Metrics

| Metric                     | Target                | Measurement             |
| -------------------------- | --------------------- | ----------------------- |
| 404 errors on landing-page | 0                     | Error monitoring        |
| Page editor adoption       | 80% of active tenants | Feature usage analytics |
| Time to first edit         | <30s                  | User session tracking   |
| Publish success rate       | >99%                  | API success metrics     |

## Dependencies & Prerequisites

- [ ] Next.js 14+ (already in use)
- [ ] NextAuth.js v5 (already configured)
- [ ] `@hello-pangea/dnd` package (to install)
- [ ] Existing contracts schema (no changes needed)
- [ ] Existing API endpoints (no changes needed)

## Risk Analysis & Mitigation

| Risk                          | Likelihood | Impact   | Mitigation                          |
| ----------------------------- | ---------- | -------- | ----------------------------------- |
| Breaking existing storefronts | Medium     | High     | Feature flags, incremental rollout  |
| Data loss during edit         | Medium     | High     | Auto-save + localStorage backup     |
| XSS vulnerabilities           | Low        | Critical | DOMPurify sanitization, CSP headers |
| Tenant data leakage           | Low        | Critical | Mandatory tenantId filtering        |
| Mobile UX issues              | High       | Medium   | Mobile-first design, early testing  |

## Resource Requirements

**Estimated Total Effort:** 48 hours

| Phase                             | Hours | Priority | Dependency |
| --------------------------------- | ----- | -------- | ---------- |
| Phase 1: Fix Navigation           | 2     | P0       | None       |
| Phase 2: Page Management          | 4     | P1       | Phase 1    |
| Phase 3: Section Editor (7 types) | 16    | P1       | Phase 2    |
| Phase 4: Preview Integration      | 2     | P2       | Phase 3    |
| Phase 5: Drag-and-Drop            | 8     | P2       | Phase 3    |
| Phase 6: Draft/Publish            | 12    | P2       | Phase 3    |
| Phase 7: Legacy Deprecation       | 4     | P3       | Phase 6    |

**Recommended Execution:**

- **Week 1:** Phases 1-2 (6 hours) - Ship immediately, fix P0
- **Week 2-3:** Phase 3 (16 hours) - Core editor functionality
- **Week 4:** Phases 4-5 (10 hours) - UX polish
- **Week 5:** Phase 6 (12 hours) - Industry-standard workflow
- **Week 6:** Phase 7 (4 hours) - Cleanup and consolidation

## Future Considerations

- **Template Gallery:** Pre-built page templates for new tenants
- **AI Section Suggestions:** Use Claude to suggest section content
- **Multi-language Support:** i18n for section content
- **Scheduled Publishing:** Publish at specific date/time
- **Version History:** View and restore previous versions

## Documentation Plan

- [ ] Update `apps/web/README.md` with new routes
- [ ] Add section editor usage guide for tenants
- [ ] Update `ARCHITECTURE.md` with consolidated admin diagram
- [ ] Create ADR for form-based vs WYSIWYG decision

## References & Research

### Internal References

- Legacy editor: `client/src/features/tenant-admin/landing-page-editor/`
- Current page toggles: `apps/web/src/app/(protected)/tenant/pages/page.tsx`
- Section schemas: `packages/contracts/src/landing-page.ts`
- API contracts: `packages/contracts/src/tenant-admin/landing-page.contract.ts`
- Dashboard quick actions: `apps/web/src/app/(protected)/tenant/dashboard/page.tsx:152`
- Sidebar navigation: `apps/web/src/components/layouts/AdminSidebar.tsx:31`

### External References

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [hello-pangea/dnd](https://github.com/hello-pangea/dnd) (Trello-style DnD, a11y-first)
- [React Hook Form](https://react-hook-form.com/) (form handling)
- [shadcn/ui](https://ui.shadcn.com/) (component patterns)
- [Contentful Draft/Publish](https://www.contentful.com/help/entries-and-assets-draft-and-published/) (industry reference)
- [Sanity.io Content Workflow](https://www.sanity.io/docs/workflow) (industry reference)

### Related Work

- ADR-014: Next.js App Router Migration
- docs/design/BRAND_VOICE_GUIDE.md (UI/UX standards)
- docs/solutions/nextjs-migration-lessons-learned (migration patterns)

---

## Reviewer Feedback Incorporated

This plan was reviewed by three perspectives and refined accordingly:

### Changes Made Based on Review

| Feedback                                         | Action Taken                                                |
| ------------------------------------------------ | ----------------------------------------------------------- |
| "Live preview is over-engineered"                | Replaced with "Open Preview" button (Phase 4: 8h → 2h)      |
| "Section type mismatch (9 vs 7)"                 | Added Section Type Alignment Strategy section               |
| "Missing legacy deprecation timeline"            | Added Phase 7: Legacy Deprecation                           |
| "Draft/Publish needs industry rationale"         | Added CMS comparison and auto-save pattern                  |
| "Drag-and-drop should use best-in-class library" | Confirmed hello-pangea/dnd (Atlassian heritage, a11y-first) |

### Feedback Intentionally Not Applied

| Feedback                             | Reason                                                          |
| ------------------------------------ | --------------------------------------------------------------- |
| "Start with 3 editors instead of 7"  | Quality over speed - complete feature set preferred             |
| "Use up/down buttons instead of DnD" | DnD is industry standard, better UX, worth the investment       |
| "Skip draft/publish for MVP"         | Industry best practice for CMS, backend already implemented     |
| "50h → 8h reduction"                 | Quality and scalability prioritized over minimal implementation |

### Quality Principles Applied

1. **All 7 section types from day one** - Complete feature parity with legacy system
2. **Industry-standard drag-and-drop** - hello-pangea/dnd with full a11y support
3. **Draft/Publish workflow** - Matches WordPress, Contentful, Sanity patterns
4. **Explicit deprecation timeline** - Clean migration, no lingering legacy code
5. **Section type migration strategy** - Zero data migrations, runtime translation
