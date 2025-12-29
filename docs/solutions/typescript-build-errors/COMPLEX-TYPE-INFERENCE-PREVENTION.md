---
module: MAIS
date: 2025-12-29
problem_type: build_error
component: server/services/, server/adapters/
symptoms:
  - TS2344: Type 'string | undefined' does not satisfy the constraint 'never'
  - Cannot infer type from Parameters<typeof fn> when function has optional params
  - Type inference fails with union types containing undefined
root_cause: Using Parameters<> or similar type helpers on functions with optional parameters or overloads; TypeScript cannot narrow the type correctly
resolution_type: code_review_pattern
severity: P2
related_files:
  - server/src/services/*.service.ts
  - server/src/lib/types.ts
tags: [typescript, type-inference, generics, build-errors]
---

# Prevention Strategy: Complex Type Inference Failures

## Problem Summary

**Issue:** TypeScript fails to infer types correctly when using advanced type utilities like `Parameters<>`, `ReturnType<>`, or `Awaited<>` on functions with optional parameters, overloads, or complex type signatures.

**Root Causes:**

1. Using `Parameters<typeof fn>` on function with optional parameters
2. Function has overloads and TypeScript can't pick the right one
3. Using type inference on generic functions with constrained types
4. Extracting types from async functions with union returns

**Impact:**

- Build fails with TS2344 "Type X does not satisfy constraint"
- Cannot proceed to deployment
- Type inference is brittle and breaks easily

**Example:**

```typescript
// ❌ WRONG - Parameters<> fails with optional params

type CreateFunction = (
  tenantId: string,
  data?: CreateBookingInput // ← Optional param causes issue
) => Promise<Booking>;

// This fails with TS2344:
type CreateInput = Parameters<CreateFunction>[1];
// ↑ Error: Type 'string | undefined' does not satisfy constraint

// Type inference can't handle optional parameters properly
// TypeScript doesn't know if param 1 exists or what it is
```

---

## Prevention Strategy

### 1. Avoid Advanced Type Inference When Possible

**Best pattern: Define types explicitly instead of inferring:**

```typescript
// ❌ WRONG: Trying to infer from function
type BookingCreateFn = (tenantId: string, data: CreateBookingInput) => Promise<Booking>;
type CreateInput = Parameters<BookingCreateFn>[1]; // ← Fragile inference

// ✅ CORRECT: Define input/output types directly
export interface CreateBookingInput {
  eventDate: string;
  clientName: string;
  // ...
}

export interface BookingCreatedResponse {
  booking: Booking;
  confirmation: string;
}

// Then define function separately
export async function createBooking(tenantId: string, data: CreateBookingInput): Promise<Booking> {
  // ...
}

// Types are independent of function, easier to maintain
```

**Why this is better:**

- Types are source of truth, not derived from functions
- Changes to function don't break dependent types
- Types are explicit and self-documenting
- No complex type inference machinery

### 2. Extract Inferred Types Only at Interface Boundaries

**When you MUST infer types, do it carefully:**

```typescript
// ✅ ACCEPTABLE: Infer return type of exported function
export async function getBooking(tenantId: string, id: string) {
  const booking = await this._bookingRepo.getById(tenantId, id);
  return {
    id: booking.id,
    clientName: booking.clientName,
    eventDate: booking.eventDate.toISOString(),
  };
}

// Infer the return type at module boundary
type GetBookingResponse = Awaited<ReturnType<typeof getBooking>>;

// Usage:
const response: GetBookingResponse = await getBooking('tenant_123', 'book_456');
```

**When to use type inference:**

1. Exporting public function return types
2. React component prop types from components
3. Test helpers where types change frequently

**When NOT to use:**

1. Parameters of functions (use explicit types)
2. Complex transformations (write type explicitly)
3. Functions with optional params (write type explicitly)

### 3. Avoid `Parameters<>` for Functions with Optional Parameters

**The problem pattern:**

```typescript
// ❌ WRONG: Optional parameters break Parameters<>
interface BookingService {
  create(tenantId: string, data?: CreateBookingInput): Promise<Booking>;
  update(tenantId: string, id: string, data?: UpdateBookingInput): Promise<Booking>;
}

// This fails:
type CreateParams = Parameters<BookingService['create']>;
// ^ TS2344: Type 'CreateBookingInput | undefined' violates constraint

// TypeScript can't determine parameter count/types with optionals
```

**Solution 1: Remove optionals (prefer this):**

```typescript
// ✅ CORRECT: Make required, use separate method for partial updates
interface BookingService {
  create(tenantId: string, data: CreateBookingInput): Promise<Booking>;
  // For partial updates, have a separate method
  updatePartial(tenantId: string, id: string, data: Partial<UpdateBookingInput>): Promise<Booking>;
}

// Now Parameters<> would work (though still not recommended):
type CreateParams = Parameters<BookingService['create']>;
// Result: [tenantId: string, data: CreateBookingInput]
```

**Solution 2: Define parameter type explicitly:**

```typescript
// ✅ BETTER: Define the type explicitly
export interface CreateBookingParams {
  tenantId: string;
  data: CreateBookingInput;
}

export interface BookingService {
  create(...params: CreateBookingParams): Promise<Booking>;
}

// Or use overloads if you need multiple signatures:
export interface BookingService {
  create(tenantId: string, data: CreateBookingInput): Promise<Booking>;
}

// Then define parameter type separately
export type BookingServiceCreateParams = [tenantId: string, data: CreateBookingInput];

// Use it instead of Parameters<>:
async function callBookingCreate(params: BookingServiceCreateParams) {
  const bookingService = new BookingService(...);
  return bookingService.create(...params);
}
```

### 4. Handle Function Overloads Carefully

**When function has overloads, `Parameters<>` is ambiguous:**

```typescript
// ❌ WRONG: Function with overloads
export function bookingQuery(tenantId: string, query: FindBookingQuery): Promise<Booking[]>;
export function bookingQuery(tenantId: string, id: string): Promise<Booking | null>;
export function bookingQuery(
  tenantId: string,
  queryOrId: FindBookingQuery | string
): Promise<Booking | Booking[] | null> {
  if (typeof queryOrId === 'string') {
    return findById(tenantId, queryOrId);
  }
  return find(tenantId, queryOrId);
}

// This fails:
type QueryParams = Parameters<typeof bookingQuery>;
// ^ TypeScript doesn't know which overload to use for parameters
```

**Solution: Separate overload types:**

```typescript
// ✅ CORRECT: Define overload types separately
export interface BookingQueryByIdParams {
  tenantId: string;
  id: string;
}

export interface BookingQueryWithFilterParams {
  tenantId: string;
  query: FindBookingQuery;
}

export type BookingQueryParams = BookingQueryByIdParams | BookingQueryWithFilterParams;

// Function uses union type
export function bookingQuery(
  tenantId: string,
  queryOrId: FindBookingQuery | string
): Promise<Booking | Booking[] | null> {
  // ...
}

// Now you can use the explicit types instead of inferring
async function executeQuery(params: BookingQueryParams) {
  // ...
}
```

### 5. Type Inference Safe Patterns

**Pattern: Explicit type definition at boundaries:**

```typescript
// ✅ GOOD: Services define explicit input/output types
export interface CreateBookingInput {
  tenantId: string;
  eventDate: string;
  clientName: string;
}

export interface CreateBookingOutput {
  booking: Booking;
  confirmationUrl: string;
}

export class BookingService {
  async create(input: CreateBookingInput): Promise<CreateBookingOutput> {
    const booking = await this._bookingRepo.create({
      tenantId: input.tenantId,
      eventDate: new Date(input.eventDate),
      clientName: input.clientName,
    });

    return {
      booking,
      confirmationUrl: `/bookings/${booking.id}`,
    };
  }
}

// Routes/controllers use the explicit types
export const createBookingRoute = {
  method: 'POST' as const,
  path: '/bookings' as const,
  requestBody: CreateBookingInputSchema,
  responses: {
    200: CreateBookingOutputSchema,
  },
};
```

**Pattern: Safe return type inference:**

```typescript
// ✅ ACCEPTABLE: Infer return type of async function
async function fetchTenantData(tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    include: { packages: true },
  });

  return {
    tenantId: tenant.id,
    name: tenant.name,
    packages: tenant.packages,
  };
}

// Safe to infer return type:
type TenantDataResponse = Awaited<ReturnType<typeof fetchTenantData>>;

// Because:
// 1. Return type is clearly structured object literal
// 2. No optional properties
// 3. TypeScript can infer the shape accurately
```

---

## Code Review Checklist

### When Reviewing Type Inference

```yaml
Type Inference Review:
  □ Is Parameters<> used on function with optional parameters?
    └─ If YES: Replace with explicit parameter type
    └─ Define interface for parameters instead

  □ Is type inference used on overloaded functions?
    └─ If YES: Define separate types for each overload
    └─ Use union type instead of Parameters<>

  □ Is ReturnType<> used on complex/async functions?
    └─ If YES: Verify return type is inferred correctly
    └─ Consider explicitly defining return type instead

  □ Are there union types with undefined?
    └─ If YES: Make parameter required instead
    └─ Or use explicit interface for optional case

  □ Can the type be defined more simply?
    └─ Explicit types are better than inferred types
    └─ Less fragile, easier to maintain
    └─ Self-documenting

  □ Is the inferred type used at only one place?
    └─ If YES: Inline the type or define it where used
    └─ Avoid global inferred types that are fragile
```

### Pull Request Template Addition

```markdown
## Type Inference Checklist

- [ ] No use of `Parameters<>` on functions with optional params
- [ ] No use of type inference on overloaded functions
- [ ] All inferred types are at module boundaries (exports)
- [ ] Complex types are explicitly defined, not inferred
- [ ] No union types with `undefined` in function parameters
- [ ] TypeScript strict mode passes: `npm run typecheck`
- [ ] No TS2344 or type constraint errors
- [ ] Types are self-documenting and clear

### If using type inference:

- [ ] Reason is documented in comment
- [ ] Type only inferred from simple/clear source
- [ ] Function has no optional parameters
- [ ] Function has no overloads
- [ ] Return type is structured object or simple value
- [ ] Type is exported/reused in multiple places (justifies inference)
```

---

## Quick Reference: Type Inference Decision Tree

```
Need to capture parameter types from a function?
├─ Is the function simple with required params only?
│  ├─ YES → Can use Parameters<> (but explicit is better)
│  └─ NO (has optionals/overloads) → Define explicit interface
└─ ALWAYS BETTER: Define explicit interface

Need to capture return type from a function?
├─ Is the function simple with clear return shape?
│  ├─ YES → Can use ReturnType<> at module boundary
│  └─ NO (complex/async/transformed) → Define explicit interface
└─ Consider: Is return type used in multiple places?

Are you using Parameters<>, ReturnType<>, or Awaited<>?
├─ What is your reason?
│  ├─ "It's used in many places" → Still define explicit type
│  ├─ "Function changes often" → Explicit types still better (update one place)
│  ├─ "Less typing" → Explicit types are not much more
│  └─ "DRY principle" → Inferred types aren't DRY, they're fragile
└─ RECOMMENDATION: Define explicit type instead

Are parameter types union with undefined?
├─ YES → Make parameter required instead
├─ Can't make required? → Use separate function or method
└─ Last resort: Define explicit interface with | undefined

Does function have overloads?
├─ YES → Define types for each overload separately
├─ Use union type of overload parameter types
└─ Don't use Parameters<> on overloaded functions
```

---

## Real-World Patterns from MAIS

### ✅ CORRECT Pattern

**Service with explicit types:**

```typescript
import type { BookingRepository } from '../lib/ports';
import type { Booking } from '../lib/entities';

// Explicit input/output types (not inferred)
export interface CreateBookingServiceInput {
  tenantId: string;
  eventDate: Date;
  clientName: string;
  clientEmail: string;
}

export interface BookingServiceOutput {
  booking: Booking;
  bookingUrl: string;
}

export class BookingService {
  constructor(private _bookingRepo: BookingRepository) {}

  async create(input: CreateBookingServiceInput): Promise<BookingServiceOutput> {
    // Implementation
    const booking = await this._bookingRepo.create({
      tenantId: input.tenantId,
      eventDate: input.eventDate,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
    });

    return {
      booking,
      bookingUrl: `/bookings/${booking.id}`,
    };
  }
}

// Route uses explicit types
export const createBookingContract = {
  method: 'POST' as const,
  path: '/bookings',
  requestBody: createBookingInputSchema,
  responses: {
    200: bookingResponseSchema,
  },
};

// Controller
const bookingService = new BookingService(bookingRepository);
const result = await bookingService.create(input);
const response: BookingServiceOutput = result; // Type-safe
```

**With safe return type inference (only for simple cases):**

```typescript
// ✅ OK: Simple return type, can be inferred
async function formatBooking(booking: Booking) {
  return {
    id: booking.id,
    date: booking.eventDate.toISOString(),
    client: booking.clientName,
  };
}

// Safe to infer because:
// 1. Clear object literal return
// 2. No optionals
// 3. Simple types
type FormattedBooking = Awaited<ReturnType<typeof formatBooking>>;
```

### ❌ INCORRECT Pattern (What to Avoid)

```typescript
// ❌ WRONG: Trying to infer parameters with optionals
interface IBookingService {
  create(tenantId: string, data?: CreateBookingInput): Promise<Booking>;
}

// This fails:
type CreateParams = Parameters<IBookingService['create']>;
// ^ TS2344: Type includes undefined

// ❌ WRONG: Inferring from overloaded function
function query(tenantId: string, id: string): Promise<Booking>;
function query(tenantId: string, filters: QueryFilter): Promise<Booking[]>;
function query(tenantId: string, arg: string | QueryFilter): any {
  // ...
}

// This fails:
type QueryParams = Parameters<typeof query>;
// ^ TypeScript doesn't know which overload

// ❌ WRONG: Complex return type inference
async function complexOperation() {
  const data = await fetchData();
  const transformed = transform(data);
  const filtered = filter(transformed);

  return {
    results: filtered,
    metadata: {
      count: filtered.length,
      timestamp: Date.now(),
      nested: {
        properties: {
          that: {
            are: 'complex',
          },
        },
      },
    },
  };
}

// This is brittle:
type ComplexOutput = Awaited<ReturnType<typeof complexOperation>>;
// If implementation changes, type breaks
```

---

## Testing Type Inference

### Compile-Time Type Tests

```typescript
import { describe, it } from 'vitest';
import type { CreateBookingServiceInput, BookingServiceOutput } from '../services/booking.service';

describe('Type Inference Safety', () => {
  it('should have correct input type structure', () => {
    const input: CreateBookingServiceInput = {
      tenantId: 'tenant_123',
      eventDate: new Date(),
      clientName: 'John Doe',
      clientEmail: 'john@example.com',
    };

    // If type inference changes unexpectedly, this will fail at compile time
    type ExpectedKeys = keyof CreateBookingServiceInput;
    const keys: ExpectedKeys[] = ['tenantId', 'eventDate', 'clientName', 'clientEmail'];

    expect(keys).toHaveLength(4);
  });

  it('should infer return type correctly', async () => {
    async function testFn() {
      return {
        id: 'booking_123',
        date: '2025-12-29',
      };
    }

    type ReturnShape = Awaited<ReturnType<typeof testFn>>;

    // Verify structure
    const result: ReturnShape = {
      id: 'booking_123',
      date: '2025-12-29',
    };

    expect(result.id).toBe('booking_123');
  });
});
```

---

## Deployment Verification

### Before Deploying to Render/Production

```bash
# 1. Run TypeScript strict mode check
npm run typecheck

# Expected output should have NO:
# - TS2344 (Type constraint violations)
# - TS2769 (Overload resolution failures)
# - TS7057 (Complex type inference issues)

# 2. Build project
npm run build

# 3. Verify no type inference warnings
npm run typecheck 2>&1 | grep -i "infer\|parameter\|constraint" || echo "✓ No type inference issues"
```

### CI/CD Check (GitHub Actions)

**Add to `.github/workflows/ci.yml`:**

```yaml
- name: Type Check (Strict Mode)
  run: npm run typecheck

- name: Catch Complex Type Inference
  run: |
    # Check for Parameters<> usage
    PARAMS_USAGE=$(grep -r "Parameters<" server/src --include="*.ts" || true)
    if [ ! -z "$PARAMS_USAGE" ]; then
      echo "WARNING: Found Parameters<> usage - verify it's safe:"
      echo "$PARAMS_USAGE"
      # Don't fail, just warn
    fi

    # Check for type constraint violations
    BUILD_OUTPUT=$(npm run build 2>&1 || true)
    if echo "$BUILD_OUTPUT" | grep -q "TS2344"; then
      echo "ERROR: Type constraint violations detected"
      exit 1
    fi

- name: Build All Workspaces
  run: npm run build
```

---

## Summary

**Key Takeaway:** Complex type inference failures are preventable with:

1. **Explicit types** for function inputs/outputs (not inferred)
2. **Simple functions** if you must use type inference
3. **Avoid Parameters<>** on functions with optional parameters
4. **Define overload types** separately instead of inferring
5. **Type inference only at boundaries** where output is simple

**Prevention Checklist:**

- [ ] No `Parameters<>` on functions with optional params
- [ ] No type inference on overloaded functions
- [ ] Function parameters explicitly typed (not inferred)
- [ ] Return types inferred only for simple, clear functions
- [ ] No union types with `undefined` in parameters
- [ ] Complex types explicitly defined, not inferred
- [ ] `npm run typecheck` passes with no errors
- [ ] Code review verifies type inference safety
