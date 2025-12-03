# TODO-181: SectionHeader.tsx File Naming Inconsistency

**Priority:** P3 (Code Consistency)
**Status:** pending
**Created:** 2025-12-03
**Source:** Code Review (Pattern Recognition Specialist)

## Issue

The new `SectionHeader.tsx` file uses PascalCase naming, while the project's component file naming convention uses kebab-case for most files.

## Location

- `client/src/components/ui/SectionHeader.tsx`

## Current Naming

```
client/src/components/ui/
├── SectionHeader.tsx    # PascalCase - inconsistent
├── button.tsx           # kebab-case
├── card.tsx             # kebab-case
├── dialog.tsx           # kebab-case
└── ...
```

## Expected Naming

```
client/src/components/ui/
├── section-header.tsx   # kebab-case - consistent
├── button.tsx
├── card.tsx
└── ...
```

## Context

Looking at the codebase, the `client/src/components/ui/` directory consistently uses kebab-case:
- `button.tsx`
- `card.tsx`
- `dialog.tsx`
- `input.tsx`
- `badge.tsx`

However, feature components in `client/src/features/` use PascalCase:
- `BookingForm.tsx`
- `PackageCard.tsx`

This appears to be a Shadcn/Radix UI convention where base UI primitives use kebab-case.

## Recommendation

1. Rename `SectionHeader.tsx` to `section-header.tsx`
2. Update all imports accordingly
3. Document the naming convention if not already documented

## Acceptance Criteria

- [ ] `SectionHeader.tsx` renamed to `section-header.tsx`
- [ ] All imports updated to use new path
- [ ] No broken imports (verify with typecheck)

## Related

- TODO-117: Completed SectionHeader component creation (introduced this file)
- Shadcn UI conventions: https://ui.shadcn.com/
