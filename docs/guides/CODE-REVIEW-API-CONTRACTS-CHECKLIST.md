# Code Review Checklist: API Contracts & ISR

**Date:** December 25, 2025
**Use this checklist when reviewing PRs with API calls or ISR changes**

---

## Quick Start

Copy this section into PR review comments when you spot API/ISR changes:

```markdown
## API & ISR Review Checklist

- [ ] **Contract Path**: Search `packages/contracts/src/api.v1.ts` for endpoint
- [ ] **Method Match**: HTTP method matches contract (GET/POST/PUT/DELETE)
- [ ] **Path Match**: Path is exact (no extra segments like `/slug/`)
- [ ] **Headers**: X-Tenant-Key included for public endpoints
- [ ] **Response Type**: Response matches contract schema
- [ ] **Error Handling**: Handles 400, 401, 404, 500 responses
- [ ] **ISR Config**: Correct `revalidate` value (or 0 for dynamic)
- [ ] **Cache Tags**: Uses tags for selective revalidation if needed
```

---

## Section 1: Reviewing API Calls

### Checklist Item 1: Verify Contract Exists

**What to check:**

- Does the API call in the diff have a corresponding entry in contracts?

**How to review:**

```bash
# Find the API endpoint in the contracts file
grep -A 10 "getPackageBySlug\|getPackages\|createCheckout" \
  packages/contracts/src/api.v1.ts
```

**What to look for:**

```typescript
// Contract definition
getPackageBySlug: {
  method: 'GET',
  path: '/v1/packages/:slug',  // ← This is the canonical path
  pathParams: z.object({
    slug: z.string(),
  }),
  responses: {
    200: PackageDtoSchema,
    404: NotFoundErrorSchema,
  },
}

// ✓ Code matches contract
const url = `${API_BASE_URL}/v1/packages/${slug}`;

// ✗ Code doesn't match - reviewer should flag this
const url = `${API_BASE_URL}/v1/packages/slug/${slug}`;  // Extra "slug/"!
```

**Example review comment:**

```
Looks good! I verified this matches the contract:
✓ Path: /v1/packages/:slug (matches contract exactly)
✓ Method: GET (matches contract)
✓ Headers: X-Tenant-Key included
```

---

### Checklist Item 2: Verify HTTP Method

**What to check:**

- Does the code use the correct HTTP method (GET vs POST vs PUT vs DELETE)?

**How to review:**

```typescript
// Contract says GET
getPackageBySlug: {
  method: 'GET',  // ← Look here
  path: '/v1/packages/:slug',
}

// Code should use GET
const response = await fetch(url, {
  method: 'GET',  // ✓ Matches
});

// Code using wrong method
const response = await fetch(url, {
  method: 'POST',  // ✗ Should be GET!
});
```

**Example issues to catch:**

```typescript
// ✗ Wrong: Using POST for a GET endpoint
await fetch(`${API_BASE_URL}/v1/packages/${slug}`, {
  method: 'POST', // ← Should be GET
  body: JSON.stringify({}),
});

// ✓ Correct: Using GET
await fetch(`${API_BASE_URL}/v1/packages/${slug}`, {
  method: 'GET',
});
```

**Example review comment:**

````
⚠️ Method mismatch!

Contract defines this as a GET endpoint:
```typescript
getPackageBySlug: {
  method: 'GET',  // ← Here
  path: '/v1/packages/:slug',
}
````

But code is using POST. Should be:

```typescript
const response = await fetch(url, {
  method: 'GET', // Change from POST
});
```

````

---

### Checklist Item 3: Verify Path Matches Exactly

**What to check:**
- Is the URL path exactly the same as in the contract? No extra segments?

**How to review:**

```typescript
// Contract definition
createCheckout: {
  method: 'POST',
  path: '/v1/bookings/checkout',  // ← Exact path (no variables)
}

// ✓ Code matches exactly
const url = `${API_BASE_URL}/v1/bookings/checkout`;

// ✗ Extra segment added
const url = `${API_BASE_URL}/v1/bookings/create/checkout`;  // ← Extra "create/"

// ✗ Wrong parameter format
const url = `${API_BASE_URL}/v1/bookings/${id}/checkout`;  // ← Shouldn't have {id}
````

**Path parameter examples:**

```typescript
// Contract with path parameter
getTenantBySlug: {
  method: 'GET',
  path: '/v1/public/tenants/:slug',  // ← Has :slug parameter
  pathParams: z.object({
    slug: z.string(),
  }),
}

// ✓ Correct: Replace :slug with actual value
const slug = 'wedding-photography';
const url = `${API_BASE_URL}/v1/public/tenants/${encodeURIComponent(slug)}`;

// ✗ Wrong: Keep the :slug literal
const url = `${API_BASE_URL}/v1/public/tenants/:slug`;

// ✗ Wrong: Add extra segment
const url = `${API_BASE_URL}/v1/public/tenants/by-slug/${slug}`;
```

**Example review comment:**

````
⚠️ Path mismatch!

Contract: `/v1/packages/:slug`
Code: `/v1/packages/slug/${slug}`  ← Extra "slug/" shouldn't be here

Should be:
```typescript
const url = `${API_BASE_URL}/v1/packages/${encodeURIComponent(slug)}`;
````

````

---

### Checklist Item 4: Verify Required Headers

**What to check:**
- For public endpoints, is the `X-Tenant-Key` header included?
- For protected endpoints, is `Authorization: Bearer` included?

**How to review:**

```typescript
// Public endpoint - needs X-Tenant-Key
const url = `${API_BASE_URL}/v1/packages`;
const response = await fetch(url, {
  headers: {
    'X-Tenant-Key': tenantApiKey,  // ✓ Included
  },
});

// ✗ Missing header
const response = await fetch(url, {
  headers: {
    'Content-Type': 'application/json',
    // X-Tenant-Key missing!
  },
});

// Protected endpoint - needs Authorization
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`,  // ✓ Included
  },
});
````

**Contract patterns to watch:**

```typescript
// Pattern 1: Public endpoint (needs X-Tenant-Key)
getPackages: {
  method: 'GET',
  path: '/v1/packages',  // ← No /admin/, /tenant-admin/ → public
}

// Pattern 2: Tenant admin (needs tenant auth token)
tenantAdminGetPackages: {
  method: 'GET',
  path: '/v1/tenant-admin/packages',  // ← Has /tenant-admin/ → needs auth
}

// Pattern 3: Platform admin (needs admin auth token)
platformGetTenants: {
  method: 'GET',
  path: '/v1/admin/tenants',  // ← Has /admin/ → needs auth
}
```

**Example review comment:**

````
⚠️ Missing required header!

This is a public endpoint requiring `X-Tenant-Key`:

```typescript
const response = await fetch(`${API_BASE_URL}/v1/packages`, {
  headers: {
    'X-Tenant-Key': tenantApiKey,  // ← Add this
  },
});
````

````

---

### Checklist Item 5: Verify Response Handling

**What to check:**
- Does code handle all response status codes defined in the contract?
- Are error responses handled appropriately?

**How to review:**

```typescript
// Contract defines multiple response types
createCheckout: {
  responses: {
    200: CheckoutResponseSchema,
    400: BadRequestErrorSchema,
    404: NotFoundErrorSchema,
    409: ConflictErrorSchema,
    500: InternalServerErrorSchema,
  },
}

// ✓ Code handles different responses
const response = await fetch(url, { method: 'POST', body });

if (response.status === 200) {
  return { checkoutUrl: (await response.json()).checkoutUrl };
}
if (response.status === 404) {
  throw new Error('Package not found');
}
if (response.status === 409) {
  throw new Error('Date already booked');
}
if (!response.ok) {
  throw new Error(`API error: ${response.status}`);
}

// ✗ Code only handles happy path
const data = await response.json();  // Assumes 200
return { checkoutUrl: data.checkoutUrl };  // Crashes if 404
````

**Example review comment:**

````
⚠️ Missing error handling!

Contract defines these response codes:
- 200: Success
- 404: Not found
- 409: Already booked

But code only handles success case:

```typescript
const data = await response.json();
return data.checkoutUrl;  // Crashes on error responses
````

Should handle errors:

```typescript
if (!response.ok) {
  if (response.status === 404) {
    throw new Error('Package not found');
  }
  if (response.status === 409) {
    throw new Error('Date already booked');
  }
  throw new Error(`API error: ${response.status}`);
}

return { checkoutUrl: data.checkoutUrl };
```

````

---

## Section 2: Reviewing ISR Changes

### Checklist Item 6: Verify ISR Configuration

**What to check:**
- Is `export const revalidate` set appropriately for the page type?

**How to review:**

```typescript
// Rare updates (branding, basic info) - 1 hour
export const revalidate = 3600;

// Moderate updates (package details) - 5 minutes
export const revalidate = 300;

// Frequent updates (availability) - 1 minute
export const revalidate = 60;

// Always fresh (admin, dynamic content) - never cache
export const revalidate = 0;
````

**Decision tree to reference:**

```
Is this page in /admin or /tenant-admin?
├─ YES → revalidate = 0 (never cache, always fresh)
└─ NO → Does data change frequently?
        ├─ YES (availability, real-time data) → revalidate = 60
        ├─ SOMETIMES (packages, pricing) → revalidate = 300
        └─ RARELY (branding, company info) → revalidate = 3600
```

**Example review comments:**

```
✓ Good ISR config for landing page:
- Branding rarely changes
- revalidate = 3600 (1 hour) is appropriate

⚠️ ISR config might be too aggressive:
- Availability data changes frequently
- revalidate = 3600 (1 hour) might show stale dates
- Recommend: revalidate = 60 (1 minute)

✗ ISR enabled on admin page:
- Admin pages should show fresh data immediately
- Change: export const revalidate = 0;
```

---

### Checklist Item 7: Verify Cache Tags (If Used)

**What to check:**

- If using `next: { tags }`, are tags set up correctly for selective revalidation?

**How to review:**

```typescript
// Using tags for selective revalidation
export const revalidate = 3600; // Revalidate every hour
// But also allow manual invalidation via tags

export const getTenantData = cache(async (slug: string) => {
  const response = await fetch(`${API_BASE_URL}/v1/public/tenants/${slug}`, {
    next: {
      revalidate: 3600,
      tags: [`tenant-${slug}`], // ← Tag for selective revalidation
    },
  });
});

// Later, when tenant updates:
import { revalidateTag } from 'next/cache';
export async function updateTenantBranding(slug: string) {
  // ... update code ...
  revalidateTag(`tenant-${slug}`); // Invalidate just this tenant's cache
}
```

**Example review comment:**

````
Nice! Using cache tags for selective revalidation:

```typescript
next: {
  tags: [`tenant-${slug}`],
}
````

This allows invalidating just this tenant's cache without clearing everything.

Also verify in the update handler:

```typescript
revalidateTag(`tenant-${slug}`); // Matches the tag above
```

````

---

### Checklist Item 8: Verify React cache() Wrapper

**What to check:**
- Is the function wrapped with React's `cache()` to deduplicate calls within a single request?

**How to review:**

```typescript
// ✓ Wrapped with cache() - prevents duplicate fetches
export const getTenantBySlug = cache(async (slug: string) => {
  const response = await fetch(`${API_BASE_URL}/v1/public/tenants/${slug}`);
  return response.json();
});

// ✗ Not wrapped - might fetch same data twice
export async function getTenantBySlug(slug: string) {
  const response = await fetch(`${API_BASE_URL}/v1/public/tenants/${slug}`);
  return response.json();
}
````

**Why it matters:**

```typescript
// Without cache():
export async function page() {
  // Called in generateMetadata() → API request 1
  const data1 = await getTenantBySlug(slug);

  // Called in page component → API request 2 (duplicate!)
  const data2 = await getTenantBySlug(slug);

  return <Component data={data2} />;
}

// With cache():
export const getTenantBySlug = cache(async (slug: string) => {
  // Both calls above reuse this single result → 1 API request total
});
```

**Example review comment:**

````
✓ Good use of React cache():

```typescript
export const getTenantBySlug = cache(async (slug: string) => {
  // Prevents duplicate fetches when called from both
  // generateMetadata() and page component
});
````

This ensures even if multiple parts of the page request the same data,
it's only fetched once per request.

````

---

## Section 3: Combined Checklist

Use this when reviewing a PR that touches both API calls and ISR:

```markdown
## API + ISR Review Checklist

### API Calls
- [ ] Contract exists for endpoint
- [ ] HTTP method matches contract
- [ ] Path matches contract exactly (no extra segments)
- [ ] All required headers included
- [ ] Response status codes handled
- [ ] Error messages are user-friendly

### ISR Configuration
- [ ] revalidate value appropriate for page type
- [ ] fetch() calls have next: { revalidate } option
- [ ] cache() wrapper on service functions
- [ ] cache tags set up (if selective invalidation needed)
- [ ] revalidatePath() called on data updates (if applicable)

### Testing
- [ ] E2E tests verify endpoint is reachable
- [ ] Tests check ISR timing behavior
- [ ] Tests verify cache invalidation works
- [ ] No hardcoded test URLs (use constants)

### Documentation
- [ ] JSDoc comments explain ISR strategy
- [ ] If custom logic, comment explaining why
- [ ] PR description explains ISR approach
````

---

## Section 4: Common Issues to Watch For

### Issue 1: Path Parameters Not URL-Encoded

```typescript
// ✗ Bad: Special characters in slug break URL
const slug = 'wedding-2024 (premium)';
const url = `${API_BASE_URL}/v1/packages/${slug}`;
// Results in: /v1/packages/wedding-2024 (premium)  ← Space breaks URL

// ✓ Good: URL-encoded
const url = `${API_BASE_URL}/v1/packages/${encodeURIComponent(slug)}`;
// Results in: /v1/packages/wedding-2024%20(premium)  ← Properly encoded
```

**Example review comment:**

````
⚠️ URL encoding needed!

```typescript
const url = `${API_BASE_URL}/v1/packages/${slug}`;
````

Should use `encodeURIComponent()` for safety:

```typescript
const url = `${API_BASE_URL}/v1/packages/${encodeURIComponent(slug)}`;
```

This handles special characters (spaces, parentheses, etc.) properly.

````

---

### Issue 2: ISR Too Aggressive or Too Conservative

```typescript
// ✗ Too aggressive - refreshes every second
export const revalidate = 1;
// Problem: High server load, ISR defeats purpose

// ✗ Too conservative - refreshes every 6 hours
export const revalidate = 21600;
// Problem: Shows stale data for 6 hours

// ✓ Balanced - refreshes every 5 minutes
export const revalidate = 300;
// Good for: Pages that update occasionally
````

**Example review comment:**

````
⚠️ ISR timing might not be optimal

Current: `revalidate = 60` (1 minute)

This page contains package pricing, which typically changes:
- Daily at most
- Often weekly or monthly

Recommend: `revalidate = 3600` (1 hour)

Or, use on-demand revalidation:
```typescript
import { revalidatePath } from 'next/cache';

// When package is updated:
await revalidatePath('/t/[slug]', 'layout');
````

This gives fresh data on demand without refreshing every minute.

````

---

### Issue 3: Missing Type Safety

```typescript
// ✗ Bad: Using any, response might not be correct type
const response = await fetch(url);
const data: any = await response.json();

// ✓ Good: Type-safe with ts-rest client
const api = await createServerApiClient();
const { status, body } = await api.getPackageBySlug({ params: { slug } });

// ✓ Also good: Manual fetch with response validation
interface PackageResponse {
  id: string;
  slug: string;
  title: string;
}

const response = await fetch(url);
const data = await response.json() as PackageResponse;
````

**Example review comment:**

````
⚠️ Type safety missing!

```typescript
const data = await response.json();
````

No type checking - response structure unknown.

Consider:

1. Using ts-rest client (recommended):

   ```typescript
   const { body } = await api.getPackageBySlug(...);
   // ✓ body is type-safe
   ```

2. Or add type annotation:
   ```typescript
   const data = (await response.json()) as PackageResponse;
   ```

```

---

## How to Use This Checklist

### For Code Authors:
1. Before submitting PR, review your own code against sections 1-2
2. Ensure all checks pass
3. Add comments to explain ISR strategy

### For Code Reviewers:
1. Copy the relevant checklist section into your review comment
2. Check off items as you verify them
3. Use example comments above for consistency
4. Request changes if issues found

### For Team Leaders:
1. Share this checklist in your development guidelines
2. Link to it in PR templates
3. Reference specific sections during code review
4. Update as new patterns emerge

```
