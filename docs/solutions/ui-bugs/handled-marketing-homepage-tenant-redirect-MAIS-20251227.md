---
title: HANDLED Marketing Homepage - Company vs Tenant Routing Fix
problem_type: ui-bugs
component: Next.js Marketing Homepage
severity: high
symptoms:
  - "www.gethandled.ai displayed 404 'Business not found' error"
  - 'Root path (/) redirected to /t/handled (tenant slug routing)'
  - 'Homepage treated HANDLED as a tenant instead of marketing site'
  - '8+ MAIS → HANDLED branding references missed in Next.js app'
root_cause: |
  The root page.tsx used permanentRedirect('/t/handled'), treating the company
  website as a tenant storefront. Since no "handled" tenant existed in the
  production database, the tenant not-found page was displayed.
solution_summary: |
  Created proper static marketing homepage at root (/) with full HANDLED brand
  content. Fixed 8 user-facing MAIS → HANDLED branding references across auth
  pages, admin UI, and error pages.
verified: true
date_solved: 2025-12-27
related_commits:
  - 9465d08 # fix: complete HANDLED rebrand in Next.js app
  - 1d1c2aa # feat: add HANDLED marketing homepage
tags:
  - next-js
  - routing
  - branding
  - marketing-homepage
  - tenant-vs-company
  - rebrand
---

# HANDLED Marketing Homepage - Company vs Tenant Routing Fix

## Problem

After the MAIS → HANDLED rebrand, www.gethandled.ai showed a 404 "Business not found" error with the message "Get started with MAIS" (also missed in the rebrand).

**Screenshot observation:**

- 404 page displayed
- "Business not found" error
- "Get started with MAIS" link (wrong branding)

## Root Cause

The homepage was configured as a tenant redirect instead of a proper marketing page:

```typescript
// apps/web/src/app/page.tsx (BEFORE - WRONG)
import { permanentRedirect } from 'next/navigation';

export default function HomePage() {
  permanentRedirect('/t/handled'); // Treats company as tenant!
}
```

**Why this failed:**

1. `/t/handled` routes to tenant storefront system
2. No tenant with slug "handled" exists in production database
3. Tenant lookup fails → 404 "Business not found"

**Architectural confusion:** HANDLED is the company, not a tenant. The company website should be a static marketing page, not a database-driven tenant storefront.

## Solution

### Part 1: Create Marketing Homepage

Replaced the redirect with a full static marketing homepage (~375 lines):

```typescript
// apps/web/src/app/page.tsx (AFTER - CORRECT)
import Link from 'next/link';
import { Metadata } from 'next';
import { Globe, Calendar, Sparkles, Mail, Users, Phone, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'HANDLED - Stay Ahead Without the Overwhelm',
  description: "Done-for-you websites, booking, and AI...",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md">
        {/* HANDLED logo, nav links, CTA button */}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32 px-6">
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
          The tech is moving fast.
          <br />
          <span className="text-sage">You don't have to.</span>
        </h1>
        {/* Subheadline, CTAs */}
      </section>

      {/* Problem Section, Features, Pricing, FAQ, Final CTA, Footer */}
    </div>
  );
}
```

**Homepage sections:**

1. **Hero** - "The tech is moving fast. You don't have to."
2. **Problem Statement** - "You didn't start your business to debug a website."
3. **Features** (6) - Website, Booking, AI, Newsletter, Zoom Calls, Human Support
4. **Pricing** (3 tiers) - Handled $49, Fully Handled $149, Completely Handled Custom
5. **FAQ** (6 questions) - Native HTML `<details>` accordion
6. **Final CTA** - "Ready to stop being your own IT department?"
7. **Footer** - Terms, Privacy, Contact

### Part 2: Fix Missed Branding

Fixed 8 user-facing MAIS → HANDLED references:

| File                         | Change                                               |
| ---------------------------- | ---------------------------------------------------- |
| `/t/not-found.tsx`           | "Get started with MAIS" → "Get started with HANDLED" |
| `/login/page.tsx`            | Logo text MAIS → HANDLED                             |
| `/signup/page.tsx`           | Logo + description MAIS → HANDLED                    |
| `/forgot-password/page.tsx`  | Logo text MAIS → HANDLED                             |
| `AdminSidebar.tsx`           | Sidebar logo MAIS → HANDLED                          |
| `/tenant/billing/page.tsx`   | "MAIS Professional" → "HANDLED Professional"         |
| `/tenant/settings/page.tsx`  | "MAIS API" → "HANDLED API"                           |
| `/tenant/assistant/page.tsx` | Comment reference                                    |

## Key Distinction: Company vs Tenant

| Aspect           | Company Marketing            | Tenant Storefronts          |
| ---------------- | ---------------------------- | --------------------------- |
| **URLs**         | `/`, `/features`, `/pricing` | `/t/[slug]`, custom domains |
| **Database**     | NO lookup required           | REQUIRED - must exist       |
| **Content**      | Hardcoded/static             | Config-driven from DB       |
| **Location**     | `src/app/page.tsx`           | `src/app/t/[slug]/`         |
| **404 handling** | N/A                          | Required if tenant missing  |

**Rule:** Never create a database tenant with slug `'handled'`, `'company'`, or similar. The company website is NOT a tenant.

## Design System Applied

The homepage follows HANDLED brand guidelines:

```tsx
// Hero headline - serif font, tight tracking
<h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl
               font-bold text-text-primary leading-[1.1] tracking-tight">

// Feature cards - generous whitespace, hover animation
<div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100
                hover:shadow-lg hover:-translate-y-1 transition-all duration-300">

// CTA buttons - rounded full, sage accent
<Button variant="sage" className="rounded-full px-10 py-6 text-lg
                                  shadow-lg hover:shadow-xl transition-all duration-300">
```

## Prevention Strategies

### 1. Route Architecture Decision Tree

Before creating any page, ask:

1. **Is this HANDLED company content?** → Static page at root (`/`)
2. **Is this tenant/user content?** → Tenant route (`/t/[slug]`)

### 2. Code Review Checklist

- [ ] Company pages have NO `getTenantBySlug()` calls
- [ ] Company pages have NO database dependencies
- [ ] Tenant pages MUST call `getTenantBySlug()` + handle `notFound()`
- [ ] No tenant exists with slug 'handled' or similar

### 3. Pre-Deployment Verification

```bash
# Verify no company tenants exist
psql $DATABASE_URL -c "SELECT slug FROM \"Tenant\" WHERE slug IN ('handled', 'company', 'gethandled');"
# Should return 0 rows
```

### 4. Branding Audit During Rebrands

```bash
# Find all old brand references
grep -rn "MAIS" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "// " | head -20
```

## Related Documentation

- [Brand Identity Migration](../patterns/brand-identity-migration-MAIS-20251227.md) - Complete rebrand guide
- [HANDLED Brand Voice Guide](../../design/BRAND_VOICE_GUIDE.md) - Copy and design standards
- [Next.js Marketing Site Patterns](../../reference/NEXTJS-14-MARKETING-SITE-PATTERNS.md) - ISR and routing patterns

## Commits

- **9465d08** - fix: complete HANDLED rebrand in Next.js app (8 files, branding fixes)
- **1d1c2aa** - feat: add HANDLED marketing homepage (375 lines, full marketing page)

## Key Lesson

**The company website is NOT a tenant.** Tenant storefronts are for customers who sign up and create their own businesses on the platform. The company's own marketing site should be a static page that doesn't depend on database lookups.

When you see `permanentRedirect('/t/something')` at the root, ask: "Is this a tenant or is this us?" If it's the company, create a proper static marketing page instead.
