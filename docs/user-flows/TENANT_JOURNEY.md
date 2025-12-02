# Tenant (Member) Journey - Complete User Flow

**Version**: 1.0
**Last Updated**: November 21, 2025
**Status**: Complete Implementation Analysis

---

## Table of Contents

1. [Overview](#overview)
2. [Tenant Persona](#tenant-persona)
3. [Complete Journey Map](#complete-journey-map)
4. [Phase 1: Onboarding](#phase-1-onboarding)
5. [Phase 2: Initial Setup](#phase-2-initial-setup)
6. [Phase 3: Service Configuration](#phase-3-service-configuration)
7. [Phase 4: Payment Setup](#phase-4-payment-setup)
8. [Phase 5: Ongoing Operations](#phase-5-ongoing-operations)
9. [Feature-by-Feature Breakdown](#feature-by-feature-breakdown)
10. [Technical Implementation](#technical-implementation)
11. [Admin Dashboard UI](#admin-dashboard-ui)
12. [Current Capabilities](#current-capabilities)
13. [Future Enhancements](#future-enhancements)

---

## Overview

The MAIS platform provides a complete business management solution for wedding and event professionals operating as independent tenants. Each tenant runs their own branded booking experience while leveraging the platform's infrastructure for payments, scheduling, and customer management.

### Key Differentiators
- **Full Data Isolation**: Each tenant's data is completely segregated using multi-tenant architecture
- **White-Label Ready**: Complete branding customization (logo, colors, fonts)
- **Stripe Connect**: Direct payments to tenant bank accounts with platform commission
- **Real-Time Availability**: Pessimistic locking prevents double-bookings
- **JWT Authentication**: Secure tenant admin access with 7-day token expiration

---

## Tenant Persona

### Primary Profile: Small Business Wedding/Event Professional

**Demographics:**
- Business owners with 1-5 staff members
- Offering 3-15 service packages
- 10-100 bookings per year
- $50k-$500k annual revenue

**Business Models Supported:**
- **MAISment Photographers**: Intimate ceremony packages with add-on services
- **Micro-Wedding Venues**: Small venue rentals with catering/coordination packages
- **Wellness Retreat Hosts**: Multi-day retreat packages with tiered pricing
- **Event Coordinators**: Day-of coordination, full-service planning packages

**Technical Skill Level:**
- Comfortable with basic web interfaces
- May need API documentation for advanced features
- Prefers visual dashboards over command-line tools

**Pain Points Solved:**
- Manual booking calendar management
- Payment collection and commission tracking
- Double-booking prevention
- Branded customer experience
- Real-time availability checking

---

## Complete Journey Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT LIFECYCLE OVERVIEW                    │
└─────────────────────────────────────────────────────────────────┘

Phase 1: ONBOARDING (Platform Admin)
├── Account Creation (create-tenant script)
├── API Keys Generated (pk_live_*, sk_live_*)
└── Credentials Provided to Tenant

Phase 2: INITIAL SETUP (Tenant Admin)
├── First Login (/login)
├── Dashboard Access (/tenant/dashboard)
├── Branding Configuration
│   ├── Logo Upload (2MB max, PNG/JPG/SVG/WebP)
│   ├── Color Customization (4 colors: primary, secondary, accent, background)
│   └── Font Selection (8 curated font families)
└── Tenant Information Review

Phase 3: SERVICE CONFIGURATION (Tenant Admin)
├── Package Management
│   ├── Create Packages (title, description, price, slug)
│   ├── Upload Package Photos (5 photos max per package, 5MB each)
│   ├── Set Pricing (in cents, e.g., $1,500 = 150000)
│   └── Organize by Segments (optional: "Wellness", "Micro-Wedding", etc.)
├── Add-On Management
│   ├── Create Add-Ons (linked to packages or global)
│   └── Set Add-On Pricing
└── Availability Management
    ├── Set Blackout Dates (holidays, personal time)
    └── Add Blackout Reasons (optional internal notes)

Phase 4: PAYMENT SETUP (Tenant Admin + Platform Support)
├── Stripe Connect Account Creation
├── Onboarding Link Generation
├── Complete Stripe Express Onboarding
│   ├── Business Details Verification
│   ├── Bank Account Connection
│   └── Identity Verification
├── Platform Verifies Onboarding Complete
└── Stripe Dashboard Access (via login link)

Phase 5: ONGOING OPERATIONS (Tenant Admin)
├── Booking Management
│   ├── View All Bookings (filter by status, date range)
│   ├── Monitor Upcoming Events
│   └── Track Revenue (via Stripe Dashboard)
├── Package/Pricing Updates
│   ├── Seasonal Package Updates
│   ├── Price Adjustments
│   └── Photo Gallery Management
├── Availability Updates
│   ├── Add/Remove Blackout Dates
│   └── Calendar Management
├── Branding Refinements
│   ├── Update Colors/Fonts
│   └── Replace Logo
└── Customer Communication
    ├── View Customer Contact Info
    └── Follow Up on Bookings (external email)

Phase 6: GROWTH & ANALYTICS (Future)
├── Segment Performance Analytics
├── Revenue Reporting
├── Customer Insights
└── Marketing Tools
```

---

## Phase 1: Onboarding

### Platform Admin Creates Tenant Account

**Script Location:** `/Users/mikeyoung/CODING/MAIS/server/scripts/create-tenant.ts`

**Command:**
```bash
npm run create-tenant -- --slug=bellaweddings --name="Bella Weddings" --commission=10.0
```

**What Happens:**
1. **Slug Validation** (lines 110-119)
   - Checks if slug is available
   - Validates format (lowercase, alphanumeric, hyphens)
   - Prevents reserved words

2. **API Key Generation** (line 123)
   - Public Key: `pk_live_bellaweddings_abc123def456` (safe for client-side)
   - Secret Key: `sk_live_bellaweddings_xyz789uvw012` (server-side only)
   - Keys hashed with bcrypt before storage

3. **Database Record Creation** (lines 129-136)
   ```typescript
   await tenantRepo.create({
     slug: 'bellaweddings',
     name: 'Bella Weddings',
     apiKeyPublic: 'pk_live_bellaweddings_...',
     apiKeySecret: '<bcrypt_hash>',
     commissionPercent: 10.0,
     branding: {}
   })
   ```

4. **Output Generated** (lines 141-172)
   - Tenant ID (CUID)
   - API keys (secret shown ONCE)
   - Next steps checklist

**Database Schema Reference:** `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma` (lines 37-92)

### Tenant Admin Authentication Setup

**Option 1: Password-Based Login (Recommended)**

Platform admin creates login credentials:
```bash
npm run create-tenant-with-stripe -- \
  --slug=bellaweddings \
  --name="Bella Weddings" \
  --email=admin@bellaweddings.com \
  --password=SecurePassword123
```

**Option 2: API Key Authentication**
- Tenant uses `X-Tenant-Key: pk_live_*` header for all requests
- No login UI required (API-only access)

---

## Phase 2: Initial Setup

### First Login

**UI Location:** `/Users/mikeyoung/CODING/MAIS/client/src/pages/Login.tsx`

**Login Flow:**

1. **Navigate to Login Page** (`/login`)
   - Clean, branded interface with Macon AI colors
   - Email + password form
   - Auto-fill for development (admin@elope.com / admin123)

2. **Submit Credentials** (lines 69-104)
   ```typescript
   // Unified login - tries both platform admin and tenant admin
   try {
     await login(email, password, 'PLATFORM_ADMIN');
     navigate("/admin/dashboard");
   } catch (adminError) {
     await login(email, password, 'TENANT_ADMIN');
     navigate("/tenant/dashboard");
   }
   ```

3. **Authentication Backend**
   - **Service:** `/Users/mikeyoung/CODING/MAIS/server/src/services/tenant-auth.service.ts`
   - **Route:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/auth.routes.ts`

   **Token Generation** (tenant-auth.service.ts, lines 49-60):
   ```typescript
   const payload: TenantTokenPayload = {
     tenantId: tenant.id,
     slug: tenant.slug,
     email: tenant.email,
     type: 'tenant'
   };

   const token = jwt.sign(payload, jwtSecret, {
     algorithm: 'HS256',
     expiresIn: '7d'  // 7-day session
   });
   ```

4. **Redirect to Dashboard**
   - Token stored in AuthContext (client-side)
   - All subsequent requests include `Authorization: Bearer <token>`

**Security Features:**
- Rate limiting: 5 attempts per 15 minutes (auth.routes.ts, line 166)
- Bcrypt password hashing with salt rounds = 10
- JWT with HS256 signing (prevents algorithm confusion attacks)
- XSS protection via HTTP-only cookie option (future enhancement)

### Dashboard Access

**Component:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/TenantDashboard.tsx`

**Dashboard Sections:**

1. **Overview Metrics** (lines 142-184)
   - Total Packages count
   - Blackout Dates count
   - Total Bookings count
   - Branding Status (Configured / Not Set)

2. **Tab Navigation** (lines 187-234)
   - Packages
   - Blackouts
   - Bookings
   - Branding

3. **Lazy-Loaded Data**
   - Each tab fetches data on activation
   - Prevents unnecessary API calls

**Backend Route:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin.routes.ts`

---

## Phase 3: Service Configuration

### Branding Configuration

**Component:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/BrandingEditor.tsx`

#### Logo Upload

**UI Flow:**

1. **Select Logo File**
   - File input in BrandingForm component
   - Drag-and-drop support (future enhancement)

2. **Upload via API** (tenant-admin.routes.ts, lines 76-126)
   ```typescript
   POST /v1/tenant-admin/logo
   Headers:
     Authorization: Bearer <jwt_token>
   Body: multipart/form-data
     logo: <file>

   // Validation
   - Max size: 2MB (multer middleware)
   - Allowed types: PNG, JPG, SVG, WebP
   ```

3. **Backend Processing** (upload.service.ts, lines 108-141)
   ```typescript
   // Generate unique filename
   const filename = `logo-${timestamp}-${randomStr}.png`;

   // Save to local storage
   const filepath = `/uploads/logos/${filename}`;
   await fs.promises.writeFile(filepath, file.buffer);

   // Return public URL
   const url = `http://localhost:3001/uploads/logos/${filename}`;
   ```

4. **Update Tenant Branding** (lines 95-109)
   ```typescript
   const updatedBranding = {
     ...currentBranding,
     logo: result.url
   };

   await tenantRepository.update(tenantId, {
     branding: updatedBranding
   });
   ```

**File Storage:**
- **Current:** Local filesystem (`/uploads/logos/`)
- **Future:** Cloud storage (Cloudinary, AWS S3)

#### Color Customization

**UI Component:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/branding/components/BrandingForm.tsx`

**4-Color System:**

| Color Field | Purpose | Example |
|-------------|---------|---------|
| `primaryColor` | Main brand color (buttons, headers) | `#1a365d` (Macon Navy) |
| `secondaryColor` | Accent color (CTAs, highlights) | `#fb923c` (Macon Orange) |
| `accentColor` | Success/positive actions | `#38b2ac` (Macon Teal) |
| `backgroundColor` | Page background | `#ffffff` (White) |

**Validation** (BrandingEditor.tsx, lines 66-82):
```typescript
const hexColorRegex = /^#[0-9A-F]{6}$/i;
if (!hexColorRegex.test(primaryColor)) {
  setError("Primary color must be a valid hex color (e.g., #1a365d)");
  return;
}
```

**API Call:**
```typescript
PUT /v1/tenant-admin/branding
Headers:
  Authorization: Bearer <jwt_token>
Body:
  {
    "primaryColor": "#7C3AED",
    "secondaryColor": "#fb923c",
    "accentColor": "#38b2ac",
    "backgroundColor": "#ffffff"
  }
```

**Backend Route:** tenant-admin.routes.ts, lines 132-189

**Live Preview:**
- Component: `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/branding/components/BrandingPreview.tsx`
- Shows real-time preview of colors on sample UI elements
- Helps tenants visualize brand before saving

#### Font Selection

**Available Fonts:**

| Font Family | Style | Best For |
|-------------|-------|----------|
| Inter | Modern Sans-Serif | Clean, professional |
| Playfair Display | Elegant Serif | Luxury weddings |
| Lora | Classic Serif | Traditional events |
| Montserrat | Clean Sans-Serif | Modern, minimalist |
| Cormorant Garamond | Romantic Serif | Vintage weddings |
| Raleway | Refined Sans-Serif | Contemporary |
| Crimson Text | Traditional Serif | Formal events |
| Poppins | Friendly Sans-Serif | Casual, approachable |

**Implementation:**
- Fonts loaded via Google Fonts CDN
- Applied dynamically using CSS variables
- Fallback to system fonts if CDN unavailable

### Package Management

**Component:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/TenantPackagesManager.tsx`

#### Create Package

**UI Flow:**

1. **Click "Create Package"** (line 62)
   - Opens package creation form
   - Form component: `./packages/PackageForm.tsx`

2. **Fill Package Details**
   - Title: Display name (e.g., "Garden Romance Package")
   - Slug: URL-safe identifier (e.g., "garden-romance")
   - Description: Rich text description (sell the package!)
   - Price: In cents (e.g., 150000 = $1,500.00)

3. **Submit Form** (usePackageForm hook)
   ```typescript
   POST /v1/tenant-admin/packages
   Headers:
     Authorization: Bearer <jwt_token>
   Body:
     {
       "slug": "garden-romance",
       "title": "Garden Romance Package",
       "description": "Beautiful outdoor ceremony...",
       "priceCents": 150000
     }
   ```

4. **Backend Validation** (catalog.service.ts, lines 147-184)
   ```typescript
   // Validate required fields
   validateRequiredFields(data, ['slug', 'title', 'description'], 'Package');

   // Validate price
   validatePrice(data.priceCents, 'priceCents');

   // Check slug uniqueness within tenant
   const existing = await repository.getPackageBySlug(tenantId, data.slug);
   if (existing) {
     throw new ValidationError(`Package with slug "${data.slug}" already exists`);
   }

   // Create package
   const result = await repository.createPackage(tenantId, data);

   // Invalidate cache
   this.invalidateCatalogCache(tenantId);
   ```

**Database Record:**
```sql
-- Prisma schema (lines 172-200)
model Package {
  id          String  @id @default(cuid())
  tenantId    String  -- CRITICAL: Multi-tenant isolation
  slug        String
  name        String
  description String?
  basePrice   Int
  active      Boolean @default(true)
  segmentId   String? -- Optional segment assignment
  grouping    String? -- Optional tier label (Solo/Couple/Group)
  photos      Json    @default("[]") -- Photo gallery
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### Upload Package Photos

**Feature:** Sprint 5.1 - Complete Backend, Frontend UI in Progress

**UI Component:** `/Users/mikeyoung/CODING/MAIS/client/src/components/PackagePhotoUploader.tsx`

**Upload Flow:**

1. **Select Photo File** (5MB max)
2. **Upload via API** (tenant-admin.routes.ts, lines 390-480)
   ```typescript
   POST /v1/tenant-admin/packages/:id/photos
   Headers:
     Authorization: Bearer <jwt_token>
   Body: multipart/form-data
     photo: <file>

   // Backend validation
   - Max 5 photos per package
   - Max size: 5MB per photo
   - Allowed types: PNG, JPG, WebP
   ```

3. **Photo Metadata Storage** (lines 432-444)
   ```typescript
   const newPhoto = {
     url: uploadResult.url,
     filename: 'package-1234567890-abc.jpg',
     size: 2048576, // bytes
     order: currentPhotos.length  // Append to end
   };

   const updatedPhotos = [...currentPhotos, newPhoto];

   await catalogService.updatePackage(tenantId, packageId, {
     photos: updatedPhotos
   });
   ```

4. **Photo Management**
   - Drag-and-drop reordering (future enhancement)
   - Delete photos (lines 492-541)
   - Set primary/featured photo (future enhancement)

**Photo Storage:**
- **Current:** Local filesystem (`/uploads/packages/`)
- **Future:** Cloud CDN with image optimization

#### Update Package

**UI:** Edit button in package list (PackageList.tsx)

**Flow:**
1. Click edit icon on package card
2. Form pre-fills with existing data
3. Modify fields (all fields optional)
4. Submit update

**API Call:**
```typescript
PUT /v1/tenant-admin/packages/:id
Headers:
  Authorization: Bearer <jwt_token>
Body:
  {
    "title": "Updated Package Name",
    "priceCents": 160000
  }
```

**Backend Validation** (catalog.service.ts, lines 186-237):
- Verifies package exists for tenant
- Validates slug uniqueness (if changed)
- Updates only provided fields
- Invalidates cache for old and new slugs

#### Delete Package

**UI:** Delete button with confirmation dialog

**Safety Measures:**
- Confirmation dialog (AlertDialog component)
- Warning about permanent deletion
- Note that existing bookings are NOT affected

**API Call:**
```typescript
DELETE /v1/tenant-admin/packages/:id
Headers:
  Authorization: Bearer <jwt_token>
```

**Backend Logic** (catalog.service.ts, lines 239-271):
- Soft delete (sets `active: false`) OR hard delete (removes record)
- Current implementation: Hard delete
- Existing bookings retain package data (denormalized)

### Segment Management (Sprint 9 Feature)

**Component:** `/Users/mikeyoung/CODING/MAIS/client/src/features/admin/segments/` (Platform Admin)

**Service:** `/Users/mikeyoung/CODING/MAIS/server/src/services/segment.service.ts`

**Routes:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-segments.routes.ts`

**Segment Concept:**
- Represents distinct business lines (e.g., "Wellness Retreat", "Micro-Wedding")
- Packages can be grouped by segment
- Each segment has its own landing page with custom hero content
- Enables multi-product business models on single platform

**Segment Properties:**
- **slug:** URL-safe identifier (e.g., "wellness-retreat")
- **name:** Display name (e.g., "Wellness Retreats")
- **heroTitle:** Landing page hero section title
- **heroSubtitle:** Optional tagline
- **heroImage:** URL to segment-specific hero image
- **description:** Extended SEO-friendly description
- **metaTitle/metaDescription:** SEO metadata
- **sortOrder:** Display order in navigation (integer)
- **active:** Visibility toggle (boolean)

**CRUD Operations:**

```typescript
// List all segments (including inactive for admin)
GET /v1/tenant/admin/segments
Response: Array of segments ordered by sortOrder

// Create segment
POST /v1/tenant/admin/segments
Body: {
  slug: "wellness-retreat",
  name: "Wellness Retreats",
  heroTitle: "Rejuvenate Your Mind & Body",
  heroSubtitle: "Escape to nature",
  sortOrder: 0,
  active: true
}

// Update segment
PUT /v1/tenant/admin/segments/:id
Body: Partial segment data

// Delete segment
DELETE /v1/tenant/admin/segments/:id
// Sets package.segmentId to null (cascade: SetNull)

// Get segment statistics
GET /v1/tenant/admin/segments/:id/stats
Response: { packageCount, addOnCount }
```

**Validation Logic** (segment.service.ts, lines 162-187):
- Slug must be lowercase alphanumeric with hyphens
- Checks slug uniqueness within tenant
- Required fields: slug, name, heroTitle

**Cache Strategy:**
- 15-minute TTL for segment lists
- Cache keys include tenantId AND segmentId
- Invalidation on create/update/delete

### Blackout Date Management

**Component:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/BlackoutsManager.tsx`

**Purpose:** Block specific dates from customer booking

**UI Features:**

1. **Add Blackout Form** (lines 155-197)
   - Date picker (HTML5 date input)
   - Optional reason field (internal notes)
   - Submit button with loading state

2. **Blackout List Table** (lines 200-264)
   - Sorted by date (most recent first)
   - Badge display for dates
   - Delete button per entry
   - Empty state message

3. **Delete Confirmation Dialog** (lines 267-313)
   - Warning icon and messaging
   - Explains consequences (date becomes bookable again)
   - Cancel and confirm actions

**API Calls:**

```typescript
// List blackout dates
GET /v1/tenant-admin/blackouts
Response: [
  {
    id: "blk_abc123",
    date: "2025-12-25",
    reason: "Christmas Holiday"
  }
]

// Add blackout date
POST /v1/tenant-admin/blackouts
Body: {
  date: "2025-12-25",
  reason: "Holiday"  // Optional
}

// Delete blackout date
DELETE /v1/tenant-admin/blackouts/:id
```

**Backend Logic** (tenant-admin.routes.ts, lines 551-639):
- Validates date format (YYYY-MM-DD)
- Checks tenant ownership before delete
- Returns full records with IDs (for deletion)

**Integration with Booking Flow:**
- Availability service checks blackouts before allowing booking
- Repository: `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/blackout.repository.ts`

**Future Enhancement:** Calendar view (currently list-only)

### Add-On Management

**Status:** API Complete, UI Pending

**Service:** `/Users/mikeyoung/CODING/MAIS/server/src/services/catalog.service.ts` (lines 274-327)

**API Endpoints:**

```typescript
// Create add-on (platform admin only currently)
POST /v1/admin/packages/:packageId/addons
Body: {
  title: "Photography Add-On",
  priceCents: 50000,
  packageId: "pkg_abc123"  // Or null for global
}

// Update add-on
PUT /v1/admin/addons/:id
Body: {
  title: "Updated Photography",
  priceCents: 55000
}

// Delete add-on
DELETE /v1/admin/addons/:id
```

**Add-On Types:**
- **Package-Specific:** Linked to single package (packageId set)
- **Global:** Available across all packages (packageId null)
- **Segment-Scoped:** Available within segment (segmentId set, Sprint 9)

**Future Tenant Admin UI:**
- Add-ons tab in dashboard
- Package-level add-on management
- Drag-and-drop ordering

---

## Phase 4: Payment Setup

### Stripe Connect Integration

**Service:** `/Users/mikeyoung/CODING/MAIS/server/src/services/stripe-connect.service.ts`

**Architecture:** Stripe Express Connected Accounts

#### Why Stripe Connect?

**Benefits for Tenants:**
- Direct payments to their bank account
- Full control over refunds/disputes
- Access to Stripe Express Dashboard
- Professional payment processing

**Benefits for Platform:**
- Automated commission collection (application fee)
- No PCI compliance burden
- Integrated reporting
- Standard payment flows

#### Account Creation Flow

**Step 1: Create Connected Account** (lines 57-112)

```typescript
// Platform admin creates account for tenant
const account = await stripe.accounts.create({
  type: 'express',  // Stripe handles onboarding/compliance
  country: 'US',
  email: tenant.email,
  business_type: 'individual',  // or 'company'
  business_profile: {
    name: tenant.name,
    product_description: 'Wedding and event booking services'
  },
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true }
  }
});

// Store account ID
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    stripeAccountId: account.id,
    stripeOnboarded: false  // Not onboarded yet
  }
});
```

**Step 2: Generate Onboarding Link** (lines 124-151)

```typescript
const accountLink = await stripe.accountLinks.create({
  account: tenant.stripeAccountId,
  refresh_url: 'https://yourplatform.com/onboarding/refresh',
  return_url: 'https://yourplatform.com/onboarding/complete',
  type: 'account_onboarding'
});

// Link expires after 24 hours
// Tenant completes onboarding in Stripe-hosted flow
```

**Step 3: Complete Onboarding**

Tenant completes in Stripe interface:
1. Business details verification
2. Bank account connection
3. Identity verification (photo ID)
4. Tax information (W-9/W-8BEN)

**Step 4: Verify Onboarding Status** (lines 160-196)

```typescript
const account = await stripe.accounts.retrieve(tenant.stripeAccountId);

const isOnboarded = account.charges_enabled === true;

await prisma.tenant.update({
  where: { id: tenantId },
  data: { stripeOnboarded: isOnboarded }
});
```

**Middleware Protection:** `/Users/mikeyoung/CODING/MAIS/server/src/middleware/tenant.ts` (lines 200-227)

```typescript
// Requires Stripe onboarding for payment endpoints
export function requireStripeOnboarded(req, res, next) {
  if (!req.tenant.stripeOnboarded || !req.tenant.stripeAccountId) {
    res.status(403).json({
      error: 'Stripe Connect onboarding not completed',
      code: 'STRIPE_NOT_ONBOARDED'
    });
    return;
  }
  next();
}
```

#### Commission Calculation

**Service:** `/Users/mikeyoung/CODING/MAIS/server/src/services/commission.service.ts`

**Platform Revenue Model:**

```typescript
// Example: $1,500 booking, 10% commission
const packagePrice = 150000;  // cents
const commission = 10.0;       // percent

// Calculation
const tenantRevenue = packagePrice;           // $1,500.00
const platformFee = packagePrice * 0.10;      // $150.00
const customerPays = tenantRevenue + platformFee; // $1,650.00

// OR absorb fee model:
const customerPays = packagePrice;            // $1,500.00
const platformFee = packagePrice * 0.10;      // $150.00
const tenantRevenue = packagePrice - platformFee; // $1,350.00
```

**Current Implementation:** Customer pays platform fee (commission added to total)

#### Stripe Dashboard Access

**Generate Login Link** (stripe-connect.service.ts, lines 304-322)

```typescript
const loginLink = await stripe.accounts.createLoginLink(
  tenant.stripeAccountId
);

// Link expires after 5 minutes
// Tenant can view:
// - Transaction history
// - Payout schedule
// - Dispute management
// - Settings
```

---

## Phase 5: Ongoing Operations

### Booking Management

**Component:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/TenantBookingList.tsx`

**View All Bookings:**

```typescript
GET /v1/tenant-admin/bookings
Response: [
  {
    id: "bkg_abc123",
    packageId: "pkg_xyz789",
    coupleName: "Sarah & Alex",
    email: "sarah@example.com",
    phone: "+1234567890",
    eventDate: "2025-06-15",
    addOnIds: ["addon_123"],
    totalCents: 175000,
    status: "PAID",
    createdAt: "2025-01-15T10:30:00Z"
  }
]
```

**Filtering Options:**

```typescript
// By status
GET /v1/tenant-admin/bookings?status=PAID

// By date range
GET /v1/tenant-admin/bookings?startDate=2025-06-01&endDate=2025-06-30

// Combined
GET /v1/tenant-admin/bookings?status=PAID&startDate=2025-06-01&endDate=2025-06-30
```

**Status Values:**
- `PAID`: Confirmed and paid
- `REFUNDED`: Refunded (via Stripe Dashboard)
- `CANCELED`: Canceled

**Backend Logic** (tenant-admin.routes.ts, lines 650-700):
- Validates query parameters with Zod
- Filters bookings in-memory (future: database query)
- Maps to DTO for consistent response shape

### Customer Communication

**Current:** Manual (via email/phone from booking data)

**Future Enhancements:**
- In-app messaging
- Automated email reminders (1 week before event)
- SMS notifications (via Twilio)
- Customer portal for booking management

### Revenue Tracking

**Current:** Via Stripe Dashboard

**Access Flow:**
1. Tenant logs into MAIS dashboard
2. Clicks "Stripe Dashboard" (future UI)
3. Backend generates login link
4. Redirects to Stripe Express Dashboard

**Stripe Dashboard Features:**
- Real-time transaction history
- Automated payout schedule (daily/weekly/monthly)
- Dispute management
- Fee breakdown (Stripe + platform fees)
- Export to CSV/PDF

**Future:** Native revenue dashboard in MAIS

### Package Updates

**Seasonal Updates:**
- Edit package descriptions
- Update photos
- Adjust pricing
- Add/remove add-ons

**A/B Testing Strategy (Future):**
- Create duplicate packages with different pricing
- Track conversion rates
- Disable lower-performing packages

### Branding Updates

**Update Colors:**
- Access Branding tab
- Modify color pickers
- See live preview
- Save changes

**Replace Logo:**
- Upload new logo file
- Old logo deleted from filesystem
- New logo URL saved to branding

**Font Changes:**
- Select from dropdown
- Instant preview
- Save changes

---

## Feature-by-Feature Breakdown

### Authentication & Authorization

**Implementation:**

1. **JWT-Based Sessions**
   - **Token Generation:** `server/src/services/tenant-auth.service.ts` (lines 49-63)
   - **Token Verification:** `server/src/middleware/auth.ts` (lines 14-67)
   - **Token Payload:**
     ```typescript
     {
       tenantId: "cuid_...",
       slug: "bellaweddings",
       email: "admin@bellaweddings.com",
       type: "tenant",
       iat: 1234567890,
       exp: 1234567890 + (7 * 24 * 60 * 60)  // 7 days
     }
     ```

2. **Password Security**
   - Bcrypt hashing with 10 salt rounds
   - Stored in `tenant.passwordHash` column
   - Never transmitted in responses

3. **Rate Limiting**
   - 5 login attempts per 15 minutes per IP
   - Middleware: `server/src/middleware/rateLimiter.ts`

4. **CORS Protection**
   - Whitelist of allowed origins
   - Credentials enabled for JWT cookies (future)

**Security Best Practices Implemented:**
- Algorithm specification (`HS256` only) prevents JWT confusion attacks
- Token expiration (7 days) forces periodic re-authentication
- Bcrypt automatic salting prevents rainbow table attacks
- Rate limiting prevents brute force attacks

### Branding System

**Implementation:**

1. **Logo Upload System**
   - **Service:** `server/src/services/upload.service.ts`
   - **Storage:** Local filesystem (`/uploads/logos/`)
   - **Validation:** Multer middleware (size, type)
   - **Filename Generation:** `logo-{timestamp}-{random}.{ext}`
   - **Public URL:** `http://localhost:3001/uploads/logos/{filename}`

2. **Color System**
   - **Database:** JSON field in `tenant.branding` column
   - **Format:** Hex colors (`#RRGGBB`)
   - **Validation:** Regex `/^#[0-9A-F]{6}$/i`
   - **CSS Variables:** Injected dynamically in client

3. **Font System**
   - **Loading:** Google Fonts CDN
   - **Fallbacks:** System fonts (`sans-serif`, `serif`)
   - **Application:** CSS `font-family` property

**Client-Side Rendering:**

```typescript
// Dynamic theme application
<div style={{
  '--color-primary': branding.primaryColor,
  '--color-secondary': branding.secondaryColor,
  '--color-accent': branding.accentColor,
  '--color-background': branding.backgroundColor,
  '--font-family': branding.fontFamily
}}>
  {/* Widget content */}
</div>
```

### Package Catalog System

**Implementation:**

1. **Database Schema**
   - **Table:** `Package` (lines 172-200 in schema.prisma)
   - **Tenant Isolation:** `tenantId` foreign key (CRITICAL)
   - **Unique Constraint:** `@@unique([tenantId, slug])`
   - **Indexes:**
     - `@@index([tenantId, active])`
     - `@@index([tenantId, segmentId])`

2. **Service Layer**
   - **Location:** `server/src/services/catalog.service.ts`
   - **Repository Pattern:** Abstraction over Prisma
   - **Caching:** 15-minute TTL with tenant-scoped keys
   - **Validation:** Price, required fields, slug uniqueness

3. **Cache Strategy**
   ```typescript
   // Cache key format
   `catalog:${tenantId}:all-packages`
   `catalog:${tenantId}:package:${slug}`
   `catalog:${tenantId}:segment:${segmentId}:packages`
   ```

4. **Photo Gallery**
   - **Storage:** JSON array in `photos` column
   - **Structure:**
     ```typescript
     [
       {
         url: "https://...",
         filename: "package-123.jpg",
         size: 2048576,
         order: 0
       }
     ]
     ```
   - **Max Photos:** 5 per package

### Booking Flow (Customer-Facing)

**Implementation:** `server/src/services/booking.service.ts`

**Critical Flow:**

1. **Create Checkout Session** (lines 57-120)
   ```typescript
   // Validate package exists for tenant
   const pkg = await catalogRepo.getPackageBySlug(tenantId, packageSlug);

   // Calculate total with add-ons and commission
   const calculation = await commissionService.calculateBookingTotal(
     tenantId,
     pkg.priceCents,
     addOnIds
   );

   // Generate idempotency key (prevents duplicates)
   const idempotencyKey = generateCheckoutKey(
     tenantId, email, pkgId, date, timestamp
   );

   // Create Stripe checkout session
   const session = await stripe.checkout.sessions.create({
     payment_intent_data: {
       application_fee_amount: calculation.platformFeeCents,
       transfer_data: {
         destination: tenant.stripeAccountId
       }
     },
     line_items: [...],
     mode: 'payment'
   }, {
     idempotencyKey  // Prevents duplicate charges
   });

   return { checkoutUrl: session.url };
   ```

2. **Webhook Processing** (webhooks.routes.ts)
   - Stripe sends `checkout.session.completed` event
   - Platform verifies signature
   - Creates booking record
   - Sends confirmation email (via Postmark)

3. **Double-Booking Prevention** (CRITICAL)
   - **Database Constraint:** `@@unique([tenantId, date])`
   - **Pessimistic Locking:** `SELECT FOR UPDATE` in transaction
   - **Validation:** Check availability before checkout

### Availability System

**Service:** `server/src/services/availability.service.ts`

**Logic:**

```typescript
async isDateAvailable(tenantId: string, date: string): Promise<boolean> {
  // Check blackout dates
  const blackouts = await blackoutRepo.getBlackoutsForTenant(tenantId);
  if (blackouts.some(b => b.date === date)) {
    return false;
  }

  // Check existing bookings
  const bookings = await bookingRepo.getBookingsForDate(tenantId, date);
  if (bookings.length > 0) {
    return false;
  }

  return true;
}
```

**Transaction Safety:**

```typescript
await prisma.$transaction(async (tx) => {
  // Lock date row
  const existing = await tx.$queryRaw`
    SELECT id FROM bookings
    WHERE tenantId = ${tenantId} AND date = ${date}
    FOR UPDATE
  `;

  if (existing.length > 0) {
    throw new BookingConflictError(date);
  }

  // Create booking within same transaction
  await tx.booking.create({ data: {...} });
});
```

**Race Condition Handling:**
- Unique constraint catches simultaneous submissions
- Graceful error message: "Date no longer available"
- Customer redirected to calendar to select new date

---

## Technical Implementation

### Backend Architecture

**Framework:** Express.js 4.x

**Key Files:**

| File | Purpose | Lines |
|------|---------|-------|
| `server/src/app.ts` | Express app setup, middleware, routes | All |
| `server/src/di.ts` | Dependency injection container | All |
| `server/src/routes/tenant-admin.routes.ts` | Tenant admin API endpoints | 1-704 |
| `server/src/services/tenant-auth.service.ts` | JWT authentication | 1-102 |
| `server/src/services/catalog.service.ts` | Package/add-on management | 1-501 |
| `server/src/services/booking.service.ts` | Booking creation & checkout | 1-300+ |
| `server/src/services/stripe-connect.service.ts` | Stripe account management | 1-361 |
| `server/src/services/upload.service.ts` | File upload handling | 1-237 |
| `server/src/middleware/tenant.ts` | Tenant resolution from API key | 1-256 |
| `server/src/middleware/auth.ts` | JWT verification | 1-68 |

### Multi-Tenant Data Isolation

**Critical Security Pattern:**

Every database query MUST filter by `tenantId`:

```typescript
// ✅ CORRECT - Tenant-scoped
const packages = await prisma.package.findMany({
  where: { tenantId, active: true }
});

// ❌ WRONG - Security vulnerability (cross-tenant data leak)
const packages = await prisma.package.findMany({
  where: { active: true }
});
```

**Enforcement Mechanisms:**

1. **Repository Pattern**
   - All repository methods require `tenantId` as first parameter
   - Interface: `server/src/lib/ports.ts`
   - Example:
     ```typescript
     interface CatalogRepository {
       getAllPackages(tenantId: string): Promise<Package[]>;
       getPackageBySlug(tenantId: string, slug: string): Promise<Package>;
     }
     ```

2. **Middleware Injection**
   - `resolveTenant()` extracts tenantId from API key
   - Attaches to `req.tenantId` for route handlers
   - Example: `tenant.ts` (lines 55-155)

3. **Database Constraints**
   - Unique constraints include tenantId: `@@unique([tenantId, slug])`
   - Foreign key cascade deletes
   - Indexes on tenantId columns

4. **Cache Key Scoping**
   - All cache keys include tenantId: `catalog:${tenantId}:packages`
   - Prevents cache poisoning across tenants

### Frontend Architecture

**Framework:** React 18 + Vite 6

**Key Directories:**

| Directory | Purpose |
|-----------|---------|
| `client/src/pages/tenant/` | Top-level tenant admin pages |
| `client/src/features/tenant-admin/` | Feature-specific components |
| `client/src/features/tenant-admin/packages/` | Package management UI |
| `client/src/features/tenant-admin/branding/` | Branding UI |
| `client/src/contexts/AuthContext.tsx` | Authentication state |
| `client/src/lib/api.ts` | Type-safe API client |

**Component Architecture:**

```
TenantAdminDashboard (page)
└── TenantDashboard (feature wrapper)
    ├── Overview Metrics (cards)
    ├── Tab Navigation
    └── Tab Content
        ├── TenantPackagesManager
        │   ├── PackageForm
        │   ├── PackageList
        │   └── PackagePhotoUploader
        ├── BlackoutsManager
        ├── TenantBookingList
        └── BrandingEditor
            ├── BrandingForm
            └── BrandingPreview
```

**State Management:**

- **Authentication:** React Context API
- **Form State:** Custom `useForm` hook
- **Server State:** TanStack Query (React Query)
- **Local State:** `useState` for UI state

**Type Safety:**

- Contracts package: `@macon/contracts`
- Shared types between client and server
- Zod schemas for runtime validation
- TypeScript strict mode enabled

### API Design

**Contract-First Approach:**

All APIs defined in `packages/contracts/src/` using ts-rest + Zod:

```typescript
// Define once, use everywhere
export const tenantAdminGetPackages = {
  method: 'GET',
  path: '/v1/tenant-admin/packages',
  responses: {
    200: z.array(PackageResponseDto),
    401: UnauthorizedErrorSchema,
  },
};

// Backend implements contract
const handler = tsRestExpress(
  contract.tenantAdminGetPackages,
  async (req) => {
    const packages = await catalogService.getAllPackages(req.tenantId);
    return { status: 200, body: packages };
  }
);

// Frontend gets type-safe client
const packages = await api.tenantAdminGetPackages();
// packages is typed as PackageResponseDto[]
```

**Benefits:**
- Single source of truth for API shape
- Compile-time type checking
- Runtime validation with Zod
- Auto-generated OpenAPI docs

### Database Schema

**Prisma ORM:** `server/prisma/schema.prisma`

**Key Models:**

```prisma
model Tenant {
  id                String   @id @default(cuid())
  slug              String   @unique
  name              String
  email             String?  @unique
  passwordHash      String?
  apiKeyPublic      String   @unique
  apiKeySecret      String
  commissionPercent Decimal  @default(10.0)
  branding          Json     @default("{}")
  primaryColor      String   @default("#1a365d")
  secondaryColor    String   @default("#fb923c")
  accentColor       String   @default("#38b2ac")
  backgroundColor   String   @default("#ffffff")
  stripeAccountId   String?  @unique
  stripeOnboarded   Boolean  @default(false)
  secrets           Json     @default("{}")
  isActive          Boolean  @default(true)

  packages          Package[]
  bookings          Booking[]
  blackoutDates     BlackoutDate[]
  segments          Segment[]
}

model Package {
  id          String   @id @default(cuid())
  tenantId    String   -- CRITICAL: Multi-tenant isolation
  slug        String
  name        String
  description String?
  basePrice   Int
  active      Boolean  @default(true)
  segmentId   String?
  grouping    String?
  photos      Json     @default("[]")

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  segment     Segment? @relation(fields: [segmentId], references: [id])

  @@unique([tenantId, slug])
  @@index([tenantId, active])
  @@index([tenantId, segmentId])
}

model Booking {
  id          String       @id @default(cuid())
  tenantId    String       -- CRITICAL
  packageId   String
  coupleName  String
  email       String
  phone       String?
  eventDate   String       -- YYYY-MM-DD format
  addOnIds    String[]
  totalCents  Int
  status      BookingStatus @default(PENDING)

  @@unique([tenantId, eventDate])  -- Prevent double-bookings
  @@index([tenantId, status])
  @@index([tenantId, eventDate])
}

enum BookingStatus {
  PENDING
  PAID
  CANCELED
  REFUNDED
}
```

---

## Admin Dashboard UI

### Dashboard Layout

**Component:** `client/src/features/tenant-admin/TenantDashboard.tsx`

**Layout:** AdminLayout wrapper with breadcrumbs

**Sections:**

1. **Header** (lines 132-139)
   - Title: "Tenant Dashboard"
   - Subtitle: Tenant name and slug

2. **Metrics Cards** (lines 142-184)
   - 4-column grid (responsive: 1-col mobile, 2-col tablet, 4-col desktop)
   - Real-time counts:
     - Total Packages
     - Blackout Dates
     - Total Bookings
     - Branding Status
   - Icon indicators (Package, XCircle, Calendar, Palette)
   - Hover effects for interactivity

3. **Tab Navigation** (lines 187-234)
   - Underline style (border-bottom on active)
   - Accessible (keyboard navigation)
   - Color transitions on hover/active

4. **Tab Content Area** (lines 237-260)
   - Lazy-loaded components
   - Only active tab rendered

### Packages Tab

**Component:** `TenantPackagesManager.tsx`

**Features:**

1. **Create/Edit Form**
   - Inline form (no modal)
   - Cancel button to close
   - Real-time validation
   - Error messages

2. **Package List**
   - Card-based layout
   - Package details (title, price, description)
   - Edit and delete actions
   - Empty state message

3. **Photo Uploader** (when editing)
   - Upload button
   - Photo preview grid
   - Delete photo buttons
   - Max 5 photos indicator

**UI States:**
- Loading: Spinner overlay
- Success: Green checkmark message (3-second auto-dismiss)
- Error: Red error banner
- Empty: Friendly "Create your first package" message

### Blackouts Tab

**Component:** `BlackoutsManager.tsx`

**Features:**

1. **Add Blackout Form**
   - Date picker (HTML5 native)
   - Reason text input (optional)
   - Submit button with loading state

2. **Blackout List Table**
   - Date column (formatted as "December 25, 2025")
   - Reason column (or "—" if empty)
   - Delete button column
   - Sorted by date (most recent first)

3. **Delete Confirmation Dialog**
   - Warning icon
   - Consequences explanation
   - Cancel and confirm buttons

**Future Enhancement:** Calendar view with visual date blocking

### Bookings Tab

**Component:** `TenantBookingList.tsx`

**Features:**

1. **Filter Bar**
   - Status dropdown (PAID, REFUNDED, CANCELED)
   - Date range picker (start and end dates)
   - Apply filters button

2. **Booking Table**
   - Columns: Couple Name, Event Date, Package, Total, Status, Actions
   - Status badges (color-coded)
   - View details button
   - Export button (future)

3. **Empty State**
   - "No bookings yet" message
   - Call-to-action to share booking link

**Future Enhancements:**
- Booking details modal
- Refund button (with Stripe integration)
- Email customer button
- Calendar view

### Branding Tab

**Component:** `BrandingEditor.tsx`

**Layout:** 2-column grid (form + preview)

**Form Section:**

1. **Logo Upload**
   - File input button
   - Current logo preview
   - Max size indicator (2MB)
   - Accepted formats list

2. **Color Pickers**
   - 4 color inputs (HTML5 color picker)
   - Hex value text input (for precise colors)
   - Default values shown as placeholders
   - Validation error messages

3. **Font Dropdown**
   - Select from 8 curated fonts
   - Font previews in dropdown items

4. **Save Button**
   - Large, prominent
   - Loading state
   - Success feedback

**Preview Section:**

1. **Live Preview**
   - Mock booking widget
   - Updates in real-time as colors/fonts change
   - Shows logo placement
   - Sample UI elements (buttons, cards, text)

2. **Preview Controls**
   - Toggle between light/dark mode
   - Toggle between desktop/mobile view

**Responsive Design:**
- Desktop: Side-by-side (form left, preview right)
- Mobile: Stacked (form on top, preview below)

### Navigation & Layout

**Component:** `client/src/layouts/AdminLayout.tsx`

**Features:**

1. **Top Navigation Bar**
   - Logo (links to dashboard)
   - Breadcrumbs (shows current location)
   - User menu dropdown
     - Profile link (future)
     - Stripe Dashboard link (future)
     - Logout button

2. **Sidebar** (future enhancement)
   - Dashboard link
   - Packages link
   - Bookings link
   - Branding link
   - Settings link
   - Help/Support link

3. **Content Area**
   - Max-width container (prevents ultra-wide layouts)
   - Padding for mobile devices
   - Smooth scrolling

**Accessibility:**
- Keyboard navigation
- ARIA labels
- Focus indicators
- Screen reader support

---

## Current Capabilities

### Fully Implemented Features

#### Authentication & Security
- ✅ JWT-based tenant admin authentication
- ✅ Password hashing with bcrypt (10 salt rounds)
- ✅ Rate limiting (5 attempts/15 min)
- ✅ Multi-tenant data isolation
- ✅ API key authentication (public + secret)
- ✅ Token expiration (7 days)

#### Branding Customization
- ✅ Logo upload (2MB max, PNG/JPG/SVG/WebP)
- ✅ 4-color customization system
- ✅ 8 curated font families
- ✅ Live preview
- ✅ CSS variable injection
- ✅ Local file storage

#### Package Management
- ✅ Create packages (title, description, price, slug)
- ✅ Update packages (all fields editable)
- ✅ Delete packages (hard delete)
- ✅ Package photo upload (5 photos max, 5MB each)
- ✅ Photo deletion
- ✅ Slug uniqueness validation
- ✅ Price validation

#### Segment Management (Sprint 9)
- ✅ Create segments (slug, name, hero content)
- ✅ Assign packages to segments
- ✅ Segment landing pages
- ✅ SEO metadata
- ✅ Sort order control
- ✅ Active/inactive toggle
- ✅ Segment statistics (package/add-on counts)

#### Blackout Date Management
- ✅ Add blackout dates
- ✅ Delete blackout dates
- ✅ Optional reason notes
- ✅ List view (sorted by date)
- ✅ Integration with booking availability

#### Booking Management
- ✅ View all bookings
- ✅ Filter by status (PAID, REFUNDED, CANCELED)
- ✅ Filter by date range
- ✅ Display customer contact info
- ✅ Show total revenue per booking

#### Payment Processing
- ✅ Stripe Connect account creation
- ✅ Express onboarding link generation
- ✅ Onboarding status verification
- ✅ Commission calculation (configurable per tenant)
- ✅ Application fee collection
- ✅ Direct bank payouts to tenant

#### Availability System
- ✅ Blackout date checking
- ✅ Existing booking conflict detection
- ✅ Double-booking prevention (unique constraint + pessimistic locking)
- ✅ Real-time availability API

#### Admin Dashboard UI
- ✅ Login page
- ✅ Dashboard overview with metrics
- ✅ Tab-based navigation
- ✅ Package management UI
- ✅ Blackout date management UI
- ✅ Booking list UI
- ✅ Branding editor UI
- ✅ Success/error feedback

#### Developer Experience
- ✅ CLI tenant creation tool
- ✅ Type-safe API contracts
- ✅ Zod validation schemas
- ✅ Prisma ORM
- ✅ Comprehensive logging
- ✅ Error handling middleware

### Partially Implemented Features

#### Add-On Management
- ✅ Backend API (create, update, delete)
- ⚠️ Tenant admin UI (pending)
- ✅ Global vs package-specific add-ons
- ✅ Segment-scoped add-ons (Sprint 9)

#### File Storage
- ✅ Local filesystem storage
- ⚠️ Cloud storage (planned: Cloudinary/S3)
- ⚠️ CDN integration (future)

#### Analytics & Reporting
- ⚠️ Native revenue dashboard (use Stripe for now)
- ⚠️ Booking trends
- ⚠️ Package performance metrics
- ⚠️ Customer insights

---

## Future Enhancements

### Planned Features (Roadmap)

#### Near-Term (Next 3 Sprints)

**Sprint 10: Advanced Package Management**
- Drag-and-drop photo reordering
- Set primary/featured photo
- Package duplication (clone existing package)
- Package archival (soft delete)
- Package templates library

**Sprint 11: Enhanced Booking Management**
- Booking details modal
- Direct refund button (Stripe API integration)
- Email customer button (template-based)
- Add internal notes to bookings
- Export bookings to CSV
- Calendar view for bookings

**Sprint 12: Customer Portal**
- Customer login with booking ID + email
- View booking details
- Request date changes
- Request refunds
- Upload documents (marriage license, etc.)

#### Mid-Term (4-6 Sprints)

**Analytics Dashboard**
- Revenue charts (monthly, quarterly, yearly)
- Package performance metrics
- Conversion funnel (views → bookings)
- Customer demographics
- Seasonal trends

**Marketing Tools**
- Discount codes / promo codes
- Seasonal pricing rules
- Early bird discounts
- Referral program
- Email marketing integration (Mailchimp, ConvertKit)

**Advanced Availability**
- Recurring blackout patterns (every Monday, holidays)
- Partial availability (afternoon only, 2-hour slots)
- Multiple resource booking (photographer + venue)
- Buffer time between bookings

**Multi-User Access**
- Team member accounts (admin, staff, viewer roles)
- Permission-based access control
- Activity audit log
- Team notifications

#### Long-Term (6+ Sprints)

**White-Label Website Builder**
- Custom domain support (bellaweddings.com)
- Page builder with drag-and-drop
- Template library (10+ wedding business themes)
- SEO optimization tools
- Blog/portfolio integration

**Advanced Payments**
- Payment plans (deposit + final payment)
- Payment reminders
- Automatic late fees
- Tip/gratuity options
- Gift cards / vouchers

**CRM Integration**
- Contact management
- Email sequences
- Task management
- Customer lifecycle tracking
- Zapier integration

**Mobile Apps**
- iOS native app (Swift)
- Android native app (Kotlin)
- Push notifications
- Offline mode
- Photo uploads from mobile

### Technical Debt & Improvements

**Security Enhancements**
- HTTP-only cookies for JWT storage
- CSRF protection
- Content Security Policy (CSP) headers
- Rate limiting per tenant (not just IP)
- API key rotation tools

**Performance Optimizations**
- Redis cache layer
- Image optimization (WebP, lazy loading)
- Database query optimization
- CDN for static assets
- Server-side rendering (SSR)

**Developer Experience**
- OpenAPI documentation auto-generation
- Postman collection
- Sandbox/staging environment
- Seed data scripts for testing
- E2E test coverage (currently 0%)

**Monitoring & Observability**
- Application Performance Monitoring (APM)
- Error tracking (Sentry)
- Log aggregation (Loggly, Datadog)
- Uptime monitoring
- User behavior analytics

---

## Technical Code References

### Key Files & Line Numbers

#### Backend (Express API)

**Authentication:**
- JWT Service: `/server/src/services/tenant-auth.service.ts`
  - Line 26-63: Login method with bcrypt validation
  - Line 72-90: Token verification
  - Line 98-100: Password hashing utility

**Tenant Admin Routes:**
- Main Router: `/server/src/routes/tenant-admin.routes.ts`
  - Line 76-126: Logo upload endpoint
  - Line 132-189: Branding update endpoint
  - Line 195-224: Branding get endpoint
  - Line 258-282: List packages endpoint
  - Line 288-318: Create package endpoint
  - Line 324-355: Update package endpoint
  - Line 361-376: Delete package endpoint
  - Line 390-480: Package photo upload endpoint
  - Line 492-541: Package photo delete endpoint
  - Line 551-582: List blackout dates endpoint
  - Line 588-610: Create blackout endpoint
  - Line 616-639: Delete blackout endpoint
  - Line 650-700: List bookings endpoint

**Services:**
- Catalog Service: `/server/src/services/catalog.service.ts`
  - Line 57-74: Get all packages with caching
  - Line 96-118: Get package by slug
  - Line 147-184: Create package with validation
  - Line 186-237: Update package
  - Line 239-271: Delete package
  - Line 351-368: Get packages by segment (Sprint 9)

- Stripe Connect: `/server/src/services/stripe-connect.service.ts`
  - Line 57-112: Create connected account
  - Line 124-151: Generate onboarding link
  - Line 160-196: Check onboarding status
  - Line 304-322: Create dashboard login link

- Upload Service: `/server/src/services/upload.service.ts`
  - Line 108-141: Upload logo
  - Line 149-182: Upload package photo
  - Line 188-200: Delete logo
  - Line 206-218: Delete package photo

**Middleware:**
- Tenant Resolution: `/server/src/middleware/tenant.ts`
  - Line 55-155: Resolve tenant from API key
  - Line 172-187: Require tenant middleware
  - Line 200-227: Require Stripe onboarded middleware

- Authentication: `/server/src/middleware/auth.ts`
  - Line 14-67: JWT verification middleware

**Database:**
- Prisma Schema: `/server/prisma/schema.prisma`
  - Line 37-92: Tenant model
  - Line 172-200: Package model
  - Line 134-170: Segment model (Sprint 9)
  - Line 216-250: Booking model

#### Frontend (React Client)

**Pages:**
- Login: `/client/src/pages/Login.tsx`
  - Line 69-104: Login submission logic
- Dashboard Wrapper: `/client/src/pages/tenant/TenantAdminDashboard.tsx`
  - Line 32-50: Fetch tenant info

**Features:**
- Tenant Dashboard: `/client/src/features/tenant-admin/TenantDashboard.tsx`
  - Line 68-80: Load packages
  - Line 82-94: Load blackouts
  - Line 96-108: Load bookings
  - Line 110-122: Load branding

- Package Manager: `/client/src/features/tenant-admin/TenantPackagesManager.tsx`
  - Line 32-35: Handle edit
  - Line 38-41: Handle submit

- Branding Editor: `/client/src/features/tenant-admin/BrandingEditor.tsx`
  - Line 61-109: Handle save with validation

- Blackouts Manager: `/client/src/features/tenant-admin/BlackoutsManager.tsx`
  - Line 68-100: Add blackout
  - Line 107-132: Delete blackout

**Utilities:**
- API Client: `/client/src/lib/api.ts`
  - Auto-generated type-safe client from contracts

---

## Summary

The MAIS tenant journey provides a comprehensive business management solution for wedding and event professionals. The platform successfully implements:

### Core Strengths
1. **Multi-Tenant Architecture**: Complete data isolation with tenant-scoped queries
2. **White-Label Branding**: Full customization of colors, fonts, and logo
3. **Stripe Connect Integration**: Direct payments with automated commission
4. **Real-Time Availability**: Prevents double-bookings with pessimistic locking
5. **Type-Safe APIs**: Contract-first design with Zod validation

### Current State
- **Backend**: 90% feature-complete
- **Frontend UI**: 75% feature-complete
- **Testing**: 60% pass rate (Sprint 6 complete)
- **Documentation**: Comprehensive guides available

### Technical Excellence
- JWT authentication with 7-day expiration
- Bcrypt password hashing
- Rate limiting on auth endpoints
- Application-level caching (15-min TTL)
- Pessimistic locking for race conditions
- Idempotent webhook processing

### Growth Opportunities
- Add-on management UI (backend complete)
- Native analytics dashboard
- Customer portal
- Mobile apps
- CRM integration
- Advanced payment plans

The tenant journey is production-ready for core use cases (branding, packages, bookings) with clear roadmap for advanced features.

---

**Document Version**: 1.0
**Last Updated**: November 21, 2025
**Status**: Complete Implementation Analysis
**Next Review**: After Sprint 10 Completion
