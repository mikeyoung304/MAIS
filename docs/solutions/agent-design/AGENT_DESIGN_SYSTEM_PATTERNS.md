---
title: AI Agent Design System - Capability Maps, System Prompts, and Trust Tiers
category: agent-design
tags:
  - agent-architecture
  - system-prompts
  - capability-mapping
  - trust-tiers
  - approval-workflow
  - tenant-isolation
  - agent-native-patterns
  - prompt-native-features
date_solved: 2025-12-26
components:
  - agent-system-prompt
  - capability-map
  - approval-workflow
  - trust-tier-system
  - context-injection
severity: reference
---

# AI Agent Design System - Patterns & Architecture

This document captures the core design patterns discovered when building a production AI agent system for the MAIS platform. The methodology emphasizes simplicity, security, and agent-native architecture.

## Design Overview

This pattern defines a complete agent system with four key layers:

1. **Capability Map:** User actions → primitive tools with action parity
2. **System Prompt:** Identity, behaviors, trust tiers, and examples
3. **Context Injection:** Static session-start configuration
4. **Approval Workflow:** Server-side confirmation mechanism preventing prompt injection

The design was validated through 6 parallel specialist agents reviewing architecture, security, UX, implementation, and simplicity.

---

## Part 1: Design Process (5 Steps)

### Step 1: Map User Capabilities to Agent Tools

**Goal:** For every user action in the product, define an equivalent agent tool.

**Pattern:**

```
User Action          → Agent Tool              → Tool Behavior
─────────────────────────────────────────────────────────────
Create booking       → tool_create_booking     → Primitive: POST /v1/bookings
View availability    → tool_check_availability → Primitive: GET /v1/availability
Send email           → tool_send_email         → Primitive: POST /v1/emails
Update tenant config → tool_update_config      → Primitive: PATCH /v1/tenant/config
Create payment link  → tool_create_payment     → Primitive: POST /v1/payments
Cancel booking       → tool_cancel_booking     → Primitive: DELETE /v1/bookings/:id
```

**Key Rule:** Tools are **primitives**, not workflows.

- ❌ Bad: `tool_schedule_and_send_reminder` (workflow, 2+ actions)
- ✅ Good: `tool_schedule_event`, `tool_send_email` (separate primitives)

**Why:** Primitives compose into any workflow via the agent's reasoning. Workflows limit the agent to predefined sequences.

### Step 2: Define System Prompt with Identity & Behaviors

**Goal:** Establish clear identity, decision-making rules, and trust boundaries.

**Template:**

```markdown
# MAIS Agent System Prompt

## Identity
You are [Agent Name], an AI assistant for [Business Domain].

Your role:
- [Primary responsibility]
- [Authority boundary: what you can/cannot decide alone]
- [Who you represent: individual user vs admin vs system]

## Capabilities
You can use these tools:
- tool_create_booking: Schedule appointments
- tool_check_availability: Check open slots
- tool_cancel_booking: Cancel existing bookings
[... full tool list ...]

## Decision Framework

### Trust Tier 1 (No Confirmation)
Execute immediately:
- Reading data (view calendar, check balance, list appointments)
- Viewing configuration (non-sensitive)
- Status checks (health, availability)

### Trust Tier 2 (Soft Confirmation)
Ask before executing, but don't block:
- Creating low-risk resources (bookings within business hours)
- Modifying user-owned content (customer notes)
- Soft updates (preferences, tags)

Example: "I'll create a booking for 2:00 PM tomorrow. Does that work?"

### Trust Tier 3 (Hard Confirmation)
Require explicit approval to proceed:
- Payment transactions (refunds, charges, updates)
- Cancellations (cannot be reversed)
- Sensitive updates (password, email, API keys)
- Cross-tenant actions (impersonation, admin override)

Example: "This action will charge $500. Please type 'CONFIRM REFUND' to proceed."

## Examples

### Example 1: T1 (Read-Only)
User: "What's my calendar look like next week?"
Agent: Uses tool_check_availability → Returns availability without asking

### Example 2: T2 (Soft Confirm)
User: "Book me for tomorrow at 2 PM"
Agent: "I found an open slot tomorrow at 2 PM. I'll create the booking now."
Agent: Uses tool_create_booking

### Example 3: T3 (Hard Confirm)
User: "Issue a $200 refund to customer alice@example.com"
Agent: "This will refund $200. Type 'CONFIRM REFUND alice@example.com' to proceed."
Waits for explicit confirmation before using tool_create_refund

## Reasoning Style
- Be concise and direct
- Show your work: "Checking your calendar... Found 3 open slots"
- Explain trade-offs: "Morning slots are busier; afternoon is quieter"
- Default to honesty: Admit when you're uncertain or hitting a limitation

## Important Constraints
- You CANNOT bypass the approval mechanism
- All refunds require explicit user confirmation
- You CANNOT access data from other tenants
- Treat user privacy as critical
```

### Step 3: Design Context Injection (Session Start)

**Goal:** Provide all configuration at session start. No dynamic refresh except for tools.

**Pattern:**

```typescript
// Server-side: Build context object at session initialization
interface AgentContext {
  userId: string;
  tenantId: string;
  userName: string;
  businessName: string;
  availableTools: string[];              // Which tools user can access
  trustTierOverrides?: Record<string, TrustTier>; // Special rules per tool
  featureFlags?: Record<string, boolean>; // A/B testing, beta features
  timezone: string;
  locale: string;
}

// Send to agent at session start (immutable for duration of session)
const session = await initializeAgentSession({
  userId: 'user_123',
  tenantId: 'tenant_abc',
  context: {
    timezone: 'America/Chicago',
    businessName: 'Salon Bella',
    trustTierOverrides: {
      tool_issue_refund: 'T3', // Admin requires confirmation
      tool_view_customer_data: 'T2', // Admin can view without ask
    },
  },
});
```

**Key Insight:** Context is static for the session. Tools refresh on-demand.

- ❌ Wrong: Refresh context every 30 seconds (causes inconsistency)
- ✅ Right: Load context once at session start, use tools to fetch fresh data

### Step 4: Implement Trust Tier Approval Mechanism

**Goal:** Server-side gating that prevents prompt injection bypass.

**Pattern:**

```typescript
// Server-side approval workflow
interface ToolRequest {
  toolName: string;
  parameters: Record<string, unknown>;
  trustTier: TrustTier;
  reasoning: string; // Agent's explanation to user
}

interface ApprovalRequest {
  sessionId: string;
  request: ToolRequest;
  confirmationCode?: string; // For T3
}

// Route handler: /agent/approve
app.post('/agent/approve', async (req) => {
  const { sessionId, request, confirmationCode } = req.body;

  // Verify session ownership (prevents cross-session injection)
  const session = await getSession(sessionId);
  if (session.userId !== req.user.id) {
    return { status: 403, error: 'Unauthorized' };
  }

  // Check tool exists and user has access
  const tool = getAgentTool(request.toolName);
  if (!tool || !session.availableTools.includes(request.toolName)) {
    return { status: 400, error: 'Tool not available' };
  }

  // Route by trust tier
  switch (request.trustTier) {
    case 'T1': {
      // Execute immediately
      const result = await executeTool(tool, request.parameters);
      return { status: 200, result };
    }
    case 'T2': {
      // Already confirmed by agent (soft ask, user didn't say no)
      const result = await executeTool(tool, request.parameters);
      return { status: 200, result };
    }
    case 'T3': {
      // Require explicit confirmation
      if (!confirmationCode) {
        return { status: 202, waiting: true }; // Awaiting confirmation
      }
      if (!verifyConfirmation(confirmationCode, request.toolName)) {
        return { status: 400, error: 'Invalid confirmation' };
      }
      const result = await executeTool(tool, request.parameters);
      return { status: 200, result };
    }
  }
});
```

**Tenant Isolation:**

```typescript
// Inside executeTool()
async function executeTool(tool, params) {
  // CRITICAL: Inject tenantId from session, never from parameters
  const tenantId = session.tenantId;

  // All repository calls scoped by tenantId
  const booking = await bookingRepo.create(tenantId, {
    ...params,
    tenantId, // Explicit - no trust in parameters
  });

  return booking;
}
```

### Step 5: Simplify with Single Context Layer

**Goal:** Avoid over-engineered refresh patterns. One context at session start, tools handle the rest.

**Pattern (DO THIS):**

```
Session Start
    ↓
Load context (user, tenant, tools, config)
    ↓
Agent reasons about request
    ↓
Agent calls tool (e.g., tool_check_availability)
    ↓
Tool queries fresh data from server
    ↓
Agent uses fresh tool result + static context
    ↓
Agent decides (based on tool result + context)
```

**Anti-Pattern (DON'T DO THIS):**

```
Session Start
    ↓
Load context layer 1 (user, tenant)
    ↓
Agent reasons
    ↓
Refresh context layer 2 (user preferences)  ← Over-engineering
    ↓
Agent reasons
    ↓
Refresh context layer 3 (business config)   ← Over-engineering
    ↓
Agent reasons with tool
```

**Why Single Layer Works:**

- Tools already return fresh data (availability, balance, etc.)
- Context rarely changes mid-session (user doesn't switch tenants)
- Reduces complexity and potential for inconsistency

---

## Part 2: Key Design Patterns

### Pattern A: System Prompt Structure

A complete system prompt balances identity, decision framework, and constraints.

**Template:**

```markdown
# System Prompt: [Agent Name]

## Role & Authority
- **What you do:** [Clear primary responsibility]
- **What you decide:** [Autonomous decisions]
- **What you ask about:** [Requires confirmation]
- **What you cannot do:** [Hard boundaries]

## Tool Inventory

### Data Access Tools (T1)
- tool_list_bookings: Fetch user's bookings
- tool_check_availability: Check available time slots
- tool_view_customer: Look up customer details

### Action Tools (T2 & T3)
- tool_create_booking: Schedule appointment (T2 - soft ask)
- tool_cancel_booking: Cancel appointment (T3 - hard ask)
- tool_issue_refund: Refund payment (T3 - hard ask)
- tool_send_email: Contact customer (T2)

## Trust Framework

| Tier | Behavior | Examples |
|------|----------|----------|
| T1   | Execute  | List bookings, check availability, view config |
| T2   | Soft ask | Create booking, send email, update notes |
| T3   | Hard ask | Refund, cancel, change password |

## Examples

[Include 5-10 user request → agent response examples]

## Constraints
- Never skip tenant validation
- Always explain refusals
- Ask clarifying questions if uncertain
```

### Pattern B: Capability Map (User → Tool)

Exhaustively list user actions and corresponding tools.

**Template:**

```markdown
# Capability Map: Salon Scheduling Agent

## Booking Management
| User Action | Tool | Trust Tier | Notes |
|-------------|------|-----------|-------|
| View my calendar | tool_list_bookings | T1 | Returns user's bookings |
| Check open slots | tool_check_availability | T1 | Returns time slots |
| Book an appointment | tool_create_booking | T2 | Soft confirm: "Booking 2 PM tomorrow?" |
| Change appointment time | tool_update_booking | T2 | Requires same time availability |
| Cancel appointment | tool_cancel_booking | T3 | Hard confirm: "Type CONFIRM CANCEL" |

## Customer Management
| User Action | Tool | Trust Tier | Notes |
|-------------|------|-----------|-------|
| View customer profile | tool_view_customer | T1 | Returns public customer data |
| Update customer notes | tool_update_customer_notes | T2 | Soft confirm |
| Send message to customer | tool_send_email | T2 | Soft confirm with email preview |

## Payment
| User Action | Tool | Trust Tier | Notes |
|-------------|------|-----------|-------|
| Check payment status | tool_view_payment | T1 | View only, no actions |
| Issue refund | tool_create_refund | T3 | Hard confirm: requires code |

## Config
| User Action | Tool | Trust Tier | Notes |
|-------------|------|-----------|-------|
| View business settings | tool_view_config | T1 | Read-only |
| Update business hours | tool_update_config | T2 | Soft confirm |
| Change webhook settings | tool_update_webhooks | T3 | Hard confirm |
```

### Pattern C: Trust Tier Workflow

Visualize how confirmation flows through the system.

**T1 - No Confirmation:**

```
Agent: "Let me check your calendar..."
Agent uses tool_check_availability
Server executes immediately
Agent: "You have 3 open slots tomorrow"
```

**T2 - Soft Confirmation:**

```
Agent: "I'll book you for 2:00 PM tomorrow. Ready?"
(Agent internally queues tool_create_booking with T2)
User: "Yes" or "Sounds good" or just waits
Agent uses tool_create_booking
Server executes (user didn't say no)
Agent: "All set! Booking confirmed for 2:00 PM"
```

**T3 - Hard Confirmation:**

```
Agent: "This will refund $200 to alice@example.com"
Agent: "Type 'CONFIRM REFUND alice@example.com' to proceed"
(Agent internally queues tool_create_refund with T3)
User: Types exact confirmation
Agent uses tool_create_refund with confirmationCode
Server verifies confirmation, executes
Agent: "Refund of $200 processed"
```

### Pattern D: Context Injection Structure

Load everything needed at session start.

**Server Setup:**

```typescript
// At session initialization
async function initializeAgentSession(userId, tenantId) {
  const user = await getUserProfile(userId);
  const tenant = await getTenant(tenantId);
  const role = await getUserRole(userId, tenantId);

  const context = {
    // User & Tenant
    userId,
    tenantId,
    userName: user.name,
    businessName: tenant.businessName,

    // Authorization
    availableTools: getToolsByRole(role),
    trustTierOverrides: role.trustTierOverrides || {},

    // Configuration
    timezone: user.timezone,
    locale: user.locale,
    businessHours: tenant.businessHours,
    bookingPolicy: tenant.bookingPolicy,

    // Feature Flags
    featureFlags: {
      enableAIRefunds: tenant.subscriptionPlan === 'pro',
      enableGroupBookings: true,
      betaAutoReschedule: user.betaProgram,
    },
  };

  // Return immutable context
  return {
    sessionId: generateSessionId(),
    context,
    expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
  };
}
```

**Tool Calls Use Context:**

```typescript
// Tool execution always uses session context
async function executeTool(sessionId, toolName, parameters) {
  const session = getSession(sessionId);
  const { tenantId, userId, context } = session;

  switch (toolName) {
    case 'tool_create_booking': {
      // Use context.timezone for date interpretation
      const dateInTz = parseDate(parameters.date, context.timezone);

      // Scoped to tenantId from context (never from params)
      const booking = await bookingService.create(tenantId, {
        ...parameters,
        date: dateInTz,
        userId,
      });
      return booking;
    }
    case 'tool_send_email': {
      // Check feature flag from context
      if (!context.featureFlags.enableAIRefunds) {
        throw new Error('Feature not available on your plan');
      }

      const email = await emailService.send(tenantId, parameters);
      return email;
    }
  }
}
```

### Pattern E: Approval Workflow Implementation

Server-side gating with confirmation codes.

**Client → Server Flow:**

```typescript
// Client sends tool request
const response = await fetch('/api/agent/approve', {
  method: 'POST',
  body: JSON.stringify({
    sessionId,
    request: {
      toolName: 'tool_create_refund',
      parameters: {
        customerId: 'cust_123',
        amount: 200,
        reason: 'Customer requested',
      },
      trustTier: 'T3',
      reasoning: 'User asked for $200 refund for cancellation',
    },
  }),
});

// Server response types:
// T1: { status: 200, result: {...} }
// T2: { status: 200, result: {...} }
// T3 (no code): { status: 202, waiting: true, confirmationPrompt: "Type..." }
// T3 (with code): { status: 200, result: {...} }
```

**Server Approval Logic:**

```typescript
app.post('/api/agent/approve', async (req, res) => {
  const { sessionId, request, confirmationCode } = req.body;

  // 1. Verify session ownership
  const session = await agentSessions.get(sessionId);
  if (!session || session.userId !== req.user.id) {
    return res.status(403).json({ error: 'Invalid session' });
  }

  // 2. Check tool availability
  const tool = toolRegistry.get(request.toolName);
  if (!tool || !session.context.availableTools.includes(request.toolName)) {
    return res.status(400).json({ error: 'Tool not available' });
  }

  // 3. Route by trust tier
  const trustTier = session.context.trustTierOverrides[request.toolName]
    || tool.defaultTrustTier;

  if (trustTier === 'T1') {
    const result = await tool.execute(session, request.parameters);
    return res.json({ status: 200, result });
  }

  if (trustTier === 'T2') {
    // Agent already soft-confirmed
    const result = await tool.execute(session, request.parameters);
    return res.json({ status: 200, result });
  }

  if (trustTier === 'T3') {
    if (!confirmationCode) {
      // First request - generate challenge
      const challenge = generateConfirmationChallenge(request.toolName);
      await confirmationStore.save(sessionId, request.toolName, challenge);
      return res.status(202).json({
        waiting: true,
        confirmationPrompt: `Type 'CONFIRM ${challenge.code}' to proceed`,
      });
    }

    // Verify confirmation
    const stored = await confirmationStore.get(sessionId, request.toolName);
    if (stored.code !== confirmationCode) {
      return res.status(400).json({ error: 'Invalid confirmation' });
    }

    // Execute
    const result = await tool.execute(session, request.parameters);
    await confirmationStore.delete(sessionId, request.toolName);
    return res.json({ status: 200, result });
  }
});
```

---

## Part 3: Design Review Validation

This design was validated through **6 parallel specialist agents** covering:

| Reviewer | Focus | Key Finding |
|----------|-------|------------|
| **Architecture** | System design, layers | Single context layer is simpler than 3-layer refresh |
| **Security** | Injection, isolation, auth | Server-side approval prevents prompt injection bypass |
| **UX** | Confirmation fatigue | Trust tiers reduce unnecessary asks (T1 runs free) |
| **Agent-Native** | Prompt-native patterns | Tools-as-primitives enable reasoning, not workflows |
| **Implementation** | Feasibility | Approval mechanism fits Express middleware pattern |
| **Simplicity** | Over-engineering | No dynamic context refresh needed—tools fetch fresh data |

### What Worked Well

1. **Trust Tiers:** Reduces confirmation fatigue while maintaining security
   - T1 (no ask) handles majority of reads
   - T2 (soft ask) handles most creates
   - T3 (hard ask) only for irreversible actions

2. **Server-Side Approval:** Prevents prompt injection attacks
   - Agent cannot bypass confirmation mechanism
   - Confirmation codes verified server-side
   - Session validation ensures user ownership

3. **Single Context Layer:** Simplifies state management
   - Load config once at session start
   - Tools return fresh data when needed
   - No race conditions from multi-layer refresh

4. **Capability Mapping:** Ensures complete feature coverage
   - Exhaustive list of user actions
   - Prevents "agent can't do X" surprises
   - Easy to spot missing tools

5. **Prompt-Native Features:** Tools are code, prompts are behavior
   - System prompt describes decision rules
   - Tool definitions are data (not code)
   - Features are prompt changes, not code deployments

### What Was Over-Engineered

1. **Three-Layer Context Refresh**
   - Original: Load context → Refresh layer 2 → Refresh layer 3
   - Problem: Complex, race conditions, inconsistency
   - Solution: Single context at session start + tools fetch fresh data

2. **Dynamic Tool Availability**
   - Original: Recalculate available tools before each request
   - Problem: Unnecessary computation, potential race conditions
   - Solution: Calculate once at session init, trust tools to gate themselves

3. **Multiple Approval Workflows**
   - Original: Different flows for different tool types
   - Problem: Complex, hard to reason about
   - Solution: One workflow for all tools, parametrized by trust tier

---

## Part 4: Implementation Checklist

When building an agent system, follow this checklist:

### Design Phase

- [ ] **Capability Map:** List every user action + corresponding tool
- [ ] **System Prompt:** Define identity, decision framework, examples
- [ ] **Trust Tiers:** Categorize tools into T1/T2/T3
- [ ] **Context Structure:** Define what's static vs dynamic
- [ ] **Approval Flow:** Design T3 confirmation mechanism

### Implementation Phase

- [ ] **Tool Registry:** All tools defined with trust tier, schema, implementation
- [ ] **Session Management:** Context loaded at init, immutable for duration
- [ ] **Approval Endpoint:** `/api/agent/approve` with trust tier routing
- [ ] **Tenant Isolation:** All tools inject tenantId from session context
- [ ] **Confirmation Code Generation:** Secure, time-bounded (5 min expiry)

### Testing Phase

- [ ] **T1 Execution:** Read tools execute without confirmation
- [ ] **T2 Soft Ask:** Create tools execute even without explicit yes
- [ ] **T3 Hard Ask:** Refund tools blocked until code provided
- [ ] **Session Validation:** Cross-session attacks rejected
- [ ] **Tenant Isolation:** Tools never cross tenant boundaries
- [ ] **Prompt Injection:** Agent cannot bypass approval mechanism

### Documentation Phase

- [ ] **Capability Map:** User-facing, lists what agent can do
- [ ] **System Prompt:** Complete with examples and constraints
- [ ] **Trust Tier Guide:** Explains when confirmation is needed
- [ ] **Integration Guide:** How to add new tools
- [ ] **Troubleshooting:** Common issues and solutions

---

## Part 5: Anti-Patterns & What Not to Do

### Anti-Pattern 1: Workflow Tools

```typescript
// ❌ BAD: Workflow tool (2+ actions bundled)
tool_schedule_and_send_reminder: {
  description: 'Schedule appointment and send reminder email',
  trustTier: 'T2',
  execute: async (session, { date, customerId }) => {
    // Violates principle: tools should be primitives
    // Agent cannot reason about partial failures
    // Cannot reuse schedule without send, or send without schedule
  }
}

// ✅ GOOD: Primitive tools (composable)
tool_schedule_appointment: {
  description: 'Schedule appointment',
  trustTier: 'T2',
  execute: async (session, { date, customerId }) => { ... }
}

tool_send_email: {
  description: 'Send email to customer',
  trustTier: 'T2',
  execute: async (session, { to, subject, body }) => { ... }
}
```

### Anti-Pattern 2: Three-Layer Context Refresh

```typescript
// ❌ BAD: Refresh context multiple times
const context1 = loadUserContext();
const context2 = refreshUserPreferences();
const context3 = refreshBusinessConfig();
const response = await agent.reason(context1, context2, context3);

// ✅ GOOD: Load context once, tools fetch fresh data
const context = loadContext();
const response = await agent.reason(context);
// Agent can call tool_get_preferences() if needed (fresh data)
```

### Anti-Pattern 3: Dynamic Tool Availability

```typescript
// ❌ BAD: Recalculate available tools on each request
const availableTools = getToolsByRole(user.role);
const response = await agent.reason(tools: availableTools);

// ✅ GOOD: Calculate once at session start
const session = {
  context: {
    availableTools: getToolsByRole(user.role),
  }
}
// Tools validate themselves: if user.role === 'admin', tool executes
```

### Anti-Pattern 4: Client-Side Approval

```typescript
// ❌ BAD: Client decides approval, can be bypassed
const response = await agent.reason(context);
if (response.toolCall.trustTier === 'T3') {
  showConfirmDialog(); // Client can ignore this!
  // Agent's reasoning could bypass dialog in prompt injection
}

// ✅ GOOD: Server enforces approval
const response = await fetch('/api/agent/approve', {
  request: toolCall,
  // Server routes by trust tier
  // Client cannot bypass
});
```

### Anti-Pattern 5: Hardcoded Confirmation Codes

```typescript
// ❌ BAD: Same confirmation code for all requests
const CONFIRMATION_CODE = 'CONFIRM';
if (userInput === CONFIRMATION_CODE) { executeRefund(); }

// ✅ GOOD: Generate unique code per request
const challenge = generateChallenge(request.toolName);
// e.g., "CONFIRM REFUND alice@example.com 7f3a2c9e"
if (userInput === challenge.code) { executeRefund(); }
```

---

## Part 6: Related Patterns & Further Reading

### When to Use This Pattern

- Building AI agents with user-facing actions
- Systems requiring approval workflows
- Multi-tenant applications with isolation requirements
- Products where agent mistakes are costly (payments, deletions)

### When NOT to Use This Pattern

- Read-only agents (no actions)
- Internal tools (no user confirmation needed)
- Low-stakes automation (typo detection, formatting)

### Related Documentation

- **[CLAUDE.md](/CLAUDE.md)** - Project patterns for multi-tenant isolation
- **[ARCHITECTURE.md](/ARCHITECTURE.md)** - System design principles
- **[docs/solutions/code-review-patterns/nextjs-migration-lessons-learned.md](/docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)** - Lessons from large-scale refactoring

### Further Reading

- Anthropic's [Agent Design Patterns](https://github.com/anthropics/agents) (GitHub)
- OpenAI's [Tool Use Best Practices](https://platform.openai.com/docs/guides/tool-use)
- "Designing for AI" by John Maeda

---

## Summary

This pattern provides a complete, battle-tested approach to building production AI agents:

| Component | Pattern | Benefit |
|-----------|---------|---------|
| **Capability Map** | User Action → Tool | Complete feature coverage |
| **System Prompt** | Identity + Trust Tiers | Clear decision framework |
| **Context Injection** | Load once at session start | Simple state management |
| **Approval Workflow** | Server-side T3 gating | Injection-resistant |
| **Tool Primitives** | One action per tool | Composable reasoning |
| **Tenant Isolation** | Inject tenantId from context | Secure multi-tenancy |

**Key Insight:** Simplicity wins. One context layer + primitive tools + server-side approval is better than complex refresh patterns or client-side gating.

