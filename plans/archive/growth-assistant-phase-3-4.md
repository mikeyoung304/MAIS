# Growth Assistant Phase 3 & 4 Implementation Plan (Revised)

> **Status**: Ready for Implementation
> **Created**: 2025-12-28
> **Revised**: 2025-12-28 (Post-review, agent-native aligned)
> **Phases**: 1-2 Complete, 3-4 In This Plan
> **Estimated Changes**: ~80 lines across 2 files (down from 150)

---

## Review Summary

This plan was reviewed by 3 agents and revised based on:

- **DHH**: "Ship it, but simplify" - Cut YAGNI items
- **Kieran**: Critical TypeScript fixes required
- **Simplicity**: Significant scope reduction possible
- **Agent-Native Architecture**: Validated approach with principles

### What Changed

| Original                            | Revised           | Reason                                         |
| ----------------------------------- | ----------------- | ---------------------------------------------- |
| ~150 lines                          | ~80 lines         | Cut redundant sections                         |
| Pricing psychology section          | Removed           | Claude already knows this (trust intelligence) |
| Capability hints section            | Removed           | Duplicates tool descriptions                   |
| Two examples (photographer + coach) | One example       | Sufficient for generalization                  |
| Raw arrays in interface             | Removed           | YAGNI - contextPrompt is sufficient            |
| recentBookings query                | Removed           | Unproven value, add later if needed            |
| `Package.title`                     | `Package.name`    | TypeScript fix                                 |
| `customerName` field                | Customer relation | TypeScript fix                                 |

---

## Phase 3: Enhance System Prompt

**Goal:** Agent provides actionable business coaching for pricing and marketing

**File:** `server/src/agent/orchestrator/orchestrator.ts`

**Changes:** Insert after line 71 (after "Active business:")

```typescript
---

## Business Coaching

### Three-Tier Framework (Good/Better/Best)

Most service businesses succeed with three price points:

- **Starter/Good:** Entry point. Lets clients test the waters.
- **Core/Better:** Your bread and butter. 60-70% of clients land here.
- **Premium/Best:** High-touch, high-value. For clients who want the works.

**Example for a photographer:**
- Mini Session: $350 (20 min, 5 photos) — headshots, quick updates
- Standard Session: $650 (60 min, 15 photos, wardrobe help) — most popular
- Full Experience: $1,200 (2 hours, 30 photos, styling consult) — weddings, big events

When helping with pricing, explain your reasoning: "I'd price this at $X because..."

### Marketing Quick Wins

Match your suggestion to where they are:

**Just connected Stripe:**
→ "First, let's get your packages set up. What do you offer?"

**Has packages, no bookings:**
→ "Your booking link goes in your Instagram bio. One click, they're in."

**Getting bookings but wants more:**
→ "Add your booking link to your email signature. Every email you send."
→ "After a great session, ask: 'Know anyone else who'd want this?'"

Don't overwhelm — suggest ONE thing at a time based on where they are.
```

**Token impact:** +150 tokens (down from +200)

---

## Phase 4: Improve Context Injection

**Goal:** Agent has richer context without tool calls

**File:** `server/src/agent/context/context-builder.ts`

### 4.1 Add Packages Query (lines 70-88)

Update the `Promise.all` to include packages:

```typescript
const [
  packageCount,
  totalBookings,
  upcomingBookings,
  revenueThisMonth,
  // NEW: Active packages for context
  activePackages,
] = await Promise.all([
  prisma.package.count({ where: { tenantId } }),
  prisma.booking.count({ where: { tenantId } }),
  prisma.booking.count({
    where: {
      tenantId,
      date: { gte: now, lte: next30Days },
      status: { notIn: ['CANCELED', 'REFUNDED'] },
    },
  }),
  prisma.booking.aggregate({
    where: {
      tenantId,
      createdAt: { gte: thisMonthStart },
      status: { in: ['PAID', 'CONFIRMED', 'FULFILLED'] },
    },
    _sum: { totalPrice: true },
  }),
  // NEW: Get active packages (max 10)
  prisma.package.findMany({
    where: { tenantId, active: true },
    select: { name: true, slug: true, basePrice: true }, // Note: 'name' not 'title'
    take: 10,
    orderBy: { createdAt: 'desc' },
  }),
]);
```

### 4.2 Update buildContextPrompt Signature

```typescript
function buildContextPrompt(data: {
  businessName: string;
  businessSlug: string;
  stripeConnected: boolean;
  packageCount: number;
  upcomingBookings: number;
  totalBookings: number;
  revenueThisMonth: number;
  // NEW
  packages: Array<{ name: string; slug: string; basePrice: number }>;
}): string {
```

### 4.3 Update buildContextPrompt Body

Add packages section after Quick Stats:

```typescript
// Build packages section (only if they have packages)
let packagesSection = '';
if (packages.length > 0) {
  const packageLines = packages
    .map((p) => {
      const price = `$${(p.basePrice / 100).toFixed(0)}`;
      return `  - ${p.name}: ${price}`;
    })
    .join('\n');
  packagesSection = `\n**Your Packages:**\n${packageLines}\n`;
}

// Build onboarding hint
let onboardingHint = '';
if (!stripeConnected) {
  onboardingHint = '\n**Next Step:** Help them connect Stripe first.';
} else if (packageCount === 0) {
  onboardingHint = '\n**Next Step:** Help them create their first package.';
} else if (totalBookings === 0) {
  onboardingHint = '\n**Next Step:** Help them share their booking link.';
}

return `## Your Business Context

You are helping **${businessName}** (${businessSlug}).

**Setup:**
- Stripe: ${stripeConnected ? 'Ready for payments' : 'Not connected'}
- Packages: ${packageCount} configured
- Upcoming: ${upcomingBookings} booking${upcomingBookings !== 1 ? 's' : ''} in next 30 days

**Quick Stats:**
- Total bookings: ${totalBookings}
- This month: ${revenueFormatted}
${packagesSection}${onboardingHint}

For current details, use your read tools.`;
```

### 4.4 Pass Packages to buildContextPrompt

Update the call in `buildSessionContext`:

```typescript
const contextPrompt = buildContextPrompt({
  businessName: sanitizeForContext(tenant.name, 100),
  businessSlug: tenant.slug,
  stripeConnected: tenant.stripeOnboarded,
  packageCount,
  upcomingBookings,
  totalBookings,
  revenueThisMonth: revenueThisMonth._sum?.totalPrice ?? 0,
  // NEW
  packages: activePackages,
});
```

**Token impact:** +100-150 tokens (packages section)

---

## What We're NOT Doing (Intentionally)

Based on reviewer feedback and agent-native principles:

| Skipped                       | Reason                              |
| ----------------------------- | ----------------------------------- |
| `packages` array in interface | YAGNI - contextPrompt is sufficient |
| `recentBookings` query        | Unproven value, add later if needed |
| `onboardingState` enum        | Derivable from quickStats in prompt |
| Pricing psychology section    | Claude already knows this           |
| Capability hints section      | Duplicates tool descriptions        |
| Status icons (✓/✗/○)          | Adds complexity, words are clearer  |

---

## Test Plan

### Manual Testing

| Test                      | Action                            | Expected                        |
| ------------------------- | --------------------------------- | ------------------------------- |
| Pricing guidance          | Ask "help me with pricing"        | Agent uses three-tier framework |
| Marketing (new user)      | New user: "how do I get clients?" | Suggests Instagram bio link     |
| Marketing (established)   | User with bookings asks same      | Suggests email signature        |
| Context includes packages | Any message                       | Agent knows package names       |

### Typecheck

```bash
npm run typecheck
```

---

## Implementation Checklist

```markdown
## Phase 3: Enhance System Prompt

- [ ] Add Business Coaching section after line 71
  - [ ] Three-tier framework with photographer example
  - [ ] State-aware marketing quick wins
- [ ] Run typecheck

## Phase 4: Improve Context Injection

- [ ] Add activePackages query to Promise.all
- [ ] Update buildContextPrompt signature (add packages param)
- [ ] Add packages section to context prompt
- [ ] Add onboarding hint based on stats
- [ ] Pass packages to buildContextPrompt call
- [ ] Run typecheck

## Verification

- [ ] npm run typecheck passes
- [ ] npm test passes
- [ ] Manual test: pricing guidance
- [ ] Manual test: context includes packages
```

---

## Files to Modify

| File                                            | Lines Changed | Purpose                 |
| ----------------------------------------------- | ------------- | ----------------------- |
| `server/src/agent/orchestrator/orchestrator.ts` | +30           | Add coaching section    |
| `server/src/agent/context/context-builder.ts`   | +50           | Add packages to context |

---

## Agent-Native Architecture Alignment

This plan follows agent-native principles:

- **Dynamic Context Injection:** Packages in context = agent knows what exists NOW
- **Guide, Don't Micromanage:** Three-tier framework is judgment criteria, not rules
- **Trust Intelligence:** Removed pricing psychology (Claude knows this)
- **Features as Prompts:** Coaching behavior defined in prompt, not code

---

## References

### Internal

- `server/src/agent/orchestrator/orchestrator.ts:39-139` - Current system prompt
- `server/src/agent/context/context-builder.ts:43-119` - Current context builder

### Skills Applied

- `agent-native-architecture` - Dynamic context injection, system prompt design
- HANDLED `BRAND_VOICE_GUIDE.md` - Anti-hype, specific, actionable

### Reviewers

- DHH: "Ship it, but simplify"
- Kieran: TypeScript fixes (name vs title, customer relation)
- Simplicity: Cut ~50% scope
