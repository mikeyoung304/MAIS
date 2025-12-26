# Agent Design System - Complete Reference

> **For:** All MAIS engineers designing or reviewing agent systems
> **Status:** Foundation documentation for future AI agent work
> **Version:** 1.0
> **Date:** 2025-12-26

---

## What This System Is

A comprehensive prevention strategy and decision framework for designing AI agents at MAIS, derived from the MAIS Business Advisor System design process (Onboarding Interviewer, Builder Pipeline, Custom Advisor).

The system captures **4 key lessons**:

1. **Security:** Enforce at tool level, not prompts
2. **UX:** Use trust tiers to prevent confirmation fatigue
3. **Simplicity:** Fewer tools + prompt-driven behavior > more tools + code
4. **Architecture:** Tools are primitives, not workflows

---

## Documentation Map

### For Quick Decisions (5-10 minutes)

**Start here:**
- **[Agent Design Quick Checklist](./AGENT-DESIGN-QUICK-CHECKLIST.md)** - Print & pin
- **[Agent Tool Design Decision Tree](./AGENT-TOOL-DESIGN-DECISION-TREE.md)** - "Should I build this tool?"

### For Deep Dives (1-2 hours)

**Comprehensive guide:**
- **[Agent Design Prevention Strategies](./AGENT-DESIGN-PREVENTION-STRATEGIES.md)** - Full playbook
  - Security prevention (tenant isolation, injection, approval)
  - UX prevention (confirmation fatigue, onboarding, error handling)
  - Simplicity prevention (tool design, feature deferral)
  - Architecture patterns (tools as primitives, action parity)
  - Common pitfalls & recovery
  - Implementation patterns (branded types, state machines, logging)

### For Reference

**Real examples:**
- **[MAIS Business Advisor System Plan](../../plans/MAIS-BUSINESS-ADVISOR-SYSTEM.md)** - Full 3-agent system design with all sections
- **[System Prompt Draft](../../plans/AGENT-SYSTEM-PROMPT-DRAFT.md)** - Example agent persona & rules
- **[Capability Map](../../plans/AGENT-CAPABILITY-MAP.md)** - Tool design + trust tiers + action parity

### For Learning

**Pattern examples in code:**
- Branded types: `docs/solutions/AGENT-DESIGN-PREVENTION-STRATEGIES.md` → "Implementation Patterns"
- State machines: Same document → "Pattern: Proposal State Machine"
- Error types: Same document → "Discriminated Union Errors"
- Logging: Same document → "Pattern: Structured Logging"

---

## Core Concepts

### Trust Tiers

Every tool has one:

| Tier | Behavior | Confirmation | Examples |
|------|----------|--------------|----------|
| **T1** | Execute immediately | None | Blackouts, branding, file uploads |
| **T2** | "I'll update X. Say 'wait'" | Soft (proceeds after next message) | Package pricing, landing page edits |
| **T3** | "Confirm? (yes/no)" | Hard (explicit confirmation required) | Cancellations, refunds, deletes |

### Tool Categories

```
Read Tools (9+)      - Fetch current data, never fail
  ├─ get_tenant
  ├─ get_packages
  ├─ get_bookings
  ├─ check_availability
  └─ ... (read-only operations)

Write Tools (T1/T2)  - Create/update, soft approval
  ├─ upsert_package (T2)
  ├─ manage_blackout (T1)
  ├─ update_branding (T1)
  └─ ... (reversible or safe operations)

Sensitive Tools (T3) - Risky operations, hard approval
  ├─ cancel_booking (T3)
  ├─ confirm_proposal (T3)
  └─ ... (irreversible or financial impact)
```

### Server-Side Proposals

The security backbone:

```
Agent calls tool → Server creates Proposal → Proposal.status = 'pending'
                                            ↓
                                     Agent shows proposal to user
                                            ↓
                           User confirms → confirm_proposal() called
                                            ↓
                                  Proposal.status = 'approved'
                                            ↓
                                   Change executed
                                            ↓
                                  Audit logged
```

T1 operations auto-confirm. T2 auto-confirm after next message. T3 require explicit yes.

### Action Parity

**Principle:** Agent should be able to do everything the UI can do.

**Why:** Users shouldn't have to go back to UI for some operations. Friction = churn.

**Verification:** For every page/feature in UI, is there an agent tool?

---

## The 4 Prevention Categories

### 1. Security Prevention

**What Can Go Wrong:**
- Multi-tenant data leakage
- System prompt injection
- Approval bypass
- Sensitive data exposure

**How to Prevent:**
- [Security Prevention Checklist](./AGENT-DESIGN-PREVENTION-STRATEGIES.md#security-prevention-checklist)
- Tenant isolation at tool level
- User data sanitization
- Server-side proposals (not prompt-based approval)
- Audit trail for all mutations

**Key Files:**
- `AGENT-DESIGN-PREVENTION-STRATEGIES.md` → "Security Prevention Checklist"
- `AGENT-DESIGN-QUICK-CHECKLIST.md` → "Security Pitfalls"

### 2. UX Prevention

**What Can Go Wrong:**
- Confirmation on every operation → fatigue
- One-size-fits-all onboarding → friction
- Unclear error messages → confusion
- No undo for operations → user distrust

**How to Prevent:**
- [UX Prevention Checklist](./AGENT-DESIGN-PREVENTION-STRATEGIES.md#ux-prevention-checklist)
- Trust tiers (T1/T2/T3) to vary confirmation
- Onboarding branching (new vs returning)
- Human-friendly error messages
- Reversible operations by default

**Key Files:**
- `AGENT-DESIGN-PREVENTION-STRATEGIES.md` → "UX Prevention Checklist"
- `AGENT-DESIGN-QUICK-CHECKLIST.md` → "UX Pitfalls"

### 3. Simplicity Prevention

**What Can Go Wrong:**
- Tool explosion (20+ tools)
- Complex refresh logic (stale context)
- Business logic in tools (hard to test)
- Trying to build everything in MVP (scope creep)

**How to Prevent:**
- [Simplicity Prevention Checklist](./AGENT-DESIGN-PREVENTION-STRATEGIES.md#simplicity-prevention-checklist)
- Keep tool count < 20
- Single static context injection
- Tools as primitives (orchestrated by prompts)
- Aggressive feature deferral

**Key Files:**
- `AGENT-DESIGN-PREVENTION-STRATEGIES.md` → "Simplicity Prevention Checklist"
- `AGENT-TOOL-DESIGN-DECISION-TREE.md` → "Deferral decision tree"

### 4. Architecture Prevention

**What Can Go Wrong:**
- Tools that encode workflows (can't test)
- No action parity (agent limited vs UI)
- Complex tool dependencies
- Stale context causing wrong decisions

**How to Prevent:**
- [Architecture Prevention Checklist](./AGENT-DESIGN-PREVENTION-STRATEGIES.md#architecture-prevention-checklist)
- Tools are primitives (simple, dumb operations)
- Verify action parity (agent can do everything UI can)
- Server-side approval (enforces policies)
- Static context + tools for refresh

**Key Files:**
- `AGENT-DESIGN-PREVENTION-STRATEGIES.md` → "Architecture Prevention Checklist"
- `AGENT-TOOL-DESIGN-DECISION-TREE.md` → "Action parity verification"

---

## How to Use This System

### Scenario 1: Designing a New Agent

```
1. Read: AGENT-DESIGN-QUICK-CHECKLIST.md (30 min)
   → Understand structure and security baseline

2. Design:
   a. Problem statement
   b. Tool list (with trust tiers)
   c. System prompt outline
   d. Deferred features
   e. Risk analysis

3. Check: AGENT-DESIGN-PREVENTION-STRATEGIES.md
   a. Security checklist → verify isolation, injection prevention
   b. UX checklist → define trust tiers, error handling
   c. Simplicity checklist → tool count, deferral decisions
   d. Architecture checklist → action parity, primitiveness

4. Review:
   a. Schedule 6-person review (Architecture, Security, UX, Agent-Native, Implementation, Simplicity)
   b. Each reviewer uses checklist from Step 3
   c. Address all P0 concerns
   d. Get ≥5 approvals

5. Implement:
   a. APIs
   b. Tools
   c. Tests (unit/integration/E2E/security)
   d. Audit logging
```

### Scenario 2: Evaluating a New Tool

```
1. Use: AGENT-TOOL-DESIGN-DECISION-TREE.md
   a. Is it essential?
   b. Can existing tools do it?
   c. What's the trust tier?
   d. Is it buildable?

2. If BUILD:
   a. Write tool specification
   b. Plan implementation
   c. Schedule code review

3. If DEFER:
   a. Document in "Deferred Features" list
   b. Document rationale
   c. Note target phase
```

### Scenario 3: Code Review of Agent Implementation

```
1. Check: AGENT-DESIGN-QUICK-CHECKLIST.md
   a. Security checks passed?
   b. Trust tiers enforced?
   c. Action parity verified?
   d. Tests pass?

2. Verify Security:
   a. Tenant isolation (tenantId validation)
   b. No sensitive data in context
   c. Proposals created, not prompt-based approval
   d. Audit logging

3. Verify UX:
   a. Error messages helpful?
   b. Confirmation levels appropriate?
   c. Onboarding flows work?

4. Verify Simplicity:
   a. Tool count reasonable?
   b. Tools are primitives?
   c. No business logic in tools?
   d. Context is static?
```

### Scenario 4: Incident/Pitfall Recovery

```
If: "Multi-tenant data visible"
Then: Read AGENT-DESIGN-PREVENTION-STRATEGIES.md
      → "Pitfall: Security Pitfalls"
      → Follow recovery steps

If: "Too many confirmations"
Then: Read same document
      → "Pitfall: Confirm Fatigue"
      → Follow recovery steps

If: "Tool explosion (25+ tools)"
Then: Read same document
      → "Pitfall: Tool Explosion"
      → Follow recovery steps

If: "Agent gives stale information"
Then: Read same document
      → "Pitfall: Context Staleness"
      → Follow recovery steps
```

---

## Checklist Index

### Quick Checklists (Print & Pin)

- **[Agent Design Quick Checklist](./AGENT-DESIGN-QUICK-CHECKLIST.md)**
  - Pre-Design Phase (1 hour)
  - Design Phase (1-2 days)
  - Review Phase (3-5 days)
  - Implementation Phase (2-4 weeks)
  - Testing Phase (1-2 weeks)
  - Launch Phase (1 week)
  - Common Pitfalls
  - Success Metrics

### Detailed Checklists

**In [AGENT-DESIGN-PREVENTION-STRATEGIES.md](./AGENT-DESIGN-PREVENTION-STRATEGIES.md):**

- Security Prevention Checklist
  - Tenant/Org Isolation
  - Data Injection Prevention
  - Sensitive Field Deny List

- UX Prevention Checklist
  - Confirmation Fatigue
  - Onboarding Branching
  - Error Messages for Humans

- Simplicity Prevention Checklist
  - Tool Proliferation
  - Feature Deferral Decision Tree
  - Single Context Injection

- Architecture Prevention Checklist
  - Tools Are Primitives
  - Action Parity
  - Server-Side Approval Mechanism

---

## Real Example: MAIS Business Advisor System

The 3-agent system (Onboarding Interviewer, Builder Pipeline, Custom Advisor) demonstrates all principles:

**See:** `plans/MAIS-BUSINESS-ADVISOR-SYSTEM.md`

Key sections:
- **Security Model:** Tenant isolation, audit trails
- **Trust Tiers:** How different operations handle approvals
- **Tool Design:** 18 tools (down from 43 after simplification)
- **System Prompts:** Examples for each agent
- **Data Model:** Prisma schema for audit trails
- **Implementation Patterns:** Real code examples

**Lessons from this design:**
- 58% tool reduction through combining similar operations
- 68% system prompt reduction through focus
- 100% tenant isolation enforcement
- Zero confirmation fatigue (trust tiers)

---

## When to Get Help

### Escalate to Security Lead If:
- Multi-tenant isolation concerns
- Sensitive data handling
- Approval/authorization changes
- Audit trail questions
- External API integration

### Escalate to Architecture Lead If:
- Tool design questions
- System design concerns
- Complexity assessment
- API contract design
- Database schema changes

### Escalate to Product Lead If:
- Feature deferral decisions
- User research/validation
- Roadmap prioritization
- MVP scope questions

### Escalate to Implementation Lead If:
- Feasibility assessment
- Technical design review
- Timeline estimation
- Risk identification

---

## Key Metrics to Track

After launching an agent:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Security incidents | 0 | Audit log review |
| Confirmation fatigue | <2 per session avg | Count T3 confirmations |
| Error rate | <5% | Tool call success rate |
| Avg response time | <3s | Monitor latency |
| Time to key action | <10 min (new user) | Track from first message |
| Completion rate | >70% | Users creating artifacts |
| Audit trail coverage | 100% | All mutations logged |
| Test coverage | 80%+ | Unit/integration/E2E tests |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-26 | Initial release - foundation from MAIS Business Advisor System design |

---

## Next Steps

### Before Your First Agent Design

1. [ ] Read: `AGENT-DESIGN-QUICK-CHECKLIST.md` (30 min)
2. [ ] Skim: `AGENT-DESIGN-PREVENTION-STRATEGIES.md` (1 hour)
3. [ ] Review: `AGENT-TOOL-DESIGN-DECISION-TREE.md` (20 min)
4. [ ] Examine: `plans/MAIS-BUSINESS-ADVISOR-SYSTEM.md` (2 hours)

### When Designing an Agent

1. Use checklists from "Agent Design Quick Checklist"
2. Reference decision framework from "Decision Tree"
3. Verify against "Prevention Strategies" for each category
4. Use "MAIS Business Advisor" as template/example

### When Reviewing an Agent Design

1. Prepare as 6-person review team
2. Each reviewer checks relevant sections of "Prevention Strategies"
3. Use template in "Quick Checklist" for feedback
4. Aim for consensus (≥5 of 6 approvals)

---

## Support

- **Questions:** Ask in #agents Slack channel
- **Issues:** File ticket with "agent-design" label
- **Updates:** Watch this document for revisions
- **Feedback:** Submit via docs issue tracker

---

**Status:** Living document - will be updated as new agents are built and lessons learned.

Last Updated: 2025-12-26
