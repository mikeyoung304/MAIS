---
title: Fix All Documented Agent Failures
type: fix
date: 2026-01-29
status: reviewed
reviewed_by:
  - DHH (Architecture) - Approved with notes
  - Kieran (TypeScript) - 7 issues, 4 recommendations
  - Code Simplicity - Appropriately scoped
  - AI Agent Specialist - Critical gaps identified
  - Enterprise Security - HIGH risk items addressed
  - Claude Opus 4.5 (Final Review) - Corrections applied
---

# Fix All Documented Agent Failures

## ⚠️ Expert Review Findings (MUST READ)

### Critical Changes from Original Plan

| Finding                                | Reviewer   | Action                                               |
| -------------------------------------- | ---------- | ---------------------------------------------------- |
| **ADK state mutation doesn't persist** | AI Agent   | Use backend session state, not `context.state.set()` |
| **BookingDto contract mismatch**       | Kieran     | Update Zod schema in `packages/contracts/`           |
| **Missing authorization check**        | Enterprise | Add platform admin verification to bookings endpoint |
| **Navigation file location wrong**     | DHH        | Use `navigation.ts`, not `TenantHeader.tsx`          |
| **Missing safeParse in tools**         | Kieran     | Add Zod validation first line per pitfall #70        |
| **No rollback strategy**               | Enterprise | Define rollback for each phase                       |
| **Use 301 redirects**                  | Enterprise | Not 307 (temporary) for SEO                          |

### Opus Final Review Corrections (2026-01-29)

| Issue Found                      | Correction                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| **Line numbers inaccurate**      | bootstrap_session is at line **1719** (not 1770); verified agent.ts is 2032 lines             |
| **AdminController lacks Prisma** | Controller only has `bookingService` - need new service method `getAllPlatformBookings()`     |
| **Section IDs location wrong**   | IDs must be added in `TenantLandingPageClient.tsx`, not `page.tsx` (page delegates to client) |
| **Greeting cache key format**    | Use compound key `${tenantId}:${sessionId}:greeting` in existing LRU cache                    |
| **Package field verified**       | Package model uses `name` field ✅ (schema.prisma:261)                                        |

---

## Overview

Comprehensive fix for 7 documented issues from `docs/solutions/agent-issues/AGENT_FAILURES.md`:

- **5 Agent Failures** (#1-5)
- **2 Backend Issues** (#6-7)
- **1 Blocked Test** (Project Hub - unblocked by #7)

**Architectural Decision:** Single scrolling landing page is the MVP. Multi-page routes (`/about`, `/services`, etc.) are deferred to future work. This simplifies Issue #6 from "fix data sync" to "hide multi-page navigation".

---

## Problem Statement

Users are experiencing multiple agent failures that damage trust and block onboarding:

1. **Agent claims success but nothing updates** (Failure #1)
2. **Agent ignores user-provided information** (Failure #2)
3. **Booking chatbot completely broken** (Failure #3)
4. **Agent stuck in infinite retry loop** (Failure #4)
5. **Agent repeats same greeting forever** (Failure #5)
6. **Confusing dual content architecture** (Issue #6)
7. **Platform admin can't see bookings** (Issue #7)

---

## Proposed Solution

### Phase 1: Quick Wins (Independent, Parallelizable)

| Issue                    | Fix                                              | Effort | Risk   |
| ------------------------ | ------------------------------------------------ | ------ | ------ |
| **#7** Platform Bookings | Replace `DEFAULT_TENANT` with multi-tenant query | 30 min | Low    |
| **#6** Duplicate Content | Hide multi-page nav, single landing page MVP     | 1 hr   | Low    |
| **#3** Booking Agent     | Verify env vars, add health check                | 1 hr   | Medium |

### Phase 2: Agent Prompt Fixes (Require Redeployment)

| Issue                   | Fix                                                | Effort | Risk   |
| ----------------------- | -------------------------------------------------- | ------ | ------ |
| **#5** Welcome Loop     | Add `hasGreeted` state tracking, intent detection  | 2 hr   | Medium |
| **#4** Stuck in Loop    | Add read-before-write enforcement, circuit breaker | 2 hr   | Medium |
| **#2** Location Ignored | Add location triggers, research delegation         | 1 hr   | Low    |
| **#1** About Section    | Verify deployment, test E2E (may be fixed by #6)   | 1 hr   | Low    |

### Phase 3: Verification & Testing

- E2E tests for each failure scenario
- Cloud Run log verification
- User acceptance testing

---

## Technical Approach

### Architecture Decision: Single Landing Page MVP

```
CURRENT (Confusing):
┌─────────────────────────────────────────────────────┐
│ Customer visits /t/{slug}                           │
│   ├── Landing Page (scrolling sections)             │
│   │     └── Uses normalizeToPages() ✅              │
│   └── Multi-Page Nav → /about, /services, /faq      │
│         └── Reads legacy format ❌ (BROKEN)         │
└─────────────────────────────────────────────────────┘

MVP (Clear):
┌─────────────────────────────────────────────────────┐
│ Customer visits /t/{slug}                           │
│   └── Single Landing Page (all sections)            │
│         └── Uses normalizeToPages() ✅              │
│                                                     │
│ Multi-page routes: HIDDEN (deferred to future)      │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Quick Wins

#### Phase 1.1: Fix Platform Bookings (#7)

**File:** `server/src/routes/admin.routes.ts`

**Current Code (Line 22-23):**

```typescript
const DEFAULT_TENANT = 'tenant_default_legacy';
// ...
const bookings = await this.bookingService.getAllBookings(DEFAULT_TENANT);
```

**⚠️ OPUS CORRECTION: AdminController doesn't have direct Prisma access**

The controller delegates to `BookingService`. We need to add a new service method.

**Step 1: Add method to BookingService** (`server/src/services/booking.service.ts`)

```typescript
// Add new method for platform admin view
async getAllPlatformBookings(cursor?: string): Promise<{
  bookings: PlatformBookingDto[];
  hasMore: boolean;
  nextCursor?: string;
}> {
  const limit = 100;
  const bookings = await this.prisma.booking.findMany({
    where: {
      tenant: { isTestTenant: false }  // Exclude test tenants
    },
    include: {
      tenant: { select: { slug: true, name: true } },
      package: { select: { name: true } },  // Package.name per schema.prisma:261
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,  // Fetch one extra for hasMore check
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const hasMore = bookings.length > limit;
  if (hasMore) bookings.pop();

  return {
    bookings: bookings.map((b) => ({
      id: b.id,
      packageId: b.packageId,
      packageName: b.package?.name,
      coupleName: b.coupleName,
      email: b.email,
      phone: b.phone,
      eventDate: b.eventDate,
      addOnIds: b.addOnIds,
      totalCents: b.totalCents,
      status: b.status,
      createdAt: b.createdAt,
      tenantName: b.tenant.name,
      tenantSlug: b.tenant.slug,
    })),
    hasMore,
    nextCursor: hasMore ? bookings[bookings.length - 1]?.id : undefined,
  };
}
```

**Step 2: Update AdminController** (`server/src/routes/admin.routes.ts`)

```typescript
async getBookings(cursor?: string): Promise<{
  bookings: PlatformBookingDto[];
  hasMore: boolean;
  nextCursor?: string;
}> {
  // Delegate to service method (no direct Prisma access in controller)
  return this.bookingService.getAllPlatformBookings(cursor);
}
```

**⚠️ CRITICAL: Update Zod Schema (Kieran Review)**

The BookingDto changes require updating the Zod schema, not just TypeScript interface:

```typescript
// packages/contracts/src/dto.ts - UPDATE THE ZOD SCHEMA
export const PlatformBookingDtoSchema = BookingDtoSchema.extend({
  tenantName: z.string(),
  tenantSlug: z.string(),
  packageName: z.string().optional(),
});

// Then update api.v1.ts to use PlatformBookingDtoSchema for admin endpoint
```

**⚠️ CRITICAL: Add Authorization Check (Enterprise Review)**

Verify platform admin role before returning cross-tenant data:

```typescript
// Ensure this endpoint is protected by platform admin middleware
// The route should already be under /v1/admin/* which requires PLATFORM_ADMIN role
// VERIFY this in server/src/routes/index.ts - the admin routes should use platformAdminAuth middleware
```

**⚠️ CRITICAL: Add Pagination with hasMore (Kieran Review - Pitfall #67)**

```typescript
async getBookings(cursor?: string): Promise<{ bookings: BookingDto[]; hasMore: boolean; nextCursor?: string }> {
  const limit = 100;
  const bookings = await this.prisma.booking.findMany({
    where: { tenant: { isTestTenant: false } },
    take: limit + 1, // Fetch one extra to check hasMore
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: { createdAt: 'desc' },
    include: { tenant: { select: { slug: true, name: true } }, package: { select: { name: true } } },
  });

  const hasMore = bookings.length > limit;
  if (hasMore) bookings.pop();

  return {
    bookings: bookings.map(/* ... */),
    hasMore,
    nextCursor: hasMore ? bookings[bookings.length - 1]?.id : undefined,
  };
}
```

**Acceptance Criteria:**

- [ ] Platform admin sees all real bookings (not just legacy tenant)
- [ ] Badge count matches list count
- [ ] Test tenant bookings excluded
- [ ] TypeScript compiles without errors
- [ ] **NEW:** Zod schema updated in packages/contracts/src/dto.ts
- [ ] **NEW:** Authorization middleware verified
- [ ] **NEW:** hasMore indicator returned for pagination

---

#### Phase 1.2: Single Landing Page MVP (#6)

**Goal:** Hide multi-page navigation, customers see only the scrolling landing page.

**⚠️ CORRECTED FILE LOCATION (DHH Review)**

The navigation is NOT in `TenantHeader.tsx` - it's defined in:

- `apps/web/src/components/tenant/navigation.ts` - defines nav items
- `apps/web/src/components/tenant/TenantNav.tsx` - renders nav links

**File 1:** `apps/web/src/components/tenant/navigation.ts`

**Change:** Add anchor-based navigation function

```typescript
// Add new function for single-page anchor navigation
export function getAnchorNavigationItems(): NavItem[] {
  return [
    { label: 'Home', path: '#hero' },
    { label: 'About', path: '#about' },
    { label: 'Services', path: '#services' },
    { label: 'FAQ', path: '#faq' },
    { label: 'Contact', path: '#contact' },
  ];
}

// Or modify getNavigationItems to accept singlePageMode parameter:
export function getNavigationItems(
  config: TenantConfig,
  options?: { singlePageMode?: boolean }
): NavItem[] {
  if (options?.singlePageMode) {
    return getAnchorNavigationItems();
  }
  // ... existing multi-page logic
}
```

**File 2:** `apps/web/src/components/tenant/TenantNav.tsx`

**Change:** Use anchor navigation

```typescript
// Use anchor nav items for single-page mode
const navItems = getNavigationItems(config, { singlePageMode: true });
// OR
const navItems = getAnchorNavigationItems();
```

**⚠️ OPUS CORRECTION: Section IDs are in TenantLandingPageClient, not page.tsx**

The `page.tsx` file delegates to `TenantLandingPageClient`:

```typescript
// apps/web/src/app/t/[slug]/(site)/page.tsx line 147
<TenantLandingPageClient data={data} basePath={`/t/${slug}`} />
```

**File 3:** `apps/web/src/components/tenant/TenantLandingPageClient.tsx`

**Change:** Verify/add anchor IDs to section wrappers

```typescript
// Verify these IDs exist in the component that renders sections
<div id="hero">
  <HeroSection ... />
</div>
<div id="about">
  <AboutSection ... />
</div>
<div id="services">
  <ServicesSection ... />
</div>
<div id="faq">
  <FAQSection ... />
</div>
<div id="contact">
  <ContactSection ... />
</div>
```

**Pre-implementation check:**

```bash
# Verify current section ID state
grep -n 'id=' apps/web/src/components/tenant/TenantLandingPageClient.tsx
```

**⚠️ CRITICAL: Use 301 Permanent Redirects (Enterprise Review)**

**File 3:** `apps/web/src/app/t/[slug]/(site)/about/page.tsx`

```typescript
import { permanentRedirect } from 'next/navigation';
// OR use redirect with RedirectType.permanent

export default function AboutPage({ params }: { params: { slug: string } }) {
  // 301 PERMANENT redirect for SEO (not 307 temporary)
  permanentRedirect(`/t/${params.slug}#about`);
}
```

**Apply same pattern to:** `/services/page.tsx`, `/faq/page.tsx`, `/contact/page.tsx`

**Acceptance Criteria:**

- [ ] Customer-facing site shows single scrolling page
- [ ] Navigation links scroll to sections (anchor links)
- [ ] Direct visits to `/t/{slug}/about` redirect to landing page
- [ ] Agent updates to about section visible immediately
- [ ] No confusing "two different about pages" UX
- [ ] **NEW:** Redirects return 301 (permanent), not 307 (temporary)
- [ ] **NEW:** Landing page has `id="about"`, `id="services"`, etc. anchors

---

#### Phase 1.3: Fix Booking Agent Connection (#3)

**Investigation Steps:**

1. **Verify environment variable in Render:**

   ```bash
   # Check Render dashboard or CLI
   render env list --service mais-api | grep BOOKING_AGENT_URL
   ```

2. **Verify Cloud Run service is running:**

   ```bash
   gcloud run services describe booking-agent --region=us-central1 --format='value(status.url)'
   ```

3. **Test connectivity from backend:**
   ```bash
   # Add health check endpoint
   curl -X GET https://booking-agent-506923455711.us-central1.run.app/health
   ```

**File:** `server/src/services/customer-agent.service.ts`

**⚠️ CRITICAL: Use Existing Health Check Pattern (Kieran Review)**

Align with existing `HealthCheckResult` interface from `server/src/services/health-check.service.ts`:

```typescript
import { HealthCheckResult } from './health-check.service';

// Whitelist of valid agent URLs for security (Enterprise Review)
const ALLOWED_AGENT_URLS = new Set(
  [
    process.env.BOOKING_AGENT_URL,
    process.env.CONCIERGE_AGENT_URL,
    process.env.MARKETING_AGENT_URL,
    process.env.STOREFRONT_AGENT_URL,
    process.env.RESEARCH_AGENT_URL,
  ].filter(Boolean)
);

export async function checkBookingAgentHealth(): Promise<HealthCheckResult & { url: string }> {
  const url = getBookingAgentUrl();

  // Security: Validate URL against whitelist
  if (!ALLOWED_AGENT_URLS.has(url)) {
    return { status: 'unhealthy', url, error: 'Invalid agent URL' };
  }

  const startTime = Date.now();
  try {
    const response = await fetchWithTimeout(`${url}/health`, {
      method: 'GET',
      timeout: 5000,
    });
    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      latency: Date.now() - startTime,
      url,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Add to admin health endpoint:**

```typescript
// server/src/routes/admin.routes.ts or health.routes.ts
app.get('/v1/admin/health/agents', async (req, res) => {
  const [booking, concierge, storefront] = await Promise.all([
    checkBookingAgentHealth(),
    checkConciergeAgentHealth(),
    checkStorefrontAgentHealth(),
  ]);

  res.json({
    booking,
    concierge,
    storefront,
    allHealthy: booking.healthy && concierge.healthy && storefront.healthy,
  });
});
```

**Acceptance Criteria:**

- [ ] `BOOKING_AGENT_URL` environment variable set in Render
- [ ] Health check endpoint returns booking agent as reachable
- [ ] Customer can start booking conversation (no "Connection issue")
- [ ] Backend logs show successful agent communication

---

### Phase 2: Agent Prompt Fixes

#### Phase 2.1: Fix Infinite Welcome Loop (#5)

**Root Cause:** Agent calls `bootstrap_session` on every message and generates greeting each time. No state tracking for "already greeted".

**⚠️ CRITICAL: ADK State Mutation Does NOT Persist (AI Agent Specialist Review)**

The original plan assumed `context.state.set()` would persist across turns. **This is incorrect.**

Per ADK behavior and `A2A_SESSION_STATE_PREVENTION.md`:

- Session state is read-only from the tool's perspective
- State is passed IN via session creation, not mutated by tools
- `context.state.set()` changes are NOT persisted between turns

**CORRECTED APPROACH: Track greeting state in BACKEND, not ADK state**

**File 1:** `server/src/routes/internal-agent.routes.ts` (bootstrap endpoint)

**Change:** Track `lastGreetingAt` in session/database

```typescript
// In the /bootstrap endpoint handler
// Add tracking for when greeting was last shown

interface BootstrapResponse {
  // ... existing fields ...
  skipGreeting: boolean; // NEW: Tell agent to skip greeting
  lastGreetingAt?: string; // NEW: When we last greeted this session
}

// In the handler:
const GREETING_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

// Check if we've greeted recently (could use session store, Redis, or database)
const lastGreeting = await getLastGreetingTimestamp(tenantId, sessionId);
const skipGreeting = lastGreeting && Date.now() - lastGreeting.getTime() < GREETING_COOLDOWN_MS;

// If NOT skipping, update the timestamp
if (!skipGreeting) {
  await setLastGreetingTimestamp(tenantId, sessionId, new Date());
}

return {
  ...bootstrapData,
  skipGreeting,
  lastGreetingAt: lastGreeting?.toISOString(),
};
```

**File 2:** `server/src/agent-v2/deploy/concierge/src/agent.ts`

**Change:** bootstrap_session tool uses backend response (no local state mutation)

```typescript
// In bootstrap_session tool execute function (line 1719-1770 - VERIFIED)
// DO NOT use context.state.set() - it doesn't persist!

// Guard against undefined context (Kieran Review - Pitfall #51)
if (!context) {
  return { error: 'No context available' };
}

const bootstrapData = await fetchBootstrapData(tenantId);

// The BACKEND tells us whether to skip greeting
const { skipGreeting } = bootstrapData;

return {
  ...bootstrapData,
  instruction: skipGreeting
    ? 'User has already been greeted this session. DO NOT repeat welcome. Address their request directly.'
    : 'This is a new session. Greet the user briefly, then ask what they need.',
};
```

**Fix 2: Update system prompt to respect hasGreeted**

```typescript
// Add to system prompt (around line 200)
`
## Greeting Protocol

When bootstrap_session returns:
- If hasGreeted: false → Brief welcome, then ask what they need
- If hasGreeted: true → DO NOT say "welcome back" or re-introduce yourself
  - Jump directly to addressing their current message
  - If they said "yes" or confirmed something, TAKE ACTION on what was offered

CRITICAL: After greeting once, NEVER greet again in the same session.
If user says "yes" or "please set up my website", DELEGATE TO STOREFRONT immediately.
`;
```

**Fix 3: Add intent detection for common actions**

```typescript
// Add to system prompt
`
## Intent Detection (After Greeting)

When user responds after greeting, detect intent:
- "yes" / "let's do it" / "proceed" → Continue with offered action
- "set up my website" / "build my site" → delegate_to_storefront
- "update my [section]" → delegate_to_storefront with section
- "write copy for" / "help me with copy" → delegate_to_marketing
- "research" / "find out about" → delegate_to_research

NEVER ask "what would you like to do?" after user already said what they want.
`;
```

**Acceptance Criteria:**

- [ ] User gets ONE welcome message per session
- [ ] "yes" after welcome triggers action (not another welcome)
- [ ] "set up my website" immediately delegates to storefront
- [ ] Cloud Run logs show delegation tools being called (not just bootstrap)

---

#### Phase 2.2: Fix Stuck in Loop (#4)

**Root Cause:** Agent calls `delegate_to_marketing` without providing current content. Marketing asks for content. Agent interprets as failure. Retries same approach.

**File:** `server/src/agent-v2/deploy/concierge/src/agent.ts`

**Fix 1: Enforce read-before-write in prompt**

```typescript
// Add to system prompt (around line 250)
`
## Read-Before-Write Protocol (MANDATORY)

When user asks to REWRITE, UPDATE, or IMPROVE existing content:

1. FIRST: Call get_storefront_structure to get current content
2. THEN: Call delegate_to_marketing WITH the current content
3. FINALLY: Call delegate_to_storefront to apply changes

Example - User: "rewrite my hero"
WRONG: delegate_to_marketing({ task: "rewrite hero" }) ❌ (no content provided)
RIGHT:
  1. get_storefront_structure() → get current headline
  2. delegate_to_marketing({ task: "rewrite", currentContent: "Space to Slow Down..." })
  3. delegate_to_storefront({ section: "hero", content: newHeadline })

NEVER ask user for content you can fetch yourself.
`;
```

**Fix 2: Add circuit breaker for repeated failures**

```typescript
// Add to system prompt
`
## Failure Recovery Protocol

If a tool call fails:
1. First failure: Try alternative approach
2. Second failure: Check if you're missing required input
3. Third failure: STOP and ask user for help

Example recovery:
- "I tried to update that section but hit an issue. Can you tell me exactly what you'd like it to say?"

NEVER repeat the same failed approach more than twice.
`;
```

**Fix 3: Improve delegate_to_marketing tool to require content**

**⚠️ CRITICAL: Add safeParse Validation (Kieran Review - Pitfall #70)**

```typescript
// Update delegate_to_marketing tool schema (around line 1150)
// NOTE: Using union to maintain backward compatibility with existing task values
const DelegateToMarketingParams = z.object({
  task: z.union([
    z.enum(['generate', 'refine', 'rewrite']),
    z.string().describe('Legacy: headline, tagline, service_description'),
  ]),
  context: z.string().describe('What section/page this is for'),
  currentContent: z
    .string()
    .optional()
    .describe(
      'REQUIRED for refine/rewrite tasks. The current text to improve. ' +
        'Get this from get_storefront_structure first.'
    ),
  direction: z.string().optional().describe('Specific guidance for the copy'),
});

// In execute function - safeParse MUST be FIRST LINE per Pitfall #70
execute: async (params, context) => {
  // CRITICAL: Zod validation FIRST LINE
  const parseResult = DelegateToMarketingParams.safeParse(params);
  if (!parseResult.success) {
    return {
      success: false,
      error: `Invalid parameters: ${parseResult.error.message}`,
    };
  }
  const { task, context: ctx, currentContent, direction } = parseResult.data;

  // Then validate business logic
  if ((task === 'refine' || task === 'rewrite') && !currentContent) {
    return {
      success: false,
      error:
        'Cannot refine/rewrite without current content. Call get_storefront_structure first to get the current text.',
      suggestion:
        'Call get_storefront_structure() to fetch current content, then retry with currentContent parameter.',
    };
  }

  // ... rest of execute function
};
```

**Acceptance Criteria:**

- [ ] "rewrite my hero" triggers get_storefront_structure FIRST
- [ ] delegate_to_marketing receives current content
- [ ] After 3 failures, agent asks user for clarification
- [ ] No infinite "That didn't work. Want me to try again?" loops

---

#### Phase 2.3: Fix Location Ignored (#2)

**Root Cause:** Agent not triggering `store_discovery_fact` for location or research tools for web searches.

**File:** `server/src/agent-v2/deploy/concierge/src/agent.ts`

**Fix 1: Add location triggers to prompt**

```typescript
// Add to SIGNAL PHRASES section (around line 300)
`
## Location Signals → store_discovery_fact

When user mentions location, IMMEDIATELY store it:
- "I'm in [city]" → store_discovery_fact({ category: 'location', fact: { city, state } })
- "based in [place]" → store_discovery_fact
- "located in [area]" → store_discovery_fact
- "[city], [state]" → store_discovery_fact

After storing location, acknowledge briefly: "Got it, [city]."
Then continue with the conversation - don't re-ask for location.
`;
```

**Fix 2: Add web search triggers**

```typescript
// Add to SIGNAL PHRASES section
`
## Research Signals → delegate_to_research

When user requests research or provides a URL:
- "look at my site [url]" → delegate_to_research({ task: 'analyze_website', url })
- "search for [topic]" → delegate_to_research({ task: 'web_search', query })
- "you can web search" → delegate_to_research (user is giving permission)
- "check out [competitor]" → delegate_to_research({ task: 'competitor_analysis' })
- "find [information]" → delegate_to_research

IMPORTANT: When user says "you can web search", they are COMMANDING you to search.
This is not optional. Call delegate_to_research immediately.
`;
```

**Fix 3: Improve fact storage to return confirmation**

```typescript
// Update store_discovery_fact tool result (around line 1840)
return {
  success: true,
  stored: {
    category,
    fact,
    timestamp: new Date().toISOString(),
  },
  knownFacts: {
    hasLocation: !!discoveryData.location,
    hasIndustry: !!discoveryData.industry,
    hasServices: discoveryData.services?.length > 0,
  },
  instruction:
    `Fact stored. Current knowledge: location=${hasLocation}, industry=${hasIndustry}. ` +
    `Continue conversation without re-asking for stored information.`,
};
```

**Acceptance Criteria:**

- [ ] "I'm in Austin, TX" triggers store_discovery_fact
- [ ] Agent doesn't ask "what city are you in?" after location provided
- [ ] "you can web search my site" triggers delegate_to_research
- [ ] Cloud Run logs show research-agent receiving requests

---

#### Phase 2.4: Verify About Section Fix (#1)

**Note:** This may already be fixed by Phase 1.2 (single landing page MVP).

**Verification Steps:**

1. Deploy all agent changes from Phase 2.1-2.3
2. Test E2E flow:
   - User: "update my about section to say: [exact text]"
   - Agent should: store_discovery_fact + delegate_to_storefront
   - Preview should show updated text

**If still failing after deployment:**

Check `FACT_TO_STOREFRONT_BRIDGE_PREVENTION.md` - the fix (Trigger 2b) should already be in the codebase. Verify it's deployed:

```bash
# Check Cloud Run revision timestamp
gcloud run services describe concierge-agent --region=us-central1 \
  --format='value(status.latestReadyRevisionName,status.conditions[0].lastTransitionTime)'
```

**Acceptance Criteria:**

- [ ] "update my about section to [text]" results in visible change
- [ ] Agent says "Done" only AFTER storefront actually updates
- [ ] Preview iframe shows new content within 5 seconds
- [ ] Cloud Run logs show both store_discovery_fact AND delegate_to_storefront called

---

### Phase 3: Testing & Verification

#### E2E Test Scenarios

**Test 1: About Section Update (Failures #1, #6)**

```gherkin
Given I am a tenant in onboarding mode
When I say "update my about section to: We are a family farm in Texas"
Then the agent should call store_discovery_fact
And the agent should call delegate_to_storefront
And the preview should show "We are a family farm in Texas"
And the agent should say "Done" or "Updated"
```

**Test 2: Location Storage (Failure #2)**

```gherkin
Given I am a new tenant
When I say "I'm a photographer in Austin, TX"
Then the agent should call store_discovery_fact with location
And when I later say "where am I located?"
Then the agent should say "Austin, TX" without asking again
```

**Test 3: Booking Agent (Failure #3)**

```gherkin
Given I am a customer on a tenant storefront
When I open the booking chat widget
And I say "I'd like to book for 30 people"
Then I should NOT see "Connection issue"
And the agent should respond with package options or questions
```

**Test 4: Rewrite Flow (Failure #4)**

```gherkin
Given I am a tenant with existing hero text "Space to Slow Down"
When I say "rewrite my hero"
Then the agent should call get_storefront_structure first
And the agent should call delegate_to_marketing with currentContent
And the agent should NOT get stuck in a loop
```

**Test 5: Welcome Loop (Failure #5)**

```gherkin
Given I am a returning tenant
When I open the chat and agent says "Welcome back!"
And I respond "yes, set up my website"
Then the agent should call delegate_to_storefront
And the agent should NOT say "Welcome back!" again
```

**Test 6: Platform Bookings (Issue #7)**

```gherkin
Given I am a platform admin
When I view the bookings dashboard
Then the badge count should match the list count
And I should see bookings from all real tenants
And test tenant bookings should be excluded
```

---

## Alternative Approaches Considered

### For Issue #6 (Duplicate Content):

| Approach                      | Pros                   | Cons                        | Decision    |
| ----------------------------- | ---------------------- | --------------------------- | ----------- |
| **Fix multi-page components** | Preserves all features | Complex, touches many files | ❌ Deferred |
| **Auto-sync both systems**    | Best of both worlds    | Very complex, sync bugs     | ❌ Rejected |
| **Single landing page MVP**   | Simple, clear, fast    | Loses multi-page SEO        | ✅ Chosen   |

**Rationale:** MVP speed > feature completeness. Multi-page can be re-added later with proper architecture.

### For Issue #5 (Welcome Loop):

| Approach                    | Pros                | Cons                   | Decision       |
| --------------------------- | ------------------- | ---------------------- | -------------- |
| **Session state tracking**  | Clean, proper state | Requires ADK state API | ✅ Chosen      |
| **Message count heuristic** | Simple              | Fragile, edge cases    | ❌ Rejected    |
| **Prompt-only fix**         | No code change      | LLM may still repeat   | ❌ Backup only |

---

## Acceptance Criteria

### Functional Requirements

- [ ] All 5 agent failures resolved (no reproduction in E2E tests)
- [ ] Platform admin can see all bookings
- [ ] Single landing page architecture working
- [ ] Agent updates visible in preview immediately

### Non-Functional Requirements

- [ ] Agent response time < 10s (including tool calls)
- [ ] No TypeScript errors or warnings
- [ ] All existing tests pass
- [ ] Cloud Run deployment successful (verified via revision check)

### Quality Gates

- [ ] E2E tests for each failure scenario pass
- [ ] Code review approval
- [ ] Manual QA on staging environment
- [ ] No regressions in existing functionality

---

## Success Metrics

| Metric                                      | Current | Target |
| ------------------------------------------- | ------- | ------ |
| Agent "success but nothing changed" reports | ~5/week | 0      |
| Booking agent "connection issue" errors     | Unknown | 0      |
| Infinite loop incidents                     | ~3/week | 0      |
| Platform admin booking visibility           | 0%      | 100%   |
| Onboarding completion rate                  | TBD     | +20%   |

---

## Dependencies & Prerequisites

### Phase 1 Dependencies

- [ ] Render dashboard access (for env vars)
- [ ] GCP Console access (for Cloud Run verification)
- [ ] Database access (for bookings query testing)

### Phase 2 Dependencies

- [ ] GitHub Actions deployment working (confirmed ✅)
- [ ] GCP IAM permissions (confirmed ✅)
- [ ] Agent deployment verified

### External Dependencies

- None - all fixes are internal

---

## Risk Analysis & Mitigation

| Risk                                      | Probability | Impact | Mitigation                              |
| ----------------------------------------- | ----------- | ------ | --------------------------------------- |
| Agent prompt changes break existing flows | Medium      | High   | E2E tests before/after, staged rollout  |
| Multi-page redirect breaks SEO            | Low         | Medium | Add proper 301 redirects with canonical |
| Booking agent env var wrong               | Medium      | High   | Health check endpoint, monitoring       |
| State tracking doesn't persist            | Low         | Medium | Test across session boundaries          |

---

## Resource Requirements

**Estimated Effort:**

- Phase 1: 3-4 hours (parallelizable)
- Phase 2: 5-6 hours (sequential due to deployments)
- Phase 3: 2-3 hours (testing)
- **Total: 10-13 hours**

**Team:** 1 developer (can be done solo with agent assistance)

---

## Implementation Order

```
Day 1 (Phase 1 - Parallel):
├── #7 Platform Bookings (30 min) ──────────────────┐
├── #6 Single Landing Page (1 hr) ──────────────────┼── Can be parallelized
└── #3 Booking Agent Health (1 hr) ─────────────────┘

Day 1-2 (Phase 2 - Sequential):
├── #5 Welcome Loop Fix (2 hr)
│     └── Deploy & verify
├── #4 Stuck Loop Fix (2 hr)
│     └── Deploy & verify
├── #2 Location/Research Fix (1 hr)
│     └── Deploy & verify
└── #1 About Section Verify (1 hr)
      └── E2E test

Day 2 (Phase 3):
└── Full E2E test suite
    └── Manual QA
    └── Production verification
```

---

## Rollback Strategy

**⚠️ CRITICAL: Enterprise Review Required This Section**

Each phase has a defined rollback procedure in case of issues. Follow these in reverse order of deployment.

### Phase 1 Rollbacks (Database/UI Changes)

**Phase 1.1 - Platform Bookings:**

```bash
# Rollback: Revert to original query (not recommended - leaves bug in place)
# git revert the commit that changed admin.routes.ts
git revert <commit-sha> --no-commit

# OR: Keep code changes but add feature flag
# Add PLATFORM_BOOKINGS_MULTI_TENANT=false to env to use legacy query
```

**Phase 1.2 - Single Landing Page:**

```bash
# Rollback: Remove redirects and restore multi-page nav
# Option A: git revert
git revert <commit-sha> --no-commit

# Option B: Feature flag (preferred)
# Add SINGLE_PAGE_MODE=false to env vars
# Navigation code checks: process.env.SINGLE_PAGE_MODE !== 'false'
```

**Phase 1.3 - Booking Agent Health Check:**

```bash
# Rollback: Health check is additive, no rollback needed
# If health check causes issues, comment out the route
```

### Phase 2 Rollbacks (Agent Deployments)

**All Phase 2 Agent Changes:**

```bash
# Option 1: Redeploy previous Cloud Run revision
gcloud run services update-traffic concierge-agent \
  --to-revisions=<previous-revision>=100 \
  --region=us-central1

# List available revisions:
gcloud run revisions list --service=concierge-agent --region=us-central1

# Option 2: Rollback via Git and redeploy
git revert <agent-change-commits>
cd server/src/agent-v2/deploy/concierge && npm run deploy
```

**Rollback Decision Tree:**

```
Is agent completely broken (500 errors)?
├── YES → Immediate revision rollback (Option 1)
│         gcloud run services update-traffic ...
└── NO → Is it causing user-visible issues?
         ├── YES → Revert code + redeploy (Option 2)
         └── NO → Document issue, fix forward in next deployment
```

### Monitoring During Rollout

**Pre-deployment baseline (capture before any changes):**

```bash
# Capture current revision
gcloud run services describe concierge-agent --region=us-central1 \
  --format='value(status.latestReadyRevisionName)' > /tmp/baseline-revision.txt

# Capture current error rate (last 1 hour)
gcloud logging read 'resource.type="cloud_run_revision" severity>=ERROR' \
  --limit=100 --format=json | jq length
```

**Post-deployment verification:**

```bash
# Compare error rate
gcloud logging read 'resource.type="cloud_run_revision" severity>=ERROR' \
  --limit=100 --format=json | jq length

# If error rate increased significantly (>2x), consider rollback
```

### Rollback Timing

| Phase                   | Max Time to Detect Issue | Rollback Time             |
| ----------------------- | ------------------------ | ------------------------- |
| 1.1 Platform Bookings   | 5 min (page load test)   | 2 min (git revert)        |
| 1.2 Single Landing Page | 10 min (visual test)     | 5 min (git revert)        |
| 1.3 Booking Agent       | 5 min (health check)     | N/A (additive)            |
| 2.1-2.4 Agent Changes   | 30 min (E2E tests)       | 2 min (revision rollback) |

---

## Future Considerations

### Multi-Page Architecture (Deferred)

When re-introducing multi-page routes:

1. All components MUST use `normalizeToPages()`
2. Consider: Should multi-page read from same config or separate?
3. SEO implications: unique URLs vs anchor links
4. Navigation: How does user switch between views?

### Conversation History Viewer (FR-1)

From AGENT_FAILURES.md - platform admin needs to view conversation transcripts for debugging. This would make future failure investigation much faster.

### Agent Observability

Consider adding:

- Structured logging for all tool calls
- Metrics for tool success/failure rates
- Alerting on repeated failures

---

## Documentation Plan

After implementation:

- [ ] Update CLAUDE.md with new pitfalls discovered
- [ ] Add E2E test documentation
- [ ] Update AGENT_FAILURES.md with resolution status
- [ ] Run `/workflows:compound` for each major fix

---

## References & Research

### Internal References

- Agent failures doc: `docs/solutions/agent-issues/AGENT_FAILURES.md`
- Prevention patterns: `docs/solutions/PREVENTION-QUICK-REFERENCE.md`
- Fact-to-storefront: `docs/solutions/agent-issues/FACT_TO_STOREFRONT_BRIDGE_PREVENTION.md`
- Concierge agent: `server/src/agent-v2/deploy/concierge/src/agent.ts`
- Landing page service: `server/src/services/landing-page.service.ts`
- Admin routes: `server/src/routes/admin.routes.ts`

### Key File Locations (VERIFIED 2026-01-29)

| Purpose                  | File                                                         | Lines         | Notes                                         |
| ------------------------ | ------------------------------------------------------------ | ------------- | --------------------------------------------- |
| Concierge prompt         | `server/src/agent-v2/deploy/concierge/src/agent.ts`          | 82-403        | System prompt starts line 82                  |
| Bootstrap tool           | `server/src/agent-v2/deploy/concierge/src/agent.ts`          | **1719-1770** | ✅ Verified (was 1718)                        |
| FACT-TO-STOREFRONT       | `server/src/agent-v2/deploy/concierge/src/agent.ts`          | 138           | Bridge section in prompt                      |
| Marketing delegation     | `server/src/agent-v2/deploy/concierge/src/agent.ts`          | ~1122-1200    | Search for `delegate_to_marketing`            |
| Storefront delegation    | `server/src/agent-v2/deploy/concierge/src/agent.ts`          | ~1203-1336    | Search for `delegate_to_storefront`           |
| Platform bookings        | `server/src/routes/admin.routes.ts`                          | 10, 22-35     | ⚠️ Controller not route - uses BookingService |
| Customer agent           | `server/src/services/customer-agent.service.ts`              | 349-660       |                                               |
| **Navigation items**     | `apps/web/src/components/tenant/navigation.ts`               | 1-154         | `getNavigationItems()`                        |
| **Navigation component** | `apps/web/src/components/tenant/TenantNav.tsx`               |               | Renders nav links                             |
| **Section IDs**          | `apps/web/src/components/tenant/TenantLandingPageClient.tsx` |               | ⚠️ Where IDs must be added                    |
| Landing page (SSR)       | `apps/web/src/app/t/[slug]/(site)/page.tsx`                  | 1-270         | Delegates to TenantLandingPageClient          |
| Internal agent routes    | `server/src/routes/internal-agent.routes.ts`                 | 300-383       | Bootstrap endpoint with LRU cache             |

---

🤖 Generated with [Claude Code](https://claude.ai/code)
