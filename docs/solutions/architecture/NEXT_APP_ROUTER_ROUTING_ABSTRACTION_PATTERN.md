# Next.js App Router Routing Abstraction Pattern

A pattern for handling multiple route structures accessing the same business logic in Next.js App Router.

## The Problem

You have the same feature accessible via different routing strategies:

```
/t/[slug]/about        → uses params.slug
/t/_domain/about       → uses searchParams.domain
```

The business logic is identical, but the parameter sources are different. This creates code duplication because **Next.js routes are file-based, not logic-based**.

## Why You Can't Unify Routes

Next.js App Router requires the **route file to match the parameter source**:

```typescript
// Route: /t/[slug]/about/page.tsx
interface Props {
  params: Promise<{ slug: string }>;
} // ✅ Dynamic segment

// Route: /t/_domain/about/page.tsx
interface Props {
  searchParams: Promise<{ domain?: string }>;
} // ✅ Query param

// You CANNOT write a single page.tsx that handles both
// because Next.js determines routing based on file location
```

## The Solution: Define a Routing Abstraction

Instead of trying to unify the routes, **extract the business logic into utilities that accept a routing abstraction**.

### Step 1: Create a Union Type for Your Resource Identifier

```typescript
// apps/web/src/lib/tenant-page-utils.ts

export type TenantIdentifier = { type: 'slug'; slug: string } | { type: 'domain'; domain: string };
```

This union type represents "any way to identify a tenant" without caring about the HTTP mechanism.

### Step 2: Extract Resolution Logic

```typescript
export async function resolveTenant(
  identifier: TenantIdentifier
): Promise<TenantResolutionResult<ResolvedTenantContext>> {
  try {
    if (identifier.type === 'slug') {
      const { tenant } = await getTenantStorefrontData(identifier.slug);
      return {
        success: true,
        data: { tenant, config, basePath: `/t/${identifier.slug}` },
      };
    } else {
      const validatedDomain = validateDomain(identifier.domain);
      const tenant = await getTenantByDomain(validatedDomain);
      return {
        success: true,
        data: { tenant, config, basePath: '', domainParam: `?domain=${validatedDomain}` },
      };
    }
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return { success: false, error: 'not_found' };
    }
    // ... handle other errors
  }
}
```

**Key points:**

- Function accepts the abstraction, not raw route params
- TypeScript narrows types based on `identifier.type`
- Returns a **result wrapper** (success/error) instead of throwing

### Step 3: Extract Shared Behaviors

```typescript
// Metadata generation works with the abstraction
export async function generateTenantPageMetadata(
  identifier: TenantIdentifier,
  pageName: PageName
): Promise<Metadata> {
  const result = await resolveTenant(identifier);
  if (!result.success) {
    return { title: 'Not Found', robots: { index: false } };
  }
  // ... generate metadata
}

// Accessibility checks work with the abstraction
export async function checkPageAccessible(
  identifier: TenantIdentifier,
  pageName: PageName
): Promise<ResolvedTenantContext | null> {
  const result = await resolveTenant(identifier);
  if (!result.success || !isPageEnabled(result.data.config, pageName)) {
    return null;
  }
  return result.data;
}
```

### Step 4: Use the Abstraction in Routes

```typescript
// Route 1: /t/[slug]/about/page.tsx
interface AboutPageProps { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  return generateTenantPageMetadata(identifier, 'about');
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  const context = await checkPageAccessible(identifier, 'about');

  if (!context) notFound();
  return <AboutPageContent tenant={context.tenant} basePath={context.basePath} />;
}

// Route 2: /t/_domain/about/page.tsx
interface AboutPageProps { searchParams: Promise<{ domain?: string }> }

export async function generateMetadata({ searchParams }: AboutPageProps): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) return { title: 'Not Found' };

  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'about');
}

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const { domain } = await searchParams;
  if (!domain) notFound();

  const identifier: TenantIdentifier = { type: 'domain', domain };
  const context = await checkPageAccessible(identifier, 'about');

  if (!context) notFound();
  return (
    <AboutPageContent
      tenant={context.tenant}
      basePath={context.basePath}
      domainParam={context.domainParam}
    />
  );
}
```

**The key benefit:** Both routes are now thin wrappers. The actual logic lives in utilities that don't care about the routing mechanism.

## Step 5: Extract Shared Error Boundaries (Bonus)

If you have error.tsx files in both routes:

```typescript
// apps/web/src/components/tenant/TenantErrorBoundary.tsx
export function TenantErrorBoundary({ error, reset, context }: TenantErrorBoundaryProps) {
  useEffect(() => {
    logger.error(`${context} page error`, error);
  }, [error, context]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <h1>Something went wrong</h1>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}

// Used in all error.tsx files:
export default function AboutError({ error, reset }) {
  return <TenantErrorBoundary error={error} reset={reset} context="about" />;
}
```

## When to Use This Pattern

### ✅ Good Use Cases

- Multiple routes to the same resource (by ID, by slug, by domain, by query param)
- Config-driven features with multiple access patterns
- Same UI, different parameter sources
- Blog with `/posts/[id]` and `/posts-by-slug/[slug]`

### ❌ Not Recommended For

- Fundamentally different business logic between routes
- Single unified route exists (no need for abstraction)
- Simple one-off features
- Routes with completely different data shapes

## Benefits

| Aspect              | Benefit                                    |
| ------------------- | ------------------------------------------ |
| **Duplication**     | ~60-70% reduction in code                  |
| **Maintainability** | Single place to update shared logic        |
| **Testing**         | Can unit test utilities without routes     |
| **Type Safety**     | TypeScript discriminates union types       |
| **Extensibility**   | Adding routes requires minimal boilerplate |

## Example: Adding a Third Route

With the abstraction, adding `/t/custom-domain/about` is trivial:

```typescript
// Just add one more discriminant to the union
export type TenantIdentifier =
  | { type: 'slug'; slug: string }
  | { type: 'domain'; domain: string }
  | { type: 'customDomain'; customDomain: string }; // New!

// Extend resolution logic
async function resolveTenant(identifier: TenantIdentifier) {
  if (identifier.type === 'customDomain') {
    const tenant = await getTenantByCustomDomain(identifier.customDomain);
    return { success: true, data: { tenant, basePath: '' } };
  }
  // ... rest of logic
}

// Route uses the same utilities
export default async function AboutPage({ params }: AboutPageProps) {
  const { customDomain } = await params;
  const identifier: TenantIdentifier = { type: 'customDomain', customDomain };
  const context = await checkPageAccessible(identifier, 'about');
  // ... same pattern
}
```

No changes needed to `generateTenantPageMetadata()` or `checkPageAccessible()`.

## Technical Details

### Result Wrapper vs Exceptions

Why use a result type instead of throwing exceptions?

```typescript
// ❌ Exception approach (hard to handle consistently)
async function resolveTenant(id) {
  const tenant = await getTenant(id); // Throws TenantNotFoundError
  const config = await getConfig(tenant); // Throws ConfigError
  // How do you handle different error types?
}

// ✅ Result wrapper (explicit and composable)
async function resolveTenant(id) {
  try {
    const tenant = await getTenant(id);
    const config = await getConfig(tenant);
    return { success: true, data: { tenant, config } };
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return { success: false, error: 'not_found' };
    }
    if (error instanceof ConfigError) {
      return { success: false, error: 'invalid_config' };
    }
    throw error; // Unknown error propagates
  }
}

// Usage is clear and type-safe
const result = await resolveTenant(id);
if (!result.success) {
  // result.error is discriminated: 'not_found' | 'invalid_config'
  return handle404();
}
// result.data is guaranteed to be fully loaded
```

### Type Narrowing with Discriminated Unions

```typescript
type TenantIdentifier = { type: 'slug'; slug: string } | { type: 'domain'; domain: string };

function resolveTenant(identifier: TenantIdentifier) {
  if (identifier.type === 'slug') {
    // TypeScript automatically narrows to { type: 'slug'; slug: string }
    // identifier.slug is available here
    getTenantStorefrontData(identifier.slug); // ✅ type-safe
  } else {
    // TypeScript automatically narrows to { type: 'domain'; domain: string }
    // identifier.domain is available here
    getTenantByDomain(identifier.domain); // ✅ type-safe
  }
}
```

## Related Patterns

- **Configuration Registry** - `PAGE_METADATA_CONFIGS` as source of truth
- **Factory Functions** - `createTenantErrorBoundary(context)` for generating components
- **Result Types** - `TenantResolutionResult<T>` instead of exceptions
- **Type Guards** - Using `identifier.type` to narrow union members

## References

- MAIS Implementation: `apps/web/src/lib/tenant-page-utils.ts`
- MAIS Routes: `apps/web/src/app/t/[slug]/(site)/about/page.tsx` and `/t/_domain/about/page.tsx`
- Next.js Docs: [Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- TypeScript Docs: [Discriminated Unions](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#discriminating-unions)

## Checklist for Implementation

- [ ] Define union type for resource identifier
- [ ] Extract resolution logic into utility functions
- [ ] Use result wrapper pattern for error handling
- [ ] Extract shared behaviors (metadata, validation, etc.)
- [ ] Replace route boilerplate with calls to utilities
- [ ] Test routes with different identifier types
- [ ] Extract shared components (error boundaries, loading states)
- [ ] Document the routing abstraction in code comments
- [ ] Consider adding a third route to verify extensibility
