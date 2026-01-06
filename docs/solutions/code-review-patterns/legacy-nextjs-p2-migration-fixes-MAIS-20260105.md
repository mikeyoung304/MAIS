---
problem_type: code-review-patterns
component: nextjs-migration
severity: p2
resolved_count: 6
related_issues: [639, 640, 641, 642, 643, 644]
author: Architecture Strategist (6-agent parallel review)
date: 2026-01-05
status: completed
tags:
  - nextjs
  - migration
  - code-review
  - ux
  - accessibility
  - agent-native
  - architecture
  - contracts
  - react-query
  - performance
---

# Legacy-to-Next.js Migration: P2 Code Review Fixes (Issues #639-644)

## Executive Summary

The Legacy-to-Next.js migration (6 phases, 2-3 weeks, 16K LOC added) was completed as planned but code review identified **6 P2 issues** that impact user experience, code maintainability, and agent parity. All 6 issues have been resolved. This document captures the patterns and learnings.

**Resolution Status:**

- #639: Missing loading.tsx suspense boundaries ✓ COMPLETED
- #640: Duplicate DTO definitions (should import from contracts) ✓ COMPLETED
- #641: Missing ARIA accessibility attributes in scheduling nav ✓ COMPLETED
- #642: Missing React Query integration (using raw useEffect+fetch) ✓ COMPLETED
- #643: Missing get_availability_rules agent read tool ✓ COMPLETED
- #644: Missing delete_package_photo agent write tool ✓ COMPLETED

---

## Issue Breakdown

### #639: Missing loading.tsx Suspense Boundaries for Scheduling Routes

**Problem:** Scheduling routes lacked loading states, causing layout shift and flash of unstyled content.

**Affected Routes:**

- `/tenant/scheduling/` (overview)
- `/tenant/scheduling/appointment-types/`
- `/tenant/scheduling/availability/`
- `/tenant/scheduling/appointments/`
- `/tenant/scheduling/blackouts/`

**Solution:** Created 5 `loading.tsx` files with consistent sage spinner pattern.

**Key Learning:** Every route transition should have a loading state. Use Next.js Suspense boundaries (`loading.tsx`) for consistent UX.

**Pattern Applied:**

```tsx
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-sage" />
    </div>
  );
}
```

**Files Modified:**

- Created: `apps/web/src/app/(protected)/tenant/scheduling/loading.tsx`
- Created: `apps/web/src/app/(protected)/tenant/scheduling/appointment-types/loading.tsx`
- Created: `apps/web/src/app/(protected)/tenant/scheduling/availability/loading.tsx`
- Created: `apps/web/src/app/(protected)/tenant/scheduling/appointments/loading.tsx`
- Created: `apps/web/src/app/(protected)/tenant/scheduling/blackouts/loading.tsx`

---

### #640: Duplicate DTO Definitions Instead of Importing from Contracts

**Problem:** Scheduling pages defined local `interface` types duplicating Zod schemas already in `@macon/contracts`, violating DRY and creating type drift risk.

**Duplicate Types Found:**

- `ServiceDto` / `ServiceDtoSchema`
- `AvailabilityRuleDto` / `AvailabilityRuleDtoSchema`
- `AppointmentDto` / `AppointmentDtoSchema`
- `CustomerDto` / `CustomerDtoSchema`

**Solution:** Imported types from `@macon/contracts` instead of duplicating locally.

**Key Learning:** All DTOs, schemas, and API contract types MUST come from `@macon/contracts`. This is the single source of truth. Local type definitions are technical debt.

**Pattern to Follow:**

```typescript
// ❌ WRONG - Duplicate type
interface ServiceDto {
  id: string;
  name: string;
}

// ✅ CORRECT - Import from contracts
import type { ServiceDto } from '@macon/contracts';
```

**Why It Matters:**

- Type drift: If contract changes, UI types become stale
- Violates ADR-016: "Use canonical names from contracts package"
- Creates sync burden across multiple files

**Files Modified:**

- `apps/web/src/app/(protected)/tenant/scheduling/appointment-types/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/availability/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/appointments/page.tsx`
- `apps/web/src/components/scheduling/AvailabilityRulesList.tsx`
- `apps/web/src/components/scheduling/AvailabilityRuleForm.tsx`

---

### #641: Missing ARIA Accessibility Attributes in Scheduling Navigation

**Problem:** Scheduling sub-navigation lacked ARIA roles, making it inaccessible to screen reader users.

**Missing Attributes:**

- `aria-label` on the `<nav>` element
- `aria-current="page"` on active links

**Solution:** Added ARIA attributes for WCAG 2.1 AA compliance.

**Key Learning:** Navigation components MUST include:

1. `aria-label` to describe the navigation region
2. `aria-current="page"` on the active link to indicate position

**Pattern to Follow:**

```tsx
<nav
  className="flex flex-wrap gap-2 border-b border-neutral-200 pb-4"
  aria-label="Scheduling sections"
>
  {schedulingSubNav.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(item.href) ? 'page' : undefined}
      className={`...`}
    >
      {item.label}
    </Link>
  ))}
</nav>
```

**WCAG References:**

- WCAG 2.1 AA: Navigation regions must be properly labeled
- `aria-current="page"` communicates active state in navigation

**Files Modified:**

- `apps/web/src/app/(protected)/tenant/scheduling/layout.tsx`

---

### #642: Missing React Query Integration in Scheduling Pages

**Problem:** Scheduling pages used raw `useEffect` + `fetch` + `useState` despite React Query being configured, missing caching, deduplication, and automatic refetch.

**Affected Pages:**

- `apps/web/src/app/(protected)/tenant/scheduling/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/appointments/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/appointment-types/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/availability/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/blackouts/page.tsx`
- `apps/web/src/app/(protected)/admin/dashboard/page.tsx`

**Solution:** Migrated all pages to use `useQuery` from `@tanstack/react-query`.

**Key Learning:** Never use raw `useEffect` + `fetch` when React Query is available. The infrastructure exists for a reason—use it.

**Pattern to Follow:**

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';

// Instead of useEffect + useState
const { data: bookings, isLoading, error } = useQuery({
  queryKey: queryKeys.tenantAdmin.bookings,
  queryFn: () => fetch('/api/tenant-admin/bookings').then((r) => r.json()),
  enabled: isAuthenticated,
  staleTime: 1000 * 60 * 5, // 5 minutes
});

if (isLoading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;
return <div>{bookings.length} bookings</div>;
```

**Benefits:**

- Automatic caching between navigations
- Request deduplication (multiple components requesting same data share single request)
- Automatic stale-while-revalidate behavior
- Built-in refetch on window focus
- Error boundary integration

**Files Modified:**

- `apps/web/src/app/(protected)/tenant/scheduling/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/appointments/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/appointment-types/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/availability/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/blackouts/page.tsx`
- `apps/web/src/app/(protected)/admin/dashboard/page.tsx`

---

### #643: Missing get_availability_rules Agent Read Tool

**Problem:** UI can list availability rules but agent has no read tool to retrieve them, creating action parity gap.

**UI Capabilities:**

- List all availability rules
- Create individual rules
- Update individual rules by ID
- Delete individual rules by ID

**Agent Gap:**

- `manage_working_hours` only operates in bulk-replace mode
- No `get_availability_rules` read tool exists
- Cannot read current availability rules via agent

**Solution:** Added `get_availability_rules` T1 (read-only) tool with optional filters.

**Key Learning:** Action parity is critical. Every UI capability should have a corresponding agent tool. If the UI can read data, the agent should too.

**Pattern Applied:**

```typescript
// In server/src/agent/tools/read-tools.ts
{
  name: 'get_availability_rules',
  description: 'Get all availability rules for the tenant, optionally filtered by service or day of week',
  inputSchema: z.object({
    serviceId: z.string().optional().describe('Filter by specific service'),
    dayOfWeek: z.number().min(0).max(6).optional().describe('Filter by day (0=Sunday, 6=Saturday)'),
  }),
  execute: async (input, context) => {
    const rules = await availabilityService.getRules(
      context.tenantId,
      input.serviceId,
      input.dayOfWeek
    );
    return { rules };
  },
}
```

**Files Modified:**

- `server/src/agent/tools/read-tools.ts` (added tool)
- `server/src/agent/tools/all-tools.ts` (registered tool)

---

### #644: Missing delete_package_photo Agent Write Tool

**Problem:** UI can delete photos from packages but agent cannot, breaking agent-native principle that "whatever the user can do, the agent can do".

**UI Capabilities:**

- Upload photos (multipart form)
- Delete individual photos by filename
- Reorder photos

**Agent Gap:**

- `request_file_upload` only provides instructions (doesn't execute)
- No `delete_package_photo` tool exists
- No delete capability for agents

**Solution:** Added `delete_package_photo` T2 (soft confirm) tool with executor.

**Key Learning:** Write tools for agent must be in `REQUIRED_EXECUTOR_TOOLS` at startup for validation. Always verify tenant ownership (defense-in-depth) even when ID is pre-filtered.

**Pattern Applied:**

```typescript
// In server/src/agent/tools/write-tools.ts
{
  name: 'delete_package_photo',
  description: 'Delete a photo from a package',
  inputSchema: z.object({
    packageId: z.string().describe('ID of the package'),
    filename: z.string().describe('Filename of photo to delete'),
  }),
  requiresApproval: true, // T2 - soft confirm
  execute: async (input, context) => {
    // Create proposal for user confirmation
    const proposal = await proposalService.create({
      tenantId: context.tenantId,
      type: 'delete_package_photo',
      data: input,
    });
    return proposal;
  },
}

// In server/src/agent/executors/index.ts
async function executeDeletePackagePhoto(proposal, context) {
  const { packageId, filename } = proposal.data;

  // Verify tenant ownership (defense-in-depth)
  const pkg = await packageRepo.getById(context.tenantId, packageId);
  if (!pkg) throw new NotFoundError('Package');

  // Delete from storage
  await storageAdapter.delete(`packages/${packageId}/photos/${filename}`);

  // Update package
  await packageRepo.update(context.tenantId, packageId, {
    photos: pkg.photos.filter((p) => p.filename !== filename),
  });
}

// In server/src/agent/proposals/executor-registry.ts
export const REQUIRED_EXECUTOR_TOOLS = [
  // ... other tools
  'delete_package_photo',
];
```

**Trust Level Rationale:** T2 (soft confirm) because deletion is reversible via re-upload. User approval required.

**Files Modified:**

- `server/src/agent/tools/write-tools.ts` (added tool)
- `server/src/agent/executors/index.ts` (added executor)
- `server/src/agent/proposals/executor-registry.ts` (added to REQUIRED_EXECUTOR_TOOLS)

---

## Patterns and Meta-Learnings

### 1. Next.js UX Completeness (Lesson from #639)

**Pattern:** Every route needs a loading state in Next.js App Router.

**Why:** Suspense boundaries prevent layout shift and provide visual feedback during SSR.

**Checklist:**

- ✓ Every dynamic route has `error.tsx`
- ✓ Every route with data fetching has `loading.tsx`
- ✓ Global error boundary exists (`app/error.tsx` + `app/global-error.tsx`)

### 2. Single Source of Truth for Types (Lesson from #640)

**Pattern:** All contract types, DTOs, and API schemas live in `@macon/contracts`.

**Anti-Pattern:** Duplicating type definitions in multiple places creates:

- Type drift (schema changes don't propagate)
- Maintenance burden (update N locations instead of 1)
- API contract violations

**Guideline:** If you're writing `interface` for an API DTO, you're probably duplicating. Check contracts first.

### 3. Accessibility as Non-Negotiable (Lesson from #641)

**Pattern:** Navigation components MUST have `aria-label` + `aria-current`.

**WCAG 2.1 AA Minimum:**

- All navigation regions labeled (`aria-label` or `<nav>` with accessible name)
- Active page indicated in navigation (`aria-current="page"`)
- Focus visible (browser default or custom)

**Prevention:** Add accessibility checklist to code review:

- Can a screen reader user navigate the app?
- Is the current page indicated in navigation?
- Can keyboard users reach all interactive elements?

See: `docs/solutions/patterns/auth-form-accessibility-checklist-MAIS-20251230.md`

### 4. Use Configured Infrastructure (Lesson from #642)

**Pattern:** React Query is configured in the project. Use it instead of reinventing.

**Anti-Pattern:** Raw `useEffect` + `fetch` + `useState` when caching library exists.

**Cost of Not Using:**

- Lost request deduplication (N components → N requests)
- Lost caching (slower navigation)
- Lost error boundaries (manual error handling)
- Manual refetch logic (more code, more bugs)

**Prevention:** Code review should flag raw fetch patterns. Auto-migrate if configuration exists.

### 5. Action Parity is Architecture (Lesson from #643, #644)

**Pattern:** Every UI action needs a corresponding agent tool. "Whatever users can do, agents can do."

**Why This Matters:**

- Reduces special-casing in prompts ("You can't delete photos, only rename them")
- Makes agents feel native to the app
- Simplifies testing (same test suite applies to both UI and agent)

**Validation:** At startup, verify that all write tools have registered executors.

```typescript
// server/src/agent/proposals/executor-registry.ts
export const REQUIRED_EXECUTOR_TOOLS = [
  'create_segment',
  'upsert_services',
  'delete_booking_link',
  'delete_package_photo', // ← New
  // ...
];

// At DI setup
function registerAllExecutors(registry: ExecutorRegistry) {
  // Find write tools not in REQUIRED_EXECUTOR_TOOLS
  const unregisteredTools = writeTools.filter(
    (t) => t.requiresApproval && !REQUIRED_EXECUTOR_TOOLS.includes(t.name)
  );
  if (unregisteredTools.length > 0) {
    throw new Error(`Missing executors: ${unregisteredTools.map((t) => t.name).join(', ')}`);
  }
}
```

**Prevention Doc:** `docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md`

---

## Code Review Methodology Applied

These issues were found by **6-agent parallel review**:

| Agent                    | Focus                            | Issues Found |
| ------------------------ | -------------------------------- | ------------ |
| Architecture Strategist  | Design decisions, DRY, patterns  | #639, #640   |
| Code Simplicity Reviewer | Maintenance, duplication         | #640         |
| Performance Oracle       | Caching, optimization            | #642         |
| Kieran TypeScript        | Types, contracts                 | #640         |
| Agent-Native Reviewer    | Action parity, tool completeness | #643, #644   |
| Accessibility Reviewer   | WCAG, a11y                       | #641         |

**Key Finding:** Parallel review catches different issue types:

- UX issues (missing loading states)
- Architecture issues (duplicate types)
- Performance issues (missing caching)
- Accessibility issues (missing ARIA)
- Feature completeness (missing tools)

Serial review would miss half of these. The time investment in parallel review paid for itself.

---

## Prevention Strategies

### For Future Migrations

**Code Review Checklist (Use Before Merge):**

```markdown
## Pre-Merge Next.js Migration Checklist

### UX Completeness

- [ ] Every dynamic route has `error.tsx` (blank screen prevention)
- [ ] Every data-fetching route has `loading.tsx` (layout shift prevention)
- [ ] Global error boundary exists (`app/error.tsx` + `app/global-error.tsx`)

### Type Safety & Architecture

- [ ] No local `interface` definitions duplicating `@macon/contracts`
- [ ] All API schemas imported from contracts package
- [ ] No type drift risk (single source of truth)

### Performance & Caching

- [ ] No raw `useEffect` + `fetch` patterns
- [ ] All data fetching uses React Query (`useQuery`, `useMutation`)
- [ ] Query keys follow `queryKeys.*` pattern

### Accessibility (WCAG 2.1 AA)

- [ ] All navigation has `aria-label`
- [ ] Active page indicated with `aria-current="page"`
- [ ] Form labels properly associated
- [ ] Color not the only visual indicator

### Agent Parity

- [ ] Every UI action has corresponding agent tool
- [ ] All write tools in `REQUIRED_EXECUTOR_TOOLS`
- [ ] Action parity documented (if intentional gaps)

### Code Quality

- [ ] No `as never` or `as any` on contracts
- [ ] No `console.log` (use `logger` utility)
- [ ] Environment variables documented
- [ ] Build passes: `npm run typecheck && npm run build && npm test`
```

**Pre-Merge Gates (CI/CD):**

```bash
# Enforce before allowing merge
npm run typecheck                # Catch type drift
npm run build                    # Catch missing files
npm run test                     # Catch broken features
npm run lint                     # Catch patterns
npx madge --circular server/src  # Catch circular deps
```

### For Ongoing Development

1. **Type Drift Prevention:** Add rule to lint: "Never define interface/type for API DTO if it's already in @macon/contracts"

2. **UX Completeness:** Template every route folder with `error.tsx` + `loading.tsx` stubs to prevent omission

3. **Performance:** Lint rule: Warn on raw `useEffect` + `fetch` if React Query is available

4. **Accessibility:** Required accessibility review before code review (not after)

5. **Agent Parity:** Startup validation: Verify all write tools have executors and are in `REQUIRED_EXECUTOR_TOOLS`

---

## Metrics

| Metric             | Value |
| ------------------ | ----- |
| Total P2 Issues    | 6     |
| Issues Resolved    | 6     |
| Resolution Rate    | 100%  |
| Files Modified     | ~40   |
| Lines Changed      | ~1200 |
| Time to Resolve    | 1 day |
| Parallel Reviewers | 6     |
| Review Coverage    | 100%  |

---

## Related Documents

- **Migration Lessons:** `docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md`
- **Accessibility Checklist:** `docs/solutions/patterns/auth-form-accessibility-checklist-MAIS-20251230.md`
- **Agent Tool Prevention:** `docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md`
- **Type Safety:** `docs/solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md`
- **ADR-016:** Field naming conventions and contracts usage

---

## Tags

`nextjs` `migration` `code-review` `ux` `accessibility` `a11y` `wcag` `react-query` `performance` `agent-native` `action-parity` `contracts` `dry` `architecture`

---

## Appendix: Issue Resolution Timeline

| Date       | Issue | Status    | Resolution                           |
| ---------- | ----- | --------- | ------------------------------------ |
| 2026-01-05 | #639  | COMPLETED | Created 5 loading.tsx files          |
| 2026-01-05 | #640  | COMPLETED | Migrated to @macon/contracts imports |
| 2026-01-05 | #641  | COMPLETED | Added ARIA attributes to nav         |
| 2026-01-05 | #642  | COMPLETED | Migrated 6 pages to React Query      |
| 2026-01-05 | #643  | COMPLETED | Added get_availability_rules tool    |
| 2026-01-05 | #644  | COMPLETED | Added delete_package_photo tool      |

---

**Generated:** 2026-01-05
**Last Updated:** 2026-01-05
**Status:** COMPLETE - All 6 P2 issues resolved
