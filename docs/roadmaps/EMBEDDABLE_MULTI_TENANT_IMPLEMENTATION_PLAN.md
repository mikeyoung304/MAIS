# Embeddable Multi-Tenant Implementation Plan

**Project:** MAIS - Multi-Tenant Embeddable Wedding Booking Platform
**Architecture:** Embeddable Widget (Hybrid: JavaScript SDK + iframe)
**Timeline:** 6 months (24 weeks)
**Target Scale:** 2-50 tenants
**Commission Model:** Variable per tenant (admin-provisioned)
**Date:** January 2025

---

## Executive Summary

This plan transforms the MAIS application into **MAIS** - a multi-tenant embeddable storefront platform. Each tenant integrates our booking widget into their existing website using a simple JavaScript snippet.

### Key Architectural Decisions

1. **Embedding Strategy:** Hybrid approach (JavaScript SDK loader + iframe widget)
2. **Tenant Identification:** API keys (`pk_live_<tenant_slug>_<random>`)
3. **Data Isolation:** Row-level with `tenantId` column (PostgreSQL RLS + service layer)
4. **Payment Processing:** Stripe Connect Express with server-side commission calculation
5. **Deployment:** Hybrid - Render (backend) + Vercel (frontend/widget)
6. **Security:** CSP frame-ancestors, postMessage origin validation, CORS, encrypted tenant secrets

### Phased Rollout (6 Months)

| Phase                    | Duration    | Milestone                                            |
| ------------------------ | ----------- | ---------------------------------------------------- |
| **Phase 1: Foundation**  | Weeks 1-4   | Database schema, tenant model, basic API isolation   |
| **Phase 2: Widget Core** | Weeks 5-8   | SDK loader, iframe widget, postMessage communication |
| **Phase 3: Payments**    | Weeks 9-12  | Stripe Connect, variable commission engine           |
| **Phase 4: Admin Tools** | Weeks 13-16 | Tenant provisioning UI, secrets management           |
| **Phase 5: Production**  | Weeks 17-20 | Security hardening, testing, first 2 tenants live    |
| **Phase 6: Scale**       | Weeks 21-24 | Performance optimization, scale to 10 tenants        |

---

## Phase 1: Multi-Tenant Foundation (Weeks 1-4)

### Week 1: Database Schema Evolution

#### 1.1 Add Tenant Model

**File:** `server/prisma/schema.prisma`

```prisma
// New Tenant Model
model Tenant {
  id        String   @id @default(cuid())
  slug      String   @unique // URL-safe identifier
  name      String   // Display name

  // API Authentication
  apiKeyPublic  String   @unique // pk_live_tenant_xyz
  apiKeySecret  String   // Encrypted, never sent to client

  // Commission Settings
  commissionPercent Decimal  @default(10.0) @db.Decimal(5, 2)

  // Branding Configuration
  branding Json @default("{\"primaryColor\": \"#7C3AED\", \"logo\": null}")

  // Stripe Connect
  stripeAccountId   String?  @unique
  stripeOnboarded   Boolean  @default(false)

  // Encrypted Secrets Storage
  secrets Json @default("{}") // { stripe: { ciphertext, iv, authTag } }

  // Status
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  packages   Package[]
  bookings   Booking[]
  addOns     AddOn[]
  blackouts  Blackout[]
  webhooks   WebhookEvent[]

  @@index([slug])
  @@index([apiKeyPublic])
}
```

#### 1.2 Update Existing Models with Tenant Isolation

**File:** `server/prisma/schema.prisma`

```prisma
model Package {
  id          String   @id @default(cuid())
  tenantId    String   // NEW: Tenant isolation
  slug        String
  name        String
  description String?
  price       Int
  duration    Int
  maxGuests   Int
  imageUrl    String?
  isActive    Boolean  @default(true)
  displayOrder Int     @default(0)

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  bookings    Booking[]

  @@unique([tenantId, slug]) // NEW: Composite unique constraint
  @@index([tenantId, isActive])
  @@index([tenantId, displayOrder])
}

model AddOn {
  id          String   @id @default(cuid())
  tenantId    String   // NEW: Tenant isolation
  packageId   String
  name        String
  description String?
  price       Int
  isActive    Boolean  @default(true)

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  package     Package  @relation(fields: [packageId], references: [id], onDelete: Cascade)

  @@index([tenantId, packageId])
  @@index([tenantId, isActive])
}

model Booking {
  id                String   @id @default(cuid())
  tenantId          String   // NEW: Tenant isolation
  packageId         String
  date              DateTime @db.Date
  guestName         String
  guestEmail        String
  guestCount        Int
  addOnIds          String[]
  totalPrice        Int

  // Platform Commission (NEW)
  commissionAmount  Int      @default(0) // In cents
  commissionPercent Decimal  @default(0) @db.Decimal(5, 2)

  // Payment
  stripePaymentIntentId String? @unique
  status            BookingStatus @default(PENDING)

  // Timestamps
  createdAt         DateTime @default(now())
  confirmedAt       DateTime?
  canceledAt        DateTime?

  tenant            Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  package           Package  @relation(fields: [packageId], references: [id])

  @@unique([tenantId, date]) // NEW: Composite constraint (was just @unique(date))
  @@index([tenantId, status])
  @@index([tenantId, date])
  @@index([stripePaymentIntentId])
}

model Blackout {
  id        String   @id @default(cuid())
  tenantId  String   // NEW: Tenant isolation
  date      DateTime @db.Date
  reason    String?

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, date]) // NEW: Composite constraint
  @@index([tenantId, date])
}

model WebhookEvent {
  id        String   @id @default(cuid())
  tenantId  String   // NEW: Tenant isolation
  type      String
  payload   Json
  processed Boolean  @default(false)
  createdAt DateTime @default(now())

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, processed])
  @@index([createdAt])
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELED
  REFUNDED
}
```

#### 1.3 Migration Script

**File:** `server/prisma/migrations/03_add_multi_tenancy.sql`

```sql
-- Step 1: Create Tenant table
CREATE TABLE "Tenant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "apiKeyPublic" TEXT NOT NULL UNIQUE,
  "apiKeySecret" TEXT NOT NULL,
  "commissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 10.0,
  "branding" JSONB NOT NULL DEFAULT '{"primaryColor": "#7C3AED", "logo": null}',
  "stripeAccountId" TEXT UNIQUE,
  "stripeOnboarded" BOOLEAN NOT NULL DEFAULT false,
  "secrets" JSONB NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");
CREATE INDEX "Tenant_apiKeyPublic_idx" ON "Tenant"("apiKeyPublic");

-- Step 2: Create default tenant for existing data
INSERT INTO "Tenant" (
  "id", "slug", "name", "apiKeyPublic", "apiKeySecret", "commissionPercent"
) VALUES (
  'tenant_default_legacy',
  'elope',
  'Elope (Legacy)',
  'pk_live_elope_' || substr(md5(random()::text), 1, 16),
  'sk_live_elope_' || substr(md5(random()::text), 1, 32),
  10.0
);

-- Step 3: Add tenantId columns to existing tables
ALTER TABLE "Package" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "AddOn" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "commissionAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "commissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Blackout" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "WebhookEvent" ADD COLUMN "tenantId" TEXT;

-- Step 4: Populate tenantId for existing records
UPDATE "Package" SET "tenantId" = 'tenant_default_legacy';
UPDATE "AddOn" SET "tenantId" = 'tenant_default_legacy';
UPDATE "Booking" SET "tenantId" = 'tenant_default_legacy';
UPDATE "Blackout" SET "tenantId" = 'tenant_default_legacy';
UPDATE "WebhookEvent" SET "tenantId" = 'tenant_default_legacy';

-- Step 5: Make tenantId NOT NULL
ALTER TABLE "Package" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "AddOn" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Blackout" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "WebhookEvent" ALTER COLUMN "tenantId" SET NOT NULL;

-- Step 6: Drop old unique constraints
ALTER TABLE "Package" DROP CONSTRAINT IF EXISTS "Package_slug_key";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_date_key";
ALTER TABLE "Blackout" DROP CONSTRAINT IF EXISTS "Blackout_date_key";

-- Step 7: Add composite unique constraints
ALTER TABLE "Package" ADD CONSTRAINT "Package_tenantId_slug_key" UNIQUE ("tenantId", "slug");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_date_key" UNIQUE ("tenantId", "date");
ALTER TABLE "Blackout" ADD CONSTRAINT "Blackout_tenantId_date_key" UNIQUE ("tenantId", "date");

-- Step 8: Add foreign key constraints
ALTER TABLE "Package" ADD CONSTRAINT "Package_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "AddOn" ADD CONSTRAINT "AddOn_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "Blackout" ADD CONSTRAINT "Blackout_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

-- Step 9: Add indexes
CREATE INDEX "Package_tenantId_isActive_idx" ON "Package"("tenantId", "isActive");
CREATE INDEX "Package_tenantId_displayOrder_idx" ON "Package"("tenantId", "displayOrder");
CREATE INDEX "AddOn_tenantId_packageId_idx" ON "AddOn"("tenantId", "packageId");
CREATE INDEX "AddOn_tenantId_isActive_idx" ON "AddOn"("tenantId", "isActive");
CREATE INDEX "Booking_tenantId_status_idx" ON "Booking"("tenantId", "status");
CREATE INDEX "Booking_tenantId_date_idx" ON "Booking"("tenantId", "date");
CREATE INDEX "Blackout_tenantId_date_idx" ON "Blackout"("tenantId", "date");
CREATE INDEX "WebhookEvent_tenantId_processed_idx" ON "WebhookEvent"("tenantId", "processed");
```

**Run migration:**

```bash
pnpm --filter @elope/api exec prisma migrate dev --name add_multi_tenancy
pnpm --filter @elope/api exec prisma generate
```

---

### Week 2: Tenant Resolution & Security

#### 2.1 Encryption Service for Tenant Secrets

**File:** `server/src/lib/encryption.service.ts`

```typescript
import crypto from 'node:crypto';

/**
 * Encryption service for tenant secrets (Stripe keys, etc.)
 * Uses AES-256-GCM for authenticated encryption
 *
 * SECURITY: Master encryption key MUST be stored in environment variable
 * and rotated regularly (see SECRETS_ROTATION.md)
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const masterKey = process.env.TENANT_SECRETS_ENCRYPTION_KEY;
    if (!masterKey || masterKey.length !== 64) {
      throw new Error(
        'TENANT_SECRETS_ENCRYPTION_KEY must be 64-character hex string. ' +
          'Generate with: openssl rand -hex 32'
      );
    }
    this.key = Buffer.from(masterKey, 'hex');
  }

  /**
   * Encrypt a plaintext secret
   * @returns Object with ciphertext, iv, and authTag (all hex-encoded)
   */
  encrypt(plaintext: string): EncryptedData {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt an encrypted secret
   * @throws Error if authentication fails (data tampered)
   */
  decrypt(encrypted: EncryptedData): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(encrypted.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

    let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  /**
   * Encrypt Stripe Connect secret key for database storage
   */
  encryptStripeSecret(stripeSecretKey: string): EncryptedData {
    if (!stripeSecretKey.startsWith('sk_')) {
      throw new Error('Invalid Stripe secret key format');
    }
    return this.encrypt(stripeSecretKey);
  }

  /**
   * Decrypt Stripe Connect secret key from database
   */
  decryptStripeSecret(encrypted: EncryptedData): string {
    const decrypted = this.decrypt(encrypted);
    if (!decrypted.startsWith('sk_')) {
      throw new Error('Decrypted value is not a valid Stripe secret key');
    }
    return decrypted;
  }
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
}

// Singleton instance
export const encryptionService = new EncryptionService();
```

**Environment setup:**

```bash
# Generate master encryption key (run once, store securely)
openssl rand -hex 32
```

Add to `server/.env`:

```bash
# Master encryption key for tenant secrets (64-character hex)
TENANT_SECRETS_ENCRYPTION_KEY=your_64_character_hex_key_here
```

#### 2.2 API Key Generation Service

**File:** `server/src/lib/api-key.service.ts`

```typescript
import crypto from 'node:crypto';

/**
 * Service for generating and validating tenant API keys
 *
 * Public keys (pk_live_*): Safe to embed in client-side JavaScript
 * Secret keys (sk_live_*): Server-side only, used for admin operations
 */
export class ApiKeyService {
  /**
   * Generate public API key for tenant
   * Format: pk_live_{tenant_slug}_{random_16_chars}
   *
   * @example "pk_live_bellaweddings_a3f8c9d2e1b4f7g8"
   */
  generatePublicKey(tenantSlug: string): string {
    const random = crypto.randomBytes(8).toString('hex');
    return `pk_live_${tenantSlug}_${random}`;
  }

  /**
   * Generate secret API key for tenant (admin operations)
   * Format: sk_live_{tenant_slug}_{random_32_chars}
   *
   * SECURITY: This key allows admin operations. Store hashed in database.
   */
  generateSecretKey(tenantSlug: string): string {
    const random = crypto.randomBytes(16).toString('hex');
    return `sk_live_${tenantSlug}_${random}`;
  }

  /**
   * Extract tenant slug from API key
   * @returns Tenant slug or null if invalid format
   */
  extractTenantSlug(apiKey: string): string | null {
    const match = apiKey.match(/^pk_live_([a-z0-9-]+)_[a-f0-9]{16}$/);
    return match ? match[1] : null;
  }

  /**
   * Validate API key format (does not check database)
   */
  isValidFormat(apiKey: string): boolean {
    return /^pk_live_[a-z0-9-]+_[a-f0-9]{16}$/.test(apiKey);
  }

  /**
   * Hash secret key for database storage
   * Uses SHA-256 (secret keys are high-entropy, no salt needed)
   */
  hashSecretKey(secretKey: string): string {
    return crypto.createHash('sha256').update(secretKey).digest('hex');
  }

  /**
   * Verify secret key against stored hash
   */
  verifySecretKey(secretKey: string, hash: string): boolean {
    const inputHash = this.hashSecretKey(secretKey);
    return crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(hash, 'hex'));
  }
}

export const apiKeyService = new ApiKeyService();
```

#### 2.3 Tenant Resolution Middleware

**File:** `server/src/middleware/tenant.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { apiKeyService } from '../lib/api-key.service.js';

const prisma = new PrismaClient();

/**
 * Extended Express Request with tenant context
 */
export interface TenantRequest extends Request {
  tenant?: {
    id: string;
    slug: string;
    name: string;
    commissionPercent: number;
    branding: any;
    stripeAccountId: string | null;
  };
  tenantId?: string; // Shortcut for request.tenant.id
}

/**
 * Middleware: Extract tenant from API key in header
 *
 * USAGE:
 *   Widget embedding: Client sends 'X-Tenant-Key: pk_live_tenant_xyz' header
 *   All API routes requiring tenant context should use this middleware
 *
 * SECURITY:
 *   - Validates API key format
 *   - Checks tenant exists and is active
 *   - Caches tenant lookups for 5 minutes
 */
export async function resolveTenant(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-tenant-key'] as string;

  // API key required
  if (!apiKey) {
    res.status(401).json({
      error: 'Missing X-Tenant-Key header',
      code: 'TENANT_KEY_REQUIRED',
    });
    return;
  }

  // Validate format
  if (!apiKeyService.isValidFormat(apiKey)) {
    res.status(401).json({
      error: 'Invalid API key format',
      code: 'INVALID_TENANT_KEY',
    });
    return;
  }

  try {
    // Lookup tenant by public API key
    const tenant = await prisma.tenant.findUnique({
      where: { apiKeyPublic: apiKey },
      select: {
        id: true,
        slug: true,
        name: true,
        commissionPercent: true,
        branding: true,
        stripeAccountId: true,
        isActive: true,
      },
    });

    // Tenant not found
    if (!tenant) {
      res.status(401).json({
        error: 'Invalid API key',
        code: 'TENANT_NOT_FOUND',
      });
      return;
    }

    // Tenant disabled
    if (!tenant.isActive) {
      res.status(403).json({
        error: 'Tenant account is inactive',
        code: 'TENANT_INACTIVE',
      });
      return;
    }

    // Attach tenant to request
    req.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      commissionPercent: Number(tenant.commissionPercent),
      branding: tenant.branding,
      stripeAccountId: tenant.stripeAccountId,
    };
    req.tenantId = tenant.id;

    next();
  } catch (error) {
    console.error('[Tenant Middleware] Error:', error);
    res.status(500).json({
      error: 'Failed to resolve tenant',
      code: 'TENANT_RESOLUTION_ERROR',
    });
  }
}

/**
 * Middleware: Require tenant context (use after resolveTenant)
 * Returns 401 if tenant not resolved
 */
export function requireTenant(req: TenantRequest, res: Response, next: NextFunction): void {
  if (!req.tenant || !req.tenantId) {
    res.status(401).json({
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED',
    });
    return;
  }
  next();
}
```

#### 2.4 Update Service Layer for Tenant Scoping

**File:** `server/src/services/catalog.service.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import type { PackageDTO, AddOnDTO } from '@elope/contracts';
import NodeCache from 'node-cache';

const prisma = new PrismaClient();
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

export class CatalogService {
  /**
   * Get all active packages for a tenant
   *
   * TENANT ISOLATION: Query filtered by tenantId
   * CACHE: Keyed by tenantId to prevent cross-tenant cache leaks
   */
  async getAllPackages(tenantId: string): Promise<PackageDTO[]> {
    const cacheKey = `packages:${tenantId}`;
    const cached = cache.get<PackageDTO[]>(cacheKey);
    if (cached) return cached;

    const packages = await prisma.package.findMany({
      where: {
        tenantId, // CRITICAL: Tenant isolation
        isActive: true,
      },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        duration: true,
        maxGuests: true,
        imageUrl: true,
        displayOrder: true,
      },
    });

    const dtos = packages.map(this.toPackageDTO);
    cache.set(cacheKey, dtos);
    return dtos;
  }

  /**
   * Get package by slug for a tenant
   *
   * TENANT ISOLATION: Composite query (tenantId + slug)
   */
  async getPackageBySlug(tenantId: string, slug: string): Promise<PackageDTO | null> {
    const cacheKey = `package:${tenantId}:${slug}`;
    const cached = cache.get<PackageDTO>(cacheKey);
    if (cached) return cached;

    const pkg = await prisma.package.findUnique({
      where: {
        tenantId_slug: { tenantId, slug }, // Composite unique constraint
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        duration: true,
        maxGuests: true,
        imageUrl: true,
        displayOrder: true,
      },
    });

    if (!pkg) return null;

    const dto = this.toPackageDTO(pkg);
    cache.set(cacheKey, dto);
    return dto;
  }

  /**
   * Get add-ons for a package
   *
   * TENANT ISOLATION: Query filtered by tenantId AND packageId
   */
  async getAddOnsForPackage(tenantId: string, packageId: string): Promise<AddOnDTO[]> {
    const cacheKey = `addons:${tenantId}:${packageId}`;
    const cached = cache.get<AddOnDTO[]>(cacheKey);
    if (cached) return cached;

    const addOns = await prisma.addOn.findMany({
      where: {
        tenantId, // CRITICAL: Tenant isolation
        packageId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
      },
    });

    const dtos = addOns.map(this.toAddOnDTO);
    cache.set(cacheKey, dtos);
    return dtos;
  }

  /**
   * Invalidate cache for tenant
   * Call this when packages/add-ons are created/updated/deleted
   */
  invalidateTenantCache(tenantId: string): void {
    const keys = cache.keys();
    keys.forEach((key) => {
      if (key.includes(tenantId)) {
        cache.del(key);
      }
    });
  }

  private toPackageDTO(pkg: any): PackageDTO {
    return {
      id: pkg.id,
      slug: pkg.slug,
      name: pkg.name,
      description: pkg.description,
      price: pkg.price,
      duration: pkg.duration,
      maxGuests: pkg.maxGuests,
      imageUrl: pkg.imageUrl,
      displayOrder: pkg.displayOrder,
    };
  }

  private toAddOnDTO(addOn: any): AddOnDTO {
    return {
      id: addOn.id,
      name: addOn.name,
      description: addOn.description,
      price: addOn.price,
    };
  }
}

export const catalogService = new CatalogService();
```

---

### Week 3: Update API Routes

#### 3.1 Catalog Routes with Tenant Context

**File:** `server/src/routes/catalog.routes.ts`

```typescript
import { Router } from 'express';
import { resolveTenant, requireTenant, TenantRequest } from '../middleware/tenant.js';
import { catalogService } from '../services/catalog.service.js';

const router = Router();

// Apply tenant resolution to all catalog routes
router.use(resolveTenant);
router.use(requireTenant);

/**
 * GET /api/v1/catalog/packages
 * Get all packages for tenant (identified by X-Tenant-Key header)
 */
router.get('/packages', async (req: TenantRequest, res) => {
  try {
    const packages = await catalogService.getAllPackages(req.tenantId!);
    res.json({ packages });
  } catch (error) {
    console.error('[Catalog] Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

/**
 * GET /api/v1/catalog/packages/:slug
 * Get package by slug for tenant
 */
router.get('/packages/:slug', async (req: TenantRequest, res) => {
  try {
    const { slug } = req.params;
    const pkg = await catalogService.getPackageBySlug(req.tenantId!, slug);

    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json({ package: pkg });
  } catch (error) {
    console.error('[Catalog] Error fetching package:', error);
    res.status(500).json({ error: 'Failed to fetch package' });
  }
});

/**
 * GET /api/v1/catalog/packages/:packageId/addons
 * Get add-ons for a package
 */
router.get('/packages/:packageId/addons', async (req: TenantRequest, res) => {
  try {
    const { packageId } = req.params;
    const addOns = await catalogService.getAddOnsForPackage(req.tenantId!, packageId);

    res.json({ addOns });
  } catch (error) {
    console.error('[Catalog] Error fetching add-ons:', error);
    res.status(500).json({ error: 'Failed to fetch add-ons' });
  }
});

export default router;
```

#### 3.2 Update CORS for Multi-Origin Support

**File:** `server/src/app.ts`

```typescript
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const app = express();

/**
 * Dynamic CORS configuration for embeddable widget
 *
 * Allows requests from:
 * 1. Admin dashboard (mais.com)
 * 2. Widget CDN (widget.mais.com)
 * 3. Tenant websites (validated against database)
 * 4. Localhost (development only)
 */
app.use(
  cors({
    origin: async (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Always allow admin dashboard and widget CDN
      const alwaysAllowed = [
        'https://mais.com',
        'https://www.mais.com',
        'https://admin.mais.com',
        'https://widget.mais.com',
      ];

      if (process.env.NODE_ENV === 'development') {
        alwaysAllowed.push('http://localhost:3000', 'http://localhost:5173');
      }

      if (alwaysAllowed.includes(origin)) {
        return callback(null, true);
      }

      // Check if origin is a registered tenant domain
      // TODO: Add 'allowedDomains' field to Tenant model (Phase 4)
      // For now, allow all HTTPS origins in production
      if (origin.startsWith('https://')) {
        return callback(null, true);
      }

      // Reject origin
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    exposedHeaders: ['X-Tenant-Key'],
  })
);

// Parse JSON bodies
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
import catalogRoutes from './routes/catalog.routes.js';
import availabilityRoutes from './routes/availability.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import webhooksRoutes from './routes/webhooks.routes.js';

app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/availability', availabilityRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/webhooks', webhooksRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  });
});

export default app;
```

---

### Week 4: Commission Calculation Engine

#### 4.1 Commission Service

**File:** `server/src/services/commission.service.ts`

```typescript
import { PrismaClient, Tenant } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Service for calculating platform commission on bookings
 *
 * KEY INSIGHT: Stripe Connect does NOT support `application_fee_percent`.
 * All commission amounts must be calculated server-side as fixed values.
 *
 * SECURITY: Always round UP to protect platform revenue.
 */
export class CommissionService {
  /**
   * Calculate commission for a booking
   *
   * @param tenantId - Tenant making the booking
   * @param bookingTotal - Total booking amount in cents (package + add-ons)
   * @returns Commission amount in cents
   *
   * @example
   * calculateCommission('tenant_abc', 50000) // $500.00 booking
   * // Tenant has 12% commission rate
   * // Returns: 6000 ($60.00)
   */
  async calculateCommission(
    tenantId: string,
    bookingTotal: number
  ): Promise<{ amount: number; percent: number }> {
    // Fetch tenant commission rate
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { commissionPercent: true },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const commissionPercent = Number(tenant.commissionPercent);

    // Calculate commission (always round UP)
    const commissionCents = Math.ceil(bookingTotal * (commissionPercent / 100));

    // Validate Stripe Connect limits (0.5% - 50%)
    const minCommission = Math.ceil(bookingTotal * 0.005); // 0.5%
    const maxCommission = Math.floor(bookingTotal * 0.5); // 50%

    const finalCommission = Math.max(minCommission, Math.min(maxCommission, commissionCents));

    return {
      amount: finalCommission,
      percent: commissionPercent,
    };
  }

  /**
   * Calculate commission for booking with add-ons
   *
   * @param tenantId - Tenant making the booking
   * @param packagePrice - Base package price in cents
   * @param addOnIds - Array of selected add-on IDs
   * @returns Breakdown with commission
   */
  async calculateBookingTotal(
    tenantId: string,
    packagePrice: number,
    addOnIds: string[]
  ): Promise<BookingCalculation> {
    // Fetch add-ons
    let addOnsTotal = 0;
    if (addOnIds.length > 0) {
      const addOns = await prisma.addOn.findMany({
        where: {
          tenantId, // CRITICAL: Prevent cross-tenant add-on access
          id: { in: addOnIds },
          isActive: true,
        },
        select: { id: true, price: true },
      });

      // Validate all add-ons found
      if (addOns.length !== addOnIds.length) {
        const foundIds = addOns.map((a) => a.id);
        const missingIds = addOnIds.filter((id) => !foundIds.includes(id));
        throw new Error(`Invalid add-ons: ${missingIds.join(', ')}`);
      }

      addOnsTotal = addOns.reduce((sum, addOn) => sum + addOn.price, 0);
    }

    const subtotal = packagePrice + addOnsTotal;
    const commission = await this.calculateCommission(tenantId, subtotal);

    return {
      packagePrice,
      addOnsTotal,
      subtotal,
      commissionAmount: commission.amount,
      commissionPercent: commission.percent,
      tenantReceives: subtotal - commission.amount,
    };
  }

  /**
   * Handle commission on refund
   *
   * STRIPE BEHAVIOR: When refunding via Connected Account API,
   * application fees are automatically reversed.
   *
   * This method is for record-keeping only.
   */
  calculateRefundCommission(
    originalCommission: number,
    refundAmount: number,
    originalTotal: number
  ): number {
    // Proportional commission refund
    const refundRatio = refundAmount / originalTotal;
    return Math.floor(originalCommission * refundRatio);
  }
}

export interface BookingCalculation {
  packagePrice: number; // In cents
  addOnsTotal: number; // In cents
  subtotal: number; // In cents
  commissionAmount: number; // In cents (platform fee)
  commissionPercent: number; // As decimal (e.g., 12.0)
  tenantReceives: number; // In cents (after commission)
}

export const commissionService = new CommissionService();
```

#### 4.2 Update Booking Service with Commission

**File:** `server/src/services/booking.service.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { commissionService } from './commission.service.js';
import type { CreateBookingDTO, BookingDTO } from '@elope/contracts';

const prisma = new PrismaClient();

export class BookingService {
  /**
   * Create booking with commission calculation
   *
   * CRITICAL: Uses SERIALIZABLE transaction + FOR UPDATE NOWAIT
   * to prevent double-booking race conditions
   */
  async createBooking(tenantId: string, data: CreateBookingDTO): Promise<BookingDTO> {
    return await prisma.$transaction(
      async (tx) => {
        // Step 1: Validate package exists and is active
        const pkg = await tx.package.findUnique({
          where: {
            tenantId_slug: { tenantId, slug: data.packageSlug },
          },
          select: { id: true, price: true, isActive: true },
        });

        if (!pkg || !pkg.isActive) {
          throw new Error('Package not found or inactive');
        }

        // Step 2: Check availability (lock row to prevent race condition)
        const existing = await tx.booking.findUnique({
          where: {
            tenantId_date: { tenantId, date: new Date(data.date) },
          },
          // FOR UPDATE NOWAIT: If locked, fail immediately
          // (another transaction is creating booking for this date)
        });

        if (existing) {
          throw new Error('Date already booked');
        }

        // Step 3: Check blackout
        const blackout = await tx.blackout.findUnique({
          where: {
            tenantId_date: { tenantId, date: new Date(data.date) },
          },
        });

        if (blackout) {
          throw new Error(`Date unavailable: ${blackout.reason || 'Blackout'}`);
        }

        // Step 4: Calculate total with commission
        const calculation = await commissionService.calculateBookingTotal(
          tenantId,
          pkg.price,
          data.addOnIds || []
        );

        // Step 5: Create booking record
        const booking = await tx.booking.create({
          data: {
            tenantId,
            packageId: pkg.id,
            date: new Date(data.date),
            guestName: data.guestName,
            guestEmail: data.guestEmail,
            guestCount: data.guestCount,
            addOnIds: data.addOnIds || [],
            totalPrice: calculation.subtotal,
            commissionAmount: calculation.commissionAmount,
            commissionPercent: calculation.commissionPercent,
            status: 'PENDING',
          },
          select: {
            id: true,
            date: true,
            guestName: true,
            guestEmail: true,
            guestCount: true,
            totalPrice: true,
            commissionAmount: true,
            status: true,
            package: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        });

        return {
          id: booking.id,
          packageName: booking.package.name,
          packageSlug: booking.package.slug,
          date: booking.date.toISOString(),
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          guestCount: booking.guestCount,
          totalPrice: booking.totalPrice,
          commissionAmount: booking.commissionAmount,
          status: booking.status,
        };
      },
      {
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 10000,
      }
    );
  }

  // ... rest of booking service methods
}

export const bookingService = new BookingService();
```

---

## Phase 2: Embeddable Widget Core (Weeks 5-8)

### Week 5: JavaScript SDK Loader

#### 5.1 SDK Loader Script

**File:** `client/public/mais-sdk.js`

```javascript
/**
 * MAIS Embeddable Widget SDK
 *
 * Usage:
 * <script src="https://widget.mais.com/sdk/mais-sdk.js"
 *         data-tenant="bellaweddings"
 *         data-api-key="pk_live_bellaweddings_a3f8c9d2e1b4f7g8">
 * </script>
 * <div id="mais-widget"></div>
 *
 * Lightweight loader (<3KB gzipped) that:
 * 1. Creates iframe with widget application
 * 2. Handles postMessage communication
 * 3. Auto-resizes iframe based on content
 * 4. Applies tenant branding
 */

(function () {
  'use strict';

  // Get current script tag for configuration
  const currentScript = document.currentScript;
  if (!currentScript) {
    console.error('[MAIS SDK] document.currentScript not supported');
    return;
  }

  // Extract configuration
  const config = {
    tenant: currentScript.getAttribute('data-tenant'),
    apiKey: currentScript.getAttribute('data-api-key'),
    containerId: currentScript.getAttribute('data-container') || 'mais-widget',
    mode: currentScript.getAttribute('data-mode') || 'embedded', // or 'modal'
  };

  // Validate configuration
  if (!config.tenant || !config.apiKey) {
    console.error('[MAIS SDK] Missing required attributes: data-tenant, data-api-key');
    return;
  }

  // API key format validation
  if (!config.apiKey.match(/^pk_live_[a-z0-9-]+_[a-f0-9]{16}$/)) {
    console.error('[MAIS SDK] Invalid API key format');
    return;
  }

  // Widget environment
  const widgetBaseUrl = currentScript.src.includes('localhost')
    ? 'http://localhost:5173'
    : 'https://widget.mais.com';

  /**
   * MAIS Widget Client
   */
  class MAISWidget {
    constructor(config) {
      this.config = config;
      this.iframe = null;
      this.container = null;
      this.loaded = false;
      this.messageHandlers = {};
    }

    /**
     * Initialize widget
     */
    init() {
      // Find container
      this.container = document.getElementById(this.config.containerId);
      if (!this.container) {
        console.error(`[MAIS SDK] Container not found: #${this.config.containerId}`);
        return;
      }

      // Create iframe
      this.iframe = document.createElement('iframe');
      this.iframe.src = this.buildWidgetUrl();
      this.iframe.style.cssText = `
        width: 100%;
        border: none;
        display: block;
        min-height: 600px;
        background: transparent;
      `;
      this.iframe.setAttribute('scrolling', 'no');
      this.iframe.setAttribute('title', 'MAIS Wedding Booking Widget');

      // Setup message listener BEFORE appending iframe
      window.addEventListener('message', this.handleMessage.bind(this));

      // Append iframe
      this.container.appendChild(this.iframe);

      console.log('[MAIS SDK] Widget initialized:', this.config.tenant);
    }

    /**
     * Build widget iframe URL
     */
    buildWidgetUrl() {
      const params = new URLSearchParams({
        tenant: this.config.tenant,
        apiKey: this.config.apiKey,
        mode: this.config.mode,
        parentOrigin: window.location.origin,
      });
      return `${widgetBaseUrl}?${params.toString()}`;
    }

    /**
     * Handle postMessage from iframe
     */
    handleMessage(event) {
      // SECURITY: Validate origin
      if (event.origin !== widgetBaseUrl) {
        return;
      }

      const message = event.data;

      // Validate message format
      if (!message || message.source !== 'mais-widget') {
        return;
      }

      // Handle message types
      switch (message.type) {
        case 'READY':
          this.loaded = true;
          console.log('[MAIS SDK] Widget loaded');
          this.emit('ready');
          break;

        case 'RESIZE':
          // Auto-resize iframe based on content height
          if (this.iframe && message.height) {
            this.iframe.style.height = `${message.height}px`;
          }
          break;

        case 'BOOKING_CREATED':
          console.log('[MAIS SDK] Booking created:', message.bookingId);
          this.emit('bookingCreated', message);
          break;

        case 'BOOKING_COMPLETED':
          console.log('[MAIS SDK] Booking completed:', message.bookingId);
          this.emit('bookingCompleted', message);

          // Optional: Redirect to success page
          if (message.returnUrl) {
            window.location.href = message.returnUrl;
          }
          break;

        case 'ERROR':
          console.error('[MAIS SDK] Widget error:', message.error);
          this.emit('error', message);
          break;

        default:
          console.warn('[MAIS SDK] Unknown message type:', message.type);
      }
    }

    /**
     * Send message to iframe
     */
    sendMessage(type, data = {}) {
      if (!this.iframe || !this.iframe.contentWindow) {
        console.warn('[MAIS SDK] Widget not ready');
        return;
      }

      this.iframe.contentWindow.postMessage(
        {
          source: 'mais-parent',
          type,
          ...data,
        },
        widgetBaseUrl
      );
    }

    /**
     * Event emitter
     */
    on(event, handler) {
      if (!this.messageHandlers[event]) {
        this.messageHandlers[event] = [];
      }
      this.messageHandlers[event].push(handler);
    }

    emit(event, data) {
      const handlers = this.messageHandlers[event] || [];
      handlers.forEach((handler) => handler(data));
    }

    /**
     * Public API: Open booking modal
     */
    openBooking(packageSlug) {
      this.sendMessage('OPEN_BOOKING', { packageSlug });
    }

    /**
     * Public API: Close modal
     */
    close() {
      this.sendMessage('CLOSE');
    }

    /**
     * Public API: Destroy widget
     */
    destroy() {
      window.removeEventListener('message', this.handleMessage.bind(this));
      if (this.container && this.iframe) {
        this.container.removeChild(this.iframe);
      }
      this.iframe = null;
      this.loaded = false;
    }
  }

  // Create widget instance
  const widget = new MAISWidget(config);

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => widget.init());
  } else {
    widget.init();
  }

  // Expose global API
  window.MAISWidget = widget;
})();
```

**Deployment:**

1. Build as standalone script (no bundler dependencies)
2. Deploy to CDN: `https://widget.mais.com/sdk/mais-sdk.js`
3. Add to Vercel as static file with cache headers

**Vercel configuration** (`client/vercel.json`):

```json
{
  "headers": [
    {
      "source": "/sdk/mais-sdk.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        },
        {
          "key": "Content-Type",
          "value": "application/javascript; charset=utf-8"
        }
      ]
    }
  ]
}
```

---

### Week 6: Widget Application (iframe content)

#### 6.1 Widget Entry Point

**File:** `client/src/widget-main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { WidgetApp } from './widget/WidgetApp';
import './index.css';

/**
 * Widget application entry point
 *
 * This is loaded inside an iframe by the SDK loader.
 * Receives configuration via URL parameters.
 */

// Extract configuration from URL
const params = new URLSearchParams(window.location.search);
const widgetConfig = {
  tenant: params.get('tenant'),
  apiKey: params.get('apiKey'),
  mode: params.get('mode') || 'embedded',
  parentOrigin: params.get('parentOrigin'),
};

// Validate configuration
if (!widgetConfig.tenant || !widgetConfig.apiKey) {
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #EF4444;">
      <h3>Widget Configuration Error</h3>
      <p>Missing required parameters: tenant, apiKey</p>
    </div>
  `;
  throw new Error('[Widget] Missing required configuration');
}

// Render widget
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WidgetApp config={widgetConfig} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

#### 6.2 Widget Application Component

**File:** `client/src/widget/WidgetApp.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetMessenger } from './WidgetMessenger';
import { CatalogGrid } from '../features/catalog/CatalogGrid';
import { PackagePage } from '../features/catalog/PackagePage';
import { api } from '../lib/api';
import type { PackageDTO, TenantBrandingDTO } from '@elope/contracts';

interface WidgetConfig {
  tenant: string;
  apiKey: string;
  mode: 'embedded' | 'modal';
  parentOrigin: string | null;
}

interface Props {
  config: WidgetConfig;
}

/**
 * Main widget application
 *
 * Responsibilities:
 * 1. Fetch tenant branding and apply CSS variables
 * 2. Fetch catalog packages
 * 3. Handle navigation (catalog → package → booking)
 * 4. Auto-resize iframe via postMessage
 * 5. Send booking events to parent window
 */
export function WidgetApp({ config }: Props) {
  const [currentView, setCurrentView] = useState<'catalog' | 'package'>('catalog');
  const [selectedPackageSlug, setSelectedPackageSlug] = useState<string | null>(null);
  const messenger = WidgetMessenger.getInstance(config.parentOrigin || '*');

  // Configure API client with tenant context
  useEffect(() => {
    api.setTenantKey(config.apiKey);
  }, [config.apiKey]);

  // Fetch tenant branding
  const { data: branding } = useQuery({
    queryKey: ['tenant', 'branding', config.tenant],
    queryFn: async () => {
      const response = await api.get<{ branding: TenantBrandingDTO }>(
        '/api/v1/tenant/branding'
      );
      return response.branding;
    },
  });

  // Apply branding CSS variables
  useEffect(() => {
    if (branding) {
      document.documentElement.style.setProperty(
        '--primary-color',
        branding.primaryColor || '#7C3AED'
      );
      document.documentElement.style.setProperty(
        '--font-family',
        branding.fontFamily || 'Inter, sans-serif'
      );
    }
  }, [branding]);

  // Notify parent that widget is ready
  useEffect(() => {
    messenger.sendReady();
  }, []);

  // Auto-resize iframe when content changes
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const height = document.body.scrollHeight;
      messenger.sendResize(height);
    });

    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  // Listen for messages from parent
  useEffect(() => {
    const handleParentMessage = (event: MessageEvent) => {
      if (event.data.source !== 'mais-parent') return;

      switch (event.data.type) {
        case 'OPEN_BOOKING':
          setSelectedPackageSlug(event.data.packageSlug);
          setCurrentView('package');
          break;
        case 'CLOSE':
          setCurrentView('catalog');
          setSelectedPackageSlug(null);
          break;
      }
    };

    window.addEventListener('message', handleParentMessage);
    return () => window.removeEventListener('message', handleParentMessage);
  }, []);

  // Render current view
  return (
    <div className="mais-widget min-h-screen bg-gray-50 p-4">
      {currentView === 'catalog' && (
        <CatalogGrid
          onPackageClick={(slug) => {
            setSelectedPackageSlug(slug);
            setCurrentView('package');
          }}
        />
      )}

      {currentView === 'package' && selectedPackageSlug && (
        <PackagePage
          packageSlug={selectedPackageSlug}
          onBack={() => {
            setCurrentView('catalog');
            setSelectedPackageSlug(null);
          }}
          onBookingComplete={(bookingId) => {
            messenger.sendBookingCompleted(bookingId);
          }}
        />
      )}
    </div>
  );
}
```

#### 6.3 Widget Messenger (postMessage wrapper)

**File:** `client/src/widget/WidgetMessenger.ts`

```typescript
/**
 * Widget postMessage communication service
 *
 * SECURITY: Always validates parent origin before sending messages
 */
export class WidgetMessenger {
  private static instance: WidgetMessenger;
  private parentOrigin: string;

  private constructor(parentOrigin: string) {
    this.parentOrigin = parentOrigin;
  }

  static getInstance(parentOrigin: string): WidgetMessenger {
    if (!WidgetMessenger.instance) {
      WidgetMessenger.instance = new WidgetMessenger(parentOrigin);
    }
    return WidgetMessenger.instance;
  }

  /**
   * Send message to parent window
   * SECURITY: Never use '*' as target origin in production
   */
  private sendToParent(type: string, data: any = {}): void {
    if (!window.parent) return;

    // ✅ SECURE: Explicit target origin (never '*' in production)
    const targetOrigin =
      this.parentOrigin === '*'
        ? '*' // Only for development
        : this.parentOrigin;

    window.parent.postMessage(
      {
        source: 'mais-widget',
        type,
        ...data,
      },
      targetOrigin
    );
  }

  /**
   * Notify parent that widget is loaded and ready
   */
  sendReady(): void {
    this.sendToParent('READY', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Request iframe resize
   */
  sendResize(height: number): void {
    this.sendToParent('RESIZE', { height });
  }

  /**
   * Notify parent that booking was created (pending payment)
   */
  sendBookingCreated(bookingId: string): void {
    this.sendToParent('BOOKING_CREATED', {
      bookingId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify parent that booking was completed (payment successful)
   */
  sendBookingCompleted(bookingId: string, returnUrl?: string): void {
    this.sendToParent('BOOKING_COMPLETED', {
      bookingId,
      returnUrl,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send error to parent
   */
  sendError(error: string, code?: string): void {
    this.sendToParent('ERROR', {
      error,
      code,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

### Week 7: Tenant Branding API

#### 7.1 Branding DTO

**File:** `packages/contracts/src/dto.ts`

```typescript
/**
 * Tenant branding configuration
 * Sent to widget for dynamic theming
 */
export interface TenantBrandingDTO {
  primaryColor: string; // Hex color (e.g., '#7C3AED')
  secondaryColor?: string;
  logo?: string; // URL to logo image
  fontFamily?: string; // CSS font-family
  customCss?: string; // Advanced: Custom CSS overrides
}
```

#### 7.2 Branding Route

**File:** `server/src/routes/tenant.routes.ts`

```typescript
import { Router } from 'express';
import { resolveTenant, requireTenant, TenantRequest } from '../middleware/tenant.js';

const router = Router();

router.use(resolveTenant);
router.use(requireTenant);

/**
 * GET /api/v1/tenant/branding
 * Get branding configuration for widget theming
 */
router.get('/branding', async (req: TenantRequest, res) => {
  try {
    const branding = req.tenant!.branding;
    res.json({ branding });
  } catch (error) {
    console.error('[Tenant] Error fetching branding:', error);
    res.status(500).json({ error: 'Failed to fetch branding' });
  }
});

export default router;
```

**Register route in `server/src/app.ts`:**

```typescript
import tenantRoutes from './routes/tenant.routes.js';
app.use('/api/v1/tenant', tenantRoutes);
```

---

### Week 8: Integration Testing

#### 8.1 Test Page for Widget

**File:** `client/public/test-embed.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MAIS Widget Test Page</title>
    <style>
      body {
        font-family:
          system-ui,
          -apple-system,
          sans-serif;
        max-width: 1200px;
        margin: 0 auto;
        padding: 40px 20px;
        background: #f9fafb;
      }
      h1 {
        color: #111827;
        margin-bottom: 8px;
      }
      p {
        color: #6b7280;
        margin-bottom: 32px;
      }
      .widget-container {
        background: white;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .console {
        margin-top: 32px;
        padding: 16px;
        background: #1f2937;
        color: #10b981;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        border-radius: 8px;
        max-height: 300px;
        overflow-y: auto;
      }
      .console-entry {
        margin: 4px 0;
      }
    </style>
  </head>
  <body>
    <h1>MAIS Widget Integration Test</h1>
    <p>Testing embeddable widget for tenant: <strong>Bella Weddings</strong></p>

    <!-- Widget Container -->
    <div class="widget-container">
      <div id="mais-widget"></div>
    </div>

    <!-- Console Log -->
    <div class="console" id="console">
      <div class="console-entry">[Test Page] Loading MAIS SDK...</div>
    </div>

    <!-- MAIS SDK -->
    <script
      src="http://localhost:5173/sdk/mais-sdk.js"
      data-tenant="bellaweddings"
      data-api-key="pk_live_bellaweddings_test123456"
    ></script>

    <!-- Event Listeners -->
    <script>
      const consoleEl = document.getElementById('console');

      function log(message, data) {
        const entry = document.createElement('div');
        entry.className = 'console-entry';
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        if (data) {
          entry.textContent += ': ' + JSON.stringify(data);
        }
        consoleEl.appendChild(entry);
        consoleEl.scrollTop = consoleEl.scrollHeight;
      }

      // Wait for widget to load
      setTimeout(() => {
        if (window.MAISWidget) {
          log('Widget API available');

          // Listen for events
          window.MAISWidget.on('ready', () => {
            log('✓ Widget loaded successfully');
          });

          window.MAISWidget.on('bookingCreated', (data) => {
            log('✓ Booking created', { bookingId: data.bookingId });
          });

          window.MAISWidget.on('bookingCompleted', (data) => {
            log('✓ Booking completed', { bookingId: data.bookingId });
            alert('Booking completed! ID: ' + data.bookingId);
          });

          window.MAISWidget.on('error', (data) => {
            log('✗ Error', { error: data.error, code: data.code });
          });
        } else {
          log('✗ Widget API not available');
        }
      }, 1000);
    </script>
  </body>
</html>
```

**Test in browser:**

```bash
# Start widget dev server
cd client
pnpm run dev

# Open test page
open http://localhost:5173/test-embed.html
```

---

## Phase 3: Stripe Connect & Payments (Weeks 9-12)

### Week 9: Stripe Connect Onboarding

#### 9.1 Stripe Connect Service

**File:** `server/src/services/stripe-connect.service.ts`

```typescript
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { encryptionService } from '../lib/encryption.service.js';

const prisma = new PrismaClient();

/**
 * Service for managing Stripe Connect accounts (tenant payment processing)
 *
 * ARCHITECTURE: Each tenant gets their own Stripe Express Connected Account
 * - Tenant receives payments directly to their bank account
 * - Platform deducts commission via application_fee_amount
 * - Platform is responsible for refunds and chargebacks
 */
export class StripeConnectService {
  private stripe: Stripe;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    this.stripe = new Stripe(apiKey, { apiVersion: '2024-11-20.acacia' });
  }

  /**
   * Create Stripe Connect Express account for tenant
   *
   * EXPRESS ACCOUNT: Stripe handles onboarding, compliance, payouts
   * Platform controls customer experience
   */
  async createConnectedAccount(
    tenantId: string,
    email: string,
    businessName: string,
    country: string = 'US'
  ): Promise<string> {
    // Create Stripe account
    const account = await this.stripe.accounts.create({
      type: 'express',
      country,
      email,
      business_type: 'individual', // or 'company'
      business_profile: {
        name: businessName,
        product_description: 'Wedding and event booking services',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Store account ID
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        stripeAccountId: account.id,
        stripeOnboarded: false, // Will be true after completing onboarding
      },
    });

    console.log(`[Stripe Connect] Created account ${account.id} for tenant ${tenantId}`);
    return account.id;
  }

  /**
   * Generate Stripe Connect onboarding link
   * Tenant completes onboarding in Stripe-hosted flow
   */
  async createOnboardingLink(
    tenantId: string,
    refreshUrl: string,
    returnUrl: string
  ): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeAccountId: true },
    });

    if (!tenant?.stripeAccountId) {
      throw new Error('Tenant does not have a Stripe account');
    }

    const accountLink = await this.stripe.accountLinks.create({
      account: tenant.stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return accountLink.url;
  }

  /**
   * Check if tenant has completed Stripe onboarding
   * Updates tenant.stripeOnboarded in database
   */
  async checkOnboardingStatus(tenantId: string): Promise<boolean> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeAccountId: true },
    });

    if (!tenant?.stripeAccountId) {
      return false;
    }

    const account = await this.stripe.accounts.retrieve(tenant.stripeAccountId);

    // Check if charges are enabled (onboarding complete)
    const isOnboarded = account.charges_enabled === true;

    // Update database
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { stripeOnboarded: isOnboarded },
    });

    return isOnboarded;
  }

  /**
   * Store encrypted Stripe restricted API key for tenant
   *
   * SECURITY: Restricted keys are stored encrypted in database
   * Used for creating payment intents on tenant's behalf
   */
  async storeRestrictedKey(tenantId: string, restrictedKey: string): Promise<void> {
    const encrypted = encryptionService.encryptStripeSecret(restrictedKey);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        secrets: {
          stripe: encrypted,
        },
      },
    });

    console.log(`[Stripe Connect] Stored encrypted key for tenant ${tenantId}`);
  }

  /**
   * Retrieve decrypted Stripe restricted key for tenant
   */
  async getRestrictedKey(tenantId: string): Promise<string | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { secrets: true },
    });

    if (!tenant || !tenant.secrets) return null;

    const secrets = tenant.secrets as any;
    if (!secrets.stripe) return null;

    return encryptionService.decryptStripeSecret(secrets.stripe);
  }
}

export const stripeConnectService = new StripeConnectService();
```

---

### Week 10: Payment Intent with Commission

#### 10.1 Update Booking Service for Stripe

**File:** `server/src/services/booking.service.ts` (additions)

```typescript
import Stripe from 'stripe';
import { stripeConnectService } from './stripe-connect.service.js';

export class BookingService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-11-20.acacia',
    });
  }

  /**
   * Create Stripe PaymentIntent with platform commission
   *
   * CRITICAL: Uses Connected Account API
   * - Payment goes to tenant's Stripe account
   * - Platform takes commission via application_fee_amount
   * - Tenant sees (totalPrice - commission) in their balance
   */
  async createPaymentIntent(
    tenantId: string,
    bookingId: string
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    // Fetch booking with commission calculation
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        totalPrice: true,
        commissionAmount: true,
        tenantId: true,
        tenant: {
          select: {
            stripeAccountId: true,
            stripeOnboarded: true,
          },
        },
      },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.tenantId !== tenantId) {
      throw new Error('Booking does not belong to tenant');
    }

    if (!booking.tenant.stripeAccountId || !booking.tenant.stripeOnboarded) {
      throw new Error('Tenant Stripe account not configured');
    }

    // Create PaymentIntent on behalf of Connected Account
    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: booking.totalPrice,
        currency: 'usd',
        application_fee_amount: booking.commissionAmount,
        metadata: {
          bookingId: booking.id,
          tenantId: booking.tenantId,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      },
      {
        stripeAccount: booking.tenant.stripeAccountId,
      }
    );

    // Update booking with PaymentIntent ID
    await prisma.booking.update({
      where: { id: bookingId },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Handle successful payment webhook
   * Called by Stripe webhook handler
   */
  async confirmBooking(paymentIntentId: string): Promise<void> {
    const booking = await prisma.booking.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!booking) {
      throw new Error('Booking not found for PaymentIntent');
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    console.log(`[Booking] Confirmed booking ${booking.id}`);
  }

  /**
   * Refund booking
   * Automatically reverses application fee
   */
  async refundBooking(bookingId: string, reason: string = 'requested_by_customer'): Promise<void> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        stripePaymentIntentId: true,
        status: true,
        tenant: {
          select: { stripeAccountId: true },
        },
      },
    });

    if (!booking || !booking.stripePaymentIntentId) {
      throw new Error('Booking not found or payment not processed');
    }

    if (booking.status === 'REFUNDED') {
      throw new Error('Booking already refunded');
    }

    // Create refund (automatically reverses application fee)
    await this.stripe.refunds.create(
      {
        payment_intent: booking.stripePaymentIntentId,
        reason,
      },
      {
        stripeAccount: booking.tenant.stripeAccountId!,
      }
    );

    // Update booking status
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'REFUNDED',
      },
    });

    console.log(`[Booking] Refunded booking ${bookingId}`);
  }
}
```

---

### Week 11: Webhook Handler

#### 11.1 Stripe Webhook Endpoint

**File:** `server/src/routes/webhooks.routes.ts`

```typescript
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { bookingService } from '../services/booking.service.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

/**
 * POST /api/v1/webhooks/stripe
 *
 * Stripe webhook endpoint for payment events
 * SECURITY: Validates webhook signature
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).send('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('[Webhook] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle event
    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await bookingService.confirmBooking(paymentIntent.id);
          console.log(`[Webhook] Payment succeeded: ${paymentIntent.id}`);
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.error(`[Webhook] Payment failed: ${paymentIntent.id}`);
          // TODO: Send notification to user
          break;
        }

        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          console.log(`[Webhook] Charge refunded: ${charge.id}`);
          // Status updated by refundBooking() method
          break;
        }

        default:
          console.log(`[Webhook] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('[Webhook] Error processing event:', error);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }
);

export default router;
```

**Configure webhook in Stripe Dashboard:**

1. Go to Developers → Webhooks
2. Add endpoint: `https://api.mais.com/api/v1/webhooks/stripe`
3. Listen to events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copy webhook signing secret to `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

---

### Week 12: Integration Testing with Stripe

#### 12.1 Stripe Test Mode Configuration

**File:** `server/.env.example`

```bash
# Stripe API Keys (Test Mode)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# Stripe Connect Platform Fee (fallback if tenant commission not set)
DEFAULT_COMMISSION_PERCENT=10.0
```

#### 12.2 Test Script: Create Test Tenant with Stripe

**File:** `server/scripts/create-test-tenant.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { apiKeyService } from '../src/lib/api-key.service.js';
import { stripeConnectService } from '../src/services/stripe-connect.service.js';

const prisma = new PrismaClient();

async function main() {
  const slug = 'bellaweddings';
  const name = 'Bella Weddings';
  const email = 'bella@example.com';

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name,
      apiKeyPublic: apiKeyService.generatePublicKey(slug),
      apiKeySecret: apiKeyService.hashSecretKey(apiKeyService.generateSecretKey(slug)),
      commissionPercent: 12.5,
      branding: {
        primaryColor: '#EC4899',
        logo: null,
      },
    },
  });

  console.log('✓ Created tenant:', tenant.id);
  console.log('  API Key:', tenant.apiKeyPublic);

  // Create Stripe Connect account
  const stripeAccountId = await stripeConnectService.createConnectedAccount(tenant.id, email, name);

  console.log('✓ Created Stripe account:', stripeAccountId);

  // Generate onboarding link
  const onboardingUrl = await stripeConnectService.createOnboardingLink(
    tenant.id,
    'http://localhost:3000/admin/stripe/refresh',
    'http://localhost:3000/admin/stripe/return'
  );

  console.log('\n🔗 Onboarding URL:');
  console.log(onboardingUrl);
  console.log('\nOpen this URL to complete Stripe Connect onboarding.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run:**

```bash
pnpm --filter @elope/api exec tsx scripts/create-test-tenant.ts
```

---

## Phase 4: Admin Provisioning Tools (Weeks 13-16)

### Week 13: Admin Dashboard - Tenant Management

#### 13.1 Admin Auth Middleware

**File:** `server/src/middleware/admin-auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AdminRequest extends Request {
  admin?: {
    id: string;
    email: string;
  };
}

/**
 * Middleware: Require admin authentication
 *
 * SECURITY: Admin JWT includes 'role: admin' claim
 * Only platform administrators can access these routes
 */
export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as any;

    // Check admin role
    if (decoded.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    req.admin = {
      id: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid admin token' });
  }
}
```

#### 13.2 Admin Tenant Routes

**File:** `server/src/routes/admin/tenants.routes.ts`

```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin, AdminRequest } from '../../middleware/admin-auth.js';
import { apiKeyService } from '../../lib/api-key.service.js';
import { stripeConnectService } from '../../services/stripe-connect.service.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

/**
 * GET /api/v1/admin/tenants
 * List all tenants
 */
router.get('/', async (req: AdminRequest, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        apiKeyPublic: true,
        commissionPercent: true,
        stripeOnboarded: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            bookings: true,
            packages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ tenants });
  } catch (error) {
    console.error('[Admin] Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

/**
 * POST /api/v1/admin/tenants
 * Create new tenant
 */
router.post('/', async (req: AdminRequest, res) => {
  try {
    const { slug, name, email, commissionPercent, branding } = req.body;

    // Validate
    if (!slug || !name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check slug uniqueness
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      return res.status(409).json({ error: 'Tenant slug already exists' });
    }

    // Generate API keys
    const apiKeyPublic = apiKeyService.generatePublicKey(slug);
    const apiKeySecret = apiKeyService.generateSecretKey(slug);
    const apiKeySecretHash = apiKeyService.hashSecretKey(apiKeySecret);

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name,
        apiKeyPublic,
        apiKeySecret: apiKeySecretHash,
        commissionPercent: commissionPercent || 10.0,
        branding: branding || {},
      },
    });

    // Create Stripe Connect account
    const stripeAccountId = await stripeConnectService.createConnectedAccount(
      tenant.id,
      email,
      name
    );

    // Generate onboarding link
    const onboardingUrl = await stripeConnectService.createOnboardingLink(
      tenant.id,
      `${process.env.ADMIN_URL}/tenants/${tenant.id}/stripe/refresh`,
      `${process.env.ADMIN_URL}/tenants/${tenant.id}/stripe/complete`
    );

    res.status(201).json({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        apiKeyPublic: tenant.apiKeyPublic,
        apiKeySecret, // IMPORTANT: Only returned once at creation
        stripeAccountId,
        stripeOnboardingUrl: onboardingUrl,
      },
    });
  } catch (error) {
    console.error('[Admin] Error creating tenant:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

/**
 * PATCH /api/v1/admin/tenants/:id
 * Update tenant configuration
 */
router.patch('/:id', async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const { commissionPercent, branding, isActive } = req.body;

    const updates: any = {};
    if (commissionPercent !== undefined) updates.commissionPercent = commissionPercent;
    if (branding !== undefined) updates.branding = branding;
    if (isActive !== undefined) updates.isActive = isActive;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        slug: true,
        name: true,
        commissionPercent: true,
        branding: true,
        isActive: true,
      },
    });

    res.json({ tenant });
  } catch (error) {
    console.error('[Admin] Error updating tenant:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

/**
 * GET /api/v1/admin/tenants/:id/stats
 * Get tenant statistics
 */
router.get('/:id/stats', async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;

    const [bookingStats, revenueStats] = await Promise.all([
      // Booking counts by status
      prisma.booking.groupBy({
        by: ['status'],
        where: { tenantId: id },
        _count: true,
      }),

      // Revenue totals
      prisma.booking.aggregate({
        where: {
          tenantId: id,
          status: 'CONFIRMED',
        },
        _sum: {
          totalPrice: true,
          commissionAmount: true,
        },
      }),
    ]);

    res.json({
      stats: {
        bookings: {
          total: bookingStats.reduce((sum, s) => sum + s._count, 0),
          byStatus: bookingStats,
        },
        revenue: {
          totalBookings: revenueStats._sum.totalPrice || 0,
          platformCommission: revenueStats._sum.commissionAmount || 0,
          tenantReceived:
            (revenueStats._sum.totalPrice || 0) - (revenueStats._sum.commissionAmount || 0),
        },
      },
    });
  } catch (error) {
    console.error('[Admin] Error fetching tenant stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
```

**Register in `server/src/app.ts`:**

```typescript
import adminTenantsRoutes from './routes/admin/tenants.routes.js';
app.use('/api/v1/admin/tenants', adminTenantsRoutes);
```

---

### Week 14: Admin UI - Tenant List

**File:** `client/src/features/admin/TenantList.tsx`

```typescript
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  apiKeyPublic: string;
  commissionPercent: number;
  stripeOnboarded: boolean;
  isActive: boolean;
  createdAt: string;
  _count: {
    bookings: number;
    packages: number;
  };
}

export function TenantList() {
  const queryClient = useQueryClient();

  // Fetch tenants
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: async () => {
      const response = await api.get<{ tenants: Tenant[] }>('/api/v1/admin/tenants');
      return response.tenants;
    },
  });

  // Toggle tenant active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/api/v1/admin/tenants/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading tenants...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Tenants</h1>
        <button
          onClick={() => {/* TODO: Open create modal */}}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          + Create Tenant
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Name
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Slug
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Commission
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Bookings
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Stripe
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Status
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data?.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{tenant.name}</div>
                  <div className="text-sm text-gray-500">{tenant.apiKeyPublic}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {tenant.slug}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {tenant.commissionPercent}%
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {tenant._count.bookings}
                </td>
                <td className="px-6 py-4">
                  {tenant.stripeOnboarded ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {tenant.isActive ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleActiveMutation.mutate({
                      id: tenant.id,
                      isActive: !tenant.isActive,
                    })}
                    className="text-sm text-purple-600 hover:text-purple-800"
                  >
                    {tenant.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

### Weeks 15-16: Admin Tools (Commission Editor, Branding Manager)

_(Content truncated for space - full implementation follows same patterns)_

---

## Phase 5: Production Hardening (Weeks 17-20)

### Security Checklist

- [ ] CSP headers configured with `frame-ancestors` whitelist
- [ ] postMessage origin validation (never `'*'` in production)
- [ ] CORS configured for known tenant domains
- [ ] API rate limiting (express-rate-limit)
- [ ] Encrypted tenant secrets with key rotation
- [ ] Stripe webhook signature validation
- [ ] SQL injection prevention (Prisma parameterized queries)
- [ ] Admin auth with JWT expiration
- [ ] HTTPS enforced (Render/Vercel handle SSL)

### Performance Optimization

- [ ] PostgreSQL indexes on `tenantId` columns
- [ ] NodeCache for catalog queries (5-minute TTL)
- [ ] React Query caching on client
- [ ] Stripe API request deduplication
- [ ] Database connection pooling (Supabase)
- [ ] Widget SDK CDN caching (Vercel Edge)

### Monitoring

- [ ] Sentry error tracking
- [ ] Stripe Dashboard for payment monitoring
- [ ] Database query performance tracking
- [ ] API endpoint latency monitoring

---

## Phase 6: Scale to 10 Tenants (Weeks 21-24)

### Tenant Onboarding Checklist

For each new tenant:

1. **Admin creates tenant** (Admin UI)
   - Name, slug, email
   - Set commission percentage
   - Upload logo, set primary color

2. **Stripe Connect onboarding**
   - Send onboarding link to tenant
   - Tenant completes KYC/banking info
   - Verify `stripeOnboarded: true`

3. **Catalog setup**
   - Create packages (3-5)
   - Create add-ons per package (2-4 each)
   - Upload package images

4. **Widget integration**
   - Provide tenant with SDK snippet:
     ```html
     <script
       src="https://widget.mais.com/sdk/mais-sdk.js"
       data-tenant="TENANT_SLUG"
       data-api-key="pk_live_TENANT_xxx"
     ></script>
     <div id="mais-widget"></div>
     ```
   - Test on tenant's staging site
   - Deploy to production

5. **Validation**
   - Test booking flow end-to-end
   - Verify commission calculation
   - Check Stripe payment routing
   - Confirm webhook delivery

---

## Deployment Configuration

### Backend (Render)

**File:** `render.yaml`

```yaml
services:
  - type: web
    name: mais-api
    env: node
    region: oregon
    plan: standard
    buildCommand: cd server && pnpm install && pnpm run build
    startCommand: cd server && pnpm run start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: TENANT_SECRETS_ENCRYPTION_KEY
        generateValue: true
      - key: STRIPE_SECRET_KEY
        sync: false
      - key: STRIPE_WEBHOOK_SECRET
        sync: false
    healthCheckPath: /health
```

### Frontend/Widget (Vercel)

**File:** `client/vercel.json`

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "headers": [
    {
      "source": "/(.*)",
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
          "key": "Content-Security-Policy",
          "value": "frame-ancestors 'self' https://*.mais.com"
        }
      ]
    },
    {
      "source": "/sdk/mais-sdk.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "env": {
    "VITE_API_URL": "https://api.mais.com"
  }
}
```

---

## Testing Strategy

### Unit Tests

- Commission calculation service
- API key generation/validation
- Encryption/decryption service
- Tenant resolution middleware

### Integration Tests

- Booking creation with commission
- Stripe Connect payment flow
- Webhook handling
- Multi-tenant data isolation

### End-to-End Tests

- Complete booking flow (catalog → payment → confirmation)
- Widget embedding on test page
- Stripe Connect onboarding
- Admin tenant management

---

## Success Metrics

### Phase 1-3 (Weeks 1-12)

- [ ] Database migrated with tenant isolation
- [ ] 2 test tenants created with Stripe Connect
- [ ] Widget SDK functional on test pages
- [ ] Commission calculation tested (10 bookings)

### Phase 4-6 (Weeks 13-24)

- [ ] Admin dashboard deployed
- [ ] 10 tenants onboarded and live
- [ ] 100+ bookings processed
- [ ] $10K+ GMV (Gross Merchandise Value)
- [ ] Zero cross-tenant data leaks
- [ ] 99.9% API uptime

---

## Risk Mitigation

| Risk                                         | Mitigation                                                |
| -------------------------------------------- | --------------------------------------------------------- |
| **Stripe Connect onboarding friction**       | Provide step-by-step guide, support email                 |
| **Widget incompatibility with tenant sites** | Extensive browser testing, CSP documentation              |
| **Commission calculation errors**            | Comprehensive unit tests, manual review first 20 bookings |
| **Cross-tenant data leak**                   | Automated tests for tenant isolation, code review         |
| **Payment processing failures**              | Stripe webhook retry logic, monitoring alerts             |
| **Performance degradation at scale**         | Database indexes, caching, load testing at 50 tenants     |

---

## Appendix A: Environment Variables

**Server** (`server/.env`)

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/mais_production"

# Security
JWT_SECRET="your-64-character-secret"
TENANT_SECRETS_ENCRYPTION_KEY="your-64-character-hex-key"

# Stripe
STRIPE_SECRET_KEY="sk_live_xxxxxxxxxxxxxxxxxxxxx"
STRIPE_PUBLISHABLE_KEY="pk_live_xxxxxxxxxxxxxxxxxxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxxxxxxx"

# URLs
API_URL="https://api.mais.com"
ADMIN_URL="https://admin.mais.com"
WIDGET_URL="https://widget.mais.com"

# Defaults
DEFAULT_COMMISSION_PERCENT="10.0"
```

**Client** (`client/.env`)

```bash
VITE_API_URL="https://api.mais.com"
VITE_STRIPE_PUBLISHABLE_KEY="pk_live_xxxxxxxxxxxxxxxxxxxxx"
```

---

## Appendix B: Code Review Checklist

Before deploying any multi-tenant code:

- [ ] All database queries include `tenantId` filter
- [ ] Cache keys include `tenantId` prefix
- [ ] Commission calculated server-side (never client-side)
- [ ] Stripe Connected Account ID validated against tenant
- [ ] postMessage origin validated (never `'*'`)
- [ ] Admin routes protected with `requireAdmin` middleware
- [ ] Secrets encrypted before database storage
- [ ] Error messages don't leak tenant information
- [ ] API responses don't include sensitive fields (apiKeySecret, etc.)

---

## Next Steps

1. **Run Phase 1 migration** (Week 1)
2. **Create first 2 test tenants** (Week 2)
3. **Deploy widget to staging** (Week 5)
4. **First production booking** (Week 12)
5. **Onboard 10 tenants** (Weeks 21-24)

---

**Document Version:** 1.0
**Last Updated:** January 2025
**Maintained By:** Platform Engineering Team
