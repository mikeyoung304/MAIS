# MAIS Codebase - Comprehensive Architecture Exploration

## Executive Summary

MAIS is a sophisticated **multi-tenant wedding/elopement booking platform** built as a modular monolith using modern web technologies. The system enables independent wedding service providers (venues, photographers, planners) to offer customizable booking experiences through embeddable widgets, admin dashboards, and Stripe Connect payment processing.

**Stack Overview:**

- **Backend:** Node.js/Express with TypeScript, Prisma ORM, PostgreSQL
- **Frontend:** React 18 with TypeScript, Vite, React Router, TanStack Query
- **Architecture Pattern:** Modular monolith with clear service layer separation
- **Multi-Tenancy:** Database-level tenant isolation with API key-based tenant resolution
- **API Pattern:** ts-rest for end-to-end type safety between client and server
- **Payment:** Stripe and Stripe Connect for platform + tenant payment split
- **Communications:** Postmark for email, Google Calendar for availability

---

## 1. OVERALL ARCHITECTURE & STRUCTURE

### Workspace Structure (Monorepo)

```
MAIS/
├── server/                 # Express API application
│   ├── src/
│   │   ├── app.ts         # Express setup & middleware
│   │   ├── index.ts       # Server entry point
│   │   ├── di.ts          # Dependency injection container
│   │   ├── services/      # Domain services
│   │   ├── routes/        # API endpoint handlers
│   │   ├── adapters/      # External service integrations
│   │   ├── middleware/    # Express middleware
│   │   ├── lib/           # Shared libraries & utilities
│   │   └── validation/    # Input validation schemas
│   └── prisma/            # Database schema & migrations
├── client/                # React web application
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable UI components
│   │   ├── contexts/     # React context providers
│   │   ├── lib/          # API client & utilities
│   │   ├── widget/       # Embeddable booking widget
│   │   ├── hooks/        # Custom React hooks
│   │   └── types/        # TypeScript type definitions
├── packages/
│   ├── contracts/        # ts-rest API contracts (shared)
│   └── shared/           # Shared utilities & types
└── docs/                 # Comprehensive documentation
```

### Key Technologies

**Backend Dependencies:**

- express@4.21 - HTTP server framework
- @prisma/client@6.17 - Database ORM
- @ts-rest/express@3.52 - Type-safe API framework
- stripe@19 - Payment processing
- jsonwebtoken@9 - JWT authentication
- bcryptjs@3 - Password hashing
- express-rate-limit@8 - Rate limiting
- multer@2 - File uploads
- pino@10 - Structured logging

**Frontend Dependencies:**

- react@18.3 - UI framework
- vite@6 - Build tool
- react-router-dom@7 - Client-side routing
- @tanstack/react-query@5 - Server state management
- @radix-ui/\* - Accessible component primitives
- lucide-react - Icon library
- tailwindcss@3 - Utility CSS framework

### Architecture Pattern: Modular Monolith

The system follows a **modular monolith** architecture:

- Single Node.js process containing all business logic
- Clear separation of concerns via service/repository layers
- Domain-driven design with explicit service boundaries
- Dependency injection for loose coupling and testing
- Adapters for external integrations (Stripe, Google Calendar, Postmark)

---

## 2. FEATURE SERVICES

### 2.1 Catalog Service (`CatalogService`)

**Location:** `/server/src/services/catalog.service.ts`

**Responsibilities:**

- Manage wedding packages (CRUD operations)
- Manage add-ons (optional extras like photography, flowers)
- Retrieve packages with nested add-ons
- Package caching for performance

**Key Methods:**

```typescript
// Public methods (tenant-isolated)
getAllPackages(tenantId: string): Promise<PackageWithAddOns[]>
getPackageBySlug(tenantId: string, slug: string): Promise<PackageWithAddOns>
getPackageById(tenantId: string, id: string): Promise<Package | null>

// Admin operations
createPackage(tenantId: string, input: CreatePackageInput): Promise<Package>
updatePackage(tenantId: string, id: string, input: UpdatePackageInput): Promise<Package>
deletePackage(tenantId: string, id: string): Promise<void>
createAddOn(tenantId: string, input: CreateAddOnInput): Promise<AddOn>
updateAddOn(tenantId: string, id: string, input: UpdateAddOnInput): Promise<AddOn>
deleteAddOn(tenantId: string, id: string): Promise<void>
```

**Architecture Patterns:**

- **Multi-tenant isolation:** All queries filtered by `tenantId`
- **N+1 query optimization:** Uses `getAllPackagesWithAddOns()` to fetch packages + add-ons in single query
- **Application-level caching:** 15-minute TTL with tenant-scoped cache keys (`catalog:${tenantId}:*`)
- **Audit logging:** Tracks all changes via `AuditService`

### 2.2 Booking Service (`BookingService`)

**Location:** `/server/src/services/booking.service.ts`

**Responsibilities:**

- Create Stripe checkout sessions for package bookings
- Calculate total cost (package + add-ons + commission)
- Handle both standard and Stripe Connect checkouts
- Emit booking-related events

**Key Methods:**

```typescript
createCheckout(tenantId: string, input: CreateBookingInput): Promise<{ checkoutUrl: string }>
getBookingById(tenantId: string, id: string): Promise<Booking | null>
```

**Commission Calculation Flow:**

1. Fetch tenant's commission percentage (e.g., 12%)
2. Calculate subtotal (package price + add-on prices)
3. Calculate commission amount (always round UP)
4. Apply Stripe Connect fee limits (0.5% - 50%)
5. Create checkout with application_fee_amount

**Event Emission:**

- `BookingPaid`: Triggered on successful payment, sends confirmation email
- Handlers subscribed in DI container

### 2.3 Payment Processing (Stripe Adapter)

**Location:** `/server/src/adapters/stripe.adapter.ts`

**Responsibilities:**

- Create Stripe checkout sessions
- Create Stripe Connect sessions (for multi-tenant payments)
- Verify webhook signatures
- Process refunds

**Key Patterns:**

- **Destination Charges:** Payment goes directly to tenant's account, platform takes application fee
- **Session Metadata:** Includes tenantId, packageId, eventDate, email for webhook processing
- **Webhook Verification:** HMAC signature validation prevents fraud

**Two Checkout Types:**

1. **Standard Checkout** (no Stripe Connect):

```typescript
await stripe.checkout.sessions.create({
  mode: 'payment',
  customer_email: input.email,
  line_items: [{ price_data: {...}, quantity: 1 }],
  success_url: '...',
  cancel_url: '...',
  metadata: input.metadata
})
```

2. **Connect Checkout** (with tenant's connected account):

```typescript
await stripe.checkout.sessions.create({
  mode: 'payment',
  customer_email: input.email,
  line_items: [...],
  success_url: '...',
  cancel_url: '...',
  payment_intent_data: {
    transfer_data: {
      destination: tenant.stripeAccountId  // Direct to tenant
    },
    application_fee_amount: commissionAmount  // Platform fee
  }
})
```

### 2.4 Commission Service (`CommissionService`)

**Location:** `/server/src/services/commission.service.ts`

**Responsibilities:**

- Calculate platform commission on bookings
- Apply Stripe Connect constraints (0.5% - 50%)
- Store commission snapshot on booking record

**Key Insight:**
Stripe Connect does NOT support `application_fee_percent` - all commissions calculated server-side as fixed cent values.

**Calculation:**

```typescript
const commissionCents = Math.ceil(bookingTotal * (commissionPercent / 100));
// Clamp to Stripe limits:
const minFee = Math.ceil(bookingTotal * 0.005); // 0.5%
const maxFee = Math.floor(bookingTotal * 0.5); // 50%
const finalCommission = Math.max(minFee, Math.min(commissionCents, maxFee));
```

### 2.5 Availability Service

**Location:** `/server/src/services/availability.service.ts`

**Responsibilities:**

- Check if specific dates are available for booking
- Fetch unavailable date ranges for calendar UI
- Check Google Calendar integration
- Respect blackout dates

**Integration Points:**

- **Google Calendar:** Real calendar availability
- **Blackout Dates:** Admin-set blocked dates (maintenance, holidays)
- **Existing Bookings:** Check if date already has a confirmed booking

### 2.6 Stripe Connect Service (`StripeConnectService`)

**Location:** `/server/src/services/stripe-connect.service.ts`

**Responsibilities:**

- Create Stripe Express connected accounts for tenants
- Generate onboarding URLs
- Check account status and capabilities
- Store account IDs securely

**Express Account Creation:**

```typescript
const account = await stripe.accounts.create({
  type: 'express',
  country: 'US',
  email: tenantEmail,
  business_type: 'individual',
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
});
```

### 2.7 Audit Service

**Location:** `/server/src/services/audit.service.ts`

**Responsibilities:**

- Log all configuration changes
- Track who made changes and when
- Store before/after snapshots
- Support compliance and troubleshooting

**Tracked Events:**

- Config version changes
- Branding updates
- Package/add-on modifications
- Commission rate changes

---

## 3. MULTI-TENANT ARCHITECTURE

### 3.1 Tenant Model

**Database Schema:**

```prisma
model Tenant {
  id                  String    @id @default(cuid())
  slug                String    @unique          // URL-safe ID (e.g., "bellaweddings")
  name                String                     // Display name

  // Authentication
  email               String?   @unique          // Tenant admin login
  passwordHash        String?                    // Bcrypt hashed

  // API Keys
  apiKeyPublic        String    @unique          // pk_live_tenant_xyz (public)
  apiKeySecret        String                     // Hashed secret (admin only)

  // Commission
  commissionPercent   Decimal   @db.Decimal(5,2) // 10.0 means 10%

  // Branding
  branding            Json      @default("{}")   // {primaryColor, secondaryColor, logo, fontFamily}

  // Stripe Connect
  stripeAccountId     String?   @unique
  stripeOnboarded     Boolean   @default(false)

  // Encrypted Secrets
  secrets             Json      @default("{}")   // {stripe: {ciphertext, iv, authTag}}

  // Status
  isActive            Boolean   @default(true)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  users               User[]
  packages            Package[]
  bookings            Booking[]
  blackoutDates       BlackoutDate[]
  webhookEvents       WebhookEvent[]
}
```

### 3.2 Data Isolation Strategy

**Multi-layer isolation:**

1. **Database Level:**
   - Every data model includes `tenantId` foreign key
   - Unique indexes prevent cross-tenant data access
   - Example: `@@unique([tenantId, slug])` on Package

2. **API Level (Middleware):**
   - `resolveTenant()` middleware extracts tenant from `X-Tenant-Key` header
   - Validates API key format and tenant existence
   - Attaches tenant object to request
   - Required before route handlers access any data

3. **Service Level:**
   - All repository methods require `tenantId` parameter
   - Service methods validate tenant context
   - Cache keys include tenant ID: `catalog:${tenantId}:*`

4. **Application Level:**
   - JWT tokens include `tenantId` for tenant admin routes
   - Controllers verify `tenantAuth.tenantId` matches request tenant
   - Error messages don't leak tenant existence

**Tenant Resolution Flow:**

```
HTTP Request
    ↓
X-Tenant-Key Header: "pk_live_tenant_xyz"
    ↓
resolveTenant() middleware
    ↓
Lookup tenant by apiKeyPublic in Prisma
    ↓
Validate tenant.isActive
    ↓
Attach to req.tenant (with all properties)
    ↓
Route handlers access via getTenantId(req) or getTenant(req)
```

### 3.3 API Key Management

**Public Key Format:** `pk_live_tenant_{cuid}`

- Safe to include in widget JavaScript
- Used in `X-Tenant-Key` header
- Validates tenant without secrets exposure

**Secret Key:**

- Generated on tenant creation
- Hashed using bcrypt
- Used for admin operations
- Never sent to client

**Key Rotation:**

- Tenant can generate new keys
- Old keys disabled immediately
- All in-flight requests fail gracefully

---

## 4. ADMIN DASHBOARD STRUCTURE

### 4.1 Platform Admin Dashboard

**Location:** `/client/src/pages/admin/PlatformAdminDashboard.tsx`

**Features:**

- View all tenants
- Manage tenant status (active/inactive)
- View aggregated booking metrics
- Monitor system health
- Access tenant logs

**Authentication:**

- Email + password login via `/v1/admin/login`
- JWT token stored in `localStorage.adminToken`
- Role validation: `PLATFORM_ADMIN`

**Protected Routes:**

- `/v1/admin/tenants` - List all tenants
- `/v1/admin/bookings` - View all bookings
- `/v1/admin/blackouts` - Manage blackout dates

### 4.2 Tenant Admin Dashboard

**Location:** `/client/src/pages/tenant/TenantAdminDashboard.tsx`

**Features:**

- Upload logo and customize branding
- Manage packages and add-ons
- View bookings for their tenant
- Set blackout dates
- Configure Stripe Connect
- Monitor commission earnings

**Authentication:**

- Email + password login via `/v1/tenant-auth/login`
- JWT token stored in `localStorage.tenantToken`
- Role validation: `TENANT_ADMIN`
- Token includes `tenantId` and `slug`

**Protected Routes:**

- `/v1/tenant/branding` - Get/update branding
- `/v1/tenant/packages` - CRUD packages
- `/v1/tenant/bookings` - View tenant's bookings
- `/v1/tenant/stripe/onboarding-link` - Generate Stripe Connect URL
- `/v1/tenant/logo` - Upload logo
- `/v1/tenant/blackouts` - Manage blackout dates

**File Upload Features:**

- Logo upload (2MB limit, stored on disk)
- Package photos (5MB limit, max 5 per package)
- Multer for memory-based upload handling
- Files served from `/uploads/logos` and `/uploads/packages`

---

## 5. API PATTERNS, CONTRACTS & SCHEMAS

### 5.1 ts-rest Contract System

**Location:** `/packages/contracts/src/api.v1.ts`

**Pattern Benefits:**

- Single source of truth for API contracts
- Automatic OpenAPI spec generation
- Full TypeScript type inference on client
- Server-side request/response validation via Zod
- Automatic type guards (no manual checking)

**Contract Definition:**

```typescript
export const Contracts = c.router({
  getPackages: {
    method: 'GET',
    path: '/v1/packages',
    responses: {
      200: z.array(PackageDtoSchema),
    },
    summary: 'Get all packages',
  },

  createCheckout: {
    method: 'POST',
    path: '/v1/bookings/checkout',
    body: CreateCheckoutDtoSchema,
    responses: {
      200: z.object({ checkoutUrl: z.string() }),
    },
    summary: 'Create a checkout session',
  },
  // ... more endpoints
});
```

### 5.2 DTO Schemas (Zod Validation)

**Location:** `/packages/contracts/src/dto.ts`

**Key DTOs:**

**PackageDto:**

```typescript
{
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  photoUrl?: string;
  addOns: AddOnDto[];
}
```

**AddOnDto:**

```typescript
{
  id: string;
  packageId: string;
  title: string;
  priceCents: number;
  photoUrl?: string;
}
```

**CreateCheckoutDto:**

```typescript
{
  packageId: string;                // Package slug
  eventDate: string;                // YYYY-MM-DD
  coupleName: string;
  email: string;
  addOnIds?: string[];
}
```

**BookingDto:**

```typescript
{
  id: string;
  packageId: string;
  coupleName: string;
  email: string;
  eventDate: string;               // YYYY-MM-DD
  addOnIds: string[];
  totalCents: number;
  status: 'PAID' | 'REFUNDED' | 'CANCELED';
  createdAt: string;               // ISO datetime
}
```

**TenantDtoSchema:**

```typescript
{
  id: string;
  slug: string;
  name: string;
  email: string | null;
  commissionPercent: number;
  stripeAccountId: string | null;
  stripeOnboarded: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  packageCount?: number;           // Optional stats
  bookingCount?: number;
}
```

**TenantBrandingDtoSchema:**

```typescript
{
  primaryColor?: string;           // CSS color
  secondaryColor?: string;
  fontFamily?: string;
  logo?: string;                   // URL
}
```

### 5.3 Input Validation Schemas

**Location:** `/server/src/validation/`

**Zod Schemas:**

- Package CRUD schemas with price validation
- Blackout date schemas with date format validation
- Booking query schemas with pagination
- Commission schemas with percentage validation

---

## 6. AUTHENTICATION & AUTHORIZATION

### 6.1 JWT Token System

**Token Creation:**

```typescript
// Platform admin
const payload: TokenPayload = {
  userId: user.id,
  email: user.email,
  role: 'admin',
};
const token = jwt.sign(payload, jwtSecret, {
  algorithm: 'HS256',
  expiresIn: '7d',
});

// Tenant admin
const payload: TenantTokenPayload = {
  tenantId: tenant.id,
  slug: tenant.slug,
  email: tenant.email,
  type: 'tenant', // Distinguishes from admin tokens
};
const token = jwt.sign(payload, jwtSecret, {
  algorithm: 'HS256',
  expiresIn: '7d',
});
```

**Token Storage (Client):**

- Platform admin: `localStorage.adminToken`
- Tenant admin: `localStorage.tenantToken`
- Widget: No token needed (uses `X-Tenant-Key` header)

### 6.2 Authentication Middleware

**Auth Middleware** (`/server/src/middleware/auth.ts`):

```typescript
// For admin routes (/v1/admin/*)
export function createAuthMiddleware(identityService: IdentityService) {
  return (req, res, next) => {
    // Extract & verify Authorization header
    const authHeader = req.get('Authorization');
    const parts = authHeader.split(' '); // Bearer <token>
    const payload = identityService.verifyToken(parts[1]);

    // Validate role
    if (payload.role !== 'admin') {
      throw new UnauthorizedError('Admin role required');
    }

    // Attach to res.locals
    res.locals.admin = payload;
    next();
  };
}
```

**Tenant Auth Middleware** (`/server/src/middleware/tenant-auth.ts`):

```typescript
// For tenant routes (/v1/tenant/*)
export function createTenantAuthMiddleware(tenantAuthService) {
  return (req, res, next) => {
    const authHeader = req.get('Authorization');
    const payload = tenantAuthService.verifyToken(token);

    // Validate token type
    if (!payload.type || payload.type !== 'tenant') {
      throw new UnauthorizedError('Tenant token required');
    }

    res.locals.tenantAuth = payload;
    next();
  };
}
```

### 6.3 API Key Authentication

**Tenant API Key Middleware** (`/server/src/middleware/tenant.ts`):

```typescript
export function resolveTenant(prisma: PrismaClient) {
  return async (req, res, next) => {
    const apiKey = req.headers['x-tenant-key'];

    // Validate format (pk_live_tenant_*)
    if (!apiKeyService.isValidPublicKeyFormat(apiKey)) {
      return res.status(401).json({ error: 'Invalid API key format' });
    }

    // Lookup tenant
    const tenant = await prisma.tenant.findUnique({
      where: { apiKeyPublic: apiKey },
    });

    if (!tenant || !tenant.isActive) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;
    next();
  };
}
```

### 6.4 Authorization Patterns

**Role-Based Access Control:**

- `PLATFORM_ADMIN`: Access to `/v1/admin/*` routes
- `TENANT_ADMIN`: Access to `/v1/tenant/*` routes for their tenant only
- Public: No auth required for `/v1/packages/*`, `/v1/availability`, `/v1/bookings/checkout`

**Tenant Isolation:**

- Tenant admins can ONLY access their own tenant's data
- Cross-tenant access returns 404 (not 403) to avoid data leak
- Middleware validates `tenantId` on protected routes

**Client-Side Auth Context:**

**Location:** `/client/src/contexts/AuthContext.tsx`

```typescript
export interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  tenantId: string | null;
  isAuthenticated: boolean;
  login(email: string, password: string, role: UserRole): Promise<void>;
  logout(): void;
  isPlatformAdmin(): boolean;
  isTenantAdmin(): boolean;
  refreshAuth(): void;
}

// Usage
function MyComponent() {
  const { user, isPlatformAdmin, isTenantAdmin } = useAuth();

  if (isPlatformAdmin()) {
    return <PlatformAdminView />;
  }
  if (isTenantAdmin()) {
    return <TenantAdminView tenantId={auth.tenantId!} />;
  }
  return <PublicView />;
}
```

---

## 7. DATABASE MODELS & ENTITIES

### 7.1 Core Entity Relationships

**Conceptual Model:**

```
Tenant (wedding business)
  ├── User (tenant admin accounts)
  ├── Package (wedding packages like "Intimate", "Full Day")
  │   ├── AddOn (photography, flowers, etc.)
  │   └── PackageAddOn (join table)
  ├── Booking (customer bookings)
  │   ├── BookingAddOn (selected add-ons)
  │   ├── Payment (payment records)
  │   └── Customer (who booked)
  ├── BlackoutDate (dates unavailable)
  └── WebhookEvent (Stripe webhook tracking)
```

### 7.2 Key Entities

**User:**

```prisma
model User {
  id            String   @id
  email         String   @unique
  name          String?
  passwordHash  String
  role          UserRole @default(USER)  // USER, ADMIN, PLATFORM_ADMIN, TENANT_ADMIN
  tenantId      String?  // For TENANT_ADMIN users
  createdAt     DateTime @default(now())
  tenant        Tenant?  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

enum UserRole {
  USER
  ADMIN
  PLATFORM_ADMIN
  TENANT_ADMIN
}
```

**Package:**

```prisma
model Package {
  id          String   @id
  tenantId    String   // ISOLATION
  slug        String
  name        String
  description String?
  basePrice   Int      // In cents
  photos      Json     // [{url, filename, size, order}]
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())

  @@unique([tenantId, slug])  // Each tenant's packages have unique slugs
  @@index([tenantId, active])
}
```

**Booking:**

```prisma
model Booking {
  id                  String        @id
  tenantId            String        // ISOLATION
  customerId          String
  packageId           String
  date                DateTime      @db.Date
  status              BookingStatus @default(PENDING)
  totalPrice          Int           // In cents

  // Commission tracking
  commissionAmount    Int           // Platform fee in cents
  commissionPercent   Decimal       // Rate snapshot at booking time

  // Payment tracking
  stripePaymentIntentId String?     @unique
  confirmedAt         DateTime?     // When payment succeeded

  @@unique([tenantId, date])  // One booking per date per tenant
  @@index([tenantId, status])
  @@index([stripePaymentIntentId])
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELED
  FULFILLED
}
```

**Payment:**

```prisma
model Payment {
  id          String        @id
  bookingId   String
  amount      Int           // In cents
  currency    String        @default("USD")
  status      PaymentStatus @default(PENDING)
  processor   String        // "stripe"
  processorId String?       @unique  // Stripe PaymentIntent ID
  createdAt   DateTime      @default(now())

  @@index([processorId])
}

enum PaymentStatus {
  PENDING
  AUTHORIZED
  CAPTURED
  CANCELED
  FAILED
}
```

**BlackoutDate:**

```prisma
model BlackoutDate {
  id        String   @id
  tenantId  String   // ISOLATION
  date      DateTime @db.Date
  reason    String?
  createdAt DateTime @default(now())

  @@unique([tenantId, date])
}
```

---

## 8. EVENT-DRIVEN ARCHITECTURE

### 8.1 In-Process Event Emitter

**Location:** `/server/src/lib/core/events.ts`

**Simple implementation:** In-memory event emitter with typed handlers

```typescript
export interface EventEmitter {
  subscribe<T>(event: string, handler: EventHandler<T>): void;
  emit<T>(event: string, payload: T): Promise<void>;
}

export class InProcessEventEmitter implements EventEmitter {
  private handlers: Map<string, EventHandler[]> = new Map();

  subscribe<T>(event: string, handler: EventHandler<T>): void {
    const existing = this.handlers.get(event) || [];
    this.handlers.set(event, [...existing, handler as EventHandler]);
  }

  async emit<T>(event: string, payload: T): Promise<void> {
    const handlers = this.handlers.get(event) || [];
    await Promise.all(handlers.map((h) => h(payload)));
  }
}
```

### 8.2 Event Subscriptions

**Booking Payment Event:**

Location: `/server/src/di.ts` (line 241-260)

```typescript
// After booking is paid via Stripe webhook
eventEmitter.subscribe<{
  bookingId: string;
  email: string;
  coupleName: string;
  eventDate: string;
  packageTitle: string;
  addOnTitles: string[];
  totalCents: number;
}>('BookingPaid', async (payload) => {
  try {
    // Send confirmation email via Postmark
    await mailProvider.sendBookingConfirm(payload.email, {
      eventDate: payload.eventDate,
      packageTitle: payload.packageTitle,
      totalCents: payload.totalCents,
      addOnTitles: payload.addOnTitles,
    });
  } catch (err) {
    logger.error({ err, bookingId: payload.bookingId }, 'Failed to send email');
  }
});
```

### 8.3 Webhook Processing

**Stripe Webhook Handler:** `/server/src/routes/webhooks.routes.ts`

```typescript
// POST /v1/webhooks/stripe (raw body required)
export class WebhooksController {
  async handleStripeWebhook(signature: string, rawBody: string) {
    // 1. Verify Stripe signature
    const event = this.paymentProvider.verifyWebhook(rawBody, signature);

    // 2. Check for duplicate (idempotency)
    const isDuplicate = await this.webhookRepo.isDuplicate(tenantId, event.id);
    if (isDuplicate) return; // Already processed

    // 3. Record webhook
    await this.webhookRepo.recordWebhook({
      tenantId,
      eventId: event.id,
      eventType: event.type,
      rawPayload: rawBody,
    });

    // 4. Process based on event type
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const tenantId = session.metadata.tenantId;
      const booking = await this.bookingService.confirmBooking(tenantId, session);

      // 5. Emit event for side effects
      await this.eventEmitter.emit('BookingPaid', {
        bookingId: booking.id,
        email: booking.customer.email,
        coupleName: session.metadata.coupleName,
        eventDate: session.metadata.eventDate,
        packageTitle: booking.package.name,
        addOnTitles: booking.addOns.map((a) => a.name),
        totalCents: booking.totalPrice,
      });
    }

    // 6. Mark processed
    await this.webhookRepo.markProcessed(tenantId, event.id);
  }
}
```

---

## 9. UI/UX COMPONENTS & PATTERNS

### 9.1 Component Hierarchy

**Public Booking Widget:**

- `WidgetApp` - Main widget container
  - `WidgetCatalogGrid` - Package list view
  - `WidgetPackagePage` - Package details + checkout form
  - `WidgetMessenger` - postMessage communication to parent

**Admin Dashboards:**

- `PlatformAdminDashboard` - Platform-wide view
  - Tenant list with stats
  - Booking overview
  - System monitoring

- `TenantAdminDashboard` - Tenant-specific view
  - Branding configuration
  - Package management
  - Booking management
  - Stripe Connect setup

**Shared Components:**

- `ColorPicker` - Hex color input
- `FontSelector` - Font family dropdown
- `PackagePhotoUploader` - Multi-file photo upload with reordering

### 9.2 Widget Embedding Pattern

**Parent Window** (customer's website):

```html
<div id="mais-booking-widget"></div>
<script src="https://widget.mais.com/widget.js"></script>
<script>
  MAISWidget.init({
    containerId: 'mais-booking-widget',
    tenantKey: 'pk_live_tenant_xyz',
    mode: 'embedded', // or 'modal'
  });
</script>
```

**Widget** (embedded iframe):

1. Receives config via `postMessage` from parent
2. Sets `X-Tenant-Key` header on API requests
3. Fetches packages and branding
4. Shows catalog → package details → checkout
5. Sends events back to parent (`BOOKING_CREATED`, `BOOKING_COMPLETED`, `ERROR`)

**WidgetMessenger Pattern:**

```typescript
class WidgetMessenger {
  static getInstance(parentOrigin: string): WidgetMessenger;

  sendReady(): void; // Widget loaded
  sendResize(height: number): void; // Auto-resize iframe
  sendBookingCreated(id: string): void; // Booking created (pending payment)
  sendBookingCompleted(id: string, returnUrl?): void; // Payment successful
  sendError(error: string, code?): void;
  sendNavigation(route: string, params?): void;

  // Security: Always validates target origin
  private sendToParent(type: string, data: Record<string, unknown>) {
    window.parent.postMessage(
      { source: 'mais-widget', type, ...data },
      this.parentOrigin // Never '*' in production
    );
  }
}
```

### 9.3 State Management

**TanStack Query (React Query):**

- Caches API responses
- Handles loading/error/success states
- Automatic refetching on window focus
- Used for: packages, availability, bookings

```typescript
const {
  data: packages,
  isLoading,
  error,
} = useQuery({
  queryKey: ['tenant', 'packages'],
  queryFn: async () => {
    const result = await api.getPackages();
    return result.body || [];
  },
});
```

**React Context (Auth):**

- Global auth state (user, role, token)
- Login/logout methods
- Automatic token refresh on mount

**Component Props:**

- Preference for props over global state for reusable components
- One-way data flow for predictable updates

### 9.4 UI Framework & Styling

**UI Components (Radix UI):**

- Dialog, Dropdown, Label, Select, Slot
- Headless, accessible, unstyled
- Composed with Tailwind CSS

**Styling:**

- Tailwind CSS for utility classes
- Class variance authority (CVA) for component variants
- Tailwind merge for dynamic class composition

**Icons:**

- Lucide React for consistent iconography
- Small, tree-shakeable, consistent

---

## 10. TESTING STRUCTURE & PATTERNS

### 10.1 Test Framework

**Vitest** for unit and integration tests

- Fast, native ESM support
- Jest-compatible API
- TypeScript support built-in

**Test Files:**

- Located alongside source (`*.test.ts`)
- Unit tests for services, repositories
- Integration tests for database operations

### 10.2 Example Tests

**Audit Service Test** (`audit.service.test.ts`):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let auditService: AuditService;
  const mockPrisma = { /* mocked Prisma methods */ };

  beforeEach(() => {
    auditService = new AuditService({ prisma: mockPrisma });
    vi.clearAllMocks();
  });

  it('should create audit log for config changes', async () => {
    const input = { tenantId, changeType, operation, ... };
    await auditService.trackChange(input);

    expect(mockPrisma.configChangeLog.create).toHaveBeenCalledWith({
      data: { /* expected payload */ }
    });
  });
});
```

**Catalog Service Integration Test** (`catalog.service.integration.test.ts`):

- Uses real Prisma client with test database
- Tests full query performance
- Validates N+1 query optimization

### 10.3 Test Patterns

**Mocking:**

- Mock Prisma methods for unit tests
- Real database for integration tests
- Mock external APIs (Stripe, Google Calendar)

**Fixtures:**

- Reusable test data builders
- Tenant/package/booking factories

**Coverage:**

- Target 70% branch coverage
- Focus on critical paths (auth, payments, data isolation)
- Scripts available: `npm test`, `npm run test:watch`, `npm run coverage`

---

## 11. CONFIGURATION & ENVIRONMENT SETUP

### 11.1 Environment Variables

**Server Config Schema** (`/server/src/lib/core/config.ts`):

```typescript
const ConfigSchema = z.object({
  ADAPTERS_PRESET: z.enum(['mock', 'real']).default('mock'),
  API_PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(1),

  // Real mode (optional for mock preset)
  DATABASE_URL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().url().optional(),
  STRIPE_CANCEL_URL: z.string().url().optional(),
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  POSTMARK_FROM_EMAIL: z.string().email().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: z.string().optional(),
});
```

### 11.2 Adapter Modes

**Mock Mode** (`ADAPTERS_PRESET=mock`):

- In-memory Prisma
- Mock Stripe, Google Calendar, Postmark adapters
- Simulated webhook processing
- Perfect for development without external services

**Real Mode** (`ADAPTERS_PRESET=real`):

- PostgreSQL via Prisma
- Real Stripe integration
- Real email via Postmark
- Real Google Calendar
- Requires all env vars configured

### 11.3 Database Setup

**Migrations:**

```bash
npm run db:migrate      # Create/update schema
npm run db:seed        # Seed initial data
```

**Connection Pooling:**

- Handled by Prisma/Supabase automatically
- Recommended 1-5 connections per serverless instance
- Prisma default: (num_cpus \* 2) + spindle_count

### 11.4 Script Commands

**Development:**

```bash
npm run dev              # Start API with hot reload
npm run dev:mock        # Mock mode (no DB required)
npm run dev:real        # Real mode with PostgreSQL
```

**Testing:**

```bash
npm run test            # Run all tests once
npm run test:watch     # Watch mode
npm run test:integration  # Integration tests only
npm run coverage        # Generate coverage report
```

**Database:**

```bash
npm run db:migrate     # Run migrations
npm run db:seed        # Seed database
npm run prisma:generate # Regenerate Prisma client
```

**Utilities:**

```bash
npm run create-tenant   # Create test tenant
npm run create-tenant-with-stripe  # With Stripe account
```

---

## 12. SECURITY & TENANT ISOLATION PATTERNS

### 12.1 Authentication Security

**Password Hashing:**

- bcryptjs with salting (default 10 rounds)
- Never store plaintext passwords
- Always use `bcrypt.compare()` for verification

**JWT Security:**

- Explicit algorithm: `HS256` only
- Algorithm always verified: `algorithms: ['HS256']`
- Prevents algorithm confusion attacks
- 7-day expiration
- Secret in environment variable (not hardcoded)

**HTTPS Only (Production):**

- All API communication encrypted
- Secure cookie flag for tokens
- CORS whitelist for known origins

### 12.2 Data Isolation

**Database Level:**

- Foreign key constraints
- Unique indexes on (tenantId, field) pairs
- No cascading deletes without explicit configuration
- Audit table for compliance

**API Level:**

- API key validation before any data access
- Tenant lookup validates status (isActive)
- 401 for invalid keys, 403 for inactive tenants

**Middleware Layer:**

- `resolveTenant()` required for all tenant-scoped routes
- `requireTenant()` enforces tenant presence
- `requireStripeOnboarded()` prevents premature payments

**Application Level:**

- All service methods accept tenantId
- Cache keys include tenant ID
- Error messages don't leak tenant existence

**Query Level:**

- Every Prisma query filters by tenantId
- No global queries without explicit tenant context
- Type-safe tenant isolation via TypeScript

### 12.3 Payment Security

**Stripe Webhook Verification:**

- HMAC signature verification
- Raw body required (not JSON parsed)
- Webhook signature checked before processing
- Prevents replay attacks via idempotency key tracking

**Commission Calculation:**

- Server-side only (never client-side)
- Stored in booking record at time of creation
- Audit logged for all changes

**Stripe Connect:**

- Destination charges pattern
- Platform never touches customer funds
- Connected account responsible for refunds
- Application fee deducted by Stripe automatically

### 12.4 API Key Rotation

**Current System:**

- Public key: `pk_live_tenant_{cuid}` (in X-Tenant-Key header)
- Secret key: Hashed, admin operations only
- Keys stored in Tenant.apiKeyPublic, Tenant.apiKeySecret

**Rotation (Future):**

- Generate new key pair
- Store both old and new temporarily
- Gradual client migration period
- Disable old keys after grace period

---

## 13. INTEGRATION POINTS & ADAPTERS

### 13.1 External Service Adapters

**Stripe Adapter** (`stripe.adapter.ts`):

- Creates checkout sessions
- Creates Stripe Connect sessions
- Verifies webhook signatures
- Processes refunds

**Postmark Adapter** (`postmark.adapter.ts`):

- Sends booking confirmation emails
- Handles template rendering
- Fallback to file sink if no token

**Google Calendar Adapter** (`gcal.adapter.ts`):

- Checks date availability
- Uses service account for authentication
- Fallback to mock (all dates available) if credentials missing

**Mock Adapters** (for development):

- In-memory implementation of all interfaces
- Deterministic behavior for testing
- No external service required

### 13.2 Repository Adapters

**Prisma Repositories:**

- `PrismaCatalogRepository` - Package/AddOn queries
- `PrismaBookingRepository` - Booking CRUD
- `PrismaTenantRepository` - Tenant queries
- `PrismaBlackoutRepository` - Blackout date management
- `PrismaUserRepository` - User authentication
- `PrismaWebhookRepository` - Webhook deduplication

**Repository Ports** (`lib/ports.ts`):

- Define interfaces without implementation details
- Enable adapter swapping
- Clear contracts for each repository

---

## 14. KEY ARCHITECTURAL DECISIONS

### 14.1 Modular Monolith vs Microservices

**Decision:** Modular monolith

- **Rationale:** Simpler operations, shared domain models, unified deployment
- **Trade-off:** Lower initial scalability, but sufficient for current load
- **Future:** Can extract services if needed (payment, email, webhooks)

### 14.2 Database-Level Multi-Tenancy

**Decision:** Shared PostgreSQL with tenant isolation via schema

- **Rationale:** Easier operational complexity, natural cross-tenant analytics
- **Alternative considered:** Separate schema per tenant (rejected - higher ops cost)
- **Alternative considered:** Separate DB per tenant (rejected - management overhead)

### 14.3 Stripe Connect Pattern

**Decision:** Destination charges with application_fee_amount

- **Rationale:** Simple, direct tenant payout, platform gets commission
- **Alternative considered:** OAuth with Stripe (rejected - higher complexity)
- **Alternative considered:** Platform collects all, pays out (rejected - more compliance burden)

### 14.4 Type-Safe APIs with ts-rest

**Decision:** ts-rest for contract-driven API design

- **Rationale:** Single source of truth, automatic OpenAPI, full type safety
- **Benefit:** Eliminates entire class of client/server mismatch bugs
- **Trade-off:** Learning curve, but worth it for maintainability

### 14.5 In-Process Event Emitter

**Decision:** Simple in-memory event system

- **Rationale:** Good for monolithic, single-instance architecture
- **Future:** Can replace with message queue (Redis, RabbitMQ) for distributed systems

---

## 15. DEVELOPMENT WORKFLOW

### 15.1 Git Workflow

- Feature branches from main
- PR reviews before merge
- Commit messages follow conventional format
- No direct pushes to main

### 15.2 Code Standards

- **Language:** TypeScript (strict mode)
- **Formatter:** Prettier (auto-format)
- **Linter:** ESLint (no dangerous patterns)
- **Type Checking:** `tsc --noEmit`
- **Testing:** `npm test` before commit

### 15.3 Running Locally

```bash
# Terminal 1: API server (mock mode)
npm run dev:api

# Terminal 2: Frontend dev server
npm run dev:client

# Terminal 3: Stripe webhook testing (optional)
stripe listen --forward-to localhost:3001/v1/webhooks/stripe

# Or all in one
npm run dev:all
```

**Access Points:**

- API: http://localhost:3001
- Web: http://localhost:5173
- Docs: http://localhost:3001/api/docs

---

## 16. MONITORING & LOGGING

### 16.1 Structured Logging

**Pino Logger:**

- Structured JSON logging
- Log levels: debug, info, warn, error
- Child loggers with request context
- Pretty-printed in development

**Request Logging:**

- Unique request ID (UUID)
- Method, path, status code, response time
- User/tenant context when available
- Error stack traces

### 16.2 Error Handling

**Domain Errors:**

- `NotFoundError` (404)
- `ValidationError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `ConflictError` (409)
- `UnprocessableEntityError` (422)

**Error Handler Middleware:**

- Maps domain errors to HTTP status codes
- Returns consistent error response format
- Logs stack traces for debugging
- Doesn't leak internal implementation details

**Health Checks:**

- `GET /health` - Always returns `{ ok: true }`
- `GET /ready` - Checks required environment variables
  - Real mode: Validates DB, Stripe, email configs
  - Mock mode: Always ready

---

## SUMMARY

Elope is a well-architected, production-ready multi-tenant booking platform built on modern web technologies. Key strengths:

1. **Clean Architecture:** Clear separation of concerns with explicit service boundaries
2. **Type Safety:** End-to-end TypeScript with ts-rest contracts
3. **Multi-Tenancy:** Database-level isolation with API key-based tenant resolution
4. **Payment Integration:** Sophisticated Stripe Connect implementation with commission handling
5. **Developer Experience:** Mock mode for development, comprehensive documentation
6. **Security:** JWT authentication, password hashing, webhook verification, data isolation
7. **Extensibility:** Adapter pattern for external services, easy to swap implementations
8. **Testing:** Comprehensive unit and integration test coverage with Vitest
9. **Documentation:** Diátaxis framework for organized, approachable documentation

The codebase demonstrates best practices in Node.js/TypeScript development and is well-positioned for scaling to larger teams and feature sets.
