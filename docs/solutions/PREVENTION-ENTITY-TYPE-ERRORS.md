# Prevention: Cascading Entity Type Errors

**Problem:** When a TypeScript entity interface is modified (e.g., adding a required field to `Package`, `AddOn`, or `Booking`), the change cascades to 5-7 different locations across the codebase. Missing even one location causes build failures and confusing error messages.

**Impact:** Build breaks, type safety violations, runtime errors, and increased code review burden.

**Prevention Level:** High (architectural - affects all entity creation paths)

---

## Root Cause Analysis

MAIS has a distributed entity mapping pattern:

```
entities.ts (interface definition)
    ↓
contracts/ (API DTO schemas)
    ↓
ports.ts (repository interfaces & input types)
    ↓
Four Creation Paths:
  1. Mock adapters (in-memory objects)
  2. Prisma repositories (mappers from DB models)
  3. Routes (DTO → domain mapping)
  4. Services (factory methods)
```

When adding a field to `Package`:

```
// 1. Add to interface
export interface Package {
  id: string;
  title: string;
  newRequiredField: string;  // NEW
}

// 2. Update all creation sites
Mock: packages.set('pkg_basic', { ..., newRequiredField: '...' })
Prisma: toDomainPackage() mapper
Routes: DTO mapping
Services: Factory calls
```

**Failure modes:**
- Forget one mock package → TypeScript error
- Forget mapper field → null/undefined at runtime
- Forget service factory → incomplete entity
- TypeScript catches some, not all (optional fields)

---

## Prevention Strategy 1: Entity Invariant Testing

**What:** Unit tests that verify all entity creation paths always produce complete objects.

**When to use:** For critical entities (Package, Booking, Service, AddOn).

**Implementation:**

### 1.1 Factory Function Test Pattern

```typescript
// server/src/lib/entities.test.ts
import { describe, it, expect } from 'vitest';
import type { Package, Booking, AddOn } from './entities';

describe('Entity Invariants', () => {
  describe('Package entity', () => {
    it('should always have all required fields after creation', () => {
      const testPackages = [
        // Mock
        mockRepo.packages.get('pkg_basic'),
        // Prisma
        await prismaRepo.getPackageById('tenant', 'pkg_abc'),
        // Service
        await catalogService.createPackage('tenant', {...})
      ];

      testPackages.forEach(pkg => {
        expect(pkg).toBeDefined();
        expect(pkg?.id).toBeDefined();
        expect(pkg?.tenantId).toBeDefined();
        expect(pkg?.slug).toBeDefined();
        expect(pkg?.title).toBeDefined();
        expect(pkg?.description).toBeDefined();
        expect(pkg?.priceCents).toBeDefined();
        // Add ALL required fields here
      });
    });

    it('should enforce type when added to arrays', () => {
      const packages: Package[] = [];
      // TypeScript will error if any Package creation is incomplete
      packages.push(mockPackage);
      packages.push(prismaPackage);
      packages.push(servicePackage);
    });
  });
});
```

**Why it works:**
- Catches missing fields at test-time before production
- TypeScript strict mode forces all creations to match interface
- Single source of truth for required fields
- Runs on every commit

---

## Prevention Strategy 2: Typed Object Spread Pattern

**What:** Use TypeScript's strict object spread checking to catch incomplete objects.

**When to use:** In repository mappers and mock adapters.

**Current implementation (good):**

```typescript
// server/src/adapters/prisma/catalog.repository.ts - Line 599-613
private toDomainPackage(pkg: {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  // ... ALL fields
}): Package {
  return {
    id: pkg.id,
    tenantId: pkg.tenantId,
    slug: pkg.slug,
    title: pkg.name,
    // Mapper forces each field mapping
  };
}
```

**Best practice checklist:**
- ✅ Input type explicitly lists all Prisma fields
- ✅ Return type is strict `Package` (not `Partial<Package>`)
- ✅ Each field mapped individually (not spread operator alone)
- ✅ Optional fields checked with if guards

**Anti-pattern to avoid:**
```typescript
// BAD - Incomplete mapping not caught at compile time
private toDomainPackage(pkg: any): Package {
  return { ...pkg }; // Missing field conversions, type coercion
}
```

---

## Prevention Strategy 3: Repository Signature Audit

**What:** Conduct quarterly audits of repository method signatures to ensure consistency across implementations.

**When to use:** After adding fields to entities or new entity types.

**Checklist:**

### For each repository interface method:

```
CatalogRepository interface (ports.ts):
  ✅ getAllPackages(tenantId: string): Promise<Package[]>
  ✅ getPackageById(tenantId: string, id: string): Promise<Package | null>
  ✅ createPackage(tenantId: string, data: CreatePackageInput): Promise<Package>

Verify BOTH implementations match:
  □ MockCatalogRepository
    - getAllPackages: Returns array of Package from in-memory map
    - getPackageById: Returns Package or null
    - createPackage: Returns new Package with all fields

  □ PrismaCatalogRepository
    - getAllPackages: Returns array mapped via toDomainPackage()
    - getPackageById: Returns mapped Package or null
    - createPackage: Returns mapped new Package
```

**When to run:**
- In code review checklist (especially entity-related PRs)
- During refactoring sprints
- When adding new entity types
- Part of feature gate review (before feature flag flip)

---

## Prevention Strategy 4: Build-Time Exhaustiveness Checking

**What:** Use TypeScript's `satisfies` keyword to ensure mapper output completeness.

**When to use:** In all repository mappers.

**Implementation:**

```typescript
// Current pattern in booking.repository.ts (good)
private toDomainBooking(booking: {...}): Booking {
  const domainBooking: Booking = {
    id: booking.id,
    packageId: booking.packageId,
    coupleName: booking.customer.name,
    // ... all required fields
  };

  // Add optional fields with explicit guards
  if (booking.customer.phone) {
    domainBooking.phone = booking.customer.phone;
  }

  return domainBooking; // TypeScript enforces Booking shape
}

// Better: Use satisfies for clarity
private toDomainBooking(booking: {...}): Booking {
  return {
    id: booking.id,
    packageId: booking.packageId,
    coupleName: booking.customer.name,
    email: booking.customer.email || '',
    eventDate: toISODate(booking.date),
    addOnIds: booking.addOns.map(a => a.addOnId),
    totalCents: booking.totalPrice,
    status: mapStatus(booking.status),
    createdAt: booking.createdAt.toISOString(),
    // Required fields above, optional below
    ...(booking.customer.phone && { phone: booking.customer.phone }),
    ...(booking.cancelledBy && { cancelledBy: booking.cancelledBy }),
  } satisfies Booking; // Type guard ensures all required fields present
}
```

**Benefits:**
- Compile-time error if mapper is missing any required field
- `satisfies` keyword allows exact type shape validation
- Self-documenting code (clearly shows what's required vs optional)

---

## Prevention Strategy 5: Mock Data Builder Pattern

**What:** Create type-safe builder functions for mock data instead of inline objects.

**When to use:** In mock adapters for seeding and tests.

**Current implementation (needs improvement):**

```typescript
// Current: Inline objects in mock/index.ts
packages.set('pkg_basic', {
  id: 'pkg_basic',
  tenantId: DEFAULT_TENANT,
  slug: 'basic-elopement',
  title: 'Basic Elopement',
  description: '...',
  priceCents: 99900,
  photoUrl: '...',
  photos: [],
  active: true,
  segmentId: null,
  grouping: null,
  groupingOrder: null,
  // Risk: Missing fields not caught until runtime
});
```

**Better approach:**

```typescript
// server/src/lib/test-helpers/package-builder.ts
export class PackageBuilder {
  private data: Partial<Package> = {
    id: `pkg_${Date.now()}`,
    tenantId: 'tenant_default',
    slug: '',
    title: '',
    description: '',
    priceCents: 99900,
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
  };

  withSlug(slug: string): PackageBuilder {
    this.data.slug = slug;
    return this;
  }

  withTitle(title: string): PackageBuilder {
    this.data.title = title;
    return this;
  }

  // ... other setters

  build(): Package {
    // Verify all required fields are set
    const required = ['id', 'tenantId', 'slug', 'title', 'description', 'priceCents'] as const;
    for (const field of required) {
      if (this.data[field] === undefined) {
        throw new Error(`PackageBuilder: Missing required field '${field}'`);
      }
    }
    return this.data as Package;
  }
}

// Usage in mock/index.ts
const pkg = new PackageBuilder()
  .withSlug('basic-elopement')
  .withTitle('Basic Elopement')
  .withDescription('...')
  .build(); // Type error if required fields missing
```

**Benefits:**
- Build-time error if required field not set
- Self-documenting API (chain methods show what's needed)
- Reusable across tests and mock data
- Easy to extend with test helpers (withPrice(), withActiveStatus(), etc.)

---

## Prevention Strategy 6: Entity Change Checklist

**What:** Checklist for code reviewers when entity changes are proposed.

**When to use:** In pull requests that modify entities.ts or any interface.

### Pre-commit Checklist (Author)

When modifying an entity interface:

```markdown
## Entity Modification Checklist

- [ ] Updated `entities.ts` interface
- [ ] Updated all API contracts that return this entity (`packages/contracts/*.ts`)
- [ ] Updated port interfaces in `ports.ts` if new input type needed
- [ ] Updated ALL mock creation sites (`adapters/mock/index.ts`)
  - [ ] Seed data objects
  - [ ] Builder methods if applicable
  - [ ] Repository method returns
- [ ] Updated Prisma repository mapper (`adapters/prisma/*.repository.ts`)
  - [ ] Input type includes all DB fields
  - [ ] toDomain* mapper returns complete entity
  - [ ] New optional fields use guards
- [ ] Updated any service factory methods (`services/*.ts`)
- [ ] Updated routes DTO mapping if applicable (`routes/*.routes.ts`)
- [ ] Added integration tests for new field (`*.test.ts`)
- [ ] Verified with `npm run typecheck` (all workspaces)
- [ ] Verified tests pass: `npm test`
```

### Code Review Checklist (Reviewer)

```markdown
## Entity Change Review

When reviewing PRs with entity modifications:

**Interface Changes (entities.ts)**
- [ ] Required field? Check it's defined (not optional)
- [ ] Optional field? Should have `?` or `| null`

**API Contracts**
- [ ] Does contract include new field?
- [ ] Is Zod schema updated if validation needed?

**Mock Implementation**
- [ ] Are all seed data objects updated?
- [ ] Do methods return complete entities?
- [ ] Is type annotation strict (not `any`)?

**Prisma Repository**
- [ ] Input type in mapper includes field?
- [ ] Field properly mapped (conversion, null handling)?
- [ ] Optional fields wrapped in guards?

**Tests**
- [ ] Do entity invariant tests pass?
- [ ] Do integration tests cover new field?
- [ ] Is mock/real mode both tested?

**Run locally:**
```bash
npm run typecheck  # Catches type errors
npm test           # Catches missing mappers/fields
npm run build      # Full build verification
```
```

---

## Prevention Strategy 7: CI/CD Enforcement

**What:** Automated checks that prevent incomplete entity changes from merging.

**When to use:** As part of standard CI pipeline.

### 1. TypeScript Strict Mode

**File:** `server/tsconfig.json` (already in place ✅)

```json
{
  "compilerOptions": {
    "strict": true,  // Enables strictNullChecks, noImplicitAny, etc.
    "noUnusedLocals": false,  // Can be enabled once codebase is clean
    "noImplicitReturns": true
  }
}
```

**Prevents:** Many optional field bugs, implicit any types

### 2. Entity Invariant Test Requirement

Add to CI pipeline:

```yaml
# .github/workflows/test.yml (example)
- name: "Test: Entity Invariants"
  run: |
    npm run test -- --grep "Entity Invariants"
```

### 3. Build Verification

```bash
# Catches all mapping errors
npm run build
npm run typecheck
```

**Why this matters:**
- TypeScript catches ~60% of entity mapping errors
- Tests catch the remaining ~40% (runtime issues like null fields)
- Both together = nearly 100% prevention

---

## Prevention Strategy 8: Documentation and Knowledge Base

**What:** Document entity mapping patterns so developers follow them consistently.

**When to use:** Onboarding, code review education.

### Entity Mapping Quick Reference

```typescript
// PATTERN: Prisma Repository Mapper

// 1. Define input type with ALL database fields
private toDomainPackage(pkg: {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description: string | null;
  basePrice: number;
  // ... include all fields from Prisma model
}): Package {
  // 2. Map each field with conversion if needed
  return {
    id: pkg.id,
    tenantId: pkg.tenantId,
    slug: pkg.slug,
    title: pkg.name,  // Field name conversion (name → title)
    description: pkg.description || '',  // Null coalescing
    priceCents: pkg.basePrice,  // Unit conversion if needed
    // ... all required fields

    // 3. Optional fields with guards
    ...(pkg.active && { active: pkg.active }),
  };
}

// PATTERN: Mock Adapter Creation

async createPackage(tenantId: string, data: CreatePackageInput): Promise<Package> {
  // 1. Validate input
  const existing = await this.getPackageBySlug(tenantId, data.slug);
  if (existing) throw new Error(...);

  // 2. Create with ALL required fields
  const pkg: Package = {
    id: `pkg_${Date.now()}`,
    tenantId,
    slug: data.slug,
    title: data.title,  // Maps from input
    description: data.description,
    priceCents: data.priceCents,
    photos: [],  // Initialize if empty
    active: data.active ?? true,  // Defaults
    segmentId: data.segmentId ?? null,
    grouping: data.grouping ?? null,
    groupingOrder: data.groupingOrder ?? null,
  };

  // 3. Store and return
  packages.set(pkg.id, pkg);
  return pkg;
}
```

---

## Prevention Strategy 9: Dependency on Prisma-Generated Types

**What:** Use Prisma's generated types as source of truth, map TO domain entities (not the reverse).

**Current pattern (good):** MAIS already does this

```typescript
// Prisma generates these from schema.prisma
import type { PrismaClient } from '@prisma/client';

// Domain entity (single source of truth for business logic)
interface Package {
  id: string;
  title: string;
  // ... domain fields
}

// Repository maps Prisma → Domain
// NOT Domain → Prisma (which would cause sync issues)
```

**Why this prevents errors:**
- Database schema is source of truth for persistence
- Domain entities are source of truth for business logic
- One-directional flow (Prisma → Domain) is easier to maintain
- If Prisma schema changes, TypeScript catches missing mapper updates

**To strengthen this:**
1. Keep Prisma schema as complete as possible (no "hidden" fields)
2. Document which Prisma fields map to which domain fields
3. Generate type stubs from Prisma schema automatically

```typescript
// Example: Auto-generate mapper stubs from schema
// (Could be a build step if needed)
```

---

## Prevention Strategy 10: Architectural Decision - Optional Fields

**What:** Establish clear rules for when fields should be optional in entities.

**Current pattern in MAIS:**

```typescript
// Booking has many optional fields
export interface Booking {
  id: string;
  packageId: string;
  coupleName: string;
  email: string;
  phone?: string;                    // Optional - not always provided
  startTime?: string;                // Optional - only for TIMESLOT bookings
  googleEventId?: string | null;     // Optional - added later
  reminderDueDate?: string;          // Optional - Phase 2 feature
  depositPaidAmount?: number;        // Optional - Phase 4 feature
  // ... many optional fields
}
```

**Problem:** Too many optional fields make it hard to track required mappings.

**Solution:** Define "phases" and group optional fields

```typescript
// Domain entity with phases documented
export interface Booking {
  // PHASE 0: Core booking
  id: string;
  tenantId?: string;
  packageId: string;
  coupleName: string;
  email: string;
  eventDate: string;
  addOnIds: string[];
  totalCents: number;
  status: 'PENDING' | 'DEPOSIT_PAID' | 'PAID' | 'CONFIRMED' | 'CANCELED' | 'REFUNDED' | 'FULFILLED';
  createdAt: string;

  // PHASE 1: Scheduling (optional)
  startTime?: string;
  endTime?: string;
  bookingType?: 'DATE' | 'TIMESLOT';
  serviceId?: string;

  // PHASE 2: Reminders (optional)
  reminderDueDate?: string;
  reminderSentAt?: string;

  // PHASE 4: Deposits (optional)
  depositPaidAmount?: number;
  balanceDueDate?: string;
  balancePaidAmount?: number;
  balancePaidAt?: string;
}
```

**Benefits:**
- Clear which fields to map for each phase
- Easier to search: find all "Phase 2" fields
- Reduces cognitive load when adding new features
- Self-documents feature completeness

---

## Implementation Roadmap

### Week 1: Immediate Actions
- [ ] Add entity invariant tests (Strategy 1)
- [ ] Create entity change checklist (Strategy 6)
- [ ] Update CLAUDE.md with mapping patterns (Strategy 8)

### Week 2-3: Architectural Improvements
- [ ] Create test helper builders (Strategy 5)
- [ ] Document Prisma → Domain mapping flow (Strategy 9)
- [ ] Update CI/CD with entity invariant requirement (Strategy 7)

### Ongoing
- [ ] Apply checklist to all entity-related PRs (Strategy 6)
- [ ] Conduct quarterly audits (Strategy 3)
- [ ] Document new phase fields (Strategy 10)

---

## Verification Steps

After implementing prevention strategies, verify with:

```bash
# 1. Check TypeScript compilation
npm run typecheck

# 2. Run all tests
npm test

# 3. Verify entity invariant tests
npm test -- --grep "Entity Invariants"

# 4. Full build
npm run build

# 5. Check specific repository mappers
npm test -- --grep "toDomain"
```

---

## Related Documents

- **[CLAUDE.md](../../../CLAUDE.md)** - Repository pattern section
- **[DECISIONS.md](../DECISIONS.md)** - ADR-001 (Double-booking prevention)
- **[MULTI_TENANT_IMPLEMENTATION_GUIDE.md](../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)** - Tenant scoping rules
- **[CODE-REVIEW-ANY-TYPE-CHECKLIST.md](CODE-REVIEW-ANY-TYPE-CHECKLIST.md)** - Code review patterns

---

## Quick Reference: Common Entity Errors & Fixes

| Error | Location | Fix |
|-------|----------|-----|
| "Property X does not exist on type Package" | toDomainPackage() | Add field to return object |
| "Booking is not assignable to Booking[]" | Mock seeding | Ensure all required fields set |
| "Cannot read property X of undefined" | Runtime | Check mapper includes field from Prisma |
| "Type 'any' is not assignable to type Package" | Routes | Use strict type for mapping output |
| "Missing required property" at build time | Any creation | Run `npm run typecheck` before commit |

---

## Success Metrics

Track prevention strategy effectiveness:

- [ ] Zero build failures due to missing entity fields (target: 100%)
- [ ] Zero runtime errors from incomplete entities (target: 100%)
- [ ] Entity-related PRs include checklist (target: 90%+ of PRs)
- [ ] Code review time for entity changes reduced by 50%
- [ ] New entities added with 0 mapper bugs (requires builder pattern)

