---
status: complete
priority: p1
issue_id: "044"
tags: [code-review, scheduling, architecture, type-safety, critical]
dependencies: []
---

# CRITICAL: Interface Mismatch Between Scheduling Service and Ports

## Problem Statement

The `SchedulingAvailabilityService` defines LOCAL interface contracts that DON'T MATCH the canonical interfaces in `ports.ts`. The Prisma repository implementations implement `ports.ts`, not these local definitions. This causes silent runtime failures despite TypeScript compilation success.

**Why this matters:** The service calls methods like `serviceRepo.findById()` which DON'T EXIST on `PrismaServiceRepository` (it has `getById()`). TypeScript is bypassed with `as any` assertions, hiding the mismatch.

## Findings

### Code Evidence - Interface Definitions

**Local interfaces in service** (`server/src/services/scheduling-availability.service.ts:45-74`):

```typescript
interface ServiceRepository {
  findById(tenantId: string, serviceId: string): Promise<SchedulingService | null>;
  findBySlug(tenantId: string, slug: string): Promise<SchedulingService | null>;
  findAll(tenantId: string, options?: { active?: boolean }): Promise<SchedulingService[]>;
}

interface AvailabilityRuleRepository {
  findByService(tenantId: string, serviceId: string, date: Date): Promise<AvailabilityRule[]>;
  findEffectiveRules(tenantId: string, serviceId: string | null, date: Date): Promise<AvailabilityRule[]>;
}
```

**Canonical interfaces in ports** (`server/src/lib/ports.ts`):

```typescript
interface ServiceRepository {
  getAll(tenantId: string, includeInactive?: boolean): Promise<Service[]>;
  getActiveServices(tenantId: string): Promise<Service[]>;
  getBySlug(tenantId: string, slug: string): Promise<Service | null>;
  getById(tenantId: string, id: string): Promise<Service | null>;  // NOT findById!
  create(tenantId: string, data: CreateServiceInput): Promise<Service>;
  update(tenantId: string, id: string, data: UpdateServiceInput): Promise<Service>;
  delete(tenantId: string, id: string): Promise<void>;
}

interface AvailabilityRuleRepository {
  getAll(tenantId: string): Promise<AvailabilityRule[]>;
  getByService(tenantId: string, serviceId: string | null): Promise<AvailabilityRule[]>;
  getByDayOfWeek(tenantId: string, dayOfWeek: number, serviceId?: string | null): Promise<AvailabilityRule[]>;
  getEffectiveRules(tenantId: string, date: Date, serviceId?: string | null): Promise<AvailabilityRule[]>;  // Different signature!
  // ...
}
```

### Method Name Mismatches

| Service Calls | ports.ts Has | Status |
|---------------|--------------|--------|
| `findById()` | `getById()` | ❌ MISMATCH |
| `findBySlug()` | `getBySlug()` | ❌ MISMATCH |
| `findAll()` | `getAll()` | ❌ MISMATCH |
| `findEffectiveRules(tenantId, serviceId, date)` | `getEffectiveRules(tenantId, date, serviceId?)` | ❌ PARAM ORDER |

### DI Bypasses Type Safety

**Location:** `server/src/di.ts:161-162` and `330-331`

```typescript
const schedulingAvailabilityService = new SchedulingAvailabilityService(
  serviceRepo as any,  // ← TYPE SAFETY BYPASSED
  availabilityRuleRepo as any,  // ← TYPE SAFETY BYPASSED
  bookingRepo
);
```

### Runtime Failure Example

When service calls `this.serviceRepo.findById(tenantId, serviceId)`:
1. TypeScript sees local interface with `findById()` - compiles OK
2. At runtime, `PrismaServiceRepository` has `getById()`, not `findById()`
3. `undefined is not a function` error

## Proposed Solutions

### Option A: Align Service with ports.ts (Recommended)
**Effort:** Medium | **Risk:** Low

1. Remove local interface definitions from `scheduling-availability.service.ts`
2. Import interfaces from `ports.ts`
3. Update method calls to match ports.ts naming convention
4. Remove `as any` assertions in `di.ts`

```typescript
// scheduling-availability.service.ts
import { ServiceRepository, AvailabilityRuleRepository } from '../lib/ports';

export class SchedulingAvailabilityService {
  constructor(
    private readonly serviceRepo: ServiceRepository,
    private readonly availabilityRuleRepo: AvailabilityRuleRepository,
    private readonly bookingRepo: BookingRepository
  ) {}

  // Update all calls:
  // this.serviceRepo.findById() → this.serviceRepo.getById()
  // this.availabilityRuleRepo.findEffectiveRules(tenantId, serviceId, date)
  //   → this.availabilityRuleRepo.getEffectiveRules(tenantId, date, serviceId)
}
```

**Pros:**
- Restores type safety
- Follows existing codebase patterns
- Removes technical debt

**Cons:**
- Need to update all method calls in service

### Option B: Extend ports.ts to Match Service
**Effort:** Large | **Risk:** Medium

Add missing methods to ports.ts interfaces:
```typescript
interface ServiceRepository {
  // existing methods...
  findById(tenantId: string, id: string): Promise<Service | null>;  // alias for getById
}
```

**Pros:**
- Doesn't require changing service code

**Cons:**
- Creates duplicate methods
- Inconsistent with codebase conventions
- Larger change surface

## Recommended Action

Implement **Option A** - Align scheduling service with existing ports.ts interfaces.

## Technical Details

**Files to Update:**
1. `server/src/services/scheduling-availability.service.ts`
   - Remove lines 45-74 (local interface definitions)
   - Import from `ports.ts`
   - Update all method calls

2. `server/src/di.ts`
   - Remove `as any` assertions (lines 161-162, 330-331)

**Method Call Updates:**
```typescript
// Line ~142
- const service = await this.serviceRepo.findById(tenantId, serviceId);
+ const service = await this.serviceRepo.getById(tenantId, serviceId);

// Line ~155
- const rules = await this.availabilityRuleRepo.findEffectiveRules(tenantId, serviceId, date);
+ const rules = await this.availabilityRuleRepo.getEffectiveRules(tenantId, date, serviceId);
```

## Acceptance Criteria

- [ ] Local interface definitions removed from scheduling-availability.service.ts
- [ ] Service imports interfaces from ports.ts
- [ ] All method calls updated to match ports.ts naming
- [ ] `as any` assertions removed from di.ts
- [ ] TypeScript compiles without errors
- [ ] All existing tests pass
- [ ] New unit test verifies service instantiation with real repositories

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during Architecture Strategist review - BLOCKS MERGE |

## Resources

- Architecture Strategist analysis
- ports.ts interface definitions
- Existing repository implementations follow `get*` naming convention
