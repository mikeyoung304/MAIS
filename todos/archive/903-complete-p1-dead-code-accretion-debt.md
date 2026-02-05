---
status: complete
priority: p1
issue_id: 903
tags: [docs-audit, dead-code, accretion-debt, multi-agent-review]
dependencies: []
completed_date: 2026-02-05
---

# Dead Code and Accretion Debt: Files With Zero Imports

## Problem Statement

Multiple source files exist in the codebase that have zero imports — they are completely dead code. This is a hallmark of AI agent accretion debt: agents keep code "for fallback" when migrating, creating layers that never get cleaned up.

**Why it matters:**

- Dead code misleads future agents into thinking these systems are active
- Increases bundle size and cognitive overhead
- Some dead code contains security-related stubs that were never wired up

## Findings

**From Accretion Debt Agent:**

### 1. `server/src/lib/feature-flags.ts` — 100% Dead

- Three feature flags: `ENABLE_CONTEXT_CACHE`, `ENABLE_CONFIG_NORMALIZATION`, `ENABLE_LEGACY_SECTION_MERGE`
- **Zero imports** anywhere in the codebase
- Created during migration, never referenced by any other file
- All three flags relate to `landingPageConfig` patterns that were deleted

### 2. `server/src/agent/tools/types.ts` — Sole Legacy Agent File

- Only remaining file in the legacy `server/src/agent/` directory
- Only imported by `server/src/llm/message-adapter.ts`
- `message-adapter.ts` is itself dead code (no imports)
- This is an orphan dependency chain: dead file imports dead file

### 3. `server/src/middleware/rateLimiter.ts` — Dead Export

- `uploadLimiter` export (line 126-128) has zero imports
- Defined but never used by any route

### 4. `apps/web/src/hooks/useDraftConfig.ts` — Pure Pass-Through Wrapper

- Wraps `useSectionsDraft` with zero additional logic
- Maintains dead dual-cache-invalidation for `['draft-config']` query key
- Classic accretion: wrapper created "for compatibility," never cleaned up

### 5. `apps/web/src/lib/tenant.client.ts` — Legacy Normalizer

- `normalizeToPages()` maintains `active`/`isActive` dual field pattern
- CLAUDE.md line 78 still references it as active architecture
- Converts between formats that no longer exist (landingPageConfig → pages)

### 6. `server/src/di.ts` and `server/src/routes/index.ts` — Tombstone Comments

- Lines 26, 261, 595 in di.ts: `// DELETED: LandingPageService`
- Line 98 in routes/index.ts: `// DELETED: LandingPageService type`
- These comments serve no purpose — the deletion is obvious from git history

## Recommended Fix

1. Delete `server/src/lib/feature-flags.ts`
2. Delete `server/src/agent/tools/types.ts` and `server/src/llm/message-adapter.ts` (both dead)
3. Remove dead `uploadLimiter` export from rateLimiter.ts
4. Inline `useDraftConfig.ts` or replace all callsites with `useSectionsDraft` directly
5. Audit `normalizeToPages()` — is it still needed? If not, remove
6. Remove `// DELETED:` tombstone comments from di.ts and routes/index.ts

## Sources

- Accretion Debt Agent: Findings 1-14
- Architecture Strategist: Dead export findings
- Git History Agent: File churn analysis showing 38 files created-and-deleted
