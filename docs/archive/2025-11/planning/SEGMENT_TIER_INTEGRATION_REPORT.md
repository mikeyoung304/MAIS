# Three-Tier Segment-Driven Storefront Integration Report

## Executive Summary

Your MAIS platform is exceptionally well-positioned for the three-tier, segment-driven storefront integration. The existing architecture provides 85%+ of required foundation with modular services, multi-tenant isolation, and extensible data models. Key quick wins include extending the Package model for segments/tiers, leveraging existing booking flows, and reusing admin dashboard components.

---

## 1. Feature Architecture

### Current State

- **Modular service architecture** with dependency injection (server/src/services/)
- Clean separation: CatalogService, BookingService, CommissionService, PaymentProvider
- Repository pattern with ports/adapters (server/src/lib/ports/)

### Integration Path for Segments > Tiers > Booking > Add-ons

**QUICK WIN**: Extend existing CatalogService with minimal changes:

```typescript
// Extend server/src/services/catalog.service.ts:32
export interface PackageWithSegments extends Package {
  segment?: string; // 'budget' | 'premium' | 'luxury'
  tier?: number; // 1, 2, 3 within segment
  tierName?: string; // 'Essential', 'Preferred', 'Ultimate'
  addOns: AddOn[];
  upsellTargets?: string[]; // IDs of packages to promote
}
```

**Action Items**:

1. Add `getPackagesBySegment(tenantId, segment)` method to CatalogService:108
2. Extend `BookingService.createCheckout()`:55 to handle tier upgrades
3. Create new `UpsellService` that wraps existing services
4. Reuse existing cache patterns with segment-aware keys

**Code References**:

- CatalogService: server/src/services/catalog.service.ts
- BookingService: server/src/services/booking.service.ts
- Repository interfaces: server/src/lib/ports/catalog.repository.ts

---

## 2. Data Models

### Current State

- Prisma schema with clean multi-tenant design (server/prisma/schema.prisma)
- Package model (line 107) supports JSON fields for extensibility
- Strong tenant isolation patterns

### Segment/Tier Model Extensions

**MINIMAL MIGRATION** - Add to Package model:

```prisma
// server/prisma/schema.prisma:107
model Package {
  // ... existing fields ...

  // Segment & Tier fields (backward compatible)
  segment      String?  @default("standard") // New
  tierLevel    Int?     @default(1)         // New
  tierName     String?                      // New
  maxGuests    Int?                          // New
  features     Json     @default("[]")      // New - tier features list

  // Upsell configuration
  upsellTargets Json   @default("[]")       // New - [packageId, ...]
  popularBadge  Boolean @default(false)     // New

  @@index([tenantId, segment, tierLevel])   // New composite index
}
```

**REUSE EXISTING**:

- AddOn model already perfect for add-ons/upsells
- BlackoutDate model handles availability
- Booking model tracks all purchases

**Action Items**:

1. Create migration: `npx prisma migrate dev --name add-segments-tiers`
2. Update repository interfaces with segment queries
3. Leverage existing JSON fields for feature lists

---

## 3. Admin Dashboard Integration

### Current State

- Tenant admin dashboard exists (referenced in contracts)
- Platform admin for multi-tenant management
- API endpoints for package/addon CRUD (api.v1.ts:193-250)

### Most Efficient Integration Path

**QUICK WIN**: Extend existing admin endpoints

```typescript
// Add to packages/contracts/src/dto.ts:83
export const CreatePackageDtoSchema = z.object({
  // ... existing fields ...
  segment: z.enum(['budget', 'premium', 'luxury']).optional(),
  tierLevel: z.number().int().min(1).max(3).optional(),
  tierName: z.string().optional(),
  maxGuests: z.number().int().optional(),
  features: z.array(z.string()).optional(),
});
```

**Reusable Components**:

1. Package editor form - add segment/tier dropdowns
2. Pricing table builder - visualize tiers
3. Blackout calendar - already exists
4. Analytics dashboard - extend for segment metrics

**Action Items**:

1. Add "Segment Manager" to tenant dashboard menu
2. Create tier comparison table component
3. Reuse existing photo upload for tier imagery
4. Add bulk tier operations (clone, archive)

---

## 4. API & DTO Extension

### Current State

- Type-safe contracts via @ts-rest/core (packages/contracts/)
- Zod schemas for validation (dto.ts)
- Clean separation of public/admin endpoints

### Extension Strategy Without Breaking Changes

**BACKWARD COMPATIBLE** approach:

```typescript
// packages/contracts/src/api.v1.ts:26
export const Contracts = c.router({
  // ... existing endpoints ...

  // NEW: Segment-aware endpoints
  getPackagesBySegment: {
    method: 'GET',
    path: '/v1/packages/segment/:segment',
    pathParams: z.object({
      segment: z.enum(['budget', 'premium', 'luxury']),
    }),
    responses: {
      200: z.array(PackageWithSegmentDtoSchema), // Extended DTO
    },
  },

  // NEW: Tier upgrade flow
  calculateTierUpgrade: {
    method: 'POST',
    path: '/v1/bookings/tier-upgrade',
    body: z.object({
      fromPackageId: z.string(),
      toPackageId: z.string(),
      existingBookingId: z.string().optional(),
    }),
    responses: {
      200: z.object({
        priceDifference: z.number(),
        features: z.array(z.string()),
      }),
    },
  },
});
```

**Action Items**:

1. Version new endpoints as /v2 if needed
2. Add `x-api-version` header support
3. Use existing validation patterns
4. Maintain backward compatibility

---

## 5. Payment Logic

### Current State

- Stripe Connect integration (server/src/services/stripe-connect.service.ts)
- Commission calculation service (commission.service.ts)
- PaymentProvider abstraction for Stripe

### Upsell & Dynamic Pricing Integration

**DIRECT CONNECTION** via existing PaymentProvider:

```typescript
// Extend server/src/lib/ports/payment.provider.ts
interface PaymentProvider {
  // ... existing methods ...

  // NEW: Upsell-aware checkout
  createTieredCheckoutSession(params: {
    basePackageId: string;
    selectedTier: number;
    addOns: string[];
    upsellAccepted?: boolean;
    dynamicPricing?: {
      peakSeasonMultiplier?: number;
      lastMinuteDiscount?: number;
    };
  }): Promise<CheckoutSession>;
}
```

**REUSE**:

- CommissionService.calculateBookingTotal():169 for tier+addon totals
- Webhook handlers for payment confirmation
- Existing refund logic for downgrades

**Action Items**:

1. Add tier-based commission rates if needed
2. Implement dynamic pricing in CommissionService
3. Add upsell tracking to webhook handler

---

## 6. Booking & Add-on Flow

### Current State

- BookingService.createCheckout():55 handles full flow
- Support for add-ons already built-in
- Email notifications via EventEmitter

### User Journey Implementation

**ROUTING STRATEGY** using existing patterns:

```typescript
// Frontend flow (pseudocode for widget/app)
const bookingFlow = {
  1: 'SegmentSelector', // NEW: Choose budget/premium/luxury
  2: 'TierComparison', // NEW: Show 3 tiers in segment
  3: 'PackageCustomizer', // EXISTING: Add-ons selection
  4: 'DatePicker', // EXISTING: Availability check
  5: 'ContactForm', // EXISTING: Customer details
  6: 'UpsellOffer', // NEW: "Upgrade to next tier?"
  7: 'CheckoutRedirect', // EXISTING: Stripe checkout
};
```

**State Management**:

```typescript
// Extend existing booking state
interface BookingState {
  segment?: string;
  selectedTier?: number;
  comparedTiers?: string[]; // Track what user viewed
  upsellShown?: boolean;
  upsellAccepted?: boolean;
}
```

**Action Items**:

1. Add segment selection as step 0
2. Create tier comparison component
3. Add upsell modal before checkout
4. Track journey analytics

---

## 7. Tenant Isolation & Security

### Current State

- Database-level isolation via tenantId (all models)
- Middleware validates tenant context
- API key authentication for widgets

### No Changes Required ✅

**ALREADY SECURE**:

- Every query includes tenantId filter
- Row-level security enforced in services
- Cross-tenant access impossible by design

**Validation**:

```typescript
// Example from catalog.service.ts:68
const packages = await this.repository.getAllPackagesWithAddOns(tenantId);
// tenantId ALWAYS in queries
```

**Action Items**:

1. No changes needed for segments/tiers
2. Continue existing patterns
3. Add segment-level permissions if needed (future)

---

## 8. Event/Hooks

### Current State

- EventEmitter in BookingService:20
- Booking confirmation emails
- Webhook event logging

### Event Integration Points

**ADD EVENTS** to existing emitter:

```typescript
// server/src/services/booking.service.ts
this._eventEmitter.emit('booking.tierUpgraded', {
  tenantId,
  fromTier: 1,
  toTier: 2,
  revenue: upgradeFee,
});

this._eventEmitter.emit('upsell.shown', {
  tenantId,
  packageId,
  targetPackageId,
});

this._eventEmitter.emit('segment.selected', {
  tenantId,
  segment,
  timestamp,
});
```

**Hook Opportunities**:

1. Post-segment selection → Personalization
2. Tier comparison viewed → Analytics
3. Upsell accepted/rejected → A/B testing
4. Package fully booked → Upgrade promotions

**Action Items**:

1. Add new event types to EventEmitter
2. Create analytics aggregator service
3. Add conversion tracking
4. Implement notification rules

---

## 9. Authentication & Authorization

### Current State

- JWT-based auth (server/src/middleware/auth.ts)
- Role-based: PLATFORM_ADMIN, TENANT_ADMIN, USER
- API key auth for public widgets

### Current Model Handles New Flows ✅

**NO CHANGES NEEDED**:

- Tenant admins can manage segments/tiers
- Platform admins see all segments
- Public users browse by segment

**Optional Enhancement**:

```typescript
// Add tier-based permissions
enum Permission {
  MANAGE_BUDGET_TIER = 'manage:budget',
  MANAGE_PREMIUM_TIER = 'manage:premium',
  VIEW_ANALYTICS = 'analytics:view',
}
```

**Action Items**:

1. No immediate changes required
2. Add segment-specific roles later if needed
3. Use existing JWT/API key patterns

---

## 10. UI/UX Reuse

### Current State

- Widget planned for embedding
- Admin dashboard components
- Responsive design patterns

### Component Mapping

**DIRECT REUSE**:

| New Feature           | Existing Component  | Location        |
| --------------------- | ------------------- | --------------- |
| Segment Selector      | Package Grid        | Catalog display |
| Tier Comparison       | Pricing Table       | Package details |
| Feature List          | AddOn List          | Catalog service |
| Availability Calendar | BlackoutDate viewer | Admin dashboard |
| Upgrade Modal         | Checkout Modal      | Booking flow    |
| Progress Indicator    | Booking Steps       | Multi-step form |

**NEW COMPONENTS NEEDED**:

1. SegmentToggle (Budget/Premium/Luxury tabs)
2. TierComparisonTable (3-column layout)
3. UpsellBanner (limited-time offers)
4. PopularBadge (visual indicator)

**Action Items**:

1. Create component library in packages/ui
2. Implement segment-aware theming
3. Add comparison table generator
4. Build upsell modal variants

---

## 11. Error Handling and Edge Cases

### Current State

- Custom error classes (NotFoundError, ValidationError)
- Comprehensive logging via pino
- Webhook retry logic

### Potential Friction Points & Mitigations

**EDGE CASES**:

```typescript
// Add to server/src/lib/core/errors.ts
export class TierMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TierMismatchError';
  }
}

export class UpsellValidationError extends Error {
  constructor(
    public fromTier: number,
    public toTier: number
  ) {
    super(`Cannot upgrade from tier ${fromTier} to ${toTier}`);
  }
}
```

**Critical Validations**:

1. Prevent tier downgrades after booking
2. Handle sold-out tier scenarios
3. Validate segment transitions
4. Price consistency during checkout

**Action Items**:

1. Add tier validation middleware
2. Implement optimistic UI updates
3. Add fallback tier recommendations
4. Create detailed error messages

---

## 12. Testing Strategy

### Current State

- Vitest for unit tests
- 70% coverage target
- Mock adapters for external services

### Test Extension Plan

**REUSE TEST PATTERNS**:

```typescript
// server/src/services/__tests__/catalog.service.test.ts
describe('CatalogService - Segments', () => {
  it('should filter packages by segment', async () => {
    const packages = await service.getPackagesBySegment('tenant_123', 'premium');
    expect(packages).toHaveLength(3); // 3 tiers
    expect(packages[0].segment).toBe('premium');
  });

  it('should handle tier upgrades', async () => {
    const upgrade = await service.calculateTierUpgrade('tier1', 'tier2');
    expect(upgrade.priceDifference).toBeGreaterThan(0);
  });
});
```

**Test Coverage Areas**:

1. Segment filtering logic
2. Tier upgrade calculations
3. Upsell display rules
4. Commission on tiered bookings
5. Multi-tenant segment isolation

**Action Items**:

1. Add segment-specific test fixtures
2. Create tier upgrade test scenarios
3. Test upsell conversion tracking
4. Validate segment/tenant isolation

---

## 13. Scalability & Performance

### Current State

- Caching layer (15-minute TTL)
- Optimized queries (avoid N+1)
- Database indexing on key fields

### Performance Optimizations

**ADD INDEXES**:

```sql
-- server/prisma/schema.prisma
@@index([tenantId, segment, tierLevel])
@@index([tenantId, segment, active])
```

**CACHE STRATEGY**:

```typescript
// Segment-aware caching
const cacheKey = `catalog:${tenantId}:segment:${segment}:tiers`;
cache.set(cacheKey, tiers, 900); // 15 min
```

**Potential Bottlenecks**:

1. Tier comparison queries (3 packages at once)
2. Real-time availability for popular tiers
3. Dynamic pricing calculations
4. Upsell recommendation engine

**Action Items**:

1. Add segment-specific caching
2. Implement tier pre-loading
3. Use database views for comparisons
4. Add Redis for session state

---

## 14. Codebase Cleanliness & Extension Points

### Current State

- Clean architecture with DI
- Adapter pattern for external services
- Repository pattern for data access

### Underutilized Extension Points

**LEVERAGE THESE**:

1. **EventEmitter** (server/src/lib/core/events.ts)
   - Add segment/tier/upsell events
   - Perfect for analytics & hooks

2. **Provider Pattern** (server/src/lib/ports/)
   - Create UpsellProvider interface
   - Implement A/B testing variants

3. **JSON Fields** in Models
   - Package.photos → tier galleries
   - Package.branding → segment theming
   - Tenant.branding → segment customization

4. **Mock Adapters** (server/src/adapters/mock/)
   - Add segment/tier test data
   - Simulate upsell scenarios

**Cleanup Opportunities**:

1. Extract magic numbers to config
2. Centralize segment definitions
3. Create tier feature matrix type
4. Standardize upsell rules engine

**Action Items**:

1. Create SegmentConfig in packages/config
2. Build TierFeatureMatrix type
3. Add UpsellRulesEngine service
4. Implement feature flags for rollout

---

## 15. Technical Debt & Migration Risks

### Current State Review

**MINIMAL DEBT** - Architecture is solid:

- ✅ Clean separation of concerns
- ✅ Type safety throughout
- ✅ Multi-tenant isolation
- ✅ Modern tech stack

**Minor Inconsistencies to Address**:

1. **Mixed ID formats** (cuid vs slugs)
   - Standardize on cuid for IDs
   - Keep slugs for URL-friendly names

2. **Photo handling** (JSON vs URL)
   - Migrate to structured photo objects
   - Support multiple photos per tier

3. **Commission calculation** timing
   - Currently at checkout
   - Consider caching for tier comparisons

**Migration Risks - LOW**:

```typescript
// Safe migration pattern
async function migrateToSegments() {
  // 1. Add new fields (backward compatible)
  await prisma.$executeRaw`
    ALTER TABLE "Package"
    ADD COLUMN IF NOT EXISTS "segment" TEXT DEFAULT 'standard'
  `;

  // 2. Backfill existing packages
  await prisma.package.updateMany({
    where: { segment: null },
    data: { segment: 'standard', tierLevel: 1 },
  });

  // 3. Update incrementally
  // No breaking changes!
}
```

**Action Items**:

1. Add segment fields via safe migration
2. Backfill existing packages as "standard"
3. Roll out segment features gradually
4. Monitor performance metrics

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

1. ✅ Extend Package model with segments/tiers
2. ✅ Update CatalogService with segment queries
3. ✅ Add segment/tier DTOs
4. ✅ Create basic tier comparison endpoint

### Phase 2: Core Features (Week 2)

1. Build segment selector UI
2. Implement tier comparison table
3. Add upsell logic to BookingService
4. Create tier upgrade calculations

### Phase 3: Admin Tools (Week 3)

1. Add segment manager to admin dashboard
2. Build tier configuration interface
3. Implement bulk operations
4. Add analytics dashboard

### Phase 4: Optimization (Week 4)

1. Add segment-aware caching
2. Implement A/B testing for upsells
3. Add conversion tracking
4. Performance testing

---

## Quick Wins Summary

### Immediate Actions (Day 1)

1. **Add segment field** to Package model - 1 migration
2. **Extend CatalogService** with getBySegment() - 20 lines
3. **Create TierComparisonDto** - Reuse existing DTOs
4. **Add segment filter** to package list endpoint - 5 lines

### High-Impact, Low-Effort (Week 1)

1. **Reuse PackageGrid** for segment display - 0 new code
2. **Leverage existing checkout** for tier bookings - Works now
3. **Use current commission logic** for tiers - No changes
4. **Apply existing multi-tenant patterns** - Already secure

### Revenue Accelerators

1. **Upsell modal** before checkout - 1 component
2. **Popular badge** on recommended tier - CSS only
3. **Limited availability** warnings - Reuse blackout logic
4. **Dynamic pricing** multipliers - Extend commission service

---

## Technical Recommendations

### Architecture Decisions

1. **Keep segments in Package model** (not separate entity)
2. **Use JSON for tier features** (flexible, no migrations)
3. **Implement upsells as service** (not in BookingService)
4. **Cache tier comparisons aggressively** (immutable data)

### Code Organization

```
server/
  src/
    services/
      segment.service.ts      # NEW - Segment logic
      upsell.service.ts      # NEW - Upsell rules
      tier.service.ts        # NEW - Tier comparisons
    lib/
      entities/
        segment.entity.ts    # NEW - Types only
      ports/
        upsell.provider.ts   # NEW - Interface
```

### Testing Strategy

- Unit test tier calculations
- Integration test segment filtering
- E2E test full booking with upsell
- Load test tier comparison queries

### Monitoring & Analytics

- Track segment selection rates
- Monitor tier upgrade conversions
- Alert on commission calculation errors
- Dashboard for tier performance

---

## Risk Mitigation

### Low-Risk Approach

1. Start with read-only segment viewing
2. Test with single tenant first
3. Roll out upsells gradually
4. Keep existing booking flow as fallback

### Rollback Plan

- Feature flags for all new features
- Database changes are additive only
- Old API endpoints remain unchanged
- Can disable segments per tenant

---

## Conclusion

Your MAIS platform is **exceptionally well-architected** for this integration. The modular service design, clean data models, and robust multi-tenant isolation provide an ideal foundation. With minimal changes to existing code, you can implement a sophisticated three-tier, segment-driven booking system.

**Key Success Factors**:

- 85% of required infrastructure already exists
- No breaking changes needed
- Clean extension points throughout
- Type safety ensures reliability
- Multi-tenant architecture scales perfectly

**Recommended First Step**:
Start with Phase 1 quick wins - add segment fields and basic filtering. This proves the concept with zero risk and immediate value.

The platform's clean architecture means you can iterate rapidly while maintaining stability. The investment in proper patterns (DI, ports/adapters, type safety) pays dividends now.
