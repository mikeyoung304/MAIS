# fix: Chatbot Issues - Proposal Confirmation UI and Package Persistence

**Type:** Bug Fix / Enhancement
**Priority:** High
**Created:** 2025-12-29
**Estimated Complexity:** Medium (3 distinct issues, well-understood root causes)

---

## Overview

Testing both chatbots revealed three interconnected issues affecting the core chatbot experience:

1. **Customer Chatbot:** Booking proposal confirmation UI doesn't appear after `book_service` tool executes
2. **Tenant Admin Chatbot:** `upsert_package` tool executes but packages don't persist to database
3. **Package Display:** Cards show `$NaN` prices and blank names due to field mapping mismatch

These issues undermine the core value proposition of both chatbots and need to be addressed before the chatbot feature can be considered production-ready.

---

## Problem Statement

### Issue 1: Customer Chatbot Missing Proposal Confirmation UI

**Observed Behavior:**

- User asks to book a service with details (name, email, date)
- Chatbot responds: "I've done what I can with this request"
- No confirmation card with "Confirm Booking" / "Cancel" buttons appears

**Expected Behavior:**

- After `book_service` tool returns a T3 proposal, the UI should display:
  - Service name, date, price in a confirmation card
  - "Confirm Booking" and "Cancel" buttons
  - Loading state during confirmation

**Impact:** Users cannot complete bookings through the chatbot.

### Issue 2: Tenant Admin upsert_package Not Persisting

**Observed Behavior:**

- Admin asks: "Create a Mini Engagement Session package for $350"
- Chatbot shows `upsert_package` tool badge
- Chatbot responds: "Done! Your Mini Engagement Session package is live at $350"
- Package count remains at 3 (not 4)

**Expected Behavior:**

- T2 proposal auto-confirms on next message (within 2-minute soft-confirm window)
- Executor creates package in database
- Package count increases and package is queryable

**Impact:** Admins cannot manage packages through the chatbot.

### Issue 3: Package Display - $NaN and Blank Names

**Observed Behavior:**

- Package cards show blank where name should be
- Price shows "$NaN" instead of formatted amount
- All packages marked "Inactive"

**Root Cause:** Field name mismatch between API response and frontend expectations:
| API Returns | Frontend Expects |
|-------------|------------------|
| `title` | `name` |
| `priceCents`| `basePrice` |

**Impact:** Admins cannot see their package information correctly.

---

## Technical Approach

### Architecture Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER CHATBOT FLOW                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CustomerChatWidget.tsx                                             │
│         │                                                           │
│         ▼                                                           │
│  POST /v1/public/chat/message                                       │
│         │                                                           │
│         ▼                                                           │
│  CustomerOrchestrator.chat()                                        │
│         │                                                           │
│         ├──▶ book_service tool (customer-tools.ts:238-395)          │
│         │         │                                                 │
│         │         ▼                                                 │
│         │    proposalService.createProposal()                       │
│         │         │                                                 │
│         │         ▼                                                 │
│         │    Returns WriteToolProposal with proposalId              │
│         │                                                           │
│         ▼                                                           │
│  ❌ ISSUE: Orchestrator not passing proposal to response            │
│         │                                                           │
│         ▼                                                           │
│  Response: { message: "...", proposal: ??? }                        │
│         │                                                           │
│         ▼                                                           │
│  ❌ ISSUE: setPendingProposal never called                          │
│         │                                                           │
│         ▼                                                           │
│  No confirmation card rendered                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        ADMIN CHATBOT FLOW                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  GrowthAssistantPanel.tsx                                           │
│         │                                                           │
│         ▼                                                           │
│  POST /v1/agent/chat                                                │
│         │                                                           │
│         ▼                                                           │
│  AgentOrchestrator.chat()                                           │
│         │                                                           │
│         ├──▶ upsert_package tool (write-tools.ts:92-201)            │
│         │         │                                                 │
│         │         ▼                                                 │
│         │    Creates T2 Proposal (status: PENDING)                  │
│         │                                                           │
│         ▼                                                           │
│  User sends follow-up message                                       │
│         │                                                           │
│         ▼                                                           │
│  softConfirmPendingT2() (proposal.service.ts:211-281)               │
│         │                                                           │
│         ▼                                                           │
│  ❌ ISSUE: Proposal confirmed but executor not called?              │
│         │                                                           │
│         ▼                                                           │
│  Package NOT created in database                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Diagnose and Fix Customer Chatbot Proposal UI

**Investigation Points:**

1. **Check orchestrator response construction** (`customer-orchestrator.ts:517-610`)
   - Does `processToolUse()` capture the proposal from `book_service`?
   - Is proposal included in the returned response object?

2. **Check route response** (`public-customer-chat.routes.ts:173-242`)
   - Does the route include `proposal` in the JSON response?

3. **Check frontend handling** (`CustomerChatWidget.tsx:186-214`)
   - Does `setPendingProposal(data.proposal)` get called?
   - Is `data.proposal?.requiresApproval` check correct?

**Files to Modify:**

- `server/src/agent/customer/customer-orchestrator.ts` - Ensure proposal passthrough
- `server/src/routes/public-customer-chat.routes.ts` - Verify response structure
- `apps/web/src/components/chat/CustomerChatWidget.tsx` - Debug UI rendering

### Phase 2: Diagnose and Fix Admin Package Persistence

**Investigation Points:**

1. **Check T2 soft-confirm flow** (`proposal.service.ts:211-281`)
   - Is `softConfirmPendingT2()` being called on follow-up messages?
   - Are proposals being found and confirmed?

2. **Check executor registration** (`executors/index.ts:68-145`)
   - Is `'upsert_package'` executor properly registered at startup?
   - Tool name in proposal matches registered name?

3. **Check executor invocation**
   - After proposal status → CONFIRMED, is executor called?
   - Is `executeConfirmedProposals()` running?

4. **Check field mapping**
   - Tool uses `title` → Executor expects to map to `name`
   - Tool uses `priceCents` → Maps to `basePrice`

**Files to Modify:**

- `server/src/agent/proposals/proposal.service.ts` - Fix soft-confirm or execution
- `server/src/agent/executors/index.ts` - Verify executor registration/invocation
- `server/src/agent/tools/write-tools.ts` - Check payload structure

### Phase 3: Fix Package Display Field Mapping

**Root Cause:** API returns different field names than frontend expects.

**Option A (Recommended): Fix API Response**

Update `server/src/routes/tenant-admin.routes.ts` around lines 306-315:

```typescript
// Current (broken)
{
  title: pkg.name,        // ❌ Frontend expects 'name'
  priceCents: pkg.basePrice,  // ❌ Frontend expects 'basePrice'
}

// Fixed
{
  name: pkg.name,         // ✅ Match frontend
  basePrice: pkg.basePrice,   // ✅ Match frontend
}
```

**Option B: Fix Frontend**

Update `apps/web/src/components/tenant/PackageCard.tsx` to use API field names.

**Files to Modify:**

- `server/src/routes/tenant-admin.routes.ts` - Update response mapping
- OR `apps/web/src/types/package.ts` + component files

---

## Acceptance Criteria

### Issue 1: Customer Chatbot Proposal UI

- [ ] When `book_service` returns `requiresApproval: true`, response includes complete `proposal` object
- [ ] Proposal object contains: `proposalId`, `operation`, `preview`, `trustTier`, `requiresApproval`
- [ ] `CustomerChatWidget` displays confirmation card with service, date, price
- [ ] "Confirm Booking" button triggers POST to `/v1/public/chat/confirm/:proposalId`
- [ ] Successful confirmation shows success message with booking code
- [ ] "Cancel" button dismisses card without API call

### Issue 2: Admin Package Persistence

- [ ] T2 proposals auto-confirm on next message within 2-minute window
- [ ] `upsert_package` executor is called after proposal confirmation
- [ ] Package is created in database with correct tenant isolation
- [ ] Package appears in `/tenant/packages` page after creation
- [ ] Proposal status updates to `EXECUTED` with timestamp

### Issue 3: Package Display

- [ ] Package cards display actual name (not blank)
- [ ] Package cards display formatted price (not $NaN)
- [ ] Active/Inactive status displays correctly
- [ ] All existing packages render properly

---

## Test Plan

### Unit Tests

```typescript
// test/unit/agent/customer-orchestrator.test.ts
describe('CustomerOrchestrator', () => {
  it('includes proposal in response when book_service returns requiresApproval', async () => {
    // Mock book_service to return T3 proposal
    // Assert response includes proposal object
  });
});

// test/unit/agent/proposal.service.test.ts
describe('ProposalService', () => {
  it('soft-confirms T2 proposals within window on next message', async () => {
    // Create T2 proposal
    // Simulate next message
    // Assert proposal status is CONFIRMED
  });

  it('calls executor after proposal confirmation', async () => {
    // Mock executor
    // Confirm proposal
    // Assert executor called with payload
  });
});
```

### Integration Tests

```typescript
// test/integration/customer-chatbot.test.ts
describe('Customer Chatbot Booking Flow', () => {
  it('returns proposal for T3 booking request', async () => {
    const response = await request(app)
      .post('/v1/public/chat/message')
      .set('X-Tenant-Key', testTenantKey)
      .send({ message: 'Book Photo Session for Jan 15, john@test.com' });

    expect(response.body.proposal).toBeDefined();
    expect(response.body.proposal.requiresApproval).toBe(true);
  });
});

// test/integration/admin-chatbot.test.ts
describe('Admin Chatbot Package Creation', () => {
  it('creates package after T2 soft-confirm', async () => {
    // Send package creation request
    // Send follow-up message
    // Query database for new package
    // Assert package exists
  });
});
```

### E2E Tests (Playwright)

```typescript
// e2e/tests/customer-booking.spec.ts
test('customer can complete booking via chatbot', async ({ page }) => {
  await page.goto('/t/demo-tenant');
  await page.click('[aria-label="Open chat"]');
  await page.fill('textarea', 'Book Photo Session for Feb 1, jane@test.com');
  await page.press('textarea', 'Enter');

  // Wait for confirmation card
  await expect(page.getByText('Confirm your booking')).toBeVisible();
  await page.click('button:has-text("Confirm Booking")');

  // Verify success
  await expect(page.getByText(/BK-[A-Z0-9]{6}/)).toBeVisible();
});
```

---

## Risk Analysis

| Risk                                        | Impact | Mitigation                              |
| ------------------------------------------- | ------ | --------------------------------------- |
| Proposal changes break existing sessions    | Medium | Add backward compatibility checks       |
| Field mapping changes break other consumers | High   | Search all usages before changing       |
| T2 soft-confirm timing issues               | Medium | Add logging to track proposal lifecycle |
| Double-booking during fix                   | Low    | Advisory locks already in place         |

---

## Implementation Sequence

1. **Start with Issue 3 (Package Display)** - Quickest fix, independent
2. **Then Issue 2 (Admin Package Persistence)** - Enables proper testing
3. **Finally Issue 1 (Customer Proposal UI)** - Most complex, may need debugging

---

## References

### Internal Files

- `server/src/agent/customer/customer-orchestrator.ts:517-610` - Tool execution
- `server/src/agent/customer/customer-tools.ts:238-395` - book_service tool
- `server/src/agent/proposals/proposal.service.ts:211-281` - T2 soft-confirm
- `server/src/agent/executors/index.ts:68-145` - upsert_package executor
- `server/src/routes/tenant-admin.routes.ts:306-315` - Package API response
- `apps/web/src/components/chat/CustomerChatWidget.tsx:186-214` - Proposal UI

### Documentation

- `docs/solutions/code-review-patterns/pr-23-customer-chatbot-review-fixes-MAIS-20251228.md`
- `CLAUDE.md` - Trust tier system documentation

### Related PRs

- PR #23 - Customer chatbot implementation

---

## Success Metrics

1. **Customer booking completion rate** > 90% (of started booking flows)
2. **Package creation success rate** = 100% (when admin requests)
3. **Package display errors** = 0 ($NaN, blank names)
4. **All E2E chatbot tests passing**
