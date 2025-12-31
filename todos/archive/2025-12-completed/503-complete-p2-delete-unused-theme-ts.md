# P2: Delete Unused theme.ts File (Dead Code)

## Status

- **Priority:** P2 (Medium)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - Code Simplicity Reviewer

## Problem

The file `apps/web/src/lib/theme.ts` was created but is NEVER imported anywhere in the codebase:

```bash
$ grep -r "darkFormStyles" apps/web/src/
# Returns only the theme.ts file itself
```

**File:** `apps/web/src/lib/theme.ts`

```typescript
export const darkFormStyles = {
  input: 'bg-surface border-neutral-700 text-text-primary...',
  card: 'bg-surface-alt border-neutral-700 text-text-primary',
};
```

All form components use inline Tailwind classes instead of importing from theme.ts.

## Impact

Dead code that adds confusion. Developers may think they should use it, but the pattern wasn't adopted.

## Solution

Delete the unused file:

```bash
rm apps/web/src/lib/theme.ts
```

Or alternatively, if we want to adopt the pattern, update EditTenantForm.tsx and other forms to actually import and use darkFormStyles.

## Recommendation

Delete the file. The inline Tailwind pattern is working fine and matches the Card component's colorScheme approach.

## Tags

`cleanup`, `dead-code`, `theme`
