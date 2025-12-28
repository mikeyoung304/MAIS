---
title: 'Growth Assistant Health Check Messaging + Stripe Tools Solution'
category: 'agent-design'
tags: ['agent', 'growth-assistant', 'error-messaging', 'tools', 'stripe', 'ux', 'booking-links']
related_files:
  - '/Users/mikeyoung/CODING/MAIS/server/src/routes/agent.routes.ts'
  - '/Users/mikeyoung/CODING/MAIS/apps/web/src/components/agent/PanelAgentChat.tsx'
  - '/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/write-tools.ts'
  - '/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/read-tools.ts'
  - '/Users/mikeyoung/CODING/MAIS/server/src/agent/executors/index.ts'
problem_type: ['ux-messaging', 'missing-tools']
date: '2025-12-28'
commit: '024d1a1'
---

## Problem Statement

The Growth Assistant had a critical UX issue compounded by missing agent capabilities:

### Issue 1: Misleading Health Check Messages (Catch-22 UX)

Users saw a generic message: **"Complete setup to unlock your AI assistant"**

But the actual blocker was **`ANTHROPIC_API_KEY` not being set server-side**—not a user-side configuration issue. This created a Catch-22:

1. User clicks "growth assistant" expecting to interact with AI
2. Sees "complete setup" message, assumes they need to configure something
3. Looks in settings/onboarding flow for "AI assistant setup" option
4. Finds nothing—because the real issue is server-side API key
5. User confusion and potential support tickets

The message incorrectly attributed responsibility to the user when it was actually an infrastructure problem.

### Issue 2: Missing Agent Tools

Two critical capabilities were missing:

1. **`initiate_stripe_onboarding`** – Users couldn't ask the agent to set up Stripe payments
2. **`get_booking_link`** – The agent couldn't retrieve customer-facing booking URLs

These meant the agent couldn't help with the two most common setup tasks.

## Solution Architecture

### Part 1: Backend Health Check with User-Friendly Messages

**File:** `server/src/routes/agent.routes.ts` (lines 60-119)

The health check endpoint now returns structured messages for each failure reason:

```typescript
// Health check determines 4 states:
// 1. API key configured? → checks process.env.ANTHROPIC_API_KEY
// 2. User authenticated? → checks req.tenantId
// 3. Tenant context available? → tries to build session context
// 4. Generates reason + message based on which check failed

const reasonsAndMessages = {
  missing_api_key: 'Our team is setting up your AI assistant. Check back shortly!',
  not_authenticated: 'Please sign in to access your assistant.',
  context_unavailable: 'Having trouble loading your data. Try again?',
};
```

**Response structure:**

```json
{
  "available": false,
  "reason": "missing_api_key",
  "message": "Our team is setting up your AI assistant. Check back shortly!",
  "onboardingState": "needs_stripe",
  "capabilities": ["chat", "create_packages", "manage_bookings", "stripe_onboarding"]
}
```

**Key insight:** The `message` field is generated server-side based on the actual failure reason, not hardcoded in the frontend. This prevents the frontend from having to understand all possible error states.

### Part 2: Frontend Displays Backend Message Directly

**File:** `apps/web/src/components/agent/PanelAgentChat.tsx` (lines 110-115, 289-291)

```typescript
// Get health status
const health = await healthResponse.json();

// If unavailable, show user-friendly message from backend
if (!health.available) {
  setHasHealthCheckFailed(true);
  setHealthCheckMessage(health.message || null); // Use backend message!
  return;
}

// ...later in render...
{hasHealthCheckFailed && (
  <div className="...">
    <p className="text-sm font-medium">Assistant Unavailable</p>
    <p className="text-xs text-text-muted">
      {healthCheckMessage || 'Unable to connect to your assistant.'}
    </p>
  </div>
)}
```

**Why this works:**

- No switch statement in frontend (fragile, requires sync with backend)
- Single source of truth: server determines reason and message
- Easy to update messages without frontend code changes
- Follows HANDLED voice principles (direct, honest, no hype)

### Part 3: Stripe Onboarding Tool

**Files:**

- Tool definition: `server/src/agent/tools/write-tools.ts` (lines 1381-1479)
- Executor: `server/src/agent/executors/index.ts` (lines 922-988)

The tool creates a proposal that:

1. Checks if Stripe is already connected (returns early if yes)
2. Resolves email/business name from context if not provided
3. Creates a new Stripe Connect account or resumes existing
4. Generates an onboarding link
5. Returns URL for user to complete setup

**Usage example:**

```
User: "I need to set up payments"
Agent: "I can help with that. Let me initiate your Stripe Connect setup."
[Creates T2 proposal]
User confirms → Executor runs →
{
  "action": "started_onboarding",
  "onboardingUrl": "https://connect.stripe.com/...",
  "accountId": "acct_...",
  "note": "Open this link to complete your Stripe payment setup."
}
```

**Trust tier:** T2 (soft confirm) – User will see the proposal before being redirected to Stripe

**Key implementation details:**

1. **Idempotent check:** Returns early if already connected

```typescript
if (tenant.stripeOnboarded) {
  return {
    success: true,
    data: {
      alreadyConnected: true,
      message: 'Stripe is already connected. You can accept payments.',
    },
  };
}
```

2. **Tenant resolution:** Defaults to tenant email/name if not provided

```typescript
const resolvedEmail = email || tenant.email;
const resolvedBusinessName = businessName || tenant.name;
```

3. **Service integration:** Uses `StripeConnectService` to create accounts and links

```typescript
const stripeConnectService = new StripeConnectService(prisma);
accountId = await stripeConnectService.createConnectedAccount(
  tenantId,
  email,
  businessName || 'My Business',
  'US'
);
```

4. **Proper redirects:** Includes return URLs for success/retry

```typescript
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const refreshUrl = `${baseUrl}/tenant/dashboard?stripe=retry`;
const returnUrl = `${baseUrl}/tenant/dashboard?stripe=complete`;
```

### Part 4: Booking Link Tool

**File:** `server/src/agent/tools/read-tools.ts` (lines 1005-1093)

The tool returns customer-facing booking URLs for one or all packages:

```typescript
export const getBookingLinkTool: AgentTool = {
  name: 'get_booking_link',
  description: 'Get storefront booking URLs for customers to book packages',
  inputSchema: {
    type: 'object',
    properties: {
      packageId: {
        type: 'string',
        description: 'Specific package ID (omit for all packages)',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const packageId = params.packageId as string | undefined;

    try {
      // Query tenant for slug
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true, isActive: true },
      });

      if (!tenant?.isActive) {
        return { success: false, error: 'Business is not active' };
      }

      // Get packages
      const packages = await prisma.package.findMany({
        where: {
          tenantId,
          ...(packageId ? { id: packageId } : {}),
          active: true,
        },
        select: { id: true, slug: true, name: true },
      });

      if (packages.length === 0) {
        return { success: false, error: 'No active packages found' };
      }

      // Build booking links
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const links = packages.map((pkg) => ({
        packageId: pkg.id,
        packageName: pkg.name,
        bookingUrl: `${baseUrl}/t/${tenant.slug}?package=${pkg.slug}`,
      }));

      return {
        success: true,
        data: {
          businessSlug: tenant.slug,
          packages: links,
          publicUrl: `${baseUrl}/t/${tenant.slug}`,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId }, 'Error in get_booking_link tool');
      return {
        success: false,
        error: `Failed to retrieve booking links: ${errorMessage}. Verify your business is active.`,
        code: 'GET_BOOKING_LINK_ERROR',
      };
    }
  },
};
```

**Usage example:**

```
User: "What's the booking link for customers?"
Agent: "Let me get your booking links for you."
Tool result:
{
  "businessSlug": "jane-photography",
  "packages": [
    {
      "packageId": "pkg_123",
      "packageName": "Wedding Photography",
      "bookingUrl": "http://localhost:3000/t/jane-photography?package=wedding-photography"
    }
  ],
  "publicUrl": "http://localhost:3000/t/jane-photography"
}
Agent: "Here are your booking links:
  - Wedding Photography: [URL]
  - Public storefront: [URL]"
```

**Design:**

- Read-only tool (no T1-T3 approval needed)
- Returns multiple formats (per-package URLs + public storefront)
- Always filters by `active: true` to avoid exposing archived packages
- Respects tenant state (checks `isActive`)

## Implementation Details

### Registering Executors

**File:** `server/src/agent/executors/index.ts`

The executors must be registered during server initialization:

```typescript
// Called once at startup
export function registerAllExecutors(prisma: PrismaClient): void {
  registerProposalExecutor('initiate_stripe_onboarding', async (tenantId, payload) => {
    // Implementation...
  });
  // ... register other executors ...
}
```

Each executor receives:

- `tenantId`: From JWT context (guaranteed tenant-scoped)
- `payload`: From the confirmed proposal

And returns:

- `success: true` + data on success
- `success: false` + error message on failure

### Multi-Tenant Data Isolation

All operations enforce `tenantId` scoping:

1. **Tools check ownership:**

```typescript
const pkg = await prisma.package.findFirst({
  where: { id: packageId, tenantId }, // Always include tenantId
});
```

2. **Executors verify before mutation:**

```typescript
const existingPackage = await prisma.package.findFirst({
  where: { id: packageId, tenantId }, // CRITICAL check
});
if (!existingPackage) {
  throw new Error('Package not found or permission denied');
}
```

3. **Read tools filter results:**

```typescript
const packages = await prisma.package.findMany({
  where: {
    tenantId, // Scope to tenant
    active: true,
  },
});
```

## Testing the Solution

### 1. Health Check Messaging

```bash
# With API key missing:
curl -X GET http://localhost:3001/v1/agent/health \
  -H "Cookie: auth=<valid-jwt>"

# Expected response:
{
  "available": false,
  "reason": "missing_api_key",
  "message": "Our team is setting up your AI assistant. Check back shortly!"
}

# With API key present but not authenticated:
curl -X GET http://localhost:3001/v1/agent/health

# Expected response:
{
  "available": false,
  "reason": "not_authenticated",
  "message": "Please sign in to access your assistant."
}
```

### 2. Stripe Onboarding Tool

```bash
# In growth assistant chat:
User: "Set up Stripe for me"
Agent: Creates initiate_stripe_onboarding tool call
User: Confirms proposal
Backend: Executes executor → returns onboardingUrl
User: Clicks link → Redirected to Stripe → Completes setup
```

### 3. Booking Link Tool

```bash
# In growth assistant chat:
User: "Give me the booking link"
Agent: Calls get_booking_link tool
Backend: Returns URLs
Agent: "Here's your public storefront: [URL]"
```

## Key Design Decisions

### 1. Backend-Driven Messages

**Why:** Prevents frontend from having to understand all possible failure states. Single source of truth.

**Alternative considered:** Frontend switch statement with hardcoded messages. Rejected because:

- Requires frontend + backend sync
- Harder to update user-facing copy
- Violates DRY principle

### 2. T2 Trust Tier for Stripe Onboarding

**Why:** Stripe onboarding requires explicit user confirmation (clicking the proposal), but doesn't require the highest trust level since Stripe handles sensitive operations server-side.

**Alternative considered:** T1 (auto-confirm). Rejected because:

- User should see what's happening before redirect
- Stripe is a critical service—mistakes are costly

### 3. Read-Only for Booking Links

**Why:** Retrieving URLs doesn't modify data, so no proposal needed.

**Alternative considered:** Making it a write tool with proposal. Rejected because:

- No side effects
- No reason to delay user from getting links
- Keeps tool complexity low

## Error Handling

All tools include graceful error messages following HANDLED voice:

- **Specific:** "Package 'pkg_123' not found or you do not have permission to modify it"
- **Actionable:** "Verify the package ID and try again"
- **No hype:** No "error occurred" or "something went wrong"

Example from `initiateStripeOnboardingTool`:

```typescript
if (!resolvedEmail) {
  return {
    success: false,
    error: 'Email is required. Please provide an email or add one to your tenant profile.',
  };
}
```

## Prevention Strategies

### Prevent Cross-Tenant Access

All executors verify ownership before mutation:

```typescript
// CRITICAL: Verify tenant ownership before update
const existingPackage = await prisma.package.findFirst({
  where: { id: packageId, tenantId }, // Always check tenantId
});

if (!existingPackage) {
  throw new Error('Package not found or you do not have permission...');
}
```

### Prevent Double-Booking

When creating/rescheduling bookings, use transaction + advisory lock:

```typescript
return await prisma.$transaction(async (tx) => {
  const lockId = hashTenantDate(tenantId, date);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  // Check availability AFTER lock
  const existing = await tx.booking.findFirst({
    where: { tenantId, date: bookingDate, status: { notIn: [...] } },
  });

  if (existing) throw new Error(`Date is already booked`);

  // Create within same transaction
  return await tx.booking.create({ data: {...} });
});
```

### Prevent Missing API Key Issues

The health check explicitly checks for `ANTHROPIC_API_KEY` and communicates clearly if missing:

```typescript
const apiKeyConfigured = !!process.env.ANTHROPIC_API_KEY;
if (!apiKeyConfigured) {
  message = 'Our team is setting up your AI assistant. Check back shortly!';
}
```

## Changes Made

| File                                                | Change                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `/server/src/routes/agent.routes.ts`                | Added `message` field to health check response based on `reason` |
| `/apps/web/src/components/agent/PanelAgentChat.tsx` | Updated to display backend `message` instead of hardcoded text   |
| `/server/src/agent/tools/write-tools.ts`            | Added `initiateStripeOnboardingTool` (lines 1381-1479)           |
| `/server/src/agent/tools/write-tools.ts`            | Added to `writeTools` export array                               |
| `/server/src/agent/tools/read-tools.ts`             | Added `getBookingLinkTool` (lines 1005-1093)                     |
| `/server/src/agent/tools/read-tools.ts`             | Added to `readTools` export array                                |
| `/server/src/agent/executors/index.ts`              | Registered `initiate_stripe_onboarding` executor (lines 922-988) |

## Verification Checklist

- [x] Health check returns user-friendly message based on reason
- [x] Frontend displays backend message (no hardcoded text)
- [x] Stripe onboarding tool creates proposals correctly
- [x] Booking link tool returns proper URLs with tenant slug
- [x] All operations enforce `tenantId` scoping (multi-tenant isolation)
- [x] Error messages follow HANDLED voice
- [x] Executors verify ownership before mutations
- [x] Booking creation uses advisory lock to prevent double-booking
- [x] Tests pass (771 server tests)

## References

- ADR-013: Double-Booking Prevention with Advisory Locks
- Prevention strategy: Multi-tenant isolation patterns
- HANDLED Brand Voice Guide: Direct, honest, specific language
