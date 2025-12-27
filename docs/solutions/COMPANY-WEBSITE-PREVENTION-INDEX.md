# Company Website vs. Tenant Storefront: Prevention Strategy Index

**Problem Solved:** The HANDLED marketing homepage was accidentally configured as a tenant redirect (`/t/handled`), causing 404 errors because no "handled" tenant existed in the database.

**Root Cause:** Architectural confusion between two distinct systems that shouldn't be mixed.

---

## Document Guide

This prevention strategy consists of 5 documents. Read them in order:

### 1. **Quick Reference** (30 seconds)
**File:** `COMPANY-VS-TENANT-QUICK-CHECK.md`

**When to use:** Before writing any page code. Print and pin to monitor.

**Contains:**
- 30-second decision tree: "Is this company or tenant content?"
- Quick URL patterns
- Pre-commit checklist
- Code pattern snippets

**Start here if:** You're about to write a page and need clarification.

---

### 2. **Comprehensive Prevention Strategy** (15 minutes)
**File:** `COMPANY-WEBSITE-TENANT-CONFUSION-PREVENTION.md`

**When to use:** First time reading, or when onboarding new team members.

**Contains:**
- Part 1: Architectural decision framework
- Part 2: Code review checklist
- Part 3: Pre-deployment checklist
- Part 4: Testing strategies
- Part 5: Real-world scenarios & patterns
- Part 6: Common mistakes & fixes
- Part 7: Quick reference by component type
- Part 8: Implementation verification

**Start here if:** You want the full context and mental model.

---

### 3. **Code Review Checklist** (During reviews)
**File:** `COMPANY-WEBSITE-CODE-REVIEW-CHECKLIST.md`

**When to use:** Reviewing any PR that touches pages/routing in `apps/web/src/app/`.

**Contains:**
- Pre-review questions to ask author
- Specific code patterns to search for (grep commands)
- Company page checklist
- Tenant page checklist
- Combined checklist for both
- Database validation
- Testing verification
- Common issues to catch
- Sign-off criteria

**Start here if:** You're reviewing a PR and want to verify it follows the pattern.

---

### 4. **Testing Strategies** (For QA and devs)
**File:** `COMPANY-WEBSITE-TESTING-STRATEGIES.md`

**When to use:** Writing tests or validating before deployment.

**Contains:**
- Part 1: Unit testing (verify no DB lookups in company pages)
- Part 2: Integration testing (database state independence)
- Part 3: E2E testing with Playwright
- Part 4: Test helpers
- Part 5: Pre-deployment test checklist

**Start here if:** You're writing tests or preparing for deployment.

---

### 5. **This Index**
**File:** `COMPANY-WEBSITE-PREVENTION-INDEX.md`

Navigation and quick reference for all prevention documents.

---

## The One-Sentence Rule

Before writing any page code, ask yourself:

**"Is this [COMPANY|TENANT] content?"**

- **COMPANY:** Marketing pages (/, /features, /pricing, /signup)
  - URL pattern: Static path, no `/t/`
  - Database: Optional (hardcode content)
  - Implementation: `src/app/page.tsx` or `src/app/(marketing)/`

- **TENANT:** Storefront pages (/t/jane-photography, custom domain)
  - URL pattern: `/t/[slug]/` or `/t/_domain/`
  - Database: REQUIRED (must exist)
  - Implementation: `src/app/t/[slug]/` with `getTenantBySlug()`

If you can't clearly answer, ask for clarification before coding.

---

## Critical Rules (Never Break These)

1. **Never create a database tenant for company content**
   - No tenant with slug `'handled'`, `'company'`, `'maconaisolutions'`, `'app'`
   - These are company domains → use static pages

2. **Never mix company and tenant logic**
   - Company pages: No `getTenantBySlug()` calls
   - Tenant pages: MUST call `getTenantBySlug()` or `getTenantByDomain()`

3. **Never skip tenant existence checks**
   - Tenant pages must have: `if (!tenant) notFound()`
   - Otherwise invalid slugs won't 404

4. **Never hardcode company content on tenant pages**
   - Tenant pages must render tenant-specific data
   - Example: `/t/[slug]` should show tenant's name, not "HANDLED"

5. **Never add company domains to tenant routes**
   - `KNOWN_DOMAINS` in `middleware.ts` prevents `/t/_domain` rewrites

---

## Quick Navigation

### If You're...

**...writing a new company page (/, /features, /signup, etc.):**
1. Read: `COMPANY-VS-TENANT-QUICK-CHECK.md` (30 sec)
2. Pattern: No `getTenantBySlug()` call
3. Content: Hardcode features, pricing, CTAs
4. Test: Verify works without database

**...writing a new tenant page (/t/[slug]/, /t/_domain/, etc.):**
1. Read: `COMPANY-VS-TENANT-QUICK-CHECK.md` (30 sec)
2. Pattern: Must call `getTenantBySlug()`
3. Content: Use tenant configuration
4. Test: Verify 404s for missing tenants

**...reviewing a PR with routing changes:**
1. Ask author: "Is this company or tenant content?"
2. Use: `COMPANY-WEBSITE-CODE-REVIEW-CHECKLIST.md`
3. Verify: Correct patterns and tests
4. Check: Database state (no company tenants)

**...writing tests:**
1. Reference: `COMPANY-WEBSITE-TESTING-STRATEGIES.md`
2. Unit tests: No DB lookups in company pages
3. Integration tests: Tenant pages 404 on missing tenants
4. E2E tests: Full workflow validation

**...deploying to production:**
1. Checklist: Pre-deployment section in main guide
2. Verify: `npm run typecheck` and all tests pass
3. Check: Database state (no company tenants)
4. Confirm: KNOWN_DOMAINS updated for any new company domains

---

## The Architecture in One Picture

```
MAIS Application Structure
├── Company Marketing Pages (Static)
│   ├── / (root homepage)
│   ├── /signup
│   ├── /login
│   ├── /forgot-password
│   └── /(marketing)/ [optional grouping]
│
│   Implementation:
│   ├── Hardcoded content (no database lookup)
│   ├── Static features, pricing, CTAs
│   ├── No tenant lookup required
│   └── URLs don't include /t/
│
└── Tenant Storefronts (Dynamic)
    ├── /t/[slug]/ (slug-based routes)
    │   ├── /t/[slug]/ (home)
    │   ├── /t/[slug]/about
    │   ├── /t/[slug]/services
    │   └── ... (other pages)
    │
    └── /t/_domain/ (custom domain routes)
        ├── /t/_domain/ (home, via middleware)
        ├── /t/_domain/about
        ├── /t/_domain/services
        └── ... (other pages)

    Implementation:
    ├── Fetches tenant from database
    ├── Returns 404 if tenant not found
    ├── Renders tenant-specific content
    └── All API calls include X-Tenant-Key header
```

---

## Key Files to Know

### Application Files

| File | Purpose |
|------|---------|
| `apps/web/src/app/page.tsx` | Root homepage (company content) |
| `apps/web/src/app/signup/page.tsx` | Signup page (company) |
| `apps/web/src/app/t/[slug]/(site)/page.tsx` | Tenant home (dynamic) |
| `apps/web/src/app/t/_domain/page.tsx` | Custom domain home (dynamic) |
| `apps/web/src/middleware.ts` | Custom domain rewriting, auth checks |
| `apps/web/src/lib/tenant.ts` | Tenant data fetching functions |

### Prevention Files (This Strategy)

| File | Purpose |
|------|---------|
| `docs/solutions/COMPANY-VS-TENANT-QUICK-CHECK.md` | 30-second decision tree |
| `docs/solutions/COMPANY-WEBSITE-TENANT-CONFUSION-PREVENTION.md` | Full guide (this you're reading) |
| `docs/solutions/COMPANY-WEBSITE-CODE-REVIEW-CHECKLIST.md` | PR review checklist |
| `docs/solutions/COMPANY-WEBSITE-TESTING-STRATEGIES.md` | Test patterns |

---

## Common Scenarios

### Scenario 1: Adding a new company feature page
1. Read: `COMPANY-VS-TENANT-QUICK-CHECK.md`
2. Create: `src/app/features/page.tsx`
3. Code: Hardcode content, no tenant lookup
4. Test: Verify works without database
5. Review: Use company page checklist

### Scenario 2: Fixing a tenant page bug
1. Read: `COMPANY-VS-TENANT-QUICK-CHECK.md`
2. Verify: Has `getTenantBySlug()` call
3. Verify: Has `if (!tenant) notFound()` check
4. Test: Verify 404s on missing tenant
5. Review: Use tenant page checklist

### Scenario 3: Adding a new company domain
1. Update: `middleware.ts` → `KNOWN_DOMAINS`
2. Verify: Domain won't route to `/t/_domain`
3. Test: Domain serves company content
4. Deploy: Verify company pages work

### Scenario 4: Creating a tenant for a demo
1. Don't: Create a tenant with company slug
2. Do: Use `npm run create-tenant` with unique slug
3. Verify: Tenant appears in `/t/[slug]`
4. Never: Use this tenant for company routes

---

## Testing at a Glance

### What Tests Catch

✓ **Company pages don't use database:**
```typescript
expect(getTenantBySlug).not.toHaveBeenCalled();
```

✓ **Tenant pages require tenants:**
```typescript
expect(getTenantBySlug).toHaveBeenCalledWith(slug);
```

✓ **Missing tenant returns 404:**
```typescript
expect(response.status).toBe(404);
```

✓ **Tenant isolation (no data leakage):**
```typescript
expect(page.text()).not.toContain(OTHER_TENANT_NAME);
```

✓ **No "company tenants" exist:**
```typescript
const handled = await db.tenant.findUnique({ where: { slug: 'handled' } });
expect(handled).toBeNull();
```

---

## Glossary

| Term | Definition |
|------|-----------|
| **Company Content** | HANDLED platform marketing (features, pricing, homepage) |
| **Tenant Content** | Individual service professional's storefront |
| **Tenant Storefront** | The `/t/[slug]` or custom domain website |
| **Tenant Lookup** | `getTenantBySlug()` or `getTenantByDomain()` call |
| **Data Isolation** | Ensuring Tenant A doesn't see Tenant B's data |
| **KNOWN_DOMAINS** | List of company domains in middleware (prevents custom domain routing) |
| **Multi-Tenant** | Multiple users (tenants) with separate data and storefronts |

---

## Getting Help

**If you're stuck:**

1. Start with `COMPANY-VS-TENANT-QUICK-CHECK.md` (30 seconds)
2. Check the applicable section in `COMPANY-WEBSITE-TENANT-CONFUSION-PREVENTION.md`
3. Look for your scenario in "Part 5: Real-World Scenarios & Patterns"
4. Reference the code review or testing checklists

**If you're reviewing code:**
- Use `COMPANY-WEBSITE-CODE-REVIEW-CHECKLIST.md`
- Search for red flag patterns (see "Common Issues to Catch")

**If you're writing tests:**
- Use `COMPANY-WEBSITE-TESTING-STRATEGIES.md`
- Copy test patterns and adapt for your routes

---

## Last Updated

**Document Version:** 1.0
**Created:** December 27, 2025
**Status:** Active - In use for all routing reviews

---

## Related Documentation

- **Architecture Guide:** `ARCHITECTURE.md`
- **App Structure:** `apps/web/README.md`
- **Prevention Strategies:** `docs/solutions/PREVENTION-STRATEGIES-INDEX.md`
- **Multi-Tenant Guide:** `docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`

