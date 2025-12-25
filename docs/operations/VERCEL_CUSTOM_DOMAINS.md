# Vercel Custom Domains Setup

## Overview

MAIS tenant websites support custom domains (e.g., `janephotography.com` instead of `maconaisolutions.com/t/jane-photography`).

**Requirement:** Vercel Pro account ($20/month)

## Why Vercel Pro?

Custom domains on Vercel require a paid plan:

| Feature | Hobby (Free) | Pro ($20/mo) |
|---------|--------------|--------------|
| Custom domains | 1 per project | Unlimited |
| SSL certificates | Automatic | Automatic |
| Wildcard domains | No | Yes |
| Domain redirects | Limited | Unlimited |

## Setup Steps

### 1. Upgrade Vercel Account

1. Go to [vercel.com/pricing](https://vercel.com/pricing)
2. Upgrade to Pro plan
3. Verify billing is active

### 2. Add Domain in Vercel Dashboard

1. Go to Project Settings → Domains
2. Click "Add Domain"
3. Enter the tenant's custom domain (e.g., `janephotography.com`)
4. Vercel will provide DNS records

### 3. Configure Tenant's DNS

The tenant needs to update their DNS provider with:

**Option A: CNAME Record (recommended for subdomains)**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

**Option B: A Record (required for apex domains)**
```
Type: A
Name: @
Value: 76.76.21.21
```

### 4. Verify Domain

1. Vercel automatically attempts verification
2. SSL certificate is provisioned automatically (Let's Encrypt)
3. Domain becomes active within minutes

### 5. Database Setup

Add the domain to the `TenantDomain` table:

```sql
INSERT INTO "TenantDomain" (id, "tenantId", domain, verified, "isPrimary")
VALUES (
  'cuid_here',
  'tenant_id_here',
  'janephotography.com',
  true,
  true
);
```

## DNS Verification (Future Enhancement)

For self-service domain setup, we'll implement DNS TXT record verification:

1. Generate verification token: `mais-verify=abc123xyz`
2. Tenant adds TXT record to their DNS
3. Background job polls for verification
4. Once verified, domain is activated

## Middleware Flow

The Next.js middleware (`src/middleware.ts`) handles custom domain routing:

```
janephotography.com/
       ↓
middleware.ts (detects custom domain)
       ↓
Rewrite to /t/_domain?domain=janephotography.com
       ↓
Page component looks up tenant by domain
       ↓
Renders tenant landing page
```

## Troubleshooting

### Domain Not Working

1. Check Vercel dashboard for domain status
2. Verify DNS propagation: `dig janephotography.com`
3. Check SSL certificate status in Vercel

### SSL Certificate Issues

- Vercel auto-provisions SSL via Let's Encrypt
- Propagation can take up to 24 hours
- Check for CAA record conflicts in DNS

### Domain Conflicts

- Only one project can use a domain
- Remove domain from other projects first
- Check for subdomain conflicts

## Cost Analysis

| Tenants | Monthly Cost |
|---------|--------------|
| 1-10 | $20 (Pro plan) |
| 11-50 | $20 (Pro plan) |
| 51+ | $20 (Pro plan) |

Vercel Pro includes unlimited custom domains, so cost doesn't scale with tenant count.

## Future: Programmatic Domain Management

Vercel API supports programmatic domain management:

```typescript
// Add domain via API
const response = await fetch(
  `https://api.vercel.com/v10/projects/${projectId}/domains`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'janephotography.com' }),
  }
);
```

This enables self-service domain setup in the tenant admin dashboard.

## Related Documentation

- [MAIS Custom Domain Flow](../reference/CUSTOM_DOMAIN_FLOW.md)
- [Tenant Admin Guide](../guides/TENANT_ADMIN_GUIDE.md)
- [Vercel Domains Documentation](https://vercel.com/docs/projects/domains)
