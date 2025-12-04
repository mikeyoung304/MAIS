# Multi-Tenant Quick Start Guide

**Status:** Production Live (December 2025)
**Architecture Completion:** 95%
**Current Phase:** Phase 5 - Self-Service Foundation (In Progress)

---

## Overview

MAIS (Macon AI Solutions) is a multi-tenant business growth platform where entrepreneurs and small businesses can embed our booking widget on their websites. Each tenant has:

- Isolated data (packages, bookings, blackouts)
- Variable commission rates (8%, 12%, 15%, etc.)
- Own Stripe Connect account
- Custom branding (colors, logo)
- Unique API keys for widget embedding

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────┐
│ Tenant Website (bellaweddings.com)                 │
│                                                     │
│  <script src="widget.mais.com/sdk/mais-sdk.js"     │
│          data-tenant="bellaweddings"                │
│          data-api-key="pk_live_bella_xxx">          │
│  </script>                                          │
│  <div id="mais-widget"></div>                       │
└──────────────────┬──────────────────────────────────┘
                   │ Embeds
                   ▼
         ┌─────────────────────┐
         │  Widget (iframe)    │
         │  widget.mais.com    │
         └──────────┬──────────┘
                    │ API calls with X-Tenant-Key header
                    ▼
         ┌─────────────────────┐
         │  API Server         │
         │  api.mais.com       │
         │  (Render)           │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐         ┌──────────────┐
         │  PostgreSQL         │◄────────│ Stripe       │
         │  (Supabase)         │         │ Connect      │
         │  - tenantId on      │         │ (12% fee)    │
         │    every table      │         └──────────────┘
         └─────────────────────┘
```

---

## Database Changes

### New Tenant Model

```sql
Tenant {
  id                  String    -- cuid primary key
  slug                String    -- "bellaweddings" (unique)
  name                String    -- "Bella Weddings"
  apiKeyPublic        String    -- pk_live_bella_xxx (unique)
  apiKeySecret        String    -- Hashed
  commissionPercent   Decimal   -- 12.5
  stripeAccountId     String?   -- Connected Account ID
  stripeOnboarded     Boolean   -- false until KYC complete
  secrets             Json      -- Encrypted Stripe keys
  branding            Json      -- {primaryColor, logo, ...}
  isActive            Boolean   -- true
}
```

### Every Model Gets tenantId

```sql
-- Old
Package { id, slug @unique, name, ... }

-- New
Package {
  id,
  tenantId,           -- NEW: Foreign key to Tenant
  slug,
  ...
  @@unique([tenantId, slug])  -- NEW: Composite constraint
}
```

**Same pattern for:** AddOn, Booking, BlackoutDate, WebhookEvent

---

## Code Patterns

### 1. All Queries Must Filter by tenantId

```typescript
// ❌ WRONG - Returns data from ALL tenants
const packages = await prisma.package.findMany({
  where: { active: true },
});

// ✅ CORRECT - Returns data for ONE tenant only
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});
```

### 2. Cache Keys Must Include tenantId

```typescript
// ❌ WRONG - Cache shared across tenants
const cacheKey = 'packages:all';

// ✅ CORRECT - Isolated cache per tenant
const cacheKey = `packages:${tenantId}:all`;
```

### 3. Commission Calculated Server-Side

```typescript
// ✅ Always use CommissionService
const result = await commissionService.calculateCommission(tenantId, 50000);
// Returns: { amount: 6000, percent: 12.0 }

// Pass to Stripe
await stripe.paymentIntents.create(
  {
    amount: 50000,
    application_fee_amount: result.amount, // Platform commission
  },
  {
    stripeAccount: tenant.stripeAccountId, // Connected Account
  }
);
```

### 4. API Routes Use Tenant Middleware

```typescript
import { resolveTenant, requireTenant } from '../middleware/tenant';

const router = Router();

// Apply middleware
router.use(resolveTenant(prisma));
router.use(requireTenant);

// Now req.tenantId is available
router.get('/packages', async (req: TenantRequest, res) => {
  const packages = await catalogService.getAllPackages(req.tenantId!);
  res.json({ packages });
});
```

---

## New Services Created

| Service               | File                             | Purpose                        |
| --------------------- | -------------------------------- | ------------------------------ |
| **Encryption**        | `lib/encryption.service.ts`      | AES-256-GCM for Stripe secrets |
| **API Keys**          | `lib/api-key.service.ts`         | Generate `pk_live_*` keys      |
| **Tenant Middleware** | `middleware/tenant.ts`           | Extract tenant from header     |
| **Commission**        | `services/commission.service.ts` | Calculate variable fees        |

---

## How to Apply Changes

### Step 1: Run Migration (When DB accessible)

```bash
cd server

# Apply migration
pnpm exec prisma migrate dev --name add_multi_tenancy

# Generate Prisma client
pnpm exec prisma generate
```

### Step 2: Generate Encryption Key

```bash
# Generate master encryption key
openssl rand -hex 32

# Add to server/.env
echo "TENANT_SECRETS_ENCRYPTION_KEY=<your_64_char_hex_key>" >> .env
```

### Step 3: Update Service Signatures

All service methods now need `tenantId` as first parameter:

```typescript
// Before
async getAllPackages(): Promise<Package[]>
async getPackageBySlug(slug: string): Promise<Package>

// After
async getAllPackages(tenantId: string): Promise<Package[]>
async getPackageBySlug(tenantId: string, slug: string): Promise<Package>
```

### Step 4: Update Controllers

Pass tenantId from request to services:

```typescript
// Before
const packages = await catalogService.getAllPackages();

// After (using tenant middleware)
const packages = await catalogService.getAllPackages(req.tenantId!);
```

---

## Creating Test Tenant

After migration is applied:

```typescript
// server/scripts/create-test-tenant.ts
import { PrismaClient } from '../src/generated/prisma';
import { apiKeyService } from '../src/lib/api-key.service';

const prisma = new PrismaClient();

async function main() {
  const slug = 'testbusiness';
  const keys = apiKeyService.generateKeyPair(slug);

  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: 'Test Business',
      apiKeyPublic: keys.publicKey,
      apiKeySecret: keys.secretKeyHash,
      commissionPercent: 12.0,
      branding: { primaryColor: '#7C3AED' },
    },
  });

  console.log('✅ Tenant created:');
  console.log('  ID:', tenant.id);
  console.log('  API Key:', keys.publicKey);
  console.log('  Secret:', keys.secretKey); // Show once, then discard
}

main();
```

Run: `pnpm exec tsx scripts/create-test-tenant.ts`

---

## Widget Embedding (Phase 2)

Tenants will embed the booking widget like this:

```html
<!-- On tenant's website -->
<!DOCTYPE html>
<html>
  <head>
    <title>Bella Weddings</title>
  </head>
  <body>
    <h1>Book Your Wedding</h1>

    <!-- MAIS Widget SDK -->
    <script
      src="https://widget.mais.com/sdk/mais-sdk.js"
      data-tenant="bellaweddings"
      data-api-key="pk_live_bellaweddings_a3f8c9d2e1b4f7g8"
    ></script>

    <!-- Widget container -->
    <div id="mais-widget"></div>
  </body>
</html>
```

The SDK:

1. Creates an iframe pointing to `widget.mais.com`
2. Passes tenant & API key as URL params
3. Widget makes API calls with `X-Tenant-Key` header
4. Auto-resizes based on content
5. Communicates via postMessage (booking events)

---

## Security Checklist

- [x] All Prisma queries filter by `tenantId`
- [x] Cache keys include `tenantId`
- [x] Commission calculated server-side only
- [ ] Tenant middleware applied to all protected routes
- [ ] Stripe webhook signature validation
- [ ] postMessage origin validation (never `'*'`)
- [ ] CORS configured for known domains
- [ ] Rate limiting enabled
- [ ] CSP headers with `frame-ancestors` whitelist

---

## Testing Tenant Isolation

```typescript
describe('Tenant Isolation', () => {
  it('prevents cross-tenant data access', async () => {
    const tenant1 = await createTenant('tenant1');
    const tenant2 = await createTenant('tenant2');

    // Create package for tenant1
    await createPackage(tenant1.id, { slug: 'package1', ... });

    // Try to access as tenant2
    const result = await prisma.package.findUnique({
      where: {
        tenantId_slug: { tenantId: tenant2.id, slug: 'package1' }
      }
    });

    expect(result).toBeNull(); // ✅ Isolated
  });
});
```

---

## Troubleshooting

### Error: "Tenant context required"

**Fix:** Add tenant middleware to route:

```typescript
router.use(resolveTenant(prisma));
router.use(requireTenant);
```

### Error: "Package with slug 'X' already exists"

**Cause:** Unique constraint now composite `[tenantId, slug]`
**Fix:** Update Prisma query:

```typescript
where: {
  tenantId_slug: {
    (tenantId, slug);
  }
}
```

### Cache returning wrong tenant's data

**Cause:** Cache key doesn't include tenantId
**Fix:** Update cache key:

```typescript
const key = `catalog:${tenantId}:packages`;
```

---

## Current Branch Status

**Branch:** `main` (production-ready)

**Completed (Phase 1-4):**

- ✅ Database schema with multi-tenant isolation
- ✅ Tenant middleware and authentication
- ✅ Core services (encryption, API keys, commission)
- ✅ All service layers tenant-scoped
- ✅ API routes with tenant isolation
- ✅ Tenant admin dashboard operational
- ✅ Package photo uploads (Phase 5.1)

**In Progress (Phase 5):**

- 🚧 Add-on management UI
- 🚧 Email template customization

**Future Phases:**

- ⏳ Content/Copy CMS (Phase 6)
- ⏳ Cloud storage migration (Phase 7)
- ⏳ Advanced features (Phase 8+)

---

## Key Implementation Files

### Core Multi-Tenant Infrastructure

- `server/prisma/schema.prisma` - Tenant model with all entity relationships
- `server/src/lib/encryption.service.ts` - Tenant secrets encryption (AES-256-GCM)
- `server/src/lib/api-key.service.ts` - API key generation/validation
- `server/src/middleware/tenant.ts` - Tenant resolution middleware
- `server/src/services/commission.service.ts` - Variable commission calculation

### Service Layer

- All services updated with `tenantId` as first parameter
- Repository pattern enforces tenant isolation
- Cache keys scoped by tenant

### API Routes

- Tenant middleware applied via ts-rest globalMiddleware
- All routes properly tenant-scoped
- Admin routes for tenant management

---

## Migration to Production

All Phase 1-4 changes have been applied to the production database. The system is live with:

- Multiple active tenants
- Complete data isolation verified
- Commission calculation operational
- Tenant admin dashboard functional

For new deployments, see the migration guides in MULTI_TENANT_IMPLEMENTATION_GUIDE.md.

---

**Questions?** See `MULTI_TENANT_IMPLEMENTATION_GUIDE.md` for detailed explanations.
