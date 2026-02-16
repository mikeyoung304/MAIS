# HANDOFF: Section Types Sync + Build Failure Fix

**Date:** 2026-02-13
**Branch:** Work on `main` directly (or create `fix/section-types-sync`)
**Priority:** P1 — onboarding build_first_draft fails, site never renders after reveal
**Estimated scope:** ~30 min, 6-8 files

## Context

After the onboarding conversation redesign (PR #47), the agent successfully collects business info and calls `build_first_draft`, but the site never renders. The agent says "Hit a snag building your site."

**Root cause:** 7 independent `SECTION_TYPES` constants drifted apart. The agent and block-type-mapper use 12 types (including `about`, `services`, `custom`), but the contracts, server routes, and frontend only know 9 types. Sections are created in the DB but filtered out during rendering.

**Compound docs:**

- `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md`
- `docs/solutions/patterns/TWO_PHASE_INIT_ANTIPATTERN.md`

## What Was Already Fixed (This Session)

Brain dump context injection — 3 bugs fixed, committed (`5ef45a2a`), deployed to Render + Cloud Run:

1. Frontend now skips `POST /session` for new sessions → `POST /chat` creates session inline with bootstrap
2. `buildContextPrefix` early-return guard now checks `brainDump`, `city`, `state`
3. System prompt forbids mentioning "brain dump", "signup form"

**These fixes are live and working.** The agent greeting is context-aware. The remaining issue is the build/render failure.

## What Needs Fixing

### Fix 1 (P1): Sync SECTION_TYPES — Add `about`, `services`, `custom`

Three stale constants need 3 new types:

**File 1: `packages/contracts/src/landing-page.ts:48-58`**

```typescript
// CURRENT (stale — 9 types)
export const SECTION_TYPES = [
  'hero',
  'text',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'features',
] as const;

// FIXED (12 types — matches block-type-mapper.ts)
export const SECTION_TYPES = [
  'hero',
  'text',
  'about',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'services',
  'features',
  'custom',
] as const;
```

**File 2: `server/src/routes/internal-agent-shared.ts:29-39`**
Same change — add `about`, `services`, `custom` to match.

**File 3: `apps/web/src/lib/tenant.client.ts:447-457`** (`KNOWN_SECTION_TYPES`)
Add `about`, `services`, `custom` to the Set.

### Fix 2 (P1): Frontend BLOCK_TO_SECTION_MAP — Kill `text` alias

**File: `apps/web/src/lib/tenant.client.ts:417-429`**

```typescript
// CURRENT (legacy)
ABOUT: 'text',  // Use 'text' for backward compat

// FIXED (canonical — matches block-type-mapper.ts)
ABOUT: 'about',
```

This means all ABOUT sections will now come through as `"about"` not `"text"`.

### Fix 3 (P1): SectionRenderer — Add cases for `about`, `services`

**File: `apps/web/src/components/tenant/SectionRenderer.tsx:82-111`**

The switch statement needs new cases:

```typescript
case 'text':    // existing — keep for backward compat
case 'about':   // NEW — canonical name for TextSection
  return <TextSection {...section} tenant={tenant} />;

case 'features':  // existing
case 'services':  // NEW — services renders same as features
  return <FeaturesSection {...section} tenant={tenant} />;
```

Also update `SECTION_TYPE_TO_ANCHOR_ID` (line 20-30):

```typescript
about: 'about',     // NEW
services: 'services', // NEW
custom: 'custom',     // NEW (if rendering added later)
```

**Important:** The `Section` type in contracts is a discriminated union keyed on `type`. Adding `about` and `services` to `SECTION_TYPES` means the `Section` type union also needs to include them. Check how `Section` is derived from `SECTION_TYPES` in `packages/contracts/src/landing-page.ts` and ensure the type union updates automatically.

### Fix 4 (P2): Agent system prompt — Don't ask permission for first draft

**File: `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`**

The agent said "I'm ready to build the first draft... Sound good?" before building. The system prompt already says "NO approval needed for first draft" (line ~146-147), but reinforce it:

In Phase 1 Step 5, after "call build_first_draft", add:

```
**Do NOT ask for permission.** Just build. The user already consented by going through onboarding. Asking "Sound good?" before building wastes a round-trip and makes you sound uncertain.
```

### Fix 5 (P3): Cloud Run agent — Missing FEATURES in BlockType

**File: `server/src/agent-v2/deploy/tenant/src/context-builder.ts:21-31`**

The `BlockType` union type is missing `FEATURES`. Add it:

```typescript
type BlockType =
  | 'HERO'
  | 'ABOUT'
  | 'SERVICES'
  | 'PRICING'
  | 'TESTIMONIALS'
  | 'FAQ'
  | 'CONTACT'
  | 'CTA'
  | 'GALLERY'
  | 'FEATURES'
  | 'CUSTOM';
```

### Fix 6 (P3): Constants sync test — Extend coverage

The codebase has an existing constants sync test that catches drift between canonical and agent copies. Extend it to also check:

- `packages/contracts/src/landing-page.ts` SECTION_TYPES
- `server/src/routes/internal-agent-shared.ts` SECTION_TYPES
- `apps/web/src/lib/tenant.client.ts` KNOWN_SECTION_TYPES

This prevents future drift.

## Files to Modify (Summary)

| #   | File                                                       | Change                                                                   |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | `packages/contracts/src/landing-page.ts`                   | Add `about`, `services`, `custom` to SECTION_TYPES                       |
| 2   | `server/src/routes/internal-agent-shared.ts`               | Same — add 3 types                                                       |
| 3   | `apps/web/src/lib/tenant.client.ts`                        | Fix BLOCK_TO_SECTION_MAP (`ABOUT→'about'`), add 3 to KNOWN_SECTION_TYPES |
| 4   | `apps/web/src/components/tenant/SectionRenderer.tsx`       | Add `about`/`services` switch cases + anchor IDs                         |
| 5   | `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`  | Reinforce no-permission-needed for first draft                           |
| 6   | `server/src/agent-v2/deploy/tenant/src/context-builder.ts` | Add FEATURES to BlockType union                                          |

## Type Ripple Check

Adding `about`, `services`, `custom` to `SECTION_TYPES` in contracts may cause TypeScript errors if the `Section` discriminated union doesn't account for them. Check:

1. How `Section` type is built from `SECTION_TYPES` in `landing-page.ts`
2. Whether `SectionRenderer` switch needs exhaustive handling for new types
3. Whether any Zod schemas validate against the old 9-type list

Run after changes:

```bash
rm -rf server/dist packages/contracts/dist packages/shared/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck
```

## Verification

After fixing, test with a fresh tenant signup:

1. Fill in business name, city, state, and a rich brain dump
2. Agent should give context-aware greeting (already working)
3. Walk through segment → tiers → build
4. `build_first_draft` should succeed
5. All 3 sections (HERO, ABOUT, SERVICES) should render in the preview
6. No console warnings about "Skipping section with invalid type"

## Deployment

- **Render (API):** Auto-deploys on push to main
- **Cloud Run (tenant-agent):** Auto-deploys if files in `server/src/agent-v2/deploy/*/src/**` changed (Fix 5 and 6 trigger this)
- **Vercel (frontend):** Check if auto-deploys or needs manual trigger

## Known Issues NOT in Scope

- **Research agent returning empty** for niche markets (death doula pricing in Macon/ATL) — separate issue
- **onboardingPhase not advancing** — phase stayed NOT_STARTED despite facts being stored. May be separate bug in phase advancement logic.
- **Stripe 404** — `/api/tenant-admin/stripe/status` returns 404. Route may not exist or not be proxied. Low priority.
