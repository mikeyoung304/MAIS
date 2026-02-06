---
title: Production tenant onboarding flow - preview auth, undefined arrays, API shape mismatch
date: 2026-02-05
severity: P1
category: integration-issues
component:
  - tenant-agent
  - preview-iframe
  - storefront-api
  - first-draft-workflow
tags:
  - authentication
  - type-safety
  - api-contracts
  - agent-tools
  - production-bug
  - null-handling
  - default-parameters
related_pitfalls:
  - 12 # Field name mismatches in DTOs
  - 43 # Tools return instructions
  - 56 # Type assertion without validation / missing Zod safeParse
  - 82 # dashboardAction not extracted from tool results
  - 86 # Agent onboarding says "first draft" but shows placeholders
symptoms:
  - Preview iframe shows "Preview failed to connect" with 401 Unauthorized in logs
  - TypeError Cannot read properties of undefined (reading 'map') in browser console
  - Agent says "That didn't work" after calling build_first_draft tool
  - /sections/preview returns 401 despite valid token
  - Components crash when rendering agent-generated content with null arrays
root_causes:
  - Frontend sends auth token via Authorization header but backend expects query parameter
  - transformContentForSection field renaming does not handle null arrays (null defeats default params)
  - build_first_draft tool written against service layer shape, not route response shape
fix_commit: 37973e03
---

# Production Onboarding Agent Bugs: Preview Auth + Array Defaults + API Shape

## Discovery

Found during Playwright MCP production testing of the tenant agent onboarding flow on `gethandled.ai` after merging PR #37 (onboarding ecosystem rebuild). Three cascading bugs prevented the `build_first_draft` workflow from completing.

**Test flow:** Dashboard login → Agent chat → 3 messages simulating wedding photographer → Stepper advances → `build_first_draft` triggers → **FAILS**

## Bug 1: Preview 401 Unauthorized

### Symptom

Preview iframe showed "Preview failed to connect". Render logs:

```
GET /test-photography-studio/sections/preview → 401 (1ms)
GET /test-photography-studio/sections → 200 (155ms)
```

### Root Cause

**API contract mismatch.** The other preview endpoint (`GET /:slug/preview`) uses `?token=` query parameter. This endpoint was implemented the same way in the backend, but the frontend consumer sent the token differently.

| Layer    | How token is sent                       | File                          |
| -------- | --------------------------------------- | ----------------------------- |
| Frontend | `Authorization: Bearer ${token}` header | `sections-api.ts:102`         |
| Backend  | `req.query.token` query parameter       | `public-tenant.routes.ts:377` |

### Fix

Changed frontend to send token as query parameter (matching backend and other preview endpoints):

```typescript
// BEFORE (broken)
const url = `${API_URL}/v1/public/tenants/${slug}/sections/preview`;
fetch(url, { headers: { Authorization: `Bearer ${token}` } });

// AFTER (fixed)
const url = `${API_URL}/v1/public/tenants/${slug}/sections/preview?token=${encodeURIComponent(token)}`;
fetch(url, { headers: { Accept: 'application/json' } });
```

**File:** `apps/web/src/lib/sections-api.ts`

---

## Bug 2: .map() Crash on Undefined Sections

### Symptom

`TypeError: Cannot read properties of undefined (reading 'map')` in browser console.

### Root Cause

`transformContentForSection()` renames fields (e.g., `items → features`, `items → images`) but didn't ensure array fields exist after transformation. When agent-generated content has `null` arrays, components crash because **`null` defeats React `= []` default parameters** — only `undefined` triggers defaults.

```typescript
// null vs undefined behavior with destructuring defaults:
const { features = [] } = { features: undefined }; // features = [] ✓
const { features = [] } = { features: null }; // features = null ✗ CRASH
```

### Fix

Added `?? []` guards in `transformContentForSection()` after each field rename:

```typescript
if (sectionType === 'features') {
  transformed.features = transformed.features ?? [];
}
if (sectionType === 'gallery') {
  transformed.images = transformed.images ?? [];
}
if (
  (sectionType === 'faq' || sectionType === 'testimonials') &&
  !Array.isArray(transformed.items)
) {
  transformed.items = transformed.items ?? [];
}
if (sectionType === 'pricing') {
  transformed.tiers = transformed.tiers ?? [];
}
```

**File:** `apps/web/src/lib/tenant.client.ts`

**Key insight:** Defensive defaults belong in the **transformation layer**, not just components. The transformation layer is the last chance to normalize data before it reaches React.

---

## Bug 3: build_first_draft Tool Failure

### Symptom

Agent said "That didn't work. Want me to try a different approach?" after `build_first_draft` tool call.

### Root Cause

Tool expected nested `{ pages: [{ sections: [...] }] }` response from `/storefront/structure` API, but the route handler flattens the service-layer result before sending:

| Layer                             | Response shape                                             |
| --------------------------------- | ---------------------------------------------------------- |
| Service (`SectionContentService`) | `{ pages: [{ name, sections }] }`                          |
| Route handler (what API returns)  | `{ sections: [{ id, page, type, hasPlaceholder }] }`       |
| Tool (what it expected)           | `{ pages: [{ pageName, sections: [{ isPlaceholder }] }] }` |

The tool was written against the **service layer** shape, not the **route response** shape. TypeScript `as` assertion compiled fine but crashed at runtime (Pitfall #56).

### Fix

Updated type assertion and data access to match actual API response:

```typescript
// BEFORE (broken)
const structureData = result.data as {
  pages: Array<{ pageName: string; sections: Array<{ isPlaceholder?: boolean }> }>;
};
const allSections = structureData.pages.flatMap(page => page.sections.map(...));

// AFTER (fixed)
const structureData = result.data as {
  sections: Array<{ id: string; page: string; hasPlaceholder: boolean }>;
};
const allSections = structureData.sections ?? [];
const placeholders = allSections.filter(s => s.hasPlaceholder);
```

**File:** `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts`

---

## Common Pattern

All three bugs share a root cause: **assumptions about data shape without runtime validation.**

| Bug               | Assumption                | Reality                     |
| ----------------- | ------------------------- | --------------------------- |
| Preview 401       | Token goes in header      | Backend reads query param   |
| .map() crash      | Arrays are always defined | Agent content can have null |
| build_first_draft | API returns nested pages  | Route flattens to sections  |

## Prevention

1. **API contracts should document auth mechanism** in ts-rest contract `summary` field
2. **Transformation layers must guarantee array fields** — use `?? []` after renames
3. **Agent tools should validate API responses** with Zod `safeParse()`, not `as` assertions (Pitfall #56)
4. **Test with real API responses** — the tool worked against mocked data but failed against the actual endpoint

## Detection Commands

```bash
# Find unvalidated API responses in agent tools
rg "await.*\.json\(\) as" server/src/agent-v2/
rg "\.data as \{" server/src/agent-v2/

# Find unprotected array transformations
rg "transformed\.\w+ = transformed\.\w+" apps/web/src/lib/tenant.client.ts

# Find auth mechanism mismatches
rg "Authorization.*Bearer" apps/web/src/lib/sections-api.ts
rg "req\.query\.token" server/src/routes/public-tenant.routes.ts
```

## Related Documentation

- [AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md](AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md) — Pitfall #86, first draft workflow design
- [PREVIEW_CONNECTION_FAILED_ROOT_CAUSE.md](../ui-bugs/PREVIEW_CONNECTION_FAILED_ROOT_CAUSE.md) — PostMessage handshake timeout
- [USEDRAFTCONFIG_SILENT_AUTH_FAILURE.md](../ui-bugs/USEDRAFTCONFIG_SILENT_AUTH_FAILURE.md) — Silent 401 in draft fetch
- [LIVEPREVIEW_DRAFT_URL_MISMATCH.md](../ui-bugs/LIVEPREVIEW_DRAFT_URL_MISMATCH.md) — Preview URL parameter issues
- [API_CONTRACT_FRONTEND_BACKEND_PREVENTION.md](../patterns/API_CONTRACT_FRONTEND_BACKEND_PREVENTION.md) — Full prevention guide
- [API_CONTRACT_QUICK_REFERENCE.md](../patterns/API_CONTRACT_QUICK_REFERENCE.md) — Print-and-pin cheat sheet
- [ZOD_PARAMETER_VALIDATION_PREVENTION.md](../patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md) — Zod validation patterns
