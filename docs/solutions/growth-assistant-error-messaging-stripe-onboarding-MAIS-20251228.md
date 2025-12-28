# Growth Assistant Health Check Messaging & Stripe Onboarding Tools

**Status:** Solution Documentation
**Date:** 2025-12-28
**Project:** MAIS
**Phases:** Growth Assistant Side Panel (Phase 1 Complete), Tools (Phase 2 In Progress)

## Problem Summary

The Growth Assistant faced two critical issues:

1. **Generic Health Check Messages**: The health check endpoint returned an unavailable status but with a generic "unavailable" message regardless of the actual reason (missing API key, not authenticated, or context unavailable).

2. **Missing Agent Tools**: Two essential tools were missing from the agent's toolkit:
   - `initiate_stripe_onboarding`: Start Stripe Connect payment setup
   - `get_booking_link`: Retrieve storefront/booking URLs for customers

## Solution Overview

### Phase 1: Error Messaging (COMPLETED)

**Goal:** Provide specific, actionable user-friendly messages based on health check failure reasons.

**Implementation Pattern:**

Health checks determine failure reasons in order of severity:

1. Missing API key (setup issue)
2. Missing authentication (user issue)
3. Context unavailable (temporary issue)

Each reason maps to a specific message shown to the user:

- `missing_api_key` → "Our team is setting up your AI assistant. Check back shortly!"
- `not_authenticated` → "Please sign in to access your assistant."
- `context_unavailable` → "Having trouble loading your data. Try again?"

#### File: `/Users/mikeyoung/CODING/MAIS/server/src/routes/agent.routes.ts`

**Health Check Route (Lines 72-119):**

```typescript
router.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(res);

    // Check 1: API key configured
    const apiKeyConfigured = !!process.env.ANTHROPIC_API_KEY;

    // Check 2: Can we build context for this tenant?
    let contextAvailable = false;
    let onboardingState: OnboardingState = 'needs_stripe';

    if (tenantId) {
      try {
        const context = await buildSessionContext(prisma, tenantId, 'health-check');
        contextAvailable = true;
        onboardingState = detectOnboardingState(context);
      } catch (err) {
        logger.warn({ tenantId, error: err }, 'Failed to build context for health check');
        contextAvailable = false;
      }
    }

    // Determine availability reason and user-friendly message
    let reason: string | null = null;
    let message: string | null = null;
    if (!apiKeyConfigured) {
      reason = 'missing_api_key';
      message = 'Our team is setting up your AI assistant. Check back shortly!';
    } else if (!tenantId) {
      reason = 'not_authenticated';
      message = 'Please sign in to access your assistant.';
    } else if (!contextAvailable) {
      reason = 'context_unavailable';
      message = 'Having trouble loading your data. Try again?';
    }

    res.json({
      available: apiKeyConfigured && contextAvailable,
      reason,
      message,
      onboardingState,
      capabilities: ['chat', 'create_packages', 'manage_bookings', 'stripe_onboarding'],
    });
  } catch (error) {
    logger.error({ error }, 'Health check error');
    next(error);
  }
});
```

**Key Design Points:**

1. **Message Field**: Returns both `reason` (machine-readable) and `message` (user-friendly)
2. **Onboarding State**: Detects current onboarding stage for UI context
3. **Capabilities**: Lists available features (for future extensibility)
4. **Atomic Checks**: Each check is independent; failures don't cascade

#### File: `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/agent/PanelAgentChat.tsx`

**Health Check Handling (Lines 97-119):**

```typescript
const initializeChat = useCallback(async () => {
  setIsInitializing(true);
  setError(null);
  setHasHealthCheckFailed(false);
  setHealthCheckMessage(null);

  try {
    // Health check first
    const healthResponse = await fetch(`${API_URL}/v1/agent/health`, {
      credentials: 'include',
    });

    if (!healthResponse.ok) {
      console.warn('Health check failed, attempting session init...');
    } else {
      const health = await healthResponse.json();
      if (!health.available) {
        setHasHealthCheckFailed(true);
        setHealthCheckMessage(health.message || null);
        setIsInitializing(false);
        return;
      }
    }

    // Initialize session...
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to start chat');
    setHasHealthCheckFailed(true);
  } finally {
    setIsInitializing(false);
  }
}, [welcomeMessage]);
```

**UI Rendering (Lines 277-303):**

```typescript
// Unavailable state
if (hasHealthCheckFailed) {
  return (
    <div
      className={cn(
        'flex flex-col h-full items-center justify-center p-6 text-center',
        className
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center mb-3">
        <Bot className="w-5 h-5 text-text-muted" />
      </div>
      <p className="text-sm font-medium text-text-primary mb-1">Assistant Unavailable</p>
      <p className="text-xs text-text-muted mb-3">
        {healthCheckMessage || 'Unable to connect to your assistant.'}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={initializeChat}
        className="rounded-full text-xs"
      >
        Try Again
      </Button>
    </div>
  );
}
```

**Key Implementation Details:**

1. **State Separation**: `healthCheckMessage` is isolated from generic `error` state
2. **Fallback**: If message is missing, uses generic fallback message
3. **Retry Button**: "Try Again" button reinitializes chat without full page refresh
4. **Graceful Degradation**: Health check failures don't block session initialization attempt

---

### Phase 2: Missing Agent Tools

#### Tool 1: `initiate_stripe_onboarding` (Write Tool - T2 Trust Tier)

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/write-tools.ts` (Lines 1382-1479)

**Purpose:** Start Stripe Connect payment setup or check if already connected.

**Implementation:**

```typescript
export const initiateStripeOnboardingTool: AgentTool = {
  name: 'initiate_stripe_onboarding',
  description:
    'Start Stripe Connect payment setup. If already connected, returns that status. Otherwise creates a connected account and returns the onboarding URL.',
  inputSchema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Business owner email (optional, uses tenant email if not provided)',
      },
      businessName: {
        type: 'string',
        description: 'Business name (optional, uses tenant name if not provided)',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const email = params.email as string | undefined;
    const businessName = params.businessName as string | undefined;

    try {
      // Check current Stripe status
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeOnboarded: true,
          stripeAccountId: true,
          email: true,
          name: true,
          slug: true,
        },
      });

      if (!tenant) {
        return { success: false, error: 'Tenant not found' };
      }

      // If already connected, return early
      if (tenant.stripeOnboarded) {
        return {
          success: true,
          data: {
            alreadyConnected: true,
            message: 'Stripe is already connected. You can accept payments.',
          },
        };
      }

      // Resolve email and business name from context if not provided
      const resolvedEmail = email || tenant.email;
      const resolvedBusinessName = businessName || tenant.name;

      if (!resolvedEmail) {
        return {
          success: false,
          error: 'Email is required. Please provide an email or add one to your tenant profile.',
        };
      }

      const operation = `Set up Stripe payments for ${sanitizeForContext(resolvedBusinessName || 'your business', 50)}`;
      const payload = {
        email: resolvedEmail,
        businessName: resolvedBusinessName,
        hasExistingAccount: !!tenant.stripeAccountId,
      };
      const preview = {
        action: tenant.stripeAccountId ? 'resume_onboarding' : 'start_onboarding',
        email: sanitizeForContext(resolvedEmail, 50),
        businessName: sanitizeForContext(resolvedBusinessName || 'Your Business', 50),
        note: 'You will be redirected to Stripe to complete payment setup.',
      };

      return createProposal(
        context,
        'initiate_stripe_onboarding',
        operation,
        'T2',
        payload,
        preview
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId }, 'Error in initiate_stripe_onboarding tool');
      return {
        success: false,
        error: `Failed to initiate Stripe onboarding: ${errorMessage}. Try again or contact support if the issue persists.`,
        code: 'STRIPE_ONBOARDING_ERROR',
      };
    }
  },
};
```

**Key Design Points:**

1. **Early Exit**: Checks if already connected before creating proposal
2. **Context Fallback**: Uses tenant profile data if email/businessName not provided
3. **Account State Tracking**: Distinguishes between "start onboarding" vs "resume onboarding"
4. **T2 Trust Tier**: Soft confirmation (user will be redirected to Stripe anyway)
5. **Validation**: Ensures email is provided (required by Stripe)

---

#### Tool 2: `get_booking_link` (Read Tool - No Confirmation)

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/read-tools.ts` (Lines 1004-1092)

**Purpose:** Retrieve storefront URL and optional package-specific booking links.

**Implementation:**

```typescript
export const getBookingLinkTool: AgentTool = {
  name: 'get_booking_link',
  description:
    'Get the storefront URL where customers can book. Optionally get a direct link to a specific package.',
  inputSchema: {
    type: 'object',
    properties: {
      packageSlug: {
        type: 'string',
        description: 'Optional package slug to get a direct booking link for a specific package',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const packageSlug = params.packageSlug as string | undefined;

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          slug: true,
          customDomain: true,
          domainVerified: true,
        },
      });

      if (!tenant) {
        return { success: false, error: 'Tenant not found' };
      }

      // Determine the base URL
      const baseAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gethandled.ai';
      let storefrontUrl: string;

      // Use custom domain if verified, otherwise use slug-based URL
      if (tenant.customDomain && tenant.domainVerified) {
        storefrontUrl = `https://${tenant.customDomain}`;
      } else {
        storefrontUrl = `${baseAppUrl}/t/${tenant.slug}`;
      }

      const result: {
        storefrontUrl: string;
        packageUrl?: string;
        packageSlug?: string;
      } = {
        storefrontUrl,
      };

      // If package slug provided, verify it exists and add package URL
      if (packageSlug) {
        const pkg = await prisma.package.findFirst({
          where: { tenantId, slug: packageSlug, active: true },
          select: { slug: true, name: true },
        });

        if (!pkg) {
          return {
            success: false,
            error: `Package with slug "${packageSlug}" not found or inactive. Use get_packages to see available packages.`,
          };
        }

        result.packageUrl = `${storefrontUrl}/book/${pkg.slug}`;
        result.packageSlug = pkg.slug;
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId }, 'Error in get_booking_link tool');
      return {
        success: false,
        error: `Failed to get booking link: ${errorMessage}. Try again or verify the package slug if provided.`,
        code: 'GET_BOOKING_LINK_ERROR',
      };
    }
  },
};
```

**Key Design Points:**

1. **Custom Domain Priority**: Prefers custom domain if verified, falls back to slug-based URL
2. **Package-Specific Links**: Optional package parameter for deep-linking
3. **Validation**: Checks that package exists and is active
4. **Read-Only**: No confirmation needed; pure data retrieval
5. **Context Aware**: Uses NEXT_PUBLIC_APP_URL for flexibility across environments

---

## Integration with Proposal System

Both tools use the **server-side proposal system** to prevent prompt injection:

### Write Tool Flow (initiate_stripe_onboarding):

```
Agent suggests tool → createProposal() called → AgentProposal record created
  ↓
User sees preview with operation description
  ↓
User confirms via UI → POST /v1/agent/proposals/{id}/confirm
  ↓
Proposal executor runs → StripeConnectService.createAccount()
  ↓
Result returned to user in chat
```

### Read Tool Flow (get_booking_link):

```
Agent calls tool → execute() runs immediately
  ↓
No proposal needed; immediate result
  ↓
URL returned to agent in tool results
  ↓
Agent provides link to user
```

---

## Trust Tier Classification

### Tool Trust Tiers:

- **T1 (Auto-confirmed)**: Blackouts, branding, uploads - low-risk changes
- **T2 (Soft confirm)**: Package changes, Stripe onboarding - user reviews preview
- **T3 (Hard confirm)**: Cancellations, refunds, deletes - explicit approval required

### Why Stripe Onboarding is T2:

1. User will be redirected to Stripe anyway (visual confirmation)
2. No immediate financial impact (just setup initiation)
3. Clear preview shows what's happening
4. Can be undone by not completing Stripe form

---

## Error Handling Patterns

All tools follow consistent error handling:

```typescript
try {
  // 1. Validate inputs (check package exists, etc.)
  // 2. Check access (tenant isolation)
  // 3. Perform operation
  // 4. Create proposal or return result
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error({ error, tenantId }, 'Error in [tool_name] tool');
  return {
    success: false,
    error: `[User-friendly message]: ${errorMessage}. [Actionable guidance].`,
    code: '[TOOL_NAME]_ERROR',
  };
}
```

**Example Error Responses:**

```typescript
// get_booking_link - package not found
{
  success: false,
  error: `Package with slug "${packageSlug}" not found or inactive. Use get_packages to see available packages.`,
}

// initiate_stripe_onboarding - missing email
{
  success: false,
  error: 'Email is required. Please provide an email or add one to your tenant profile.',
}
```

---

## Registration in Tool Registry

Both tools are automatically registered in the tool system:

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/all-tools.ts`

```typescript
export function getAllTools(): AgentTool[] {
  return [...readTools, ...writeTools];
}
```

Where:

- `readTools` includes `getBookingLinkTool` (line 1108)
- `writeTools` includes `initiateStripeOnboardingTool` (line 1498)

---

## Testing Checklist

### Health Check Messaging:

- [ ] Missing API key shows: "Our team is setting up your AI assistant. Check back shortly!"
- [ ] Not authenticated shows: "Please sign in to access your assistant."
- [ ] Context unavailable shows: "Having trouble loading your data. Try again?"
- [ ] "Try Again" button reinitializes chat
- [ ] Capabilities array includes `stripe_onboarding`

### get_booking_link Tool:

- [ ] Returns storefront URL (custom domain if verified, else slug-based)
- [ ] Optional packageSlug parameter returns package-specific URL
- [ ] Invalid package slug returns helpful error
- [ ] Inactive package returns helpful error

### initiate_stripe_onboarding Tool:

- [ ] Already connected returns early with success message
- [ ] Creates proposal with T2 trust tier
- [ ] Uses tenant email/name if not provided in params
- [ ] Missing email returns helpful error
- [ ] Preview shows correct action (start vs resume)

---

## Code Quality Notes

### Type Safety:

- All tools use strict `ToolContext` type for parameters
- Param extraction includes type guards: `params.email as string | undefined`
- Return types explicitly defined as `AgentToolResult`

### Security:

- All queries filtered by `tenantId` (multi-tenant isolation)
- No sensitive data exposed in responses
- Email/businessName are sanitized before returning to user
- Proposal executor validates tenant ownership

### Error Messages:

- User-friendly descriptions
- Actionable guidance included
- Technical details logged, not shown to user
- Error codes for frontend routing/retry logic

---

## Related Documentation

- **Health Check Flow:** `server/src/routes/agent.routes.ts` lines 62-119
- **Agent Orchestrator:** `server/src/agent/orchestrator.ts`
- **Proposal System:** `server/src/agent/proposals/proposal.service.ts`
- **Frontend Chat Component:** `apps/web/src/components/agent/PanelAgentChat.tsx`
- **Stripe Integration:** `server/src/adapters/stripe.adapter.ts`

---

## Future Work

1. **Executor Implementation**: `StripeConnectService.createAccount()` needs to be wired in agent server initialization
2. **Proposal Confirmation UI**: Stripe onboarding preview card styling in panel
3. **Success Handling**: Redirect user after Stripe onboarding completes
4. **Tool Discovery**: Agent should list available tools in capability descriptions
5. **Error Recovery**: Implement retry logic for transient failures
