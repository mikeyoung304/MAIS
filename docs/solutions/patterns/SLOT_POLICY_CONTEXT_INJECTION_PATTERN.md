# Slot-Policy Context Injection Pattern

> **Date:** 2026-02-01
> **Problem:** Agent asks "What do you do?" repeatedly when it already knows the answer
> **Solution:** Inject `forbiddenSlots[]` at session creation, agent checks keys not phrases

---

## The Problem

The tenant agent kept asking "What do you do?" even after the user answered. Root cause analysis revealed:

1. Context builder fetched data but didn't inject it into session state
2. Agent relied on calling `get_known_facts` tool each turn (unreliable - LLMs don't follow instructions)
3. System prompt used phrase-matching for forbidden questions (fragile)

**The P0 bug was at `vertex-agent.service.ts:265`:**

```typescript
// BEFORE (broken)
body: JSON.stringify({ state: { tenantId } }); // No context!
```

---

## The Solution

### 1. Slot-Policy (Not Phrase-Matching)

**Wrong approach:** Match phrases like "What do you do?"

```typescript
// FRAGILE - Can be bypassed by rephrasing
forbiddenQuestions: ['What do you do?', 'What type of business...'];
```

**Right approach:** Check slot keys that have values

```typescript
// ROBUST - Cannot be bypassed
forbiddenSlots: ['businessType', 'location']; // Keys, not phrases
```

### 2. Context Injection at Session Creation

```typescript
// server/src/services/vertex-agent.service.ts

async createSession(tenantId: string) {
  // Step 1: Fetch bootstrap data
  const bootstrap = await this.contextBuilder.getBootstrapData(tenantId);

  // Step 2: Build session state with full context
  const sessionState = {
    tenantId,
    businessName: bootstrap.businessName,
    knownFacts: bootstrap.discoveryFacts,
    forbiddenSlots: bootstrap.forbiddenSlots,  // ← The key!
    storefrontState: bootstrap.storefrontState,
    onboardingComplete: bootstrap.onboardingComplete,
  };

  // Step 3: ADK receives context at session start
  body: JSON.stringify({ state: sessionState })
}
```

### 3. System Prompt References State

```markdown
### Session State (Enterprise Slot-Policy)

At session start, you receive state with these fields:

- **knownFacts**: Object of facts already stored (businessType, location, etc.)
- **forbiddenSlots**: Array of slot keys you must NOT ask about

**CRITICAL RULE:** Never ask for any slot in forbiddenSlots.
```

---

## Computing forbiddenSlots

```typescript
// server/src/services/context-builder.service.ts

const forbiddenSlots = Object.keys(discoveryFacts).filter(
  (key) => discoveryFacts[key] !== undefined && discoveryFacts[key] !== null
) as (keyof KnownFacts)[];
```

This is **enterprise-grade** because:

- It's computed from actual data, not hardcoded
- Adding new fact types automatically adds them to forbidden slots
- No string matching means no bypass via rephrasing

---

## Testing the Pattern

```typescript
// server/src/services/context-builder.service.test.ts

it('should include seeded fact keys in forbiddenSlots', async () => {
  const discoveryFacts = {
    businessType: 'photographer',
    location: 'San Francisco, CA',
  };
  const mockTenant = createMockTenant(discoveryFacts);
  (mockPrisma.tenant.findUnique as any).mockResolvedValue(mockTenant);

  const bootstrap = await contextBuilder.getBootstrapData(TENANT_ID);

  // Keys, not values!
  expect(bootstrap.forbiddenSlots).toContain('businessType');
  expect(bootstrap.forbiddenSlots).toContain('location');
});
```

---

## Prevention Checklist

Before implementing agent context:

- [ ] Context injected at session creation, not via tool call
- [ ] Use slot keys (`forbiddenSlots: ["businessType"]`) not phrases
- [ ] Compute forbidden slots from actual stored data
- [ ] Single source of truth (`ContextBuilderService`)
- [ ] Regression test: seeded facts → first message doesn't ask

---

## References

- Architecture spec: `docs/architecture/AGENT_FIRST_ARCHITECTURE_SPEC.md`
- Implementation: `server/src/services/context-builder.service.ts`
- Tests: `server/src/services/context-builder.service.test.ts`
- Session creation fix: `server/src/services/vertex-agent.service.ts`

---

## Related Pitfalls

- **Pitfall #88:** Fact-to-Storefront bridge missing (different issue, same agent)
- **Pitfall #52:** Tool confirmation-only response (agent loses context)
- **Pitfall #53:** Discovery facts dual-source (branding vs OnboardingEvent)
