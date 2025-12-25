# Custom Domains Setup Guide

This guide explains how to configure custom domains for tenant storefronts in MAIS.

## Overview

MAIS allows tenants to use their own domain (e.g., `www.janephotography.com`) for their storefront instead of the default `maconaisolutions.com/t/[slug]` URL.

## Architecture

### Domain Resolution Flow

1. **Middleware Detection**: Next.js middleware checks if the incoming hostname matches a custom domain pattern
2. **Rewrite to Internal Route**: Custom domains are rewritten to `/t/_domain/...?domain=hostname`
3. **API Lookup**: The `_domain` routes call `GET /v1/public/tenants/by-domain/:domain` to resolve the tenant
4. **Render Storefront**: The storefront is rendered with the tenant's branding and packages

### Database Schema

```prisma
model TenantDomain {
  id                String    @id @default(cuid())
  tenantId          String
  domain            String    @unique  // e.g., "www.janephotography.com"
  verified          Boolean   @default(false)
  isPrimary         Boolean   @default(false)
  verificationToken String    // For DNS TXT verification
  verifiedAt        DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  tenant            Tenant    @relation(...)
}
```

## Tenant Setup Process

### 1. Add Domain

Tenants navigate to `/tenant/domains` and enter their domain name (without `http://` or `https://`).

### 2. DNS Verification

The system generates a verification token. Tenants must add a TXT record to their DNS:

```
Record Name:  _mais-verify.example.com
Record Type:  TXT
Record Value: mais-verify=<token>
```

### 3. Verify Domain

After DNS propagation (usually 5-30 minutes, max 48 hours), the tenant clicks "Verify" and the system checks for the TXT record.

### 4. Configure DNS (After Verification)

Once verified, tenants add a CNAME or A record to point their domain to MAIS:

**For CNAME (recommended for subdomains like `www.`):**
```
Record Name:  www
Record Type:  CNAME
Record Value: cname.maconaisolutions.com
```

**For A record (for root/apex domains):**
```
Record Name:  @
Record Type:  A
Record Value: <Vercel IP address>
```

## Vercel Configuration

### Adding Custom Domains to Vercel

1. **Via Vercel Dashboard:**
   - Go to Project Settings > Domains
   - Add each tenant's custom domain
   - Vercel handles SSL certificates automatically

2. **Via Vercel API (for automation):**
   ```bash
   curl -X POST "https://api.vercel.com/v10/projects/{projectId}/domains" \
     -H "Authorization: Bearer $VERCEL_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name": "www.example.com"}'
   ```

3. **Wildcard Domains (Enterprise only):**
   - For high-volume tenants, consider wildcard domain support
   - Requires Vercel Enterprise plan

### Environment Variables

```bash
# Required for production
NEXT_PUBLIC_API_URL=https://api.maconaisolutions.com
NEXT_PUBLIC_APP_URL=https://maconaisolutions.com

# Optional: Vercel API for domain automation
VERCEL_TOKEN=<your-vercel-token>
VERCEL_PROJECT_ID=<your-project-id>
```

## API Endpoints

### Public Endpoints

```
GET /v1/public/tenants/by-domain/:domain
```
Returns tenant public info if domain is verified and active.

### Tenant Admin Endpoints (Authenticated)

```
GET    /v1/tenant-admin/domains          # List domains
POST   /v1/tenant-admin/domains          # Add domain
GET    /v1/tenant-admin/domains/:id      # Get domain
POST   /v1/tenant-admin/domains/:id/verify   # Verify domain
POST   /v1/tenant-admin/domains/:id/primary  # Set as primary
DELETE /v1/tenant-admin/domains/:id      # Remove domain
```

## Middleware Configuration

The Next.js middleware in `apps/web/src/middleware.ts` handles domain detection:

```typescript
// Custom domain detection
const isCustomDomain = !isInternalHost(hostname);

if (isCustomDomain) {
  // Rewrite to internal route with domain in query
  return NextResponse.rewrite(
    new URL(`/t/_domain${pathname}?domain=${hostname}`, request.url)
  );
}
```

## Route Structure

```
apps/web/src/app/t/
├── [slug]/                    # Slug-based routes
│   ├── page.tsx              # Landing page
│   ├── book/
│   │   ├── [packageSlug]/
│   │   │   └── page.tsx      # Booking wizard
│   │   └── success/
│   │       └── page.tsx      # Success page
│   └── ...
└── _domain/                   # Custom domain routes
    ├── page.tsx              # Landing page
    └── book/
        ├── [packageSlug]/
        │   └── page.tsx      # Booking wizard
        └── success/
            └── page.tsx      # Success page
```

## Troubleshooting

### Domain Verification Fails

1. **DNS Propagation**: Wait up to 48 hours for DNS changes to propagate
2. **Record Location**: Ensure the TXT record is at `_mais-verify.domain.com`, not just `domain.com`
3. **Record Value**: The value should be exactly `mais-verify=<token>` with no extra spaces

### SSL Certificate Issues

- Vercel automatically provisions SSL certificates
- If issues persist, check Vercel dashboard for certificate status
- CAA records may block certificate issuance

### Domain Not Resolving

1. Check that the CNAME/A record points to Vercel
2. Verify the domain is added to Vercel project
3. Ensure the domain is verified in MAIS dashboard

## Security Considerations

1. **Domain Verification**: The TXT record verification proves domain ownership
2. **Token Security**: Verification tokens are randomly generated (32 hex chars)
3. **Timing Attack Prevention**: Domain lookups use constant-time responses
4. **Rate Limiting**: All domain endpoints are rate-limited

## Future Improvements

- [ ] Automated Vercel domain provisioning via API
- [ ] Wildcard domain support for enterprise tenants
- [ ] Domain health monitoring and alerting
- [ ] Bulk domain import for migrations
