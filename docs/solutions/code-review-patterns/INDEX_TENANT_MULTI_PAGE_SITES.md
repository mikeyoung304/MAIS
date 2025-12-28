---
title: Tenant Multi-Page Sites - Quick Navigation Index
category: code-review-patterns
created: 2025-12-25
status: complete
---

# Tenant Multi-Page Sites - Quick Navigation Index

**Feature Status:** Complete with P1/P2/P3 code review fixes applied
**Commits:** f68e9f5, b16379a, 661d464
**Tests:** 771 server + 21+ E2E passing

---

## For Quick Answers

**Q: How do I add navigation links that show active state?**
→ See [TENANT_MULTI_PAGE_SITES_DOCUMENTATION_CROSSREF.md](./TENANT_MULTI_PAGE_SITES_DOCUMENTATION_CROSSREF.md#key-patterns-to-remember) (Pattern 1: Active Navigation Links)
→ Search: `aria-current`, `focus-visible:ring-2`

**Q: My component is re-rendering too often.**
→ Read [React Memoization Quick Reference](../react-performance/REACT-MEMOIZATION-QUICK-REFERENCE.md) (30-second decision tree)
→ Check: useCallback wrapper, React.memo for lists, useMemo for derived values

**Q: What accessibility requirements do I need?**
→ See [React Hooks Performance & WCAG Review](./react-hooks-performance-wcag-review.md)
→ Key rules: focus-visible, aria-current, chevron rotation, 44x44px touch targets

**Q: How should I fetch data in Next.js?**
→ Read [Next.js Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md) (Lesson 9: React cache())
→ Pattern: Wrap shared functions with `cache()` to deduplicate fetches

**Q: The dynamic route is showing blank on error.**
→ Check [Next.js Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md) (Lesson 4: Error Boundaries)
→ Add: `app/t/[slug]/error.tsx` and `app/t/[slug]/loading.tsx`

**Q: How do I test multi-page navigation?**
→ See [E2E Testing Advanced Patterns](../E2E-TESTING-ADVANCED-PATTERNS.md)
→ Also check: [Visual Editor E2E Quick Reference](../visual-editor-e2e-quick-reference.md)

---

## For Code Reviews

### Multi-Agent Review Process

→ [Multi-Agent Code Review Workflow](./multi-agent-code-review-workflow-systematic-triage-MAIS-20251224.md)

### Performance Checklist

→ [React Memoization Quick Reference](../react-performance/REACT-MEMOIZATION-QUICK-REFERENCE.md) (Code Review Checklist, line 101)

### Accessibility Checklist

→ [React Hooks Performance & WCAG Review](./react-hooks-performance-wcag-review.md) (Prevention Checklist, line 176)

### Next.js Pre-Merge Checklist

→ [Next.js Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md) (Prevention Checklist, line 349)

---

## For Architecture Questions

**What is the overall Next.js architecture?**
→ [ADR-014: Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)

**How should multi-tenant isolation work?**
→ [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)

**What are the key patterns in our Next.js setup?**
→ [Web App README](../../../apps/web/README.md)

**What lessons were learned from the migration?**
→ [Next.js Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md) (10 key lessons)

---

## By Component Type

### Navigation Components

- Active link state: [Pattern 1 in CROSSREF](./TENANT_MULTI_PAGE_SITES_DOCUMENTATION_CROSSREF.md)
- Event handlers: [React Hooks Performance & WCAG](./react-hooks-performance-wcag-review.md) (Issue #121)
- Focus indicators: [React Hooks Performance & WCAG](./react-hooks-performance-wcag-review.md) (Issue #122)
- Nested buttons: [React Hooks Performance & WCAG](./react-hooks-performance-wcag-review.md) (Issue #124)

### List Components

- Memoization: [React Memoization Quick Reference](../react-performance/REACT-MEMOIZATION-QUICK-REFERENCE.md) (Pattern 2)
- Performance: [React Memo Unstable Callbacks](../performance-issues/react-memo-unstable-callbacks-visual-editor-MAIS-20251204.md)

### Page Components

- Error handling: [Next.js Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md) (Lesson 4)
- Data fetching: [Next.js Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md) (Lesson 9)
- Loading states: [Web App README](../../../apps/web/README.md)

---

## By Problem Type

### Performance Issues

1. "Component re-renders on every parent update"
   → [React Memoization Quick Reference](../react-performance/REACT-MEMOIZATION-QUICK-REFERENCE.md)

2. "Data fetching duplicated on same page"
   → [Next.js Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md) (Lesson 9: React cache())

3. "Callback reference changes every render"
   → [React Hooks Performance & WCAG](./react-hooks-performance-wcag-review.md) (Issue #121)

### Accessibility Issues

1. "Can't tab to navigation links"
   → [React Hooks Performance & WCAG](./react-hooks-performance-wcag-review.md) (Issue #122)

2. "Active link state not visible"
   → [CROSSREF Pattern 1](./TENANT_MULTI_PAGE_SITES_DOCUMENTATION_CROSSREF.md)

3. "Color is the only state indicator"
   → [React Hooks Performance & WCAG](./react-hooks-performance-wcag-review.md) (Issue #123)

### Multi-Page Issues

1. "Navigation doesn't show active page"
   → [CROSSREF Pattern 1](./TENANT_MULTI_PAGE_SITES_DOCUMENTATION_CROSSREF.md), [Impersonation Navigation Bug](../ui-bugs/impersonation-sidebar-navigation-bug.md)

2. "Page shows blank on error"
   → [Next.js Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md) (Lesson 4)

3. "Pages load slowly"
   → [Next.js Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md) (Lesson 9)

### Security Issues

1. "Backend token exposed in browser console"
   → [Next.js Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md) (Lesson 1)

2. "Data from other tenants visible"
   → [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)

---

## By Role

### Frontend Developer

**Start Here:** [React Memoization Quick Reference](../react-performance/REACT-MEMOIZATION-QUICK-REFERENCE.md)
**Then Read:** [React Hooks Performance & WCAG](./react-hooks-performance-wcag-review.md)
**Reference:** [Web App README](../../../apps/web/README.md)

### Code Reviewer

**Start Here:** [TENANT_MULTI_PAGE_SITES_DOCUMENTATION_CROSSREF.md](./TENANT_MULTI_PAGE_SITES_DOCUMENTATION_CROSSREF.md) (Implementation Checklist)
**Then Read:** All prevention checklists linked in checklist
**Use:** [Multi-Agent Code Review Workflow](./multi-agent-code-review-workflow-systematic-triage-MAIS-20251224.md)

### QA / E2E Tester

**Start Here:** [E2E Testing Advanced Patterns](../E2E-TESTING-ADVANCED-PATTERNS.md)
**Then Read:** [Visual Editor E2E Quick Reference](../visual-editor-e2e-quick-reference.md)
**Reference:** [ADR-014](../../adrs/ADR-014-nextjs-app-router-migration.md) (Architecture context)

### Architect / Tech Lead

**Start Here:** [ADR-014: Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)
**Then Read:** [Next.js Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md)
**Reference:** [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)

---

## Document Relationships

```
ADR-014 (Architecture)
  ↓
  ├─→ Web App README (Implementation)
  ├─→ Next.js Lessons Learned (10 key fixes + prevention)
  └─→ Multi-Tenant Implementation Guide (Data isolation)

Next.js Lessons Learned
  ├─→ Lesson 9: React cache()
  │   → React Memoization Quick Reference
  │   → React Memo Unstable Callbacks
  │
  ├─→ Lesson 1: Security (tokens)
  │   → CLAUDE.md (global standards)
  │
  └─→ Lesson 4: Error boundaries
      → Web App README

React Hooks Performance & WCAG
  ├─→ useCallback patterns
  │   → React Memoization Quick Reference
  │
  ├─→ aria-current navigation
  │   → Impersonation Navigation Bug
  │   → CROSSREF Pattern 1
  │
  └─→ focus-visible accessibility
      → PR #12 Prevention Strategies

E2E Testing
  ├─→ Playwright patterns
  │   → Visual Editor E2E Quick Reference
  │
  └─→ Multi-page flows
      → ADR-014 (architecture context)
```

---

## Quick Copy-Paste Patterns

### Navigation with Active State

```typescript
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`
        focus:outline-none focus-visible:ring-2 focus-visible:ring-sage
        ${isActive ? 'bg-sage text-white' : 'hover:bg-sage/10'}
      `}
    >
      {children}
    </Link>
  );
}
```

### Memoized List Component

```typescript
const ListItem = React.memo(
  function ListItem({ item, onSelect }) {
    return (
      <button
        onClick={() => onSelect(item.id)}
        className="focus-visible:ring-2 focus-visible:ring-sage"
      >
        {item.name}
      </button>
    );
  }
);
ListItem.displayName = 'ListItem';
```

### Data Fetching with cache()

```typescript
import { cache } from 'react';

export const getTenantPages = cache(
  async (slug: string) => {
    return await api.getTenantPages({ slug });
  }
);

// Usage - deduplicated automatically
export async function Layout() {
  const pages = await getTenantPages(slug);
  return <Navigation pages={pages} />;
}
```

### Dynamic Route Error Boundary

```typescript
// app/t/[slug]/error.tsx
'use client';

export default function Error({ error, reset }) {
  return (
    <div>
      <h1>Error loading tenant page</h1>
      <p>{error.message}</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

---

## Prevention Checklists

### Before Committing Code

→ [TENANT_MULTI_PAGE_SITES_DOCUMENTATION_CROSSREF.md](./TENANT_MULTI_PAGE_SITES_DOCUMENTATION_CROSSREF.md) (Implementation Checklist)

### React Performance Review

→ [React Memoization Quick Reference](../react-performance/REACT-MEMOIZATION-QUICK-REFERENCE.md) (Code Review Checklist, line 101)

### Accessibility Review

→ [React Hooks Performance & WCAG](./react-hooks-performance-wcag-review.md) (Prevention Checklist, line 176)

### Next.js Migration Review

→ [Next.js Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md) (Prevention Checklist, line 349)

---

## Related Standards & Guidelines

- **CLAUDE.md** (root) - Overall project standards
- **docs/design/BRAND_VOICE_GUIDE.md** - UI/UX standards
- **docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md** - Multi-tenant patterns
- **PREVENTION-QUICK-REFERENCE.md** - General prevention strategies

---

## Recent Commits to Reference

| Commit  | Change                      | Related Docs                             |
| ------- | --------------------------- | ---------------------------------------- |
| f68e9f5 | Multi-page navigation added | ADR-014, Web App README                  |
| b16379a | P1 accessibility fixes      | React Hooks Performance & WCAG, CROSSREF |
| 661d464 | P2/P3 code review fixes     | React Memoization, E2E patterns          |

---

**Last Updated:** 2025-12-25
**Maintained By:** Claude Code
**Print This Index for Quick Reference**
