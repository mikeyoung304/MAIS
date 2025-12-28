# Agent Tool Design Decision Tree

> **Use This To:** Evaluate whether to build a new agent tool
> **When:** During agent design, or when adding new capabilities
> **Time:** 5-10 minutes per decision
> **Output:** Build/Defer/Combine decision with clear rationale

---

## Decision Tree

```
                    ┌─── New Feature Request ───┐
                    │ "Should we add X to agent?"│
                    └────────────┬────────────┘
                                 │
                  ┌──────────────▼──────────────┐
                  │ STEP 1: Is it essential?   │
                  │ Can user accomplish core   │
                  │ task without this feature? │
                  └──┬─────────────────────┬─────┘
                    │ YES (user can do    │ NO (user can't
                    │ core task without)  │ do core task)
                    │                     │
                    ▼                     ▼
              ┌─────────────┐      ┌─────────────────┐
              │  DEFERRABLE │      │  LIKELY NEEDED  │
              │  (Phase 2+) │      │ (Continue...)   │
              └─────────────┘      └────────┬────────┘
                                           │
                  ┌────────────────────────▼──────────────────────┐
                  │ STEP 2: Can existing tools do it?            │
                  │ By combining/extending existing tool?        │
                  └────┬──────────────────────────────────┬──────┘
                      │ YES (existing tool               │ NO
                      │ can be extended)                 │
                      │                                   │
                      ▼                                   ▼
              ┌──────────────┐                   ┌──────────────────────┐
              │ EXTEND       │                   │ STEP 3: Trust tier? │
              │ EXISTING     │                   │ T1/T2/T3?           │
              │ TOOL         │                   └──┬─────┬─────┬──────┘
              └──────────────┘                     │ T1  │ T2  │ T3
                                                   │     │     │
                                                   ▼     ▼     ▼
                                              ┌──────┬──────┬───────┐
                                              │ SAFE │REVERS│IRREVER│
                                              │ AUTO │SOFT  │ HARD  │
                                              └──────┴──────┴───────┘
                                                   │     │     │
                  ┌────────────────────────────────┴─────┴─────┴──────┐
                  │        STEP 4: Proceed to build?               │
                  │ Takes <3 days? No circular dependencies?     │
                  │ No security/isolation risk?                  │
                  └──┬─────────────────────────────────────────┬─┘
                    │ YES                                  │ NO
                    │                                      │
                    ▼                                      ▼
          ┌──────────────────┐                   ┌──────────────────┐
          │ BUILD TOOL       │                   │ NEEDS REDESIGN   │
          │ + TESTS          │                   │ OR DEFER         │
          │ + DOCS           │                   │ (Revisit)        │
          └──────────────────┘                   └──────────────────┘
```

---

## Step-by-Step Walkthrough

### Step 1: Is This Essential?

**Question:** Can the user accomplish their core task without this feature?

**Decision Points:**

```
A. User can create a booking without this feature?
   YES → Can potentially defer
   NO  → Probably essential

B. This is "nice to have" or "power user" feature?
   YES → Deferrable to Phase 2
   NO  → Continue to Step 2

C. Estimated 80%+ of users need this?
   YES → Probably essential
   NO  → Deferrable
```

**Examples:**

```
ESSENTIAL ✓
- Create package (user can't launch storefront without)
- Cancel booking (user needs to manage bookings)
- View bookings (user needs to see revenue)

DEFERRABLE (Phase 2)
- Custom domains (~5% of users)
- Analytics dashboard (nice but not required)
- Add-on products (feature, not core)
- Reschedule booking (edit or cancel/recreate)
- A/B test pricing (power feature)
```

**Go/No-Go:** If deferrable, document in "Deferred Features" list with rationale.

---

### Step 2: Can Existing Tools Do It?

**Question:** Can we accomplish this by extending or combining existing tools?

**Decision Points:**

```
A. Does existing tool handle similar operations?
   YES → Can likely extend (upsert, not separate create/update)
   NO  → Might need new tool

B. Would combining with existing tool be confusing?
   YES → Consider new tool
   NO  → Extend existing

C. Is this a different conceptual operation?
   YES → Might need new tool
   NO  → Extend existing
```

**Examples:**

```
EXTEND EXISTING ✓
Before:
  - create_package
  - update_package_name
  - update_package_price

After:
  - upsert_package (create or update with partial fields)

COMBINE DIFFERENT OPERATIONS ✓
Before:
  - search_web
  - search_packages
  - search_bookings

After:
  - search (with type parameter: web | packages | bookings)

NEW TOOL (Can't combine)
  - create_segment vs create_package (different entities)
  - cancel_booking vs delete_booking (different semantics)
```

**Go/No-Go:** If extendable, update existing tool definition. If new tool needed, continue to Step 3.

---

### Step 3: What's the Trust Tier?

**Question:** What approval level does this operation need?

**Decision Points:**

```
Trust Tier T1 (Automatic - no confirm)
├─ Easily reversible? YES
├─ Safe defaults? YES
├─ No data loss? YES
└─ Examples: blackouts, branding, file uploads

Trust Tier T2 (Soft Confirm - "say wait" to cancel)
├─ Important operation? YES
├─ Reversible? YES
├─ User understands impact? YES
└─ Examples: pricing, package edits, landing page

Trust Tier T3 (Hard Confirm - must say "yes")
├─ Irreversible? YES
├─ Financial impact? YES
├─ Affects other users? YES
└─ Examples: cancellations, refunds, deletes with bookings
```

**Decision Matrix:**

| Operation            | Reversible? | Irreversible        | Silent Fail Risk | Trust Tier |
| -------------------- | ----------- | ------------------- | ---------------- | ---------- |
| Set blackout dates   | Yes         | -                   | Low              | T1         |
| Update package price | Yes         | -                   | Medium           | T2         |
| Cancel booking       | No          | Financial           | High             | T3         |
| Update branding      | Yes         | -                   | Low              | T1         |
| Delete package       | No\*        | Only if no bookings | Medium           | T2/T3      |
| Refund customer      | No          | Financial           | Critical         | T3         |

**Go/No-Go:** Assign trust tier. If T3, ensure proposal mechanism is implemented.

---

### Step 4: Is This Buildable?

**Question:** Can we implement this in the timeline without creating technical debt?

**Decision Points:**

```
A. Implementation time?
   <3 days → OK to build
   3-7 days → Risky, consider deferral
   >7 days → Defer to Phase 2

B. Dependencies?
   None → Good
   1-2 internal → OK
   3+ or external APIs → Reconsider

C. Security complexity?
   Low (standard CRUD) → OK
   Medium (needs approval) → OK
   High (new isolation concern) → Needs security review

D. Testing complexity?
   Simple → OK
   Moderate → OK
   Complex (many edge cases) → Consider deferral

E. Conflicts with existing design?
   No conflicts → OK
   Minor conflicts → Addressable
   Major conflicts → Redesign needed
```

**Red Flags:** If ≥2 red flags, consider deferral.

```
🚩 RED FLAGS:
  - "We'll optimize this later" → Add tech debt
  - "Security review can be post-launch" → Risk
  - "Tests can be added later" → Regression risk
  - "This should be easy" (but unclear how) → Hidden complexity
  - "We'll just add another tool" (tool count > 20) → Complexity
```

**Go/No-Go:** If buildable, proceed to tool spec. If not, defer or redesign.

---

## Example Decisions

### Example 1: Custom Domains

```
STEP 1: Is it essential?
  Q: Can user launch storefront without custom domain?
  A: Yes, subdomain works (site.mais.com/tenant-slug)
  DECISION: Deferrable ✓

STEP 2: N/A (Deferred)

STEP 3: N/A (Deferred)

STEP 4: N/A (Deferred)

OUTCOME: Defer to Phase 2
RATIONALE: ~5% of users need custom domains, high DNS complexity,
           can be added after validating core product
DOCS: docs/solutions/PHASE-2-ROADMAP.md - line "Custom Domains"
```

### Example 2: Update Package Price

```
STEP 1: Is it essential?
  Q: Can user launch without changing prices?
  A: Yes, initial pricing set at creation
  BUT: Users often need to adjust prices later
  DECISION: Essential (continue)

STEP 2: Can existing tool do it?
  Q: Does create_package tool already handle updates?
  A: No, separate update_package_price tool exists
  Q: Can we combine into upsert_package?
  A: Yes! (name, price, description, features all updatable)
  DECISION: Extend upsert_package ✓

STEP 3: Trust Tier?
  Q: Reversible?
  A: Yes, can always update again
  Q: User understands impact?
  A: Yes, direct cause-effect
  DECISION: T2 (Soft confirm) ✓

STEP 4: Buildable?
  Q: Implementation time?
  A: 2 days (already have endpoint)
  Q: Dependencies?
  A: None, uses existing CRUD
  Q: Testing?
  A: Standard, <5 tests
  DECISION: Build ✓

OUTCOME: Add to upsert_package tool as T2 operation
TOOL DEF: upsert_package (T2) - Create or update package with name, price, description, features
```

### Example 3: Reschedule Booking

```
STEP 1: Is it essential?
  Q: Can user reschedule booking?
  A: Currently only cancel + rebook (2-step)
  Q: Is this 80% of workflow?
  A: No, ~10% of bookings rescheduled
  Q: Is workaround acceptable?
  A: Yes, cancel + create takes 2 minutes
  DECISION: Deferrable ✓

STEP 2: N/A (Deferred)

STEP 3: N/A (Deferred)

STEP 4: N/A (Deferred)

OUTCOME: Defer to Phase 2
RATIONALE: Low volume operation, cancel + rebook is acceptable workaround,
           reschedule adds complexity (availability checks, notifications)
DOCS: docs/solutions/PHASE-2-ROADMAP.md - line "Reschedule Booking"
```

### Example 4: Generate Social Media Post

```
STEP 1: Is it essential?
  Q: Can user launch storefront without social media drafts?
  A: Yes, user can write their own
  Q: Is this core value?
  A: No, nice but not essential
  DECISION: Deferrable ✓ (Unless Phase 3 advisor system builds this)

STEP 2: N/A (Deferred for MVP, but advisor system will have it)

STEP 3: N/A

STEP 4: N/A

OUTCOME: Defer to Phase 3 (Advisor System)
RATIONALE: Non-essential MVP feature, but will be built as part of
           advisor agent system (more value when combined with market research)
DOCS: plans/MAIS-BUSINESS-ADVISOR-SYSTEM.md - "Custom Advisor Tools"
```

---

## Tool Specification Template

Once you've decided to build a tool, use this template:

````markdown
# Tool: [name]

## Basic Info

- **Trust Tier:** T1/T2/T3
- **Purpose:** [1 sentence what it does]
- **Reverse:** What's the undo/cancel operation?

## Input Schema

```typescript
interface [ToolName]Input {
  // Required fields
  field1: string;     // Description
  field2: number;    // Description

  // Optional fields
  optionalField?: string[];
}
```
````

## Output Schema

```typescript
interface [ToolName]Output {
  // On success
  success: true;
  data: {
    field1: string;
    field2: number;
  };

  // On failure
  success: false;
  error: string;
  suggestion: string;
}
```

## Security Checks

- [ ] Validates `context.tenantId`
- [ ] Owns resource before update/delete
- [ ] No sensitive data in output
- [ ] Audit logged

## Error Cases

| Error          | User Message         | Suggestion                              |
| -------------- | -------------------- | --------------------------------------- |
| DUPLICATE_NAME | "Already exists"     | "Use different name or update existing" |
| NOT_FOUND      | "Couldn't find that" | "Check if it still exists"              |

## API Endpoint(s)

- POST /v1/[resource] (create)
- PUT /v1/[resource]/:id (update)
- GET /v1/[resource] (read)

## Tests Required

- [ ] Unit: happy path
- [ ] Unit: error cases
- [ ] Integration: with other tools
- [ ] E2E: full user flow
- [ ] Security: cross-tenant attempt blocked

````

---

## When to Escalate

### Escalate to Security Lead If:
- [ ] Multi-tenant data involved
- [ ] Financial impact (refunds, payments)
- [ ] Authentication/authorization required
- [ ] Customer PII accessed
- [ ] External API involved

### Escalate to Architecture Lead If:
- [ ] Tool count will exceed 20
- [ ] Complex state machine
- [ ] Circular dependencies
- [ ] New database table needed
- [ ] API contract change

### Escalate to Product If:
- [ ] Conflicts with user workflow
- [ ] Requires user education
- [ ] Changes onboarding flow
- [ ] Conflicts with other tools

### Escalate to Implementation Lead If:
- [ ] Estimated >3 days
- [ ] External dependency
- [ ] Scaling concerns
- [ ] Performance impact

---

## Decision Log Template

Use this to document decisions for future reference:

```markdown
# Tool Decision: [Tool Name]

**Date:** 2025-12-26
**Proposer:** [Name]
**Status:** APPROVED / DEFERRED / REDESIGNED

## Decision Path
1. Essential? [YES/NO] → [Rationale]
2. Extend existing? [YES/NO] → [Which tool?]
3. Trust tier? [T1/T2/T3] → [Rationale]
4. Buildable? [YES/NO] → [Effort estimate]

## Outcome
[BUILD/DEFER/REDESIGN]

## Rationale
[Why this decision]

## If Deferred
- Target phase: [Phase N]
- Blocking criteria: [What needs to happen first]
- Priority: [P0/P1/P2]

## If Redesigned
- Changes: [What changed]
- Next review: [When]

## Approval
- [ ] Product approved
- [ ] Security reviewed
- [ ] Architecture approved
- [ ] Implementation feasible
````

---

## Tips & Tricks

### Avoid Tool Creep

```
Instead of: create_package, update_package_name, update_package_price
Use: upsert_package with partial updates
Saves: 2 tools, 1 API call

Instead of: create_segment, update_segment, delete_segment
Use: manage_segment with CRUD operations
Saves: 2 tools
```

### Make Decisions Visible

```
Document every tool with:
- Why it's T1/T2/T3
- How it relates to existing tools
- What it enables in the agent
- When it will be deprecated (if Phase 2 better solution exists)
```

### Test Before Building

```
Before starting implementation:
1. Write test cases
2. Mock API responses
3. Have agent use mocked tool
4. Verify UX is good
5. THEN build the real API
```

### Keep Tools Primitive

```
❌ Tool that tries to be smart:
  "based on interview, create optimal packages"

✅ Primitive tool:
  "create_package(name, price, features)"
  (agent decides WHEN and HOW to use it based on prompt)
```

---

## FAQ

**Q: How do I know if a tool is essential?**
A: Can 80%+ of users complete their core task without it? If yes, probably deferrable.

**Q: My tool would take 5 days. Should I defer?**
A: Probably yes. Complex tools are hard to get right. Start simple, add later.

**Q: Can I build a tool that combines 3 different operations?**
A: Only if they're variations of the same concept (CRUD). Otherwise split them.

**Q: What if existing tool is close but not perfect?**
A: Extend it. Imperfect extension > new tool. Refactor later if needed.

**Q: When should I use a workflow tool vs primitives?**
A: Never use workflow tools in agent systems. Workflows belong in system prompt.

**Q: How many confirmations is too many?**
A: If >2-3 T3 operations per session, users get fatigued. Probably deferring some would help.

**Q: Can a tool be T2 in one context and T3 in another?**
A: Yes, but rare. Usually context determines the tier (e.g., cancel_booking is always T3).

---

**Last Updated:** 2025-12-26

Use alongside: `AGENT-DESIGN-PREVENTION-STRATEGIES.md` and `AGENT-DESIGN-QUICK-CHECKLIST.md`
