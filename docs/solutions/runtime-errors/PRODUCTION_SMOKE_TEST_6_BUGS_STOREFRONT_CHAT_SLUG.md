---
title: 'Production Smoke Test: 6 Critical Onboarding + Storefront Bugs'
date: 2026-02-16
category: runtime-errors
severity: P1
components:
  - storefront-rendering
  - agent-chat
  - tenant-admin-routes
  - auth-signup
  - agent-prompts
symptoms:
  - 'Storefront blank page — pricing section crash kills entire React tree'
  - 'Agent chat input permanently disabled after tool calls or greeting failure'
  - 'Raw [SESSION CONTEXT] blocks visible in chat history'
  - '404 on GET /api/tenant-admin/tiers'
  - 'Agent repeats user input verbatim'
  - '& encoded as amp in slugs and stored business names'
root_causes:
  - 'Missing pricing case in transformContentForSection + null defeats = [] defaults'
  - 'No AbortController timeout on frontend fetch + 30s backend ADK timeout too short'
  - 'extractMessagesFromEvents returns raw context-injected messages without stripping'
  - 'Package→Tier migration removed routes but never created GET /tiers'
  - 'Forbidden word bet in system.ts + no anti-parroting instruction'
  - 'Global sanitize middleware HTML-encodes & before slug generation and name storage'
fix_type: multi-bug-batch
files_changed: 18
lines_added: 418
lines_removed: 51
tests_added: 18
related_prs:
  - '#51-53 (Package→Tier migration)'
  - '#47 (Onboarding conversation redesign)'
  - '#55 (Remaining issues cleanup)'
---

# Production Smoke Test: 6 Critical Onboarding + Storefront Bugs

## Overview

Full end-to-end smoke test on production (gethandled.ai) with 2 fresh test accounts revealed 6 bugs blocking storefront rendering, onboarding flow, and dashboard functionality. Fixed in branch `fix/production-smoke-test-6-bugs` — 5 commits, 18 files, +418/-51 lines, 18 new tests.

## Bug 1 (P1): Storefront Crash — Pricing Section

### Symptom

All storefronts render blank. No CSS vars, no fonts, no theming. TenantSiteShell never mounts.

### Root Cause

`transformContentForSection()` in `storefront-utils.ts` had no `pricing` case. Database content with `items` field passed through unchanged. PricingSection expected `tiers`. When `tiers` was explicitly `null`, JS default parameter `= []` didn't activate → `.map()` on `null` → TypeError → React tree died.

**Critical JS behavior:** Default parameters only activate for `undefined`, NOT `null`. At API boundaries where databases and JSON commonly return `null`, this is a perennial crash source.

### Solution (4 layers)

1. Added `pricing` case to transform switch: maps `items` → `tiers`, ensures `Array.isArray(tiers)`
2. Added catch-all default case that null-coalesces known array fields
3. Replaced `= []` destructured defaults with explicit `Array.isArray()` guards in 5 components
4. Added minimal class ErrorBoundary in SectionRenderer to isolate per-section crashes

```typescript
// storefront-utils.ts — pricing transform
case 'pricing':
  if ('items' in content && !('tiers' in content)) {
    transformed.tiers = content.items;
    delete transformed.items;
  }
  if (!Array.isArray(transformed.tiers)) {
    transformed.tiers = [];
  }
  break;

// Section components — null guard pattern
const safeTiers = Array.isArray(tiers) ? tiers : [];
if (safeTiers.length === 0) return null;
```

### Files

- `apps/web/src/lib/storefront-utils.ts` — transform + default case
- `apps/web/src/components/tenant/SectionRenderer.tsx` — ErrorBoundary
- `apps/web/src/components/tenant/sections/PricingSection.tsx`
- `apps/web/src/components/tenant/sections/FeaturesSection.tsx`
- `apps/web/src/components/tenant/sections/GallerySection.tsx`
- `apps/web/src/components/tenant/sections/TestimonialsSection.tsx`
- `apps/web/src/components/tenant/sections/FAQSection.tsx`

---

## Bug 2 (P1): Agent Chat Infinite Hang

### Symptom

After agent tool calls, chat input becomes permanently disabled. Loading spinner never stops.

### Root Cause

Frontend `fetch()` had NO AbortController — no timeout at all. Backend ADK timeout was 30s but multi-tool agent turns (manage_tiers x3 + build_first_draft + update_section x3) take 20-45s. When backend timed out mid-execution, frontend waited forever. Additionally, if `fetchAgentGreeting` failed, `sessionId` stayed `null` → input permanently disabled (`!sessionId` always true).

### Solution (4 layers)

1. Added 150s AbortController timeout to frontend fetch in `sendMessageCore()`
2. Increased backend ADK `/run` timeout from 30s to 120s (matches Cloud Run max)
3. Fixed sessionId null after greeting failure: set `'pending-retry'` placeholder
4. Added recovery button after 60s of loading that aborts pending fetch

**Timeout cascade design:** frontend 150s > backend 120s > individual tool calls ~10-30s. The most informative error surfaces first (backend tells frontend it timed out, rather than frontend guessing).

### Files

- `apps/web/src/hooks/useTenantAgentChat.ts` — AbortController, sessionId fix, cancelRequest
- `apps/web/src/components/agent/TenantAgentChat.tsx` — recovery button UI
- `server/src/routes/tenant-admin-tenant-agent.routes.ts` — 120s timeout

---

## Bug 3 (P2): Raw [SESSION CONTEXT] Visible in Chat

### Symptom

Chat history shows raw `[SESSION CONTEXT]...[END CONTEXT]` blocks in user messages.

### Root Cause

Server-side context injection prepended the block into the first user message for the LLM to see. `extractMessagesFromEvents()` returned raw messages without stripping when loading chat history.

### Solution (2 layers)

1. Server-side `stripSessionContext()` in `extractMessagesFromEvents()` — indexOf-based (not regex) for guaranteed O(n)
2. Client-side fallback in `ChatMessage.tsx` — defense-in-depth

```typescript
function stripSessionContext(content: string): string {
  const startTag = '[SESSION CONTEXT]';
  const endTag = '[END CONTEXT]';
  const startIdx = content.indexOf(startTag);
  if (startIdx === -1) return content;
  const endIdx = content.indexOf(endTag, startIdx);
  if (endIdx === -1) return content;
  return content.slice(endIdx + endTag.length).trim();
}
```

### Files

- `server/src/routes/tenant-admin-tenant-agent.routes.ts` — server-side strip
- `apps/web/src/components/chat/ChatMessage.tsx` — client-side fallback

---

## Bug 4 (P2): Missing GET /tiers Route (404)

### Symptom

Dashboard calls `GET /api/tenant-admin/tiers` → 404. Tier count shows 0.

### Root Cause

Package→Tier migration (PRs #51-53) removed Package routes but never created a `GET /tiers` endpoint. Dashboard only needs a count, not full CRUD.

### Solution

8-line inline GET route in `tenant-admin.routes.ts` aggregator using existing `CatalogService.getAllTiers()`. GET-only — full CRUD not needed since tier management happens through agent tools.

### Files

- `server/src/routes/tenant-admin.routes.ts` — inline GET /tiers

---

## Bug 5 (P3): Agent Parrots User Input

### Symptom

Agent repeats the user's exact words back as its opening line before acting.

### Root Cause

"bet" in system.ts confirmation vocabulary contradicted voice.ts forbidden list (`Never: bet | say less | aight`). No anti-parroting instruction existed.

### Solution

Replaced "bet" with "cool", added nuanced anti-parroting instruction with exception for price/destructive action confirmations (Financial Safety Protocol).

### Files

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

---

## Bug 6 (P3): `&` Encoded as `amp` in Slugs and Names

### Symptom

"Ember & Ash Photography" → slug `ember-amp-ash-photography`, stored name `Ember &amp; Ash Photography`.

### Root Cause

Global sanitize middleware HTML-encodes `&` to `&amp;` before slug generation. Regex `[^a-z0-9]+` turns `&amp;` into `-amp-`. The stored `tenant.name` also contains the encoded version.

### Solution

Applied `validator.unescape()` to businessName immediately after extraction, before BOTH slug generation AND provisioning. Added `& → and` mapping for human-readable slugs. Fixed shared `slugify()` in `internal-agent-shared.ts` too.

```typescript
const cleanBusinessName = validator.unescape(businessName);
const baseSlug = cleanBusinessName
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 50);
```

### Files

- `server/src/routes/auth-signup.routes.ts` — unescape + clean slug + clean provisioning
- `server/src/routes/internal-agent-shared.ts` — shared slugify fix

---

## Prevention Strategies

### 1. Null ≠ Undefined at API Boundaries

**Rule:** Never rely on JS default parameters (`= []`) for values that cross API boundaries. Use `Array.isArray()` or nullish coalescing (`??`).
**Check:** Grep for `= []` in component destructuring that receives API data.

### 2. Every Fetch Needs a Timeout

**Rule:** Every frontend fetch must include an AbortController with explicit timeout. Timeout errors must surface to users.
**Check:** Grep for bare `fetch(url)` without `signal` in options.

### 3. Context Injection Must Have Corresponding Stripping

**Rule:** If server injects metadata blocks into messages, the display layer must explicitly strip them — never rely on implicit filtering.
**Check:** For any `[SESSION` injection, verify a corresponding `stripSessionContext()` call exists in display code.

### 4. Model Migrations Need Route Checklists

**Rule:** Every data model migration must verify no routes are orphaned by comparing old and new route trees.
**Check:** After removing model routes, search frontend for all API calls to that model's endpoints.

### 5. Single Source of Truth for Vocabulary/Constants

**Rule:** Rules about allowed words, section types, or tone that appear in >1 file will drift. Consolidate and add sync tests.
**Check:** Run `constants-sync.test.ts` — it catches drift between canonical and agent copies.

### 6. Global Middleware Must Not Apply Lossy Transforms

**Rule:** HTML encoding in global middleware breaks downstream domain logic that expects unmodified input. Apply transforms only at display layer.
**Check:** Audit `server/src/middleware/` for transforms that modify `req.body` before domain routes run.

---

## Related Documentation

- `docs/solutions/agent-issues/ONBOARDING_AGENT_PRODUCTION_BUGS_AUTH_TRANSFORM_RESPONSE_MISMATCH.md` — Prior `.map()` on null crash pattern
- `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md` — 7-location drift causing silent section drops
- `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md` — Context injection architecture
- `docs/solutions/patterns/TWO_PHASE_INIT_ANTIPATTERN.md` — Two-phase session init collapse
- `docs/solutions/agent-issues/AGENT_DEPLOYMENT_ENV_AND_RESPONSE_PARSING.md` — ADK response parsing
- `docs/solutions/patterns/DUAL_SYSTEM_MIGRATION_DRIFT_PREVENTION.md` — Package vs Tier migration drift
- `docs/solutions/patterns/API_CONTRACT_FRONTEND_BACKEND_PREVENTION.md` — API contract mismatch prevention
- `docs/solutions/architecture/app-router-route-tree-deduplication-domain-vs-slug-pattern.md` — Route dedup pattern

## Tests Added

- 11 unit tests for `transformContentForSection` (pricing transform, null coalescing, default case)
- 7 unit tests for `slugify` (& handling, HTML entity decoding, truncation, edge cases)
