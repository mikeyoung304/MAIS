# MAIS Agent - Agent-Native Architecture Analysis

> Analysis conducted using the `agent-native-architecture` skill principles.
> Date: 2025-12-28

## Executive Summary

The MAIS Business Growth Assistant is a **well-architected agent** with several strengths, but has room for improvement against agent-native principles. Overall score: **7/10** - Good foundation, needs refinement.

| Category          | Score | Status                                    |
| ----------------- | ----- | ----------------------------------------- |
| Tool Design       | 6/10  | Tools encode some workflow logic          |
| Action Parity     | 5/10  | Several UI actions lack agent equivalents |
| Context Injection | 7/10  | Good static injection, missing refresh    |
| CRUD Completeness | 6/10  | Some entities missing operations          |
| Security          | 9/10  | Excellent trust tier + proposal system    |
| Brand Voice       | 9/10  | Strong HANDLED personality                |

---

## What MAIS Does Well

### 1. Trust Tier System (Excellent)

The T1/T2/T3 approval mechanism is a best-practice pattern:

```typescript
// T1: Auto-confirmed (blackouts, branding, uploads)
// T2: Soft confirm (package changes, pricing)
// T3: Hard confirm (cancellations, refunds, deletes)
```

This provides appropriate guardrails without artificially limiting the agent.

### 2. Server-Side Proposal Mechanism (Excellent)

Write operations create server-side proposals, preventing prompt injection attacks:

```typescript
// Agent can't bypass approval by crafting prompts
const proposal = await proposalService.createProposal({
  tenantId,
  sessionId,
  toolName,
  operation,
  trustTier,
  payload,
  preview,
});
```

### 3. Tenant Isolation (Excellent)

All operations properly scoped by `tenantId` from JWT:

```typescript
// Every tool enforces tenant scoping
const packages = await prisma.package.findMany({ where: { tenantId } });
```

### 4. Dynamic Context Injection (Good)

Builds business context at session start:

```typescript
// Context includes: business name, Stripe status, packages, stats
const contextPrompt = buildContextPrompt({ businessName, stripeConnected, ... });
```

### 5. Onboarding Detection (Good)

Smart greeting based on user's progress:

```typescript
function detectOnboardingState(context): OnboardingState {
  if (!stripeConnected) return 'needs_stripe';
  if (packageCount === 0) return 'needs_packages';
  // ...
}
```

### 6. Brand Voice Consistency (Excellent)

System prompt maintains HANDLED personality:

```
- Be cheeky but professional
- Anti-hype: No "revolutionary," "cutting-edge"
- "Want to knock this out?" not "Would you like me to assist?"
```

---

## Improvement Areas

### Issue 1: Tools Encode Workflow Logic

**Problem:** Some tools contain business logic that should be in the prompt.

**Current (Anti-pattern):**

```typescript
// write-tools.ts:70-83
function isSignificantPriceChange(oldPriceCents: number, newPriceCents: number): boolean {
  const absoluteChange = Math.abs(newPriceCents - oldPriceCents);
  const relativeChange = (absoluteChange / oldPriceCents) * 100;
  return relativeChange > 20 || absoluteChange > 10000;
}
```

**Recommendation:** Move decision logic to system prompt:

```markdown
## Price Change Guidelines

When updating package prices:

- Changes over 20% or $100 require explicit confirmation (T3)
- Always explain the change: "This raises Wedding Day from $2,000 to $2,500 (+25%)"
- Ask for confirmation before large increases
```

**Impact:** Medium. Current approach works but limits prompt-based iteration.

---

### Issue 2: Incomplete Action Parity

**Problem:** Several UI actions have no agent equivalent.

| UI Action       | Location           | Agent Tool            | Status  |
| --------------- | ------------------ | --------------------- | ------- |
| Update branding | /tenant/branding   | None                  | Missing |
| Manage add-ons  | /tenant/packages   | None                  | Missing |
| Customer notes  | (planned)          | None                  | Missing |
| Blackout dates  | /tenant/scheduling | None                  | Missing |
| View customers  | /tenant/customers  | None                  | Missing |
| Manage segments | /tenant/packages   | None                  | Missing |
| Domain config   | /tenant/domains    | None                  | Missing |
| Page editor     | /tenant/pages      | `update_landing_page` | Partial |

**Recommendation:** Add missing tools following CRUD pattern:

```typescript
// Priority 1: Customer tools (high user value)
get_customers; // Read customer list with booking history
add_customer_note; // Add notes about clients

// Priority 2: Scheduling tools
get_blackout_dates;
add_blackout_date;
remove_blackout_date;

// Priority 3: Catalog management
get_addons;
upsert_addon;
delete_addon;
```

**Impact:** High. Users will ask "show me my customers" or "block off next Tuesday."

---

### Issue 3: Missing Context Refresh

**Problem:** Context only injected at session start. Long sessions get stale.

**Current:**

```typescript
// Context built once at session creation
const context = await buildSessionContext(prisma, tenantId, sessionId);
```

**Recommendation:** Add a `refresh_context` tool:

```typescript
export const refreshContextTool: AgentTool = {
  name: 'refresh_context',
  description:
    'Get current business state. Use when you need fresh data on packages, bookings, or stats.',
  inputSchema: { type: 'object', properties: {}, required: [] },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const freshContext = await buildSessionContext(
      context.prisma,
      context.tenantId,
      context.sessionId
    );
    return {
      success: true,
      data: {
        stripeConnected: freshContext.quickStats.stripeConnected,
        packageCount: freshContext.quickStats.packageCount,
        upcomingBookings: freshContext.quickStats.upcomingBookings,
        revenueThisMonth: freshContext.quickStats.revenueThisMonth,
        // Include package names for quick reference
        packages: freshContext.contextPrompt.match(/- .+/g) || [],
      },
    };
  },
};
```

**Impact:** Medium. Helps long sessions stay accurate.

---

### Issue 4: Incomplete CRUD Coverage

**Problem:** Some entities missing create/read/update/delete operations.

| Entity       | Create | Read | Update | Delete      |
| ------------ | ------ | ---- | ------ | ----------- |
| Package      | ✅     | ✅   | ✅     | ✅          |
| Booking      | ✅     | ✅   | ❌     | ✅ (cancel) |
| Customer     | ❌     | ❌   | ❌     | ❌          |
| Add-on       | ❌     | ❌   | ❌     | ❌          |
| Blackout     | ❌     | ❌   | ❌     | ❌          |
| Landing Page | ❌     | ✅   | ✅     | ❌          |

**Recommendation:** Prioritize based on user requests:

1. **Customers** (P1): Users will ask about their clients
2. **Blackouts** (P1): Scheduling is core to booking flow
3. **Add-ons** (P2): Part of pricing strategy coaching
4. **Booking updates** (P2): Reschedule requests

---

### Issue 5: Capability Vocabulary Gaps

**Problem:** System prompt doesn't fully explain domain vocabulary.

**Current gaps:**

| User Says       | Agent Should Know        | Current Status |
| --------------- | ------------------------ | -------------- |
| "my storefront" | = landing page           | Not explained  |
| "sessions"      | = time-based packages    | Not explained  |
| "deposit"       | = depositPercent setting | Not explained  |
| "balance due"   | = balanceDueDays setting | Not explained  |

**Recommendation:** Add vocabulary section to system prompt:

```markdown
## Vocabulary

When users say...

- "storefront" or "my website" → they mean their landing page at /t/{slug}
- "sessions" or "appointments" → they mean their packages
- "deposit" → they mean the upfront percentage (depositPercent)
- "balance due" → they mean days before event to collect remainder
```

---

### Issue 6: Missing Capability Hints

**Problem:** Agent doesn't proactively tell users what it can do.

**Recommendation:** Expand capability hints in system prompt:

```markdown
## Capability Hints

When appropriate, mention what you can help with:

- "I can also update your package descriptions if you paste them here."
- "Want me to check your upcoming bookings?"
- "I can help you set up a new package tier."

When users ask about something you CAN'T do:

- "I can't directly connect your Instagram, but I can help you craft the bio text."
- "I can't send emails to your clients, but I can draft the message."
```

---

## Recommended Priority Order

### P0 - Quick Wins (1-2 hours each)

1. **Add `refresh_context` tool** - Simple, high value for long sessions
2. **Add vocabulary section** to system prompt
3. **Expand capability hints** in system prompt

### P1 - High Value (2-4 hours each)

4. **Add customer tools** (`get_customers`) - Users will definitely ask
5. **Add blackout tools** (`get_blackout_dates`, `add_blackout_date`) - Core scheduling
6. **Add booking update** (`update_booking`) - Reschedule requests

### P2 - Complete Coverage (4-8 hours)

7. **Add add-on tools** - Part of pricing coaching
8. **Add segment tools** - Advanced catalog management
9. **Move price change logic to prompt** - Better iteration

### P3 - Polish (Future)

10. **Add domain configuration tools**
11. **Add branding/color tools**
12. **Add page section management tools**

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIS Agent Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   Frontend  │────▶│  API Proxy  │────▶│ Orchestrator│   │
│  │  AgentChat  │     │ /api/agent  │     │   Claude    │   │
│  └─────────────┘     └─────────────┘     └──────┬──────┘   │
│                                                  │          │
│                                           ┌──────▼──────┐   │
│                                           │   Tools     │   │
│                                           ├─────────────┤   │
│                                           │ READ TOOLS  │   │
│                                           │ - get_tenant│   │
│                                           │ - get_dashboard   │
│                                           │ - get_packages    │
│                                           │ - get_bookings    │
│                                           │ - get_landing_page│
│                                           ├─────────────┤   │
│                                           │ WRITE TOOLS │   │
│                                           │ (via Proposals)   │
│                                           │ - upsert_package  │
│                                           │ - delete_package  │
│                                           │ - create_booking  │
│                                           │ - cancel_booking  │
│                                           │ - update_landing  │
│                                           └──────┬──────┘   │
│                                                  │          │
│  ┌─────────────┐     ┌─────────────┐     ┌──────▼──────┐   │
│  │  Proposal   │◀────│   Audit     │◀────│   Prisma    │   │
│  │  Service    │     │  Service    │     │  (Postgres) │   │
│  │  T1/T2/T3   │     │  Logging    │     │             │   │
│  └─────────────┘     └─────────────┘     └─────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Agent-Native Success Criteria Checklist

### Core Prompt-Native Criteria

- [x] Agent figures out HOW to achieve outcomes ✅
- [x] Whatever a user could do, agent can do (with some gaps)
- [x] Features are prompts that define outcomes ✅
- [ ] Tools are pure primitives (some have logic)
- [x] Behavior changed by editing prose ✅
- [x] Agent can surprise with clever approaches ✅

### Tool Design Criteria

- [ ] External APIs use Dynamic Capability Discovery (N/A)
- [ ] Every entity has full CRUD (gaps exist)
- [x] API validates inputs, not enums ✅
- [x] Tools don't encode workflow logic (mostly)

### Agent-Native Criteria

- [x] System prompt includes dynamic context ✅
- [ ] Every UI action has agent tool (gaps exist)
- [x] Tools documented in system prompt ✅
- [x] Agent and user work in same data space ✅
- [x] Agent actions reflected in UI immediately ✅
- [ ] "Write something to X" test passes (not all locations)
- [ ] Users can discover capabilities (limited hints)
- [ ] Context refreshes for long sessions (missing tool)

---

## Conclusion

The MAIS Business Growth Assistant has a **solid foundation** with excellent security patterns (trust tiers, proposals, tenant isolation) and good brand voice. The main gaps are:

1. **Action parity** - Add tools for customers, blackouts, add-ons
2. **Context refresh** - Add a refresh tool for long sessions
3. **Vocabulary** - Explain domain terms in system prompt
4. **Capability hints** - Help users discover what agent can do

Addressing P0 quick wins would bring the score from **7/10 to 8/10**. Full P1 implementation would achieve **9/10**.

---

## Related Documentation

- `server/src/agent/` - Agent implementation
- `docs/solutions/agent-design/` - Agent design decisions
- `~/.claude/plugins/.../agent-native-architecture/` - Skill reference
