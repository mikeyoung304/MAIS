---
title: 'Todo Resolution Quick Reference'
category: 'workflow'
severity: ['reference']
tags:
  - 'todo-resolution'
  - 'quick-reference'
  - 'cheat-sheet'
date: '2025-12-05'
---

# Todo Resolution Quick Reference

**Print this. Pin it on your desk.**

---

## 5-Minute Decision Tree

When you see a new todo, ask:

```
Is the code already implemented?
├─ YES
│  ├─ Yes, works correctly
│  │  └─→ "VERIFY" (5-15 min) - cite files, mark complete
│  │
│  └─ Yes, but needs fixing
│     └─→ "FIX" (depends on issue)
│
├─ NO
│  ├─ Small change < 1 hour
│  │  └─→ "QUICK WIN" (20-45 min) - implement now, batch commits
│  │
│  └─ Large feature > 4 hours
│     └─→ "DEFER" (1 hour planning) - document scope, deps, next sprint
│
└─ UNSURE
   └─→ Run parallel agents, or grep codebase
```

---

## Implementation Type Reference

| Type          | Effort             | Pattern                             | Example                                 |
| ------------- | ------------------ | ----------------------------------- | --------------------------------------- |
| **Verify**    | 5-15 min           | Cite file:line, test, mark complete | TODO-246: Routes exist at routes.ts:168 |
| **Quick Win** | 20-45 min          | Implement, test, batch in 1 commit  | TODO-264: Create ErrorAlert component   |
| **Defer**     | 1-2 hours planning | Document scope, deps, estimate      | TODO-234: EditableImage component       |

---

## Pattern 1: Verify Already Implemented

**When:** Code exists, just need confirmation

**Checklist:**

```bash
# 1. Find code
rg 'function name|const name' src/

# 2. Verify tests
rg 'describe.*name|test.*name' src/__tests__/

# 3. Test it works
npm test -- src/file.test.ts

# 4. Cite evidence in todo
# - File: src/file.ts:LINE
# - Commit: HASH (feat: description)

# 5. Update todo status
status: complete
date_solved: 2025-12-XX
verification: 'Confirmed in HASH'
```

**Effort:** 10-20 min per todo

---

## Pattern 2: Quick Win Implementation

**When:** Small, self-contained feature < 1 hour

**Checklist:**

```bash
# 1. Create/modify file(s)
touch client/src/components/shared/ErrorAlert.tsx

# 2. Implement minimal solution
# (20-30 lines, focused, single responsibility)

# 3. Test locally
npm test -- client/src/components/shared/

# 4. Manual smoke test
npm run dev:all  # optional, if major change

# 5. Update todo file
status: complete
date_solved: 2025-12-XX

# 6. Batch 3-10 quick wins in ONE commit
git add .
git commit -m "chore(todos): resolve quick wins 264-265

- 264: Created shared ErrorAlert component
- 265: Added React.memo to StatusBadge and EmptyState

Closes TODO-264, TODO-265

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Key:** Batch commits (not individual commits)

---

## Pattern 3: Deferral

**When:** Large feature 4+ hours, architectural change, or lower priority

**Checklist:**

```yaml
---
status: pending
priority: p2
issue_id: 'XXX'
effort_estimate: '4-6 hours'
deferred_reason: 'Requires new component + backend endpoints + tests'
dependencies: ['P1 todos must complete first']
estimated_sprint: '2025-12-12'
---
```

**Don't forget:**

- [ ] Clear scope (what needs to be done)
- [ ] Effort estimate (hours)
- [ ] Dependencies (what must happen first)
- [ ] Next sprint assignment

---

## Shared Component Pattern

**When:** Code repeated 2+ times

**Pattern:**

```typescript
// 1. Extract to shared/
export function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <span className="text-sm text-red-700">{message}</span>
    </div>
  );
}

// 2. Import in each component
import { ErrorAlert } from '@/components/shared/ErrorAlert';

// 3. Use instead of inline markup
<ErrorAlert message={error} />
```

**Benefits:**

- Single source of truth
- Consistency guaranteed
- Maintenance easy

---

## React.memo Pattern

**When:** Pure component in list (10+ items) or receives callback props

**Pattern:**

```typescript
// 1. Wrap in memo with named function
export const StatusBadge = memo(function StatusBadge({ status, variant }: Props) {
  // component code
});

// 2. Or add displayName
export const Item = memo(({ id, onSelect }: Props) => {
  // component code
});
Item.displayName = 'Item';
```

**Parent must memoize callback props:**

```typescript
function Parent() {
  // ❌ DON'T - new function every render
  return <Item onSelect={(id) => setState(id)} />;

  // ✅ DO - stable function
  const handleSelect = useCallback((id) => setState(id), []);
  return <Item onSelect={handleSelect} />;
}
```

**Verify it works:**

```javascript
// React DevTools Profiler
// 1. Record
// 2. Trigger parent state change
// 3. Check: "StatusBadge did not render" (success)
```

---

## Transaction Pattern

**When:** Read-then-write, multiple operations must stay together

**Pattern:**

```typescript
async discardDraft(tenantId: string) {
  return await this.prisma.$transaction(async (tx) => {
    // Use tx, not this.prisma
    const tenant = await tx.tenant.findUnique(...);
    if (!tenant) throw new NotFoundError(...);

    const newData = { draft: null, ...tenant };
    await tx.tenant.update(...);

    return { success: true };
  });
}
```

**Remember:**

- Use `tx`, not `this.prisma` inside
- All operations atomic (all succeed or all fail)
- Catch errors outside transaction

---

## Batch Commit Pattern

**When:** Resolving 3+ todos in one session

**Commit Message:**

```
chore(todos): resolve P1/P2 todos, add components, close stale

Resolved todos:
- 246-251: Verified already implemented
- 252: Added transaction wrapper to discardDraft
- 264: Created shared ErrorAlert component
- 265: Added React.memo to StatusBadge/EmptyState

Deferred:
- 234: EditableImage component (4+ hours)
- 260: React Query refactor (8+ hours)

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Benefits:**

- Trackable (single commit = easy PR)
- Organized (grouped by status)
- Searchable (git log --grep="todos")

---

## Todo File Template

**For Verification:**

```yaml
---
status: complete
priority: p1
issue_id: '246'
tags: [code-review]
date_solved: '2025-12-05'
---

# Title

Verified: Routes exist at `server/src/routes/tenant-admin-landing-page.routes.ts:168-304`

No implementation work needed.
```

**For Quick Win:**

````yaml
---
status: complete
priority: p3
issue_id: '264'
tags: [code-quality, components]
date_solved: '2025-12-05'
effort: '20 min'
---

# Extract Shared ErrorAlert Component

## What Changed

Created `client/src/components/shared/ErrorAlert.tsx`
- Extracted from CalendarConfigCard, DepositSettingsCard, StripeConnectCard
- Null-safe, reusable, consistent styling

## Testing

```bash
npm test -- client/src/components/shared/
````

````

**For Deferral:**
```yaml
---
status: pending
priority: p2
issue_id: '234'
effort_estimate: '4-6 hours'
deferred_reason: 'Requires new component + backend + tests'
estimated_sprint: '2025-12-12'
---

# EditableImage Component

## Deferred Because

- Need new EditableImage.tsx component (doesn't exist)
- Need image upload backend integration
- Need E2E tests (3+ hours)

## Next Sprint

Ready to pick up when resources available.
````

---

## Parallel Agent Pattern (Optional)

**For complex verification (4+ todos):**

```
Create 4 parallel tasks, assign to specialized agents:

Agent 1: architecture-strategist
└─ Check: routes, services, contracts exist?
└─ Output: "Files found at X, Y, Z" or "Not found"

Agent 2: code-simplicity-reviewer
└─ Check: Is code simple, well-structured?
└─ Output: "Code quality: good / needs refactor"

Agent 3: security-sentinel
└─ Check: Are security patterns correct?
└─ Output: "Security: OK / missing X pattern"

Agent 4: performance-oracle
└─ Check: Are there N+1 queries, optimization issues?
└─ Output: "Performance: OK / issue at X"

Combine results → Decision (verify/fix/defer)
```

---

## Quick Wins - Common Examples

| Quick Win                       | Time   | Pattern                                                |
| ------------------------------- | ------ | ------------------------------------------------------ |
| Extract component (duplication) | 20 min | Create file, move markup, import in 3+ places          |
| Add React.memo to component     | 10 min | Wrap in memo, use named function                       |
| Add transaction wrapper         | 15 min | Wrap `$transaction`, use `tx` instead of `this.prisma` |
| Fix console.log → logger        | 5 min  | Search & replace, verify no logging breaks             |
| Add aria-hidden to icon         | 5 min  | Search icons in component, add attribute               |
| Extract constant/utility        | 10 min | Move repeated logic to separate file, import           |

**Total for 6 quick wins:** 45-60 min

---

## Deferral - Common Reasons

| Reason                     | Action                                           |
| -------------------------- | ------------------------------------------------ |
| "Needs new component"      | Defer if file doesn't exist + 2+ hours work      |
| "Needs backend endpoint"   | Defer if 3+ hours backend + frontend integration |
| "Needs database migration" | Defer if requires schema changes + testing       |
| "Needs refactor"           | Defer if affects 3+ existing components          |
| "Complex async logic"      | Defer if 2+ services/hooks need coordination     |
| "Lower priority (P3)"      | Defer if P1/P2 todos pending                     |
| "Blocked by other todo"    | Defer with clear dependency noted                |

**When in doubt:** Document as pending, make decision next sprint

---

## Testing Checklist Before Commit

```bash
# 1. Unit/integration tests
npm test

# 2. E2E tests (if modified routes/components)
npm run test:e2e

# 3. TypeScript
npm run typecheck

# 4. Format
npm run format

# 5. Lint
npm run lint

# 6. Manual smoke test (1-2 min)
npm run dev:all  # optional

# Then commit
git add .
git commit -m "..."
```

---

## File Locations

| What              | Where                                        |
| ----------------- | -------------------------------------------- |
| Shared components | `client/src/components/shared/`              |
| Hooks             | `client/src/hooks/`                          |
| Services          | `server/src/services/`                       |
| Routes            | `server/src/routes/`                         |
| Adapters          | `server/src/adapters/`                       |
| Tests             | `server/test/` or `client/src/**/__tests__/` |
| Todos             | `todos/NNN-status-title.md`                  |

---

## Common Errors & Fixes

| Error                             | Fix                                                |
| --------------------------------- | -------------------------------------------------- |
| "Anonymous component in DevTools" | Use named function: `memo(function Name() {})`     |
| "Memo not working"                | Check parent isn't passing new object every render |
| "Transaction lock timeout"        | Reduce transaction scope or add timeout            |
| "Type mismatch in tx operation"   | Use `tx.model` not `this.prisma.model`             |
| "Component re-renders too much"   | Add React.memo or useCallback in parent            |
| "Duplicate error display"         | Extract to ErrorAlert shared component             |

---

## Decision Matrix

```
Todo looks important?
├─ YES → Is code already written?
│        ├─ YES → VERIFY (cite evidence, 10 min)
│        └─ NO → Is it < 1 hour?
│                 ├─ YES → QUICK WIN (implement, 30 min)
│                 └─ NO → DEFER (plan scope, 1 hour)
│
└─ NO (P3 / nice-to-have)
   └─ DEFER (schedule for later sprint)
```

---

## Time Budget

| Activity                     | Time                  |
| ---------------------------- | --------------------- |
| Review 8-10 todos            | 15 min                |
| Parallel verification agents | 30 min                |
| Implement 6 quick wins       | 45 min                |
| Testing + manual QA          | 15 min                |
| Batch commit + cleanup       | 5 min                 |
| Update todo files            | 10 min                |
| **Total**                    | **120 min (2 hours)** |

---

## Remember

- **Verify implemented** saves 4+ hours per todo
- **Batch quick wins** in 1 commit, not 10
- **Document deferrals** clearly (scope, deps, estimate)
- **Share components** (DRY principle)
- **Memoize thoughtfully** (not everywhere, only where needed)
- **Use transactions** for read-then-write patterns
- **Test before committing** (no surprises)

---

**Created:** 2025-12-05
**Print & Pin:** Yes
**Review:** After next session
