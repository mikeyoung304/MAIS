# P2 Code Quality - Quick Reference (Print & Pin)

**Source:** 6 P2 fixes from Legacy-to-Next.js Migration (Commit 751092c1)
**Last Updated:** 2026-01-05
**Reading Time:** 2 minutes

---

## 1. Loading States (loading.tsx)

| Check                           | Pattern           | Reference                             |
| ------------------------------- | ----------------- | ------------------------------------- |
| Every page.tsx with async data? | Has `loading.tsx` | NEXTJS_LOADING_SUSPENSE_PREVENTION.md |
| Spinner color                   | `text-sage`       | Line 6 in pattern                     |
| Min height                      | `min-h-[50vh]`    | Prevents layout shift                 |

**Quick Fix:**

```tsx
// apps/web/src/app/(protected)/tenant/[feature]/loading.tsx
import { Loader2 } from 'lucide-react';
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-sage" />
    </div>
  );
}
```

---

## 2. DTO Types (Use @macon/contracts)

| Check                   | Action                                               | Reference                       |
| ----------------------- | ---------------------------------------------------- | ------------------------------- |
| Local `interface.*Dto`? | Delete it, import from contracts                     | DTO_DRY_CONTRACTS_PREVENTION.md |
| `ServiceDto` needed?    | `import type { ServiceDto } from '@macon/contracts'` | contracts/src/dto.ts            |
| Field names             | Use canonical: `priceCents`, not `price_cents`       | ADR-016                         |

**Quick Fix:**

```typescript
// ❌ DELETE THIS
interface ServiceDto {
  id: string;
  name: string;
  priceCents: number;
}

// ✓ USE THIS INSTEAD
import type { ServiceDto } from '@macon/contracts';

// ✓ OK TO DEFINE (form data, not DTO)
interface ServiceFormData {
  priceCents: string; // String from form input
}
```

---

## 3. Navigation ARIA (A11y)

| Check         | Pattern                                 | Reference                          |
| ------------- | --------------------------------------- | ---------------------------------- |
| `<nav>` tag?  | Not `<div>`                             | WCAG_NAVIGATION_ARIA_PREVENTION.md |
| `aria-label`? | Descriptive text: "Scheduling sections" | Required for WCAG AA               |
| Active link?  | Add `aria-current="page"`               | One per navigation                 |

**Quick Fix:**

```tsx
<nav aria-label="Scheduling sections">
  {items.map((item) => (
    <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
      {item.label}
    </Link>
  ))}
</nav>
```

---

## 4. Data Fetching (React Query)

| Check                    | Pattern                                  | Reference                         |
| ------------------------ | ---------------------------------------- | --------------------------------- |
| Raw `useEffect + fetch`? | Migrate to `useQuery`                    | REACT_QUERY_CACHING_PREVENTION.md |
| Query key defined?       | Check `queryKeys` in lib/query-client.ts | catalog/bookings/realtime         |
| After mutation?          | Call `queryClient.invalidateQueries()`   | Cache invalidation                |

**Quick Fix:**

```typescript
// ❌ WRONG
useEffect(() => {
  fetch('/api/..')
    .then((r) => r.json())
    .then(setData);
}, []);

// ✓ CORRECT
const { data } = useQuery({
  queryKey: queryKeys.tenantAdmin.services,
  queryFn: () => fetch('/api/..').then((r) => r.json()),
  ...queryOptions.catalog,
});
```

---

## 5. Read Tools (Agent)

| Check             | Pattern                  | Reference                               |
| ----------------- | ------------------------ | --------------------------------------- |
| New GET endpoint? | Create `get_*` tool      | AGENT_TOOLS_ACTION_PARITY_PREVENTION.md |
| Tool trustTier?   | `T1` (read-only)         | Auto-confirms, no executor needed       |
| Export?           | Add to `readTools` array | tools/read-tools.ts                     |

**Quick Fix:**

```typescript
// server/src/agent/tools/read-tools.ts
export const getAvailabilityRulesTool: AgentTool = {
  trustTier: 'T1',
  name: 'get_availability_rules',
  // ... rest of tool definition
};

export const readTools = [
  getTenantTool,
  getAvailabilityRulesTool, // ← Add here
];
```

---

## 6. Write Tools + Executors (Agent)

| Check                    | Pattern                            | Reference                                   |
| ------------------------ | ---------------------------------- | ------------------------------------------- |
| New POST/PUT/DELETE?     | Create `*_*` tool + executor       | AGENT_WRITE_TOOLS_T2_EXECUTOR_PREVENTION.md |
| Tool trustTier?          | `T2` (soft confirm)                | User sees proposal                          |
| Executor?                | Must register in executor-registry | registerProposalExecutor()                  |
| REQUIRED_EXECUTOR_TOOLS? | Add tool name                      | Validates at startup                        |

**Quick Fix:**

```typescript
// Step 1: Tool returns proposal
export const deletePhotoTool: AgentTool = {
  trustTier: 'T2',
  name: 'delete_package_photo',
  async execute(context) {
    return {
      success: true,
      requiresApproval: true,
      proposal: { action: 'delete_package_photo', ... }
    };
  }
};

// Step 2: Executor does the work
export async function deletePhotoExecutor(tenantId, payload) {
  // Delete file, update DB, invalidate cache
  return { success: true };
}

// Step 3: Register
registerProposalExecutor('delete_package_photo', deletePhotoExecutor);

// Step 4: Add to REQUIRED list
const REQUIRED_EXECUTOR_TOOLS = ['delete_package_photo'];
```

---

## Code Review Checklist

**Frontend PR:**

- [ ] New page.tsx? Has loading.tsx? `min-h-[50vh]`, `text-sage`
- [ ] New interfaces ending in `Dto`? Delete them, import from contracts
- [ ] New navigation? Has `aria-label` and `aria-current="page"`
- [ ] Data fetch? Uses `useQuery`, not raw `fetch`

**Backend PR (Agent):**

- [ ] New read endpoint? Has `get_*` tool in readTools?
- [ ] New write endpoint? Has executor + registered in executor-registry?
- [ ] New tool? Added to REQUIRED_EXECUTOR_TOOLS?

---

## Automated Checks

```bash
# Before committing
npm run check:missing-loading-tsx    # loading.tsx files
npm run check:duplicate-dtos         # DTO imports
npm run validate:executors           # Agent executors
npm run test:a11y                    # WCAG violations
```

---

## Where to Find Full Details

| Topic          | Document                                      |
| -------------- | --------------------------------------------- |
| Loading states | `NEXTJS_LOADING_SUSPENSE_PREVENTION.md`       |
| DTOs           | `DTO_DRY_CONTRACTS_PREVENTION.md`             |
| ARIA/A11y      | `WCAG_NAVIGATION_ARIA_PREVENTION.md`          |
| React Query    | `REACT_QUERY_CACHING_PREVENTION.md`           |
| Read tools     | `AGENT_TOOLS_ACTION_PARITY_PREVENTION.md`     |
| Write tools    | `AGENT_WRITE_TOOLS_T2_EXECUTOR_PREVENTION.md` |
| Master index   | `P2_CODE_QUALITY_PREVENTION_INDEX.md`         |

---

## Key Stats

- **6 patterns** to prevent code quality issues
- **100 lines of checklist items** for code reviews
- **0 P2 violations** when patterns followed
- **2-minute read** for quick reference

---

**Print this page. Pin it to your desk. Reference during code review.**

💡 **Rule of Thumb:** If it compiles but feels incomplete, check this list.
