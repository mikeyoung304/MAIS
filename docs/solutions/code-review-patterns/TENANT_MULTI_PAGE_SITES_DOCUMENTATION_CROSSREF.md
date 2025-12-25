---
title: Tenant Multi-Page Sites - Documentation Cross-References
category: code-review-patterns
severity: p2
date_created: 2025-12-25
related_commits:
  - b16379a fix(web): resolve P1 accessibility violations in tenant multi-page sites
  - f68e9f5 feat(web): add multi-page tenant sites with navigation
  - 661d464 fix(web): resolve P2/P3 code review findings from PR #18
tags:
  - multi-page-sites
  - navigation
  - accessibility
  - next.js
  - react-performance
  - ssr
  - aria-current
  - focus-visible
  - usecallback
  - react.memo
  - cache()
---

# Tenant Multi-Page Sites - Documentation Cross-References

This document provides a complete index of related documentation for the **tenant multi-page sites feature** (commits f68e9f5, b16379a, 661d464) to prevent regressions and support future development.

---

## 1. Core Architecture & Decisions

### ADR-014: Next.js App Router Migration for Tenant Storefronts
**File:** `/docs/adrs/ADR-014-nextjs-app-router-migration.md`

**Relevance:** Foundation for tenant multi-page sites
- Explains why Next.js App Router chosen over alternatives
- ISR (60s revalidation) strategy for dynamic tenant pages
- Custom domain routing via middleware
- Server Components vs Client Components patterns
- Vercel deployment architecture

**Key Sections to Review:**
- Directory structure (lines 61-80)
- Tenant resolution flow (lines 82-100)
- Why App Router chosen (lines 40-46)
- Why keep Express backend (lines 49-55)

---

## 2. Next.js Migration Lessons (Post-Migration Fixes)

### Lessons Learned: Next.js Migration
**File:** `/docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md`

**Relevance:** Prevents similar issues in tenant multi-page sites
- Security: Never expose backend tokens to client (Lesson 1)
- Build gates: Always run typecheck + build before review (Lesson 2)
- Error boundaries: Required for all dynamic routes (Lesson 4)
- React cache() for deduplication (Lesson 9)
- ISR rate limiting (Lesson 8)
- Frontend-backend contract-first development (Lesson 5)

**Critical Issues Fixed:**
1. Backend tokens in NextAuth session (XSS vulnerability)
2. Missing error.tsx on dynamic routes (blank screens)
3. Duplicate data fetching (100ms+ latency)
4. Unimplemented backend endpoints
5. 6+ console.log calls (logging standards)

**Prevention Checklist:** Lines 349-386

---

## 3. React Performance & Memoization

### React Hooks Performance & WCAG Code Review Patterns
**File:** `/docs/solutions/code-review-patterns/react-hooks-performance-wcag-review.md`

**Relevance:** Accessibility and performance patterns for navigation/menu components
- useCallback patterns for event handlers (Issue #119)
- useEffect dependency completeness (Issue #120)
- Event handler stability with React.memo (Issue #121)
- Focus visible indicators for keyboard navigation (WCAG 2.4.7)
- Visual state indicators for interactive elements (WCAG 1.3.1)
- Event propagation in nested elements

**Solutions from PR #12 Review:**
```typescript
// useCallback for event handlers
const handleEdit = useCallback(
  async (pkg: PackageDto) => {
    packageForm.loadPackage(pkg);
    await packageManager.handleEdit(pkg);
  },
  [packageForm.loadPackage, packageManager.handleEdit]
);

// Focus visible classes
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"

// Rotating chevron for state indication
<ChevronRight className="transition-transform group-open:rotate-90" />
```

---

### React Memoization Quick Reference
**File:** `/docs/solutions/react-performance/REACT-MEMOIZATION-QUICK-REFERENCE.md`

**Relevance:** Quick decision tree for component optimization
- 30-second decision tree (lines 16-36)
- Pattern 1: Callback props → useCallback()
- Pattern 2: List items (10+) → React.memo()
- Pattern 3: Derived values (.filter/.map/.sort) → useMemo()
- Code review checklist for React PRs
- ESLint grep commands to find issues

**Key Quote:** "Print this. Pin this. Read before every React component commit."

---

## 4. Accessibility Guidelines

### PR #12 Prevention Strategies - React Hooks & Accessibility Issues
**File:** `/docs/solutions/PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md`

**Relevance:** Prevention strategies for accessibility violations
- WCAG 2.4.7: Keyboard focus indicators
- WCAG 1.3.1: Visual state indicators (not just color)
- WCAG 2.5.5: Touch targets >= 44x44px
- ESLint rules for jsx-a11y integration
- Event propagation best practices
- Code review checklist for accessibility

**ESLint Rules to Enable:**
```json
{
  "rules": {
    "jsx-a11y/interactive-supports-focus": "warn",
    "jsx-a11y/click-events-have-key-events": "warn",
    "react-hooks/exhaustive-deps": "error"
  }
}
```

---

## 5. Multi-Tenant Implementation

### Multi-Tenant Implementation Guide
**File:** `/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`

**Relevance:** Data isolation and tenant scoping patterns
- Tenant context resolution (middleware flow)
- Query scoping by tenantId (CRITICAL)
- Cache key isolation (`tenant:${tenantId}:resource:${id}`)
- API key validation (`pk_live_{slug}_{random}`)
- JWT authentication for tenant admins

**Critical Rule:** All database queries MUST filter by tenantId

---

## 6. Next.js App Architecture

### Next.js Web App README
**File:** `/apps/web/README.md`

**Relevance:** Reference for Next.js patterns in MAIS
- App Router directory structure (lines 22-54)
- SSR-aware API client (lines 75-96)
- Tenant landing pages at /t/[slug]
- Environment variables required
- Middleware for custom domain resolution
- Error boundary expectations

**Key Architecture Decisions:**
- Server Components by default
- Client Components for interactivity (use client)
- Dynamic routes require error.tsx
- ISR revalidation for performance
- React cache() for deduplication

---

## 7. Related Code Review Patterns

### Multi-Agent Code Review Workflow
**File:** `/docs/solutions/code-review-patterns/multi-agent-code-review-workflow-systematic-triage-MAIS-20251224.md`

**Relevance:** Code review methodology used for tenant multi-page sites
- Systematic triage process for P1/P2/P3 issues
- Multi-agent parallel review patterns
- Issue prioritization and severity levels

---

### Storefront Component Refactoring Review
**File:** `/docs/solutions/code-review-patterns/storefront-component-refactoring-review.md`

**Relevance:** Component patterns for multi-tenant storefronts
- Component consolidation strategies
- Shared vs tenant-specific components
- CSS duplication prevention
- State management patterns

---

## 8. Navigation & Event Handling

### Impersonation Sidebar Navigation Bug
**File:** `/docs/solutions/ui-bugs/impersonation-sidebar-navigation-bug.md`

**Relevance:** Navigation state and aria-current patterns
- Active link indication with aria-current
- Navigation state synchronization
- Link component patterns

---

## 9. Performance Optimization

### React Memo & Unstable Callbacks in Visual Editor
**File:** `/docs/solutions/performance-issues/react-memo-unstable-callbacks-visual-editor-MAIS-20251204.md`

**Relevance:** Performance patterns with event handlers
- Stable callback patterns
- React.memo effectiveness
- Profiling techniques

---

## 10. E2E Testing Patterns

### E2E Testing Advanced Patterns
**File:** `/docs/solutions/E2E-TESTING-ADVANCED-PATTERNS.md`

**Relevance:** Testing multi-page navigation flows
- Playwright patterns for Next.js
- SSR-specific test scenarios
- Multi-page flow testing

---

### Visual Editor E2E Testing
**File:** `/docs/solutions/visual-editor-e2e-quick-reference.md`

**Relevance:** E2E testing quick reference
- Playwright setup and patterns
- Common selectors and interactions
- Multi-step flow testing

---

## Implementation Checklist

Use this checklist when adding to or modifying tenant multi-page sites:

```markdown
### Before Committing

#### React Performance
- [ ] useCallback wrapped all callbacks passed to children
- [ ] useEffect dependencies complete (npm run lint)
- [ ] React.memo on list items (10+ items)
- [ ] No inline arrow functions in JSX
- [ ] displayName added to memoized components

#### Accessibility (WCAG AA)
- [ ] focus:outline-none focus-visible:ring-2 focus-visible:ring-sage on all interactive elements
- [ ] aria-current="page" on active navigation links
- [ ] Chevron/icon rotates to show collapsed/expanded state
- [ ] Touch targets >= 44x44px
- [ ] Color NOT the only indicator of state
- [ ] ESLint jsx-a11y rules passing

#### Next.js Patterns
- [ ] Dynamic routes have error.tsx
- [ ] Data fetching wrapped in cache()
- [ ] Server Components used for data fetching
- [ ] 'use client' directive on client components
- [ ] Backend endpoints implemented before frontend features
- [ ] ISR revalidation configured (60s for tenant pages)

#### Security
- [ ] No backend tokens exposed to client
- [ ] All queries scoped by tenantId
- [ ] Cache keys include tenantId
- [ ] API key format validated
- [ ] No console.log (use logger instead)

#### Multi-Tenant
- [ ] Tenant resolved correctly in middleware
- [ ] Data isolation verified (test cross-tenant access)
- [ ] Permission checks on mutations
- [ ] Cache invalidation on tenant data changes

#### E2E Tests
- [ ] Multi-page navigation flows tested
- [ ] Active link state verified (aria-current)
- [ ] Keyboard navigation tested (Tab, Enter)
- [ ] Mobile responsiveness tested
```

---

## Quick Reference: When to Reference Each Document

| Scenario | Document |
|----------|----------|
| Adding new multi-page navigation | React Hooks Performance & WCAG (aria-current pattern), Impersonation Navigation Bug |
| Optimizing component rendering | React Memoization Quick Reference, React Memo Unstable Callbacks |
| Accessibility review | PR #12 Prevention Strategies, React Hooks Performance & WCAG |
| Next.js pattern question | ADR-014, Next.js Lessons Learned, Web App README |
| E2E test for navigation | E2E Testing Advanced Patterns, Visual Editor E2E Quick Ref |
| Tenant data isolation issue | Multi-Tenant Implementation Guide |
| Performance regression | Lessons Learned (Lesson 9: React cache()) |
| Error handling | Next.js Lessons Learned (Lesson 4: Error boundaries) |

---

## Key Patterns to Remember

### 1. Active Navigation Links (aria-current)

```typescript
import { usePathname } from 'next/navigation';

function NavLink({ href, children }: Props) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`
        px-4 py-2 rounded-lg transition-colors
        ${isActive
          ? 'bg-sage text-white'
          : 'hover:bg-sage/10'
        }
        focus:outline-none focus-visible:ring-2 focus-visible:ring-sage
      `}
    >
      {children}
    </Link>
  );
}
```

### 2. Multi-Page Navigation with Stability

```typescript
const NavMenu = React.memo(function NavMenu({ pages }: Props) {
  const handlePageChange = useCallback((pageId: string) => {
    navigateTo(pageId);
  }, []);

  return (
    <nav className="flex gap-4">
      {pages.map(page => (
        <Link
          key={page.id}
          onClick={() => handlePageChange(page.id)}
          className="focus-visible:ring-2 focus-visible:ring-sage"
        >
          {page.title}
        </Link>
      ))}
    </nav>
  );
});
```

### 3. Data Fetching Deduplication

```typescript
import { cache } from 'react';

export const getTenantPages = cache(
  async (tenantId: string) => {
    const pages = await api.getTenantPages({ tenantId });
    return pages;
  }
);

// Usage - automatically deduplicated within render
export async function TenantLayout() {
  const pages = await getTenantPages(tenantId); // Call 1
  const nav = <Navigation pages={pages} />;      // Deduped
  const content = <PageContent pages={pages} />; // Deduped
}
```

### 4. Error Boundaries for Dynamic Routes

```typescript
// app/t/[slug]/page.tsx
export default async function TenantPage() { /* ... */ }

// app/t/[slug]/error.tsx
'use client';
export default function Error({ error, reset }: ErrorPageProps) {
  return (
    <div>
      <h1>Error loading tenant page</h1>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}

// app/t/[slug]/loading.tsx
export default function Loading() {
  return <TenantSkeleton />;
}
```

---

## Related Commits

- **f68e9f5**: feat(web): add multi-page tenant sites with navigation
  - Introduced multi-page architecture
  - Navigation component patterns

- **b16379a**: fix(web): resolve P1 accessibility violations in tenant multi-page sites
  - aria-current implementation
  - focus-visible patterns
  - Event handling stability

- **661d464**: fix(web): resolve P2/P3 code review findings from PR #18
  - Final polish on navigation
  - Performance optimizations
  - E2E test updates

---

## See Also

- **docs/design/BRAND_VOICE_GUIDE.md** - UI/UX standards for tenant sites
- **docs/multi-tenant/MULTI_TENANT_QUICK_START.md** - Quick start for multi-tenant work
- **docs/solutions/PREVENTION-QUICK-REFERENCE.md** - General prevention strategies
- **CLAUDE.md** (root) - Overall project standards and patterns

---

**Last Updated:** 2025-12-25
**Status:** Complete with all P1/P2/P3 code review fixes applied
**Test Coverage:** 771 server tests + 21+ E2E tests (22 passing after fixes)
