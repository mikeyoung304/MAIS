# Agent Tool Addition Prevention Strategy

> **For:** AI agents, engineers adding features to agent systems
> **When:** Before adding any new UI feature or agent capability
> **Based on:** Lessons from hardcoded error messages vs dynamic messages, action parity gaps
> **Companion to:** `AGENT-DESIGN-PREVENTION-STRATEGIES.md`, `AGENT-DESIGN-QUICK-CHECKLIST.md`

---

## Table of Contents

1. [Problem Pattern](#problem-pattern)
2. [Prevention Strategies](#prevention-strategies)
3. [Quick Checklist](#quick-checklist)
4. [Decision Tree](#decision-tree)
5. [Code Examples](#code-examples)
6. [Common Pitfalls](#common-pitfalls)

---

## Problem Pattern

### Symptom #1: Hardcoded Error Messages (Frontend)

**Problem:**

```typescript
// ❌ WRONG - Error message hardcoded in frontend
function BookingForm() {
  if (!available) {
    return <div>Sorry, that date is not available</div>;
  }
}
```

**Why it breaks:**

- Backend has the REAL error reason (already booked, maintenance window, etc)
- Frontend can only guess
- Agent receives generic message, can't explain to user why
- Message inconsistency across platforms (web, mobile, API, agent)

**Result:** Agent responds with stale/incorrect information, poor user experience

### Symptom #2: Action Parity Gap (Missing Agent Tools)

**Problem:**

```typescript
// ❌ WRONG - UI can cancel booking, but agent can't
// In BookingUI.tsx
<Button onClick={() => api.cancelBooking(id)}>Cancel</Button>

// Agent System Prompt
// Agent can only: create bookings, view bookings
// Agent CANNOT: cancel bookings (not in tool list)
```

**Why it breaks:**

- User asks agent "Can you cancel booking #123?"
- Agent says "I'm unable to cancel bookings"
- User has to switch to UI to cancel
- Workflow is broken, trust in agent erodes

**Result:** Action parity broken, user frustrated, productivity loss

---

## Prevention Strategies

### Strategy #1: Backend-Driven Error Messages

**Core Principle:** Error messages originate from backend service, never frontend

#### Step 1: Service Layer Returns Domain Errors

```typescript
// In server/src/services/booking.service.ts
export class BookingConflictError extends Error {
  constructor(date: string, reason: string) {
    super(`Cannot book ${date}: ${reason}`);
    this.code = 'BOOKING_CONFLICT';
    this.reason = reason; // 'already_booked' | 'maintenance' | 'blackout'
    this.date = date;
  }
}

// Service throws with specific reason
async createBooking(tenantId: string, date: string) {
  const existing = await this.repo.findByDate(tenantId, date);
  if (existing) {
    throw new BookingConflictError(date, 'already_booked');
  }

  const blackout = await this.blackoutService.check(tenantId, date);
  if (blackout) {
    throw new BookingConflictError(date, 'blackout_window');
  }

  // ... create booking
}
```

#### Step 2: Route Maps Error to HTTP Response

```typescript
// In server/src/routes/bookings.routes.ts
export const createBookingRouter = tsRestExpress(contract.createBooking, async (req) => {
  try {
    const booking = await bookingService.create(req.tenantId, req.body);
    return { status: 201, body: booking };
  } catch (error) {
    if (error instanceof BookingConflictError) {
      return {
        status: 409,
        body: {
          code: error.code,
          reason: error.reason, // 'already_booked' | 'maintenance' | 'blackout'
          date: error.date,
          message: error.message,
        },
      };
    }
    throw error;
  }
});
```

#### Step 3: Contract Defines Error Response

```typescript
// In packages/contracts/src/booking.contract.ts
export const createBooking = {
  method: 'POST',
  path: '/bookings',
  responses: {
    201: BookingSchema,
    409: z.object({
      code: z.literal('BOOKING_CONFLICT'),
      reason: z.enum(['already_booked', 'maintenance', 'blackout']),
      date: z.string(),
      message: z.string(),
    }),
  },
};
```

#### Step 4: Frontend Uses Backend Message

```typescript
// In apps/web/src/components/BookingForm.tsx or client/src/pages/BookingPage.tsx
function BookingForm() {
  const { mutate: createBooking } = useMutation({
    mutationFn: api.createBooking,
    onError: (error) => {
      // ✅ CORRECT - Use backend message
      const errorResponse = error.response.data;

      let userMessage = 'Something went wrong. Please try again.';

      if (errorResponse.code === 'BOOKING_CONFLICT') {
        switch (errorResponse.reason) {
          case 'already_booked':
            userMessage = `That date is already booked. Try ${formatDate(nextAvailable())}.`;
            break;
          case 'blackout_window':
            userMessage = `${formatDate(errorResponse.date)} is not available. I\'m taking a break that week.`;
            break;
          case 'maintenance':
            userMessage = `Booking unavailable ${formatDate(errorResponse.date)} due to maintenance.`;
            break;
        }
      }

      return <ErrorAlert message={userMessage} />;
    },
  });
}
```

#### Step 5: Agent Receives Same Error Response

```typescript
// In agent tool implementation (server/src/tools/booking.tool.ts)
export async function createBookingTool(
  context: AuthContext,
  input: CreateBookingInput
): Promise<CreateBookingResponse> {
  try {
    const response = await bookingService.create(context.tenantId, input.date);
    return { status: 'success', booking: response };
  } catch (error) {
    if (error instanceof BookingConflictError) {
      return {
        status: 'error',
        code: error.code,
        reason: error.reason,
        message: error.message,
        // Agent can now explain specifically why
      };
    }
    throw error;
  }
}
```

#### Step 6: Agent System Prompt Uses Error Reason

```
When a booking fails, read the error reason:
- 'already_booked': Suggest checking calendar or using a different date
- 'blackout_window': Explain the photographer is unavailable that week
- 'maintenance': Apologize and suggest rebooking next week

Always show the specific reason to the user.
```

---

### Strategy #2: Action Parity Checklist

**Core Principle:** Every UI action must have a corresponding agent tool

#### Verification Process

```markdown
## Action Parity Audit

### Step 1: List All UI Actions

For each page/feature, list every action user can take:

| Page    | Action         | Tool Exists? | Notes          |
| ------- | -------------- | ------------ | -------------- |
| Booking | Create booking | ✅           | create_booking |
| Booking | Cancel booking | ❌           | MISSING        |
| Booking | Reschedule     | ❌           | MISSING        |
| Pricing | Edit package   | ✅           | update_package |
| Pricing | Delete package | ✅           | delete_package |

### Step 2: Create Missing Tools

For each ❌, create corresponding agent tool

### Step 3: Test Action Parity

Run integration tests:
```

#### Example: Booking Actions Audit

**UI Actions (Current):**

```typescript
// BookingUI.tsx
export function BookingPage() {
  return (
    <>
      <Button onClick={() => api.createBooking(date)}>Book</Button>
      <Button onClick={() => api.cancelBooking(id)}>Cancel</Button>
      <Button onClick={() => api.rescheduleBooking(id, newDate)}>Reschedule</Button>
      <Button onClick={() => api.viewUnavailable()}>See Unavailable Dates</Button>
    </>
  );
}
```

**Agent Tools (What We Need):**

```typescript
// ✅ GOOD - All UI actions have agent equivalents
export const bookingTools = {
  create_booking: {
    description: 'Book a specific date',
    parameters: { date: string },
  },
  cancel_booking: {
    description: 'Cancel an existing booking',
    parameters: { bookingId: string, reason?: string },
  },
  reschedule_booking: {
    description: 'Move booking to a different date',
    parameters: { bookingId: string, newDate: string },
  },
  get_unavailable_dates: {
    description: 'Show dates when photographer is unavailable',
    parameters: {},
  },
};

// ❌ WRONG - Missing action
// Agent CAN create/cancel but NOT reschedule
export const bookingTools = {
  create_booking: { ... },
  cancel_booking: { ... },
  // reschedule_booking: MISSING!
};
```

#### When NOT to Create a Tool

Three cases where UI action doesn't need agent equivalent:

1. **Fine-grained UI state** (e.g., expand/collapse accordion)

   ```typescript
   // No tool needed - local UI state
   <Accordion onToggle={setExpanded} />
   ```

2. **Cosmetic changes** (e.g., light/dark mode)

   ```typescript
   // No tool needed - user preference, not business action
   <ThemeToggle onChange={setTheme} />
   ```

3. **Navigation** (e.g., page transitions)
   ```typescript
   // No tool needed - agent doesn't navigate, it performs actions
   <Link href="/packages">View Packages</Link>
   ```

**Guideline:** "Does this action change business data or user-visible content?" → YES = needs tool, NO = local state only

---

### Strategy #3: Trust Tier Guidelines for Error Handling

**Core Principle:** Different error types need different confirmation flows

#### T1 (Auto - No Confirmation)

**When:** Safe, reversible, visible operations

- Viewing data
- Creating drafts
- Uploading files
- Setting blackouts (user can remove later)

**Error Handling:** Show message immediately, no confirmation needed

```typescript
// T1: Just show error
try {
  await getTool.getBookings(context);
} catch (error) {
  return {
    status: 'error',
    message: 'Could not load bookings. Please try again.',
    // No confirmation needed
  };
}
```

#### T2 (Soft - Soft Confirmation)

**When:** Important changes, but reversible

- Package price changes
- Cancellation (user can rebook)
- Landing page edits
- Branding changes

**Error Handling:** Propose result, wait for "looks good" confirmation

```typescript
// T2: Propose then wait
const proposal = {
  type: 'update_package_price',
  before: { price: 100 },
  after: { price: 120 },
  message: 'I can update Photography Plus from $100 to $120. Say "looks good" to proceed.',
};
return { status: 'requires_confirmation', proposal };
```

#### T3 (Hard - Hard Confirmation)

**When:** Irreversible changes, high impact

- Deleting packages with bookings
- Refunds
- Account cancellation
- Data exports

**Error Handling:** Require explicit "yes" confirmation

```typescript
// T3: Require explicit yes
const proposal = {
  type: 'delete_package_with_bookings',
  impact: '3 upcoming bookings will be cancelled',
  message: 'Delete Photography Plus and cancel 3 upcoming bookings? Type "yes" to confirm.',
};
return { status: 'requires_explicit_confirmation', proposal };
```

---

## Quick Checklist

Use this BEFORE adding any new feature to UI or agent:

```markdown
BEFORE Adding New UI Feature or Agent Tool:

STEP 1: Define the Action

- [ ] What does the user want to do? (Be specific)
- [ ] Is this changing business data or just UI state?
- [ ] Is this reversible?

STEP 2: Backend-Driven Error Messages

- [ ] Service layer defined with domain errors?
- [ ] Error codes documented (already_booked, maintenance, etc)?
- [ ] Route maps errors to HTTP responses?
- [ ] Contract defines error response schema?
- [ ] Error messages are user-friendly (not technical)?

STEP 3: Agent Tool Parity

- [ ] Is there a UI action? → YES = needs agent tool
- [ ] Does agent need this tool? (not just UI cosmetics)
- [ ] Tool purpose is 1 sentence (verb-based)?
- [ ] Tool trust tier assigned (T1/T2/T3)?

STEP 4: Error Handling Strategy

- [ ] What can go wrong? (List all error codes)
- [ ] What should agent say for each error?
- [ ] What confirmation flow needed? (T1/T2/T3)
- [ ] Are error messages consistent UI ↔ Agent?

STEP 5: Implementation

- [ ] Service layer throws domain errors
- [ ] Route catches and maps to HTTP
- [ ] Contract defines error response
- [ ] Frontend uses backend message
- [ ] Agent tool receives same error format
- [ ] Agent system prompt explains errors

STEP 6: Testing

- [ ] Error response contains all needed info
- [ ] Frontend displays error correctly
- [ ] Agent tool handles error correctly
- [ ] Error messages are helpful, not scary
- [ ] Same message in UI and agent

STEP 7: Documentation

- [ ] Tool documented in tool list
- [ ] Error codes documented
- [ ] System prompt updated with error explanations
- [ ] Team knows about new action parity
```

---

## Decision Tree

```
I'm adding a new feature...

1. Is it UI-only? (e.g., accordion expand, theme toggle)
   YES → No tool needed
   NO → Continue

2. Does it change user-visible business data?
   NO → No tool needed (local UI state)
   YES → Continue

3. Will agents ever need to do this?
   NO → No tool needed (e.g., analytics dashboard)
   YES → Create agent tool

4. Is the action reversible?
   NO → T3 (hard confirmation)
   YES →
     4a. Is it safe? (e.g., view data) → T1 (no confirmation)
     4b. Is it important? (e.g., price change) → T2 (soft confirmation)

5. Can errors occur?
   YES →
     5a. Service: Define domain error class
     5b. Route: Map error to HTTP response
     5c. Contract: Define error response schema
     5d. Frontend: Use backend message
     5e. Agent: Handle error in tool
   NO → Simple happy path
```

---

## Code Examples

### Pattern: Feature with Dynamic Error Messages

```typescript
// 1. Service defines domain error
// server/src/services/scheduling.service.ts
export class SchedulingConflictError extends Error {
  constructor(
    public date: string,
    public reason: 'already_booked' | 'maintenance' | 'capacity_full'
  ) {
    super(`Cannot schedule ${date}: ${reason}`);
  }
}

export class SchedulingService {
  async scheduleSession(tenantId: string, date: string) {
    // Check for conflicts
    const booking = await this.bookingRepo.findByDate(tenantId, date);
    if (booking) {
      throw new SchedulingConflictError(date, 'already_booked');
    }

    const maintenance = await this.maintenanceRepo.check(tenantId, date);
    if (maintenance) {
      throw new SchedulingConflictError(date, 'maintenance');
    }

    const capacity = await this.capacityService.check(tenantId, date);
    if (capacity.isFull) {
      throw new SchedulingConflictError(date, 'capacity_full');
    }

    return this.bookingRepo.create(tenantId, { date, ... });
  }
}

// 2. Route maps to HTTP
// server/src/routes/scheduling.routes.ts
export const scheduleSession = tsRestExpress(
  contract.scheduleSession,
  async (req) => {
    try {
      const session = await schedulingService.scheduleSession(
        req.tenantId,
        req.body.date
      );
      return { status: 201, body: session };
    } catch (error) {
      if (error instanceof SchedulingConflictError) {
        return {
          status: 409,
          body: {
            code: 'SCHEDULING_CONFLICT',
            reason: error.reason,
            date: error.date,
            message: error.message,
          },
        };
      }
      throw error;
    }
  }
);

// 3. Contract defines schema
// packages/contracts/src/scheduling.contract.ts
export const scheduleSession = {
  method: 'POST',
  path: '/scheduling/sessions',
  responses: {
    201: SessionSchema,
    409: z.object({
      code: z.literal('SCHEDULING_CONFLICT'),
      reason: z.enum(['already_booked', 'maintenance', 'capacity_full']),
      date: z.string(),
      message: z.string(),
    }),
  },
};

// 4. Frontend uses error reason
// apps/web/src/components/SchedulingForm.tsx
function SchedulingForm() {
  const { mutate, error } = useMutation({
    mutationFn: api.scheduleSession,
  });

  function renderError() {
    if (!error?.response?.data) return null;

    const { reason, date } = error.response.data;

    switch (reason) {
      case 'already_booked':
        return `${formatDate(date)} already has a session. Try another date.`;
      case 'maintenance':
        return `I'm taking maintenance on ${formatDate(date)}. When works for you?`;
      case 'capacity_full':
        return `${formatDate(date)} is at capacity. I can suggest alternatives.`;
    }
  }

  return (
    <>
      <form onSubmit={(e) => {
        e.preventDefault();
        mutate({ date: form.date });
      }}>
        <input type="date" value={form.date} onChange={e => form.date = e.target.value} />
        <button>Schedule</button>
      </form>
      {renderError() && <ErrorAlert message={renderError()} />}
    </>
  );
}

// 5. Agent tool uses same error format
// server/src/tools/scheduling.tool.ts
export async function scheduleSessionTool(
  context: AuthContext,
  input: { date: string }
): Promise<ScheduleSessionResponse> {
  try {
    const session = await schedulingService.scheduleSession(context.tenantId, input.date);
    return {
      status: 'success',
      session,
      message: `Scheduled session for ${formatDate(input.date)}.`,
    };
  } catch (error) {
    if (error instanceof SchedulingConflictError) {
      return {
        status: 'error',
        code: 'SCHEDULING_CONFLICT',
        reason: error.reason,
        date: error.date,
        // Agent can now explain why
      };
    }
    throw error;
  }
}

// 6. System prompt explains errors
const systemPrompt = `
When scheduling a session, these errors can occur:

- already_booked: Session already exists that day. Help user find alternative.
- maintenance: You're taking maintenance that day. Suggest dates you ARE available.
- capacity_full: You're fully booked. Apologize and suggest waitlist or future dates.

Always explain the reason and suggest next steps.
`;
```

### Pattern: Tool for Previously UI-Only Action

```typescript
// Discover missing tool during action parity audit
// UI has: Cancel booking (with reason)
// Agent does NOT have this → Add it

// 1. Service implements cancellation
// server/src/services/booking.service.ts
export class BookingService {
  async cancel(tenantId: string, bookingId: string, reason?: string) {
    const booking = await this.repo.get(tenantId, bookingId);
    if (!booking) throw new NotFoundError('Booking');

    // Check if refundable
    const daysUntil = calculateDaysUntil(booking.date);
    if (daysUntil < 3) {
      throw new RefundPolicyError('Less than 3 days until booking');
    }

    // Cancel and refund
    await this.repo.update(tenantId, bookingId, { status: 'cancelled' });
    if (booking.paid) {
      await this.refundProvider.refund(booking.paymentId);
    }

    // Notify user
    await this.emailService.sendCancellationConfirm(booking.email);

    return { status: 'cancelled', refunded: booking.paid };
  }
}

// 2. Create agent tool
// server/src/tools/booking.tool.ts
export async function cancelBookingTool(
  context: AuthContext,
  input: { bookingId: string; reason?: string }
): Promise<CancelBookingResponse> {
  try {
    const result = await bookingService.cancel(
      context.tenantId,
      input.bookingId,
      input.reason
    );
    return {
      status: 'success',
      message: result.refunded
        ? 'Booking cancelled and refund processed.'
        : 'Booking cancelled.',
      refunded: result.refunded,
    };
  } catch (error) {
    if (error instanceof RefundPolicyError) {
      return {
        status: 'error',
        code: 'REFUND_POLICY_VIOLATION',
        message: error.message,
      };
    }
    throw error;
  }
}

// 3. Add to tool list
export const BOOKING_TOOLS = [
  { name: 'create_booking', ... },
  { name: 'cancel_booking', ... }, // ← NEW
  { name: 'reschedule_booking', ... },
];

// 4. Update system prompt
const systemPrompt = `
Available booking actions:
- create_booking: Book a specific date
- cancel_booking: Cancel and refund existing booking (must be >3 days away)
- reschedule_booking: Move booking to different date
`;
```

---

## Common Pitfalls

### Pitfall #1: Hardcoded UI Error Message

**Problem:**

```typescript
// ❌ WRONG - Frontend guesses error reason
async function BookingForm() {
  try {
    await api.createBooking(date);
  } catch (error) {
    // Hardcoded message, doesn't match backend reason
    return <div>Sorry, booking failed. Try another date.</div>;
  }
}
```

**Solution:**

```typescript
// ✅ CORRECT - Use backend message
async function BookingForm() {
  try {
    await api.createBooking(date);
  } catch (error) {
    // Use reason from backend
    const { reason } = error.response.data;
    const message = getErrorMessage(reason);
    return <div>{message}</div>;
  }
}

function getErrorMessage(reason: string) {
  const messages: Record<string, string> = {
    already_booked: 'That date is already booked.',
    maintenance: 'I\'m taking maintenance that week.',
    capacity_full: 'I\'m fully booked that day.',
  };
  return messages[reason] || 'Something went wrong. Please try again.';
}
```

---

### Pitfall #2: Missing Agent Tool for UI Action

**Problem:**

```typescript
// UI can do this:
<Button onClick={() => api.cancelBooking(id)}>Cancel</Button>

// Agent cannot:
// Tool list: [create_booking, view_bookings]
// Missing: cancel_booking
```

**Solution:**

```typescript
// Add cancel_booking tool
export const cancelBookingTool = async (context, input) => {
  return bookingService.cancel(context.tenantId, input.bookingId);
};

// Add to tool list
export const BOOKING_TOOLS = [
  'create_booking',
  'view_bookings',
  'cancel_booking', // ← NEW
];

// Update system prompt
const systemPrompt = `
You can manage bookings:
- create_booking
- view_bookings
- cancel_booking
`;
```

---

### Pitfall #3: Agent Receives Generic Error

**Problem:**

```typescript
// Service throws: "Operation failed"
// Agent response: "I'm sorry, I couldn't complete that."
// User: Frustrated, doesn't know why
```

**Solution:**

```typescript
// Service throws domain error with reason
throw new BookingError(date, 'already_booked');

// Route includes reason in response
{ status: 409, body: { reason: 'already_booked', ... } }

// Agent tool receives reason
const { reason } = error.response.data;

// Agent system prompt explains reason
const systemPrompt = `
If booking fails:
- already_booked: Date is taken, suggest alternatives
- maintenance: You're unavailable, apologize
- ...
`;
```

---

### Pitfall #4: Confirmation Inconsistency

**Problem:**

```typescript
// UI: Simple click to cancel booking
<Button onClick={() => api.cancelBooking(id)}>Cancel</Button>

// Agent: Asks for explicit "yes" confirmation for every action
// User: Why is the agent harder to use than UI?
```

**Solution:**

```typescript
// Use trust tiers consistently
// T1 (no confirmation): View data, create drafts
// T2 (soft confirmation): Price changes, landing page edits
// T3 (hard confirmation): Deletions, refunds

// Cancellation is T2 (reversible, important)
const proposal = {
  type: 'cancel_booking',
  before: 'Booking on March 15 for Sarah',
  after: 'Cancelled, refund processed',
  message: 'I'll cancel this booking and process the refund. Say "looks good" to proceed.',
};

// Not T3 (hard confirmation on every action)
// Not T1 (no confirmation at all)
```

---

## References

- **Full Prevention Strategies:** `docs/solutions/AGENT-DESIGN-PREVENTION-STRATEGIES.md`
- **Quick Checklist:** `docs/solutions/AGENT-DESIGN-QUICK-CHECKLIST.md`
- **Agent Design Index:** `docs/solutions/AGENT-DESIGN-INDEX.md`
- **Trust Tier Guidelines:** `docs/solutions/AGENT-DESIGN-PREVENTION-STRATEGIES.md#trust-tier-guidelines`

---

## Version History

| Version | Date       | Changes                                                          |
| ------- | ---------- | ---------------------------------------------------------------- |
| 1.0     | 2025-12-28 | Initial: Error message pattern, action parity audit, trust tiers |

---

**Last Updated:** 2025-12-28
**Next Review:** 2026-01-28
**Audience:** AI agents, engineers adding features
