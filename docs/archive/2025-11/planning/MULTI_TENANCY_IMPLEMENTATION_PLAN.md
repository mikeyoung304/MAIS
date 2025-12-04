# ELOPE MULTI-TENANCY IMPLEMENTATION PLAN

**Optimized 6-Month Phased Rollout**

**Business Context:**

- Starting scale: 2 tenants immediately
- Year 1 target: ~10 tenants (including owner's 4 businesses)
- Max scale: 50 tenants (lifetime)
- Pricing: Commission-based (% of sales via Stripe Connect)
- Provisioning: Admin-provisioned (no self-service signup)
- Timeline: 6 months to production-ready

**Strategy:** Get to revenue fast (2 tenants live in 3 weeks), then iterate based on real usage.

---

## PHASED APPROACH OVERVIEW

```
Phase 0: Planning & Setup                   [Week 0]
    ↓
Phase 1: MVP - 2 Tenants Live              [Weeks 1-3] ← REVENUE START
    ↓
Phase 2: Stripe Connect Integration         [Weeks 4-6] ← COMMISSION MODEL
    ↓
Phase 3: Rich Theming & Customization      [Weeks 7-10]
    ↓
Phase 4: Scale to 10 Tenants               [Weeks 11-14] ← USER'S 4 BUSINESSES
    ↓
Phase 5: Production Hardening              [Weeks 15-18]
    ↓
Phase 6: Polish & Scale to 50              [Weeks 19-24]
```

**Key Milestones:**

- Week 3: First 2 paying tenants live ✅
- Week 6: Commission-based revenue model live ✅
- Week 14: All 10 target tenants onboarded ✅
- Week 24: Production-ready for 50 tenants ✅

---

## PHASE 0: PLANNING & SETUP

**Duration:** Week 0 (5 days)
**Goal:** Lock down technical decisions and set up development workflow

### Technical Decisions to Finalize

**Decision 1: Subdomain Pattern**

- Primary: `{tenant-slug}.elope.com`
- Example: `acme-weddings.elope.com`
- DNS: Wildcard A record (`*.elope.com → server IP`)
- SSL: Wildcard certificate or Cloudflare proxy

**Decision 2: Tenant Slug Format**

- Format: `lowercase-with-hyphens`
- Validation: `/^[a-z0-9-]{3,50}$/`
- Reserved: `www`, `api`, `admin`, `app`, `staging`, `demo`

**Decision 3: Database Migration Strategy**

- Approach: Online migration (zero downtime)
- Steps: Add nullable → backfill → make NOT NULL
- Default tenant: Create "legacy" tenant for existing data

**Decision 4: Stripe Connect Account Type**

- Type: **Standard Accounts** (recommended)
- Why: Tenant manages own Stripe dashboard
- Platform fee: Set application_fee_percent in checkout
- Alternative: Express Accounts (if you want simpler onboarding)

**Decision 5: Development Workflow**

- Branch strategy: `multi-tenancy/phase-N` branches
- Testing: Staging environment with 3 test tenants
- Local dev: Use `tenant1.localhost`, `tenant2.localhost`

### Deliverables

- [ ] DNS configured (wildcard `*.elope.com`)
- [ ] SSL certificate (wildcard or Cloudflare)
- [ ] Staging environment set up
- [ ] Local hosts file configured
- [ ] Git branch created: `multi-tenancy/phase-1`
- [ ] Team aligned on technical decisions
- [ ] Risk mitigation plan documented

### Success Criteria

✅ Can visit `test.localhost:5173` and see app
✅ Wildcard DNS resolves `*.elope.com`
✅ Staging environment deployed
✅ All technical decisions documented

---

## PHASE 1: MVP - 2 TENANTS LIVE

**Duration:** Weeks 1-3 (3 weeks)
**Goal:** Get 2 paying tenants live on multi-tenant platform

### Scope: MINIMUM VIABLE MULTI-TENANCY

**What's INCLUDED:**

- ✅ Database schema with `tenantId`
- ✅ Tenant resolution from subdomain
- ✅ Backend tenant filtering (all queries scoped)
- ✅ Basic frontend theming (logo + 3 colors)
- ✅ Manual tenant provisioning (SQL scripts)
- ✅ Security: Row-level isolation

**What's EXCLUDED (for now):**

- ❌ Stripe Connect (use existing single Stripe account)
- ❌ Rich theming (just logo + colors)
- ❌ Custom content (hero, features, etc.)
- ❌ Theme editor UI (manual config)
- ❌ Admin provisioning UI (SQL scripts)

### Week 1: Database Migration

#### Task 1.1: Create Tenant Model (Day 1)

**File:** `server/prisma/schema.prisma`

```prisma
model Tenant {
  id        String   @id @default(cuid())
  slug      String   @unique
  name      String

  // Basic Branding
  logoUrl   String?
  primaryColor   String @default("#8770B7")
  secondaryColor String @default("#3D405B")
  accentColor    String @default("#A593C9")

  // Contact
  contactEmail String
  contactPhone String?

  // Status
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  packages      Package[]
  bookings      Booking[]
  customers     Customer[]
  venues        Venue[]
  blackoutDates BlackoutDate[]
  users         User[]

  @@index([slug])
  @@index([active])
}
```

**Commands:**

```bash
# Generate migration
npx prisma migrate dev --name add_tenant_model --create-only

# Review migration file
# Edit if needed
# Apply migration
npx prisma migrate dev
```

#### Task 1.2: Add tenantId to All Models (Day 2)

**Models to update:** Package, AddOn, Booking, Customer, User, Venue, BlackoutDate, Payment

**Example (Booking):**

```prisma
model Booking {
  id         String   @id @default(cuid())
  tenantId   String   // ADD THIS
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // ... existing fields ...

  @@unique([tenantId, date])  // CHANGE: Was just @unique on date
  @@index([tenantId, date])
  @@index([tenantId, status, date])
  @@index([tenantId, customerId])
}
```

**Critical Changes:**

- `Booking.date`: `@unique` → `@@unique([tenantId, date])`
- `Package.slug`: `@unique` → `@@unique([tenantId, slug])`
- `Customer.email`: `@unique` → `@@unique([tenantId, email])`
- `User.email`: `@unique` → `@@unique([tenantId, email])`

#### Task 1.3: Data Migration (Day 3)

**Create migration script:** `server/scripts/migrate-to-multi-tenant.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting multi-tenant migration...');

  // 1. Create default tenant
  const defaultTenant = await prisma.tenant.create({
    data: {
      slug: 'legacy',
      name: 'Legacy Elope',
      contactEmail: 'admin@elope.com',
      primaryColor: '#8770B7',
      secondaryColor: '#3D405B',
      accentColor: '#A593C9',
      active: true,
    },
  });

  console.log(`Created default tenant: ${defaultTenant.id}`);

  // 2. Backfill existing data
  const updates = await Promise.all([
    prisma.package.updateMany({
      where: { tenantId: null },
      data: { tenantId: defaultTenant.id },
    }),
    prisma.booking.updateMany({
      where: { tenantId: null },
      data: { tenantId: defaultTenant.id },
    }),
    prisma.customer.updateMany({
      where: { tenantId: null },
      data: { tenantId: defaultTenant.id },
    }),
    prisma.user.updateMany({
      where: { tenantId: null },
      data: { tenantId: defaultTenant.id },
    }),
    // ... other models
  ]);

  console.log('Backfill complete:', updates);

  // 3. Validate
  const nullTenantCount = await prisma.booking.count({
    where: { tenantId: null },
  });

  if (nullTenantCount > 0) {
    throw new Error(`Found ${nullTenantCount} bookings with null tenantId!`);
  }

  console.log('✅ Migration successful!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run migration:**

```bash
npx tsx server/scripts/migrate-to-multi-tenant.ts
```

#### Task 1.4: Enable Row-Level Security (Day 3)

**File:** `server/prisma/migrations/[timestamp]_enable_rls.sql`

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Package" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlackoutDate" ENABLE ROW LEVEL SECURITY;

-- Create policy (will use app.current_tenant_id context)
CREATE POLICY tenant_isolation_booking ON "Booking"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_package ON "Package"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Repeat for other tables...
```

### Week 2: Backend Multi-Tenancy

#### Task 2.1: Tenant Resolver Middleware (Day 4)

**Create file:** `server/src/middleware/tenant-resolver.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { DomainError } from '../lib/errors';

const prisma = new PrismaClient();

export class TenantNotFoundError extends DomainError {
  constructor(identifier: string) {
    super('TENANT_NOT_FOUND', `Tenant "${identifier}" not found or inactive`);
    this.statusCode = 404;
  }
}

export function tenantResolverMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract subdomain
      const host = req.hostname;
      const parts = host.split('.');

      // Local development: read from env or default
      if (host === 'localhost' || host === '127.0.0.1') {
        const devTenantSlug = process.env.DEV_TENANT_SLUG || 'legacy';
        const tenant = await prisma.tenant.findUnique({
          where: { slug: devTenantSlug },
        });

        if (!tenant) {
          throw new TenantNotFoundError(devTenantSlug);
        }

        res.locals.tenant = tenant;
        return next();
      }

      // Production: extract from subdomain
      if (parts.length < 3) {
        throw new TenantNotFoundError(host);
      }

      const subdomain = parts[0];

      // Reserved subdomains
      if (['www', 'api', 'admin', 'app'].includes(subdomain)) {
        throw new TenantNotFoundError(subdomain);
      }

      // Lookup tenant
      const tenant = await prisma.tenant.findUnique({
        where: { slug: subdomain },
      });

      if (!tenant || !tenant.active) {
        throw new TenantNotFoundError(subdomain);
      }

      // Store in res.locals
      res.locals.tenant = tenant;
      next();
    } catch (error) {
      next(error);
    }
  };
}
```

**Update:** `server/src/app.ts`

```typescript
import { tenantResolverMiddleware } from './middleware/tenant-resolver';

// Add AFTER body parsers, BEFORE routes
app.use(tenantResolverMiddleware());
```

#### Task 2.2: Update Repository Interfaces (Day 5)

**File:** `server/src/lib/ports.ts`

Update all repository interfaces to require `tenantId`:

```typescript
export interface CatalogRepository {
  getAllPackages(tenantId: string): Promise<Package[]>;
  getPackageBySlug(slug: string, tenantId: string): Promise<Package | null>;
  createPackage(data: CreatePackageInput, tenantId: string): Promise<Package>;
  // ... other methods with tenantId parameter
}

export interface BookingRepository {
  create(booking: Booking, tenantId: string): Promise<Booking>;
  findById(id: string, tenantId: string): Promise<Booking | null>;
  findAll(tenantId: string): Promise<Booking[]>;
  isDateBooked(date: string, tenantId: string): Promise<boolean>;
  // ... other methods
}

// Repeat for BlackoutRepository, UserRepository, etc.
```

#### Task 2.3: Refactor Repositories (Days 6-7)

**Pattern:** Create base class for tenant-scoped repositories

**New file:** `server/src/adapters/prisma/base-repository.ts`

```typescript
import { PrismaClient } from '@prisma/client';

export abstract class TenantScopedRepository {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly tenantId: string
  ) {}

  protected getTenantFilter() {
    return { tenantId: this.tenantId };
  }

  protected getTenantFilterWhere<T extends object>(where: T) {
    return { ...where, tenantId: this.tenantId };
  }
}
```

**Update:** `server/src/adapters/prisma/catalog.repository.ts`

```typescript
import { TenantScopedRepository } from './base-repository';

export class PrismaCatalogRepository extends TenantScopedRepository implements CatalogRepository {
  async getAllPackages(): Promise<Package[]> {
    const packages = await this.prisma.package.findMany({
      where: this.getTenantFilter(), // Auto-adds tenantId
      include: {
        addOns: {
          include: { addOn: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return packages.map(this.toDomainPackage);
  }

  async getPackageBySlug(slug: string): Promise<Package | null> {
    const pkg = await this.prisma.package.findFirst({
      where: this.getTenantFilterWhere({ slug }), // Scoped to tenant
      include: {
        addOns: {
          include: { addOn: true },
        },
      },
    });

    return pkg ? this.toDomainPackage(pkg) : null;
  }

  // ... other methods updated similarly
}
```

**Repeat for:**

- `booking.repository.ts`
- `blackout.repository.ts`
- `user.repository.ts`
- `webhook.repository.ts`

#### Task 2.4: Update Service Layer (Day 8)

**File:** `server/src/services/catalog.service.ts`

Remove tenantId from method signatures (service gets it via constructor):

```typescript
export class CatalogService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly cache?: CacheService
  ) {}

  async getAllPackages(): Promise<PackageWithAddOns[]> {
    // Repository already has tenantId from construction
    return this.repository.getAllPackages();
  }

  async getPackageBySlug(slug: string): Promise<PackageWithAddOns> {
    const pkg = await this.repository.getPackageBySlug(slug);
    if (!pkg) {
      throw new NotFoundError('Package', slug);
    }
    return pkg;
  }

  // ... other methods (tenantId is implicit)
}
```

#### Task 2.5: Refactor DI Container (Days 9-10)

**File:** `server/src/di.ts`

Change from singleton services to per-request factory:

```typescript
export interface Container {
  createTenantServices: (tenantId: string) => TenantServices;
  globalServices: {
    identity: IdentityService;
  };
}

export interface TenantServices {
  catalogService: CatalogService;
  bookingService: BookingService;
  availabilityService: AvailabilityService;
}

export function buildContainer(config: Config): Container {
  const prisma = new PrismaClient({
    /* ... */
  });
  const eventEmitter = new InProcessEventEmitter();
  const cacheService = new CacheService(900);

  // Global services (not tenant-scoped)
  const userRepo = new PrismaUserRepository(prisma);
  const identityService = new IdentityService(userRepo, config.JWT_SECRET);

  // Factory for tenant-scoped services
  function createTenantServices(tenantId: string): TenantServices {
    // Create tenant-scoped repositories
    const catalogRepo = new PrismaCatalogRepository(prisma, tenantId);
    const bookingRepo = new PrismaBookingRepository(prisma, tenantId);
    const blackoutRepo = new PrismaBlackoutRepository(prisma, tenantId);

    // Create services with tenant-scoped repos
    const catalogService = new CatalogService(catalogRepo, cacheService);
    const bookingService = new BookingService(
      bookingRepo,
      catalogRepo,
      eventEmitter,
      paymentProvider
    );
    const availabilityService = new AvailabilityService(
      calendarProvider,
      blackoutRepo,
      bookingRepo
    );

    return { catalogService, bookingService, availabilityService };
  }

  return {
    createTenantServices,
    globalServices: { identityService },
  };
}
```

**Update route handlers:**

```typescript
// server/src/routes/packages.routes.ts
export function createPackagesRouter(container: Container) {
  const router = Router();

  router.get('/', async (req, res) => {
    const tenantId = res.locals.tenant.id;
    const { catalogService } = container.createTenantServices(tenantId);

    const packages = await catalogService.getAllPackages();
    res.json(packages);
  });

  // ... other routes

  return router;
}
```

### Week 3: Frontend Basic Theming

#### Task 3.1: Add Tenant Config API Endpoint (Day 11)

**File:** `packages/contracts/src/api.v1.ts`

```typescript
getTenantConfig: {
  method: 'GET',
  path: '/v1/tenant/config',
  responses: {
    200: z.object({
      slug: z.string(),
      name: z.string(),
      logoUrl: z.string().url().optional(),
      primaryColor: z.string(),
      secondaryColor: z.string(),
      accentColor: z.string(),
      contactEmail: z.string().email(),
      contactPhone: z.string().optional(),
    }),
    404: z.object({ error: z.string() }),
  },
},
```

**Backend route:** `server/src/routes/tenant.routes.ts`

```typescript
export function createTenantRouter() {
  const router = Router();

  router.get('/config', (req, res) => {
    const tenant = res.locals.tenant;

    res.json({
      slug: tenant.slug,
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
    });
  });

  return router;
}
```

#### Task 3.2: Frontend Tenant Context (Day 12)

**Create file:** `client/src/contexts/TenantContext.tsx`

```typescript
import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface TenantConfig {
  slug: string;
  name: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  contactEmail: string;
  contactPhone?: string;
}

const TenantContext = createContext<TenantConfig | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['tenant-config'],
    queryFn: async () => {
      const response = await api.getTenantConfig();
      if (response.status === 200) {
        return response.body;
      }
      throw new Error('Failed to load tenant config');
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  // Apply CSS variables when tenant loads
  useEffect(() => {
    if (tenant) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
      document.documentElement.style.setProperty('--color-secondary', tenant.secondaryColor);
      document.documentElement.style.setProperty('--color-accent', tenant.accentColor);

      document.title = `${tenant.name} - Weddings`;
    }
  }, [tenant]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-xl">Loading...</div>
    </div>;
  }

  if (error || !tenant) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-xl text-red-600">
        Tenant not found. Please check your URL.
      </div>
    </div>;
  }

  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}
```

**Update:** `client/src/main.tsx`

```typescript
import { TenantProvider } from './contexts/TenantContext';

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <RouterProvider router={router} />
      </TenantProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
```

#### Task 3.3: Update Tailwind Config (Day 12)

**File:** `client/tailwind.config.js`

Replace hardcoded colors with CSS variables:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary, #8770B7)',
        secondary: 'var(--color-secondary, #3D405B)',
        accent: 'var(--color-accent, #A593C9)',
      },
    },
  },
};
```

#### Task 3.4: Update AppShell (Day 13)

**File:** `client/src/app/AppShell.tsx`

```typescript
import { useTenant } from '../contexts/TenantContext';

export function AppShell() {
  const tenant = useTenant();

  return (
    <div>
      <header className="bg-primary">  {/* Now uses CSS variable */}
        <Link to="/">
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} className="h-10" />
          ) : (
            <span className="text-3xl text-white font-serif">{tenant.name}</span>
          )}
        </Link>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="bg-secondary">  {/* Now uses CSS variable */}
        <p>&copy; {new Date().getFullYear()} {tenant.name}</p>
        <p>{tenant.contactEmail}</p>
      </footer>
    </div>
  );
}
```

#### Task 3.5: Manual Tenant Provisioning Script (Day 14-15)

**Create file:** `server/scripts/provision-tenant.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log('=== Tenant Provisioning Script ===\n');

  const slug = await prompt('Tenant slug (e.g., acme-weddings): ');
  const name = await prompt('Business name: ');
  const contactEmail = await prompt('Contact email: ');
  const contactPhone = await prompt('Contact phone (optional): ');
  const logoUrl = await prompt('Logo URL (optional): ');
  const primaryColor = (await prompt('Primary color (hex, default #8770B7): ')) || '#8770B7';

  console.log('\nCreating tenant...');

  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name,
      contactEmail,
      contactPhone: contactPhone || null,
      logoUrl: logoUrl || null,
      primaryColor,
      secondaryColor: '#3D405B',
      accentColor: '#A593C9',
      active: true,
    },
  });

  console.log(`✅ Tenant created: ${tenant.name} (${tenant.slug})`);
  console.log(`   URL: https://${tenant.slug}.elope.com`);
  console.log(`   ID: ${tenant.id}`);

  rl.close();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Usage:**

```bash
npx tsx server/scripts/provision-tenant.ts
```

### Phase 1 Deliverables

**Database:**

- [x] Tenant table created
- [x] tenantId added to 8 models
- [x] Unique constraints updated to composite keys
- [x] Row-level security enabled
- [x] Default tenant created and data migrated

**Backend:**

- [x] Tenant resolver middleware
- [x] Repository base class with tenant filtering
- [x] All repositories refactored
- [x] DI container refactored to factory pattern
- [x] All routes use tenant context

**Frontend:**

- [x] Tenant context provider
- [x] CSS variables for colors
- [x] AppShell uses dynamic branding
- [x] Tailwind config uses CSS variables

**Provisioning:**

- [x] Manual tenant provisioning script

### Phase 1 Testing

**Test tenant 1:**

```bash
npx tsx server/scripts/provision-tenant.ts
# slug: test-venue-1
# name: Test Venue One
# email: venue1@example.com
```

**Test tenant 2:**

```bash
npx tsx server/scripts/provision-tenant.ts
# slug: test-venue-2
# name: Test Venue Two
# email: venue2@example.com
```

**Manual testing:**

1. Visit `test-venue-1.localhost:5173`
2. Verify logo/branding shows "Test Venue One"
3. Create a booking for 2025-12-01
4. Visit `test-venue-2.localhost:5173`
5. Create a booking for 2025-12-01 (should succeed - different tenant)
6. Visit `test-venue-1.localhost:5173/admin`
7. Verify only sees bookings for Tenant 1

### Phase 1 Success Criteria

✅ Two test tenants created
✅ Each tenant has unique branding (logo + colors)
✅ Bookings are isolated (same date allowed for both tenants)
✅ Admin panel shows only tenant's own data
✅ No cross-tenant data leaks (tested manually)

**REVENUE MILESTONE:** 2 paying tenants can now go live 🎉

---

## PHASE 2: STRIPE CONNECT INTEGRATION

**Duration:** Weeks 4-6 (3 weeks)
**Goal:** Enable commission-based revenue model

### Why Stripe Connect?

**Your requirement:** "Take % of sales through infrastructure"

**Stripe Connect enables:**

- Each tenant gets their own Stripe account
- Revenue goes directly to tenant's bank account
- Platform automatically takes commission
- Platform never touches money directly (compliance benefit)

**Account Type:** Standard Accounts (recommended)

- Tenant creates their own Stripe account
- Platform connects via OAuth
- Tenant sees full dashboard
- Platform takes application fee

### Week 4: Stripe Connect Setup

#### Task 4.1: Register Stripe Connect Platform (Day 16)

1. Go to Stripe Dashboard → Settings → Connect
2. Enable "Standard accounts"
3. Set platform name: "Elope"
4. Set branding (logo, colors)
5. Configure OAuth redirect: `https://api.elope.com/v1/stripe/connect/callback`
6. Get platform client ID

**Save to .env:**

```bash
STRIPE_CONNECT_CLIENT_ID=ca_...
STRIPE_SECRET_KEY=sk_live_...  # Your platform account
```

#### Task 4.2: Add Stripe Account to Tenant Schema (Day 16)

**Update:** `server/prisma/schema.prisma`

```prisma
model Tenant {
  // ... existing fields ...

  // Stripe Connect
  stripeAccountId      String?  @unique
  stripeAccountStatus  String?  // 'pending', 'active', 'disabled'
  stripeOnboardedAt    DateTime?

  // Platform Fee
  platformFeePercent   Decimal  @default(10.0)  // 10% commission

  @@index([stripeAccountId])
}
```

#### Task 4.3: Stripe Connect OAuth Flow (Days 17-18)

**Create file:** `server/src/services/stripe-connect.service.ts`

```typescript
import Stripe from 'stripe';

export class StripeConnectService {
  private stripe: Stripe;

  constructor(private readonly stripeSecretKey: string) {
    this.stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  }

  /**
   * Generate Stripe Connect OAuth URL for tenant
   */
  generateOAuthUrl(tenantId: string, redirectUrl: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
      scope: 'read_write',
      state: tenantId, // Pass tenant ID to track in callback
      redirect_uri: redirectUrl,
    });

    return `https://connect.stripe.com/oauth/authorize?${params}`;
  }

  /**
   * Complete OAuth and save account ID
   */
  async completeOAuth(code: string): Promise<string> {
    const response = await this.stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    return response.stripe_user_id; // Connected account ID
  }

  /**
   * Create checkout session with platform fee
   */
  async createCheckoutSession(params: {
    tenantId: string;
    stripeAccountId: string;
    amountCents: number;
    platformFeePercent: number;
    metadata: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string }> {
    const platformFeeCents = Math.round((params.amountCents * params.platformFeePercent) / 100);

    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Wedding Booking',
              },
              unit_amount: params.amountCents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: platformFeeCents, // Platform commission
        },
        metadata: params.metadata,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
      },
      {
        stripeAccount: params.stripeAccountId, // Charge to tenant's account
      }
    );

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }
}
```

#### Task 4.4: Connect OAuth Routes (Day 18)

**Create file:** `server/src/routes/stripe-connect.routes.ts`

```typescript
export function createStripeConnectRouter(
  stripeService: StripeConnectService,
  prisma: PrismaClient
) {
  const router = Router();

  // Initiate connection
  router.post('/connect/initiate', authMiddleware, async (req, res) => {
    const tenantId = res.locals.tenant.id;
    const adminUserId = res.locals.admin.userId;

    // Generate OAuth URL
    const redirectUrl = `${process.env.API_URL}/v1/stripe/connect/callback`;
    const oauthUrl = stripeService.generateOAuthUrl(tenantId, redirectUrl);

    res.json({ url: oauthUrl });
  });

  // OAuth callback
  router.get('/connect/callback', async (req, res) => {
    const { code, state: tenantId } = req.query;

    try {
      // Complete OAuth
      const stripeAccountId = await stripeService.completeOAuth(code as string);

      // Save to tenant
      await prisma.tenant.update({
        where: { id: tenantId as string },
        data: {
          stripeAccountId,
          stripeAccountStatus: 'active',
          stripeOnboardedAt: new Date(),
        },
      });

      // Redirect to admin dashboard
      res.redirect(`https://${tenantId}.elope.com/admin/settings?stripe=connected`);
    } catch (error) {
      res.redirect(`https://${tenantId}.elope.com/admin/settings?stripe=error`);
    }
  });

  return router;
}
```

### Week 5: Update Booking Flow

#### Task 5.1: Update Checkout Service (Days 19-20)

**File:** `server/src/services/booking.service.ts`

```typescript
async createCheckout(input: CreateCheckoutInput): Promise<{ checkoutUrl: string }> {
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: input.tenantId },
  });

  if (!tenant.stripeAccountId) {
    throw new ValidationError('Tenant has not connected Stripe account');
  }

  // Calculate total
  const pkg = await this.catalogRepo.getPackageBySlug(input.packageId);
  const addOns = await this.getAddOns(input.addOnIds);
  const totalCents = pkg.basePrice + addOns.reduce((sum, a) => sum + a.price, 0);

  // Create checkout with platform fee
  const { url } = await this.stripeService.createCheckoutSession({
    tenantId: tenant.id,
    stripeAccountId: tenant.stripeAccountId,
    amountCents: totalCents,
    platformFeePercent: Number(tenant.platformFeePercent),
    metadata: {
      tenantId: tenant.id,
      packageId: pkg.id,
      eventDate: input.eventDate,
      email: input.email,
      addOnIds: input.addOnIds.join(','),
    },
    successUrl: `https://${tenant.slug}.elope.com/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `https://${tenant.slug}.elope.com/package/${pkg.slug}`,
  });

  return { checkoutUrl: url };
}
```

#### Task 5.2: Update Webhook Routing (Days 21-22)

**Challenge:** Each tenant has their own Stripe account, so webhooks come from different accounts.

**Solution:** Tenant-specific webhook endpoints

**Update:** `server/src/routes/webhooks.routes.ts`

```typescript
export function createWebhooksRouter(container: Container) {
  const router = Router();

  // Webhook endpoint includes tenant ID in path
  router.post('/stripe/:tenantId', express.raw({ type: 'application/json' }), async (req, res) => {
    const { tenantId } = req.params;
    const signature = req.headers['stripe-signature'] as string;

    try {
      // Get tenant's Stripe webhook secret
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeWebhookSecret: true, stripeAccountId: true },
      });

      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Verify webhook signature
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        tenant.stripeWebhookSecret!
      );

      // Process webhook
      const { bookingService } = container.createTenantServices(tenantId);
      await bookingService.onPaymentCompleted({
        eventId: event.id,
        eventType: event.type,
        checkoutSession: event.data.object as Stripe.Checkout.Session,
      });

      res.status(204).send();
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({ error: 'Webhook validation failed' });
    }
  });

  return router;
}
```

**Configure webhooks in Stripe:**
For each connected account, set webhook endpoint:

```
https://api.elope.com/v1/webhooks/stripe/{tenantId}
```

### Week 6: Admin UI for Stripe Connect

#### Task 6.1: Stripe Connect UI Component (Days 23-24)

**Create file:** `client/src/features/admin/StripeConnect.tsx`

```typescript
import { useState } from 'react';
import { api } from '../../lib/api';

export function StripeConnectSettings() {
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      const response = await api.stripeConnectInitiate();
      if (response.status === 200) {
        window.location.href = response.body.url;
      }
    } catch (error) {
      alert('Failed to initiate Stripe connection');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Payment Setup</h2>

      {stripeConnected ? (
        <div className="text-green-600">
          ✅ Stripe account connected
        </div>
      ) : (
        <div>
          <p className="mb-4">
            Connect your Stripe account to start accepting payments.
            The platform will automatically take a 10% commission.
          </p>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700"
          >
            {loading ? 'Connecting...' : 'Connect Stripe'}
          </button>
        </div>
      )}
    </div>
  );
}
```

**Add to admin dashboard:** `client/src/pages/Admin.tsx`

#### Task 6.2: Update Admin Onboarding Flow (Day 25)

**Create tenant onboarding checklist:**

1. ✅ Tenant created (admin provisioning)
2. ⬜ Admin user created and logged in
3. ⬜ Stripe account connected
4. ⬜ First package created
5. ⬜ Branding configured

### Phase 2 Deliverables

- [x] Stripe Connect platform registered
- [x] OAuth flow implemented
- [x] Connected account tracking in database
- [x] Checkout creates platform fee
- [x] Webhooks routed per tenant
- [x] Admin UI for Stripe connection
- [x] Testing with 2 test accounts

### Phase 2 Testing

**Test with Stripe test mode:**

1. Create test tenant
2. Connect test Stripe account
3. Create booking and complete checkout
4. Verify payment goes to tenant's Stripe
5. Verify platform fee deducted (10%)
6. Verify webhook triggers booking creation

### Phase 2 Success Criteria

✅ Tenants can connect Stripe via OAuth
✅ Checkout session charges to tenant's account
✅ Platform fee automatically deducted
✅ Webhooks processed per tenant
✅ No manual payment handling needed

**BUSINESS MILESTONE:** Commission-based revenue model live 💰

---

## PHASE 3: RICH THEMING & CUSTOMIZATION

**Duration:** Weeks 7-10 (4 weeks)
**Goal:** Enable full branding customization per tenant

### Scope Expansion

**Phase 1 had:** Logo + 3 colors
**Phase 3 adds:**

- Custom fonts
- Hero headline/subheadline
- Features section (4 cards)
- Testimonials (3 items)
- Stats section (3 metrics)
- Footer content
- Image uploads

### Week 7: Extended Tenant Schema

#### Task 7.1: Add Content Fields (Day 26)

**Update:** `server/prisma/schema.prisma`

```prisma
model Tenant {
  // ... existing fields ...

  // Typography
  headingFont  String @default("Playfair Display")
  bodyFont     String @default("Inter")

  // Hero Section
  heroHeadline    String @default("Your Perfect Day, Simplified")
  heroSubheadline String @default("Intimate, stress-free weddings designed just for you")
  heroImageUrl    String?

  // Stats Section (JSON)
  stats Json?  // { "couples": "500+", "booking": "24hr", "satisfaction": "100%" }

  // Features Section (JSON array)
  features Json?  // [{ icon, title, description }, ...]

  // Testimonials (JSON array)
  testimonials Json?  // [{ quote, author, package }, ...]

  // Footer
  footerTagline String?
  footerLinks   Json?  // [{ label, url }, ...]
}
```

**Defaults:**

```typescript
// Default stats
{
  "couples": "500+",
  "booking": "24hr",
  "satisfaction": "100%"
}

// Default features
[
  {
    "icon": "sparkles",
    "title": "Curated Experiences",
    "description": "Every detail thoughtfully planned..."
  },
  // ... 3 more
]

// Default testimonials
[
  {
    "quote": "Best decision we ever made...",
    "author": "Sarah & Michael",
    "package": "Garden Romance"
  },
  // ... 2 more
]
```

#### Task 7.2: Image Upload Service (Days 27-28)

**Options:**

1. **AWS S3** (most common)
2. **Cloudflare R2** (S3-compatible, cheaper)
3. **Supabase Storage** (already using Supabase)

**Recommendation:** Supabase Storage (simplest integration)

**Create file:** `server/src/services/image-upload.service.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export class ImageUploadService {
  private supabase;

  constructor() {
    this.supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  }

  async uploadTenantImage(
    tenantId: string,
    file: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    const filePath = `tenants/${tenantId}/${Date.now()}-${fileName}`;

    const { data, error } = await this.supabase.storage
      .from('tenant-assets')
      .upload(filePath, file, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage.from('tenant-assets').getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  async deleteTenantImage(url: string): Promise<void> {
    const filePath = this.extractPathFromUrl(url);
    await this.supabase.storage.from('tenant-assets').remove([filePath]);
  }

  private extractPathFromUrl(url: string): string {
    // Extract path from Supabase URL
    const matches = url.match(/tenant-assets\/(.+)$/);
    return matches ? matches[1] : '';
  }
}
```

### Week 8: Theme Editor API

#### Task 8.1: Theme Update Endpoints (Days 29-30)

**File:** `server/src/routes/admin-theme.routes.ts`

```typescript
export function createAdminThemeRouter(imageService: ImageUploadService) {
  const router = Router();

  // Get current theme
  router.get('/theme', authMiddleware, async (req, res) => {
    const tenant = res.locals.tenant;
    res.json({
      branding: {
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        accentColor: tenant.accentColor,
        headingFont: tenant.headingFont,
        bodyFont: tenant.bodyFont,
      },
      content: {
        hero: {
          headline: tenant.heroHeadline,
          subheadline: tenant.heroSubheadline,
          imageUrl: tenant.heroImageUrl,
        },
        stats: tenant.stats,
        features: tenant.features,
        testimonials: tenant.testimonials,
      },
    });
  });

  // Update branding
  router.patch('/theme/branding', authMiddleware, async (req, res) => {
    const tenantId = res.locals.tenant.id;
    const { primaryColor, secondaryColor, accentColor, headingFont, bodyFont } = req.body;

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        primaryColor,
        secondaryColor,
        accentColor,
        headingFont,
        bodyFont,
      },
    });

    res.json(updated);
  });

  // Upload logo
  router.post('/theme/logo', authMiddleware, upload.single('logo'), async (req, res) => {
    const tenantId = res.locals.tenant.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old logo if exists
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant.logoUrl) {
      await imageService.deleteTenantImage(tenant.logoUrl);
    }

    // Upload new logo
    const logoUrl = await imageService.uploadTenantImage(
      tenantId,
      file.buffer,
      file.originalname,
      file.mimetype
    );

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl },
    });

    res.json({ logoUrl });
  });

  // Update hero content
  router.patch('/theme/hero', authMiddleware, async (req, res) => {
    const tenantId = res.locals.tenant.id;
    const { headline, subheadline } = req.body;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        heroHeadline: headline,
        heroSubheadline: subheadline,
      },
    });

    res.json({ success: true });
  });

  // Update features
  router.patch('/theme/features', authMiddleware, async (req, res) => {
    const tenantId = res.locals.tenant.id;
    const { features } = req.body;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { features },
    });

    res.json({ success: true });
  });

  // Similar endpoints for stats, testimonials, footer

  return router;
}
```

### Week 9: Theme Editor UI

#### Task 9.1: Theme Editor Page (Days 31-34)

**Create file:** `client/src/features/admin/ThemeEditor.tsx`

```typescript
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';

export function ThemeEditor() {
  const { data: theme } = useQuery({
    queryKey: ['admin', 'theme'],
    queryFn: async () => {
      const response = await api.adminGetTheme();
      return response.body;
    },
  });

  const updateBranding = useMutation({
    mutationFn: async (data: BrandingUpdate) => {
      return api.adminUpdateBranding({ body: data });
    },
  });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Theme Editor</h1>

      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="hero">Hero Section</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <BrandingEditor theme={theme} onSave={updateBranding.mutate} />
        </TabsContent>

        <TabsContent value="hero">
          <HeroEditor theme={theme} />
        </TabsContent>

        {/* ... other tabs */}
      </Tabs>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Preview</h2>
        <iframe
          src={`https://${tenant.slug}.elope.com`}
          className="w-full h-96 border rounded"
        />
      </div>
    </div>
  );
}
```

**Components:**

- `BrandingEditor` - Logo upload, color pickers, font selectors
- `HeroEditor` - Text inputs for headline/subheadline, image upload
- `FeaturesEditor` - 4 feature cards (icon, title, description)
- `TestimonialsEditor` - 3 testimonials (quote, author, package)

### Week 10: Frontend Dynamic Content

#### Task 10.1: Update Home Page (Days 35-37)

**File:** `client/src/pages/Home.tsx`

```typescript
import { useTenant } from '../contexts/TenantContext';

export function Home() {
  const tenant = useTenant();
  const stats = tenant.stats as { couples: string; booking: string; satisfaction: string };
  const features = tenant.features as Feature[];
  const testimonials = tenant.testimonials as Testimonial[];

  return (
    <div>
      {/* Hero Section */}
      <section
        className="py-24 bg-primary"
        style={{
          backgroundImage: tenant.heroImageUrl ? `url(${tenant.heroImageUrl})` : undefined,
          backgroundSize: 'cover',
        }}
      >
        <h1 className="text-5xl font-heading">{tenant.heroHeadline}</h1>
        <p className="text-xl">{tenant.heroSubheadline}</p>
      </section>

      {/* Stats Section */}
      <section className="py-16">
        <div className="grid grid-cols-3 gap-8">
          <StatCard label="Happy Couples" value={stats.couples} />
          <StatCard label="Quick Booking" value={stats.booking} />
          <StatCard label="Satisfaction" value={stats.satisfaction} />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="grid grid-cols-2 gap-8">
          {features.map((feature, i) => (
            <FeatureCard key={i} {...feature} />
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-secondary">
        <div className="grid grid-cols-3 gap-8">
          {testimonials.map((testimonial, i) => (
            <TestimonialCard key={i} {...testimonial} />
          ))}
        </div>
      </section>

      {/* Packages Grid (already dynamic) */}
      <CatalogGrid />
    </div>
  );
}
```

### Phase 3 Deliverables

- [x] Extended tenant schema with content fields
- [x] Image upload service (Supabase Storage)
- [x] Theme editor API endpoints
- [x] Theme editor UI (admin panel)
- [x] Dynamic frontend rendering
- [x] Preview mode in editor

### Phase 3 Success Criteria

✅ Tenant can upload logo and change colors
✅ Tenant can customize hero, features, testimonials
✅ Changes reflect immediately on frontend
✅ Images stored securely in Supabase
✅ Preview works in theme editor

---

## PHASE 4: SCALE TO 10 TENANTS

**Duration:** Weeks 11-14 (4 weeks)
**Goal:** Onboard user's 4 businesses + 6 clients

### Week 11: Admin Provisioning UI

#### Task 11.1: Super Admin Role (Days 38-39)

**Update:** `server/prisma/schema.prisma`

```prisma
enum UserRole {
  SUPER_ADMIN    // Platform owner (you)
  TENANT_ADMIN   // Tenant business owner
  TENANT_STAFF   // Tenant employee
}

model User {
  // ... existing fields ...

  // For super admins: null tenantId means platform-wide access
  tenantId String?

  @@unique([email, tenantId])
}
```

**Middleware update:** `server/src/middleware/auth.ts`

```typescript
// Super admin can access any tenant
if (admin.role === 'SUPER_ADMIN') {
  return next();
}

// Tenant admin must match tenant context
if (admin.tenantId !== res.locals.tenant.id) {
  throw new ForbiddenError('Access denied');
}
```

#### Task 11.2: Tenant Management UI (Days 40-42)

**Create file:** `client/src/pages/SuperAdmin.tsx`

```typescript
export function SuperAdminDashboard() {
  const { data: tenants } = useQuery({
    queryKey: ['super-admin', 'tenants'],
    queryFn: async () => {
      const response = await api.superAdminListTenants();
      return response.body;
    },
  });

  return (
    <div className="p-6">
      <h1>Tenant Management</h1>

      <button onClick={openCreateTenantModal}>
        + Create Tenant
      </button>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Stripe</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tenants?.map(tenant => (
            <tr key={tenant.id}>
              <td>{tenant.name}</td>
              <td>{tenant.slug}.elope.com</td>
              <td>{tenant.active ? '✅ Active' : '❌ Inactive'}</td>
              <td>{tenant.stripeAccountId ? '💳 Connected' : '⚠️ Not connected'}</td>
              <td>{formatDate(tenant.createdAt)}</td>
              <td>
                <button onClick={() => impersonate(tenant)}>Login as Admin</button>
                <button onClick={() => toggleActive(tenant)}>
                  {tenant.active ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Week 12-13: Onboarding Your 4 Businesses

#### Task 12.1: Onboarding Checklist

For each of your 4 businesses:

**Day 1: Provision Tenant**

1. Create tenant via super admin UI
2. Generate admin login credentials
3. Send onboarding email with:
   - Admin login URL
   - Initial password (force change on first login)
   - Setup checklist

**Day 2: Stripe Setup**

1. Guide through Stripe Connect OAuth
2. Verify test payment works
3. Set platform fee percentage (10% default)

**Day 3: Branding**

1. Upload logo
2. Set brand colors
3. Customize hero headline
4. Add 2-3 testimonials

**Day 4: Packages**

1. Create 3 wedding packages
2. Add 3-5 add-ons
3. Set pricing

**Day 5: Testing**

1. Complete test booking end-to-end
2. Verify email notifications
3. Verify admin can see booking
4. Go live!

#### Task 12.2: Onboarding Template

**Create file:** `docs/TENANT_ONBOARDING.md`

```markdown
# Tenant Onboarding Guide

## Pre-Requisites

- [ ] Business name
- [ ] Logo (PNG, 500x500px recommended)
- [ ] Brand colors (primary, secondary, accent)
- [ ] Contact email & phone
- [ ] Stripe account (or willing to create one)

## Week 1: Setup

### Day 1: Access

1. Receive welcome email from platform
2. Click login link: https://{your-slug}.elope.com/admin/login
3. Login with temporary password
4. Change password to secure one

### Day 2: Payment Setup

1. Go to Settings → Payments
2. Click "Connect Stripe"
3. Complete Stripe onboarding
4. Verify connection successful

### Day 3: Branding

1. Go to Settings → Theme Editor
2. Upload logo
3. Select brand colors using color picker
4. Customize hero headline (what makes your venue special?)
5. Preview changes

### Day 4: Packages

1. Go to Packages
2. Create first package:
   - Name: e.g., "Intimate Garden Ceremony"
   - Description: What's included?
   - Price: Base price in dollars
   - Photo: Upload hero image
3. Create 2-3 more packages
4. Add add-ons (photography, flowers, etc.)

### Day 5: Test Booking

1. Visit your storefront: https://{your-slug}.elope.com
2. Select a package
3. Pick a date
4. Add add-ons
5. Complete test checkout (use Stripe test card: 4242 4242 4242 4242)
6. Verify booking appears in admin

## Week 2: Launch

- [ ] Remove test bookings
- [ ] Share URL with potential customers
- [ ] Monitor first real bookings
- [ ] Adjust pricing/packages as needed

## Support

Email: support@elope.com
```

### Week 14: Client Onboarding (6 tenants)

**Target clients:**

1. Wedding photographers (3 tenants)
2. Micro wedding venues (2 tenants)
3. Elopement planners (1 tenant)

**Acquisition strategy:**

- Reach out to network
- Offer first month free
- Provide white-glove onboarding
- Gather feedback for improvements

### Phase 4 Deliverables

- [x] Super admin role implemented
- [x] Tenant management UI
- [x] User's 4 businesses onboarded
- [x] 6 client tenants onboarded
- [x] Onboarding documentation
- [x] Total: 10 tenants live

### Phase 4 Success Criteria

✅ 10 tenants live and processing bookings
✅ Each tenant has customized branding
✅ Each tenant connected to Stripe
✅ Platform commission being collected
✅ No tenant isolation bugs reported

**BUSINESS MILESTONE:** 10 paying tenants generating commission revenue 🚀

---

## PHASE 5: PRODUCTION HARDENING

**Duration:** Weeks 15-18 (4 weeks)
**Goal:** Ensure rock-solid security and reliability

### Week 15: Security Audit

#### Task 15.1: Penetration Testing (Days 43-45)

**Test scenarios:**

1. **Cross-Tenant Data Leak**
   - Login to Tenant A
   - Attempt to access Tenant B's booking via direct ID manipulation
   - Expected: 403 Forbidden

2. **Subdomain Spoofing**
   - Register tenant "acme"
   - Attempt to create tenant "ACME" or "acme-"
   - Expected: Validation error

3. **SQL Injection via Tenant Context**
   - Create tenant with malicious slug: `' OR '1'='1`
   - Expected: Validation rejects special characters

4. **Session Fixation**
   - Login to Tenant A
   - Change subdomain to Tenant B
   - Expected: Session rejected

5. **Rate Limit Bypass**
   - Attempt 1000 login attempts
   - Expected: Rate limit blocks after 5 attempts

#### Task 15.2: Automated Security Tests (Days 46-47)

**Create file:** `server/test/security/tenant-isolation.spec.ts`

```typescript
describe('Tenant Isolation Security', () => {
  it('prevents cross-tenant booking access', async () => {
    const tenantA = await createTestTenant({ slug: 'tenant-a' });
    const tenantB = await createTestTenant({ slug: 'tenant-b' });

    const bookingB = await createBooking({
      tenantId: tenantB.id,
      date: '2025-12-01',
    });

    const adminA = await loginAsAdmin(tenantA.id);

    const response = await request(app)
      .get(`/v1/admin/bookings/${bookingB.id}`)
      .set('Authorization', `Bearer ${adminA.token}`)
      .set('Host', `tenant-a.elope.com`);

    expect(response.status).toBe(403);
  });

  it('prevents tenant ID manipulation in query', async () => {
    const tenantA = await createTestTenant({ slug: 'tenant-a' });
    const tenantB = await createTestTenant({ slug: 'tenant-b' });

    const adminA = await loginAsAdmin(tenantA.id);

    // Attacker tries to override tenant via query param
    const response = await request(app)
      .get(`/v1/admin/bookings?tenantId=${tenantB.id}`)
      .set('Authorization', `Bearer ${adminA.token}`)
      .set('Host', `tenant-a.elope.com`);

    // Should still only return Tenant A's bookings
    expect(response.body.every((b) => b.tenantId === tenantA.id)).toBe(true);
  });

  it('validates tenant slug format', async () => {
    const maliciousSlugs = [
      "'; DROP TABLE Booking; --",
      "<script>alert('xss')</script>",
      '../../etc/passwd',
      'acme..weddings',
      'ACME', // uppercase
    ];

    for (const slug of maliciousSlugs) {
      await expect(createTestTenant({ slug })).rejects.toThrow('Invalid slug format');
    }
  });
});
```

### Week 16: Performance Optimization

#### Task 16.1: Database Indexes Audit (Days 48-49)

**Run query analysis:**

```sql
-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%Booking%' OR query LIKE '%Package%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```

**Add missing indexes:**

```sql
-- If any queries are slow, add indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Booking_tenantId_customerId_idx"
  ON "Booking"("tenantId", "customerId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Package_tenantId_active_idx"
  ON "Package"("tenantId", "active");
```

#### Task 16.2: Caching Strategy (Day 50)

**Add Redis caching:**

```typescript
// Cache tenant configs (rarely change)
const tenantConfig = await redis.get(`tenant:${slug}:config`);
if (!tenantConfig) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  await redis.set(`tenant:${slug}:config`, JSON.stringify(tenant), 'EX', 3600);
}

// Cache package catalog (changes infrequently)
const cacheKey = `tenant:${tenantId}:packages`;
const cached = await redis.get(cacheKey);
if (!cached) {
  const packages = await catalogService.getAllPackages();
  await redis.set(cacheKey, JSON.stringify(packages), 'EX', 900); // 15 min
}
```

**Cache invalidation:**

```typescript
// When package is updated, invalidate cache
async function updatePackage(packageId: string, data: UpdatePackageInput) {
  const updated = await prisma.package.update({ where: { id: packageId }, data });

  // Invalidate cache
  await redis.del(`tenant:${updated.tenantId}:packages`);

  return updated;
}
```

### Week 17: Monitoring & Alerting

#### Task 17.1: Application Monitoring (Days 51-52)

**Setup Sentry (error tracking):**

```bash
npm install @sentry/node @sentry/react
```

**Backend:** `server/src/app.ts`

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Scrub sensitive data
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
    }
    return event;
  },
});

// Error handler
app.use(Sentry.Handlers.errorHandler());
```

**Frontend:** `client/src/main.tsx`

```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 0.1,
});
```

#### Task 17.2: Business Metrics Dashboard (Days 53-54)

**Create monitoring dashboard:**

```typescript
// server/src/routes/metrics.routes.ts
export function createMetricsRouter() {
  const router = Router();

  // Platform metrics (super admin only)
  router.get('/platform', superAdminAuth, async (req, res) => {
    const metrics = {
      totalTenants: await prisma.tenant.count(),
      activeTenants: await prisma.tenant.count({ where: { active: true } }),
      totalBookings: await prisma.booking.count(),
      totalRevenue: await prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'CAPTURED' },
      }),
      platformFees: await calculatePlatformFees(),
    };

    res.json(metrics);
  });

  // Per-tenant metrics
  router.get('/tenant', authMiddleware, async (req, res) => {
    const tenantId = res.locals.tenant.id;

    const metrics = {
      bookingsThisMonth: await prisma.booking.count({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth(new Date()) },
        },
      }),
      revenueThisMonth: await prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          booking: { tenantId },
          createdAt: { gte: startOfMonth(new Date()) },
          status: 'CAPTURED',
        },
      }),
      upcomingBookings: await prisma.booking.count({
        where: {
          tenantId,
          date: { gte: new Date() },
          status: 'CONFIRMED',
        },
      }),
    };

    res.json(metrics);
  });

  return router;
}
```

### Week 18: Documentation & Runbooks

#### Task 18.1: Production Runbook (Days 55-56)

**Create file:** `docs/PRODUCTION_RUNBOOK.md`

````markdown
# Production Operations Runbook

## Deployment

### Standard Deployment

```bash
# 1. Run tests
npm run test

# 2. Build
npm run build

# 3. Database migration
npx prisma migrate deploy

# 4. Deploy to production (e.g., Railway, Render, Fly.io)
git push production main
```
````

### Rollback Procedure

```bash
# 1. Revert to previous commit
git revert HEAD

# 2. Deploy
git push production main

# 3. Rollback database migration (if needed)
npx prisma migrate resolve --rolled-back [migration-name]
```

## Common Operations

### Provision New Tenant

```bash
# Via super admin UI (recommended)
Visit: https://admin.elope.com/tenants/new

# Via script (fallback)
npx tsx server/scripts/provision-tenant.ts
```

### Deactivate Tenant

```sql
UPDATE "Tenant" SET "active" = false WHERE "id" = '{tenant-id}';
```

### Backup Database

```bash
# Automated: Daily backups via Supabase
# Manual backup:
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

## Troubleshooting

### "Tenant Not Found" Error

1. Check DNS resolution: `nslookup {tenant}.elope.com`
2. Verify tenant exists: `SELECT * FROM "Tenant" WHERE slug = '{tenant}'`
3. Check tenant is active: `active = true`

### Stripe Webhook Failures

1. Check webhook secret is correct for tenant
2. Verify endpoint URL: `https://api.elope.com/v1/webhooks/stripe/{tenantId}`
3. Check webhook logs in Stripe dashboard
4. Replay failed webhooks if needed

### Performance Issues

1. Check slow queries: See Week 16 Task 16.1
2. Check Redis cache hit rate
3. Check database connection pool
4. Scale up if CPU/memory high

## Monitoring

### Key Metrics

- **Uptime:** https://status.elope.com
- **Error rate:** Sentry dashboard
- **Response time:** APM (e.g., New Relic, Datadog)
- **Database:** Supabase dashboard

### Alerts

- Error rate > 1%: Page on-call
- Response time > 2s: Investigate
- Database CPU > 80%: Scale up
- Tenant webhook failures: Email tenant admin

````

#### Task 18.2: API Documentation (Day 57)

**Update OpenAPI spec:**

```typescript
// server/src/api-docs.ts
import { generateOpenApi } from '@ts-rest/open-api';
import { Contracts } from '@elope/contracts';

const openApiDocument = generateOpenApi(
  Contracts,
  {
    info: {
      title: 'Elope Multi-Tenant API',
      version: '2.0.0',
      description: 'API for multi-tenant wedding booking platform',
    },
    servers: [
      { url: 'https://api.elope.com', description: 'Production' },
      { url: 'http://localhost:3001', description: 'Local Development' },
    ],
  },
  {
    setOperationId: true,
  }
);

// Serve at /api/docs
app.get('/api/docs/openapi.json', (req, res) => {
  res.json(openApiDocument);
});
````

### Phase 5 Deliverables

- [x] Security penetration testing completed
- [x] Automated security test suite
- [x] Performance optimization (indexes, caching)
- [x] Monitoring and alerting (Sentry)
- [x] Business metrics dashboard
- [x] Production runbook
- [x] API documentation

### Phase 5 Success Criteria

✅ Zero critical security vulnerabilities
✅ P95 response time < 200ms
✅ Error rate < 0.1%
✅ All operations documented
✅ Monitoring and alerts active

---

## PHASE 6: POLISH & SCALE TO 50

**Duration:** Weeks 19-24 (6 weeks)
**Goal:** Prepare for growth to 50 tenants

### Week 19-20: Custom Domain Support

#### Task 19.1: Domain Verification (Days 58-60)

**Add domain verification table:**

```prisma
model CustomDomain {
  id           String @id @default(cuid())
  tenantId     String
  domain       String @unique
  verificationToken String
  verified     Boolean @default(false)
  verifiedAt   DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([domain])
  @@index([tenantId])
}
```

**Verification flow:**

1. Tenant enters custom domain: `weddings.acme.com`
2. System generates verification token
3. Tenant adds TXT record: `_elope-verify=token123`
4. System verifies DNS record
5. System activates custom domain

**Implementation:**

```typescript
// server/src/services/domain-verification.service.ts
import { Resolver } from 'dns/promises';

export class DomainVerificationService {
  async requestVerification(tenantId: string, domain: string): Promise<string> {
    const token = generateSecureToken();

    await prisma.customDomain.create({
      data: {
        tenantId,
        domain,
        verificationToken: token,
        verified: false,
      },
    });

    return token;
  }

  async verifyDomain(domain: string): Promise<boolean> {
    const record = await prisma.customDomain.findUnique({ where: { domain } });
    if (!record) {
      throw new NotFoundError('Domain', domain);
    }

    // Check DNS TXT record
    const resolver = new Resolver();
    const txtRecords = await resolver.resolveTxt(domain);

    const verified = txtRecords.some((record) =>
      record.join('').includes(`_elope-verify=${record.verificationToken}`)
    );

    if (verified) {
      await prisma.customDomain.update({
        where: { domain },
        data: { verified: true, verifiedAt: new Date() },
      });
    }

    return verified;
  }
}
```

### Week 21: Advanced Theme Editor

#### Task 21.1: Visual Theme Builder (Days 61-65)

**Features:**

- Drag-and-drop section reordering
- Live preview (iframe)
- Pre-made theme templates
- Export/import theme JSON

**Create file:** `client/src/features/admin/VisualThemeBuilder.tsx`

```typescript
export function VisualThemeBuilder() {
  const [sections, setSections] = useState([
    { id: 'hero', type: 'hero', props: { ... } },
    { id: 'stats', type: 'stats', props: { ... } },
    { id: 'features', type: 'features', props: { ... } },
    { id: 'packages', type: 'packages', props: { ... } },
    { id: 'testimonials', type: 'testimonials', props: { ... } },
  ]);

  return (
    <div className="flex gap-4">
      <div className="w-1/3">
        <h2>Sections</h2>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="sections">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {sections.map((section, index) => (
                  <Draggable key={section.id} draggableId={section.id} index={index}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                        <SectionEditor section={section} onChange={updateSection} />
                      </div>
                    )}
                  </Draggable>
                ))}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <div className="w-2/3">
        <h2>Preview</h2>
        <iframe
          src={`/preview?theme=${encodeURIComponent(JSON.stringify(sections))}`}
          className="w-full h-screen border"
        />
      </div>
    </div>
  );
}
```

### Week 22: Analytics Dashboard

#### Task 22.1: Tenant Analytics (Days 66-68)

**Features:**

- Booking trends (daily, weekly, monthly)
- Revenue chart
- Package popularity
- Customer demographics
- Conversion funnel

**Create file:** `client/src/features/admin/Analytics.tsx`

```typescript
export function TenantAnalytics() {
  const { data: analytics } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: async () => {
      const response = await api.adminGetAnalytics();
      return response.body;
    },
  });

  return (
    <div className="p-6">
      <h1>Analytics</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard label="Bookings This Month" value={analytics.bookingsThisMonth} />
        <MetricCard label="Revenue This Month" value={formatCurrency(analytics.revenueThisMonth)} />
        <MetricCard label="Avg Booking Value" value={formatCurrency(analytics.avgBookingValue)} />
        <MetricCard label="Conversion Rate" value={`${analytics.conversionRate}%`} />
      </div>

      <div className="mb-8">
        <h2>Bookings Over Time</h2>
        <LineChart data={analytics.bookingsTrend} />
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2>Popular Packages</h2>
          <BarChart data={analytics.packagePopularity} />
        </div>

        <div>
          <h2>Revenue by Package</h2>
          <PieChart data={analytics.revenueByPackage} />
        </div>
      </div>
    </div>
  );
}
```

### Week 23: Customer Success Tools

#### Task 23.1: Tenant Health Monitoring (Days 69-71)

**Create dashboard for monitoring tenant health:**

```typescript
// server/src/services/tenant-health.service.ts
export class TenantHealthService {
  async calculateHealthScore(tenantId: string): Promise<number> {
    const checks = {
      stripeConnected: await this.isStripeConnected(tenantId),
      hasPackages: await this.hasAtLeastOnePackage(tenantId),
      hasBranding: await this.hasCustomBranding(tenantId),
      hasBookings: await this.hasRecentBookings(tenantId, 30), // 30 days
      activeAdmin: await this.hasActiveAdmin(tenantId, 7), // 7 days
    };

    const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
    return Math.round(score * 100);
  }

  async getAtRiskTenants(): Promise<Tenant[]> {
    // Tenants with health score < 60% or no bookings in 30 days
    const allTenants = await prisma.tenant.findMany({ where: { active: true } });

    const atRisk = [];
    for (const tenant of allTenants) {
      const health = await this.calculateHealthScore(tenant.id);
      if (health < 60) {
        atRisk.push({ ...tenant, healthScore: health });
      }
    }

    return atRisk;
  }
}
```

**Create super admin view:**

```typescript
// client/src/features/super-admin/TenantHealth.tsx
export function TenantHealthDashboard() {
  const { data: atRiskTenants } = useQuery({
    queryKey: ['super-admin', 'at-risk-tenants'],
    queryFn: async () => {
      const response = await api.superAdminGetAtRiskTenants();
      return response.body;
    },
  });

  return (
    <div>
      <h1>Tenant Health Monitoring</h1>

      {atRiskTenants?.map(tenant => (
        <div key={tenant.id} className="border p-4 mb-4">
          <h3>{tenant.name}</h3>
          <div className="flex items-center gap-2">
            <HealthScoreBadge score={tenant.healthScore} />
            <span>{tenant.healthScore}% health score</span>
          </div>
          <p className="text-sm text-gray-600">{tenant.issues.join(', ')}</p>
          <button onClick={() => emailTenant(tenant)}>Send Check-In Email</button>
        </div>
      ))}
    </div>
  );
}
```

### Week 24: Final Polish

#### Task 24.1: Accessibility Audit (Days 72-73)

**Run automated audit:**

```bash
npm install -D @axe-core/react
```

**Fix common issues:**

- [ ] All images have alt text
- [ ] Forms have labels
- [ ] Focus states visible
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Keyboard navigation works
- [ ] Screen reader tested

#### Task 24.2: Performance Budget (Day 74)

**Set targets:**

- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3.5s
- Cumulative Layout Shift: < 0.1

**Implement monitoring:**

```typescript
// client/src/lib/performance.ts
import { onCLS, onFCP, onLCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify(metric);
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', body);
  }
}

onCLS(sendToAnalytics);
onFCP(sendToAnalytics);
onLCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

#### Task 24.3: Launch Checklist (Day 75)

**Final pre-launch checklist:**

- [ ] All 10 Phase 4 tenants live and happy
- [ ] Zero P0/P1 bugs in backlog
- [ ] Monitoring and alerts configured
- [ ] Backup/restore procedures tested
- [ ] Documentation complete
- [ ] Support email configured
- [ ] Terms of Service & Privacy Policy published
- [ ] Pricing page live
- [ ] Marketing site ready
- [ ] Ready to onboard Tenant #11

### Phase 6 Deliverables

- [x] Custom domain support
- [x] Visual theme builder
- [x] Analytics dashboard
- [x] Tenant health monitoring
- [x] Accessibility audit
- [x] Performance optimization
- [x] Launch checklist complete

### Phase 6 Success Criteria

✅ Platform ready for 50 tenants
✅ All features polished and tested
✅ Monitoring and support systems in place
✅ Documentation complete
✅ Team confident in stability

---

## TIMELINE SUMMARY

| Phase             | Weeks       | Key Milestone                 |
| ----------------- | ----------- | ----------------------------- |
| 0. Planning       | Week 0      | Technical decisions finalized |
| 1. MVP            | Weeks 1-3   | **2 tenants live**            |
| 2. Stripe Connect | Weeks 4-6   | **Commission model live**     |
| 3. Rich Theming   | Weeks 7-10  | Full customization enabled    |
| 4. Scale to 10    | Weeks 11-14 | **10 tenants live**           |
| 5. Hardening      | Weeks 15-18 | Production-ready              |
| 6. Polish         | Weeks 19-24 | Ready for 50 tenants          |

**Total: 24 weeks (6 months)**

---

## SUCCESS METRICS

### Business Metrics

**Month 1 (Week 4):**

- ✅ 2 paying tenants
- ✅ $X in bookings processed

**Month 2 (Week 8):**

- ✅ Commission-based revenue model live
- ✅ $X in platform fees collected

**Month 3 (Week 12):**

- ✅ 10 tenants onboarded
- ✅ User's 4 businesses live

**Month 6 (Week 24):**

- ✅ Platform stable and scalable
- ✅ Ready for 50 tenants
- ✅ Profitable (revenue > costs)

### Technical Metrics

- ✅ 99.9% uptime
- ✅ < 200ms P95 response time
- ✅ < 0.1% error rate
- ✅ Zero data breach incidents
- ✅ 85%+ test coverage maintained

### Customer Success Metrics

- ✅ < 5% tenant churn
- ✅ > 90% tenant satisfaction (NPS)
- ✅ < 24hr support response time
- ✅ > 80% tenant health score average

---

## RISK MITIGATION

### Top 5 Risks

**1. Stripe Connect Integration Complexity**

- **Risk:** Webhooks, OAuth, platform fees tricky to get right
- **Mitigation:** Extensive testing in Stripe test mode, phased rollout
- **Contingency:** Start with single Stripe account, add Connect later

**2. Data Isolation Bugs**

- **Risk:** Cross-tenant data leak would be catastrophic
- **Mitigation:** 4-layer defense (RLS + middleware + service + repo)
- **Contingency:** Comprehensive security testing before Phase 4

**3. Performance Degradation**

- **Risk:** 50 tenants may strain single database
- **Mitigation:** Proper indexing, caching, monitoring
- **Contingency:** Scale up database, add read replicas

**4. Tenant Onboarding Friction**

- **Risk:** Complex setup deters new tenants
- **Mitigation:** White-glove onboarding, clear documentation
- **Contingency:** Offer setup service ($500 one-time fee)

**5. Timeline Slippage**

- **Risk:** 6 months is aggressive for this scope
- **Mitigation:** Phased approach allows flexibility
- **Contingency:** Can pause after Phase 4 (10 tenants) if needed

---

## BUDGET ESTIMATE

### Development Costs

**If hiring 2 developers:**

- 2 developers × 6 months × $12,500/month = **$150,000**

**If you're doing it yourself:**

- Opportunity cost: 6 months full-time
- Value: ~$75,000 (if consultant rate $125/hr × 600 hours)

### Infrastructure Costs (6 months)

| Service               | Monthly       | 6 Months |
| --------------------- | ------------- | -------- |
| Supabase (Pro)        | $25           | $150     |
| Domain + SSL          | $20           | $120     |
| Sentry (monitoring)   | $26           | $156     |
| Cloudflare (optional) | $20           | $120     |
| **Total**             | **$91/month** | **$546** |

### Recurring Costs (after launch)

| Service             | Cost per Month             |
| ------------------- | -------------------------- |
| Infrastructure      | $91/month                  |
| Stripe fees         | 2.9% + 30¢ per transaction |
| Platform commission | 10% of booking value       |
| Support/maintenance | ~10 hours/month            |

**Break-Even Analysis:**

Assumptions:

- Average booking value: $2,500
- Platform commission: 10% = $250
- Stripe fees: ~$75
- Net platform revenue per booking: $175

**Break-even:** $91/month ÷ $175/booking = **0.5 bookings/month across all tenants**

With 10 tenants averaging 2 bookings/month each:

- 20 bookings × $175 = **$3,500/month revenue**
- Minus infrastructure: $91/month
- **Net profit: $3,409/month** ($40,908/year)

**ROI:** If self-developed ($75K opportunity cost):

- Break-even: 22 months
- With 20 tenants: 11 months

---

## NEXT STEPS (Week 0)

### Immediate Actions (This Week)

**Day 1 (Monday):**

1. Review this plan and approve/adjust
2. Finalize technical decisions (subdomain pattern, Stripe Connect type)
3. Register domain (if not done)
4. Set up Stripe Connect platform account

**Day 2 (Tuesday):**

1. Configure wildcard DNS (`*.elope.com`)
2. Set up wildcard SSL certificate
3. Create staging environment
4. Set up local development (hosts file)

**Day 3 (Wednesday):**

1. Create git branch: `multi-tenancy/phase-1`
2. Set up project management (e.g., Linear, GitHub Projects)
3. Break down Phase 1 into tickets
4. Schedule daily standup (15 min)

**Day 4 (Thursday):**

1. Create database backup
2. Write Phase 1 database migration (no apply yet)
3. Review migration with fresh eyes
4. Plan rollback procedure

**Day 5 (Friday):**

1. Begin Phase 1 Week 1 implementation
2. Create `Tenant` model migration
3. Apply migration to local dev database
4. Test basic tenant creation

### Questions to Answer Before Starting

1. **Domain:** What domain will you use? (e.g., `elope.com`)
2. **Stripe:** Test mode or prod mode for Phase 1-2?
3. **Platform Fee:** Confirm 10% commission or different %?
4. **Team:** Will you code alone or with others?
5. **Hosting:** Where will you deploy? (Railway, Render, Fly.io, Vercel?)
6. **Budget:** Approved for infrastructure costs ($91/month)?

---

## APPENDICES

### Appendix A: Tenant Provisioning Checklist

**Super Admin Actions:**

1. [ ] Create tenant via admin UI or script
2. [ ] Generate admin credentials
3. [ ] Send onboarding email
4. [ ] Schedule onboarding call (30 min)

**Tenant Actions:**

1. [ ] Login and change password
2. [ ] Connect Stripe account
3. [ ] Upload logo
4. [ ] Set brand colors
5. [ ] Customize hero section
6. [ ] Create 3 packages
7. [ ] Add 5 add-ons
8. [ ] Complete test booking
9. [ ] Go live!

### Appendix B: Testing Strategy

**Unit Tests:**

- Repository layer (tenant filtering)
- Service layer (business logic)
- Middleware (tenant resolution)

**Integration Tests:**

- API endpoints (tenant-scoped)
- Stripe Connect flow
- Webhook processing

**E2E Tests:**

- Full booking flow per tenant
- Admin CRUD operations
- Theme editor

**Security Tests:**

- Cross-tenant access attempts
- SQL injection attempts
- Session fixation attempts

### Appendix C: Deployment Checklist

**Pre-Deploy:**

- [ ] All tests passing
- [ ] Database migration dry-run successful
- [ ] Rollback procedure documented
- [ ] Monitoring alerts configured
- [ ] Backup created

**Deploy:**

- [ ] Run database migration
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Smoke tests pass
- [ ] Verify no errors in Sentry

**Post-Deploy:**

- [ ] Monitor error rates (30 min)
- [ ] Verify tenant logins work
- [ ] Verify bookings process
- [ ] Alert team: "Deploy successful"

---

## CONCLUSION

This 6-month plan will transform Elope from a single-tenant application into a robust multi-tenant platform supporting up to 50 wedding businesses.

**Key Success Factors:**

1. **Phased Approach** - Get to revenue fast (2 tenants in 3 weeks), then iterate
2. **Security First** - 4-layer tenant isolation prevents catastrophic leaks
3. **Stripe Connect** - Commission-based model aligns incentives
4. **Your Dogfooding** - Using it in 4 businesses validates every feature
5. **Realistic Scope** - 50 tenants max keeps architecture simple

**The Path Forward:**

- **Month 1:** MVP live with 2 paying tenants
- **Month 2:** Commission revenue model active
- **Month 3:** 10 tenants onboarded (including your 4)
- **Month 6:** Production-ready platform for 50 tenants

You're not building for 10,000 tenants - you're building for 10-50 businesses you'll personally onboard and support. This allows for simplicity over premature optimization.

**Ready to start Week 0?** Let's finalize those technical decisions and begin Phase 1!

---

**Document Version:** 1.0
**Last Updated:** November 6, 2025
**Author:** Architecture Team + Business Context
**Status:** READY FOR EXECUTION
