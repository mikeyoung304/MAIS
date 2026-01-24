# feat: Set Up Little Bit Farm as Production-Ready Tenant

## Overview

Transform Little Bit Farm from a shell tenant into a fully bookable, production-ready business on the MAIS platform. This includes real photos, real packages/tiers, real add-ons, complete branding, and end-to-end booking flow verification using Stripe sandbox.

**Tenant:** Little Bit Farm
**Goal:** Fully bookable with real pricing, real everything except live payments (Stripe test mode)
**Priority:** HIGH - First real tenant launch

---

## Problem Statement / Motivation

Little Bit Farm exists as a tenant record but lacks:

- Professional photos (currently using Unsplash placeholders)
- Real package descriptions and pricing
- Configured segments/business lines
- Custom branding (logo, colors)
- Stripe Connect onboarding
- Verified end-to-end booking flow

The platform code is 97% production-ready (752 tests passing), but tenant-specific data and configuration is incomplete.

---

## Current State Analysis

### What Exists

| Component       | Status      | Notes                                   |
| --------------- | ----------- | --------------------------------------- |
| Tenant Record   | ✅ Complete | slug: `little-bit-farm`, commission: 5% |
| Admin User      | ✅ Complete | `admin@littlebitfarm.com`               |
| API Keys        | ✅ Complete | Public/secret keys generated            |
| Database Schema | ✅ Complete | All models ready                        |
| Booking Flow    | ✅ Complete | Code works, needs testing               |
| Dashboard       | ✅ Complete | Full CRUD for packages/add-ons          |

### What's Missing

| Component              | Status          | Blocking?        |
| ---------------------- | --------------- | ---------------- |
| Professional Photos    | ❌ Missing      | Yes - UX         |
| Real Package Content   | ❌ Mock data    | Yes - UX         |
| Segments               | ❌ None created | No - optional    |
| Branding (logo/colors) | ❌ Defaults     | Yes - UX         |
| Stripe Onboarding      | ❌ Not started  | Yes - Payments   |
| Cloud Image Storage    | ❌ Local only   | Yes - Production |
| E2E Verification       | ❌ Not tested   | Yes - Launch     |

---

## Proposed Solution

### Phase 1: Data Foundation (Content Setup)

#### 1.1 Create Real Packages with Tiers

Based on Little Bit Farm's actual offerings, create packages:

**Packages to Create:**

| Package             | Price  | Description                                                           |
| ------------------- | ------ | --------------------------------------------------------------------- |
| Barn Ceremony       | $1,500 | Intimate ceremony in restored 1890s barn, up to 30 guests             |
| Garden Gathering    | $2,500 | Outdoor ceremony + reception in wildflower garden, up to 50 guests    |
| Farmhouse Reception | $4,000 | Full venue rental with farmhouse, barn, and grounds, up to 100 guests |

**Implementation:**

```typescript
// server/scripts/seed-little-bit-farm.ts
const packages = [
  {
    slug: 'barn-ceremony',
    name: 'Barn Ceremony',
    description: 'Exchange vows in our beautifully restored 1890s barn...',
    basePrice: 150000, // $1,500 in cents
    grouping: 'Budget',
    groupingOrder: 1,
  },
  // ... more packages
];
```

#### 1.2 Create Add-ons

| Add-on                     | Price      | Description                     |
| -------------------------- | ---------- | ------------------------------- |
| Photography Package (2hrs) | $600       | Professional farm photography   |
| Farm-to-Table Catering     | $45/person | Local seasonal menu             |
| Rustic Decorations         | $300       | Burlap, mason jars, wildflowers |
| Day-of Coordinator         | $400       | Stress-free event management    |
| Extended Hours             | $250/hr    | Additional venue time           |

#### 1.3 Upload Professional Photos

**Requirements:**

- 3-5 photos per package
- Minimum 1200x800px (landscape)
- JPEG format for web optimization
- Actual Little Bit Farm venue photos

**Photo Categories:**

- `barn-ceremony/`: Barn interior, ceremony setup, exterior
- `garden-gathering/`: Garden views, reception setup, outdoor ceremony
- `farmhouse-reception/`: Farmhouse exterior, interior, full venue aerial

---

### Phase 2: Branding Configuration

#### 2.1 Upload Logo

- Format: PNG or SVG
- Recommended size: 200x60px (horizontal)
- Endpoint: `POST /v1/tenant-admin/logo`

#### 2.2 Configure Brand Colors

```json
{
  "primaryColor": "#2D5A27", // Forest green
  "secondaryColor": "#F5E6D3", // Cream/beige
  "accentColor": "#8B4513", // Saddle brown
  "backgroundColor": "#FAFAF8", // Off-white
  "fontFamily": "Playfair Display, Georgia, serif"
}
```

#### 2.3 Configure Segment (Optional but Recommended)

```json
{
  "slug": "farm-weddings",
  "name": "Farm Weddings & Events",
  "heroTitle": "Celebrate on Our Beautiful Farm",
  "heroSubtitle": "Where rustic charm meets modern elegance",
  "heroImage": "https://...",
  "description": "Little Bit Farm offers intimate celebrations...",
  "metaTitle": "Farm Weddings at Little Bit Farm | Macon, GA",
  "metaDescription": "Host your dream wedding at our 50-acre working farm..."
}
```

---

### Phase 3: Infrastructure Setup

#### 3.1 Image Storage Migration

**Current:** Local filesystem (`/uploads/`)
**Required:** Cloud storage for production persistence

**Options (choose one):**

| Option              | Pros                      | Cons         | Effort |
| ------------------- | ------------------------- | ------------ | ------ |
| Supabase Storage    | Already using Supabase DB | New service  | 4 hrs  |
| AWS S3 + CloudFront | Industry standard, CDN    | More config  | 6 hrs  |
| Cloudinary          | Built-in transforms       | Monthly cost | 2 hrs  |

**Recommendation:** Supabase Storage (consistent with existing stack)

**Implementation:**

```typescript
// server/src/services/upload.service.ts
const STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'local';

if (STORAGE_BACKEND === 'supabase') {
  const { data } = await supabase.storage
    .from('tenant-assets')
    .upload(`${tenantId}/packages/${filename}`, buffer);
  return { url: getPublicUrl(data.path) };
}
```

#### 3.2 Environment Configuration

```bash
# .env additions
STORAGE_BACKEND=supabase
SUPABASE_STORAGE_BUCKET=tenant-assets
API_BASE_URL=https://api.maconai.com  # Production URL
```

---

### Phase 4: Payment Setup (Stripe)

> **Note:** User mentioned "Square sandbox" but codebase is Stripe-only. Clarification needed.

#### 4.1 Stripe Connect Onboarding

**Steps:**

1. Generate Stripe Connect onboarding link
2. Tenant completes KYC in Stripe-hosted flow
3. Webhook updates `stripeOnboarded` flag
4. Verify `charges_enabled` and `payouts_enabled`

**Script:**

```bash
npm run stripe:onboard -- --tenant=little-bit-farm
```

#### 4.2 Test Mode Configuration

```bash
# Use Stripe test keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

**Test Cards:**

- Success: `4242424242424242`
- Decline: `4000000000000002`

---

### Phase 5: E2E Verification

#### 5.1 Manual Testing Checklist

- [ ] View storefront at `/packages`
- [ ] See all 3 packages with photos
- [ ] Select package and view details
- [ ] Select add-ons
- [ ] Choose available date
- [ ] Enter customer info
- [ ] Redirect to Stripe Checkout
- [ ] Complete test payment
- [ ] Receive confirmation
- [ ] Booking appears in admin dashboard

#### 5.2 Automated E2E Test

```typescript
// e2e/tests/little-bit-farm-booking.spec.ts
test('complete booking flow for Little Bit Farm', async ({ page }) => {
  await page.goto('/packages');
  await page.click('[data-package="barn-ceremony"]');
  await page.click('[data-addon="photography"]');
  // ... complete flow
  await expect(page.locator('.confirmation')).toBeVisible();
});
```

---

## Technical Considerations

### Multi-Tenant Data Isolation

All queries scoped by `tenantId` - verified in existing tests.

### Image Storage

- Current: Local filesystem (not persistent across deploys)
- Required: Cloud storage with CDN
- Migration path documented above

### Payment Provider

- **Current:** Stripe only (no Square)
- **User expectation:** Square sandbox
- **Action needed:** Clarify with user - implement Square adapter or use Stripe test mode?

### Performance

- Package photos cached at CDN edge
- Catalog queries cached 15min in-memory

---

## Acceptance Criteria

### Functional Requirements

- [ ] Little Bit Farm storefront displays 3 packages with real photos
- [ ] Each package shows accurate pricing and description
- [ ] Add-ons can be selected and price updates correctly
- [ ] Date picker shows availability (respects blackout dates)
- [ ] Checkout redirects to Stripe test mode
- [ ] Test payment completes successfully
- [ ] Booking confirmation email sent (or logged in dev)
- [ ] Booking appears in tenant admin dashboard
- [ ] Admin can view/manage bookings

### Non-Functional Requirements

- [ ] Page load < 2s with images
- [ ] Images served from CDN (not local)
- [ ] Mobile-responsive design works
- [ ] Accessibility: WCAG 2.1 AA on booking flow

### Quality Gates

- [ ] All existing tests pass (752 tests)
- [ ] New E2E test for Little Bit Farm passes
- [ ] Manual QA sign-off on booking flow
- [ ] Real photos uploaded (no placeholders)

---

## Implementation Tasks

### Data Setup

- [ ] Create `server/scripts/seed-little-bit-farm.ts`
- [ ] Add 3 packages with real content
- [ ] Add 5 add-ons with real pricing
- [ ] Create segment for farm weddings

### Photo Management

- [ ] Collect professional photos from user
- [ ] Upload photos via admin dashboard
- [ ] Verify photo URLs accessible

### Branding

- [ ] Collect logo from user
- [ ] Configure brand colors
- [ ] Update branding via API

### Infrastructure

- [ ] Configure cloud storage (Supabase/S3)
- [ ] Update upload service for cloud backend
- [ ] Set production environment variables

### Payments

- [ ] Complete Stripe Connect onboarding
- [ ] Verify test mode works
- [ ] Test webhook processing

### Testing

- [ ] Run full E2E booking test
- [ ] Verify admin dashboard functions
- [ ] Test mobile experience

---

## Dependencies & Prerequisites

| Dependency                | Status    | Owner  |
| ------------------------- | --------- | ------ |
| Real photos from client   | ❌ Needed | User   |
| Logo file                 | ❌ Needed | User   |
| Brand color palette       | ❌ Needed | User   |
| Package descriptions      | ❌ Needed | User   |
| Add-on list and pricing   | ❌ Needed | User   |
| Stripe account access     | ❌ Needed | User   |
| Cloud storage credentials | ❌ Needed | DevOps |

---

## Risk Analysis & Mitigation

| Risk                           | Likelihood | Impact | Mitigation                         |
| ------------------------------ | ---------- | ------ | ---------------------------------- |
| Square vs Stripe confusion     | HIGH       | HIGH   | Clarify with user immediately      |
| Missing photos delays launch   | MEDIUM     | MEDIUM | Use high-quality stock temporarily |
| Stripe onboarding blocked      | LOW        | HIGH   | Pre-verify business documents      |
| Image storage migration issues | MEDIUM     | MEDIUM | Test thoroughly in staging         |

---

## Open Questions for User

1. **Payment Provider:** You mentioned "Square sandbox" but the codebase uses Stripe. Should we:
   - A) Use Stripe test mode (ready now)
   - B) Implement Square integration (2-3 days additional work)

2. **Photos:** Do you have professional photos of Little Bit Farm, or should we use high-quality stock images temporarily?

3. **Logo:** Do you have a logo file ready to upload?

4. **Package Details:** Can you provide the exact package names, descriptions, and pricing you want to use?

5. **Add-ons:** What add-on services does Little Bit Farm offer? (photography, catering, decorations, etc.)

6. **Timeline:** When do you want Little Bit Farm live and accepting test bookings?

---

## Success Metrics

| Metric                         | Target      | Measurement    |
| ------------------------------ | ----------- | -------------- |
| Storefront loads               | < 2s        | Lighthouse     |
| Booking completion rate        | > 80%       | Analytics      |
| Zero cross-tenant data leakage | 0 incidents | Security audit |
| E2E test pass rate             | 100%        | CI/CD          |

---

## References & Research

### Internal References

- Tenant creation: `server/create-tenants.ts`
- Package seeding: `server/prisma/seed.ts:70-122`
- Photo upload: `server/src/routes/tenant-admin.routes.ts:378-480`
- Branding: `server/src/routes/tenant-admin.routes.ts:72-224`
- Stripe Connect: `server/src/services/stripe-connect.service.ts`

### External References

- [Stripe Test Mode](https://stripe.com/docs/testing)
- [Supabase Storage](https://supabase.com/docs/guides/storage)

### Related Work

- Sprint 10 complete: 752 tests passing
- Multi-tenant architecture: 95% complete
- God component refactoring: 100% complete

---

**Plan Created:** 2025-11-25
**Author:** Claude Code
**Status:** DRAFT - Awaiting User Review
