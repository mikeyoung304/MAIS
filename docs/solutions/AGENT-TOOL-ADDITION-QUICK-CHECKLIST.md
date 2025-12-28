# Agent Tool Addition Quick Checklist

> **For:** Developers adding features to MAIS
> **When:** Before implementing a new UI feature or agent capability
> **Time:** 5 minutes to complete
> **Print & Pin:** YES

---

## Pre-Implementation (15 minutes)

### Feature Discovery

```
FEATURE: [What are you building?]
UI ACTION: [What will users click in the UI?]
BUSINESS DATA AFFECTED: [What gets changed?]
REVERSIBLE: [Yes/No - can user undo this?]
```

### Action Parity Audit

```
☐ UI has this action
☐ Agent should have this action? (not just UI cosmetics)
☐ Agent system prompt mentions this capability?
☐ Tool already exists? No → CREATE IT
☐ Tool already exists? Yes → UPDATE IT
```

### Trust Tier Assignment

```
Is the action:

☐ T1 (Auto): Safe, reversible, visible
   Examples: View data, create drafts, upload files
   Confirmation: NONE

☐ T2 (Soft): Important, reversible
   Examples: Price change, landing page edit, visibility toggle
   Confirmation: "Say 'looks good' to proceed"

☐ T3 (Hard): Irreversible, high impact
   Examples: Delete with dependencies, refunds, account cancellation
   Confirmation: "Type 'yes' to confirm"
```

---

## Backend Error Messages (Required)

Use this pattern when adding ANY feature with potential errors:

### Step 1: Service Layer Error

```typescript
// ✅ DO THIS

// 1a. Define domain error class
export class MyActionError extends Error {
  constructor(
    public reason: 'reason_a' | 'reason_b' | 'reason_c'
  ) {
    super(`Action failed: ${reason}`);
  }
}

// 1b. Service throws with specific reason
async performAction() {
  if (condition_a) throw new MyActionError('reason_a');
  if (condition_b) throw new MyActionError('reason_b');
  // ... perform action
}
```

❌ DON'T: Throw generic "Operation failed" message

### Step 2: Route Layer Mapping

```typescript
// ✅ DO THIS

// 2. Route catches and maps to HTTP
try {
  const result = await service.performAction();
  return { status: 200, body: result };
} catch (error) {
  if (error instanceof MyActionError) {
    return {
      status: 409, // or 400, 422, etc
      body: {
        code: 'MY_ACTION_ERROR',
        reason: error.reason,
        message: error.message,
      },
    };
  }
  throw error;
}
```

❌ DON'T: Swallow errors or return generic responses

### Step 3: Contract Definition

```typescript
// ✅ DO THIS

// 3. Contract defines response shape
export const myAction = {
  method: 'POST',
  path: '/my-action',
  responses: {
    200: SuccessSchema,
    409: z.object({
      code: z.literal('MY_ACTION_ERROR'),
      reason: z.enum(['reason_a', 'reason_b', 'reason_c']),
      message: z.string(),
    }),
  },
};
```

❌ DON'T: Leave error response undefined

### Step 4: Frontend Uses Backend Message

```typescript
// ✅ DO THIS

// 4. Frontend reads reason and explains to user
const { mutate, error } = useMutation({
  mutationFn: api.myAction,
  onError: (err) => {
    const { reason } = err.response.data;

    const message = {
      reason_a: 'User-friendly explanation of reason A',
      reason_b: 'User-friendly explanation of reason B',
      reason_c: 'User-friendly explanation of reason C',
    }[reason];

    showError(message);
  },
});
```

❌ DON'T: Hardcode error messages in frontend

### Step 5: Agent Tool Uses Same Format

```typescript
// ✅ DO THIS

// 5. Agent tool receives same error format
export async function myActionTool(context, input) {
  try {
    const result = await service.performAction();
    return { status: 'success', ... };
  } catch (error) {
    if (error instanceof MyActionError) {
      return {
        status: 'error',
        code: 'MY_ACTION_ERROR',
        reason: error.reason,
        message: error.message, // Agent can explain
      };
    }
    throw error;
  }
}
```

❌ DON'T: Silently fail or return different error format

### Step 6: System Prompt Explains Errors

```
// ✅ DO THIS

When my-action fails, read the error reason:
- reason_a: [Explain A and suggest next steps]
- reason_b: [Explain B and suggest next steps]
- reason_c: [Explain C and suggest next steps]
```

❌ DON'T: Generic "I'm sorry, something went wrong"

---

## Agent Tool Addition Checklist

When adding a NEW agent tool:

### Planning (30 minutes)

```
☐ Tool name defined (verb-based: create_, update_, delete_, get_)
☐ Tool purpose is ONE SENTENCE
☐ Input schema defined (required + optional fields)
☐ Output schema defined (success + error cases)
☐ Trust tier assigned (T1/T2/T3)
☐ Error scenarios documented (all codes listed)
☐ System prompt section written (how/when to use)
```

### Implementation (Coding)

```
☐ Service method implemented
☐ Route/handler created
☐ Contract defined (request + response schemas)
☐ Domain errors defined (all reason codes)
☐ Error mapping in route (domain → HTTP)
☐ Tool wrapper implemented
☐ Tool added to tool list
☐ System prompt updated
```

### Testing (Before PR)

```
☐ Happy path: tool works when inputs are valid
☐ Each error code: tested with intentional failure
☐ Tenant isolation: cross-tenant access blocked
☐ Agent response: reads error reason correctly
☐ System prompt: mentions new tool explicitly
☐ UI and agent: same error messages (both readable)
```

### Documentation

```
☐ Tool listed in TOOL_LIST.md (or equivalent)
☐ Error codes documented with reason explanations
☐ System prompt section added
☐ Example agent interaction shown
☐ Trust tier justified
```

---

## Action Parity Verification

Complete this for every feature audit:

```
FEATURE: Package Cancellation

UI Actions:
☐ Cancel package
  └─ Agent Tool: cancel_package
     └─ Trust Tier: T2

UI Actions:
☐ Cancel with notice to customers
  └─ Agent Tool: cancel_package (reason parameter)
     └─ Trust Tier: T2

UI Actions:
☐ View cancellation policy
  └─ Agent Tool: get_cancellation_policy
     └─ Trust Tier: T1

SUMMARY: ✅ All UI actions have agent equivalents
         ✅ No action parity gaps
```

---

## Error Message Pattern Quick Ref

```
WRONG (Hardcoded):
❌ return <div>Something went wrong</div>

WRONG (Generic backend):
❌ throw new Error('Operation failed')

CORRECT (Domain error with reason):
✅ throw new PackageError(name, 'duplicate_name')
✅ return { status: 409, body: { reason: 'duplicate_name', ... } }
✅ Frontend reads reason and explains to user
✅ Agent reads reason and suggests alternatives
```

---

## Before Committing

```
☐ All tests pass (unit + integration + E2E)
☐ No hardcoded error messages in frontend
☐ Error message same in UI and agent
☐ All error codes documented
☐ System prompt updated
☐ Action parity verified
☐ Code review checklist complete
```

---

## Common Mistakes (Avoid These!)

### Mistake #1: Hardcoded Error

```javascript
// ❌ WRONG
catch (error) {
  return <div>Booking failed. Try another date.</div>;
}

// ✅ CORRECT
catch (error) {
  const message = {
    already_booked: 'Date is taken, try another.',
    maintenance: 'I\'m unavailable that week.',
  }[error.response.data.reason];
  return <div>{message}</div>;
}
```

### Mistake #2: Missing Agent Tool

```
UI has: "Cancel booking" button
Agent can: "View bookings" only
User says: "Cancel booking 123"
Agent says: "I can't do that"

❌ Action parity broken

SOLUTION: Add cancel_booking tool to agent
```

### Mistake #3: Different Error Messages

```
UI shows: "That date is already booked"
Agent shows: "Operation failed"

❌ Inconsistent messaging
❌ Agent can't explain why
❌ User loses trust

SOLUTION: Same error code → same explanation in UI and agent
```

### Mistake #4: No Confirmation Flow

```
UI: Click button once to cancel booking (T2 soft confirm)
Agent: Asks "Are you sure?" 5 times (excessive)

❌ Agent harder to use than UI

SOLUTION: Use trust tiers consistently across UI and agent
```

### Mistake #5: Sensitive Data in Error

```javascript
// ❌ WRONG - Leaks system info
throw new Error(`Database connection failed: ${connectionString}`);

// ✅ CORRECT - User-friendly only
throw new Error('Could not save changes. Please try again.');
```

---

## Print This

```
┌────────────────────────────────────────────────────────┐
│  AGENT TOOL ADDITION QUICK CHECKLIST (Print & Pin)     │
├────────────────────────────────────────────────────────┤
│                                                         │
│ BEFORE CODING (30 min)                                 │
│ ☐ Feature clearly defined                              │
│ ☐ UI actions listed                                    │
│ ☐ Agent tools identified                               │
│ ☐ Trust tier assigned (T1/T2/T3)                       │
│ ☐ Error scenarios documented                           │
│                                                         │
│ WHILE CODING (Follow Pattern)                          │
│ ☐ Service throws domain error with reason              │
│ ☐ Route maps error code to HTTP response               │
│ ☐ Contract defines error response shape                │
│ ☐ Frontend reads reason from response                  │
│ ☐ Agent tool receives same error format                │
│ ☐ System prompt explains error meanings                │
│                                                         │
│ ACTION PARITY                                          │
│ ☐ List all UI actions                                  │
│ ☐ Create tool for each action                          │
│ ☐ No agent limitations without reason                  │
│                                                         │
│ BEFORE COMMIT                                          │
│ ☐ Tests pass                                           │
│ ☐ No hardcoded error messages                          │
│ ☐ Error messages consistent UI ↔ Agent                │
│ ☐ System prompt mentions new tool                      │
│ ☐ All error codes documented                           │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## Quick Links

- **Full Prevention Strategy:** `AGENT-TOOL-ADDITION-PREVENTION.md`
- **Agent Design Checklist:** `AGENT-DESIGN-QUICK-CHECKLIST.md`
- **Trust Tier Guide:** `AGENT-DESIGN-PREVENTION-STRATEGIES.md#trust-tier-guidelines`
- **Error Handling Pattern:** `AGENT-TOOL-ADDITION-PREVENTION.md#strategy-1-backend-driven-error-messages`
- **Action Parity Audit:** `AGENT-TOOL-ADDITION-PREVENTION.md#strategy-2-action-parity-checklist`

---

**Version:** 1.0
**Last Updated:** 2025-12-28
**Next Review:** 2026-01-28
