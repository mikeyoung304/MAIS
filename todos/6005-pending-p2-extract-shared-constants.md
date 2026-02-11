# Extract Shared Constants into constants/ Directory

**Priority:** P2
**Files:** New: `server/src/agent-v2/deploy/tenant/src/constants/shared.ts`, updates across ~10 tool files
**Blocked by:** Nothing
**Plan:** `docs/plans/2026-02-11-refactor-agent-debt-cleanup-plan.md`

## Problem

The same constants are hardcoded in 3-5 different files. When values change, they must be updated in every location manually. Current duplications:

### MVP_SECTIONS (HERO, ABOUT, SERVICES)

- `first-draft.ts` line 147: `new Set(['HERO', 'ABOUT', 'SERVICES'])` (inline)
- `packages/contracts/section-blueprint.schema.ts` line 169: `MVP_REVEAL_SECTION_TYPES` (canonical, can't import)
- System prompt line ~116: described in text

### PAGE_NAMES (7 page types)

- `storefront-read.ts` line 22: array of 7 page names
- `storefront-write.ts` line 24: identical array
- `internal-agent-shared.ts` line 39: identical array

### SECTION_TYPES (9 section types)

- `storefront-write.ts` line 34: array of 9 types
- `internal-agent-shared.ts` line 27: identical array
- NOTE: Canonical `block-type-mapper.ts` has 12 entries — the agent copies are MISSING `about`, `services`, `custom`

### SEED_PACKAGE_NAMES

- `first-draft.ts` line 214: hardcoded array
- `packages/contracts/section-blueprint.schema.ts`: canonical
- `server/src/lib/tenant-defaults.ts`: same names in DEFAULT_PACKAGE_TIERS

### TOTAL_SECTIONS

- `refinement.ts` line 46: `const TOTAL_SECTIONS = 8` (hardcoded)

## Fix

### 1. Create `constants/shared.ts`

```typescript
/**
 * Shared constants for tenant agent tools.
 *
 * Cloud Run rootDir constraint prevents importing from @macon/contracts or
 * server/src/shared/. These are manually synced copies — see cross-references.
 *
 * @see packages/contracts/src/schemas/section-blueprint.schema.ts (canonical)
 */

/** MVP sections for the reveal animation. @see contracts MVP_REVEAL_SECTION_TYPES */
export const MVP_SECTION_TYPES = new Set(['HERO', 'ABOUT', 'SERVICES'] as const);

/** Valid page names for storefront operations */
export const PAGE_NAMES = [
  'home',
  'about',
  'services',
  'pricing',
  'contact',
  'faq',
  'portfolio',
] as const;

/** Valid section types the agent can create. @see server/src/lib/block-type-mapper.ts */
export const SECTION_TYPES = [
  'hero',
  'about',
  'services',
  'pricing',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'gallery',
  'features',
  'custom',
] as const;

/** Seed package names to clean up during first draft. @see contracts SEED_PACKAGE_NAMES */
export const SEED_PACKAGE_NAMES = ['Basic Package', 'Standard Package', 'Premium Package'] as const;

/** Total canonical sections. @see contracts SECTION_BLUEPRINT.length */
export const TOTAL_SECTIONS = 8;
```

### 2. Update all tool files to import from `constants/shared.ts`

- `first-draft.ts`: Replace inline `MVP_SECTIONS` and `SEED_PACKAGE_NAMES`
- `storefront-read.ts`: Replace inline `PAGE_NAMES`
- `storefront-write.ts`: Replace inline `PAGE_NAMES` and `SECTION_TYPES`
- `refinement.ts`: Replace inline `TOTAL_SECTIONS`
- `navigate.ts`: Replace inline `BLOCK_TYPES` with `SECTION_TYPES`

### 3. Fix SECTION_TYPES gap

The current agent copies have 9 entries, missing `about`, `services`, `custom`. The canonical list in `block-type-mapper.ts` has 12. Add the missing entries so `add_section` can create all section types.

### 4. Update `constants/index.ts` barrel export

## Verification

```bash
npm run --workspace=server typecheck
# Grep to confirm no more inline MVP_SECTIONS, PAGE_NAMES, SECTION_TYPES in tool files:
grep -r "new Set\(\['HERO'" server/src/agent-v2/deploy/tenant/src/tools/
grep -r "'home', 'about', 'services'" server/src/agent-v2/deploy/tenant/src/tools/
```
