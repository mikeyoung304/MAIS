---
title: Next.js Documentation Cross-Reference Analysis
module: MAIS
date: 2026-01-05
type: analysis
status: in_progress
task_origin: claude_code_documentation_analysis
---

# Next.js Documentation Cross-Reference Analysis

## Executive Summary

This analysis identifies existing Next.js documentation in the MAIS codebase and provides recommendations for:

1. **Cross-referencing between related documents**
2. **Identifying documentation gaps**
3. **Consolidating overlapping content**
4. **Adding missing patterns** (loading.tsx, React Query, ARIA accessibility)

**Key Finding:** The codebase has comprehensive pattern documentation but lacks:

- Unified "Next.js Patterns Guide" for new developers
- loading.tsx best practices documentation
- React Query integration patterns in Next.js
- Comprehensive accessibility checklists for form components
- Server Component data fetching patterns

---

## Part 1: Existing Documentation Inventory

### Core Next.js Migration Documents

#### 1. Next.js Migration: Lessons Learned

**File:** `/docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md`

**Scope:** 432 lines

**Coverage:**

- 10 key lessons from Vite → Next.js 14 migration
- Security patterns (token exposure, session duration)
- Error boundary requirements
- Performance optimization (React cache())
- API contract patterns
- Code review findings from 6-phase migration

**Key Insights:**

- Consolidate auth systems early (NextAuth vs legacy context)
- Error boundaries mandatory on dynamic routes
- Data fetching must be deduplicated with `React.cache()`
- Backend contracts required before frontend calls

**Recommendations for Cross-Reference:**

- Link to from: Hydration Mismatch doc (Lesson 9 mentions cache())
- Link to from: Auth Accessibility doc (Lesson 7 mentions session duration)
- Link to from: Architecture guide (overall migration decisions)

---

#### 2. Hydration Mismatch Prevention Strategies

**File:** `/docs/solutions/HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md`

**Scope:** 656 lines

**Coverage:**

- 3 common hydration mismatch causes
- Return null during SSR issue (with code examples)
- Time-based rendering differences (timestamps)
- Window-dependent code in render
- SSR-safe skeleton patterns
- CLS (Cumulative Layout Shift) prevention
- Code review checklist for hydration safety

**Key Insights:**

- Always render placeholder, never null
- Placeholder must match final content dimensions
- Hydration flag pattern: `const [isHydrated, setIsHydrated] = useState(false)`
- useEffect for data fetching, never in render

**Recommendations for Cross-Reference:**

- Link from Next.js Migration (covers data loading patterns)
- Link from loading.tsx guide (covers skeleton patterns)
- Link from Auth Accessibility (CLS affects perceived performance)
- Reference in CLAUDE.md as P1 prevention strategy

---

#### 3. Auth Form Accessibility Prevention Strategies

**File:** `/docs/solutions/AUTH_FORM_ACCESSIBILITY_PREVENTION-MAIS-20251230.md`

**Scope:** 858 lines (partial read, continues further)

**Coverage:**

- 6 accessibility issues from signup page
- Keyboard accessibility (tabIndex, aria-label)
- ARIA attributes (aria-invalid, aria-describedby)
- Form structure and semantics
- Visual design (focus rings, contrast)
- Loading state handling (prevents CLS)

**Key Insights:**

- Never use `tabIndex={-1}` on interactive elements
- Form inputs must have `aria-invalid` and `aria-describedby`
- Error messages need matching `id` attribute
- Loading skeletons must match final content dimensions

**Recommendations for Cross-Reference:**

- Link from Hydration doc (CLS discussion)
- Link from loading.tsx patterns (skeleton sizing)
- Include in code review checklist templates
- Reference design system docs

---

### Next.js Routing & Architecture Documents

#### 4. Next App Router Dual Route Deduplication

**File:** `/docs/solutions/architecture/NEXT_APP_ROUTER_DUAL_ROUTE_DEDUPLICATION.md`

**Suggests:**

- Pattern for handling dual route types ([slug] vs \_domain)
- Route organization for multi-tenant apps
- Deduplication strategies

**Potential Cross-References Needed:**

- From tenant storefront guide
- From Custom domain setup guide

---

#### 5. Next App Router Routing Abstraction Pattern

**File:** `/docs/solutions/architecture/NEXT_APP_ROUTER_ROUTING_ABSTRACTION_PATTERN.md`

**Suggests:**

- Route handling abstraction
- Middleware patterns for Next.js
- Unified routing logic

---

### Related Authentication Documents

#### 6. NextAuth v5 Prevention Index

**File:** `/docs/solutions/authentication-issues/NEXTAUTH-V5-PREVENTION-INDEX.md`

**Scope:** Index/checklist

**Coverage:**

- NextAuth.js v5 configuration patterns
- Session setup
- JWT handling
- Cookie configuration (HTTPS prefix handling)
- Impersonation flows

**Recommendations for Cross-Reference:**

- From Next.js Migration doc (Lesson 1 on token exposure)
- From backend token security guide
- From logout and session refresh patterns

---

### Component & Pattern Documents

#### 7. React Custom Hooks Extraction Pattern

**File:** `/docs/solutions/best-practices/react-custom-hooks-extraction-MAIS-20251205.md`

**Suggests:**

- Custom hook extraction for client components
- State management patterns in Next.js
- Reusable data fetching hooks

**Cross-Reference Value:**

- Needed by React Query integration guide (missing)
- Referenced by component library standards

---

## Part 2: Critical Documentation Gaps

### Gap 1: Unified loading.tsx Patterns Guide

**Current State:**

- 25+ `loading.tsx` files exist in codebase
- Two examples reviewed:
  - `/signup/loading.tsx` - Form skeleton with CLS prevention
  - `/t/[slug]/(site)/loading.tsx` - Generic `HomePageSkeleton`
- No centralized documentation

**What's Missing:**

- [ ] Unified loading.tsx patterns guide
- [ ] When to use loading.tsx vs error.tsx
- [ ] Skeleton component guidelines
- [ ] CLS prevention checklist
- [ ] Examples for different route types:
  - [ ] Static routes (signup, login)
  - [ ] Dynamic routes ([slug])
  - [ ] Parameterized routes ([packageSlug])
  - [ ] Nested routes (multi-level)

**Recommended Document:**

```
File: /docs/solutions/nextjs-patterns/NEXTJS_LOADING_TSX_PATTERNS.md
Scope: 400-500 lines
Sections:
1. When to use loading.tsx (route-level Suspense)
2. Skeleton component patterns
3. CLS prevention (dimension matching)
4. Examples: signup, tenants, booking flow
5. Integration with hydration safety
6. Code review checklist
7. Testing strategies
```

**Cross-References:**

- From: Hydration Mismatch Prevention
- From: Auth Form Accessibility (CLS discussion)
- From: Next.js Migration Lessons (React.cache() context)

---

### Gap 2: React Query Integration in Next.js

**Current State:**

- `@tanstack/react-query ^5.56.2` installed
- 19 usages of useQuery/useMutation across web app
- No integration guide exists
- Default QueryClient setup in `/apps/web/src/lib/query-client.ts`

**What's Missing:**

- [ ] React Query + Next.js Server Components patterns
- [ ] When to use React Query vs React.cache()
- [ ] Client component data fetching with React Query
- [ ] SSR considerations for React Query
- [ ] Hydration with QueryClient
- [ ] Cache invalidation patterns
- [ ] Error handling with React Query
- [ ] Examples:
  - [ ] Dashboard data fetching
  - [ ] Form submissions
  - [ ] Real-time updates
  - [ ] Pagination

**Recommended Document:**

```
File: /docs/solutions/nextjs-patterns/REACT_QUERY_NEXTJS_INTEGRATION.md
Scope: 600-700 lines
Sections:
1. React Query vs React.cache() decision tree
2. Setup and configuration
3. Server Component wrappers
4. Client Component patterns
5. SSR hydration strategy
6. Error handling
7. Cache invalidation
8. Code examples
9. Common pitfalls
10. Testing strategies
```

**Cross-References:**

- From: Next.js Migration Lessons (React.cache())
- From: Hydration Mismatch Prevention
- From: Custom Hooks extraction
- From: React Query DevTools setup

---

### Gap 3: Comprehensive ARIA/Accessibility Patterns

**Current State:**

- `AUTH_FORM_ACCESSIBILITY_PREVENTION-MAIS-20251230.md` covers signup/login forms
- Only 100 lines of content visible (document continues)
- ESLint accessibility rules configured
- No centralized checklist for all component types

**What's Missing:**

- [ ] Unified accessibility checklist for all form types
- [ ] Aria labels and descriptions patterns
- [ ] Focus management strategies
- [ ] Color contrast requirements
- [ ] Keyboard navigation patterns
- [ ] Screen reader testing guide
- [ ] Examples:
  - [ ] Modal dialogs
  - [ ] Dropdowns/combobox
  - [ ] Date pickers
  - [ ] File uploads
  - [ ] Rich text editors

**Recommended Document:**

```
File: /docs/solutions/patterns/ACCESSIBILITY_COMPREHENSIVE_CHECKLIST.md
Scope: 800-1000 lines
Sections:
1. WCAG 2.1 AA requirements summary
2. Form controls checklist
3. Navigation and page structure
4. Color and contrast
5. Focus management
6. ARIA patterns
7. Component patterns (modal, dropdown, etc.)
8. Testing with screen readers
9. Automated testing with axe-core
10. Common pitfalls
11. Code review checklist
```

**Cross-References:**

- From: Auth Form Accessibility (extends to all forms)
- From: Design system documentation
- Include in CLAUDE.md critical patterns
- Reference in code review guidelines

---

### Gap 4: Server Component Data Fetching Patterns

**Current State:**

- Next.js Migration mentions React.cache() pattern
- Hydration doc covers client-side patterns
- No unified server-side guide

**What's Missing:**

- [ ] Fetching patterns in Server Components
- [ ] When to use fetch() vs ORM
- [ ] Error handling in Server Components
- [ ] Loading states (loading.tsx + Suspense)
- [ ] Revalidation strategies (ISR, on-demand)
- [ ] Database client setup
- [ ] Prisma integration patterns
- [ ] Examples:
  - [ ] Homepage data fetching
  - [ ] Tenant profile page
  - [ ] Dynamic pricing data
  - [ ] Search/filtering

**Recommended Document:**

```
File: /docs/solutions/nextjs-patterns/SERVER_COMPONENT_DATA_FETCHING.md
Scope: 500-600 lines
Sections:
1. Server Component advantages
2. Data fetching with fetch()
3. Prisma integration (with tenantId scoping)
4. React.cache() for deduplication
5. Error handling and error.tsx
6. Loading states and Suspense
7. Revalidation: ISR, revalidateTag, revalidatePath
8. Multi-tenant isolation in Server Components
9. Performance optimization
10. Security patterns
11. Code examples
12. Common pitfalls
```

**Cross-References:**

- From: Next.js Migration Lessons
- From: Hydration Mismatch (client vs server responsibilities)
- From: Multi-tenant implementation guide
- From: Prisma patterns

---

## Part 3: Recommended Documentation Updates

### Priority 1: Create Missing Documents (P1)

These documents are blocking best practices and should be created immediately:

1. **NEXTJS_LOADING_TSX_PATTERNS.md** - 25 loading.tsx files need guidance
2. **REACT_QUERY_NEXTJS_INTEGRATION.md** - 19 useQuery calls need patterns
3. **SERVER_COMPONENT_DATA_FETCHING.md** - Extend React.cache() lesson from migration

### Priority 2: Update Existing Documents (P2)

#### Update: nextjs-migration-lessons-learned-MAIS-20251225.md

**Add Cross-References Section:**

```markdown
## Cross-References

This document is referenced by and should be read alongside:

1. **[Hydration Mismatch Prevention](../HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md)**
   - Lesson 9 (React cache()) expands on deduplication
   - Lesson 4 (Error Boundaries) applies to Hydration mismatches

2. **[Auth Form Accessibility](../AUTH_FORM_ACCESSIBILITY_PREVENTION-MAIS-20251230.md)**
   - Lesson 7 (Session Duration) impacts session config
   - Lesson 6 (Logger utility) applies to all Next.js code

3. **[NextAuth v5 Prevention Index](../authentication-issues/NEXTAUTH-V5-PREVENTION-INDEX.md)**
   - Lesson 1 (Token Exposure) critical security pattern
   - Lesson 3 (Consolidate Auth) implementation guide

4. **NEXTJS_LOADING_TSX_PATTERNS.md** (to be created)
   - Extends Lesson 4 (Error Boundaries) with loading patterns
   - CLS prevention relates to skeleton patterns

5. **REACT_QUERY_NEXTJS_INTEGRATION.md** (to be created)
   - Lesson 9 (React.cache()) vs React Query decision tree
   - Data fetching strategy selection

6. **SERVER_COMPONENT_DATA_FETCHING.md** (to be created)
   - Lesson 5 (Frontend Features Need Backend) - contract-first
   - Lesson 9 (React cache()) - server-side deduplication
```

**Add Quick Links Section:**

```markdown
## Quick Links by Use Case

- **"How do I build a new tenant page?"** → See Lesson 9 (React.cache()), then create loading.tsx
- **"How do I handle data loading?"** → See Lesson 9, then REACT_QUERY_NEXTJS_INTEGRATION
- **"Why is my page flickering?"** → See Hydration Mismatch Prevention
- **"How do I protect auth tokens?"** → See Lesson 1, then NEXTAUTH-V5-PREVENTION-INDEX
```

---

#### Update: HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md

**Add Context and Links:**

```markdown
## Related Documents

This document should be read alongside:

1. **[Next.js Migration: Lessons Learned](../code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)**
   - Lesson 4: Error Boundaries prevent white screens from hydration errors
   - Lesson 9: React.cache() prevents double fetches during SSR

2. **[Loading.tsx Patterns Guide](./NEXTJS_LOADING_TSX_PATTERNS.md)** (to be created)
   - Skeletons vs placeholders
   - CLS prevention matching dimensions

3. **[Auth Form Accessibility](../AUTH_FORM_ACCESSIBILITY_PREVENTION-MAIS-20251230.md)**
   - CLS impacts accessibility scoring
   - Dimension matching prevents visual jumps

4. **[React Query Integration](./REACT_QUERY_NEXTJS_INTEGRATION.md)** (to be created)
   - Client-side data patterns
   - Hydration with QueryClient

5. **[Server Component Data Fetching](./SERVER_COMPONENT_DATA_FETCHING.md)** (to be created)
   - Server-side considerations
   - useEffect timing for client-side data
```

**Add "When to Use" Decision Tree:**

```markdown
## Decision Tree: SSR vs Client Rendering
```

Does your data need to be fetched from:

├─ Server-only source (database, environment)?
│ └─ Use Server Component + React.cache() → No hydration issues
│
├─ Public API (browser can call)?
│ ├─ Large/expensive data?
│ │ └─ Use loading.tsx + Suspense
│ │
│ └─ Small/fast data?
│ └─ Fetch in useEffect (client-side) → Match placeholder dimensions
│
└─ Protected/tenant-scoped data?
└─ Use React Query + hydration strategy → See integration guide

````
---

#### Update: AUTH_FORM_ACCESSIBILITY_PREVENTION-MAIS-20251230.md

**Add Index/Navigation:**

```markdown
## Quick Navigation

- **[Section A: Keyboard Accessibility](#a-keyboard-accessibility-p1-priority)** - Tab navigation, focus rings
- **[Section B: ARIA Attributes](#b-aria-attributes-p2-priority)** - aria-invalid, aria-describedby
- **[Section C: Visual Design](#visual-design)** - Contrast, focus indicators
- **[Section D: Loading & CLS](#loading-and-cls-prevention)** - Skeleton sizing
- **[Code Review Checklist](#code-review-checklist-for-form-components)** - Apply to all forms
````

**Add Cross-References:**

```markdown
## Related Documents

- **[Hydration Mismatch Prevention](../HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md)**
  - CLS (Cumulative Layout Shift) impacts accessibility score
  - See "Issue 1: Returning Null During SSR" for skeleton patterns

- **[Next.js Migration Lessons](../code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)**
  - Lesson 6: Logger utility instead of console.log
  - Lesson 7: Session duration affects authentication UX

- **[Loading.tsx Patterns](./NEXTJS_LOADING_TSX_PATTERNS.md)** (to be created)
  - How to structure loading skeletons
  - Preventing CLS with proper dimensions

- **[Design System: BRAND_VOICE_GUIDE](../../design/BRAND_VOICE_GUIDE.md)**
  - Form design patterns
  - Color palette and contrast
  - Input field styling
```

---

### Priority 3: Consolidation Opportunities

#### 1. Consolidate Accessibility Checklists

**Current:** Scattered across:

- AUTH_FORM_ACCESSIBILITY_PREVENTION-MAIS-20251230.md
- ESLINT_A11Y_SETUP-MAIS-20251230.md
- design/BRAND_VOICE_GUIDE.md

**Recommended Action:**

- Create master `/docs/solutions/patterns/ACCESSIBILITY_MASTER_INDEX.md`
- Point from each doc to master index
- Organize by component type (forms, modals, navigation, etc.)
- Include ESLint rules, WCAG references, testing patterns

#### 2. Consolidate Loading Patterns

**Current:** Scattered across:

- HYDRATION_MISMATCH_PREVENTION (CLS discussion)
- AUTH_FORM_ACCESSIBILITY (skeleton sizing)
- Next.js Migration Lessons (error boundaries)
- 25 different loading.tsx implementations

**Recommended Action:**

- Create single source of truth: NEXTJS_LOADING_TSX_PATTERNS.md
- Explain hierarchy: loading.tsx → Suspense → useEffect
- Link from all three documents above

---

## Part 4: Document Relationship Map

```
┌─────────────────────────────────────────────────────────────────┐
│  NEXTJS_PATTERNS_MASTER_INDEX.md (to create)                  │
│  "Where to go for Next.js questions"                          │
└─────────────────────────────────────────────────────────────────┘
                         ↓
    ┌────────────────────┼────────────────────┐
    ↓                    ↓                    ↓

Next.js Migration      Hydration Mismatch    Auth Accessibility
Lessons Learned        Prevention            Prevention
(existing)             (existing)             (existing)
• 10 lessons           • 3 SSR issues        • Form patterns
• Consolidate auth     • Skeleton patterns   • ARIA attributes
• Error boundaries     • CLS prevention      • Keyboard nav
• React.cache()        • Testing             • Focus management
    │                      │                     │
    └──────────┬───────────┴─────────────┬──────┘
               │                         │
               ↓                         ↓

    NEXTJS_LOADING_TSX_     REACT_QUERY_NEXTJS_
    PATTERNS.md             INTEGRATION.md
    (to create)             (to create)
    • When to use           • useQuery in Next.js
    • Skeleton design       • QueryClient setup
    • CLS prevention        • SSR hydration
    • Nested routes         • Cache invalidation
               │                     │
               └────────┬────────────┘
                        ↓
    SERVER_COMPONENT_DATA_
    FETCHING.md
    (to create)
    • Server-only sources
    • Prisma patterns
    • Revalidation
    • Multi-tenant scoping
```

---

## Part 5: Recommended Action Plan

### Week 1: Create Priority 1 Documents

1. **NEXTJS_LOADING_TSX_PATTERNS.md**
   - Time: 2-3 hours
   - Review 25 existing loading.tsx files
   - Extract patterns and skeleton designs
   - Add CLS prevention checklist
   - Link from Hydration and Auth Accessibility docs

2. **REACT_QUERY_NEXTJS_INTEGRATION.md**
   - Time: 3-4 hours
   - Document existing useQuery usages
   - Create decision tree (React Query vs React.cache())
   - Add SSR hydration patterns
   - Link from Next.js Migration lesson 9

3. **SERVER_COMPONENT_DATA_FETCHING.md**
   - Time: 2-3 hours
   - Extend React.cache() from migration lesson
   - Add Prisma + tenantId scoping
   - Revalidation strategies
   - Multi-tenant isolation patterns

### Week 2: Update Existing Documents

1. Add cross-references to:
   - Next.js Migration Lessons (add related docs section)
   - Hydration Mismatch Prevention (add decision tree)
   - Auth Form Accessibility (add form types)

2. Create master index:
   - NEXTJS_PATTERNS_MASTER_INDEX.md
   - ACCESSIBILITY_COMPREHENSIVE_CHECKLIST.md

### Week 3: Integration

1. Update CLAUDE.md with new links
2. Update README files with references
3. Link from architecture docs
4. Add to code review checklists

---

## Summary Table: Existing Docs

| Document                      | Lines | Coverage                | Cross-Refs | Status                      |
| ----------------------------- | ----- | ----------------------- | ---------- | --------------------------- |
| Next.js Migration Lessons     | 432   | 10 migration lessons    | Limited    | ✅ Active - needs links     |
| Hydration Mismatch Prevention | 656   | 3 SSR issues + patterns | Limited    | ✅ Active - needs links     |
| Auth Form Accessibility       | 858+  | Forms + ARIA + keyboard | Limited    | ✅ Active - incomplete read |
| NextAuth v5 Prevention Index  | ?     | Auth + session + JWT    | Limited    | ✅ Active                   |
| Custom Hooks Extraction       | ?     | Hook patterns           | Limited    | ✅ Active                   |
| App Router Dual Routes        | ?     | Route organization      | Limited    | ✅ Active                   |

---

## Summary Table: Missing Docs

| Document                      | Priority | Lines    | Complexity  | Blockers                      |
| ----------------------------- | -------- | -------- | ----------- | ----------------------------- |
| Loading.tsx Patterns          | P1       | 400-500  | Medium      | 25 files need guidance        |
| React Query Integration       | P1       | 600-700  | Medium-High | 19 useQuery calls             |
| Server Component Fetching     | P1       | 500-600  | Medium      | React.cache() unclear         |
| Accessibility Comprehensive   | P2       | 800-1000 | Medium      | Multiple scattered checklists |
| Next.js Patterns Master Index | P2       | 200-300  | Low         | Documentation organization    |

---

## File Paths Summary

### Existing Documents (Should be Cross-Referenced)

```
✅ /docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md
✅ /docs/solutions/HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md
✅ /docs/solutions/AUTH_FORM_ACCESSIBILITY_PREVENTION-MAIS-20251230.md
✅ /docs/solutions/AUTH_FORM_ACCESSIBILITY_QUICK_CHECKLIST-MAIS-20251230.md
✅ /docs/solutions/authentication-issues/NEXTAUTH-V5-PREVENTION-INDEX.md
✅ /docs/solutions/best-practices/react-custom-hooks-extraction-MAIS-20251205.md
✅ /docs/solutions/architecture/NEXT_APP_ROUTER_DUAL_ROUTE_DEDUPLICATION.md
✅ /docs/solutions/architecture/NEXT_APP_ROUTER_ROUTING_ABSTRACTION_PATTERN.md
```

### Documents to Create

```
📋 /docs/solutions/nextjs-patterns/NEXTJS_LOADING_TSX_PATTERNS.md
📋 /docs/solutions/nextjs-patterns/REACT_QUERY_NEXTJS_INTEGRATION.md
📋 /docs/solutions/nextjs-patterns/SERVER_COMPONENT_DATA_FETCHING.md
📋 /docs/solutions/patterns/ACCESSIBILITY_COMPREHENSIVE_CHECKLIST.md
📋 /docs/solutions/NEXTJS_PATTERNS_MASTER_INDEX.md
```

---

## Key Findings

1. **Consolidation Needed:** 3 major patterns (loading, hydration, accessibility) are spread across 3 documents with limited cross-referencing

2. **Documentation Gaps:** 25 loading.tsx files exist without guidance; 19 React Query usages without integration patterns

3. **Best Practices Evident:** Good patterns exist (React.cache(), skeleton sizing, ARIA attributes) but scattered and hard to find

4. **Cross-Reference Opportunities:** Migration lessons reference React.cache() and error boundaries - these should link to loading.tsx and hydration patterns

5. **Accessibility Priority:** Auth forms are documented, but patterns should extend to all form types (modals, combobox, date picker, etc.)

6. **Update Frequency:** Recent documents (Dec 2025 - Jan 2026) show active documentation maintenance - good time to consolidate

---

## Next Steps

1. ✅ This analysis complete
2. 📋 Create master index linking all Next.js docs
3. 📋 Create NEXTJS_LOADING_TSX_PATTERNS.md (400-500 lines)
4. 📋 Create REACT_QUERY_NEXTJS_INTEGRATION.md (600-700 lines)
5. 📋 Update cross-references in existing 3 documents
6. 📋 Update CLAUDE.md with new documentation links
