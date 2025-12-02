# Multi-Tenant Embeddable Platform Implementation Guide

**Project:** MAIS - Multi-tenant business growth platform
**Timeline:** 6 months (24 weeks) - Started November 2025
**Current Phase:** Phase 5 - Self-Service Foundation (In Progress)
**Architecture Status:** 95% Complete (December 2025)
**Branch:** `main` (production-ready)

---

## Executive Summary

This guide documents the multi-tenant architecture implementation for the MAIS platform. The system now supports multiple independent businesses, each with isolated data, variable commission rates, custom branding, and tenant-scoped operations.

**Current Achievement:** Phase 1-4 complete (95% of multi-tenant architecture operational). Phase 5 (self-service foundation) is in progress as of December 2025.

### Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Embedding Strategy** | Hybrid (JavaScript SDK + iframe) | Best security + compatibility |
| **Tenant Identification** | API keys (`pk_live_*`) | Client-safe, industry standard |
| **Data Isolation** | Row-level with `tenantId` | Optimal for 50-tenant scale |
| **Commission Model** | Server-side calculation | Stripe Connect limitation |
| **Deployment** | Render (backend) + Vercel (widget) | Persistent server + CDN |
| **Secrets Management** | Database-encrypted | Scales beyond env vars |

---

## Current Status

### ✅ Phase 1 Complete (2025-11-06) - Commit `efda74b`

**Critical Achievement**: Discovered and fixed P0 security vulnerability (HTTP cache cross-tenant data leakage)

#### 1. Database Schema (`server/prisma/schema.prisma`) ✅
- [x] Tenant model with API keys, commission rates, Stripe Connect, encrypted secrets
- [x] Multi-tenant fields added to: Package, AddOn, Booking, BlackoutDate, WebhookEvent
- [x] Composite unique constraints: `[tenantId, slug]`, `[tenantId, date]`
- [x] Performance indexes for tenant-scoped queries
- [x] Commission tracking fields in Booking model
- [x] **Migration applied successfully** (zero data loss)

#### 2. Core Services ✅
| Service | File | Status |
|---------|------|--------|
| **Encryption** | `src/lib/encryption.service.ts` | ✅ Complete |
| **API Keys** | `src/lib/api-key.service.ts` | ✅ Complete |
| **Tenant Middleware** | `src/middleware/tenant.ts` | ✅ Complete + logging |
| **Commission** | `src/services/commission.service.ts` | ✅ Complete + tested |
| **Tenant Repository** | `src/adapters/prisma/tenant.repository.ts` | ✅ Complete |

#### 3. Service Layer Updates ✅
- [x] Catalog service: Tenant-aware with proper cache scoping
- [x] Booking service: Commission integration with Stripe metadata
- [x] Availability service: Tenant-scoped availability checks
- [x] All repositories updated with tenantId parameter

#### 4. API Routes ✅
- [x] Tenant middleware applied via ts-rest globalMiddleware
- [x] All public routes require X-Tenant-Key header
- [x] Catalog routes: `/v1/packages` tenant-scoped
- [x] Booking routes: `/v1/bookings` tenant-scoped
- [x] Availability routes: `/v1/availability` tenant-scoped
- [x] Admin routes: `/v1/admin/tenants` for tenant management

#### 5. Testing & Validation ✅
- [x] 3 test tenants created with distinct data
- [x] Tenant isolation verified (no cross-tenant data leakage)
- [x] Commission calculation tested (10%, 12.5%, 15%)
- [x] Cache isolation verified (application cache tenant-scoped)
- [x] Authentication enforced (401 for invalid keys)

#### 6. Critical Security Fix ✅
- [x] **Removed HTTP cache middleware** from `app.ts` (lines 18, 81-86)
- [x] **Root cause**: Cache keys lacked tenantId, causing all tenants to share cached data
- [x] **Impact**: Without fix, Tenant A's data would be visible to Tenant B
- [x] **Resolution**: Application cache provides performance with proper tenant isolation
- [x] **Verified**: Each tenant now sees only their own data

#### 7. Tools & Scripts ✅
- [x] `server/scripts/create-tenant.ts` - CLI tenant provisioning
- [x] `server/scripts/test-commission.ts` - Commission calculation tests
- [x] `server/scripts/test-api-simple.sh` - Tenant isolation verification

### 📊 Phase 1 Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Files Modified | 20+ | 23 | ✅ |
| Files Created | 3+ | 5 | ✅ |
| Test Tenants | 2 | 3 | ✅ |
| Data Loss | 0% | 0% | ✅ |
| Security Issues | 0 | 0 (1 found + fixed) | ✅ |
| Performance Impact | <5% | <2% | ✅ |

### 📋 Ready for Phase 2

Phase 1 foundation is complete and production-ready. All deliverables met, security vulnerability fixed, comprehensive testing passed.

**Next Phase**: Embeddable Widget SDK (Weeks 5-8)

---

## Quick Start: Applying the Migration

Once database is accessible:

```bash
cd server

# 1. Verify schema is correct
pnpm exec prisma format

# 2. Apply migration
pnpm exec prisma migrate dev --name add_multi_tenancy

# 3. Generate Prisma client
pnpm exec prisma generate

# 4. Verify migration
pnpm exec prisma migrate status

# 5. Generate master encryption key (save securely!)
openssl rand -hex 32

# 6. Add to .env
echo "TENANT_SECRETS_ENCRYPTION_KEY=<your_64_char_hex_key>" >> .env
```

---

## Phase-by-Phase Implementation

### Phase 1: Multi-Tenant Foundation (Weeks 1-4) ✅ **COMPLETE**

**Goal:** Database isolation, tenant resolution, commission calculation

**Deliverables:**
- [x] Tenant model in database
- [x] API key generation/validation
- [x] Encryption service for secrets
- [x] Commission calculation engine
- [x] All services tenant-scoped
- [x] Migration applied successfully
- [x] Critical security fix (HTTP cache removal)
- [x] Comprehensive testing with 3 tenants

**Validation:** ✅ PASSED
```bash
# Created 3 test tenants
pnpm --filter @elope/api exec tsx scripts/create-tenant.ts

# Verified tenant isolation
./server/scripts/test-api-simple.sh

# Results: Perfect tenant isolation, no cross-tenant data leakage
```

**Completion Report:** See `PHASE_1_COMPLETION_REPORT.md` for detailed results

---

### Phase 2: Embeddable Widget Core (Weeks 5-8)

**Goal:** JavaScript SDK loader, iframe widget, postMessage communication

**Key Files to Create:**

#### 1. SDK Loader (`client/public/mais-sdk.js`)
```javascript
// Lightweight (<3KB) vanilla JS loader
// Creates iframe, handles postMessage, auto-resize
// Deploys to: https://widget.mais.com/sdk/mais-sdk.js
```

#### 2. Widget Application (`client/src/widget/`)
```
widget/
├── WidgetApp.tsx        # Main widget component
├── WidgetMessenger.ts   # postMessage wrapper
└── widget-main.tsx      # Entry point
```

**Tenant Integration:**
```html
<!-- Tenant embeds on their website -->
<script src="https://widget.mais.com/sdk/mais-sdk.js"
        data-tenant="bellaweddings"
        data-api-key="pk_live_bellaweddings_xxx">
</script>
<div id="mais-widget"></div>
```

**Deliverables:**
- [ ] SDK loader with iframe creation
- [ ] Widget React app with branding API
- [ ] postMessage security (origin validation)
- [ ] Auto-resize iframe based on content
- [ ] Event system (ready, booking_created, booking_completed)

---

### Phase 3: Stripe Connect & Payments (Weeks 9-12)

**Goal:** Variable commission payments via Stripe Connect

**Stripe Connect Flow:**
1. Admin creates tenant → Generate Stripe Express account
2. Tenant completes onboarding (KYC, banking)
3. Booking created → Calculate commission server-side
4. Payment processed → Charge goes to tenant's account
5. Platform takes commission via `application_fee_amount`

**Key Services to Create:**

#### 1. Stripe Connect Service (`src/services/stripe-connect.service.ts`)
```typescript
class StripeConnectService {
  async createConnectedAccount(tenantId, email, businessName)
  async createOnboardingLink(tenantId, refreshUrl, returnUrl)
  async checkOnboardingStatus(tenantId)
  async storeRestrictedKey(tenantId, restrictedKey)
}
```

#### 2. Update Booking Service
```typescript
async createPaymentIntent(tenantId, bookingId) {
  const booking = await prisma.booking.findUnique({ ... });
  const commission = await commissionService.calculateCommission(...);

  // Create PaymentIntent on Connected Account
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: booking.totalPrice,
      application_fee_amount: commission.amount, // Platform commission
      currency: 'usd',
    },
    { stripeAccount: tenant.stripeAccountId } // Connected Account
  );
}
```

**Deliverables:**
- [ ] Stripe Connect account creation
- [ ] Onboarding link generation
- [ ] Payment intent with commission
- [ ] Webhook handler for payment events
- [ ] Refund handling with commission reversal

---

### Phase 4: Admin Tools (Weeks 13-16)

**Goal:** Tenant provisioning UI for platform admin

**Admin Dashboard Features:**

#### 1. Tenant Management
```
GET    /api/v1/admin/tenants           # List all tenants
POST   /api/v1/admin/tenants           # Create new tenant
PATCH  /api/v1/admin/tenants/:id       # Update commission, branding
GET    /api/v1/admin/tenants/:id/stats # Revenue, bookings
```

#### 2. Tenant Onboarding Workflow
```
1. Admin creates tenant (name, slug, email, commission %)
2. System generates API keys (public + secret)
3. System creates Stripe Connect account
4. Admin sends onboarding link to tenant
5. Tenant completes Stripe KYC/banking
6. System sets stripeOnboarded = true
7. Tenant can now accept bookings
```

**Deliverables:**
- [ ] Admin authentication middleware
- [ ] Tenant CRUD API routes
- [ ] Commission rate editor
- [ ] Branding manager (logo, colors)
- [ ] Tenant statistics dashboard
- [ ] Stripe onboarding status tracker

---

### Phase 5: Production Hardening (Weeks 17-20)

**Goal:** Security, performance, monitoring

**Security Checklist:**
- [ ] CSP headers: `frame-ancestors` whitelist
- [ ] postMessage origin validation (never `'*'`)
- [ ] CORS configured for known tenant domains
- [ ] Rate limiting (express-rate-limit)
- [ ] Encrypted tenant secrets with key rotation plan
- [ ] Stripe webhook signature validation
- [ ] SQL injection prevention (Prisma)
- [ ] Admin auth with JWT expiration
- [ ] HTTPS enforced (Render/Vercel)

**Performance Optimization:**
- [ ] PostgreSQL indexes verified
- [ ] Cache hit rate monitoring
- [ ] Stripe API request deduplication
- [ ] Database connection pooling
- [ ] Widget SDK CDN caching (Vercel Edge)

**Monitoring:**
- [ ] Sentry error tracking
- [ ] Stripe Dashboard alerts
- [ ] Database query performance
- [ ] API endpoint latency
- [ ] Commission calculation accuracy

---

### Phase 6: Scale to 10+ Tenants (Weeks 21-24)

**Goal:** Production launch with first 10 tenants

**Tenant Onboarding Checklist:**

For each tenant:
1. [ ] Admin creates tenant in dashboard
2. [ ] Tenant completes Stripe Connect onboarding
3. [ ] Tenant creates 3-5 packages
4. [ ] Tenant uploads package images
5. [ ] Tenant integrates SDK on their website
6. [ ] Test booking flow end-to-end
7. [ ] Verify commission calculation
8. [ ] Go live!

---

## Critical Code Patterns

### 1. Tenant-Scoped Database Queries

**❌ WRONG - No tenant isolation:**
```typescript
const packages = await prisma.package.findMany({ where: { active: true } });
```

**✅ CORRECT - Tenant isolated:**
```typescript
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});
```

### 2. Cache Keys Must Include Tenant ID

**❌ WRONG - Cache leak:**
```typescript
const cacheKey = 'catalog:all-packages';
```

**✅ CORRECT - Tenant-scoped cache:**
```typescript
const cacheKey = `catalog:${tenantId}:all-packages`;
```

### 3. Commission Calculation

**❌ WRONG - Client-side calculation:**
```typescript
// Never trust client for commission amount
const commission = req.body.commission; // ❌ Unsafe!
```

**✅ CORRECT - Server-side calculation:**
```typescript
const commission = await commissionService.calculateCommission(tenantId, totalPrice);
await stripe.paymentIntents.create({
  amount: totalPrice,
  application_fee_amount: commission.amount, // ✅ Calculated server-side
});
```

### 4. API Routes with Tenant Middleware

**❌ WRONG - No tenant resolution:**
```typescript
router.get('/packages', async (req, res) => {
  const packages = await catalogService.getAllPackages(); // ❌ No tenantId
});
```

**✅ CORRECT - Tenant middleware:**
```typescript
router.use(resolveTenant(prisma));
router.use(requireTenant);

router.get('/packages', async (req: TenantRequest, res) => {
  const packages = await catalogService.getAllPackages(req.tenantId!);
  res.json({ packages });
});
```

---

## Environment Variables

### Required for Development

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Security
JWT_SECRET="your-64-char-secret"
TENANT_SECRETS_ENCRYPTION_KEY="your-64-char-hex" # openssl rand -hex 32

# Stripe (Test Mode)
STRIPE_SECRET_KEY="sk_test_xxx"
STRIPE_PUBLISHABLE_KEY="pk_test_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"

# URLs
API_URL="http://localhost:3000"
WIDGET_URL="http://localhost:5173"
```

### Required for Production

```bash
# Same as above, plus:
STRIPE_SECRET_KEY="sk_live_xxx"  # Live mode
STRIPE_PUBLISHABLE_KEY="pk_live_xxx"
NODE_ENV="production"
```

---

## Testing Strategy

### Unit Tests

Test commission calculation:
```typescript
describe('CommissionService', () => {
  it('calculates commission correctly', async () => {
    const result = await commissionService.calculateCommission('tenant_id', 50000);
    expect(result.amount).toBe(6000); // 12% of $500.00
  });

  it('enforces Stripe minimum (0.5%)', async () => {
    const result = await commissionService.calculateCommission('tenant_id', 100);
    expect(result.amount).toBeGreaterThanOrEqual(1); // 0.5% minimum
  });
});
```

### Integration Tests

Test tenant isolation:
```typescript
describe('Catalog API', () => {
  it('isolates packages by tenant', async () => {
    const tenant1Key = 'pk_live_tenant1_xxx';
    const tenant2Key = 'pk_live_tenant2_xxx';

    const res1 = await request(app)
      .get('/api/v1/catalog/packages')
      .set('X-Tenant-Key', tenant1Key);

    const res2 = await request(app)
      .get('/api/v1/catalog/packages')
      .set('X-Tenant-Key', tenant2Key);

    expect(res1.body.packages).not.toEqual(res2.body.packages);
  });
});
```

### End-to-End Tests

Test complete booking flow:
```typescript
describe('Booking Flow', () => {
  it('completes booking with commission', async () => {
    // 1. Create booking
    const booking = await createBooking(tenantId, bookingData);

    // 2. Create payment intent
    const { clientSecret } = await createPaymentIntent(tenantId, booking.id);

    // 3. Simulate payment success webhook
    await simulateStripeWebhook('payment_intent.succeeded', booking.id);

    // 4. Verify commission was charged
    const updatedBooking = await getBooking(booking.id);
    expect(updatedBooking.commissionAmount).toBeGreaterThan(0);
    expect(updatedBooking.status).toBe('CONFIRMED');
  });
});
```

---

## Deployment

### Backend (Render)

```yaml
# render.yaml
services:
  - type: web
    name: mais-api
    env: node
    buildCommand: cd server && pnpm install && pnpm build
    startCommand: cd server && pnpm start
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: TENANT_SECRETS_ENCRYPTION_KEY
        generateValue: true
      - key: STRIPE_SECRET_KEY
        sync: false
```

### Frontend/Widget (Vercel)

```json
// vercel.json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "Content-Security-Policy", "value": "frame-ancestors 'self' https://*.mais.com" }
      ]
    }
  ]
}
```

---

## Troubleshooting

### Issue: "Tenant not found"
**Cause:** Invalid or missing X-Tenant-Key header
**Fix:** Ensure header format: `X-Tenant-Key: pk_live_tenant_xxx`

### Issue: Cross-tenant data leak
**Cause:** Missing tenantId in query
**Fix:** Audit all Prisma queries for `where: { tenantId }`

### Issue: Commission not charged
**Cause:** application_fee_amount not set in PaymentIntent
**Fix:** Verify `commissionService.calculateCommission()` is called

### Issue: Stripe Connect onboarding fails
**Cause:** Incomplete business information
**Fix:** Ensure email, business name, country are provided

---

## Success Metrics

### Phase 1 (Weeks 1-4) ✅ **COMPLETE**
- [x] Database migrated with zero data loss
- [x] 3 test tenants created
- [x] Tenant isolation verified (no cross-tenant data leakage)
- [x] Commission calculation tested (10%, 12.5%, 15%)
- [x] Critical security vulnerability fixed (HTTP cache)
- [x] TypeScript compilation successful (pre-existing errors non-blocking)

### Phase 2-3 (Weeks 5-12) 🎯 **NEXT**
- [ ] Widget SDK functional on test pages
- [ ] 10+ test bookings with commission
- [ ] Widget branding customization

### Phase 4-6 (Weeks 13-24)
- [ ] Admin dashboard deployed
- [ ] 10 real tenants onboarded
- [ ] 100+ confirmed bookings
- [ ] $10K+ GMV (Gross Merchandise Value)
- [ ] Zero cross-tenant data leaks (verified by audit)
- [ ] 99.9% API uptime

---

## Next Immediate Steps

### ✅ Phase 1 Complete - Ready for Phase 2

**Phase 1 Status:**
- All deliverables completed
- Critical security fix applied
- 3 test tenants verified
- Comprehensive testing passed
- Documentation updated

**Start Phase 2: Embeddable Widget SDK**

1. **Create widget loader package:**
   ```bash
   mkdir -p client/packages/widget-loader
   cd client/packages/widget-loader
   npm init -y
   ```

2. **Implement SDK loader:**
   - Lightweight JavaScript library (<3KB)
   - Iframe creation and management
   - postMessage communication layer
   - Auto-resize functionality

3. **Create widget application:**
   - React app with tenant branding
   - Widget configuration API endpoint
   - Theme generation from tenant branding
   - Responsive design (mobile-first)

4. **Test widget embedding:**
   - Create test HTML page
   - Embed widget with tenant API key
   - Verify tenant branding applied
   - Test booking flow end-to-end

See `Phase 2: Embeddable Widget Core` section for detailed implementation plan.

---

## Additional Resources

- **Embeddable Implementation Plan:** `EMBEDDABLE_MULTI_TENANT_IMPLEMENTATION_PLAN.md` (Detailed 24-week roadmap with code examples)
- **Multi-Tenancy Readiness Report:** `MULTI_TENANCY_READINESS_REPORT.md` (Original architecture assessment)
- **Stripe Connect Docs:** https://stripe.com/docs/connect
- **Prisma Multi-Tenancy Guide:** https://www.prisma.io/docs/guides/database/multi-tenancy

---

**Last Updated:** 2025-11-06
**Branch:** `multi-tenant-embeddable`
**Status:** Phase 1 Foundation - ✅ **100% COMPLETE**
**Phase 1 Commit:** `efda74b`
**Next Phase:** Phase 2 - Embeddable Widget SDK
