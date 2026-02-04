---
status: ready
priority: p3
issue_id: '5215'
tags: [code-review, tech-debt, naming, agent-migration]
dependencies: [5211, 5212]
---

# P3: Legacy "Concierge" Naming Cleanup

## Problem Statement

The codebase migrated from "concierge" architecture to "tenant-agent" on 2026-01-30, but significant legacy naming persists. This creates confusion for developers and misaligns code with actual architecture.

**Why it matters:** Code should reflect current architecture. Legacy naming causes confusion when onboarding or debugging.

## Findings

**Source:** Legacy Naming Audit Agent

### Summary Counts

| Type                          | Count | Breaking Change Risk |
| ----------------------------- | ----- | -------------------- |
| File names                    | 2     | HIGH                 |
| Exported interfaces/types     | 6     | HIGH                 |
| Exported functions/components | 2     | HIGH                 |
| Storage keys                  | 2     | MEDIUM               |
| Comments/JSDoc                | 35+   | LOW                  |
| Test IDs/ARIA                 | 3     | LOW                  |

### Key Items

**File names (HIGH priority):**

- `useConciergeChat.ts` → `useTenantAgentChat.ts`
- `ConciergeChat.tsx` → `TenantAgentChat.tsx`

**Exported types (HIGH priority):**

- `ConciergeMessage` → `TenantAgentMessage`
- `ConciergeToolCall` → `TenantAgentToolCall`
- `ConciergeUIAction` → `TenantAgentUIAction`
- `UseConciergeChatchatOptions` → `UseTenantAgentChatOptions`
- `UseConciergeChatchatReturn` → `UseTenantAgentChatReturn`

**Storage keys (MEDIUM priority):**

- `handled:concierge:sessionId` → `handled:tenant-agent:sessionId`
- `handled:concierge:version` → `handled:tenant-agent:version`

## Proposed Solutions

### Option A: Phased Migration (Recommended)

**Phase 1: Create Aliases (Non-breaking)**

```typescript
// apps/web/src/hooks/useTenantAgentChat.ts
export * from './useConciergeChat';
export { useConciergeChat as useTenantAgentChat } from './useConciergeChat';
export type { ConciergeMessage as TenantAgentMessage } from './useConciergeChat';
```

**Phase 2: Update Consumers**
Gradually update imports across codebase.

**Phase 3: Rename Core Files**
After consumers updated, rename source files.

**Phase 4: Storage Key Migration**
Add migration logic:

```typescript
// Read from both, write to new
const sessionId =
  localStorage.getItem('handled:tenant-agent:sessionId') ??
  localStorage.getItem('handled:concierge:sessionId');
```

**Pros:** Non-breaking, can be done incrementally
**Cons:** Temporary code duplication
**Effort:** Medium (2-4 hours total across phases)
**Risk:** Low if done in phases

### Option B: Big Bang Rename

**Approach:** Rename everything in one PR

**Pros:** Clean, no temporary state
**Cons:** Large PR, higher risk, breaks existing session storage
**Effort:** Medium (2-3 hours)
**Risk:** Medium - many files change at once

## Recommended Action

**APPROVED: Option A - Phased migration (Phase 1 only for this PR)**

For this resolution cycle: Update COMMENTS ONLY (35+ JSDoc/inline comments). Do NOT rename files or exports yet - that's a separate PR to avoid breaking changes.

**Scope for this todo:**

- Update JSDoc headers in useConciergeChat.ts
- Update comments in ConciergeChat.tsx
- Update comments in AgentPanel.tsx
- Update comments in tenant-agent-dispatch.ts
- Update comments in API route

**Out of scope (future PR):**

- File renames
- Export renames
- Storage key migration

**Triaged:** 2026-02-04 | **Decision:** Fix comments only | **Rationale:** Improve documentation accuracy without breaking changes

## Technical Details

**Files requiring updates:**

1. `apps/web/src/hooks/useConciergeChat.ts`
2. `apps/web/src/components/agent/ConciergeChat.tsx`
3. `apps/web/src/components/agent/index.ts`
4. `apps/web/src/components/agent/AgentPanel.tsx`
5. 35+ files with comment updates

## Acceptance Criteria

- [ ] Phase 1: Type aliases created
- [ ] Phase 2: New imports used in new code
- [ ] Phase 3: Core files renamed (separate PR)
- [ ] Phase 4: Storage key migration added
- [ ] Documentation updated

## Work Log

| Date       | Action                   | Learnings                   |
| ---------- | ------------------------ | --------------------------- |
| 2026-02-04 | Created from code review | Full audit of legacy naming |

## Resources

- PR: Guided Refinement Integration
- SERVICE_REGISTRY.md: Current agent architecture
- Migration plan: 2026-01-30-feat-semantic-storefront-architecture-plan.md
