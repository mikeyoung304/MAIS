# Multi-Tenant Routing Architecture Diagrams

Visual diagrams showing data flow and architectural patterns.

## Overall Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MULTI-TENANT ROUTING SYSTEM                   │
└─────────────────────────────────────────────────────────────────────┘

                        URL: /t/{tenantSlug}/...

                              ▼

┌──────────────────────────────────────────────────────────────────────┐
│  VERCEL EDGE LAYER (vercel.json rewrites)                            │
├──────────────────────────────────────────────────────────────────────┤
│  /t/:tenantSlug/:path(*) → /t/:tenantSlug/:path (static)            │
│  /:path(*) → /index.html (SPA)                                       │
└──────────────────────────────────────────────────────────────────────┘

                              ▼

┌──────────────────────────────────────────────────────────────────────┐
│  REACT ROUTER v7 (react-router-dom)                                   │
├──────────────────────────────────────────────────────────────────────┤
│  createBrowserRouter([                                               │
│    {                                                                  │
│      path: '/t/:tenantSlug',                                         │
│      loader: tenantLoader,    ◄─────── Pre-loads data                │
│      element: <TenantLayout /> ◄─────── Renders with context         │
│      errorElement: <ErrorBoundary />                                 │
│      children: [ nested routes ]                                     │
│    }                                                                  │
│  ])                                                                   │
└──────────────────────────────────────────────────────────────────────┘

                              ▼

┌──────────────────────────────────────────────────────────────────────┐
│  TENANT LOADER (tenantLoader.ts)                                     │
├──────────────────────────────────────────────────────────────────────┤
│  export async function tenantLoader({ params }) {                   │
│    const { tenantSlug } = params                                     │
│    const response = await api.getTenantConfig(tenantSlug)           │
│    return { config, slug }  ◄─────── Pre-loaded before render      │
│  }                                                                    │
└──────────────────────────────────────────────────────────────────────┘

                              ▼

┌──────────────────────────────────────────────────────────────────────┐
│  TENANT LAYOUT (TenantLayout.tsx)                                    │
├──────────────────────────────────────────────────────────────────────┤
│  const data = useLoaderData()                                        │
│  return (                                                             │
│    <TenantProvider config={data.config} slug={data.slug}>           │
│      <TenantBrandingProvider>                                        │
│        <TenantHeader />                                              │
│        <Outlet />           ◄─────── Child routes                   │
│        <TenantFooter />                                              │
│      </TenantBrandingProvider>                                       │
│    </TenantProvider>                                                 │
│  )                                                                    │
└──────────────────────────────────────────────────────────────────────┘

                    ▼           ▼           ▼
            ┌──────────────────────────────┐
            │   NESTED TENANT ROUTES       │
            ├──────────────────────────────┤
            │ ✓ /t/slug/                   │
            │ ✓ /t/slug/packages           │
            │ ✓ /t/slug/s/:segment         │
            │ ✓ /t/slug/s/:segment/p/:pkg  │
            └──────────────────────────────┘
                              ▼
            ┌──────────────────────────────┐
            │  TENANT PAGES                │
            ├──────────────────────────────┤
            │ useTenant()     → config     │
            │ useTenantQuery() → data      │
            │ routes.tenant*() → navigation│
            └──────────────────────────────┘
                              ▼
            ┌──────────────────────────────┐
            │  API REQUESTS                │
            ├──────────────────────────────┤
            │ X-Tenant-Slug: {tenantSlug} │
            │ Authorization: Bearer {jwt}  │
            └──────────────────────────────┘
                              ▼
            ┌──────────────────────────────┐
            │  BACKEND API                 │
            ├──────────────────────────────┤
            │ GET /api/v1/public/config/:slug
            │ GET /v1/catalog/packages    │
            │ POST /v1/bookings           │
            └──────────────────────────────┘
```

## Data Flow: Route Navigation

```
User navigates: /t/acme-corp/packages

        ▼

React Router matches path

        ▼

Load route parameters:
  tenantSlug = "acme-corp"

        ▼

Execute tenantLoader(params)
  ├─ Fetch: GET /api/v1/public/tenant-config/acme-corp
  ├─ Validate: status === 200?
  ├─ Return: { config, slug }
  └─ If error: throw Response

        ▼

Render TenantLayout
  ├─ useLoaderData() → { config, slug }
  ├─ <TenantProvider config={config} slug={slug}>
  └─ Provide useTenant() to tree

        ▼

Render child route: TenantCatalog
  ├─ useTenant() → { config, slug }
  ├─ useTenantQuery('packages', ['list'], fetchFn)
  │  └─ Query key: ['tenant', 'acme-corp', 'packages', 'list']
  ├─ Fetch: GET /v1/catalog/packages
  │  └─ Header: X-Tenant-Slug: acme-corp
  └─ Display <PackageGrid packages={packages} />

        ▼

User clicks package

        ▼

navigate(routes.tenantPackageDetail(slug, segment, pkg))
  └─ Navigate to: /t/acme-corp/s/consulting/p/strategy

        ▼

Load segmentLoader(params)
  └─ Fetch segment config
  └─ Cache: ['tenant', 'acme-corp', 'segment', 'consulting']

        ▼

Render PackageDetail with pre-loaded segment data
```

## Context Provider Tree

```
<App>
  │
  ├─ <QueryClientProvider>
  │  │
  │  ├─ <ThemeProvider>  ◄─── Global brand colors
  │  │  │
  │  │  └─ <AuthProvider>  ◄─── Auth state (JWT, role)
  │  │     │
  │  │     └─ <RouterProvider>
  │  │        │
  │  │        └─ <AppShell>  ◄─── Header, footer (global)
  │  │           │
  │  │           ├─ <HomePage /> (/ route)
  │  │           │
  │  │           └─ <TenantLayout>  ◄─── /t/:tenantSlug
  │  │              │
  │  │              ├─ <TenantProvider>  ◄─── config, slug
  │  │              │  │
  │  │              │  └─ <TenantBrandingProvider>  ◄─── CSS vars
  │  │              │     │
  │  │              │     ├─ <TenantHeader />
  │  │              │     │
  │  │              │     ├─ <Outlet />  ◄─── Nested routes
  │  │              │     │  ├─ <TenantHome />
  │  │              │     │  ├─ <TenantCatalog />
  │  │              │     │  ├─ <SegmentLanding />
  │  │              │     │  └─ <PackageDetail />
  │  │              │     │
  │  │              │     └─ <TenantFooter />

Available hooks by depth:

  App level:
  - useAuth()          (from AuthProvider)
  - useQuery()         (from QueryClientProvider)

  TenantLayout level and below:
  - useAuth()          (inherited)
  - useQuery()         (inherited)
  - useTenant()        (from TenantProvider)  ◄─── NEW
  - useTenantQuery()   (uses useTenant)       ◄─── NEW
  - useTenantBranding() (from BrandingProvider) ◄─── NEW
```

## State & Cache Flow

```
URL: /t/acme-corp/packages

        ▼

Application State:
┌─────────────────────────────────────────────────────┐
│ AuthProvider                                        │
├─────────────────────────────────────────────────────┤
│ user: User | null                                   │
│ token: string | null                                │
│ role: 'TENANT_ADMIN' | 'PLATFORM_ADMIN'             │
│ tenantId: string (for JWT users)                    │
└─────────────────────────────────────────────────────┘
                       │
                       ├─ Different from tenantSlug!
                       │  tenantId = JWT owner's tenant
                       │  tenantSlug = URL tenant (browsing)
                       │

        ▼

React Router Loader Data:
┌─────────────────────────────────────────────────────┐
│ TenantLoadedData                                    │
├─────────────────────────────────────────────────────┤
│ config: TenantConfig {                              │
│   slug: 'acme-corp'                                 │
│   name: 'Acme Corp'                                 │
│   branding: { primaryColor, secondaryColor, ... }  │
│ }                                                   │
└─────────────────────────────────────────────────────┘
        │
        └─ useLoaderData() in TenantLayout
           └─ Passed to <TenantProvider>

        ▼

React Query Cache:
┌─────────────────────────────────────────────────────┐
│ Query Keys                                          │
├─────────────────────────────────────────────────────┤
│ ['tenant', 'acme-corp', 'packages', 'list']        │
│ ['tenant', 'acme-corp', 'packages', 'id-123']      │
│ ['tenant', 'acme-corp', 'segment', 'consulting']   │
│                                                     │
│ ✓ Each cache entry is scoped to tenant            │
│ ✓ Switching tenants clears old caches             │
│ ✓ No data mixing between tenants                   │
└─────────────────────────────────────────────────────┘

        ▼

DOM/CSS Variables:
┌─────────────────────────────────────────────────────┐
│ --color-primary: #2563eb (Acme Corp blue)          │
│ --color-secondary: #f59e0b (Acme Corp amber)       │
│ --font-family: 'Acme Font', sans-serif             │
│ --logo-url: url(https://cdn.acme.com/logo.png)    │
└─────────────────────────────────────────────────────┘
        │
        └─ Applied via TenantBrandingProvider
           └─ Used in Tailwind: bg-[var(--color-primary)]
```

## Request/Response Flow

```
Component
  │
  ├─ useTenantQuery('packages', ['list'], fetchFn)
  │  │
  │  └─ queryKey = ['tenant', 'acme-corp', 'packages', 'list']
  │     (includes tenantSlug for isolation)
  │
  └─ React Query checks cache
     ├─ Miss? → call fetchFn()
     │          │
     │          └─ api.catalog.getPackages()
     │
     └─ In queryFn:
        │
        └─ api.catalog.getPackages() initiates fetch
           │
           └─ ts-rest client prepares request
              │
              ├─ URL: /v1/catalog/packages
              ├─ Method: GET
              │
              └─ Headers via api.ts:
                 ├─ Content-Type: application/json
                 ├─ X-Tenant-Slug: acme-corp  ◄─── Injected!
                 └─ Authorization: Bearer {token}  ◄─── If JWT

                        ▼

        Backend:
        POST /v1/catalog/packages
        Header: X-Tenant-Slug: acme-corp

        ├─ Middleware validates header
        ├─ Resolves to tenantId from slug
        ├─ Query: SELECT * FROM packages WHERE tenantId = ?
        │         (Isolation at DB level)
        │
        └─ Returns: PackageWithAddOns[]

                        ▼

        Response body cached:
        {
          status: 200,
          body: [
            { id, name, description, ... }
          ]
        }

                        ▼

        React Query stores:
        queryCache['tenant']['acme-corp']['packages']['list'] = body

                        ▼

        Component re-renders with data
        <PackageGrid packages={packages} />
```

## Branching Logic: Different User Contexts

```
               User Navigates: /t/acme-corp

                        ▼

    ┌─────────────────────────────────────────────┐
    │ Is user authenticated?                      │
    └─────────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
       NO                              YES
        │                               │
        ▼                               ▼

Public Browsing             User context available
(Widget Mode)               (Auth context loaded)
│                           │
├─ tenantSlug from URL      ├─ tenantSlug from URL
├─ API key from env         ├─ JWT from localStorage
├─ No personalization       ├─ User role known
└─ Generic layout           └─ Can access admin features
                            │
                            ├─ If TENANT_ADMIN of acme-corp
                            │  └─ Can edit packages
                            │
                            ├─ If PLATFORM_ADMIN
                            │  └─ Can impersonate acme-corp
                            │  └─ Can edit all tenants
                            │
                            └─ If OTHER TENANT_ADMIN
                               └─ Can only browse publicly
```

## Deployment Routing Strategies

### Path-Based Routing

```
Domain: app.com

app.com/                    → Home (global)
app.com/t/acme-corp         → Acme Corp storefront
app.com/t/azure-corp        → Azure Corp storefront
app.com/admin               → Platform admin
app.com/tenant              → Tenant admin

Vercel config:
{
  "rewrites": [
    { "source": "/t/:tenantSlug/:path(.*)", "destination": "/t/:tenantSlug/:path" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Subdomain-Based Routing

```
Domain: *.app.com (with wildcard DNS)

app.com                     → Home (global)
acme-corp.app.com           → Acme Corp storefront
azure-corp.app.com          → Azure Corp storefront
admin.app.com               → Platform admin
www.app.com                 → Home (same as root)

Vercel config:
{
  "rewrites": [
    {
      "source": "/:path(.*)",
      "destination": "/t/:tenantSlug/:path",
      "has": [{ "type": "host", "value": "(?<tenantSlug>[^.]+)\\.app\\.com" }]
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}

DNS:
*.app.com  → Vercel nameservers
```

### Custom Domain Routing

```
app.com                     → Home (global)
customer.com                → Customer's storefront
partner.com                 → Partner's storefront
app.com/admin               → Platform admin

Vercel config:
{
  "rewrites": [
    {
      "source": "/:path(.*)",
      "destination": "/t/customer/:path",
      "has": [{ "type": "host", "value": "customer\\.com" }]
    },
    {
      "source": "/:path(.*)",
      "destination": "/t/partner/:path",
      "has": [{ "type": "host", "value": "partner\\.com" }]
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}

Each custom domain needs:
1. DNS pointing to Vercel
2. Vercel config entry
3. Tenant created in DB
```

## Summary Table

| Aspect          | Path-Based       | Subdomain       | Custom     |
| --------------- | ---------------- | --------------- | ---------- |
| **URL Example** | `app.com/t/acme` | `acme.app.com`  | `acme.com` |
| **Setup Time**  | 1 hour           | 2 hours         | 3+ hours   |
| **DNS Changes** | None             | Wildcard record | Per-domain |
| **SSL/TLS**     | Single cert      | Single cert     | Per-domain |
| **White-Label** | Medium           | High            | Full       |
| **Scalability** | Excellent        | Excellent       | Good       |
| **Complexity**  | Low              | Medium          | High       |
| **Best For**    | MVP              | Growth          | Enterprise |
