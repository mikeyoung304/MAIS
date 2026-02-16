---
title: 'SECTION_TYPES Constants Drift Resolution — Silent Section Filtering Fix'
date: '2026-02-13'
severity: 'P1'
component: 'Storefront Rendering Pipeline'
symptoms:
  - 'build_first_draft tool succeeds but site fails to render'
  - "Agent sections (ABOUT, SERVICES) exist in database but don't appear on frontend"
  - 'sectionsToLandingConfig filters by stale KNOWN_SECTION_TYPES — silently drops sections'
  - 'Console warning: Skipping unknown section type: services'
  - 'SectionRenderer never receives filtered-out sections'
  - '7 independent SECTION_TYPES constants drifted (12 types vs 9 types)'
tags:
  - constants-duplication
  - section-types
  - single-source-of-truth
  - storefront-rendering
  - silent-data-loss
  - discriminated-union
related_issues:
  - 'CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md (anti-pattern diagnosis)'
  - 'TWO_PHASE_INIT_ANTIPATTERN.md (companion bug — brain dump context injection)'
  - 'HANDOFF-section-types-sync.md (execution plan)'
  - 'ONBOARDING_REVEAL_SCOPE_PREVENTION.md (reveal MVP scope)'
---

# SECTION_TYPES Constant Drift Resolution

## Problem

After the onboarding conversation redesign (PR #47), the agent successfully collects business info and calls `build_first_draft`, but the site never renders. The agent says "Hit a snag building your site."

**Observable symptoms:**

1. `build_first_draft` tool returns success with all 3 MVP sections (HERO, ABOUT, SERVICES)
2. `update_section` calls for all 3 succeed — sections exist in `SectionContent` table
3. Frontend fetches sections via `/sections` API — receives all 3
4. `sectionsToLandingConfig()` maps `ABOUT` → `'about'` and `SERVICES` → `'services'`
5. `KNOWN_SECTION_TYPES` filter removes `'services'` (not in the 9-type allowlist)
6. `SectionRenderer` never receives filtered sections — site renders with gaps
7. Console warning: `[sectionsToLandingConfig] Skipping unknown section type: services`

**No error thrown. No stack trace. Silent data loss.**

## Root Cause

7 independent `SECTION_TYPES` constants drifted apart across the monorepo:

| Location                                                    | Types | Status                                            |
| ----------------------------------------------------------- | ----- | ------------------------------------------------- |
| `server/src/lib/block-type-mapper.ts`                       | 12    | Canonical (source of truth)                       |
| `server/src/agent-v2/deploy/tenant/src/constants/shared.ts` | 12    | In sync                                           |
| `packages/contracts/src/landing-page.ts`                    | **9** | **STALE** — missing `about`, `services`, `custom` |
| `server/src/routes/internal-agent-shared.ts`                | **9** | **STALE**                                         |
| `apps/web/src/lib/tenant.client.ts` (KNOWN_SECTION_TYPES)   | **9** | **STALE**                                         |
| `apps/web/src/lib/tenant.client.ts` (BLOCK_TO_SECTION_MAP)  | 11    | Partial — had `ABOUT: 'text'` (legacy alias)      |
| `apps/web/src/components/tenant/SectionRenderer.tsx`        | 9     | **STALE** — no switch cases for new types         |

The agent creates sections with `blockType: ABOUT` and `blockType: SERVICES` in the database. The frontend conversion maps these to lowercase section types (`'about'`, `'services'`). But 3 downstream consumers only knew 9 types, silently filtering the new ones.

### Why it happened

- Cloud Run agents can't import from `@macon/contracts` (rootDir constraint)
- Multiple files manually copy the same constant list
- The existing `constants-sync.test.ts` only checked 2 of 7 locations
- Adding types to the canonical source didn't propagate to copies
- No TypeScript error because the filter uses a `Set.has()` check, not a `Record<SectionTypeName, ...>`

## Solution

**Commit:** `b1de7cbc` — 9 files changed, 121 insertions, 11 deletions

### 1. Contracts: SECTION_TYPES + Zod schemas (landing-page.ts)

Added `about`, `services`, `custom` to the SECTION_TYPES array (9 → 12):

```typescript
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

Updated `SectionIdSchema` regex to accept new types in section IDs:

```typescript
/^(home|about|services|...)-(hero|text|about|...|services|features|custom)-(main|[a-z]+|[0-9]+)$/;
```

Added 3 new Zod schemas to the `Section` discriminated union:

```typescript
// 'about' mirrors TextSectionSchema (same fields, different type literal)
export const AboutSectionSchema = z.object({
  type: z.literal('about'),
  headline: z.string().max(60).optional(),
  content: z.string().min(1).max(2000),
  // ... same as TextSectionSchema
});

// 'services' mirrors FeaturesSectionSchema
export const ServicesSectionSchema = z.object({
  type: z.literal('services'),
  headline: z.string().max(60),
  features: z.array(FeatureItemSchema).min(1).max(12),
  // ... same as FeaturesSectionSchema
});

// 'custom' is a minimal flexible schema
export const CustomSectionSchema = z.object({
  type: z.literal('custom'),
  headline: z.string().max(60).optional(),
  content: z.string().max(5000).optional(),
});

// All added to both strict and lenient discriminated unions
export const SectionSchema = z.discriminatedUnion('type', [
  // ... existing 9 + AboutSectionSchema, ServicesSectionSchema, CustomSectionSchema
]);
```

### 2. Server routes (internal-agent-shared.ts)

Synced SECTION_TYPES from 9 → 12 (identical change).

### 3. Frontend conversion (tenant.client.ts)

Changed `BLOCK_TO_SECTION_MAP` to use canonical names:

```typescript
// Before: ABOUT: 'text' (legacy alias)
// After:  ABOUT: 'about' (canonical per block-type-mapper.ts)
```

Added all 3 new types to `KNOWN_SECTION_TYPES`:

```typescript
const KNOWN_SECTION_TYPES = new Set([
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
]);
```

Updated `transformContentForSection` to handle `about` (body → content) and `services` (items → features) the same as their aliases.

### 4. SectionRenderer

Added switch cases with explicit type overrides for TypeScript compatibility:

```tsx
case 'text':
  return <TextSection {...section} tenant={tenant} />;
case 'about':
  // Same shape as text; override type for TS discriminated union
  return <TextSection {...section} type="text" tenant={tenant} />;

case 'features':
  return <FeaturesSection {...section} tenant={tenant} />;
case 'services':
  // Same shape as features; override type for TS discriminated union
  return <FeaturesSection {...section} type="features" tenant={tenant} />;

case 'custom':
  return null; // No renderer yet
```

Added anchor IDs for single-page navigation: `about → 'about'`, `services → 'services'`.

### 5. Additional type ripple fixes

TypeScript's `Record<Section['type'], ...>` pattern caught 2 more files:

- **SectionCard.tsx**: Added `about`, `services`, `custom` to `SECTION_TYPE_META` and `getSectionSummary`
- **SectionEditorDialog.tsx**: Added 3 new entries to `SECTION_TYPE_LABELS`

### 6. Agent-side fixes

- **context-builder.ts**: Added `FEATURES` to `BlockType` union type
- **system.ts**: Reinforced "Do NOT ask permission" before first draft build
- **section-id.test.ts**: Updated to expect 12 types with assertions for new ones

## Why TypeScript Didn't Catch This Earlier

The silent filter used a `Set.has()` runtime check, not a compile-time type guard:

```typescript
// This is invisible to TypeScript — no error at compile time
if (!KNOWN_SECTION_TYPES.has(sectionType)) {
  continue; // Silently drops unknown types
}
```

The fix added the types to the Zod discriminated union, which means `Record<Section['type'], ...>` patterns in SectionCard and SectionEditorDialog DID fail at compile time — catching 2 additional files. The lesson: **use exhaustive `Record` types over `Set` allowlists** when possible.

## Prevention Strategies

### 1. Extend constants-sync.test.ts

The existing test checks agent copy vs canonical. Extend to cover all 7 locations:

```typescript
it('all SECTION_TYPES consumers stay in sync', () => {
  const canonical = new Set(CANONICAL_SECTION_TYPES);
  const locations = [
    { name: 'contracts', types: CONTRACT_SECTION_TYPES },
    { name: 'server-routes', types: SERVER_SECTION_TYPES },
    { name: 'frontend', types: [...KNOWN_SECTION_TYPES] },
    // ... all 7
  ];
  for (const loc of locations) {
    const missing = [...canonical].filter((t) => !new Set(loc.types).has(t));
    expect(missing).toEqual([], `${loc.name} missing: ${missing.join(', ')}`);
  }
});
```

### 2. Prefer Record<SectionTypeName, ...> over Set

```typescript
// BAD: Set — no compile-time exhaustiveness
const KNOWN = new Set(['hero', 'text', ...]);

// GOOD: Record — TypeScript errors if a type is missing
const META: Record<SectionTypeName, { label: string }> = {
  hero: { label: 'Hero' },
  // TS error if 'about' is missing
};
```

### 3. Checklist: Adding a New Section Type

1. Add to `server/src/lib/block-type-mapper.ts` (canonical SECTION_TYPES + mapping tables)
2. Add Prisma `BlockType` enum value + migration
3. Add Zod schema to `packages/contracts/src/landing-page.ts` (strict + lenient unions)
4. Update `SectionIdSchema` regex in contracts
5. Sync `server/src/routes/internal-agent-shared.ts`
6. Sync `server/src/agent-v2/deploy/tenant/src/constants/shared.ts`
7. Add to frontend `KNOWN_SECTION_TYPES` + `BLOCK_TO_SECTION_MAP`
8. Add `case` to `SectionRenderer.tsx` switch
9. Add metadata to `SectionCard.tsx` and `SectionEditorDialog.tsx`
10. Run: `rm -rf server/dist packages/*/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`

### 4. Long-term: Single source of truth

Use codegen to generate agent constant copies from the canonical source during build, eliminating manual sync entirely. Mark generated files with `// @generated — DO NOT EDIT`.

## Related Documentation

- [CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md](./CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md) — Anti-pattern diagnosis (the "trap")
- [TWO_PHASE_INIT_ANTIPATTERN.md](./TWO_PHASE_INIT_ANTIPATTERN.md) — Companion bug (brain dump context injection)
- [STOREFRONT_SECTION_IDS_QUICK_REFERENCE.md](./STOREFRONT_SECTION_IDS_QUICK_REFERENCE.md) — Section ID resolution patterns
- [ONBOARDING_REVEAL_SCOPE_PREVENTION.md](../ui-bugs/ONBOARDING_REVEAL_SCOPE_PREVENTION.md) — Reveal MVP scope
- [PREVENTION-QUICK-REFERENCE.md](../PREVENTION-QUICK-REFERENCE.md) — Constants duplication patterns (#39-45)
