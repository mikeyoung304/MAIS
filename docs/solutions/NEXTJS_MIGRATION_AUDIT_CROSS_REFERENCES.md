# Next.js Migration Audit: Cross-Reference Analysis

**Date:** 2026-01-08
**Scope:** Comprehensive documentation audit of Next.js migration patterns and related solutions
**Status:** Complete

---

## Executive Summary

The MAIS codebase contains extensive documentation capturing lessons learned and patterns from the Vite SPA → Next.js 14 App Router migration (6 phases, 14 code review fixes applied). This document catalogs all related documentation that should be cross-referenced when working on Next.js migration audits, code reviews, or extending the storefront architecture.

**Key Finding:** Documentation is well-distributed across `docs/adrs/`, `docs/solutions/`, and `docs/solutions/patterns/` with clear naming conventions and strategic cross-references.

---

## Part 1: Core Migration Documentation

### 1.1 Architectural Decision Record (ADR)

**File:** `/Users/mikeyoung/CODING/MAIS/docs/adrs/ADR-014-nextjs-app-router-migration.md`

**What it covers:**

- Rationale for choosing Next.js App Router over Remix/Astro/SvelteKit
- Decision matrix for rendering strategy (ISR vs SSR vs SSG vs CSR)
- Authentication architecture (NextAuth.js v5 with Credentials Provider)
- Tenant resolution flow with custom domain support
- Section components architecture (7 modular section types)
- Dual routing pattern (slug routes vs custom domain routes)
- Migration phases (6 phases, 2-3 weeks actual vs 6-8 weeks planned)

**Relevance:**

- Foundation document for understanding WHY the migration happened
- Reference for architectural decisions made during migration
- Essential before making changes to Next.js infrastructure

**Cross-References:**

- Links to: `nextjs-migration-lessons-learned-MAIS-20251225.md`
- Related ADRs: ADR-006, ADR-007, ADR-013

---

### 1.2 Migration Lessons Learned Document

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md`

**What it covers:**

- 10 key lessons from post-migration code review (8 P1, 5 P2, 1 P3 issues found)
- Security patterns: Token isolation, session duration, auth consolidation
- Performance patterns: React cache() deduplication, ISR rate limiting
- Error handling: Error boundaries on all dynamic routes
- Code quality: Logger utilities, build pre-gates, contract-first development
- Prevention checklist for future framework migrations

**Relevance:**

- Distills concrete patterns to follow in Next.js development
- Provides code examples of CORRECT vs WRONG patterns
- Serves as onboarding reference for new developers
- Immediately actionable patterns

**Key Lessons:**

1. Security tokens must never reach client
2. Build before review, not after
3. Consolidate auth systems early
4. Error boundaries are not optional
5. Frontend features need backend contracts
6. Use logger utility, never console.log
7. Session duration should match risk level
8. ISR endpoints need rate limiting
9. React cache() prevents duplicate fetches
10. Import real contracts, not placeholders

---

## Part 2: Phase-Specific Code Review Documentation

### 2.1 Legacy-to-Next.js P2 Migration Fixes

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/code-review-patterns/legacy-nextjs-p2-migration-fixes-MAIS-20260105.md`

**What it covers:**

- 6 P2 issues from scheduling routes migration
- Issue #639: Missing loading.tsx suspense boundaries (UX impact)
- Issue #640: Duplicate DTO definitions (DRY violation)
- Issue #641: Missing ARIA attributes in scheduling nav (accessibility)
- Issue #642: Missing React Query integration (performance)
- Issue #643: Missing get_availability_rules agent tool (feature parity)
- Issue #644: Missing delete_package_photo agent tool (feature parity)

**Relevance:**

- Documents recurring patterns found during code review
- Preventable issues for future migrations
- Agent parity requirements (every UI action needs a tool)
- Contract duplication vs single source of truth

**Key Patterns:**

```tsx
// Loading state pattern
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-sage" />
    </div>
  );
}

// DRY: Import from contracts, not local duplicates
import { ServiceDtoSchema } from '@macon/contracts';
```

---

### 2.2 Client Navigation & Hydration Anti-Patterns

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/code-review-patterns/nextjs-client-navigation-hydration-anti-patterns-MAIS-20260106.md`

**What it covers:**

- Root cause analysis of hydration mismatch errors
- Layer 1: Server Action form pattern causing "form in div" error
- Layer 2: startTransition + setTimeout anti-pattern
- Layer 3: toLocaleDateString() server/client mismatch
- Layer 4: Conditional component rendering without hydration guard
- Layer 5: Service worker caching stale JavaScript
- Solutions for impersonation navigation failures
- Hydration-safe patterns for client navigation

**Relevance:**

- Critical for understanding why some navigation patterns fail
- Directly applicable to any Next.js App Router development
- Explains "works locally but fails on Vercel" issues
- Comprehensive 5-layer debugging approach

**Key Insight:**

```tsx
// ❌ BROKEN: Server Action form causes hydration mismatch
<form action={impersonateTenant.bind(null, tenant.id)} className="flex-1">
  <Button type="submit">Impersonate</Button>
</form>;

// ✅ CORRECT: Use window.location.href for session-changing navigation
const handleImpersonate = async (tenantId: string) => {
  const result = await impersonateTenant(tenantId);
  window.location.href = '/dashboard'; // Forces full page reload
};
```

---

## Part 3: Next.js-Specific Pattern Documentation

### 3.1 Route Duplication Prevention

**Files:**

- `/Users/mikeyoung/CODING/MAIS/docs/solutions/nextjs-route-duplication-prevention-MAIS-20251228.md`
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/nextjs-route-duplication-quick-checklist.md`
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/code-review-patterns/nextjs-route-review-guidelines.md`

**What they cover:**

- Dual routing pattern creates duplication risk
- Preventing segment/feature duplication between slug and domain routes
- Route parity requirements (both routes mirror each other exactly)
- Refactoring opportunities to DRY up route handlers
- Code review checklist for route implementations

**Relevance:**

- Critical for maintaining dual routing pattern (slug + custom domain)
- Prevents code duplication and maintenance burden
- Ensures feature parity between access patterns

---

### 3.2 Client-API Proxy Prevention

**Files:**

- `/Users/mikeyoung/CODING/MAIS/docs/solutions/NEXTJS_CLIENT_API_PROXY_PREVENTION.md`
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/integration-issues/nextjs-client-api-proxy-authentication-MAIS-20251228.md`
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/NEXTJS_CLIENT_API_QUICK_REFERENCE.md`

**What they cover:**

- Anti-pattern: Client components proxying API requests
- Correct pattern: Server components fetching, client components rendering
- Authentication handling in Server Components
- nextAuth getBackendToken() pattern
- Proper ts-rest client initialization

**Relevance:**

- Essential for avoiding security and performance issues
- Clarifies server vs client component responsibilities
- Prevents token exposure to client

**Key Pattern:**

```typescript
// ❌ WRONG: Client component making authenticated API calls
'use client';
const data = await fetch('/api/packages', {
  headers: { 'X-Tenant-Key': tenantKey } // Exposed to client!
});

// ✅ CORRECT: Server component fetches, client renders
export default async function PackagesList() {
  const packages = await getPackages(); // Server-side fetch
  return <PackageListClient packages={packages} />;
}
```

---

### 3.3 ISR & API Mismatch Prevention

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md`

**What it covers:**

- ISR configuration and revalidation patterns
- Preventing cache stampede attacks
- Rate limiting on revalidation endpoints
- API contract validation
- 60-second revalidation window for tenant pages

**Relevance:**

- Critical for performance and reliability
- Prevents accidental DoS scenarios
- Ensures API and cache stay synchronized

---

### 3.4 Hydration Mismatch Prevention

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md`

**What it covers:**

- Common hydration mismatch scenarios
- Date/time formatting on server vs client
- Dynamic content rendering patterns
- useId() for unique identifiers
- Suppressing hydration mismatch warnings (vs fixing root cause)

**Relevance:**

- Foundational knowledge for Next.js Server Component development
- Prevents "white screen of death" in production
- Essential for page stability

---

### 3.5 Loading & Suspense Boundaries

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/NEXTJS_LOADING_SUSPENSE_PREVENTION.md`

**What it covers:**

- Loading state best practices with loading.tsx
- Suspense boundary placement
- Skeleton loading patterns
- Layout shift prevention
- UX impact of missing loading states

**Relevance:**

- Improves perceived performance
- Prevents cumulative layout shift (CLS) issues
- Enhances user experience during navigation

---

## Part 4: Deployment & Infrastructure Documentation

### 4.1 Vercel + npm Workspaces Configuration

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/deployment-issues/vercel-nextjs-npm-workspaces-root-directory-MAIS-20251226.md`

**What it covers:**

- Vercel deployment issues with npm workspaces
- Root Directory setting (MUST be omitted for monorepos)
- Dependency hoisting problems
- Build failures on Vercel vs local builds
- Configuration checklist

**Relevance:**

- Critical for production deployment
- Explains "works locally but fails on Vercel" scenarios
- P0 issue if misconfigured

**Key Finding:**

> Never set Root Directory for npm workspaces monorepos - it breaks dependency hoisting

---

### 4.2 NextAuth v5 Secure Cookie Prefix Production Issue

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/authentication-issues/nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md`

**What it covers:**

- NextAuth v5 HTTPS cookie prefix handling
- 401 errors in production but not local
- Secure flag and SameSite attribute configuration
- Cookie domain scoping for custom domains
- Environment-specific cookie behavior

**Relevance:**

- Critical for authentication reliability
- Explains production-only auth failures
- P0 issue for multi-tenant custom domains

---

## Part 5: Section Component & Storefront Architecture

### 5.1 Storefront Section ID Pattern

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/STOREFRONT_SECTION_ID_PATTERN-MAIS-20260108.md`

**What it covers:**

- Why array indices are fragile for AI chatbot references
- Human-readable section ID format: `{page}-{type}-{qualifier}`
- Implementation in Zod schemas
- Migration from index-based to ID-based references
- TOCTOU race condition prevention
- Reserved pattern protection (prototype pollution prevention)

**Relevance:**

- Essential for storefront editor and AI chatbot
- Prevents data loss from concurrent edits
- Enables natural conversation ("updating home-hero-main")

**Section ID Format Examples:**

```
home-hero-main      # Primary hero on home page
about-text-2        # Second text section on about page
services-pricing-main  # Pricing section on services page
```

---

### 5.2 Section ID Prevention Strategies & Quick Reference

**Files:**

- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md`
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/STOREFRONT_SECTION_IDS_QUICK_REFERENCE.md`

**What they cover:**

- TOCTOU (Time-of-Check-Time-of-Use) prevention with advisory locks
- DRY for tool logic (extract shared utilities)
- API consistency across related tools
- Testing error paths and legacy data (sections without IDs)
- Code review checklist

**Relevance:**

- Prevents concurrent modification bugs
- Ensures code maintainability
- Critical for code review

---

### 5.3 Build Mode Storefront Editor Patterns

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md`

**What it covers:**

- Agent parity requirement (every UI action → tool)
- DRY schemas (live in @macon/contracts)
- PostMessage validation and Zod parsing
- Draft system consistency
- Trust tier implementation (T2 soft-confirm vs T3 user-confirm)

**Relevance:**

- Essential for storefront editor and AI chatbot integration
- Prevents feature parity gaps
- Ensures robust inter-process communication

---

### 5.4 Segment-First Browsing UX Pattern

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/SEGMENT_FIRST_STOREFRONT_UX_PATTERN-MAIS-20260108.md`

**What it covers:**

- Segment-first browsing user flow
- URL hash state management
- Service filtering by segment
- URL-preserving navigation patterns

**Relevance:**

- Improves storefront UX
- Enables shareable service filter states
- Prevents loss of user context during navigation

---

## Part 6: Agent Integration & Tools

### 6.1 Agent Tools Prevention Index

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md`

**What it covers:**

- Master index for agent tool patterns
- Tenant isolation in tool execution
- Executor registry pattern for avoiding circular dependencies
- TOCTOU prevention in write tools
- DRY utilities for shared tool logic

**Relevance:**

- Critical for chatbot and onboarding agent tools
- Prevents subtle data isolation bugs
- Ensures consistent error handling

---

### 6.2 Build Mode Implementation Patterns

**Files:**

- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/build-mode-quick-reference-MAIS-20260105.md`
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/build-mode-implementation-prevention-MAIS-20260105.md`

**What they cover:**

- Drafting system for storefront changes
- T2 soft-confirm vs T3 user-confirm flows
- Agent parity requirements
- Zod validation patterns
- PostMessage security

**Relevance:**

- Essential for any storefront editor features
- Ensures agent parity with UI
- Prevents silent failures in agent tools

---

## Part 7: Performance & Optimization

### 7.1 React cache() Pattern

**From:** `nextjs-migration-lessons-learned-MAIS-20251225.md` (Lesson 9)

**Key Learning:**

```typescript
import { cache } from 'react';

// Automatically deduplicates within a single render cycle
export const getTenantStorefrontData = cache(
  async (slug: string): Promise<TenantStorefrontData> => {
    const tenant = await getTenantBySlug(slug);
    const [packages, segments] = await Promise.all([
      getTenantPackages(tenant.apiKeyPublic),
      getTenantSegments(tenant.apiKeyPublic),
    ]);
    return { tenant, packages, segments };
  }
);
```

**Relevance:**

- Prevents duplicate fetches during SSR
- Significantly reduces page load latency
- Essential for Server Components

---

### 7.2 Image Optimization & Code Splitting

**Note:** No dedicated documentation found, but referenced in ADR-014

**Recommendation:** Document Next.js Image component patterns and dynamic import usage for code splitting in future sessions.

---

## Part 8: Testing & Quality Assurance

### 8.1 E2E Testing with Playwright

**Related Files:**

- `docs/solutions/code-review-patterns/visual-editor-e2e-testing.md`
- `docs/solutions/methodology/parallel-todo-resolution-with-playwright-verification-MAIS-20251225.md`

**Relevance:**

- Applies to storefront E2E testing
- Documents test isolation patterns
- Playwright best practices for Next.js

---

### 8.2 Service Worker Cache Staleness Prevention

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/dev-workflow/SERVICE_WORKER_CACHE_STALE_BUNDLES_PREVENTION.md`

**What it covers:**

- Service worker caching issues after branch switches
- Stale JavaScript delivery causing hydration failures
- Manual cache clearing procedures
- Prevention strategies

**Relevance:**

- Critical for local development stability
- Explains mysterious "works in fresh browser but not existing"
- Turbopack HMR cache issues companion

---

### 8.3 Turbopack HMR Cache Issues

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/dev-workflow/TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md`

**What it covers:**

- Turbopack in-memory module graph staleness
- Issues when removing imports or switching build modes
- Quick recovery scripts
- Prevention strategies

**Relevance:**

- Explains "hot reload not picking up changes"
- Provides `npm run dev:fresh` recovery command
- Critical for development workflow efficiency

---

## Part 9: Architecture & Design Patterns

### 9.1 Next.js App Router Routing Abstraction Pattern

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/architecture/NEXT_APP_ROUTER_ROUTING_ABSTRACTION_PATTERN.md`

**What it covers:**

- Abstraction patterns for managing complex routing
- Slug-based vs domain-based routing
- Route consolidation strategies

**Relevance:**

- Essential for maintaining dual routing pattern
- Prevents code duplication
- Enables route parameter flexibility

---

### 9.2 Dual Route Deduplication

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/architecture/NEXT_APP_ROUTER_DUAL_ROUTE_DEDUPLICATION.md`

**What it covers:**

- Techniques for eliminating duplication between `[slug]` and `_domain` routes
- Shared layout patterns
- Component extraction strategies

**Relevance:**

- Critical for maintainability of dual routing
- Prevents feature divergence between access patterns
- Reduces code review burden

---

## Part 10: Cross-Cutting Concerns

### 10.1 Impersonation Navigation Prevention

**Files:**

- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md`
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/IMPERSONATION_README.md`
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/IMPERSONATION_QUICK_REFERENCE.md`

**What they cover:**

- Safe impersonation session switching
- Hydration-safe navigation patterns
- Session sync across browser tabs
- Cache invalidation for impersonation

**Relevance:**

- Critical for admin functionality
- Applies hydration patterns to session-changing operations
- Prevents silent failures

---

### 10.2 TypeScript Symlink Resolution Prevention

**Files:**

- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/TYPESCRIPT_SYMLINK_RESOLUTION_PREVENTION.md`
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/TYPESCRIPT_SYMLINK_QUICK_REFERENCE.md`

**What it covers:**

- Why symlinks in src directories break TypeScript
- Double compilation issues
- Solutions: tsconfig paths vs npm workspaces

**Relevance:**

- Critical for monorepo stability
- Prevents obscure "duplicate identifier" errors
- Explains `instanceof` check failures

---

### 10.3 React Hooks Early Return Prevention

**Files:**

- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/REACT_HOOKS_EARLY_RETURN_PREVENTION.md`
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md`

**What it covers:**

- React Rules of Hooks violations
- Early returns before hooks
- "Works locally but fails on Vercel" phenomenon
- ESLint strictness differences

**Relevance:**

- P0 issue for build reliability
- Explains local/CI mismatch
- Prevention checklist essential

**Key Pattern:**

```tsx
// ❌ WRONG: Early return before hooks
if (!data) return <Loading />;
const [state, setState] = useState(); // VIOLATES RULES OF HOOKS

// ✅ CORRECT: Move ALL hooks above ANY returns
const [state, setState] = useState();
if (!data) return <Loading />;
```

---

## Part 11: Security & Compliance

### 11.1 Email Case Sensitivity Prevention

**Files:**

- `/Users/mikeyoung/CODING/MAIS/docs/solutions/security-issues/EMAIL-CASE-SENSITIVITY-SUMMARY.md`
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/security-issues/login-invalid-credentials-email-case-sensitivity.md`

**What it covers:**

- Email case sensitivity in authentication
- Database schema for case-insensitive lookups
- Login validation patterns

**Relevance:**

- Critical for auth reliability
- Affects Next.js auth handlers
- P1 user experience issue

---

### 11.2 Missing Input Validation & Cross-Tenant Exposure

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/security-issues/missing-input-validation-cross-tenant-exposure.md`

**What it covers:**

- Input validation requirements
- Tenant isolation validation
- Cross-tenant exposure prevention
- Route parameter validation

**Relevance:**

- Critical security patterns
- Applies to all Next.js routes
- P0 data isolation issue

---

## Part 12: Quick Reference Guides (Print & Pin)

The codebase includes several "quick reference" guides designed for immediate lookup:

1. **Next.js Migration Lessons Learned (Lesson 10 checklist)**
   - Pre-merge migration checklist
   - Build, auth, error handling, performance validation

2. **NEXTJS_CLIENT_API_QUICK_REFERENCE.md**
   - Server vs client component responsibilities
   - Authentication patterns in Server Components

3. **nextjs-route-duplication-quick-checklist.md**
   - Preventing duplication between dual routes

4. **IMPERSONATION_QUICK_REFERENCE.md**
   - Safe navigation patterns for session changes

5. **REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md**
   - Rules of Hooks compliance checklist

6. **STOREFRONT_SECTION_IDS_QUICK_REFERENCE.md**
   - Section ID validation and testing patterns

---

## Part 13: Recommended CLAUDE.md Updates

Based on this cross-reference analysis, the following sections of `CLAUDE.md` should be updated or expanded:

### 13.1 Add Server/Client Component Patterns Section

```markdown
### Server vs Client Components

**Pattern:** Server Components for data fetching, Client Components for interactivity.

**For data fetching in Server Components:**

- Use `cache()` wrapper to prevent duplicate fetches during render
- Call Express API directly (fetch with X-Tenant-Key header)
- Render data via Server Component, pass interactivity to Client Component

**For client-side API calls:**

- NEVER fetch in Client Components with auth headers
- Use `getBackendToken()` in Server Actions only
- Pass pre-fetched data via props or React Query

See: docs/solutions/NEXTJS_CLIENT_API_PROXY_PREVENTION.md
```

### 13.2 Add Next.js Specific Error Boundary Section

````markdown
### Error Boundaries & Loading States (Required)

Every dynamic route needs:

- `error.tsx` - Error boundary for route errors
- `loading.tsx` - Suspense boundary for page transitions

Pattern:

```tsx
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-sage" />
    </div>
  );
}
```
````

See: ADR-014, Lesson 4 in nextjs-migration-lessons-learned-MAIS-20251225.md

````

### 13.3 Add ISR Configuration Section

```markdown
### Incremental Static Regeneration (ISR)

Tenant pages use 60-second ISR:
- All tenant storefronts revalidate every 60s
- On-demand revalidation via `/api/revalidate?secret=xxx`
- Rate limited to prevent cache stampede attacks

Pattern:
```typescript
export const revalidate = 60; // seconds
````

See: docs/solutions/NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md

````

### 13.4 Add Prevention Strategies Section

Add to the "Common Pitfalls" section:

```markdown
26. **Server Action form patterns cause hydration errors:** Use Server Actions for mutations, but avoid `<form action={...}>` pattern with client-side state. Use `window.location.href` for session-changing navigation.
27. **Missing error.tsx on dynamic routes:** All routes with `[params]` must have error.tsx and loading.tsx
28. **Missing React cache() on shared data functions:** Wrap shared SSR fetch functions with cache() to prevent duplicate queries
29. **Hydration date mismatch:** Never use toLocaleDateString() without hydration guard. Use useId() for unique identifiers.
30. **ISR endpoints without rate limiting:** Revalidation endpoints must be rate limited to prevent cache stampede attacks
````

### 13.5 Add Documentation Cross-References

Add a new section:

```markdown
## Next.js Migration Documentation Map

### Core References

- **ADR-014:** Architectural decisions for Next.js migration
- **nextjs-migration-lessons-learned-MAIS-20251225.md:** 10 key lessons with code examples
- **legacy-nextjs-p2-migration-fixes-MAIS-20260105.md:** P2 issues and solutions from scheduling migration

### Pattern Documentation

- **NEXTJS_CLIENT_API_PROXY_PREVENTION.md:** Server vs client component patterns
- **nextjs-route-duplication-prevention-MAIS-20251228.md:** Maintaining dual routing (slug + domain)
- **NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md:** Cache and API synchronization
- **nextjs-client-navigation-hydration-anti-patterns-MAIS-20260106.md:** 5-layer hydration debugging

### Quick Reference (Print & Pin)

- **nextjs-route-duplication-quick-checklist.md** - 2 min read
- **REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md** - 2 min read
```

---

## Summary Table: Documentation by Topic

| Topic                      | Primary Document                                                  | Quick Ref           | Files |
| -------------------------- | ----------------------------------------------------------------- | ------------------- | ----- |
| **Architectural Overview** | ADR-014-nextjs-app-router-migration.md                            | —                   | 1     |
| **Lessons Learned**        | nextjs-migration-lessons-learned-MAIS-20251225.md                 | Pre-merge checklist | 1     |
| **Code Review Patterns**   | legacy-nextjs-p2-migration-fixes-MAIS-20260105.md                 | —                   | 1     |
| **Hydration Issues**       | nextjs-client-navigation-hydration-anti-patterns-MAIS-20260106.md | —                   | 1     |
| **Client API Patterns**    | NEXTJS_CLIENT_API_PROXY_PREVENTION.md                             | QUICK_REFERENCE     | 3     |
| **Route Duplication**      | nextjs-route-duplication-prevention-MAIS-20251228.md              | quick-checklist     | 3     |
| **ISR Configuration**      | NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md                         | —                   | 1     |
| **Loading States**         | NEXTJS_LOADING_SUSPENSE_PREVENTION.md                             | —                   | 1     |
| **Deployment**             | vercel-nextjs-npm-workspaces-root-directory-MAIS-20251226.md      | —                   | 1     |
| **Authentication**         | nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md  | QUICK_REFERENCE     | 2     |
| **Section IDs**            | STOREFRONT_SECTION_ID_PATTERN-MAIS-20260108.md                    | QUICK_REFERENCE     | 3     |
| **Build Mode**             | build-mode-storefront-editor-patterns-MAIS-20260105.md            | quick-reference     | 3     |
| **React Hooks**            | REACT_HOOKS_EARLY_RETURN_PREVENTION.md                            | QUICK_REFERENCE     | 2     |
| **TypeScript Symlinks**    | TYPESCRIPT_SYMLINK_RESOLUTION_PREVENTION.md                       | QUICK_REFERENCE     | 2     |
| **Impersonation**          | IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md                 | QUICK_REFERENCE     | 3     |
| **Security**               | security-issues/EMAIL-CASE-SENSITIVITY-SUMMARY.md                 | —                   | 3+    |
| **Dev Workflow**           | TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md                | —                   | 2     |

---

## Recommended Reading Order for New Developers

1. **Start:** ADR-014 (understanding the "why")
2. **Learn:** nextjs-migration-lessons-learned (10 patterns)
3. **Reference:** NEXTJS_CLIENT_API_QUICK_REFERENCE (weekly use)
4. **Deep Dive:** topic-specific documents as needed
5. **Print & Pin:** Quick reference guides for each subsystem

---

## File Statistics

- **Total Core Next.js Docs:** 35+ dedicated documents
- **Quick Reference Guides:** 11 "print & pin" resources
- **Pattern Documents:** 20+ patterns indexed
- **ADRs:** 1 (ADR-014)
- **Code Review Case Studies:** 3+ (lessons, P2 fixes, hydration)
- **Prevention Strategies:** 15+ specific topics

---

## Maintenance Notes

- **Last Updated:** 2026-01-08
- **Scope:** Next.js migration patterns (complete as of storefront section IDs feature)
- **Status:** Ready for code review and onboarding
- **Next Review:** After next major Next.js feature or migration phase

---

## Links to Key External References

From within documentation:

- Next.js App Router Documentation: https://nextjs.org/docs/app
- NextAuth.js v5 Documentation: https://authjs.dev/
- Vercel Custom Domains: https://vercel.com/docs/concepts/projects/domains
- React cache() and Server Components: https://react.dev/reference/react/cache
