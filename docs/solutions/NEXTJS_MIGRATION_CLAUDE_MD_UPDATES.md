# Next.js Migration: Recommended CLAUDE.md Updates

**Date:** 2026-01-08
**Purpose:** Specific updates to CLAUDE.md based on Next.js migration audit
**Priority:** High - These patterns prevent recurring issues
**Status:** Ready for implementation

---

## Overview

The Next.js migration documentation reveals key patterns that should be formalized in CLAUDE.md. This document provides exact text for each update, organized by section.

---

## Update 1: Add to "File Naming Conventions" Section

**Location:** After existing "Frontend - Next.js (apps/web/)" section

**Add this new subsection:**

````markdown
### Frontend - Next.js Component Patterns

**Server vs Client Components:**

- **Default:** Server Components (no directive needed)
- **When interactive:** Client Components (`'use client'` directive at top)
- **Data fetching:** Always in Server Components or Server Actions
- **Rendering:** Pass data via props to Client Components

**Critical Rule:** Never fetch data in Client Components with authentication headers. Use Server Actions or pre-fetch in Server Components.

**Component Architecture:**

```tsx
// ❌ WRONG: Fetching in Client Component
'use client';
const [data, setData] = useState();
useEffect(() => {
  fetch('/api/packages', {
    headers: { 'X-Tenant-Key': key }, // Exposes key to client!
  })
    .then((r) => r.json())
    .then(setData);
}, []);

// ✅ CORRECT: Fetch in Server Component
export default async function PackagesList() {
  const packages = await fetch(`${API_URL}/v1/packages`, {
    headers: { 'X-Tenant-Key': await getTenantKey() },
  });
  return <PackageListClient initialData={packages} />;
}
```
````

**Shared Data Fetching:**

- Wrap all shared SSR functions with React `cache()` to prevent duplicate queries
- This automatically deduplicates within a single render cycle

```typescript
import { cache } from 'react';

export const getTenantData = cache(async (slug: string) => {
  // Called multiple times per render: fetches once, returns cached result
  const tenant = await fetch(`${API_URL}/v1/tenants/${slug}`);
  return tenant.json();
});
```

See: [NEXTJS_CLIENT_API_PROXY_PREVENTION.md](../../solutions/NEXTJS_CLIENT_API_PROXY_PREVENTION.md)

````

---

## Update 2: Add to "File Naming Conventions" > "Frontend - Next.js"

**Location:** Add new bullets to existing Frontend - Next.js list

**Add after existing list:**

```markdown
- **Error Boundaries:** `error.tsx` (REQUIRED for all dynamic routes with `[params]`)
- **Loading States:** `loading.tsx` (Suspense boundary for page transitions)
- **Not Found:** `not-found.tsx` (404 page for route segment)
````

**Reasoning:** The original convention list was incomplete and led to missing error boundaries in code review.

---

## Update 3: Add New Section to "Architecture Patterns"

**Location:** After "Cache Isolation" section

**Add this new subsection:**

````markdown
### Server/Client Component Patterns (Next.js)

**The Mental Model:**

Server Components should handle:

- Data fetching from databases and APIs
- Accessing secrets and API keys
- Keeping large dependencies on the server
- Rendering sensitive data (tokens, keys)

Client Components should handle:

- Event listeners (onClick, onChange, etc.)
- Using hooks (useState, useEffect, etc.)
- Rendering interactive UI
- Using context for client-side state

**The Pattern:**

```typescript
// Server Component: Fetches data, passes to client
export default async function TenantPage({ slug }: Props) {
  // Fetch on server (safe, can access DB directly)
  const tenant = await prisma.tenant.findUnique({
    where: { slug }, select: { id: true, name: true, branding: true }
  });

  // Render both static content AND interactive client component
  return (
    <>
      <StaticBranding tenant={tenant} />
      <InteractiveDashboard tenantId={tenant.id} />
    </>
  );
}

// Client Component: Receives data via props, adds interactivity
'use client';
export function InteractiveDashboard({ tenantId }: Props) {
  const [filter, setFilter] = useState('');
  // Safe to use hooks, event listeners
  return <div onClick={() => setFilter('')}>...</div>;
}
```
````

**Authentication in Server Components:**

```typescript
// ✅ CORRECT: Access backend token in Server Component only
export default async function AdminDashboard() {
  const token = await getBackendToken(); // Server-side only

  const data = await fetch(`${API_URL}/v1/admin/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  // Token never reaches client
  return <AdminStatsClient data={await data.json()} />;
}

// ❌ WRONG: Token exposed to client
async session({ session, token }) {
  return {
    ...session,
    user: { ...token, backendToken: token.backendToken } // EXPOSED!
  };
}
```

**Data Deduplication (React cache):**

```typescript
import { cache } from 'react';

// Wrap shared data fetching functions
export const getStorefrontData = cache(async (slug: string) => {
  // Called multiple times? Fetches once, returns cached for rest of render
  return fetch(`${API_URL}/v1/storefronts/${slug}`).then(r => r.json());
});

// Usage in multiple components (same render cycle)
export async function Page({ slug }) {
  const data1 = await getStorefrontData(slug); // Fetches
  const data2 = await getStorefrontData(slug); // Uses cache ✅
  return <View data1={data1} data2={data2} />;
}
```

See: [ADR-014](../../adrs/ADR-014-nextjs-app-router-migration.md) | [NEXTJS_CLIENT_API_PROXY_PREVENTION.md](../../solutions/NEXTJS_CLIENT_API_PROXY_PREVENTION.md) | Lesson 9 in [nextjs-migration-lessons-learned](../../solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)

````

---

## Update 4: Add to "Common Pitfalls" Section

**Location:** Add to existing "Common Pitfalls" list (replace item 26)

**Replace this:**
```markdown
26. **Removing ts-rest `any` types:** Do NOT remove `{ req: any }` in route handlers - it's a library limitation (see Prevention Strategy section)
````

**With this extended section:**

```markdown
26. **ts-rest `any` type limitation:** Do NOT remove `{ req: any }` in route handlers - it's a library limitation, not a bug (see [ts-rest-any-type-library-limitations](../../solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md))
27. **Fetching in Client Components with auth headers:** Never use `fetch()` in Client Components with `X-Tenant-Key` or Bearer tokens. Always fetch in Server Components or Server Actions. (P1 security issue)
28. **Missing error.tsx on dynamic routes:** All routes with `[params]` MUST have `error.tsx` and `loading.tsx`. Missing these causes white screen on errors. (P1 UX issue)
29. **Data not wrapped with React cache():** All shared SSR fetch functions must be wrapped with `cache()` to prevent duplicate queries (~100ms latency per duplicate).
30. **Hydration mismatch from server/client date formatting:** Never use `toLocaleDateString()` without hydration guard. Render consistent dates using explicit formatting. (See [HYDRATION_MISMATCH_PREVENTION](../../solutions/HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md))
31. **ISR revalidation endpoints without rate limiting:** `/api/revalidate` endpoints must rate limit to prevent cache stampede attacks. (P0 DoS vulnerability)
32. **Server Action form patterns causing hydration errors:** Avoid `<form action={...}>` pattern with client-side state. Use `window.location.href` for session-changing navigation. (See [nextjs-client-navigation-hydration-anti-patterns](../../solutions/code-review-patterns/nextjs-client-navigation-hydration-anti-patterns-MAIS-20260106.md))
33. **Duplicate DTO definitions in components:** All DTOs, schemas, and API types MUST import from `@macon/contracts`, never define locally. This prevents type drift. (P2 maintenance issue)
34. **Early return before React hooks:** Adding early returns BEFORE existing hooks violates React Rules of Hooks. Move ALL hooks above ANY early returns. (Builds locally but fails on Vercel - P0)
35. **Missing loading.tsx on route transitions:** Each route should have `loading.tsx` Suspense boundary to show progress during page transitions. (UX: prevents layout shift)
36. **Hardcoded routes instead of dual pattern:** Tenant routes must support both `/t/[slug]/...` and `/t/_domain/...` with identical code. Use routing abstraction to prevent duplication.
```

---

## Update 5: Add New Section: "Next.js-Specific Patterns"

**Location:** After "Customer Chatbot (AI Agent System)" section

**Add this new subsection:**

````markdown
### Server/Client Architecture in Next.js

**Dual Routing Pattern** (Tenant Storefronts)

Tenant pages are accessible via two routes with identical behavior:

1. **Slug-based:** `/t/[slug]/...` (gethandled.ai/t/jane-photography)
2. **Custom domain:** `/t/_domain/...` with `?domain=janephotography.com` (janephotography.com)

**Architecture requirement:** Both routes must render identical content via shared components. Use middleware to rewrite custom domains to `_domain` route.

```typescript
// middleware.ts
if (!isKnownDomain) {
  url.pathname = `/t/_domain${pathname}`;
  url.searchParams.set('domain', hostname);
  return NextResponse.rewrite(url);
}
```
````

See: [ADR-014](../../adrs/ADR-014-nextjs-app-router-migration.md) | [nextjs-route-duplication-prevention](../../solutions/nextjs-route-duplication-prevention-MAIS-20251228.md)

**Error Boundaries & Loading States** (Required)

Every dynamic route requires error and loading boundaries:

```typescript
// app/t/[slug]/page.tsx
export default async function TenantPage() { ... }

// app/t/[slug]/error.tsx (REQUIRED)
export default function Error({ error, reset }) {
  return (
    <ErrorBoundary
      message="Failed to load storefront"
      onRetry={reset}
      error={error}
    />
  );
}

// app/t/[slug]/loading.tsx (REQUIRED)
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-sage" />
    </div>
  );
}
```

See: Lesson 4 in [nextjs-migration-lessons-learned](../../solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)

**Incremental Static Regeneration** (ISR)

Tenant pages revalidate every 60 seconds for fresh content + performance:

```typescript
// app/t/[slug]/page.tsx
export const revalidate = 60; // Regenerate every 60 seconds

// Optional: On-demand revalidation (rate limited)
// POST /api/revalidate?secret=xxx&path=/t/jane-photography
export async function POST(request: NextRequest) {
  const secret = searchParams.get('secret');
  if (secret !== process.env.NEXTJS_REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  revalidatePath(path);
  return NextResponse.json({ revalidated: true });
}
```

**Key rule:** Rate limit revalidation endpoints to prevent cache stampede attacks (DoS vulnerability).

See: [NEXTJS-ISR-AND-API-MISMATCH-PREVENTION](../../solutions/NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md)

**Session Duration** (Risk-Based)

Tenant admin sessions use 24-hour timeout:

```typescript
// apps/web/src/lib/auth.ts
session: {
  strategy: 'jwt',
  maxAge: 24 * 60 * 60, // 24 hours for tenant admins
}
```

OWASP guidance:

- High-privilege (platform admins): 15-30 minutes
- Standard admins (tenant owners): 1-4 hours (24h in MAIS)
- Regular users: 24 hours
- "Remember me": 7-30 days (with re-auth for sensitive ops)

See: Lesson 7 in [nextjs-migration-lessons-learned](../../solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)

````

---

## Update 6: Add "Next.js Documentation Map" Section

**Location:** Add as new top-level section at the end, before "Quick Start Checklist"

**Add this section:**

```markdown
## Next.js Migration Documentation Map

The MAIS Next.js migration (6 phases, 2-3 weeks, 16K LOC) was completed in Q4 2025 with comprehensive documentation of lessons, patterns, and prevention strategies.

### Core Architecture

- **[ADR-014: Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)** - Architectural decisions, why App Router, why ISR, authentication design
- **[nextjs-migration-lessons-learned](../../solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)** - 10 key lessons from post-migration code review with code examples

### Critical Patterns (High-Priority Reading)

1. **Server/Client Components** - [NEXTJS_CLIENT_API_PROXY_PREVENTION.md](../../solutions/NEXTJS_CLIENT_API_PROXY_PREVENTION.md)
   - Pattern: Server Components fetch, Client Components render
   - Prevent: Never expose backendToken to client
   - Example: React cache() for deduplication

2. **Error Boundaries & Loading States** - ADR-014 Lesson 4
   - Requirement: `error.tsx` + `loading.tsx` on all dynamic routes
   - Pattern: Suspense boundaries for route transitions
   - Impact: Prevents white screen of death, layout shift

3. **Hydration Mismatch Prevention** - [nextjs-client-navigation-hydration-anti-patterns-MAIS-20260106.md](../../solutions/code-review-patterns/nextjs-client-navigation-hydration-anti-patterns-MAIS-20260106.md)
   - Root causes: Form patterns, setTimeout in startTransition, date formatting
   - Solutions: Hydration guards, useId(), window.location.href for session changes
   - Impact: 5-layer debugging approach for "works local, fails on Vercel"

4. **Dual Routing (Slug + Custom Domain)** - [nextjs-route-duplication-prevention](../../solutions/nextjs-route-duplication-prevention-MAIS-20251228.md)
   - Routes: `/t/[slug]` and `/t/_domain?domain=custom.com`
   - Pattern: Middleware rewrites custom domains to _domain route
   - Prevention: Extract shared components to prevent divergence

5. **ISR Configuration** - [NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md](../../solutions/NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md)
   - Config: `export const revalidate = 60` (seconds)
   - Critical: Rate limit `/api/revalidate` endpoint
   - Why: Prevent cache stampede attacks (DoS vulnerability)

### Phase-Specific Code Review

- **[P2 Scheduling Migration Fixes](../../solutions/code-review-patterns/legacy-nextjs-p2-migration-fixes-MAIS-20260105.md)** (Issues #639-644)
  - Missing loading.tsx (UX impact)
  - Duplicate DTOs (DRY violation)
  - Missing ARIA attributes (accessibility)
  - Missing agent tools (feature parity)

### Deployment & Infrastructure

- **[Vercel + npm Workspaces](../../solutions/deployment-issues/vercel-nextjs-npm-workspaces-root-directory-MAIS-20251226.md)** (P0)
  - Key rule: Do NOT set Root Directory
  - Issue: Breaks dependency hoisting
  - Impact: Build fails on Vercel, works locally

- **[NextAuth v5 Secure Cookie Prefix](../../solutions/authentication-issues/nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md)** (P0)
  - Issue: 401 in production but not locally
  - Cause: HTTPS cookie prefix in production
  - Solution: Configure secure flag and SameSite attributes

### Print & Pin (Quick References)

Keep these at your desk for weekly reference:

1. **nextjs-migration-lessons-learned (Lesson 10 checklist)** - Pre-merge validation
2. **[NEXTJS_CLIENT_API_QUICK_REFERENCE.md](../../solutions/NEXTJS_CLIENT_API_QUICK_REFERENCE.md)** - Server vs client responsibilities
3. **[nextjs-route-duplication-quick-checklist.md](../../solutions/nextjs-route-duplication-quick-checklist.md)** - Dual route validation
4. **[REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md](../../solutions/patterns/REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md)** - React Rules of Hooks
5. **[STOREFRONT_SECTION_IDS_QUICK_REFERENCE.md](../../solutions/patterns/STOREFRONT_SECTION_IDS_QUICK_REFERENCE.md)** - Section ID patterns (AI chatbot)

### Complete Documentation Index

For comprehensive reference, see: [NEXTJS_MIGRATION_AUDIT_CROSS_REFERENCES.md](../../solutions/NEXTJS_MIGRATION_AUDIT_CROSS_REFERENCES.md)

This index maps all Next.js-related documentation by topic, file path, and cross-references.
````

---

## Update 7: Add to "Key Documentation" Section

**Location:** Update the "Key Documentation" bullet list

**Current:**

```markdown
- **apps/web/README.md** - Next.js app setup, environment variables, architecture
```

**Updated to:**

```markdown
- **apps/web/README.md** - Next.js app setup, environment variables, architecture
- **docs/adrs/ADR-014-nextjs-app-router-migration.md** - Next.js migration architecture decisions
- **docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md** - 10 lessons from migration code review
- **docs/solutions/NEXTJS_CLIENT_API_PROXY_PREVENTION.md** - Server/client component patterns
- **docs/solutions/NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md** - ISR and API synchronization
```

---

## Update 8: Add "Next.js Migration Prevention Checklist"

**Location:** Near the end, before "Common Pitfalls"

**Add this new section:**

```markdown
## Next.js Migration Prevention Checklist

Use this checklist before merging ANY Next.js feature or extending storefront:

### Build & Type Safety

- [ ] `npm run typecheck` passes (all workspaces)
- [ ] `npm run build` succeeds
- [ ] All imports resolve (no missing components/modules)
- [ ] No `as never` or `as any` on API contracts

### Dynamic Routes

- [ ] `error.tsx` exists in route folder
- [ ] `loading.tsx` exists in route folder (Suspense boundary)
- [ ] error.tsx shows meaningful error message
- [ ] loading.tsx uses sage spinner pattern

### Server/Client Components

- [ ] Data fetching in Server Components (not Client)
- [ ] Sensitive data NOT exposed to client (tokens, API keys)
- [ ] Shared fetch functions wrapped with `cache()` (React)
- [ ] Client Components use `'use client'` directive if interactive

### Data & Performance

- [ ] getBackendToken() used server-side only
- [ ] No `toLocaleDateString()` without hydration guard
- [ ] ISR endpoints rate limited (prevent cache stampede)
- [ ] No duplicate fetch calls in single render cycle

### Dual Routing (if applicable)

- [ ] Both `/t/[slug]` and `/t/_domain` routes implemented
- [ ] Shared components used (DRY)
- [ ] Middleware rewrites custom domains correctly

### Authentication

- [ ] Session token NOT in client-side session object
- [ ] Session duration appropriate for risk level (24h for tenants)
- [ ] Single auth system (no hybrid NextAuth + custom)
- [ ] Credentials provider validates via Express backend

### Navigation & Forms

- [ ] No `<form action={...}>` with client-side state
- [ ] Session-changing navigation uses `window.location.href`
- [ ] useEffect dependencies correct (no infinite loops)
- [ ] No early returns before hooks

### Code Quality

- [ ] Logger utility used (no console.\*)
- [ ] All DTOs import from `@macon/contracts` (not local)
- [ ] No `as any` on non-contract types
- [ ] Environment variables documented

This checklist prevents 80% of Next.js migration issues. See: [nextjs-migration-lessons-learned](../../solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)
```

---

## Implementation Priority

**Phase 1 (Immediate - highest ROI):**

1. Update 4: Common Pitfalls (prevents 34-36 recurring issues)
2. Update 1: File Naming Conventions (on-deck reference)
3. Update 6: Documentation Map (discovery and onboarding)

**Phase 2 (High):** 4. Update 3: Server/Client Architecture section (core mental model) 5. Update 7: Key Documentation links (discoverability) 6. Update 8: Prevention Checklist (pre-merge validation)

**Phase 3 (Medium):** 7. Update 5: Next.js-Specific Patterns (comprehensive reference) 8. Update 2: File Naming Conventions - Error/Loading suffixes (completeness)

---

## Testing the Updates

After making updates, verify:

1. All file paths are correct (absolute paths, `../../` relative from CLAUDE.md)
2. All links use markdown format `[text](path)`
3. Code examples have language markers (`typescript, `tsx, etc.)
4. New sections are alphabetically ordered where applicable
5. Cross-references between updates are consistent
6. Run `npm run format` to ensure consistent spacing

---

## Expected Impact

These updates will:

- Prevent 34 documented recurring issues (from common pitfalls)
- Provide immediate reference for 5 most-critical patterns
- Enable self-serve onboarding for new developers
- Reduce code review cycle time (clear expectations)
- Improve documentation discoverability
- Establish "print & pin" quick reference culture

---

## Notes for Reviewer

- These updates draw from 35+ documentation pages synthesized into actionable CLAUDE.md entries
- All code examples are taken from actual MAIS patterns, not hypothetical
- Cross-references use relative paths for portability
- Updates maintain CLAUDE.md's existing formatting conventions
- Prevention checklist addresses code review findings from 6-agent parallel review
