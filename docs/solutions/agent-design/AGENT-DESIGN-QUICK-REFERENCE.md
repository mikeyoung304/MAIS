---
title: 'Agent Design Quick Reference'
category: 'best-practices'
date_created: '2025-12-26'
tags: [agent-design, cheat-sheet, quick-reference]
---

# Agent Design Quick Reference

> Print this. Pin it above your desk. Reference when building agents.

---

## The 5-Step Framework

```
1. MAP        → User actions → Tools (action parity)
2. PROMPT     → Identity + Rules + Example (~100 lines)
3. CONTEXT    → Single injection at session start
4. TIERS      → T1 (auto) / T2 (soft) / T3 (hard)
5. APPROVE    → Server-side proposals (not prompt-only)
```

---

## Trust Tiers

| Tier   | Confirm? | Agent Behavior                   | Operations                      |
| ------ | -------- | -------------------------------- | ------------------------------- |
| **T1** | No       | Do it, report result             | Blackouts, branding, toggles    |
| **T2** | Soft     | "I'll do X. Say 'wait' if wrong" | Packages, pricing, storefront   |
| **T3** | Hard     | Must get "yes"/"confirm"         | Cancellations, refunds, deletes |

---

## Tool Design Rules

```
✅ DO: Primitive tools (create, read, update, delete)
✅ DO: Combine CRUD (upsert_package, manage_blackout)
✅ DO: Action parity (agent can do everything UI can)

❌ DON'T: Workflow tools (setup_photography_business)
❌ DON'T: Encoded business logic in tools
❌ DON'T: Separate create/update when upsert works
```

---

## Context Injection Template

```markdown
## Your Business Context

You are helping **{tenant.name}** ({tenant.slug}).

Setup:

- Stripe: {status}
- Packages: {count}
- Upcoming bookings: {count}

For current details, use your read tools.
```

**That's it.** Single injection. Tools are the refresh.

---

## System Prompt Structure (~100 lines)

```markdown
## Identity (10 lines)

Who you are, who you help, your personality

## Core Rules (15 lines)

ALWAYS: [4 things]
NEVER: [4 things]

## Trust Tiers (10 lines)

T1/T2/T3 definitions

## Tool Usage (10 lines)

Read: freely, Write: follow tiers, Sensitive: T3 always

## Onboarding (10 lines)

New user / Returning user / Stripe not connected

## Example (30 lines)

One good conversation example

## Error Handling (10 lines)

"I couldn't X because Y. Suggestion. Try?"

## Anti-Patterns (5 lines)

3 things NOT to do
```

---

## Server-Side Approval

```typescript
// Tools return proposals
interface ToolProposal {
  proposalId: string;
  operation: string;
  trustTier: 'T1' | 'T2' | 'T3';
  preview: object;
  expiresAt: Date;
}

// T1: auto-confirmed, returns result directly
// T2: confirms after next message (unless "wait")
// T3: requires explicit confirm_proposal() call
```

---

## Security Checklist

- [ ] tenantId from JWT, never user input
- [ ] All queries filter by tenantId
- [ ] Sanitize user data before context injection
- [ ] Server-side approval (not prompt-only)
- [ ] Audit log all tool calls
- [ ] Never inject: passwords, API keys, internal IDs

---

## Confirmation Vocabulary

**Explicit (T3):** yes, do it, confirm, proceed, execute, submit

**Rejection:** no, wait, stop, cancel, hold on, actually

**Ambiguous:** ok, sure, fine → Ask to clarify

---

## Anti-Patterns Quick Check

| If You See...               | It's Wrong Because... | Fix With...                  |
| --------------------------- | --------------------- | ---------------------------- |
| 40+ tools                   | Tool explosion        | Combine CRUD, defer features |
| 3-layer context refresh     | Over-engineered       | Single injection + tools     |
| "Never do X" in prompt only | Not security          | Server-side enforcement      |
| Confirm every action        | Fatigue               | Trust tiers                  |
| Workflow tools              | Encoded logic         | Primitives + prompt features |

---

## MVP Tool Target: 15-20

| Category  | Count | Examples                                         |
| --------- | ----- | ------------------------------------------------ |
| Read      | 8-10  | get_tenant, get_packages, get_bookings           |
| Write     | 5-8   | upsert_package, manage_blackout, update_branding |
| Sensitive | 2-3   | cancel_booking, confirm_proposal                 |

---

## When to Defer (YAGNI)

Defer if:

- <20% of MVP users will need it
- Existing UI handles it fine
- It requires new infrastructure
- It's a "nice-to-have" not "must-have"

Examples: Custom domains, segments, add-ons, availability rules, reschedule

---

## Success Metrics

| Metric                  | Target  |
| ----------------------- | ------- |
| Time to first package   | <10 min |
| Completion rate         | >70%    |
| T3 confirms per session | <2      |
| Tool error rate         | <5%     |
| Security incidents      | 0       |

---

## Related Docs

- Full patterns: `docs/solutions/agent-design/AGENT-NATIVE-DESIGN-PATTERNS.md`
- Capability map: `plans/AGENT-CAPABILITY-MAP.md`
- System prompt: `plans/AGENT-SYSTEM-PROMPT-DRAFT.md`
