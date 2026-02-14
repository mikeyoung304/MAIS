# TODO 10009: Sections API Drift — Nested vs Flat Payload

**Priority:** P2
**Status:** complete
**Source:** Technical Debt Audit 2026-02-13, Issue #9
**Audit Doc:** `docs/solutions/architecture/TECHNICAL_DEBT_AUDIT_2026-02-13.md`

## Problem

Frontend sends nested payload (`sections-api.ts:212`) but server expects flat schema (`internal-agent-storefront.routes.ts:40-48,199`). Mismatch causes silent failures or requires runtime normalization.

## Resolution

**Root cause:** Frontend `updateSection()` wrapped content fields in a nested `updates` key:

```typescript
// BEFORE (broken): nested payload — server ignores the updates wrapper
body: JSON.stringify({ tenantId, sectionId, updates });
// Server sees: { tenantId, sectionId, updates: { headline: "..." } }
// Zod strips unknown "updates" key → zero content fields reach the service

// AFTER (fixed): flat payload — matches server's UpdateSectionSchema
body: JSON.stringify({ tenantId, sectionId, ...updates });
// Server sees: { tenantId, sectionId, headline: "..." }
```

**Server schema is source of truth.** Agent already sends flat payloads via `callMaisApi()` which does `{ tenantId, ...params }`.

**Fix:** One-line change in `apps/web/src/lib/sections-api.ts:215` — spread `updates` flat instead of nesting.

All other frontend API functions (`fetchPageStructure`, `fetchSectionContent`, `publishSection`, `discardSection`, `publishAllSections`, `discardAllSections`) already send flat payloads correctly.
