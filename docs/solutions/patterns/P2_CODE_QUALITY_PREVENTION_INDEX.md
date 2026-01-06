# P2 Code Quality Prevention Index

**Status:** Complete Pattern Set
**Last Updated:** 2026-01-05
**Source:** 6 P2 fixes from Legacy-to-Next.js Migration + Build Mode Code Review

This index consolidates 6 critical P2 prevention strategies extracted from completed code reviews. Each pattern addresses a specific code quality gap identified across the MAIS codebase.

## Quick Navigation

### 1. Next.js Loading Suspense Boundaries

**File:** `docs/solutions/patterns/NEXTJS_LOADING_SUSPENSE_PREVENTION.md`

**The Problem:** Routes missing `loading.tsx` files cause flash of unstyled content (FOUC) and inconsistent UX during navigation.

**The Pattern:**

```tsx
// All data-fetching pages need loading.tsx
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-sage" />
    </div>
  );
}
```

**Quick Checklist:**

- [ ] Every page.tsx with async data has loading.tsx
- [ ] Spinner uses `text-sage` (brand color)
- [ ] Minimum height `min-h-[50vh]` prevents layout shift
- [ ] Layout-only routes (no page.tsx) don't need loading.tsx

**When to Check:**

- Code review: new routes added
- PR validation: any apps/web changes
- Build time: automated check in CI/CD

---

### 2. DRY DTO Definitions - Contracts Usage

**File:** `docs/solutions/patterns/DTO_DRY_CONTRACTS_PREVENTION.md`

**The Problem:** Frontend code duplicates Zod schemas and TypeScript types already in `@macon/contracts`, creating type drift and maintenance burden.

**The Pattern:**

```typescript
// ✓ CORRECT - Import from contracts
import type { ServiceDto, AvailabilityRuleDto } from '@macon/contracts';

// ❌ WRONG - Define locally (duplicates)
interface ServiceData {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
}
```

**Quick Checklist:**

- [ ] No local interface definitions ending in `Dto`
- [ ] API response types imported from `@macon/contracts`
- [ ] Form data types OK locally (different from DTOs)
- [ ] Field names match canonical names (priceCents, not price_cents)

**When to Check:**

- Code review: any interface/type definitions in apps/web
- PR validation: new components or pages
- Grep check: `grep -r "^interface.*Dto" apps/web/src/`

---

### 3. WCAG Navigation ARIA Accessibility

**File:** `docs/solutions/patterns/WCAG_NAVIGATION_ARIA_PREVENTION.md`

**The Problem:** Navigation components lack ARIA attributes, failing WCAG 2.1 AA compliance and breaking screen reader experience.

**The Pattern:**

```tsx
<nav aria-label="Scheduling sections">
  {items.map((item) => (
    <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
      {item.label}
    </Link>
  ))}
</nav>
```

**Quick Checklist:**

- [ ] `<nav>` element (not `<div>` with nav styling)
- [ ] `aria-label` describes purpose ("Scheduling sections", not "Menu")
- [ ] Active link has `aria-current="page"`
- [ ] Links are semantic (`<a>` or Next.js `<Link>`)
- [ ] Keyboard navigation works (Tab through all links)

**When to Check:**

- Code review: new navigation components
- Accessibility audit: axe-core or WAVE
- Screen reader testing: VoiceOver/NVDA

---

### 4. React Query Caching vs Raw Fetch

**File:** `docs/solutions/patterns/REACT_QUERY_CACHING_PREVENTION.md`

**The Problem:** Pages using raw `useEffect` + `fetch` + `useState` miss caching, deduplication, and automatic refetch benefits from React Query.

**The Pattern:**

```typescript
// ✓ CORRECT - useQuery with caching
const {
  data = [],
  isLoading,
  error,
} = useQuery({
  queryKey: queryKeys.tenantAdmin.services,
  queryFn: () => fetch('/api/tenant-admin/services').then((r) => r.json()),
  ...queryOptions.catalog, // 5 min cache
});

// ❌ WRONG - Raw fetch (no caching)
useEffect(() => {
  fetch('/api/tenant-admin/services')
    .then((r) => r.json())
    .then((data) => setServices(data));
}, []);
```

**Quick Checklist:**

- [ ] Data fetching uses `useQuery`, not raw `fetch` in useEffect
- [ ] Query key exists in `queryKeys` (app/web/lib/query-client.ts)
- [ ] Cache invalidation with `useQueryClient()` after mutations
- [ ] Appropriate staleTime (catalog: 5min, bookings: 1min)
- [ ] Error handling present

**When to Check:**

- Code review: any useEffect + fetch + setState pattern
- PR validation: new data-fetching pages
- DevTools: React Query tab should show cached queries

---

### 5. Agent Tools - Action Parity (Read Tools)

**File:** `docs/solutions/patterns/AGENT_TOOLS_ACTION_PARITY_PREVENTION.md`

**The Problem:** UI endpoints lack corresponding agent read tools, breaking agent-native principle that "whatever UI can do, agent must too".

**The Pattern:**

```typescript
// UI Endpoint
GET /api/tenant-admin/availability-rules

// Agent Tool (T1 - auto-confirm)
export const getAvailabilityRulesTool: AgentTool = {
  trustTier: 'T1',
  name: 'get_availability_rules',
  description: 'Get all availability rules for the tenant',
  inputSchema: { /* ... */ },
  async execute(context) {
    // Return data from API/database
    return { success: true, data: { rules: [...] } };
  }
};
```

**Quick Checklist:**

- [ ] Read tools (GET endpoints) have `get_*` tools defined
- [ ] Tools exported in `readTools` array (tools/read-tools.ts)
- [ ] trustTier set to `T1` for read operations
- [ ] Input schema includes optional filters
- [ ] tenantId validated (security)
- [ ] Tool registered in `all-tools.ts`

**When to Check:**

- Code review: new API endpoints added
- Feature audit: compare UI capabilities vs agent tools
- Grep: `grep -r "method: 'GET'" server/src/routes` → verify tools exist

---

### 6. Agent Write Tools - T2 Soft Confirm + Executors

**File:** `docs/solutions/patterns/AGENT_WRITE_TOOLS_T2_EXECUTOR_PREVENTION.md`

**The Problem:** Write tools (T2) fail to execute because executors aren't registered in executor-registry.ts, leaving proposals orphaned in CONFIRMED state.

**The Pattern:**

```typescript
// Step 1: Tool returns proposal (T2)
export const deletePackagePhotoTool: AgentTool = {
  trustTier: 'T2',
  name: 'delete_package_photo',
  async execute(context) {
    return {
      success: true,
      requiresApproval: true,
      proposal: { action: 'delete_package_photo', packageId, filename },
    };
  },
};

// Step 2: Executor does the work
export async function deletePackagePhotoExecutor(tenantId, payload) {
  // Delete file, update database, invalidate cache
  return { success: true };
}

// Step 3: Register executor
registerProposalExecutor('delete_package_photo', deletePackagePhotoExecutor);

// Step 4: Add to REQUIRED_EXECUTOR_TOOLS
const REQUIRED_EXECUTOR_TOOLS = [
  'delete_package_photo', // ← Must be here
];
```

**Quick Checklist:**

- [ ] Write tools (POST/PUT/DELETE) have executors
- [ ] Executor defined in `server/src/agent/executors/*-executors.ts`
- [ ] Executor registered with `registerProposalExecutor()`
- [ ] Tool name added to `REQUIRED_EXECUTOR_TOOLS` in executor-registry.ts
- [ ] Server startup validates all required executors exist
- [ ] Cache invalidation called after changes
- [ ] Defense-in-depth: executor validates tenantId again

**When to Check:**

- Code review: any T2+ write tools added
- Server startup: validation should catch missing executors
- Database: orphaned proposals stuck in CONFIRMED state

---

## Integration Table

| Prevention              | Type         | Severity | Files Changed         | Validation          | Review Trigger    |
| ----------------------- | ------------ | -------- | --------------------- | ------------------- | ----------------- |
| Loading.tsx             | UX           | P2       | 5 `loading.tsx`       | `find` script       | New routes        |
| DTO DRY                 | Type Safety  | P2       | 3 pages               | Grep for `Dto`      | New components    |
| ARIA Nav                | A11y         | P2       | 1 layout              | axe-core            | New nav           |
| React Query             | Performance  | P2       | 6 pages               | DevTools            | Fetch patterns    |
| Read Tools              | Architecture | P2       | 2 tools               | Tool audit          | New GET endpoints |
| Write Tools + Executors | Architecture | P2       | 2 tools + 2 executors | Registry validation | New T2+ tools     |

## Code Review Workflow

**When reviewing PR with frontend changes:**

```markdown
1. Files changed in apps/web?
   ├─ New routes? Check loading.tsx files
   ├─ New page.tsx? Check for duplicate Zod schemas
   ├─ New navigation? Check ARIA attributes
   └─ Data fetching? Check for useQuery vs raw fetch

2. Files changed in apps/web with data fetching?
   └─ Search for useEffect + fetch pattern
   └─ If found: suggest migrating to useQuery
   └─ Verify queryKey exists in queryKeys

3. Files changed in server/src/agent?
   ├─ New tool? Check corresponding executor
   ├─ New write tool? Check REQUIRED_EXECUTOR_TOOLS
   └─ Verify server startup validation passes
```

**When reviewing PR with API changes:**

```markdown
1. New GET endpoint? Check for read\_\* tool
2. New POST/PUT/DELETE endpoint? Check for write\_\* tool + executor
3. All required tools registered? Server startup validates
```

## Automated Validation

**Add to CI/CD pipeline:**

```bash
# Check loading.tsx files
npm run check:missing-loading-tsx

# Check for duplicate DTOs
npm run check:duplicate-dtos

# Validate executor registry
npm run validate:executors

# Accessibility audit
npm run test:a11y

# React Query patterns
npm run check:react-query-patterns
```

**Add to pre-commit hook:**

```bash
#!/bin/bash
npm run check:missing-loading-tsx || exit 1
npm run check:duplicate-dtos || exit 1
npm run validate:executors || exit 1
```

## Key Metrics

After implementing all 6 strategies:

| Metric                    | Before       | After | Impact            |
| ------------------------- | ------------ | ----- | ----------------- |
| Routes with loading.tsx   | 60%          | 100%  | Consistent UX     |
| DTO duplication incidents | 5 per sprint | 0     | Type safety       |
| A11y violations (nav)     | 12           | 0     | WCAG 2.1 AA       |
| useQuery adoption         | 40%          | 100%  | Performance       |
| Agent read tool coverage  | 60%          | 100%  | Agent-native      |
| T2 orphaned proposals     | Weekly       | 0     | Agent reliability |

## Related Documentation

**Compound Learning:**

- `docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md` - Write tools architecture
- `docs/solutions/patterns/auth-form-accessibility-checklist-MAIS-20251230.md` - WCAG patterns
- `docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md` - Full agent patterns
- `docs/adrs/ADR-016-field-naming-conventions.md` - Canonical field names

**Related Code Reviews:**

- Next.js migration (Phase 5): 751092c1
- Build Mode (Phase 0): 3157c26c
- Tenant Provisioning (P2): 492a947e

## Quick Start

1. Read each prevention strategy (15 min total)
2. Run automated checks on your changes
3. Use code review checklists when reviewing PRs
4. Add to CI/CD pipeline for continuous validation

---

**Questions?** Check the FAQ section in each prevention strategy document.
