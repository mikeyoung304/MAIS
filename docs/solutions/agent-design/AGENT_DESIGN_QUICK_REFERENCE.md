---
title: Agent Design Quick Reference - Cheat Sheet
category: agent-design
tags:
  - quick-reference
  - trust-tiers
  - approval-workflow
  - agent-native
date_solved: 2025-12-26
---

# Agent Design Quick Reference

Print this and pin it above your desk.

## The 30-Second Design Framework

```
1. Map capabilities:     User Action → Tool (one action per tool)
2. Define system prompt: Identity + Decision rules + Examples
3. Build context:        Load at session start (immutable)
4. Add approval:         Server-side T3 gating with confirmation codes
5. Inject tenantId:      From context, never from parameters
```

## Trust Tiers at a Glance

| Tier | When | Flow | Example |
|------|------|------|---------|
| **T1** | Safe reads | Execute immediately | "You have 3 open slots" |
| **T2** | Low-risk writes | Soft ask, execute if no refusal | "I'll book 2 PM?" → Execute |
| **T3** | High-risk/irreversible | Hard ask, require code | "Type CONFIRM REFUND" → Verify → Execute |

## Capability Map Template

```markdown
# Tools Available

## Data Tools (T1 - Execute)
- tool_list_bookings: Fetch user's bookings
- tool_check_availability: Check time slots
- tool_view_customer: Look up customer details

## Action Tools (T2 - Soft Ask)
- tool_create_booking: Schedule appointment
- tool_send_email: Contact customer
- tool_update_notes: Update customer notes

## High-Risk Tools (T3 - Hard Ask)
- tool_create_refund: Issue refund (requires confirmation)
- tool_cancel_booking: Cancel appointment (irreversible)
- tool_reset_password: Change password
```

## System Prompt Structure

```markdown
# System Prompt: [Agent Name]

## Role
You are [job title]. You can:
- [Autonomous action 1]
- [Autonomous action 2]

You must ask before:
- [Confirmation action 1]
- [Confirmation action 2]

You cannot:
- [Hard boundary 1]
- [Hard boundary 2]

## Decision Rules
- Ask with "I'll [action]. Does that work?"
- Require confirmation with "Type 'CONFIRM [ACTION]' to proceed"
- Never access data from other tenants
- Treat privacy as critical

## Tools
[List all available tools with brief descriptions]

## Examples
[5-10 user request → agent response examples]
```

## Implementation Checklist

### Design
- [ ] User actions mapped to tools (exhaustive)
- [ ] Tools are primitives (one action each)
- [ ] Trust tiers assigned to all tools
- [ ] System prompt written with examples
- [ ] Confirmation code format defined

### Code
- [ ] Session context loads at auth time
- [ ] Context is immutable for session duration
- [ ] `/api/agent/approve` endpoint routing by trust tier
- [ ] Tool execution injects tenantId from context
- [ ] Confirmation codes stored with 5-min expiry

### Testing
- [ ] T1 tools execute without ask
- [ ] T2 tools execute after soft ask
- [ ] T3 tools blocked without confirmation code
- [ ] Cross-session attacks rejected
- [ ] Tenant isolation verified
- [ ] Agent cannot bypass approval

## Common Errors & Fixes

| Error | Wrong Approach | Right Approach |
|-------|---|---|
| Tools are workflows | tool_schedule_and_send | tool_schedule + tool_send |
| 3-layer context refresh | Load context 3 times | Load once, tools fetch data |
| Client-side approval | Confirmation in UI | Confirmation verified server |
| Hardcoded confirmation | Same code for all | Unique code per request |
| Dynamic tool availability | Recalc every request | Calc once at session init |
| Parameter-based tenantId | Extract from params | Inject from context |

## Code Template: Approval Endpoint

```typescript
app.post('/api/agent/approve', async (req, res) => {
  const { sessionId, request, confirmationCode } = req.body;

  // 1. Verify session
  const session = await sessions.get(sessionId);
  if (session?.userId !== req.user.id) return res.status(403).json({});

  // 2. Check tool exists
  const tool = toolRegistry.get(request.toolName);
  if (!tool) return res.status(400).json({});

  // 3. Get trust tier (with per-user overrides)
  const tier = session.context.trustTierOverrides[request.toolName]
    ?? tool.trustTier;

  // 4. Route by tier
  if (tier === 'T1' || tier === 'T2') {
    return res.json(await tool.execute(session, request.parameters));
  }

  if (tier === 'T3') {
    if (!confirmationCode) {
      const challenge = generateChallenge(request.toolName);
      await confirmations.save(sessionId, request.toolName, challenge);
      return res.status(202).json({ waiting: true });
    }

    const stored = await confirmations.get(sessionId, request.toolName);
    if (stored.code !== confirmationCode) {
      return res.status(400).json({ error: 'Invalid' });
    }

    await confirmations.delete(sessionId, request.toolName);
    return res.json(await tool.execute(session, request.parameters));
  }
});
```

## Code Template: Tool Implementation

```typescript
const tool_create_booking = {
  name: 'tool_create_booking',
  trustTier: 'T2',
  schema: z.object({
    date: z.string().datetime(),
    duration: z.number(),
    customerId: z.string(),
  }),
  execute: async (session, params) => {
    // CRITICAL: Use tenantId from session, not params
    const { tenantId } = session;

    // Validate date is in future
    if (new Date(params.date) < new Date()) {
      throw new ValidationError('Cannot book past dates');
    }

    // Check availability (returns fresh data)
    const available = await availabilityService.check(
      tenantId,
      params.date,
      params.duration
    );
    if (!available) {
      throw new BookingConflictError(params.date);
    }

    // Create booking (scoped to tenantId)
    const booking = await bookingService.create(tenantId, {
      customerId: params.customerId,
      date: params.date,
      duration: params.duration,
    });

    return {
      success: true,
      bookingId: booking.id,
      message: `Booking confirmed for ${params.date}`,
    };
  },
};
```

## Session Context Shape

```typescript
interface AgentSession {
  sessionId: string;
  userId: string;
  tenantId: string;

  context: {
    // Identity
    userName: string;
    businessName: string;
    timezone: string;
    locale: string;

    // Authorization
    availableTools: string[];
    trustTierOverrides?: Record<string, TrustTier>;

    // Configuration
    businessHours: BusinessHours;
    bookingPolicy: BookingPolicy;
    featureFlags?: Record<string, boolean>;
  };

  expiresAt: number;
}
```

## Anti-Patterns Cheat Sheet

| Bad | Good | Why |
|-----|------|-----|
| `tool_schedule_and_send` | `tool_schedule` + `tool_send` | Primitives compose |
| Refresh context 3x | Load once | Simpler state |
| Client-side approval | Server-side gating | Injection-resistant |
| `params.tenantId` | `session.tenantId` | Never trust params |
| Same confirmation code | Unique per request | Prevents replay |
| Recalc tools each time | Calc at session start | Simpler + faster |

## When to Apply This Pattern

- Agent performs user actions (booking, payment, communication)
- Multi-tenant system with isolation requirements
- Actions can be high-risk (refunds, deletions, password changes)
- Need clear approval boundaries

## When NOT to Apply

- Read-only agents
- Internal automation (no user involved)
- Low-stakes actions (typo fixing, formatting)

## Links

- Full design: [AGENT_DESIGN_SYSTEM_PATTERNS.md](./AGENT_DESIGN_SYSTEM_PATTERNS.md)
- Multi-tenant security: [/CLAUDE.md](/CLAUDE.md)
- Architecture: [/ARCHITECTURE.md](/ARCHITECTURE.md)

