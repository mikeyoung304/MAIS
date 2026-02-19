---
status: pending
priority: p2
issue_id: '11019'
tags: [code-review, typescript, navigation, section-types, type-safety]
---

# P2-04 — Redundant `as SectionTypeName` Cast Masks Future Type Drift

## Problem Statement

`s.type as SectionTypeName` in `navigation.ts:102` is a no-op cast — `s.type` is already typed as `SectionTypeName`. The cast suppresses the type error that would fire if `SectionSchema` and `SectionTypeName` ever diverge. Without the cast, TypeScript would surface that divergence at compile time — the desired behavior.

## Findings

- **File:** `apps/web/src/components/tenant/navigation.ts:102`
- **Code:** `(s) => SECTION_TYPE_TO_PAGE[s.type as SectionTypeName] === page`
- **Agents:** kieran-typescript-reviewer (P2-1), julik-frontend-races-reviewer (P3-02 — escalated)
- **Known Pattern:** `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md`

## Proposed Solution

Remove the cast:

```typescript
// Before
(s) => SECTION_TYPE_TO_PAGE[s.type as SectionTypeName] === page

// After
(s) => SECTION_TYPE_TO_PAGE[s.type] === page
```

`SECTION_TYPE_TO_PAGE` is `Partial<Record<SectionTypeName, PageName>>` — the indexer accepts `SectionTypeName` directly. If `s.type` is not `SectionTypeName`, TypeScript will now correctly flag it.

## Acceptance Criteria

- [ ] Cast removed from `navigation.ts:102`
- [ ] `npm run --workspace=apps/web typecheck` passes with no errors

## Work Log

- 2026-02-18: Created from TypeScript review
