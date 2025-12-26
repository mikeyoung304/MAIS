# MAIS AI Agent - Capability Map v2.0

> **Purpose:** Map user actions to agent tools with action parity
> **Principle:** "Whatever the user can do, the agent can do"
> **Status:** Updated 2025-12-26 with multi-agent review findings

---

## Executive Summary

After multi-agent review (Architecture, Security, UX, Agent-Native, Implementation, Simplicity), the design has been streamlined:

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Tools | 43 | 18 | -58% |
| System Prompt | 310 lines | ~100 lines | -68% |
| Context Layers | 3 | 1 | Simplified |
| MVP Features | 5 areas | 3 core areas | Focused |

---

## Target Users

**Primary:** Service providers who want to focus on their craft
- Wedding/portrait photographers
- Wellness coaches
- Private chefs
- Consultants

**Core Value Proposition:**
> "Go from idea to functioning storefront with booking and payments - without the legwork"

---

## MVP Tool Set (18 Tools)

### Read Tools (9)

| Tool | Purpose | Returns | API Endpoint |
|------|---------|---------|--------------|
| `get_tenant` | Business profile | name, slug, branding, Stripe status | NEW: `/v1/tenant-admin/profile` |
| `get_dashboard` | Business overview | revenue, booking count, upcoming | NEW: `/v1/tenant-admin/dashboard` |
| `get_packages` | All packages (optional ID filter) | array or single package | `GET /v1/tenant-admin/packages` |
| `get_bookings` | Bookings with filters | array of bookings | `GET /v1/tenant-admin/bookings` |
| `get_booking` | Single booking details | full booking with customer | NEW: `GET /v1/tenant-admin/bookings/:id` |
| `check_availability` | Date availability | boolean + conflicts | `GET /v1/availability` |
| `get_blackouts` | Blocked dates | array of blackouts | `GET /v1/tenant-admin/blackouts` |
| `get_landing_page` | Storefront config | pages, sections, content | `GET /v1/tenant-admin/landing-page` |
| `get_stripe_status` | Payment setup | connected, requirements, dashboard URL | `GET /v1/tenant-admin/stripe/status` |

### Write Tools (7)

All write tools use **server-side approval** (see Security section).

| Tool | Purpose | Trust Tier | API Endpoint |
|------|---------|------------|--------------|
| `upsert_package` | Create or update package | T2 (soft confirm) | `POST/PUT /v1/tenant-admin/packages` |
| `delete_package` | Remove package | T2 (soft confirm) | `DELETE /v1/tenant-admin/packages/:id` |
| `manage_blackout` | Create/delete blackout | T1 (no confirm) | `POST/DELETE /v1/tenant-admin/blackouts` |
| `update_branding` | Update brand settings | T1 (no confirm) | `PUT /v1/tenant-admin/branding` |
| `update_landing_page` | Update storefront | T2 (soft confirm) | `PUT /v1/tenant-admin/landing-page` |
| `request_file_upload` | Get upload URL | T1 (no confirm) | NEW: `POST /v1/tenant-admin/upload-url` |
| `get_gallery_images` | List portfolio images | Read (no confirm) | NEW: `GET /v1/tenant-admin/gallery` |

### Sensitive Tools (2)

Always require **hard confirmation** with consequence explanation.

| Tool | Purpose | Consequences | API Endpoint |
|------|---------|--------------|--------------|
| `cancel_booking` | Cancel and refund | Refund issued, customer notified | NEW: `POST /v1/tenant-admin/bookings/:id/cancel` |
| `confirm_proposal` | Execute pending change | Applies proposed changes | NEW: `POST /v1/agent/proposals/:id/confirm` |

---

## Trust Tiers (Confirmation Levels)

Based on UX review to avoid confirmation fatigue:

| Tier | Behavior | Operations |
|------|----------|------------|
| **T1: No Confirm** | Execute immediately, report result | Blackouts, branding, visibility toggles, file uploads |
| **T2: Soft Confirm** | "I'll update X. Say 'wait' if that's wrong" (proceeds after next message) | Package changes, landing page updates, pricing |
| **T3: Hard Confirm** | Must receive explicit "yes"/"confirm"/"do it" | Cancellations, refunds, deletes with existing bookings |

**Implementation:** Trust tier is enforced in system prompt AND server-side proposal mechanism.

---

## Server-Side Approval Mechanism

**CRITICAL SECURITY REQUIREMENT:** Write operations use server-side proposals, not just prompt instructions.

```typescript
// Write tools return proposals, not executed results
interface ToolProposal {
  proposalId: string;
  operation: string;
  preview: Record<string, unknown>;  // What will change
  trustTier: 'T1' | 'T2' | 'T3';
  requiresApproval: boolean;
  expiresAt: Date;  // 30 minutes
}

// Agent flow:
// 1. Agent calls upsert_package(data) → returns ProposalResponse
// 2. Agent shows proposal to user
// 3. User confirms → Agent calls confirm_proposal(proposalId)
// 4. Server executes the change
// 5. Agent confirms result

// T1 operations: proposalId auto-confirmed, returns result directly
// T2 operations: proposal created, auto-confirms after next user message (unless "wait")
// T3 operations: proposal created, requires explicit confirm_proposal() call
```

This prevents prompt injection from bypassing approval - the server enforces it.

---

## Context Injection (Simplified)

**Single static injection at session start.** Tools are the refresh mechanism.

```markdown
## Your Business Context

You are helping **{tenant.name}** ({tenant.slug}).

**Setup:**
- Stripe: {connected ? 'Ready for payments' : 'Not yet connected - guide them to set up'}
- Packages: {count} configured
- Upcoming bookings: {count} in next 30 days

**Quick Stats:**
- Total bookings: {totalBookings}
- This month revenue: {revenueThisMonth}

For current details, use your read tools.
```

**Why simplified:**
- Agent can call `get_dashboard` when it needs current data
- No complex refresh logic needed
- Reduces token usage
- Tools ARE the API - use them

---

## Security Requirements

### Tenant Isolation

**CRITICAL:** All tools receive `tenantId` from authenticated JWT session, NEVER from user input.

```typescript
// Every tool implementation MUST:
async function get_packages(context: AuthenticatedContext) {
  const { tenantId } = context;  // From JWT, not user input
  return prisma.package.findMany({
    where: { tenantId }  // ALWAYS filter by tenant
  });
}
```

### Data Sanitization

User-controlled data (package names, descriptions, customer names) MUST be sanitized before context injection:

```typescript
const INJECTION_PATTERNS = [
  /ignore.*instructions/i,
  /you are now/i,
  /system:/i,
  /admin mode/i,
];

function sanitizeForContext(text: string): string {
  let result = text;
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, '[FILTERED]');
  }
  return result.slice(0, 100);  // Length limit
}
```

### Never Inject (Explicit Deny List)

- `passwordHash`, `passwordResetToken`, `passwordResetExpires`
- `apiKeyPublic`, `apiKeySecret`
- `stripeAccountId`, `stripeWebhookSecret`
- `secrets` (encrypted credentials)
- `googleCalendarRefreshToken`
- Internal entity UUIDs (use slugs/reference numbers instead)
- Other tenants' data (NEVER)

### Audit Logging

All tool calls MUST be logged:

```typescript
interface AgentAuditLog {
  tenantId: string;
  sessionId: string;
  timestamp: Date;
  toolName: string;
  proposalId?: string;
  inputSummary: string;  // Sanitized, max 500 chars
  outputSummary: string;
  trustTier: 'T1' | 'T2' | 'T3';
  approvalStatus: 'auto' | 'soft' | 'explicit' | 'bypassed';
}
```

Retention: 90 days minimum, 7 years for financial operations.

---

## Deferred to Post-MVP

These features exist in the backend but are deferred for MVP simplicity:

| Feature | Why Deferred | When to Add |
|---------|--------------|-------------|
| Custom domains | <5% of MVP users | When users request |
| Services (time-slots) | Packages are priority | Phase 2 |
| Add-ons | Nice-to-have | Phase 2 |
| Segments | Multi-business-line complexity | When needed |
| Availability rules | Most users just block dates | Phase 2 |
| Reschedule booking | Rare operation, UI works | Phase 2 |
| Stripe account creation | User clicks button in UI | Keep in UI |
| Draft/publish workflow | Direct publish simpler | Phase 2 |

---

## API Endpoints Needed (7 New)

| Endpoint | Purpose | Effort |
|----------|---------|--------|
| `GET /v1/tenant-admin/profile` | Full tenant profile | Low |
| `GET /v1/tenant-admin/dashboard` | Aggregated stats | Medium |
| `GET /v1/tenant-admin/bookings/:id` | Single booking | Low |
| `POST /v1/tenant-admin/bookings/:id/cancel` | Cancel with refund | Low (service exists) |
| `POST /v1/tenant-admin/upload-url` | Presigned upload URL | Low |
| `GET /v1/tenant-admin/gallery` | Portfolio images | Low |
| `POST /v1/agent/proposals/:id/confirm` | Execute proposal | Medium |

**84% of tools map to existing endpoints.** Estimated: 2-3 days for new endpoints.

---

## Interaction Model

### Proposal-Approval Flow

```
1. DISCOVER  → Agent asks questions, understands business
2. PROPOSE   → Agent recommends changes (server creates proposal)
3. ITERATE   → User refines ("make it $X", "add Y")
4. CONFIRM   → Based on trust tier:
               T1: Auto-confirmed
               T2: Proceeds after next message (unless "wait")
               T3: Requires explicit "yes"/"confirm"/"do it"
5. EXECUTE   → Server executes proposal
6. VERIFY    → Agent confirms result
```

### Confirmation Vocabulary

**Explicit confirmations (T3):**
- "yes", "do it", "confirm", "proceed", "execute", "submit"

**Rejection:**
- "no", "wait", "stop", "cancel", "hold on", "actually"

**Ambiguous (ask to clarify):**
- "ok", "sure", "fine" → "Just to confirm, should I proceed with [action]?"

---

## Error Handling

When tools fail, the agent should:

```markdown
## When Tools Fail

1. **Explain simply:** "I couldn't update that package because [reason]"
2. **Suggest fix:** "Try [specific action] to resolve this"
3. **Don't retry automatically:** Ask before trying again
4. **For payment errors:** Always ask user to try again manually

Example:
"I tried to update your Wedding Day package but got an error -
it looks like there's already a package with that name.
Want me to use a different name, or should we update the existing one?"
```

---

## Onboarding Paths

Agent should detect user context and offer appropriate path:

```markdown
## First Message Detection

If new user (no packages, no bookings):
  "Welcome! I can help you get set up. Are you:
   1. Starting fresh - I'll guide you through everything
   2. Migrating from another platform - we'll import your services
   3. Just exploring - I'll show you around"

If returning user (has packages):
  "Welcome back! I see you have [X] packages set up.
   What would you like to work on today?"

If Stripe not connected:
  "Before you can accept payments, we'll need to connect your
   Stripe account. Want me to walk you through that?"
```

---

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tool count | 18 (not 43) | Simplicity, MVP focus |
| Context layers | 1 (not 3) | Tools are the refresh mechanism |
| Confirmation model | Trust tiers | Avoid fatigue, appropriate friction |
| Approval enforcement | Server-side | Security - can't be prompt-injected |
| File uploads | Orchestrated | Agent requests URL, user uploads via UI |
| Domains/segments/addons | Deferred | <20% of MVP value |

---

## Implementation Architecture

Recommended: **MCP Server** (separate service)

```
/agent
  /src
    /mcp-server.ts       # MCP protocol handler
    /tools/              # Tool implementations (wrappers)
    /proposals/          # Server-side approval state
    /context/            # Session context builder
    /audit/              # Logging
  /prompts
    /system-prompt.md    # The prompt template
```

Authentication: JWT-based, same as tenant-admin routes.

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Time to first package | <10 minutes | Track from signup to package creation |
| Completion rate | >70% | Users who create ≥1 package |
| Confirmation fatigue | <2 confirms/session avg | Count T3 confirmations |
| Error rate | <5% | Tool call failures |
| Security incidents | 0 | Audit log anomalies |

---

## Review Sign-offs

| Reviewer | Status | Key Concern Addressed |
|----------|--------|----------------------|
| Architecture | ✅ | Conversation history (use sliding window) |
| Security | ✅ | Server-side approval mechanism |
| UX | ✅ | Trust tiers, onboarding paths |
| Agent-Native | ✅ | Primitives, action parity |
| Implementation | ✅ | 84% API coverage |
| Simplicity | ✅ | 58% tool reduction |

