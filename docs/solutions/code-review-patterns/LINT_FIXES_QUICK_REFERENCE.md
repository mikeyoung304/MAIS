# Lint Fixes: Quick Reference Card

**Print this and pin it next to your monitor.**

---

## Three Categories of Lint Issues

| Category            | Tool                | How to Find               | Fix                        |
| ------------------- | ------------------- | ------------------------- | -------------------------- |
| **P1: Type Errors** | `npm run typecheck` | "Cannot find name 'X'"    | Add to `import type { X }` |
| **P2: Dead Code**   | Code review         | Unused functions, queries | Delete completely          |
| **P3: Style**       | `npm run lint`      | ESLint warnings           | Apply lint-suggested fixes |

---

## Checklist for After Merging Code Review

- [ ] Run `npm run lint` — fix all violations
- [ ] Run `npm run typecheck` — fix all type errors (ESLint won't catch these!)
- [ ] Search codebase for removed functions — delete old calls
- [ ] Look for unused database queries — remove entirely
- [ ] Add braces to switch cases with variable declarations
- [ ] Verify imports: type-only usage → `import type`
- [ ] Run `npm test` — ensure no regressions

---

## Type Import Decision Tree (30 seconds)

```
Question: Is this imported symbol used at runtime (assigned, called, indexed)?

YES ──→ import { X }           (VALUE import)
NO  ──→ import type { X }      (TYPE import)
BOTH ──→ import { X }          (VALUE import — must be value if used at runtime at all)
```

---

## Common Patterns

### Missing Type Import Error

```typescript
// ❌ ERROR: TS2304: Cannot find name 'SupportedModel'
model: config.model as SupportedModel,

// ✅ FIX: Add to import type
import type { SupportedModel } from '../tracing';
```

### Unused Database Query

```typescript
// ❌ SMELL: Query result assigned but never used
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { slug: true },
});
// ... rest of function never references tenant

// ✅ FIX: Delete the entire query
```

### Switch Case Variable Scope

```typescript
// ❌ ERROR: eslint/no-case-declarations
case 'MARKET_RESEARCH':
  const mrData = validatedData as MarketResearchData;

// ✅ FIX: Add block braces
case 'MARKET_RESEARCH': {
  const mrData = validatedData as MarketResearchData;
  break;
}
```

### Type vs Value Import

```typescript
// ❌ WRONG: Value import used only as type
import { ContextCache } from './cache';
const x: ContextCache = ...;  // Type annotation only

// ✅ RIGHT: Use import type
import type { ContextCache } from './cache';
const x: ContextCache = ...;
```

---

## ESLint + TypeScript: Which Finds What?

| Error                             | ESLint | TypeScript | Fix                       |
| --------------------------------- | ------ | ---------- | ------------------------- |
| Unused import                     | ✅     | ❌         | Delete import             |
| Missing type import               | ❌     | ✅         | Add `import type`         |
| Case scope (no-case-declarations) | ✅     | ❌         | Add braces                |
| Unused variable                   | ✅     | ❌         | Delete or prefix with `_` |
| Unused database query             | ❌     | ❌         | Manual review (delete it) |

**Key:** Always run both `npm run lint` AND `npm run typecheck`

---

## Red Flags During Code Review

| Red Flag                                | Action                                |
| --------------------------------------- | ------------------------------------- |
| Function with no callers                | Search codebase; if 0 results, delete |
| Database query, result unused           | Delete the query                      |
| Helper function marked "for future use" | Delete if not actively used           |
| `as any` to quiet type checker          | Don't merge; fix the type             |
| Import statement you can't explain      | Remove it                             |

---

## Commands

```bash
# Check lint violations
npm run lint

# Fix auto-fixable lint issues
npm run lint -- --fix

# Check TypeScript compilation
npm run typecheck

# Full validation pipeline
npm run lint && npm run typecheck && npm test
```

---

## After Merging a Worktree (Multi-Agent Code Review)

1. Expect 5-15 lint violations from code review changes
2. Run full validation: `npm run lint && npm run typecheck && npm test`
3. Fix P1 (TypeScript errors) first — blocks CI
4. Fix P2 (dead code) by deleting — reduces maintenance burden
5. Fix P3 (style) using lint auto-fix
6. Commit with message: `fix(lint): resolve N violations from [merge/code-review]`

---

## When You See "Cannot find name"

This is ALWAYS a missing `import type`. Examples:

- `Cannot find name 'SupportedModel'` → Add to `import type { SupportedModel }`
- `Cannot find name 'DiscoveryData'` → Add to `import type { DiscoveryData }`
- `Cannot find name 'OnboardingPhase'` → Add to `import type { OnboardingPhase }`

ESLint won't warn you about this. Only TypeScript compiler catches it.

---

## Related Compound Documents

- Full explanation: `lint-fixes-multi-agent-review-compound-MAIS-20260105.md`
- Prevention patterns: `docs/solutions/patterns/PREVENTING_LINT_REGRESSIONS.md`
