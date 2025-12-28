---
title: 'Growth Assistant Phase 3 & 4: Business Coaching and Dynamic Context Injection'
problem_type: agent-design
component: agent
sub_components:
  - context-builder
  - orchestrator
symptoms:
  - Agent lacked business coaching knowledge for pricing guidance
  - Static context injection did not reflect current tenant packages
  - No pricing framework (Good/Better/Best) in system prompt
  - Marketing quick wins scattered across prompt sections
  - No prompt injection defense for user-controlled package names
  - Packages sorted by creation date instead of price tier
date_solved: 2025-12-28
complexity: medium
tags:
  - growth-assistant
  - agent-context
  - dynamic-injection
  - business-coaching
  - pricing-framework
  - prompt-injection
  - onboarding-hints
  - system-prompt
---

# Growth Assistant Phase 3 & 4: Business Coaching and Dynamic Context Injection

## Problem Statement

The Growth Assistant agent needed enhanced business coaching capabilities and richer context injection to provide actionable pricing and marketing advice. Specifically:

1. **No pricing framework**: Agent lacked the Good/Better/Best three-tier pricing model commonly used by service professionals
2. **Static context**: Agent didn't know tenant's current packages without making tool calls
3. **Scattered advice**: Marketing quick wins were in a separate section from onboarding behavior, causing duplication
4. **Missing sanitization**: Package names (user-controlled) weren't sanitized before prompt injection
5. **Wrong sort order**: Packages sorted by `createdAt` instead of `basePrice`, making tier comparison difficult

## Solution

### Phase 3: System Prompt Enhancement

Added Business Coaching section to `orchestrator.ts` with:

1. **Three-Tier Framework (Good/Better/Best)**:

```markdown
Most service businesses succeed with three price points:

- **Starter/Good:** Entry point. Lets clients test the waters.
- **Core/Better:** Your bread and butter. 60-70% of clients land here.
- **Premium/Best:** High-touch, high-value. For clients who want the works.

**Example for a photographer:**

- Mini Session: $350 (20 min, 5 photos) — headshots, quick updates
- Standard Session: $650 (60 min, 15 photos, wardrobe help) — most popular
- Full Experience: $1,200 (2 hours, 30 photos, styling consult) — weddings, big events
```

2. **Consolidated Onboarding Behavior**: Merged Marketing Quick Wins into Onboarding Behavior section with tactical suggestions:

```markdown
**Packages exist, no bookings:**
Help them share their booking link. Be specific about where to put it.
→ "Drop it in your Instagram bio. One click, they're in."
→ "Add it to your email signature. Every email you send."
```

3. **Reduced Capability Hints**: Kept only non-obvious hints to reduce token usage:

```markdown
- "I can also help you draft responses to client inquiries if you paste them in."
```

### Phase 4: Context Injection

Updated `context-builder.ts` with:

1. **Active Packages Query**:

```typescript
// Active packages for context (max 10, sorted by price for Good/Better/Best display)
prisma.package.findMany({
  where: { tenantId, active: true },
  select: { name: true, slug: true, basePrice: true },
  take: 10,
  orderBy: { basePrice: 'asc' }, // Starter → Premium progression
});
```

2. **Packages Section in Context**:

```typescript
if (packages.length > 0) {
  const packageLines = packages
    .map((p) => {
      const price = `$${(p.basePrice / 100).toFixed(0)}`;
      // Sanitize package name for prompt injection defense
      return `  - ${sanitizeForContext(p.name, 100)}: ${price}`;
    })
    .join('\n');
  packagesSection = `\n**Your Packages:**\n${packageLines}\n`;
}
```

3. **Onboarding Hints**:

```typescript
let onboardingHint = '';
if (!stripeConnected) {
  onboardingHint = '\n**Next Step:** Help them connect Stripe first.';
} else if (packageCount === 0) {
  onboardingHint = '\n**Next Step:** Help them create their first package.';
} else if (totalBookings === 0) {
  onboardingHint = '\n**Next Step:** Help them share their booking link.';
}
```

## Code Review Fixes Applied

| Priority | Fix                                                       | Location                     |
| -------- | --------------------------------------------------------- | ---------------------------- |
| **P2**   | Sanitize package names for prompt injection defense       | context-builder.ts:167       |
| **P3**   | Consolidate Marketing Quick Wins into Onboarding Behavior | orchestrator.ts:57-76        |
| **P3**   | Remove deprecated `detectOnboardingPath()` function       | context-builder.ts, index.ts |
| **P3**   | Sort packages by price instead of createdAt               | context-builder.ts:94        |
| **P3**   | Reduce Capability Hints to non-obvious hints only         | orchestrator.ts:99-102       |

## Files Modified

- `server/src/agent/context/context-builder.ts` - Added packages query, sanitization, sorting
- `server/src/agent/orchestrator/orchestrator.ts` - Added coaching section, consolidated prompts
- `server/src/agent/index.ts` - Updated exports, removed deprecated function

## Agent-Native Principles Applied

| Principle                     | Application                                                   |
| ----------------------------- | ------------------------------------------------------------- |
| **Dynamic Context Injection** | Packages injected at session start, agent knows current state |
| **Guide, Don't Micromanage**  | Three-tier framework is judgment criteria, not rigid rules    |
| **Trust Intelligence**        | Removed pricing psychology section (Claude knows this)        |
| **Features as Prompts**       | Coaching behavior defined in prompt, not code branches        |

## Prevention Strategies

### 1. Always Sanitize User-Controlled Data in Prompts

Even though package names come from authenticated tenant admins, apply defense-in-depth:

```typescript
// Good: Sanitize before prompt injection
return `  - ${sanitizeForContext(p.name, 100)}: ${price}`;

// Bad: Direct interpolation
return `  - ${p.name}: ${price}`;
```

### 2. Consolidate Related Prompt Sections

When system prompts have multiple sections covering similar topics:

- Merge into single section to reduce token usage
- Eliminates risk of contradictory advice
- Easier to maintain

### 3. Remove Deprecated Code During Refactors

Don't leave deprecated functions lingering:

- Remove the function
- Remove from exports
- Clean up imports

### 4. Sort Data for User Mental Models

When displaying pricing tiers, sort by price ascending:

```typescript
orderBy: {
  basePrice: 'asc';
} // Starter → Premium
```

This matches the Good/Better/Best framework users expect.

## Testing

- TypeScript typecheck: PASSED
- Context-builder unit tests: 13/13 PASSED

## Related Documentation

- [Agent Design Prevention Strategies](../AGENT-DESIGN-PREVENTION-STRATEGIES.md)
- [Agent-Native Design Patterns](./AGENT-NATIVE-DESIGN-PATTERNS.md)
- [Growth Assistant Health Check & Stripe Tools](./growth-assistant-health-check-messaging-stripe-tools-MAIS-20251228.md)
- [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)

## Token Impact

| Change                       | Tokens Added    |
| ---------------------------- | --------------- |
| Business Coaching section    | ~120 tokens     |
| Packages in context (10 max) | ~100-150 tokens |
| Onboarding hint              | ~15 tokens      |
| **Total**                    | ~235-285 tokens |

Well within acceptable limits for Claude Sonnet's 200K context window.
