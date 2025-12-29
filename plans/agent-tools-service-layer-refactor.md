# TODO-450: Agent Tools Service Layer Refactor

> **STATUS: REJECTED (Won't Fix)**
>
> **Decision Date:** 2025-12-28
>
> **Reason:** The proposal/executor pattern already IS the agent service layer. Adding domain services would fragment a well-designed architecture. See `docs/solutions/agent-design/AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md` for full rationale.
>
> **Reviewers:** DHH (REJECT), Kieran (CONDITIONAL), Code Simplicity (REJECT), Agent-Native (REJECT)

---

## Original Proposal (Archived)

Refactor agent tools in `server/src/agent/tools/` to use the existing service layer instead of direct Prisma queries. This eliminates code duplication, ensures consistent behavior between agent tools and API endpoints, and improves maintainability.

**Priority:** P1 (Architectural Debt)
**Estimated Scope:** 34 tools across 2 files (~3,100 lines of code)
**Risk Level:** Medium (requires careful testing to avoid agent regression)

---

## Problem Statement

Agent tools bypass the carefully-constructed service layer:

```typescript
// CURRENT (Direct Prisma) - read-tools.ts:49-68
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: {
    /* 15 fields */
  },
});

// SHOULD BE (Service Layer)
const tenant = await tenantService.getProfile(tenantId);
```

### Why This Matters

| Problem                   | Impact                           | Example                                                             |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| **Code Duplication**      | Same logic in 2 places           | Slug uniqueness validation in CatalogService vs upsert_package tool |
| **Inconsistent Behavior** | API and agent behave differently | API emits events on booking; agent tool doesn't                     |
| **Missing Validation**    | Agent bypasses service rules     | CatalogService checks slug format; tool writes directly             |
| **Harder Maintenance**    | Changes need 2 updates           | Adding audit logging requires modifying both                        |
| **Testing Gaps**          | Services tested; tools aren't    | 85% service coverage vs 0% tool coverage                            |

### Example of Missing Logic

`CatalogService.updatePackage()` provides:

- Slug uniqueness validation
- Price change audit logging
- Event emission for downstream systems
- Cache invalidation

`upsert_package` tool does none of this - it just creates a proposal with raw data.

---

## Proposed Solution

Extend `ToolContext` to include services, then refactor each tool to delegate to services instead of Prisma.

### Architecture Change

```typescript
// BEFORE: types.ts
export interface ToolContext {
  tenantId: string;
  sessionId: string;
  prisma: PrismaClient;
}

// AFTER: types.ts
export interface ToolContext {
  tenantId: string;
  sessionId: string;
  prisma: PrismaClient;
  services: ToolServices; // NEW
}

export interface ToolServices {
  catalog: CatalogService;
  booking: BookingService;
  bookingQuery: BookingQueryService;
  availability: AvailabilityService;
  segment: SegmentService;
  refundProcessing: RefundProcessingService;
  landingPage: LandingPageService;
  stripeConnect: StripeConnectService;
}
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] All 16 read tools use services instead of direct Prisma queries
- [ ] All 18 write tools validate through services before creating proposals
- [ ] `ToolContext` extended with service injection
- [ ] `di.ts` updated to wire services into orchestrator
- [ ] All existing tool functionality preserved (no regression)

### Non-Functional Requirements

- [ ] No performance degradation (services already use caching)
- [ ] Maintain tenant isolation (services enforce this)
- [ ] Error messages remain user-friendly
- [ ] Test coverage for refactored tools

### Quality Gates

- [ ] All 771 existing tests pass
- [ ] New unit tests for each refactored tool
- [ ] E2E agent conversation tests pass
- [ ] Code review approval

---

## Technical Approach

### Phase 1: Infrastructure (Foundation)

**Goal:** Extend ToolContext and DI wiring without breaking existing functionality.

#### 1.1 Extend ToolContext Interface

```typescript
// server/src/agent/tools/types.ts

export interface ToolServices {
  catalog: CatalogService;
  booking: BookingService;
  bookingQuery: BookingQueryService;
  availability: AvailabilityService;
  segment: SegmentService;
  refundProcessing: RefundProcessingService;
  landingPage: LandingPageService;
  stripeConnect: StripeConnectService;
}

export interface ToolContext {
  tenantId: string;
  sessionId: string;
  prisma: PrismaClient;
  services: ToolServices;
}
```

#### 1.2 Update DI Container

```typescript
// server/src/di.ts

export interface Container {
  // ... existing fields
  toolServices: ToolServices; // NEW
}

// In buildContainer():
const toolServices: ToolServices = {
  catalog: catalogService,
  booking: bookingService,
  bookingQuery: new BookingQueryService({ bookingRepo }),
  availability: availabilityService,
  segment: segmentService,
  refundProcessing: new RefundProcessingService(bookingRepo, paymentProvider, eventEmitter),
  landingPage: landingPageService,
  stripeConnect: stripeConnectService,
};
```

#### 1.3 Update Orchestrator

```typescript
// server/src/agent/orchestrator/orchestrator.ts

export class AgentOrchestrator {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly toolServices: ToolServices, // NEW
    config: Partial<OrchestratorConfig> = {}
  ) {}

  private buildToolContext(tenantId: string, sessionId: string): ToolContext {
    return {
      tenantId,
      sessionId,
      prisma: this.prisma,
      services: this.toolServices, // NEW
    };
  }
}
```

**Files to modify:**

- `server/src/agent/tools/types.ts`
- `server/src/di.ts`
- `server/src/agent/orchestrator/orchestrator.ts`
- `server/src/routes/agent-chat.routes.ts` (if orchestrator instantiation changes)

---

### Phase 2: Read Tools Refactor

**Goal:** Convert all 16 read tools to use services.

#### Tool-to-Service Mapping

| Tool                 | Current Pattern                | Target Service            | Method                              |
| -------------------- | ------------------------------ | ------------------------- | ----------------------------------- |
| `get_tenant`         | `prisma.tenant.findUnique`     | TenantService (new)       | `getProfile(tenantId)`              |
| `get_dashboard`      | Multiple Prisma aggregates     | DashboardService (new)    | `getDashboard(tenantId)`            |
| `get_packages`       | `prisma.package.findMany`      | CatalogService            | `getAllPackages(tenantId)`          |
| `get_bookings`       | `prisma.booking.findMany`      | BookingQueryService       | `getAllBookings(tenantId)`          |
| `get_booking`        | `prisma.booking.findFirst`     | BookingQueryService       | `getBookingById(tenantId, id)`      |
| `check_availability` | Multiple Prisma queries        | AvailabilityService       | `checkAvailability(tenantId, date)` |
| `get_blackouts`      | `prisma.blackoutDate.findMany` | BlackoutService (new)     | `getBlackouts(tenantId)`            |
| `get_landing_page`   | `prisma.tenant.findUnique`     | LandingPageService        | `getDraft(tenantId)`                |
| `get_stripe_status`  | `prisma.tenant.findUnique`     | StripeConnectService      | `getAccountStatus(tenantId)`        |
| `get_addons`         | `prisma.addOn.findMany`        | CatalogService            | `getAllAddOns(tenantId)`            |
| `get_customers`      | Complex aggregation            | CustomerService (new)     | `getCustomers(tenantId, filters)`   |
| `get_segments`       | `prisma.segment.findMany`      | SegmentService            | `getSegments(tenantId)`             |
| `get_trial_status`   | `prisma.tenant.findUnique`     | SubscriptionService (new) | `getTrialStatus(tenantId)`          |
| `get_booking_link`   | `prisma.tenant.findUnique`     | TenantService (new)       | `getBookingLink(tenantId)`          |
| `refresh_context`    | Context builder                | ContextService (new)      | `refreshContext(tenantId)`          |
| `get_blackout_dates` | Alias for get_blackouts        | BlackoutService (new)     | `getBlackouts(tenantId)`            |

#### New Services Required

Some read tools need new services (or service methods) that don't exist yet:

1. **TenantService** - For `get_tenant`, `get_booking_link`, `get_trial_status`
2. **DashboardService** - For `get_dashboard` aggregations
3. **CustomerService** - For `get_customers` with aggregation
4. **BlackoutService** - For blackout date management (may already exist as repository)

**Decision:** Create thin services that wrap existing repositories, OR extend existing services with missing methods.

#### Example Refactor: get_packages

```typescript
// BEFORE: read-tools.ts
async execute(context: ToolContext): Promise<AgentToolResult> {
  const { tenantId, prisma } = context;
  const packages = await prisma.package.findMany({
    where: { tenantId, active: true },
    include: { addOns: true },
    take: 50,
  });
  return { success: true, data: packages };
}

// AFTER: read-tools.ts
async execute(context: ToolContext): Promise<AgentToolResult> {
  const { tenantId, services } = context;
  try {
    const packages = await services.catalog.getAllPackages(tenantId);
    return { success: true, data: packages };
  } catch (error) {
    return handleToolError(error, 'get_packages', tenantId, 'Failed to fetch packages');
  }
}
```

**Files to modify:**

- `server/src/agent/tools/read-tools.ts` (all 16 tools)
- `server/src/services/tenant.service.ts` (new or extend)
- `server/src/services/dashboard.service.ts` (new)
- `server/src/services/customer.service.ts` (new)

---

### Phase 3: Write Tools Refactor

**Goal:** Convert all 18 write tools to validate through services before creating proposals.

#### Tool-to-Service Mapping

| Tool                         | Current Pattern              | Target Service          | Method                                    |
| ---------------------------- | ---------------------------- | ----------------------- | ----------------------------------------- |
| `upsert_package`             | Direct validation + proposal | CatalogService          | `validatePackageData()` then proposal     |
| `upsert_addon`               | Direct validation + proposal | CatalogService          | `validateAddOnData()` then proposal       |
| `delete_addon`               | Ownership check + proposal   | CatalogService          | `validateDelete()` then proposal          |
| `delete_package`             | Ownership check + proposal   | CatalogService          | `validateDelete()` then proposal          |
| `add_blackout_date`          | Direct proposal              | BlackoutService         | `validateBlackout()` then proposal        |
| `remove_blackout_date`       | Ownership check + proposal   | BlackoutService         | `validateRemove()` then proposal          |
| `update_branding`            | Direct proposal              | TenantService           | `validateBranding()` then proposal        |
| `update_landing_page`        | Direct proposal              | LandingPageService      | `validateConfig()` then proposal          |
| `cancel_booking`             | Ownership check + proposal   | BookingService          | `validateCancellation()` then proposal    |
| `create_booking`             | Direct proposal              | BookingService          | `validateBookingData()` then proposal     |
| `process_refund`             | Ownership check + proposal   | RefundProcessingService | `validateRefund()` then proposal          |
| `upsert_segment`             | Direct proposal              | SegmentService          | `validateSegment()` then proposal         |
| `delete_segment`             | Ownership check + proposal   | SegmentService          | `validateDelete()` then proposal          |
| `update_booking`             | Ownership check + proposal   | BookingService          | `validateUpdate()` then proposal          |
| `update_deposit_settings`    | Direct proposal              | TenantService           | `validateDepositSettings()` then proposal |
| `start_trial`                | Direct proposal              | SubscriptionService     | `validateTrialStart()` then proposal      |
| `initiate_stripe_onboarding` | Direct proposal              | StripeConnectService    | `validateOnboarding()` then proposal      |
| `request_file_upload`        | Direct proposal              | UploadService           | `validateUploadRequest()` then proposal   |

#### Important: Keep Proposal Mechanism

Write tools should NOT directly call service mutation methods. They should:

1. Use services for **validation** (ownership, business rules)
2. Continue using **ProposalService** for the actual mutation

```typescript
// Example: upsert_package refactored
async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
  const { tenantId, services } = context;
  const packageId = params.packageId as string | undefined;

  try {
    // 1. Validate through service (includes ownership check)
    const validation = await services.catalog.validatePackageUpsert(tenantId, {
      id: packageId,
      name: params.title as string,
      basePrice: params.priceCents as number,
      // ... other fields
    });

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 2. Determine trust tier based on service analysis
    const trustTier = validation.significantPriceChange ? 'T3' : 'T2';

    // 3. Create proposal (unchanged mechanism)
    return createProposal(
      context,
      'upsert_package',
      validation.operation,
      trustTier,
      validation.payload,
      validation.preview
    );
  } catch (error) {
    return handleToolError(error, 'upsert_package', tenantId, 'Failed to create package proposal');
  }
}
```

**Files to modify:**

- `server/src/agent/tools/write-tools.ts` (all 18 tools)
- Various services to add `validate*()` methods

---

### Phase 4: Testing & Validation

**Goal:** Ensure no regression in agent behavior.

#### 4.1 Unit Tests for Tools

Create comprehensive unit tests for each tool:

```typescript
// server/test/agent/tools/read-tools.test.ts
describe('get_packages tool', () => {
  it('delegates to CatalogService', async () => {
    const mockCatalog = {
      getAllPackages: vi.fn().mockResolvedValue([
        /* packages */
      ]),
    };
    const context = createTestContext({ services: { catalog: mockCatalog } });

    await getPackagesTool.execute(context, {});

    expect(mockCatalog.getAllPackages).toHaveBeenCalledWith(context.tenantId);
  });

  it('handles service errors gracefully', async () => {
    const mockCatalog = { getAllPackages: vi.fn().mockRejectedValue(new Error('DB error')) };
    const context = createTestContext({ services: { catalog: mockCatalog } });

    const result = await getPackagesTool.execute(context, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch packages');
  });
});
```

#### 4.2 Integration Tests

Verify end-to-end agent conversations work:

```typescript
// server/test/agent/integration/agent-flow.test.ts
describe('Agent tool integration', () => {
  it('agent can list packages using catalog service', async () => {
    const { container } = await buildTestContainer();
    const orchestrator = new AgentOrchestrator(container.prisma, container.toolServices);

    const response = await orchestrator.chat(tenantId, 'Show me my packages');

    expect(response.toolCalls).toContainEqual(expect.objectContaining({ name: 'get_packages' }));
  });
});
```

#### 4.3 E2E Agent Tests

Add Playwright tests for critical agent flows:

```typescript
// e2e/tests/agent-conversation.spec.ts
test('agent can help create a package', async ({ page }) => {
  await page.goto('/dashboard');
  await page.click('[data-testid="agent-chat-button"]');
  await page.fill('[data-testid="chat-input"]', 'Help me create a new package');
  await page.click('[data-testid="send-button"]');

  await expect(page.locator('[data-testid="agent-response"]')).toContainText('package');
});
```

---

## Implementation Checklist

### Phase 1: Infrastructure

- [ ] Define `ToolServices` interface in `types.ts`
- [ ] Extend `ToolContext` with `services` field
- [ ] Update `Container` interface in `di.ts`
- [ ] Wire services in `buildContainer()`
- [ ] Update orchestrator constructor and context building
- [ ] Update any route handlers that instantiate orchestrator
- [ ] Add unit test for context injection

### Phase 2: Read Tools

- [ ] `get_tenant` → TenantService
- [ ] `get_dashboard` → DashboardService
- [ ] `get_packages` → CatalogService
- [ ] `get_bookings` → BookingQueryService
- [ ] `get_booking` → BookingQueryService
- [ ] `check_availability` → AvailabilityService
- [ ] `get_blackouts` → BlackoutService
- [ ] `get_landing_page` → LandingPageService
- [ ] `get_stripe_status` → StripeConnectService
- [ ] `get_addons` → CatalogService
- [ ] `get_customers` → CustomerService
- [ ] `get_segments` → SegmentService
- [ ] `get_trial_status` → SubscriptionService
- [ ] `get_booking_link` → TenantService
- [ ] `refresh_context` → ContextService
- [ ] `get_blackout_dates` → BlackoutService

### Phase 3: Write Tools

- [ ] `upsert_package` → CatalogService.validatePackageUpsert()
- [ ] `upsert_addon` → CatalogService.validateAddOnUpsert()
- [ ] `delete_addon` → CatalogService.validateDelete()
- [ ] `delete_package` → CatalogService.validateDelete()
- [ ] `add_blackout_date` → BlackoutService.validateBlackout()
- [ ] `remove_blackout_date` → BlackoutService.validateRemove()
- [ ] `update_branding` → TenantService.validateBranding()
- [ ] `update_landing_page` → LandingPageService.validateConfig()
- [ ] `cancel_booking` → BookingService.validateCancellation()
- [ ] `create_booking` → BookingService.validateBookingData()
- [ ] `process_refund` → RefundProcessingService.validateRefund()
- [ ] `upsert_segment` → SegmentService.validateSegment()
- [ ] `delete_segment` → SegmentService.validateDelete()
- [ ] `update_booking` → BookingService.validateUpdate()
- [ ] `update_deposit_settings` → TenantService.validateDepositSettings()
- [ ] `start_trial` → SubscriptionService.validateTrialStart()
- [ ] `initiate_stripe_onboarding` → StripeConnectService.validateOnboarding()
- [ ] `request_file_upload` → UploadService.validateUploadRequest()

### Phase 4: Testing

- [ ] Unit tests for all 16 read tools
- [ ] Unit tests for all 18 write tools
- [ ] Integration tests for tool context injection
- [ ] E2E tests for agent conversation flows
- [ ] Run full test suite (771+ tests)
- [ ] Manual agent conversation testing

---

## Risk Analysis & Mitigation

| Risk                      | Likelihood | Impact | Mitigation                                                |
| ------------------------- | ---------- | ------ | --------------------------------------------------------- |
| Agent regression          | Medium     | High   | Comprehensive testing, phased rollout                     |
| Service interface changes | Low        | Medium | Add methods to existing services, don't modify signatures |
| Performance degradation   | Low        | Low    | Services already use caching; no new queries              |
| Test flakiness            | Medium     | Medium | Use dependency injection for mocking                      |
| Missing service methods   | High       | Medium | Create new validation methods as needed                   |

---

## Success Metrics

1. **Code Duplication Eliminated:** 0 direct Prisma calls in agent tools
2. **Test Coverage:** >80% coverage on refactored tools
3. **Regression:** 0 failing tests after refactor
4. **Performance:** No measurable latency increase in agent responses
5. **Maintainability:** Single source of truth for business logic (services)

---

## Dependencies & Prerequisites

1. **Existing Services:** CatalogService, BookingService, AvailabilityService, SegmentService, LandingPageService, StripeConnectService
2. **New Services (may need creation):**
   - TenantService (tenant profile, booking links)
   - DashboardService (aggregations)
   - CustomerService (customer queries)
   - BlackoutService (blackout management)
   - SubscriptionService (trial status)
3. **Testing Infrastructure:** Vitest, mock context helpers

---

## Documentation Updates Required

- [ ] Update `CLAUDE.md` with new agent tool architecture
- [ ] Add prevention strategy for direct Prisma in tools
- [ ] Document ToolServices interface in code comments
- [ ] Update any agent-related ADRs

---

## References

### Internal References

- Service layer patterns: `docs/solutions/best-practices/service-layer-patterns-MAIS-20251204.md`
- DI container: `server/src/di.ts`
- Current tool types: `server/src/agent/tools/types.ts`
- Read tools: `server/src/agent/tools/read-tools.ts`
- Write tools: `server/src/agent/tools/write-tools.ts`
- Orchestrator: `server/src/agent/orchestrator/orchestrator.ts`

### Services Documentation

- CatalogService: `server/src/services/catalog.service.ts`
- BookingService: `server/src/services/booking.service.ts`
- BookingQueryService: `server/src/services/booking-query.service.ts`
- AvailabilityService: `server/src/services/availability.service.ts`
- SegmentService: `server/src/services/segment.service.ts`
- RefundProcessingService: `server/src/services/refund-processing.service.ts`
- LandingPageService: `server/src/services/landing-page.service.ts`
- StripeConnectService: `server/src/services/stripe-connect.service.ts`

---

_Plan generated: 2025-12-28_
