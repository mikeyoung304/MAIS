# Build Mode: Current State & Identified Issues

**Last Updated:** 2026-01-11
**Purpose:** Comprehensive reference for understanding build mode's current implementation and known issues

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Current Architecture](#current-architecture)
3. [Known Issues](#known-issues)
4. [Recent Fixes](#recent-fixes)
5. [Technical Debt](#technical-debt)
6. [Critical Patterns](#critical-patterns)

---

## System Overview

### What is Build Mode?

Build Mode is a split-screen storefront editor where tenants collaborate with an AI agent to build their landing pages:

- **Left Panel (35%):** AI chat assistant (PanelAgentChat)
- **Right Panel (65%):** Live storefront preview in same-origin iframe
- **Real-time Updates:** Changes appear instantly as agent makes edits
- **Draft System:** Changes accumulate in draft, user explicitly publishes to go live

### Current Status

- ✅ **Production-ready** on `main` branch
- ✅ Agent-powered onboarding complete
- ✅ Real-time preview working (paintbrush effect)
- ⚠️ **In Progress:** Cleaning up vibe coding debt (legacy systems)

---

## Current Architecture

### Components

| Component            | Role                                   | Location                             | Status |
| -------------------- | -------------------------------------- | ------------------------------------ | ------ |
| `AgentPanel`         | Persistent chat sidebar                | `apps/web/src/components/agent/`     | ✅     |
| `PanelAgentChat`     | Compact chat UI for agent              | `apps/web/src/components/agent/`     | ✅     |
| `ContentArea`        | Switches between views (preview/other) | `apps/web/src/components/dashboard/` | ✅     |
| `PreviewPanel`       | Renders storefront preview             | `apps/web/src/components/preview/`   | ✅     |
| `BuildModeWrapper`   | iframe PostMessage handler             | `apps/web/src/components/tenant/`    | ✅     |
| `useDraftConfig`     | Fetches draft, publish/discard actions | `apps/web/src/hooks/`                | ✅     |
| `CustomerChatWidget` | Customer-facing chatbot (separate)     | `apps/web/src/components/tenant/`    | ✅     |

### Data Flow

```
User asks AI → Agent tool executes → Write to landingPageConfigDraft →
Invalidate cache → Frontend refetches → Preview updates in iframe →
PostMessage sends BUILD_MODE_CONFIG_UPDATE → Iframe re-renders
```

### Database Schema

**Two Config Fields (Dual-Draft System):**

- `landingPageConfig` - Published version (live on storefront)
- `landingPageConfigDraft` - Draft version (editing in progress)

**Why Separate?**

- Accumulate changes before publishing
- Preview without affecting live site
- Rollback capability (discard draft)

### Trust Tiers

| Tool                         | Trust Tier | Auto-Execute? | Rationale                                  |
| ---------------------------- | ---------- | ------------- | ------------------------------------------ |
| `update_page_section`        | T1         | ✅ Yes        | Content changes to draft (not live)        |
| `remove_page_section`        | T1         | ✅ Yes        | Destructive but reversible via discard     |
| `reorder_page_sections`      | T1         | ✅ Yes        | Low risk, easily reversible                |
| `toggle_page_enabled`        | T1         | ✅ Yes        | Visibility toggle is low risk              |
| `update_storefront_branding` | T1         | ✅ Yes        | Branding goes live immediately (by design) |
| **Publish Draft**            | **T3**     | ❌ No         | Makes changes live (high-trust)            |
| **Discard Draft**            | **T3**     | ❌ No         | Deletes all changes (high-trust)           |

---

## Known Issues

### P0 - Critical (Blocks Core Functionality)

#### ✅ FIXED: Cache Invalidation Missing

- **File:** `apps/web/src/components/agent/AgentPanel.tsx`
- **Issue:** `onToolComplete` not passed to `PanelAgentChat`
- **Fix:** Added `onToolComplete={() => invalidateDraftConfig()}`
- **Commit:** See BUILD_MODE_VISION.md
- **Status:** RESOLVED

#### ✅ FIXED: Paintbrush Effect Broken (Double Failure)

**Date:** 2026-01-11

**Root Causes:**

1. **Trust Tier Mismatch:** Tools declared T1 but called `createProposal()` with T2 → proposals never auto-executed
2. **TanStack Query staleTime: 30_000:** Cache stayed "fresh" for 30 seconds → refetch ignored
3. **Race Condition:** PostgreSQL READ COMMITTED + connection pooling → refetch before write visible

**Fixes:**

- Changed `createProposal()` calls from `'T2'` → `'T1'` (3 locations in storefront-tools.ts)
- Set `staleTime: 0` in useDraftConfig.ts (real-time updates require this)
- Added 100ms delay before `invalidateDraftConfig()` (ensures transaction visibility)

**Reference:** `docs/solutions/agent-issues/paintbrush-effect-trust-tier-stale-cache-MAIS-20260111.md`

#### ✅ FIXED: Dual-Draft Field & Session History Recovery

**Date:** 2026-01-10

**Root Causes:**

1. **Wrong Field:** Executors wrote to `landingPageConfig` instead of `landingPageConfigDraft`
2. **History Discarded:** Frontend always reset to greeting message, ignoring session history

**Fixes:**

- Updated executors to read/write `landingPageConfigDraft` field
- Modified `useAgentChat.ts` to restore `data.messages` on mount (if present)

**Reference:** `docs/solutions/agent-issues/dual-draft-field-session-history-recovery-MAIS-20260110.md`

### P1 - High Priority (Impacts UX/Performance)

#### 🔴 OPEN: Agent Parity Gap

**Problem:** Users can publish/discard via UI buttons, but agent cannot.

**Missing Agent Tools:**

- `publish_draft` - Make draft changes live (should be T3)
- `discard_draft` - Revert to published config (should be T3)
- `get_landing_page_draft` - Read current draft status

**Impact:** Users must manually click buttons; agent can't complete full workflow.

**Reference:** `docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md` (P1 finding)

#### 🔴 OPEN: N+1 Database Queries

**Problem:** Each executor makes 2-4 separate queries:

```typescript
// Current: 3 queries per tool execution
const draft = await getDraftConfig(prisma, tenantId); // Query 1
await saveDraftConfig(prisma, tenantId, draft); // Query 2
const slug = await getTenantSlug(prisma, tenantId); // Query 3
```

**Better Approach:**

```typescript
// Single query with all needed fields
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: {
    slug: true,
    landingPageConfig: true,
    landingPageConfigDraft: true,
  },
});
```

**Impact:** Performance degradation at scale (15+ queries per complex operation).

**Note:** The deferred upgrade plan (Phase 0) proposed passing draft config via DI context to eliminate this.

#### 🔴 OPEN: DRY Violations (Tools vs Executors)

**Problem:** Zod schemas and helpers duplicated between:

- `server/src/agent/tools/storefront-tools.ts` (700 lines)
- `server/src/agent/executors/storefront-executors.ts` (472 lines)

**Duplicated Code:**

- 5 Zod schemas (UpdatePageSectionPayloadSchema, etc.)
- `getDraftConfig()` helper (28 lines)
- `getTenantSlug()` helper (10 lines)

**Solution:** Extract to `server/src/agent/schemas/storefront-schemas.ts`

**Impact:** Harder to maintain, schemas can drift out of sync.

### P2 - Medium Priority (Technical Debt)

#### 🔴 OPEN: PostMessage Type Safety

**Problem:** Type casting without runtime validation in some places:

```typescript
// BAD - unsafe
const message = event.data as BuildModeChildMessage;

// GOOD - runtime validation
const message = parseChildMessage(event.data);
if (!message) return; // Invalid message
```

**Files to Audit:**

- `apps/web/src/components/build-mode/BuildModePreview.tsx`
- Any component handling PostMessage

#### 🔴 OPEN: Legacy Systems to Remove

**See:** `docs/architecture/BUILD_MODE_LEGACY_CLEANUP.md`

**Legacy Code:**

- Old onboarding components (if any remain)
- Unused draft fields
- Deprecated PostMessage types

---

## Recent Fixes

### 2026-01-11: Paintbrush Effect Restored

**Problem:** Preview never updated when agent made changes.

**Root Cause:** Triple failure - trust tier mismatch + stale cache + race condition.

**Solution:**

- Aligned trust tiers (T1 throughout)
- Set `staleTime: 0` for real-time updates
- Added 100ms delay before cache invalidation

**Verification:** E2E test with Playwright MCP confirmed real-time updates working.

**Commits:** `ecd60e5f`, `1ddcdc99`

### 2026-01-10: Session History Recovery

**Problem:** Conversation reset when switching tabs or refreshing.

**Root Cause:** Frontend discarded `data.messages` from backend response.

**Solution:** Check for session history before resetting to greeting message.

**Verification:** Manual test confirmed history persists across tabs/refresh.

### 2026-01-10: Draft Field Alignment

**Problem:** Agent changes didn't appear in preview.

**Root Cause:** Executors wrote to published config instead of draft.

**Solution:** Updated all executor read/write to use `landingPageConfigDraft`.

**Verification:** Prisma Studio confirmed writes going to correct field.

---

## Technical Debt

### Code Organization

1. **Zod Schema Duplication** - Tools and executors repeat same validation logic
2. **Helper Function Duplication** - `getDraftConfig()`, `getTenantSlug()` duplicated
3. **N+1 Queries** - Each tool makes multiple separate DB calls

### Testing

1. **Agent Tool Coverage** - Minimum 70% coverage target not yet reached
2. **E2E PostMessage Tests** - Limited coverage of iframe communication edge cases
3. **Race Condition Tests** - Cache invalidation timing not fully tested

### Documentation

1. **PostMessage Protocol Spec** - No single source of truth for all message types
2. **Trust Tier Rationale** - Why each tool is T1/T2/T3 not always documented
3. **Draft System Edge Cases** - Concurrent editing behavior undefined

---

## Critical Patterns

### 1. Always Use Draft Field During Editing

```typescript
// ✅ CORRECT - Write to draft
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { landingPageConfigDraft: true },
});

tenantUpdates.landingPageConfigDraft = updatedConfig;

// ❌ WRONG - Never write to published config from agent tools
tenantUpdates.landingPageConfig = updatedConfig; // This bypasses draft system!
```

### 2. Real-Time Features Need staleTime: 0

```typescript
// ✅ CORRECT - For agent-driven real-time updates
const query = useQuery({
  queryKey: DRAFT_CONFIG_QUERY_KEY,
  staleTime: 0, // Forces refetch on invalidation
});

// ❌ WRONG - Prevents real-time updates
const query = useQuery({
  queryKey: DRAFT_CONFIG_QUERY_KEY,
  staleTime: 30_000, // Cache stays "fresh" for 30 seconds!
});
```

### 3. Trust Tier Must Match Throughout

```typescript
// ✅ CORRECT - Tier matches everywhere
export const myTool: AgentTool = {
  trustTier: 'T1', // Definition says T1
  async execute(context, params) {
    return createProposal(context, 'my_tool', op, 'T1', payload, preview);
    //                                            ↑ Call also says T1
  },
};

// ❌ WRONG - Mismatch prevents auto-execution
export const myTool: AgentTool = {
  trustTier: 'T1', // Definition says T1
  async execute(context, params) {
    return createProposal(context, 'my_tool', op, 'T2', payload, preview);
    //                                            ↑ Call says T2 - won't auto-execute!
  },
};
```

### 4. Add Delay Before Cache Invalidation

```typescript
// ✅ CORRECT - Ensures transaction visible
onToolComplete={() => {
  setTimeout(() => {
    invalidateDraftConfig();
  }, 100); // 100ms covers PostgreSQL + connection pool propagation
}}

// ❌ RISKY - May refetch before write visible
onToolComplete={() => {
  invalidateDraftConfig(); // Race condition possible
}}
```

### 5. PostMessage Needs Runtime Validation

```typescript
// ✅ CORRECT - Validate with Zod
const message = parseChildMessage(event.data);
if (!message) return; // Invalid message, ignore

// ❌ WRONG - Type casting is unsafe
const message = event.data as BuildModeChildMessage;
```

### 6. Session History Must Be Restored

```typescript
// ✅ CORRECT - Check for existing session
if (data.messages && data.messages.length > 0) {
  setMessages(
    data.messages.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }))
  );
} else {
  setMessages([greetingMessage]);
}

// ❌ WRONG - Always discards history
setMessages([greetingMessage]); // Ignores data.messages!
```

---

## Performance Considerations

### Current Performance Issues

1. **Query Count:** 15+ queries per complex agent operation (N+1 pattern)
2. **Cache Invalidation:** 100ms delay required (connection pool propagation)
3. **Iframe Re-renders:** Full preview re-render on every config update

### Deferred Optimizations

The deferred upgrade plan identified these optimizations (not yet implemented):

- **Phase 0:** Pre-fetch config once in DI context, pass to all tools
- **Unified Hook:** Single `usePreviewConfig` instead of multiple hooks
- **Selective Re-renders:** Only re-render changed sections (not full preview)

**Decision:** Focus on stability before optimization.

---

## Agent Tool Inventory

### Implemented Tools (5 total)

1. `list_section_ids` - Get all section IDs from draft config
2. `get_section_by_id` - Read specific section details
3. `update_page_section` - Create/update sections in draft
4. `remove_page_section` - Delete sections from draft
5. `update_storefront_branding` - Update colors/fonts (immediate, bypasses draft)

### Missing Tools (Agent Parity Gap)

1. `publish_draft` - Make draft changes live (T3)
2. `discard_draft` - Revert to published config (T3)
3. `get_landing_page_draft` - Read draft status/metadata

---

## PostMessage Protocol

### Parent → Iframe Messages

```typescript
BUILD_MODE_INIT { draftConfig: PagesConfig }
BUILD_MODE_CONFIG_UPDATE { pages: PagesConfig }
BUILD_MODE_HIGHLIGHT_SECTION_BY_ID { sectionId: string }
BUILD_MODE_CLEAR_HIGHLIGHT
```

### Iframe → Parent Messages

```typescript
BUILD_MODE_READY
BUILD_MODE_SECTION_CLICK { sectionId: string }
```

### Security

- ✅ Origin validation on every message
- ✅ Zod parsing (not type casting)
- ✅ Same-origin iframe (no CORS issues)

---

## Testing Status

### E2E Tests

- ✅ Basic agent chat interaction
- ✅ Section update flow
- ✅ Preview rendering
- ⚠️ Limited PostMessage edge cases
- ⚠️ No concurrent editing tests

### Unit Tests

- ✅ Agent tools (partial coverage)
- ✅ Executors (partial coverage)
- ❌ Target 70% coverage not reached

---

## Key Files Reference

### Frontend

| File                                                  | Purpose                            |
| ----------------------------------------------------- | ---------------------------------- |
| `apps/web/src/components/agent/AgentPanel.tsx`        | Main agent chat panel              |
| `apps/web/src/components/preview/PreviewPanel.tsx`    | Iframe preview container           |
| `apps/web/src/hooks/useDraftConfig.ts`                | Draft config fetching/invalidation |
| `apps/web/src/hooks/useAgentChat.ts`                  | Agent chat state management        |
| `apps/web/src/lib/build-mode/protocol.ts`             | PostMessage types and validation   |
| `apps/web/src/components/tenant/BuildModeWrapper.tsx` | Iframe PostMessage handler         |

### Backend

| File                                                 | Purpose                               |
| ---------------------------------------------------- | ------------------------------------- |
| `server/src/agent/tools/storefront-tools.ts`         | Agent tool definitions (700 lines)    |
| `server/src/agent/executors/storefront-executors.ts` | Tool executors (472 lines)            |
| `server/src/agent/orchestrator/base-orchestrator.ts` | Trust tier auto-execution (line 1132) |
| `server/src/di.ts`                                   | Dependency injection container        |

---

## Related Documentation

| Document                                                                                 | Relevance                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| `docs/architecture/BUILD_MODE_VISION.md`                                                 | Target UX, architecture decisions          |
| `docs/architecture/BUILD_MODE_LEGACY_CLEANUP.md`                                         | Legacy code to remove                      |
| `docs/architecture/DEFERRED_BUILD_MODE_UPGRADE.md`                                       | Future enhancements (inline editing, undo) |
| `docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md`         | Critical patterns, code review findings    |
| `docs/solutions/agent-issues/dual-draft-field-session-history-recovery-MAIS-20260110.md` | Dual-draft bug fix                         |
| `docs/solutions/agent-issues/paintbrush-effect-trust-tier-stale-cache-MAIS-20260111.md`  | Paintbrush effect restoration              |

---

## Recommendations for Next Agent

### Immediate Focus (Perfecting Current System)

1. **Fix Agent Parity Gap** - Add publish/discard tools (T3)
2. **Reduce N+1 Queries** - Single query per operation
3. **Extract Shared Schemas** - DRY between tools and executors
4. **Audit PostMessage Safety** - Ensure all handlers use Zod parsing
5. **Document Edge Cases** - What happens with concurrent edits?

### Before Adding Features

- ✅ Resolve all P1 issues above
- ✅ Reach 70% test coverage
- ✅ Document PostMessage protocol completely
- ✅ Performance audit (query counts, re-render counts)

### When to Consider Upgrade Plan

Only after current system is:

- ✅ Stable (no known P0/P1 issues)
- ✅ Well-tested (70%+ coverage)
- ✅ Performant (< 5 queries per operation)
- ✅ Documented (all patterns recorded)

---

**Status:** Current build mode is production-ready but has identified technical debt and missing features. Focus on perfecting what exists before adding new capabilities.
