# Plan: Refactor Agent Tools to Use Service Layer

**TODO Reference:** #450 - Agent Tools Bypass Service Layer (P1 - CRITICAL)
**Date:** 2025-12-29
**Estimated Effort:** Large (8-12 hours)
**Risk Level:** Medium

## Problem Statement

All agent read tools, write tools, and executors directly access Prisma instead of going through the established service layer (routes -> services -> adapters -> ports). This violates the layered architecture documented in CLAUDE.md and creates several problems:

1. **Business logic duplication** - Same validation/logic exists in both services and tools
2. **Maintenance burden** - Changes to business rules require updates in multiple places
3. **No code reuse** - Existing services (CatalogService, BookingService, etc.) aren't utilized
4. **Inconsistent behavior** - API paths and agent paths may have different logic
5. **Advisory lock duplication** - `create_booking` executor reimplements advisory locks that BookingService already handles

## Recommended Solution: Inject Services into ToolContext

### Phase 1: Extend ToolContext Interface

Update `/server/src/agent/tools/types.ts`:

```typescript
export interface ToolContext {
  /** Tenant ID from JWT (CRITICAL: never from user input) */
  tenantId: string;
  /** Agent session ID for correlation */
  sessionId: string;
  /** Prisma client for database access (DEPRECATED - use services) */
  prisma: import('../../generated/prisma').PrismaClient;

  // NEW: Injected services for business logic reuse
  services: {
    catalog: CatalogService;
    booking: BookingService;
    availability: AvailabilityService;
    segment: SegmentService;
    landingPage: LandingPageService;
    stripeConnect: StripeConnectService;
  };
}
```

### Phase 2: Wire Services in DI Container

Update `/server/src/di.ts` to expose services for agent use. The Container already has a `services` object that can be passed to orchestrators.

### Phase 3: Refactor Read Tools

**Priority:** High (17 tools, direct prisma access)

| Tool                 | Target Service                     | Method Mapping                          |
| -------------------- | ---------------------------------- | --------------------------------------- |
| `get_tenant`         | TenantRepository (via direct call) | Custom - tenant config only             |
| `get_dashboard`      | DashboardService (NEW)             | Create aggregation service              |
| `get_packages`       | CatalogService                     | `getAllPackages()` / `getPackageById()` |
| `get_addons`         | CatalogService                     | `getAllAddOns()` / `getAddOnById()`     |
| `get_bookings`       | BookingService                     | `getAllBookings()` with filters         |
| `get_booking`        | BookingService                     | `getBookingById()`                      |
| `check_availability` | AvailabilityService                | `checkAvailability()`                   |
| `get_blackouts`      | BlackoutRepository (via service)   | Wrap in new BlackoutService             |
| `get_blackout_dates` | BlackoutRepository (via service)   | Same as above                           |
| `get_landing_page`   | LandingPageService                 | `getConfig()`                           |
| `get_stripe_status`  | StripeConnectService               | `getOnboardingStatus()`                 |
| `get_customers`      | CustomerService (NEW)              | Create customer query service           |
| `get_segments`       | SegmentService                     | `getSegments()` / `getSegmentById()`    |
| `get_trial_status`   | TenantRepository                   | Wrap in TenantService                   |
| `get_booking_link`   | N/A                                | Simple URL generation - keep as-is      |
| `refresh_context`    | DashboardService (NEW)             | Aggregate refresh data                  |

### Phase 4: Refactor Write Tools

**Priority:** Medium (19 tools, create proposals with prisma lookups)

Write tools use ProposalService to create proposals, but still use Prisma directly for validation lookups. These should call services for:

- Existence checks before proposal creation
- Price lookups for preview data
- Ownership verification

| Tool                         | Validation Service    | Notes                            |
| ---------------------------- | --------------------- | -------------------------------- |
| `upsert_package`             | CatalogService        | Check existing package           |
| `upsert_addon`               | CatalogService        | Check existing add-on            |
| `delete_addon`               | CatalogService        | Verify ownership                 |
| `delete_package`             | CatalogService        | Verify ownership, check bookings |
| `manage_blackout`            | BlackoutService (NEW) | Validate date format             |
| `add_blackout_date`          | BlackoutService (NEW) | Check existing blackouts         |
| `remove_blackout_date`       | BlackoutService (NEW) | Verify ownership                 |
| `update_branding`            | TenantService         | Validate colors                  |
| `update_landing_page`        | LandingPageService    | Sanitize content                 |
| `cancel_booking`             | BookingService        | Check booking status             |
| `create_booking`             | BookingService        | Availability check               |
| `process_refund`             | BookingService        | Verify refund eligibility        |
| `update_booking`             | BookingService        | Validate reschedule              |
| `upsert_segment`             | SegmentService        | Check slug uniqueness            |
| `delete_segment`             | SegmentService        | Verify ownership                 |
| `update_deposit_settings`    | TenantService         | Validate percent range           |
| `start_trial`                | TenantService         | Check current status             |
| `initiate_stripe_onboarding` | StripeConnectService  | Check existing account           |

### Phase 5: Refactor Executors

**Priority:** High (most critical - business logic duplication)

| Executor                     | Target Service       | Key Changes                                                              |
| ---------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `upsert_package`             | CatalogService       | Use `createPackage()` / `updatePackage()`                                |
| `delete_package`             | CatalogService       | Use `deletePackage()` (soft delete)                                      |
| `manage_blackout`            | BlackoutService      | Use create/delete methods                                                |
| `add_blackout_date`          | BlackoutService      | Use batch create method                                                  |
| `remove_blackout_date`       | BlackoutService      | Use delete with ownership check                                          |
| `update_branding`            | TenantService        | Use update method                                                        |
| `update_landing_page`        | LandingPageService   | Use `updateConfig()`                                                     |
| `upsert_addon`               | CatalogService       | Use `createAddOn()` / `updateAddOn()`                                    |
| `delete_addon`               | CatalogService       | Use `deleteAddOn()`                                                      |
| `cancel_booking`             | BookingService       | Use `cancelBooking()`                                                    |
| `create_booking`             | BookingService       | **CRITICAL**: Remove duplicate advisory lock logic, use existing service |
| `process_refund`             | BookingService       | Use `processRefund()`                                                    |
| `upsert_segment`             | SegmentService       | Use `createSegment()` / `updateSegment()`                                |
| `delete_segment`             | SegmentService       | Use `deleteSegment()`                                                    |
| `update_booking`             | BookingService       | Use `rescheduleBooking()`                                                |
| `update_deposit_settings`    | TenantService        | Use update method                                                        |
| `start_trial`                | TenantService        | Use trial start method                                                   |
| `initiate_stripe_onboarding` | StripeConnectService | Keep - already uses service                                              |

## New Services Required

### 1. BlackoutService

Currently blackouts are managed directly via repository. Create a thin service:

```typescript
// server/src/services/blackout.service.ts
export class BlackoutService {
  constructor(
    private readonly blackoutRepo: BlackoutRepository,
    private readonly cache?: CacheServicePort
  ) {}

  async getBlackouts(tenantId: string, dateRange?: { from?: Date; to?: Date }): Promise<Blackout[]>;
  async isBlackoutDate(tenantId: string, date: string): Promise<boolean>;
  async createBlackout(tenantId: string, date: string, reason?: string): Promise<Blackout>;
  async createBlackouts(tenantId: string, dates: string[], reason?: string): Promise<number>;
  async deleteBlackout(tenantId: string, id: string): Promise<void>;
}
```

### 2. DashboardService

Aggregates dashboard metrics currently computed ad-hoc in tools:

```typescript
// server/src/services/dashboard.service.ts
export class DashboardService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly catalogRepo: CatalogRepository,
    private readonly cache?: CacheServicePort
  ) {}

  async getDashboardMetrics(tenantId: string): Promise<DashboardMetrics>;
  async refreshContext(tenantId: string): Promise<RefreshContextData>;
}
```

### 3. TenantService (expand existing)

Extend TenantAuthService or create new TenantService for tenant-level operations:

```typescript
// server/src/services/tenant.service.ts
export class TenantService {
  async getTenantProfile(tenantId: string): Promise<TenantProfile>;
  async updateBranding(tenantId: string, branding: BrandingInput): Promise<Tenant>;
  async updateDepositSettings(tenantId: string, settings: DepositSettings): Promise<Tenant>;
  async startTrial(tenantId: string): Promise<Tenant>;
  async getTrialStatus(tenantId: string): Promise<TrialStatus>;
}
```

### 4. CustomerService

Query service for customer data:

```typescript
// server/src/services/customer.service.ts
export class CustomerService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cache?: CacheServicePort
  ) {}

  async getCustomers(tenantId: string, filters?: CustomerFilters): Promise<CustomerWithStats[]>;
  async getCustomerById(tenantId: string, id: string): Promise<CustomerWithStats | null>;
}
```

## Implementation Order

1. **Week 1: Foundation**
   - Create new services (BlackoutService, DashboardService, TenantService, CustomerService)
   - Extend ToolContext with services interface
   - Wire services in DI container
   - Add services to agent orchestrator

2. **Week 2: Read Tools**
   - Refactor all 17 read tools to use services
   - Maintain backward compatibility
   - Add unit tests for service integration

3. **Week 3: Write Tools + Executors**
   - Refactor write tool validation to use services
   - Refactor executors to delegate to services
   - **Critical**: Remove duplicate advisory lock from create_booking executor
   - Add integration tests

4. **Week 4: Cleanup**
   - Remove direct Prisma access from tools
   - Deprecate `prisma` field in ToolContext
   - Update documentation
   - Performance testing

## Acceptance Criteria

- [ ] Tools call services instead of Prisma directly
- [ ] No duplicate business logic between tools and services
- [ ] Tests pass with mocked services
- [ ] Advisory lock logic removed from executor (reuses BookingService)
- [ ] All existing tool functionality preserved
- [ ] No regression in API behavior
- [ ] TypeCheck passes: `npm run typecheck`
- [ ] All tests pass: `npm test`

## Risk Mitigation

1. **Incremental refactoring**: Do one tool at a time, verify tests pass
2. **Feature flags**: Can add `USE_SERVICE_LAYER` env var to toggle behavior
3. **Integration tests**: Existing E2E tests cover agent functionality
4. **Rollback plan**: Each phase is independently deployable

## Files to Modify

### Core Changes

- `server/src/agent/tools/types.ts` - Extend ToolContext
- `server/src/agent/tools/read-tools.ts` - Use services
- `server/src/agent/tools/write-tools.ts` - Use services for validation
- `server/src/agent/executors/index.ts` - Delegate to services
- `server/src/di.ts` - Wire services for agent

### New Files

- `server/src/services/blackout.service.ts`
- `server/src/services/dashboard.service.ts`
- `server/src/services/tenant.service.ts`
- `server/src/services/customer.service.ts`

### Test Files

- `server/test/agent/tools/read-tools.test.ts` - Mock services
- `server/test/agent/tools/write-tools.test.ts` - Mock services
- `server/test/agent/executors/index.test.ts` - Mock services

## Dependencies

- No external dependencies
- Internal: Services from DI container
- No database migrations required

## Sign-off

- [ ] Architecture review completed
- [ ] Plan approved by tech lead
- [ ] Estimated effort validated
