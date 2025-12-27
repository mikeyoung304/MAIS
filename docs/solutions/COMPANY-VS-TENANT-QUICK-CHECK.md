# Company vs. Tenant Routing: 30-Second Decision Tree

Print this and pin to your monitor. When unsure, check here before coding.

---

## Question 1: Who controls the content?

```
Is the content controlled by:

A) HANDLED platform team (features, pricing, signup)
   → GO TO QUESTION 2

B) Individual tenant/user (photographer, therapist, etc.)
   → This is TENANT content
   → Use: /t/[slug]/ or /t/_domain/ routing
   → MUST: Call getTenantBySlug() or getTenantByDomain()
   → MUST: Handle notFound() if tenant doesn't exist
```

---

## Question 2: Does it exist in the database?

```
If HANDLED platform content, does it need a database lookup?

A) No - it's the same for everyone (features, pricing, signup)
   → This is COMPANY content
   → Use: /page.tsx or /(marketing)/ routing
   → DON'T: Create a database entry for this
   → HARDCODE: Features, pricing, CTAs

B) Yes - it's user/tenant-specific data
   → This is TENANT content
   → Use: /t/[slug]/ or /t/_domain/ routing
   → REQUIRE: Tenant lookup with notFound() on missing
```

---

## Quick URL Check

| URL Pattern | Type | Requires Database | Example |
|-------------|------|-------------------|---------|
| `/` | Company | No | Homepage |
| `/signup` | Company | No | Signup page |
| `/features` | Company | No | Features list |
| `/pricing` | Company | No | Pricing page |
| `/t/jane-photography` | Tenant | Yes | Tenant storefront |
| `/t/jane-photography/about` | Tenant | Yes | Tenant about page |
| `janephotography.com` (custom) | Tenant | Yes | Custom domain |

---

## Code Pattern Check

### Company Content (Root `/page.tsx`)

```typescript
export default function HomePage() {
  // ✓ Hardcoded content
  const features = [/* ... */];
  const pricing = [/* ... */];

  // ✗ Never do this:
  // const tenant = await getTenantBySlug('handled');
  // const config = await db.query(...);

  return <HomePage features={features} pricing={pricing} />;
}
```

### Tenant Content (`/t/[slug]/`)

```typescript
export default async function Page({ params }: Props) {
  // ✓ REQUIRED: Fetch tenant
  const tenant = await getTenantBySlug(params.slug);

  // ✓ REQUIRED: Handle missing tenant
  if (!tenant) notFound();

  // ✓ Tenant data in every component
  return <TenantPage tenant={tenant} />;
}
```

---

## Pre-Commit Checklist (30 seconds)

Before committing any new pages:

- [ ] I can say in 1 sentence: "This is [COMPANY|TENANT] content"
- [ ] URL pattern matches type:
  - Company: `/`, `/(marketing)/`, no `/t/`
  - Tenant: `/t/[slug]/`, `/t/_domain/`
- [ ] If company page: no `getTenantBySlug()` call
- [ ] If tenant page: has `getTenantBySlug()` call
- [ ] If tenant page: has `notFound()` for missing tenant
- [ ] No hardcoded "handled" or "company" tenant in database

---

## When in Doubt

Ask: **"Would this break if I deleted all tenants from the database?"**

- **YES** → It's company content (should stay working)
- **NO** → It's tenant content (should work only when tenant exists)

---

## The Critical Rule

**NEVER create a database entry with slug `'handled'`, `'company'`, or `'maconaisolutions'`.**

These are COMPANY domains. Use static pages instead.

---

## References

- Full guide: `docs/solutions/COMPANY-WEBSITE-TENANT-CONFUSION-PREVENTION.md`
- Architecture: `ARCHITECTURE.md` (section: "Dual Routing Pattern")
- App structure: `apps/web/README.md`

