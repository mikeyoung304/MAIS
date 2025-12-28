# Agent Design Quick Checklist

> **For:** Designers of AI agent systems at MAIS
> **When:** Before and during agent design
> **Print & Pin:** Yes
> **Companion to:** AGENT-DESIGN-PREVENTION-STRATEGIES.md

---

## Pre-Design Phase (1 Hour)

### Problem Validation

- [ ] Feature request clearly states user pain point
- [ ] Why can't existing UI/tools solve this?
- [ ] Is this 80%+ of user workflows?
- [ ] Success metric defined (e.g., "time to first booking < 5 min")

### Scope Lock

- [ ] MVP features locked (no "nice to haves")
- [ ] Deferred features listed with rationale
- [ ] Tool count estimate: should be ≤20
- [ ] Timeline is realistic (≥2 weeks recommended)

### Review Team

- [ ] 6 reviewers assigned:
  - [ ] Architecture (system design)
  - [ ] Security (isolation, injection, approval)
  - [ ] UX (confirmation flows, errors)
  - [ ] Agent-Native (action parity, simplicity)
  - [ ] Implementation (feasibility, APIs)
  - [ ] Simplicity (scope, deferral)

---

## Design Phase (1-2 Days)

### Security Model

**Tenant Isolation:**

- [ ] All queries filter by `WHERE tenantId = ?`
- [ ] `tenantId` comes from JWT/session, NEVER user input
- [ ] Tool validates `context.tenantId` before operation
- [ ] Cross-tenant queries in tests for verification

**Data Injection:**

- [ ] User-controlled data sanitized before prompt injection
- [ ] Injection patterns explicitly defined (ignore instructions, etc)
- [ ] Length limits enforced (100-200 chars typical)
- [ ] No user data in system prompt

**Sensitive Fields - NEVER Inject:**

- [ ] ❌ Passwords, tokens, API keys
- [ ] ❌ Encryption keys
- [ ] ❌ Database IDs (use slugs)
- [ ] ❌ Other tenants' data
- [ ] ❌ PII beyond operational need

**Approval Mechanism:**

- [ ] Server-side proposals (not prompt-based)
- [ ] Proposals stored in database with tenant scope
- [ ] Proposals expire after 30 minutes
- [ ] Tool calls return proposals, not results
- [ ] `confirm_proposal` is only way to execute

**Audit Trail:**

- [ ] All mutations logged to audit table
- [ ] Audit includes: tenantId, agentId, tool, input, output, timestamp
- [ ] Sensitive fields sanitized in logs
- [ ] Retention: 90 days dev, 7 years financial

---

### Tool Design

**Tool Count:**

- [ ] MVP: ≤18 tools (recommend 10-15)
- [ ] Combined CRUD (upsert, not separate create/update)
- [ ] Each tool does ONE thing (verb-based names)
- [ ] No "manage" or "process" tools (those are workflows)

**Trust Tiers Defined:**

- [ ] **T1 (Auto):** Safe, reversible → no confirm needed
  - [ ] Blackouts, branding, visibility, file uploads
- [ ] **T2 (Soft):** Important but reversible → "I'll update X. Say 'wait'"
  - [ ] Package changes, pricing, landing page
- [ ] **T3 (Hard):** Irreversible → "Confirm? yes/no"
  - [ ] Cancellations, refunds, deletes with bookings

**Action Parity:**

- [ ] List all UI actions
- [ ] Map each to agent tool
- [ ] No UI-only operations
- [ ] No agent limitations without documented reason

**Each Tool:**

- [ ] Purpose clear (1 sentence)
- [ ] Input schema defined
- [ ] Output schema defined
- [ ] Trust tier assigned (T1/T2/T3)
- [ ] Error scenarios documented
- [ ] Security checks listed (tenantId validation, etc)

---

### System Prompt

**Structure:**

- [ ] Identity section (who the agent is)
- [ ] Core rules (ALWAYS/NEVER behaviors)
- [ ] Tool usage (how to use tools, when to use read vs write)
- [ ] Tone/voice guidelines
- [ ] Error handling pattern
- [ ] Onboarding detection (new vs returning users)

**Key Rules:**

- [ ] "Propose before changing" (T2/T3 operations)
- [ ] "Use tools for current data" (no stale info)
- [ ] "Never guess - ask clarifying questions"
- [ ] Tool-specific confirmation requirements

**What NOT to Include:**

- [ ] User-specific data (gets injected at runtime)
- [ ] API keys, secrets, sensitive config
- [ ] Database IDs
- [ ] Other tenants' data

---

### Error Handling

**Pattern for Each Error Type:**

1. Explain simply (user-friendly, not technical)
2. Suggest fix (concrete action)
3. Ask before retrying (don't auto-retry)

**Examples:**

```
❌ "UNIQUE constraint failed on packages.slug"
✅ "A package with that name already exists.
    Want me to update the existing one or use a different name?"
```

---

## Review Phase (3-5 Days)

### Each Reviewer

- [ ] Read full design document
- [ ] Check against their criteria (security, UX, simplicity, etc)
- [ ] Ask clarifying questions
- [ ] Produce approval or requested changes

### Consensus

- [ ] ≥5 of 6 reviewers approve
- [ ] All P0 (critical) concerns addressed
- [ ] Security reviewer explicitly approves
- [ ] Implementation reviewer says feasible
- [ ] Simplicity reviewer approves deferral decisions

### Changes Incorporated

- [ ] Reviewer feedback addressed
- [ ] Design document updated
- [ ] Changes communicated to team
- [ ] Re-review for major changes

---

## Implementation Phase (2-4 Weeks)

### APIs

- [ ] All endpoints specified (read tools)
- [ ] All write endpoints specified (with proposal support)
- [ ] Request/response schemas defined
- [ ] Error codes documented
- [ ] Tenant isolation enforced

### Tools Implementation

- [ ] Each tool validates `context.tenantId`
- [ ] Read tools return fresh data
- [ ] Write tools return proposals (not results)
- [ ] Error messages are user-friendly
- [ ] All operations audit-logged

### Database

- [ ] Proposal table created with state machine
- [ ] Audit log table with indexes
- [ ] Tenant foreign keys everywhere
- [ ] Test isolation mechanisms

### Security Testing

- [ ] Cross-tenant query attempt blocked
- [ ] Prompt injection attempt blocked
- [ ] Session hijacking attempt blocked
- [ ] Approval bypass attempt blocked
- [ ] Each test documented in test suite

---

## Testing Phase (1-2 Weeks)

### Unit Tests

- [ ] Each tool in isolation
- [ ] Tenant isolation validation
- [ ] Error handling
- [ ] State machine transitions

### Integration Tests

- [ ] Full flows (e.g., create package → update price → cancel)
- [ ] Database proposal state machine
- [ ] Approval workflow (T1, T2, T3)
- [ ] Audit logging

### E2E Tests (Playwright)

- [ ] Full user journey (new user)
- [ ] Package creation flow
- [ ] Error recovery
- [ ] Confirmation flows

### Security Testing

- [ ] Prompt injection attempts
- [ ] Cross-tenant access attempts
- [ ] Token tampering
- [ ] Session replay
- [ ] Rate limiting

### Performance

- [ ] Average response time
- [ ] Token usage per operation
- [ ] Database query performance
- [ ] Concurrent user load test

---

## Launch Phase (1 Week)

### Pre-Launch

- [ ] Feature flag created (shipped but disabled)
- [ ] Monitoring/alerting configured
- [ ] Logging queries defined
- [ ] Rollback plan documented
- [ ] User documentation written

### Gradual Rollout

- [ ] Enable for 5% internal users → wait 24h
- [ ] Check logs for errors
- [ ] Enable for 25% users → wait 24h
- [ ] Check metrics (error rate, latency)
- [ ] Enable for 100% users → monitor

### Post-Launch

- [ ] Daily log review (first week)
- [ ] Error rate dashboard
- [ ] User feedback collected
- [ ] Performance metrics tracked
- [ ] Security incidents monitored

---

## Common Pitfalls Checklist

### ❌ Security Pitfalls

- [ ] ❌ Tenant ID in system prompt
- [ ] ❌ User data not sanitized
- [ ] ❌ No audit trail
- [ ] ❌ Approval only in prompt (not server-side)
- [ ] ❌ Sensitive fields injected

**Recovery:** See "Security Prevention Checklist" above

### ❌ UX Pitfalls

- [ ] ❌ Confirmation on every operation
- [ ] ❌ Unclear error messages
- [ ] ❌ One-size-fits-all onboarding
- [ ] ❌ Operations with no undo

**Recovery:** Implement trust tiers, improve error text, add branching

### ❌ Simplicity Pitfalls

- [ ] ❌ More than 20 tools
- [ ] ❌ Complex refresh logic
- [ ] ❌ Business logic in tools
- [ ] ❌ Too many deferred features

**Recovery:** Combine tools, move logic to prompt, defer aggressively

### ❌ Architecture Pitfalls

- [ ] ❌ Tools encode workflows
- [ ] ❌ No action parity
- [ ] ❌ Agent can't do what UI can
- [ ] ❌ Stale context

**Recovery:** Use tools as primitives, add missing tools, implement proposals

---

## Template: Design Kickoff

### Meeting (1 Hour)

1. **Problem:** What pain point does this solve? (5 min)
2. **MVP:** What's in scope? What's deferred? (15 min)
3. **Tools:** How many? What trust tiers? (15 min)
4. **Reviewers:** Assign 6 reviewers (2 min)
5. **Timeline:** When do we need approval? (3 min)
6. **Q&A:** (20 min)

### Deliverables

- [ ] Problem statement
- [ ] MVP feature list
- [ ] Tool list (name, trust tier, purpose)
- [ ] System prompt outline
- [ ] Deferred features with rationale
- [ ] Risk analysis (quick list)

### Next Steps

- [ ] Design phase owner assigned
- [ ] Review schedule set
- [ ] Slack channel created
- [ ] Document shared with reviewers

---

## Template: Design Feedback (For Reviewers)

```markdown
## [Reviewer Role] Review - APPROVE / REQUEST CHANGES / NEEDS DISCUSSION

### Strengths

- [What was done well]

### Concerns (Priority)

- [ ] P0 (blocking): [issue]
- [ ] P1 (important): [issue]
- [ ] P2 (nice): [suggestion]

### Requested Changes

- [Change 1]
- [Change 2]

### Questions

- [Clarifying question 1]
- [Clarifying question 2]

### Approval Condition

I approve when: [specific condition]
```

---

## Success Metrics for Agent Design

Track these metrics for every agent shipped:

| Metric               | Target             | How to Measure           |
| -------------------- | ------------------ | ------------------------ |
| Security incidents   | 0                  | Audit log review         |
| Confirmation fatigue | <2 per session avg | Count T3 confirmations   |
| Error rate           | <5%                | Tool call success rate   |
| Avg response time    | <3s                | Monitor latency          |
| Time to key action   | <10 min (new user) | Track from signup        |
| Completion rate      | >70%               | Users creating artifacts |

---

## When to Escalate

### Red Flags → Talk to Security Lead

- [ ] Multi-tenant data visible across tenants
- [ ] Audit log shows operations without approval
- [ ] Prompt injection attempt succeeded
- [ ] Sensitive data in logs

### Red Flags → Talk to Architecture Lead

- [ ] Tool count > 25
- [ ] Tool implementation has business logic
- [ ] Context refresh logic is complex
- [ ] No action parity

### Red Flags → Talk to Product

- [ ] Too many confirmations (>3 per session)
- [ ] Error messages confuse users
- [ ] Onboarding flow isn't working
- [ ] Key features deferred

---

## Quick Links

- **Full Guide:** `docs/solutions/AGENT-DESIGN-PREVENTION-STRATEGIES.md`
- **MAIS Agent Example:** `plans/MAIS-BUSINESS-ADVISOR-SYSTEM.md`
- **Capability Map:** `plans/AGENT-CAPABILITY-MAP.md`
- **System Prompt Draft:** `plans/AGENT-SYSTEM-PROMPT-DRAFT.md`

---

## Print This

```
┌─────────────────────────────────────────────────────────┐
│        AGENT DESIGN QUICK CHECKLIST (Print & Pin)       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ SECURITY (Must Have)                                    │
│ ☐ Tenant isolation at tool level                       │
│ ☐ Data injection prevention                            │
│ ☐ Server-side approval mechanism                       │
│ ☐ Audit trail for all mutations                        │
│                                                          │
│ UX (Must Have)                                          │
│ ☐ Trust tiers defined (T1/T2/T3)                       │
│ ☐ Confirmation fatigue addressed                       │
│ ☐ Error messages are helpful                           │
│ ☐ Onboarding branching for user types                  │
│                                                          │
│ SIMPLICITY (Must Have)                                  │
│ ☐ Tool count ≤ 20                                      │
│ ☐ Tools are primitives (not workflows)                 │
│ ☐ Business logic in prompts                            │
│ ☐ Aggressive feature deferral                          │
│                                                          │
│ ARCHITECTURE (Must Have)                                │
│ ☐ Action parity verified                               │
│ ☐ Static context (no refresh logic)                    │
│ ☐ All APIs specified                                   │
│ ☐ 6-agent review scheduled                             │
│                                                          │
│ LAUNCH (Before Release)                                 │
│ ☐ All tests pass (unit/integration/e2e)               │
│ ☐ Security tests pass                                  │
│ ☐ ≥5 reviewers approved                                │
│ ☐ Performance targets met                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

**Version:** 1.0
**Last Updated:** 2025-12-26
**Next Review:** 2026-01-26
