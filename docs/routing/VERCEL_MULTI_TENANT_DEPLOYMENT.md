# Vercel Multi-Tenant Deployment Configuration

Complete guide for deploying tenant-scoped routing to Vercel with custom domains, subdomains, and path-based routing.

## Deployment Strategies

### Strategy 1: Path-Based Routing (Simplest)

**URL Pattern:** `app.com/t/{tenantSlug}`

**Pros:**

- No DNS configuration needed
- Single domain SSL certificate
- Easiest to implement
- Works immediately after deploy

**Cons:**

- Tenants share same domain (less white-label)
- URL is longer

#### Vercel Configuration

```json
// vercel.json
{
  "framework": "vite",
  "buildCommand": "npm run build --workspace=@macon/web",
  "outputDirectory": "client/dist",
  "rewrites": [
    // Tenant path routes
    { "source": "/t/:tenantSlug/:path(.*)", "destination": "/t/:tenantSlug/:path" },

    // Legacy routes
    { "source": "/admin/:path(.*)", "destination": "/admin/:path" },
    { "source": "/tenant/:path(.*)", "destination": "/tenant/:path" },

    // Catch-all for SPA
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/t/:tenantSlug/:path(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, must-revalidate"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
```

**Deployment:**

```bash
npm run build
# Push to Vercel (automatic with GitHub integration)
```

**Test:**

```
https://app.vercel.app/t/demo-tenant
https://app.vercel.app/t/acme-corp
```

---

### Strategy 2: Subdomain-Based Routing

**URL Pattern:** `{tenantSlug}.app.com`

**Pros:**

- True white-label URLs
- Tenants can use custom subdomains
- Professional appearance

**Cons:**

- Requires DNS wildcard configuration
- Each custom domain needs SSL certificate
- More complex Vercel setup

#### DNS Setup

For wildcard subdomains, configure your DNS provider:

```
DNS Record Type: A (or CNAME for Vercel)
Name: *.app.com
Value: Vercel's nameservers or IP
TTL: 3600
```

**Example (Route53):**

```
Name: *.app.com
Type: CNAME
Value: cname.vercel-dns.com
```

**Example (Cloudflare):**

```
Type: CNAME
Name: *
Content: app.vercel.app
```

#### Vercel Configuration with Subdomains

```json
// vercel.json
{
  "framework": "vite",
  "buildCommand": "npm run build --workspace=@macon/web",
  "outputDirectory": "client/dist",
  "rewrites": [
    // Extract tenant from subdomain
    {
      "source": "/:path(.*)",
      "destination": "/t/:tenantSlug/:path",
      "has": [
        {
          "type": "host",
          "value": "(?<tenantSlug>[^.]+)\\.app\\.com"
        }
      ]
    },

    // Main domain root
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/:path(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, must-revalidate"
        }
      ],
      "has": [
        {
          "type": "host",
          "value": "(?<tenantSlug>[^.]+)\\.app\\.com"
        }
      ]
    }
  ]
}
```

**Important:** Vercel's `has` condition with named groups requires:

1. Node.js 16+ (check Vercel Environment tab)
2. Vercel Pro plan (for custom headers with named groups)
3. Proper named group syntax in regex

#### Alternative: Edge Middleware (Modern Approach)

For more control, use Vercel's Edge Middleware:

```typescript
// middleware.ts - at project root (not in client/)
import { NextResponse, type NextRequest } from 'next/server';

/**
 * This is a simplified example. For a pure Vite/SPA setup,
 * middleware is less commonly used, but shown for reference.
 */
export function middleware(request: NextRequest) {
  const { hostname } = request.nextUrl;

  // Extract subdomain
  const subdomain = hostname.split('.')[0];

  // If subdomain looks like a tenant slug (not www, app, etc)
  if (subdomain && !['www', 'app', 'api'].includes(subdomain)) {
    const url = request.nextUrl.clone();
    url.pathname = `/t/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

**Note:** This middleware approach works with Next.js. For a pure Vite/SPA app, the `vercel.json` rewrites are preferred.

**Test:**

```
https://demo-tenant.app.com
https://acme-corp.app.com
https://www.app.com (main domain)
```

---

### Strategy 3: Custom Domains per Tenant

**URL Pattern:** Tenants use their own custom domain

**Pros:**

- Full white-label experience
- SEO benefits (own domain)
- Tenant branding without URL compromise

**Cons:**

- Most complex setup
- Requires domain management
- Each domain needs separate configuration

#### Setup Steps

##### 1. Add Custom Domain in Vercel Dashboard

```
Project Settings → Domains → Add
Domain: customer.com
Type: Root Domain or Subdomain
```

Vercel will provide nameservers:

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

##### 2. Point Domain to Vercel

Update customer's domain registrar to use Vercel's nameservers or CNAME:

```
Type: NS
customer.com -> ns1.vercel-dns.com, ns2.vercel-dns.com
```

Or:

```
Type: CNAME
www.customer.com -> cname.vercel-dns.com
customer.com -> ALIAS/ANAME -> cname.vercel-dns.com
```

##### 3. Vercel Configuration

```json
// vercel.json
{
  "framework": "vite",
  "buildCommand": "npm run build --workspace=@macon/web",
  "outputDirectory": "client/dist",
  "rewrites": [
    // Custom domain → tenant path
    {
      "source": "/:path(.*)",
      "destination": "/t/:tenantSlug/:path",
      "has": [
        {
          "type": "host",
          "value": "customer\\.com"
        }
      ]
    },

    // Subdomain → tenant path
    {
      "source": "/:path(.*)",
      "destination": "/t/:tenantSlug/:path",
      "has": [
        {
          "type": "host",
          "value": "(?<tenantSlug>[^.]+)\\.app\\.com"
        }
      ]
    },

    // Main domain
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

##### 4. Database Mapping

Store domain-to-tenant mapping in database:

```typescript
// server/src/routes/public.routes.ts
const domainToTenant = {
  'customer.com': 'customer-tenant-id',
  'partner.com': 'partner-tenant-id',
};

export async function resolveTenantFromDomain(host: string) {
  const domain = host.split(':')[0]; // Remove port
  return domainToTenant[domain];
}
```

**Test:**

```
https://customer.com (SSL auto-provisioned)
https://app.vercel.app/t/customer
```

---

## Hybrid Strategy: Combine All Three

For maximum flexibility, support all routing strategies simultaneously:

```json
// vercel.json - Hybrid approach
{
  "framework": "vite",
  "buildCommand": "npm run build --workspace=@macon/web",
  "outputDirectory": "client/dist",
  "rewrites": [
    // Custom tenant domains (highest priority)
    {
      "source": "/:path(.*)",
      "destination": "/t/customer/:path",
      "has": [
        {
          "type": "host",
          "value": "customer\\.com"
        }
      ]
    },

    // Subdomains (medium priority)
    {
      "source": "/:path(.*)",
      "destination": "/t/:tenantSlug/:path",
      "has": [
        {
          "type": "host",
          "value": "(?<tenantSlug>[^.]+)\\.app\\.com"
        }
      ]
    },

    // Path-based (default)
    {
      "source": "/t/:tenantSlug/:path(.*)",
      "destination": "/t/:tenantSlug/:path"
    },

    // Admin routes
    {
      "source": "/admin/:path(.*)",
      "destination": "/admin/:path"
    },

    // SPA catch-all
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },

    // Tenant pages - shorter cache
    {
      "source": "/t/:tenantSlug/:path(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, must-revalidate"
        }
      ]
    },

    // Security headers for tenant pages
    {
      "source": "/t/:tenantSlug/:path(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

---

## Environment Variables

Configure environment variables for tenant routing:

```bash
# .env.local (development)
VITE_API_URL=http://localhost:3001
VITE_TENANT_SLUG=demo-tenant  # For testing

# .env.production
VITE_API_URL=https://api.app.com
# No tenant slug - determined by URL
```

### Build Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
```

---

## Troubleshooting

### Issue: Routes Not Working After Deploy

**Symptoms:** Getting 404 on `/t/:tenantSlug` routes

**Solution:**

1. Check `vercel.json` rewrites order (most specific first)
2. Ensure catch-all rewrite goes last: `{ "source": "/(.*)", "destination": "/index.html" }`
3. Verify React Router routes match Vercel rewrites

### Issue: Custom Domain SSL Not Provisioning

**Symptoms:** Certificate error on custom domain

**Solution:**

1. Wait 48 hours for DNS propagation
2. Check Vercel dashboard for certificate status
3. Ensure DNS records are pointing to Vercel
4. In Vercel dashboard: Settings → Domains → Refresh

### Issue: Subdomains Not Resolving

**Symptoms:** `*.app.com` not reaching deployment

**Solution:**

1. Verify DNS wildcard record exists: `*.app.com`
2. Check DNS propagation: `dig *.app.com`
3. Ensure Vercel Pro plan (required for wildcard)
4. Test with: `test.app.com`, `demo.app.com`

### Issue: Token Refresh Failing Across Tenants

**Symptoms:** Logout when switching tenants

**Solution:**

1. Store JWT in HttpOnly cookie (not localStorage)
2. Clear tenant-specific caches when switching
3. Implement proper CSRF protection for custom domains

---

## Security Considerations

### 1. Content Security Policy

```json
// vercel.json - CSP headers for tenant pages
{
  "source": "/t/:tenantSlug/:path(.*)",
  "headers": [
    {
      "key": "Content-Security-Policy",
      "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src *;"
    }
  ]
}
```

### 2. CORS for Tenant APIs

```typescript
// server/src/middleware/cors.ts
import cors from 'cors';

const whitelist = process.env.CORS_WHITELIST?.split(',') || [];

const corsOptions = {
  origin: function (origin: string, callback: Function) {
    // Allow subdomains
    if (origin?.match(/^https:\/\/[^.]+\.app\.com$/) || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
```

### 3. Tenant Isolation in Cookies

```typescript
// For subdomain tenants, set SameSite=Lax
res.cookie('sessionId', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'Lax', // Allow cross-subdomain
  domain: '.app.com', // Allow subdomains
});

// For custom domains, use Strict
res.cookie('sessionId', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
});
```

---

## Performance Optimization

### 1. Asset Caching

```json
{
  "source": "/assets/:path(.*)",
  "headers": [
    {
      "key": "Cache-Control",
      "value": "public, max-age=31536000, immutable"
    }
  ]
}
```

### 2. Tenant Config Caching

Cache tenant configs at CDN level:

```json
{
  "source": "/api/v1/public/tenant-config/:slug",
  "headers": [
    {
      "key": "Cache-Control",
      "value": "public, max-age=86400"
    }
  ]
}
```

### 3. Image Optimization

Use Vercel Image Optimization for tenant logos:

```typescript
// components/TenantLogo.tsx
export function TenantLogo() {
  return (
    <img
      src={`/_next/image?url=${encodeURIComponent(logoUrl)}&w=200&q=75`}
      alt="Logo"
      width={200}
      height={60}
    />
  );
}
```

---

## Monitoring & Analytics

### 1. Vercel Analytics

Monitor per-route performance:

```bash
# View in Vercel Dashboard
# Analytics → Real Experience Monitoring → Routes
```

### 2. Error Tracking

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

// Tag events with tenant
Sentry.captureException(error, {
  tags: {
    tenant: tenantSlug,
  },
});
```

### 3. Custom Domain Monitoring

```typescript
// Track which custom domain was accessed
analytics.track('tenant_accessed', {
  domain: window.location.hostname,
  tenantSlug: params.tenantSlug,
  timestamp: new Date(),
});
```

---

## Migration Path

### From Single Domain to Multi-Tenant

**Phase 1: Path-Based (Week 1)**

- Deploy with `/t/:slug` routes
- Works immediately

**Phase 2: Subdomains (Week 2)**

- Add wildcard DNS record
- Update `vercel.json` with subdomain rules
- Enable for beta tenants

**Phase 3: Custom Domains (Week 3)**

- Add custom domain support
- Build domain management UI
- Gradual rollout to enterprise tenants

**Phase 4: Deprecate Old Routes (Week 4)**

- Remove legacy routes
- Migrate admin to tenant admin dashboard

---

## Complete Deployment Checklist

- [ ] Router updated with `/t/:tenantSlug` routes
- [ ] Tenant context provider implemented
- [ ] API client configured for tenant routing
- [ ] `vercel.json` updated with rewrites
- [ ] DNS records configured (if using subdomains/custom)
- [ ] CORS headers configured
- [ ] Security headers added
- [ ] CSP policy updated
- [ ] Analytics configured
- [ ] Error tracking enabled
- [ ] Performance monitoring set up
- [ ] Tested in preview deployment
- [ ] Custom domain tested (if applicable)
- [ ] SSL certificates verified
- [ ] Deployment to production
- [ ] Monitoring alerts configured

---

## Summary

Vercel provides flexible options for multi-tenant routing:

1. **Path-based** (`/t/:slug`) - Simplest, no DNS setup
2. **Subdomains** (`slug.app.com`) - Professional, requires DNS
3. **Custom domains** (`customer.com`) - White-label, most setup

Choose based on your use case and implement hybrid support for maximum flexibility.
