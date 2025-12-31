---
module: MAIS
date: 2025-12-31
problem_type: naming_convention
component: typescript/imports
severity: P2
---

# Import Mismatch Prevention: Naming Conventions Guide

> Preventing import mismatches through consistent naming patterns across MAIS codebase.

---

## Core Principle

**Function name must match its return type signature.**

```typescript
// Returns array → name must be plural
export const getItems = () => Item[];      // ✅ Correct
export const getItem = () => Item[];       // ❌ Wrong (singular name, array return)

// Returns single → name must be singular
export const getItem = () => Item | null;  // ✅ Correct
export const getItems = () => Item;        // ❌ Wrong (plural name, single return)

// Async → no suffix required (but check signature)
export const getItem = async () => Item;   // ✅ Correct (async in signature)
export const getItemAsync = async () => Item; // ✅ Also correct (explicit)
```

---

## Pattern 1: Repository/Data Access Layer

### Collection Methods

```typescript
// Interface definition (lib/ports.ts)
export interface BookingRepository {
  // Get all items - returns array
  getAll: (tenantId: string) => Promise<Booking[]>;

  // Get multiple with filter - returns array
  findMany: (tenantId: string, filters: Filters) => Promise<Booking[]>;

  // Get by ID - returns single or null
  getById: (tenantId: string, id: string) => Promise<Booking | null>;

  // Get by unique field - returns single or null
  getBySlug: (tenantId: string, slug: string) => Promise<Booking | null>;

  // Exists check - returns boolean
  exists: (tenantId: string, id: string) => Promise<boolean>;

  // Count - returns number
  count: (tenantId: string, filters?: Filters) => Promise<number>;

  // Create - returns created item
  create: (tenantId: string, data: CreateBookingInput) => Promise<Booking>;

  // Update - returns updated item
  update: (tenantId: string, id: string, data: UpdateBookingInput) => Promise<Booking>;

  // Delete - returns success boolean
  delete: (tenantId: string, id: string) => Promise<boolean>;
}

// Implementation (adapters/prisma/booking.repository.ts)
export class PrismaBookingRepository implements BookingRepository {
  async getAll(tenantId: string) {
    return await this.prisma.booking.findMany({ where: { tenantId } });
    // ✅ Returns Booking[], matches plural name
  }

  async getById(tenantId: string, id: string) {
    return await this.prisma.booking.findFirst({
      where: { tenantId, id },
    });
    // ✅ Returns Booking | null, matches singular name
  }
}
```

### Import Usage

```typescript
// In service (services/booking.service.ts)
import { BookingRepository } from '../lib/ports';

export class BookingService {
  constructor(private repo: BookingRepository) {}

  async getAllBookings(tenantId: string) {
    // ✅ Plural method name, expecting array
    const bookings = await this.repo.getAll(tenantId);
    return bookings; // Array
  }

  async getBooking(tenantId: string, id: string) {
    // ✅ Singular method name, expecting single item
    const booking = await this.repo.getById(tenantId, id);
    return booking; // Booking | null
  }
}
```

### Anti-patterns (Don't Do This)

```typescript
// ❌ WRONG: Singular name for array return
export interface BookingRepository {
  getBooking: (tenantId: string) => Promise<Booking[]>; // Confusing!
}

// ❌ WRONG: Plural name for single return
export interface BookingRepository {
  getBookings: (tenantId: string, id: string) => Promise<Booking | null>; // Misleading!
}

// ❌ WRONG: Inconsistent naming in same module
export interface BookingRepository {
  getAllBookings: () => Promise<Booking[]>; // "getAll" prefix
  findBooking: (id) => Promise<Booking>; // "find" prefix (inconsistent)
  retrieveBookingBySlug: (slug) => Promise<Booking>; // "retrieve" prefix
}
// Picker three different styles when one would suffice
```

---

## Pattern 2: Service Layer Methods

### Query Services (Read Operations)

```typescript
// services/booking-query.service.ts
export class BookingQueryService {
  constructor(private repo: BookingRepository) {}

  // Get all - plural return
  async getBookings(tenantId: string): Promise<Booking[]> {
    return this.repo.getAll(tenantId);
  }

  // Get single - singular return
  async getBooking(tenantId: string, id: string): Promise<Booking | null> {
    return this.repo.getById(tenantId, id);
  }

  // Get filtered - plural return
  async searchBookings(tenantId: string, query: string): Promise<Booking[]> {
    return this.repo.findMany(tenantId, { search: query });
  }

  // Check existence - boolean return
  async bookingExists(tenantId: string, id: string): Promise<boolean> {
    return this.repo.exists(tenantId, id);
  }
}

// Import usage
import { BookingQueryService } from './booking-query.service';

const bookings = await queryService.getBookings(tenantId); // Array ✅
const booking = await queryService.getBooking(tenantId, id); // Single ✅
const exists = await queryService.bookingExists(tenantId, id); // Boolean ✅
```

### Lifecycle Services (Create/Update/Delete)

```typescript
// services/booking-lifecycle.service.ts
export class BookingLifecycleService {
  constructor(
    private repo: BookingRepository,
    private eventEmitter: EventEmitter
  ) {}

  // Create - singular (returns one created item)
  async createBooking(tenantId: string, input: CreateBookingInput): Promise<Booking> {
    const booking = await this.repo.create(tenantId, input);
    this.eventEmitter.emit(BookingEvents.CREATED, booking);
    return booking;
  }

  // Update - singular (returns one updated item)
  async rescheduleBooking(tenantId: string, id: string, newDate: Date): Promise<Booking> {
    const booking = await this.repo.update(tenantId, id, { date: newDate });
    this.eventEmitter.emit(BookingEvents.RESCHEDULED, booking);
    return booking;
  }

  // Delete - returns boolean
  async cancelBooking(tenantId: string, id: string): Promise<void> {
    await this.repo.delete(tenantId, id);
    this.eventEmitter.emit(BookingEvents.CANCELLED, { id, tenantId });
  }
}

// Import usage
const booking = await lifecycleService.createBooking(tenantId, input); // Single ✅
const updated = await lifecycleService.rescheduleBooking(tenantId, id, date); // Single ✅
```

---

## Pattern 3: Agent Tools (Critical for Tool Naming)

### Read Tools (Singular/Plural)

```typescript
// agent/tools/read-tools.ts

export const readTools: AgentTool[] = [
  {
    name: 'get_services', // ← Plural: returns array of services
    description: 'List all services...',
    execute: async (context, params) => {
      const services = await context.prisma.package.findMany({
        where: { tenantId: context.tenantId },
      });
      return {
        success: true,
        data: services, // Array return matches plural name
      };
    },
  },

  {
    name: 'get_service_by_id', // ← Singular: get one service by ID
    description: 'Get a specific service...',
    execute: async (context, params) => {
      const service = await context.prisma.package.findUnique({
        where: { id: params.serviceId as string },
      });
      return {
        success: true,
        data: service, // Single return matches singular name
      };
    },
  },

  {
    name: 'check_availability', // ← Boolean operation
    description: 'Check if date is available...',
    execute: async (context, params) => {
      const isAvailable = await checkAvailability(context.tenantId, params.date as string);
      return {
        success: true,
        data: { available: isAvailable }, // Boolean wrapped in object
      };
    },
  },
];

// Import usage in orchestrator
import { readTools } from './read-tools';

// readTools is plural → array
expect(Array.isArray(readTools)).toBe(true); // ✅

// Each tool name reflects its return
const getServicesTool = readTools.find((t) => t.name === 'get_services');
// get_services → expects array of services ✅
```

### Write Tools (Domain-Prefixed)

```typescript
// agent/tools/write-tools.ts

export const writeTools: AgentTool[] = [
  {
    name: 'update_booking', // ← Singular: update one booking
    description: 'Update a booking...',
    execute: async (context, params) => {
      // Implementation
    },
  },

  {
    name: 'create_booking', // ← Singular: create one booking
    description: 'Create a booking...',
    execute: async (context, params) => {
      // Implementation
    },
  },
];

// NOT:
// export const tools = [...]; // Too generic! Which tools?
// export const getTools = () => [...]; // Same problem

// Tools exported with clear domain:
import { writeTools, readTools } from './tools';
// Clear what domain each covers ✅
```

### Onboarding Tools (Domain-Specific Exports)

```typescript
// agent/tools/onboarding-tools.ts

// WRONG:
// export const tools = [updateOnboardingStateTool, ...];
// Other modules also export 'tools' → collision

// CORRECT:
export const onboardingTools: AgentTool[] = [
  {
    name: 'update_onboarding_state',
    // Implementation
  },
  {
    name: 'upsert_services',
    // Implementation
  },
];

// Now imports are clear:
import { onboardingTools } from './onboarding-tools'; // ✅ Clearly onboarding
import { readTools } from './read-tools'; // ✅ Clearly read tools
import { writeTools } from './write-tools'; // ✅ Clearly write tools
```

---

## Pattern 4: Event Names (Domain-Prefixed)

### Event Enum Pattern

```typescript
// lib/core/events.ts

export const BookingEvents = {
  CREATED: 'booking.created',
  CANCELLED: 'booking.cancelled',
  RESCHEDULED: 'booking.rescheduled',
  PAYMENT_COMPLETED: 'booking.payment_completed',
  REFUNDED: 'booking.refunded',
} as const;

export const OnboardingEvents = {
  STARTED: 'onboarding.started',
  COMPLETED: 'onboarding.completed',
  PAUSED: 'onboarding.paused',
} as const;

// NOT:
export const CREATED = 'created'; // ❌ What domain? Collision risk
export const CANCELLED = 'cancelled'; // ❌ Same problem

// Usage:
import { BookingEvents, OnboardingEvents } from '../lib/core/events';

emitter.emit(BookingEvents.CREATED, booking); // ✅ Clear domain
emitter.emit(OnboardingEvents.STARTED, tenantId); // ✅ Different domain
```

---

## Pattern 5: Async/Sync Functions

### Consistent Async Pattern (No Suffix)

```typescript
// Most common in MAIS: no suffix, check signature
export class DataService {
  // Clearly async from signature
  async getTenant(id: string): Promise<Tenant> {}

  async createTenant(input: TenantInput): Promise<Tenant> {}

  // Clearly sync
  getTenantSlug(tenant: Tenant): string {}

  // Mixed: both exist
  async getConfigAsync(key: string): Promise<Config> {}
  getConfigSync(key: string): Config | null {}
}

// Import usage - reader checks signature for `await` need
const tenant = await service.getTenant(id); // Signature has `async` ✅
const slug = service.getTenantSlug(tenant); // No `async` keyword ✅
```

### Explicit Async Suffix Pattern (Alternative)

```typescript
// Less common, but valid if consistent
export class DataService {
  // All explicitly async with suffix
  async getTenantAsync(id: string): Promise<Tenant> {}
  async createTenantAsync(input: TenantInput): Promise<Tenant> {}

  // Cache version - sync
  getTenantSync(id: string): Tenant | null {}

  // Sync variant also possible
  getTenantSyncFromCache(id: string): Tenant | null {}
}

// Import usage - name tells you async vs sync
const tenant = await service.getTenantAsync(id); // Name says async ✅
const cached = service.getTenantSync(id); // Name says sync ✅
```

### Anti-Pattern: Inconsistent Async Naming

```typescript
// ❌ DON'T DO THIS - inconsistent within module
export class DataService {
  async getTenant(id: string): Promise<Tenant> {} // No suffix
  async fetchConfigAsync(key: string): Promise<Config> {} // With suffix
  async pullDataFromAPI(): Promise<Data> {} // Different verb
}

// Reader can't tell which need `await` without checking each one
```

---

## Pattern 6: Import Statement Consistency

### Correct Pattern

```typescript
// ✅ Grouped and organized imports
import type { Booking, CreateBookingInput } from '../lib/entities';
import type { BookingRepository } from '../lib/ports';
import { BookingEvents } from '../lib/core/events';
import { logger } from '../lib/core/logger';

import { BookingQueryService } from './booking-query.service';
import { BookingLifecycleService } from './booking-lifecycle.service';

// Clear where each thing comes from:
// - lib/entities = types
// - lib/ports = interfaces
// - lib/core = shared utilities
// - services = service classes

// Each import name matches what's exported
```

### Pre-Import Verification

```typescript
// Before writing an import:

// Step 1: Check what file exports
// File: services/booking.service.ts
export class BookingService {} // Export is class, not const

// Step 2: Verify you're importing correctly
import { BookingService } from './booking.service'; // ✅ Correct

// Step 3: Use it
const service = new BookingService();

// Common mistake:
import { bookingService } from './booking.service'; // ❌ No lowercase const
// Error: Cannot find name 'bookingService'
```

---

## Validation Checklist by Pattern

### Repository Methods

- [ ] `getAll()` returns array
- [ ] `getById()` returns single | null
- [ ] `findMany()` returns array
- [ ] `exists()` returns boolean
- [ ] `count()` returns number
- [ ] `create()` returns single (created item)

### Service Methods

- [ ] Plural methods return arrays: `getItems()`
- [ ] Singular methods return single: `getItem()`
- [ ] Async functions are awaited at call site
- [ ] Sync functions called without `await`

### Tools

- [ ] Tool collections domain-prefixed: `readTools`, `writeTools`, `onboardingTools`
- [ ] NOT generic: `tools`, `allTools`
- [ ] Tool names reflect return type

### Events

- [ ] Domain-prefixed: `BookingEvents.CREATED`
- [ ] NOT generic: `CREATED`
- [ ] Prevents collisions between domains

---

## Refactoring Checklist (When Fixing Mismatches)

1. **Identify the actual return type**

   ```typescript
   // Look at implementation
   export const getItems = () => {
     return items; // Is this array or single?
   };
   ```

2. **Rename to match**

   ```typescript
   // If returns array:
   export const getItems = () => Item[]; // Already correct

   // If returns single:
   export const getItem = () => Item; // Rename
   ```

3. **Update all imports**

   ```typescript
   // Old import: import { getItem } from './module';
   // New import: import { getItems } from './module';
   ```

4. **Update all callers**

   ```typescript
   // Old: const item = getItem();
   // New: const items = getItems();
   ```

5. **Run tests to verify**
   ```bash
   npm test -- --grep "getItems"
   ```

---

## Real World Example: Tool Naming

### ❌ Before (Causes Import Mismatch)

```typescript
// agent/tools/onboarding-tools.ts
export const tools = [
  { name: 'get_market_research', ... },
  { name: 'update_onboarding_state', ... },
];

// agent/tools/read-tools.ts
export const tools = [
  { name: 'get_services', ... },
];

// agent/tools/all-tools.ts
import { tools as onboardingTools } from './onboarding-tools';
import { tools as readTools } from './read-tools';

// ❌ Problem: Importing 'tools' from multiple places and renaming
// ❌ Confusing for developers reading code
// ❌ Type naming mismatch with actual exports
```

### ✅ After (Consistent Naming)

```typescript
// agent/tools/onboarding-tools.ts
export const onboardingTools = [  // Domain-prefixed ✅
  { name: 'get_market_research', ... },
  { name: 'update_onboarding_state', ... },
];

// agent/tools/read-tools.ts
export const readTools = [  // Domain-prefixed ✅
  { name: 'get_services', ... },
];

// agent/tools/all-tools.ts
import { onboardingTools } from './onboarding-tools';  // Name matches export ✅
import { readTools } from './read-tools';              // Name matches export ✅

// ✅ Solution: Each export has unique, domain-specific name
// ✅ Clear what type of tools each contains
// ✅ No import collision or confusion
```

---

## Quick Fix: "Cannot Find Name X"

| Error                              | Diagnosis                             | Fix                                                                  |
| ---------------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `Cannot find name 'getTenants'`    | Export is `getTenant`                 | Check return type. If array, needs plural.                           |
| `Cannot find name 'getToolsAsync'` | Export is `getTools`, no `Async`      | Check if function is actually async. Don't add suffix if not needed. |
| `Cannot find name 'tools'`         | Exports are `readTools`, `writeTools` | Use domain-prefixed name.                                            |
| `Cannot find name 'CREATED'`       | Export is `BookingEvents.CREATED`     | Import the event enum, access property.                              |
| `Cannot find name 'appendEvent'`   | Export is `appendOnboardingEvent`     | Use full name with domain prefix.                                    |

---

## Summary Table

| Type                 | Pattern  | Example             | Return         |
| -------------------- | -------- | ------------------- | -------------- |
| **Query (Single)**   | getX     | `getUser()`         | `User \| null` |
| **Query (Multiple)** | getXs    | `getUsers()`        | `User[]`       |
| **Create**           | createX  | `createUser()`      | `User`         |
| **Update**           | updateX  | `updateUser()`      | `User`         |
| **Delete**           | deleteX  | `deleteUser()`      | `boolean`      |
| **Check**            | xExists  | `userExists()`      | `boolean`      |
| **Count**            | countX   | `countUsers()`      | `number`       |
| **Find**             | findX    | `findUserByEmail()` | `User \| null` |
| **Search**           | searchXs | `searchUsers()`     | `User[]`       |
| **Event**            | XEvents  | `BookingEvents`     | `enum`         |
| **Tools**            | xTools   | `readTools`         | `AgentTool[]`  |

---

## Files Following This Pattern

- ✅ `server/src/agent/tools/read-tools.ts` - Domain-prefixed `readTools`
- ✅ `server/src/agent/tools/write-tools.ts` - Domain-prefixed `writeTools`
- ✅ `server/src/agent/tools/onboarding-tools.ts` - Domain-prefixed `onboardingTools`
- ✅ `server/src/services/booking-query.service.ts` - Query service (get singular/plural)
- ✅ `server/src/services/booking-lifecycle.service.ts` - Lifecycle service (create/update/delete)
- ✅ `server/src/lib/core/events.ts` - Domain-prefixed event enums

---

## References

- [IMPORT_MISMATCH_PREVENTION.md](../IMPORT_MISMATCH_PREVENTION.md) - Full prevention guide
- [IMPORT_MISMATCH_QUICK_CHECKLIST.md](../IMPORT_MISMATCH_QUICK_CHECKLIST.md) - Quick reference
