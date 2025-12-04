---
status: complete
priority: p1
issue_id: "047"
tags: [code-review, scheduling, api, contracts, critical]
dependencies: []
---

# CRITICAL: Missing Public Appointment Creation Endpoint in Contracts

## Problem Statement

The API contracts define endpoints to view services and check availability, but there is NO contract for `POST /v1/public/appointments` to actually book a time slot. Customers cannot complete bookings through the API.

**Why this matters:** The scheduling platform has no way for public users to book appointments through the type-safe contract system. The frontend uses a raw fetch call that bypasses contract validation.

## Findings

### Code Evidence - Missing Contract

**Location:** `packages/contracts/src/api.v1.ts` - Scheduling section

Current public scheduling endpoints:
```typescript
// Line 1013-1034 - getPublicServices (GET /v1/public/services) ✓
// Line 1035-1052 - getAvailableSlots (GET /v1/public/availability/slots) ✓
// NO createAppointment endpoint!
```

### Frontend Workaround

**Location:** `client/src/features/scheduling/AppointmentBookingFlow.tsx:120-154`

```typescript
// Raw fetch call bypassing contracts
const response = await fetch(`${baseUrl}/v1/public/appointments/checkout`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Tenant-Key": localStorage.getItem("tenantKey") || "",
  },
  body: JSON.stringify({
    serviceId: selectedService.id,
    date: selectedDate,
    startTime: selectedSlot.startTime,
    endTime: selectedSlot.endTime,
    customerName: customerInfo.name,
    customerEmail: customerInfo.email,
    customerPhone: customerInfo.phone,
    notes: customerInfo.notes,
  }),
});
```

### Problems With Current Approach

1. **No Type Safety:** Request/response not validated by Zod schemas
2. **Inconsistent with API Pattern:** All other public endpoints use ts-rest contracts
3. **Client Code Fragility:** Direct fetch URLs can break with API changes
4. **Missing Error Handling:** No standard error response schema

### Backend Route Exists But Not Contracted

**Location:** `server/src/routes/public-scheduling.routes.ts`

The route exists (`POST /v1/public/appointments/checkout`) but is NOT defined in contracts.

## Proposed Solutions

### Option A: Add Contract Definition (Recommended)
**Effort:** Small | **Risk:** Low

Add the missing contract to `api.v1.ts`:

```typescript
/**
 * Create a checkout session for an appointment time slot
 * POST /v1/public/appointments/checkout
 */
createAppointmentCheckout: {
  method: 'POST',
  path: '/v1/public/appointments/checkout',
  body: z.object({
    serviceId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    customerName: z.string().min(1).max(100),
    customerEmail: z.string().email(),
    customerPhone: z.string().optional(),
    notes: z.string().max(1000).optional(),
  }),
  responses: {
    201: z.object({
      checkoutUrl: z.string().url(),
      sessionId: z.string(),
    }),
    400: BadRequestErrorSchema,
    401: UnauthorizedErrorSchema,
    404: NotFoundErrorSchema,
    409: z.object({ error: z.string() }), // Slot no longer available
    500: InternalServerErrorSchema,
  },
  summary: 'Create checkout session for appointment booking (requires X-Tenant-Key)',
},
```

**Pros:**
- Type-safe API contract
- Consistent with other endpoints
- Enables generated client usage
- Zod validation for request/response

**Cons:**
- Need to update frontend to use contract client

### Option B: Add DTOs to Contracts
**Effort:** Medium | **Risk:** Low

Also add proper DTOs:

```typescript
// dto.ts
export const CreateAppointmentCheckoutDto = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const AppointmentCheckoutResponseDto = z.object({
  checkoutUrl: z.string().url(),
  sessionId: z.string(),
});

export type CreateAppointmentCheckoutInput = z.infer<typeof CreateAppointmentCheckoutDto>;
export type AppointmentCheckoutResponse = z.infer<typeof AppointmentCheckoutResponseDto>;
```

## Recommended Action

Implement **Option A** with **Option B** - Add both the contract endpoint and proper DTOs.

## Technical Details

**Files to Update:**
1. `packages/contracts/src/dto.ts` - Add DTO schemas
2. `packages/contracts/src/api.v1.ts` - Add contract endpoint
3. `client/src/features/scheduling/AppointmentBookingFlow.tsx` - Use contract client

**Frontend Update:**

```typescript
// Current (WRONG)
const response = await fetch(`${baseUrl}/v1/public/appointments/checkout`, {...});

// Fixed (using contract client)
const result = await api.createAppointmentCheckout({
  body: {
    serviceId: selectedService.id,
    date: selectedDate,
    startTime: selectedSlot.startTime,
    endTime: selectedSlot.endTime,
    customerName: customerInfo.name,
    customerEmail: customerInfo.email,
    customerPhone: customerInfo.phone,
    notes: customerInfo.notes,
  },
});

if (result.status === 201) {
  window.location.href = result.body.checkoutUrl;
} else if (result.status === 409) {
  setError('This time slot is no longer available');
} else {
  setError('Failed to create checkout session');
}
```

## Acceptance Criteria

- [ ] `CreateAppointmentCheckoutDto` schema added to dto.ts
- [ ] `createAppointmentCheckout` endpoint added to api.v1.ts
- [ ] Contract matches existing route implementation
- [ ] Frontend updated to use contract client
- [ ] Raw fetch call removed from AppointmentBookingFlow
- [ ] Error handling uses contract response types
- [ ] TypeScript compiles without errors

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during API Contract review - BLOCKS MERGE |

## Resources

- API Contract Reviewer analysis
- Code Quality review noted missing error handling
- Existing pattern: getPackages, createCheckout endpoints
