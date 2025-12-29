# Growth Assistant Agent Improvements

> **Phase**: Implementation Plan
> **Created**: 2025-12-27
> **Status**: Ready for Review

## Overview

This plan addresses the comprehensive audit of the MAIS Growth Assistant, a tenant-facing AI chatbot for HANDLED (gethandled.ai). The agent helps service professionals with onboarding, package setup, pricing strategy, business coaching, and storefront configuration.

**Current State:**

- 79% Action Parity (19/24 UI actions covered)
- 87.5% CRUD Completeness
- 75% Context Injection quality
- **Critical blocker**: Misleading error messaging when API key missing

## Problem Statement

### The Catch-22 Problem

Users see "Complete setup to unlock your AI assistant" when the actual blocker is `ANTHROPIC_API_KEY` not being set in the server environment. This creates confusion:

1. User thinks they need to complete onboarding steps
2. They try to complete steps, but the agent is unavailable
3. They can't get help completing the steps
4. Infinite loop of frustration

**Root Cause:** `apps/web/src/components/agent/PanelAgentChat.tsx:286-287` shows a generic "Complete setup" message regardless of the actual reason (missing API key vs user setup).

### Missing Action Parity

Three key UI actions lack corresponding agent tools:

1. **Connect Stripe** - Users can connect via UI but agent can't help
2. **Get booking link** - Users can view storefront but agent can't share the link
3. **Configure custom domain** - Not covered (lower priority)

### Context & Coaching Gaps

The system prompt has strong HANDLED brand voice but lacks:

- Pricing psychology guidance (good/better/best framework)
- Marketing quick wins for onboarding users
- Available packages by name in context

---

## Proposed Solution

### Phase 1: Fix the Catch-22 (Critical)

Update error messaging to accurately reflect the blocking reason.

### Phase 2: Add Missing Tools (High Priority)

1. `initiate_stripe_onboarding` - Returns Stripe Connect onboarding URL
2. `get_booking_link` - Returns shareable booking URL with copyable text

### Phase 3: Enhance System Prompt (High Priority)

Add business coaching capabilities:

- Pricing framework section
- Marketing quick wins for new users
- Coaching conversation patterns

### Phase 4: Improve Context Injection (Medium Priority)

- Add available packages by name
- Add recent 5 bookings
- Add capability hints based on onboarding state

---

## Technical Approach

### Architecture Decisions

1. **Server-side tool execution** - Maintain existing pattern where tools create proposals
2. **Trust tiers preserved** - Stripe onboarding is T2 (soft-confirm), booking link is read-only
3. **No new database models** - Leverage existing `AgentProposal` and `AgentAuditLog`

---

## Implementation Phases

### Phase 1: Fix Error Messaging

**Goal:** Users understand why assistant is unavailable

#### Files to Modify

| File                                               | Change                                              |
| -------------------------------------------------- | --------------------------------------------------- |
| `apps/web/src/components/agent/PanelAgentChat.tsx` | Update error messaging based on health check reason |

#### Implementation Details

**PanelAgentChat.tsx (lines 274-298)**

Current:

```tsx
<p className="text-sm font-medium text-text-primary mb-1">Assistant Unavailable</p>
<p className="text-xs text-text-muted mb-3">Complete setup to unlock your AI assistant.</p>
```

Updated:

```tsx
// Add state to track the unavailability reason
const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

// In initializeChat, capture the reason:
const healthData = await healthResponse.json();
if (!healthData.available) {
  setUnavailableReason(healthData.reason);
  setHasHealthCheckFailed(true);
  return;
}

// Error message mapping
const getErrorMessage = (reason: string | null) => {
  switch (reason) {
    case 'missing_api_key':
      return {
        title: 'AI Assistant Coming Soon',
        description: 'Our team is setting up your AI assistant. Check back shortly!'
      };
    case 'not_authenticated':
      return {
        title: 'Sign In Required',
        description: 'Please sign in to access your AI assistant.'
      };
    case 'context_unavailable':
      return {
        title: 'Assistant Unavailable',
        description: 'We\'re having trouble loading your business data. Please try again.'
      };
    default:
      return {
        title: 'Assistant Unavailable',
        description: 'Something went wrong. Please try again.'
      };
  }
};

// In render:
const errorMessage = getErrorMessage(unavailableReason);
<p className="text-sm font-medium text-text-primary mb-1">{errorMessage.title}</p>
<p className="text-xs text-text-muted mb-3">{errorMessage.description}</p>
```

#### Acceptance Criteria

- [ ] Health check returns `reason` field to frontend
- [ ] Frontend displays appropriate message based on reason
- [ ] `missing_api_key` shows "Coming Soon" message (not user's fault)
- [ ] `context_unavailable` shows retry option
- [ ] Messages match HANDLED brand voice (direct, no hype)

---

### Phase 2: Add Missing Tools

**Goal:** Agent can help with Stripe onboarding and share booking links

#### Phase 2.1: Stripe Onboarding Tool

**Files to Modify**

| File                                    | Change                                |
| --------------------------------------- | ------------------------------------- |
| `server/src/agent/tools/write-tools.ts` | Add `initiate_stripe_onboarding` tool |
| `server/src/agent/tools/all-tools.ts`   | Register new tool                     |
| `server/src/agent/executors/index.ts`   | Add executor for the tool             |

**Tool Implementation (write-tools.ts)**

```typescript
/**
 * initiate_stripe_onboarding
 *
 * Creates a Stripe Connect account and returns the onboarding URL.
 * Trust Tier: T2 (soft-confirm - requires next message to proceed)
 */
export const initiateStripeOnboarding: AgentTool = {
  name: 'initiate_stripe_onboarding',
  description: `Start Stripe Connect onboarding for the tenant. Returns an onboarding URL that the user can click to connect their Stripe account. This is a T2 operation - the user's next message will confirm proceeding.`,
  inputSchema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Email address for the Stripe account (usually the tenant admin email)',
      },
      businessName: {
        type: 'string',
        description: 'Business name for the Stripe account',
      },
    },
    required: ['email', 'businessName'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { email, businessName } = params as { email: string; businessName: string };

    // Validate inputs
    if (!email || !businessName) {
      return {
        success: false,
        error: 'Email and business name are required for Stripe setup',
        code: 'MISSING_PARAMS',
      };
    }

    // Check if already connected
    const tenant = await context.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { stripeOnboarded: true, stripeAccountId: true },
    });

    if (tenant?.stripeOnboarded) {
      return {
        success: false,
        error: 'Stripe is already connected! You can manage it from the dashboard.',
        code: 'ALREADY_CONNECTED',
      };
    }

    // Create proposal for T2 soft-confirm
    return createProposal(
      context,
      'initiate_stripe_onboarding',
      `Connect Stripe account for ${businessName}`,
      'T2', // Soft-confirm
      {
        email,
        businessName,
        country: 'US',
        existingAccountId: tenant?.stripeAccountId || null,
      },
      {
        action: 'Connect Stripe',
        email,
        businessName,
        note: "Takes about 3 minutes. You'll be redirected to Stripe to complete setup.",
      }
    );
  },
};
```

**Executor Implementation (executors/index.ts)**

```typescript
import { StripeConnectService } from '../../services/stripe-connect.service';

// In executor registry:
initiate_stripe_onboarding: async (tenantId: string, payload: Record<string, unknown>, prisma: PrismaClient) => {
  const stripeConnectService = new StripeConnectService(prisma);
  const { email, businessName, country, existingAccountId } = payload as {
    email: string;
    businessName: string;
    country: string;
    existingAccountId: string | null;
  };

  // Create account if doesn't exist
  if (!existingAccountId) {
    await stripeConnectService.createConnectedAccount(tenantId, email, businessName, country);
  }

  // Generate onboarding link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.gethandled.ai';
  const { url } = await stripeConnectService.createOnboardingLink(
    tenantId,
    `${baseUrl}/tenant/dashboard`,
    `${baseUrl}/tenant/dashboard?stripe_onboarding=complete`
  );

  return {
    success: true,
    onboardingUrl: url,
    message: 'Click the link to complete your Stripe setup. Takes about 3 minutes.',
  };
},
```

#### Phase 2.2: Booking Link Tool

**Files to Modify**

| File                                   | Change                      |
| -------------------------------------- | --------------------------- |
| `server/src/agent/tools/read-tools.ts` | Add `get_booking_link` tool |
| `server/src/agent/tools/all-tools.ts`  | Register new tool           |

**Tool Implementation (read-tools.ts)**

```typescript
/**
 * get_booking_link
 *
 * Returns the tenant's shareable booking link with optional package-specific URL.
 * Read-only tool - no confirmation needed.
 */
export const getBookingLink: AgentTool = {
  name: 'get_booking_link',
  description: `Get the tenant's public booking link. Optionally include a specific package slug for a direct booking URL. Returns the URL and shareable text for social media or email.`,
  inputSchema: {
    type: 'object',
    properties: {
      packageSlug: {
        type: 'string',
        description:
          'Optional: Package slug for a direct booking link (e.g., "wedding-photography")',
      },
      includeShareText: {
        type: 'boolean',
        description: 'Include suggested shareable text for social/email. Defaults to true.',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { packageSlug, includeShareText = true } = params as {
      packageSlug?: string;
      includeShareText?: boolean;
    };

    try {
      // Get tenant details
      const tenant = await context.prisma.tenant.findUnique({
        where: { id: context.tenantId },
        select: {
          slug: true,
          name: true,
          customDomain: true,
          customDomainVerified: true,
        },
      });

      if (!tenant) {
        return {
          success: false,
          error: 'Could not find your business information',
          code: 'TENANT_NOT_FOUND',
        };
      }

      // Build base URL (prefer custom domain if verified)
      const baseUrl =
        tenant.customDomainVerified && tenant.customDomain
          ? `https://${tenant.customDomain}`
          : `https://gethandled.ai/t/${tenant.slug}`;

      // Build booking URL
      let bookingUrl = baseUrl;
      let packageTitle: string | null = null;

      if (packageSlug) {
        // Validate package exists and is active
        const pkg = await context.prisma.package.findFirst({
          where: {
            tenantId: context.tenantId,
            slug: packageSlug,
            active: true,
          },
          select: { title: true },
        });

        if (pkg) {
          bookingUrl = `${baseUrl}/book/${packageSlug}`;
          packageTitle = pkg.title;
        } else {
          return {
            success: false,
            error: `Package "${packageSlug}" not found or not active`,
            code: 'PACKAGE_NOT_FOUND',
          };
        }
      }

      // Build response
      const result: Record<string, unknown> = {
        storefrontUrl: baseUrl,
        bookingUrl,
        tenantSlug: tenant.slug,
        customDomain: tenant.customDomain,
        hasVerifiedDomain: tenant.customDomainVerified,
      };

      if (packageTitle) {
        result.packageTitle = packageTitle;
        result.packageSlug = packageSlug;
      }

      // Add shareable text
      if (includeShareText) {
        if (packageTitle) {
          result.shareText = {
            instagram: `Book ${packageTitle} with me → ${bookingUrl}`,
            email: `Ready to book? Here's the link: ${bookingUrl}`,
            twitter: `Book ${packageTitle} 👉 ${bookingUrl}`,
          };
        } else {
          result.shareText = {
            instagram: `Book a session with me → ${bookingUrl}`,
            email: `Ready to book? Here's the link: ${bookingUrl}`,
            twitter: `Book with me 👉 ${bookingUrl}`,
          };
        }
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error({ error, tenantId: context.tenantId }, 'Error getting booking link');
      return {
        success: false,
        error: 'Failed to generate booking link',
        code: 'INTERNAL_ERROR',
      };
    }
  },
};
```

#### Tool Registration (all-tools.ts)

```typescript
import { initiateStripeOnboarding } from './write-tools';
import { getBookingLink } from './read-tools';

export function getAllTools(): AgentTool[] {
  return [...readTools, getBookingLink, ...writeTools, initiateStripeOnboarding];
}
```

#### Acceptance Criteria

- [ ] `initiate_stripe_onboarding` tool creates Stripe account and returns onboarding URL
- [ ] Tool is T2 (soft-confirm) - proceeds on next message unless user says "wait"
- [ ] `get_booking_link` tool returns storefront and booking URLs
- [ ] Booking link tool includes shareable text for social/email
- [ ] Both tools handle edge cases (already connected, package not found)
- [ ] Tools are audited like all other operations

---

### Phase 3: Enhance System Prompt

**Goal:** Agent can provide business coaching for pricing and marketing

#### Files to Modify

| File                                            | Change                                 |
| ----------------------------------------------- | -------------------------------------- |
| `server/src/agent/orchestrator/orchestrator.ts` | Add coaching sections to system prompt |

#### Implementation Details

**Add after line 73 (after "Active business:"):**

```typescript
## Business Coaching

When helping with pricing or packages:

### Three-Tier Framework (Good/Better/Best)
Help them build a package lineup that makes sense:
- **Starter/Good:** Entry point, minimal commitment, lets clients test the waters
- **Core/Better:** Your bread and butter - where most clients should land
- **Premium/Best:** High-touch, high-value - for clients who want the works

Example for a photographer:
- Mini Session: $350 (20 min, 5 edited photos)
- Standard Session: $650 (60 min, 15 edited photos, wardrobe help)
- Full Experience: $1,200 (2 hours, 30 photos, styling consult, rush delivery)

### Pricing Psychology
- Don't compete on price - compete on value
- Round numbers feel deliberate ($500 not $497)
- If you're always booked, raise prices
- Deposits protect both sides (suggest 25-50% deposit)

### Marketing Quick Wins (for new users)
When they ask "how do I get clients?":
1. **Instagram bio link** - "Your booking link goes in your bio. One click, they're in."
2. **Email signature** - "Every email you send should have it."
3. **Reply templates** - "When someone DMs asking 'how much?', send them the link."
4. **Referral nudge** - "After a great session, ask: 'Know anyone else who'd want this?'"

Don't overwhelm - suggest ONE thing at a time based on where they are.
```

**Add after "For current details, use your read tools." in context prompt:**

```typescript
## Your Capabilities

I can help you with:
- **Packages:** Create, edit pricing, archive old ones
- **Bookings:** Check calendar, reschedule, handle cancellations
- **Setup:** Connect Stripe, configure your storefront
- **Marketing:** Get your booking link, suggest what to post
- **Strategy:** Pricing advice, package structure, client messaging

Just tell me what you need.
```

#### Acceptance Criteria

- [ ] System prompt includes three-tier pricing framework
- [ ] System prompt includes marketing quick wins for onboarding users
- [ ] Prompt maintains HANDLED voice (anti-hype, specific, actionable)
- [ ] Agent can answer "help me with pricing" with structured guidance
- [ ] Agent can answer "how do I get clients" with practical suggestions

---

### Phase 4: Improve Context Injection

**Goal:** Agent has richer context without tool calls

#### Files to Modify

| File                                          | Change                                            |
| --------------------------------------------- | ------------------------------------------------- |
| `server/src/agent/context/context-builder.ts` | Enhance context with packages and recent bookings |

#### Implementation Details

**Update `buildSessionContext` to include:**

```typescript
// Add to Promise.all (after line 87):
prisma.package.findMany({
  where: { tenantId, active: true },
  select: { title: true, slug: true, basePrice: true },
  take: 10,
  orderBy: { createdAt: 'desc' },
}),
prisma.booking.findMany({
  where: { tenantId },
  select: {
    date: true,
    status: true,
    customerName: true,
    package: { select: { title: true } },
  },
  take: 5,
  orderBy: { createdAt: 'desc' },
}),
```

**Update `buildContextPrompt` to include:**

```typescript
// After Quick Stats section:
${packages.length > 0 ? `
**Your Packages:**
${packages.map(p => `- ${sanitizeForContext(p.title, 50)}: $${(p.basePrice / 100).toFixed(0)}`).join('\n')}
` : ''}

${recentBookings.length > 0 ? `
**Recent Activity:**
${recentBookings.slice(0, 3).map(b => {
  const status = b.status === 'CONFIRMED' ? '✓' : b.status === 'CANCELED' ? '✗' : '○';
  return `${status} ${sanitizeForContext(b.customerName || 'Client', 20)} - ${sanitizeForContext(b.package?.title || 'Session', 30)}`;
}).join('\n')}
` : ''}
```

#### Acceptance Criteria

- [ ] Context includes list of active packages by name
- [ ] Context includes 3-5 recent bookings with status
- [ ] Agent can reference packages by name without calling `get_packages`
- [ ] Context size stays reasonable (< 1000 tokens)
- [ ] Sensitive customer data is sanitized

---

## Test Plan

### Unit Tests

| Test                                          | File                                                    | Scope            |
| --------------------------------------------- | ------------------------------------------------------- | ---------------- |
| `initiate_stripe_onboarding` creates proposal | `server/test/agent/tools/write-tools.test.ts`           | Tool execution   |
| `get_booking_link` returns correct URLs       | `server/test/agent/tools/read-tools.test.ts`            | Tool execution   |
| Context includes packages                     | `server/test/agent/context-builder.test.ts`             | Context building |
| Error messages are correct                    | `apps/web/src/components/agent/PanelAgentChat.test.tsx` | UI state         |

### Integration Tests

| Scenario                                | Expected                                                    |
| --------------------------------------- | ----------------------------------------------------------- |
| Agent health check with missing API key | Returns `reason: 'missing_api_key'`, UI shows "Coming Soon" |
| User says "help me set up Stripe"       | Agent creates T2 proposal with onboarding URL               |
| User says "what's my booking link"      | Agent returns URL with shareable text                       |
| User says "help me with pricing"        | Agent provides three-tier framework guidance                |

### E2E Tests

```typescript
// e2e/tests/agent-new-tools.spec.ts
test('agent provides booking link', async ({ page }) => {
  await page.goto('/tenant/dashboard');
  await page.click('[data-testid="assistant-panel-toggle"]');
  await page.fill('[data-testid="agent-input"]', "What's my booking link?");
  await page.click('[data-testid="agent-send"]');

  // Should see URL in response
  await expect(page.locator('.agent-message')).toContainText('gethandled.ai/t/');
});
```

---

## Success Metrics

| Metric            | Current | Target | Measurement                             |
| ----------------- | ------- | ------ | --------------------------------------- |
| Action Parity     | 79%     | 87%    | (21/24 UI actions covered)              |
| CRUD Completeness | 87.5%   | 87.5%  | No change (customers still read-only)   |
| Context Injection | 75%     | 85%    | Includes packages + recent bookings     |
| Error Clarity     | 0%      | 100%   | Specific error messages for each reason |

---

## Dependencies & Risks

### Dependencies

1. **ANTHROPIC_API_KEY** must be set in production environment
2. **Stripe Connect** service must be available
3. **Next.js build** must complete without type errors

### Risks

| Risk                   | Mitigation                           |
| ---------------------- | ------------------------------------ |
| Stripe API rate limits | Use existing Stripe adapter patterns |
| Large context size     | Limit packages to 10, bookings to 5  |
| System prompt too long | Keep coaching sections concise       |

---

## File Manifest

| File                                               | Lines Changed | Purpose                    |
| -------------------------------------------------- | ------------- | -------------------------- |
| `apps/web/src/components/agent/PanelAgentChat.tsx` | ~30           | Fix error messaging        |
| `server/src/agent/tools/write-tools.ts`            | ~80           | Add Stripe onboarding tool |
| `server/src/agent/tools/read-tools.ts`             | ~100          | Add booking link tool      |
| `server/src/agent/tools/all-tools.ts`              | ~5            | Register new tools         |
| `server/src/agent/executors/index.ts`              | ~30           | Add Stripe executor        |
| `server/src/agent/orchestrator/orchestrator.ts`    | ~50           | Enhance system prompt      |
| `server/src/agent/context/context-builder.ts`      | ~40           | Improve context injection  |

---

## References

### Internal

- Agent routes: `server/src/routes/agent.routes.ts:72-114`
- Stripe Connect service: `server/src/services/stripe-connect.service.ts`
- Tenant public routes: `server/src/routes/public-tenant.routes.ts`
- Current tools: `server/src/agent/tools/`

### External

- [Anthropic Tool Use](https://docs.anthropic.com/en/docs/tool-use)
- [Stripe Connect Express](https://stripe.com/docs/connect/express-accounts)

### Related Work

- Stripe Connect UI: `client/src/features/tenant-admin/TenantDashboard/StripeConnectCard.tsx`
- Booking flow: `apps/web/src/app/t/[slug]/book/[packageSlug]/page.tsx`

---

## Implementation Checklist

```
## Phase 1: Fix Error Messaging (Critical)
- [ ] Add `unavailableReason` state to PanelAgentChat
- [ ] Capture reason from health check response
- [ ] Create `getErrorMessage()` helper function
- [ ] Update render to use dynamic error messages
- [ ] Verify messages match HANDLED voice

## Phase 2: Add Missing Tools (High Priority)
- [ ] Add `initiate_stripe_onboarding` to write-tools.ts
- [ ] Add executor for Stripe onboarding
- [ ] Add `get_booking_link` to read-tools.ts
- [ ] Register both tools in all-tools.ts
- [ ] Add unit tests for new tools
- [ ] Test Stripe flow end-to-end

## Phase 3: Enhance System Prompt (High Priority)
- [ ] Add three-tier pricing framework section
- [ ] Add marketing quick wins section
- [ ] Add capability hints to context prompt
- [ ] Test with "help me with pricing" queries
- [ ] Verify voice consistency

## Phase 4: Improve Context (Medium Priority)
- [ ] Add packages query to context builder
- [ ] Add recent bookings query
- [ ] Update context prompt template
- [ ] Test context size stays reasonable
- [ ] Verify agent references packages correctly

## Verification
- [ ] Run full test suite: npm test
- [ ] Run E2E tests: npm run test:e2e
- [ ] Manual testing in dev mode
- [ ] Update CLAUDE.md if needed
```
