---
title: Draft/Live Confusion in Storefront Tools - AI Publishes but Public Shows Placeholders
category: agent-issues
component: agent/storefront
symptoms:
  - AI agent says content is "live" but public storefront shows placeholder text like "[Hero Headline]"
  - publish_draft tool executes successfully but changes not visible on public page
  - Tenant ID validation fails with "Invalid uuid" error despite valid CUID
  - extractPublishedLandingPage() returns undefined/empty when config exists
keywords:
  - draft vs live confusion
  - landingPageConfig wrapper format
  - TenantPublicDtoSchema validation
  - UUID vs CUID mismatch
  - publish_draft executor
  - storefront publishing
  - agent communication clarity
  - extractPublishedLandingPage
severity: P1
date_solved: 2026-01-09
related_issues:
  - '#697'
  - '#699'
commit: 4607f2f3
---

# Draft/Live Confusion in Storefront Tools

## Problem Summary

After using the AI-guided storefront editor (Build Mode), the agent reported that content changes were "live" and "visible to visitors", but the public storefront still displayed placeholder text like `[Hero Headline]`. The `publish_draft` command appeared to succeed, but the published content never appeared.

## Root Cause Analysis

This was a **three-layer bug** where independent issues at different system layers compounded to create a silent failure:

### Layer 1: Schema Validation Mismatch

**File:** `packages/contracts/src/dto.ts:990`

The `TenantPublicDtoSchema` used `z.string().uuid()` for the tenant ID field, but Prisma generates CUIDs (Compact Unique Identifiers), not UUIDs. When the public API validated tenant data for storefront display, the schema rejected valid tenant records, causing content to fail silently.

```typescript
// BEFORE - Rejected valid Prisma IDs
id: z.string().uuid(),

// AFTER - Accepts CUIDs
id: z.string(), // Prisma uses CUIDs, not UUIDs
```

### Layer 2: Publish Executor Format Mismatch

**File:** `server/src/agent/executors/storefront-executors.ts:605-622`

The `publish_draft` executor wrote the raw draft config directly to `landingPageConfig`:

```typescript
// BEFORE - Wrote raw config
landingPageConfig: tenant.landingPageConfigDraft,
```

However, the public storefront API uses `extractPublishedLandingPage()` (in `server/src/adapters/prisma/tenant.repository.ts:710`) which expects a **wrapper format**:

```typescript
{
  draft: null,
  draftUpdatedAt: null,
  published: { pages: {...} },  // <-- Looks for .published
  publishedAt: "2026-01-09T..."
}
```

When the executor wrote raw config (without the wrapper), `extractPublishedLandingPage()` couldn't find a `.published` property, fell back to legacy parsing, and returned `null`.

### Layer 3: Agent Communication Confusion

**File:** `server/src/agent/tools/storefront-tools.ts`

When reading draft content, the AI agent had no guidance about draft vs live state. Tools like `get_landing_page_draft` and `list_section_ids` returned draft content, but the agent would tell users "your storefront shows..." or "visitors will see...", implying the content was live when it was actually still in draft.

## Solution

### Fix 1: Schema Relaxation (dto.ts:990)

Accept Prisma CUIDs instead of requiring strict UUIDs:

```typescript
// packages/contracts/src/dto.ts:990
id: z.string(), // Prisma uses CUIDs, not UUIDs
```

### Fix 2: Wrapper Format in Publish Executor (storefront-executors.ts:605-622)

Write the published config using the wrapper structure that `extractPublishedLandingPage()` expects:

```typescript
// server/src/agent/executors/storefront-executors.ts:605-622
// Copy draft to live config using wrapper format expected by findBySlugPublic
// The public API's extractPublishedLandingPage() looks for landingPageConfig.published
const publishedWrapper = {
  draft: null,
  draftUpdatedAt: null,
  published: tenant.landingPageConfigDraft,
  publishedAt: new Date().toISOString(),
};

await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    landingPageConfig: publishedWrapper,
    landingPageConfigDraft: Prisma.DbNull, // Clear the draft (Prisma 7 pattern)
  },
});
```

### Fix 3: Tool Response Guidance (storefront-tools.ts)

Added explicit communication rules to tool descriptions and response notes:

**In `get_landing_page_draft` tool (lines 876-881):**

```typescript
description: `Get the current draft state of the landing page.
...
COMMUNICATION RULES (#699):
- If hasDraft=true: Say "In your unpublished draft..." or "Your draft shows..."
- If hasDraft=false: Say "On your live storefront..." or "Visitors currently see..."
- NEVER say "live" or "on your storefront" when hasDraft=true`,
```

**In tool responses (lines 933, 1172, 1245):**

```typescript
// get_landing_page_draft response
note: hasDraft
  ? 'DRAFT content shown above. Say "In your draft..." when discussing. Never say "live".'
  : 'LIVE content shown above. Say "On your storefront..." - visitors see this now.',

// list_section_ids response
note: draftConfig
  ? 'Sections from DRAFT. Say "In your draft..." when discussing content. Not live yet.'
  : 'Sections from LIVE. Say "On your storefront..." - visitors see this content.',

// get_section_by_id response
note: draftConfig
  ? 'Content from DRAFT. Say "In your draft..." when discussing. Not yet live.'
  : 'Content from LIVE. Say "On your storefront..." - visitors see this.',
```

## Verification Steps

1. **Schema Fix Verification:**

   ```bash
   cd packages/contracts && npm run typecheck
   ```

2. **Executor Fix Verification:**

   ```bash
   # Create tenant, update draft, publish, verify public API
   curl -X GET "http://localhost:3000/t/test-tenant" | jq '.landingPageConfig'
   # Should return actual content, not null
   ```

3. **Tool Language Verification:**
   In Build Mode chat, after updating content, AI should say "In your draft..." NOT "on your storefront..."

4. **Full Integration Test:**

   ```bash
   npm run test:e2e -- e2e/tests/build-mode.spec.ts
   ```

5. **Manual Verification:**
   - Open Build Mode (`/tenant/build`)
   - Update hero headline via chat
   - Agent should say "In your draft, the headline is now..."
   - Click Publish
   - Visit public storefront (`/t/{slug}`)
   - Verify updated headline appears (not placeholder)

## Prevention Strategies

See: [DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md](../patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md)

### Quick Reference Checklist

**Schema Validation:**

- [ ] ID validation matches actual ID generation method (Prisma = CUID, not UUID)
- [ ] Tested with real database-generated IDs (not mocks)
- [ ] Schema comments document expected ID format

**Multi-Path Data:**

- [ ] All write paths documented for shared data
- [ ] All read paths documented
- [ ] Write format matches read expectations
- [ ] Integration test: each write path -> each read path

**AI Tool Responses:**

- [ ] State indicator included (`hasDraft`, `status`, `isLive`)
- [ ] Communication guidance in `note` field
- [ ] Tool description includes communication rules

### Decision Tree: ID Validation

```
What generates the ID?
├── Prisma @default(cuid()) → z.string() or z.string().cuid()
├── Prisma @default(uuid()) → z.string().uuid()
├── Custom prefix (pk_*) → z.string().startsWith('pk_')
├── External system → z.string() (don't validate format)
└── Unknown → z.string() (safest)
```

## Related Documentation

- [build-mode-storefront-editor-patterns-MAIS-20260105.md](../patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md) - Dual draft system architecture, trust tier classification
- [STOREFRONT_SECTION_ID_PATTERN-MAIS-20260108.md](../patterns/STOREFRONT_SECTION_ID_PATTERN-MAIS-20260108.md) - Section ID patterns for agent editing
- [chatbot-proposal-execution-flow-MAIS-20251229.md](../logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md) - T2 executor patterns
- [circular-dependency-executor-registry-MAIS-20251229.md](../patterns/circular-dependency-executor-registry-MAIS-20251229.md) - Executor registry patterns

## Key Insight

**When multiple code paths write the same data (AI executor vs admin API), ALL must agree on format.**

The read path (`extractPublishedLandingPage`) expected `{published: config}` but the write path (executor) stored raw config. This silent mismatch caused complete feature failure with no error messages.

**Rule:** Before writing to shared data, trace ALL read paths and verify your format is compatible.

## Files Modified

| File                                                                  | Change                    |
| --------------------------------------------------------------------- | ------------------------- |
| `packages/contracts/src/dto.ts:990`                                   | UUID -> string validation |
| `server/src/agent/executors/storefront-executors.ts:605-622`          | Added wrapper format      |
| `server/src/agent/tools/storefront-tools.ts:876-881, 933, 1172, 1245` | Added communication rules |
| `server/test/agent/storefront/storefront-executors.test.ts`           | Updated test expectations |

**Commit:** `4607f2f3` - fix(agent): resolve draft/live confusion in storefront tools (#697, #699)
