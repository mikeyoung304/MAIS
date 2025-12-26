---
title: AI Agent Design System - Complete Documentation Index
category: agent-design
tags: [index, agent-architecture, design-patterns, guides]
---

# AI Agent Design System - Documentation Index

Complete documentation for building production AI agents with capability maps, system prompts, trust tiers, and server-side approval workflows.

## Quick Start (30 Seconds)

1. **New to agent design?** Start with [AGENT_DESIGN_QUICK_REFERENCE.md](./AGENT_DESIGN_QUICK_REFERENCE.md) - cheat sheet with templates
2. **Building an agent system?** Read [AGENT_DESIGN_SYSTEM_PATTERNS.md](./AGENT_DESIGN_SYSTEM_PATTERNS.md) - complete guide with code examples
3. **Reviewing a design?** Use [AGENT_DESIGN_REVIEW_METHODOLOGY.md](./AGENT_DESIGN_REVIEW_METHODOLOGY.md) - 6-reviewer validation process

## Documents Overview

### 1. AGENT_DESIGN_SYSTEM_PATTERNS.md
**The Complete Design Guide** (8,500+ words)

Full breakdown of the production agent design system with:
- 5-step design process (capability mapping → system prompt → context injection → approval workflow → simplification)
- 5 key design patterns with code examples
- Design review validation results
- Implementation checklist
- Anti-patterns to avoid

**When to read:**
- Implementing an agent system from scratch
- Understanding the full design context
- Reviewing code that uses this pattern
- Training new team members

**Key sections:**
- Step 1: Map user capabilities to agent tools
- Step 2: Define system prompt with identity & behaviors
- Step 3: Design context injection (session start)
- Step 4: Implement trust tier approval mechanism
- Step 5: Simplify with single context layer
- Pattern A-E: Detailed patterns with code
- Part 3: Design review validation
- Part 4: Implementation checklist

---

### 2. AGENT_DESIGN_QUICK_REFERENCE.md
**The Cheat Sheet** (1,500 words)

30-second reference guide with:
- Trust tier definitions (one table)
- Capability map template
- System prompt template
- Implementation checklist
- Code templates for approval endpoint
- Common errors & fixes

**When to use:**
- Need a quick template
- Refreshing memory during implementation
- Code review (pin above desk)
- Teaching new team members

**Key sections:**
- 30-second design framework
- Trust tiers cheat sheet
- Templates (capability map, system prompt, context shape)
- Implementation checklist (design, code, testing)
- Code template: Approval endpoint
- Code template: Tool implementation
- Anti-patterns table

---

### 3. AGENT_DESIGN_REVIEW_METHODOLOGY.md
**The Review Process** (3,000 words)

Methodology for validating design with 6 parallel specialists:

**6 Reviewers:**
1. Architecture - system design, layering, complexity
2. Security - injection, isolation, authentication
3. UX - confirmation fatigue, clarity, naturalness
4. Agent-Native - primitives, reasoning, composability
5. Implementation - feasibility, code patterns, testing
6. Simplicity - over-engineering, minimal viable design

**Key findings:**
- Single context layer is simpler than 3-layer refresh
- Server-side approval prevents prompt injection
- Trust tiers reduce confirmation fatigue
- Tools must be primitives, not workflows
- Confirmation codes should include action name

**When to read:**
- Validating your own agent design
- Understanding why the design is this way
- Running a review for a different system
- Learning the review methodology

---

## Pattern Quick Reference

### The Four Layers

```
Layer 1: User Action      → "Create booking for tomorrow"
Layer 2: Agent Reasoning  → "Check availability, create booking"
Layer 3: Tool Request     → POST /api/agent/approve { tool_create_booking }
Layer 4: Server Approval  → Verify trust tier, execute, return result
```

### The Five Steps

| Step | What | Output |
|------|------|--------|
| 1 | Map user actions to tools | Capability map (one tool per action) |
| 2 | Define identity & rules | System prompt (with examples) |
| 3 | Build context object | Session context (immutable) |
| 4 | Add approval workflow | Server-side gating (T1/T2/T3) |
| 5 | Simplify everything | Single context layer + primitive tools |

### The Three Trust Tiers

| Tier | Condition | Flow | Example |
|------|-----------|------|---------|
| **T1** | Safe reads | Execute immediately | "You have 3 slots" |
| **T2** | Low-risk writes | Soft ask, execute if no refusal | "I'll book 2 PM?" |
| **T3** | High-risk/irreversible | Hard ask, require confirmation code | "Type CONFIRM REFUND" |

---

## When to Use This Pattern

### Do Use When:
- Building AI agents that take user actions (booking, payment, communication)
- System is multi-tenant with isolation requirements
- Actions can be high-risk (refunds, deletions, password changes)
- You want clear approval boundaries
- You need to prevent prompt injection attacks

### Don't Use When:
- Agent is read-only (no actions)
- Internal automation (no user confirmation needed)
- Low-stakes actions (typo fixing, formatting)
- Single-tenant system

---

## Implementation Roadmap

### Phase 1: Design (1 day)
- [ ] Map all user capabilities to tools
- [ ] Write system prompt with examples
- [ ] Assign trust tiers to tools
- [ ] Get 6-person design review

### Phase 2: Core Infrastructure (2-3 days)
- [ ] Implement session context loading
- [ ] Build `/api/agent/approve` endpoint
- [ ] Implement confirmation code generation
- [ ] Add tenant scoping to all tools

### Phase 3: Tools (ongoing)
- [ ] Implement each tool (data access first, then actions)
- [ ] Add unit tests for each tool
- [ ] Add integration tests for approval flow
- [ ] Add E2E tests for full workflow

### Phase 4: Validation (1 day)
- [ ] Run trust tier tests (T1, T2, T3)
- [ ] Verify tenant isolation
- [ ] Test injection attacks
- [ ] Performance testing

---

## Code Examples by Use Case

### Use Case: Read-Only Agent
**Files needed:** QUICK_REFERENCE.md
**Trust tiers used:** T1 only
**Example tool:** tool_list_bookings

### Use Case: Admin Booking Agent
**Files needed:** Full SYSTEM_PATTERNS.md
**Trust tiers used:** T1, T2
**Example tools:** tool_create_booking, tool_view_customer

### Use Case: Payment/Refund Agent
**Files needed:** Full SYSTEM_PATTERNS.md + REVIEW_METHODOLOGY.md
**Trust tiers used:** T1, T2, T3
**Example tools:** tool_create_refund, tool_view_payment

---

## Key Insights

### Insight 1: Trust Tiers Reduce Fatigue
- T1 (no ask): 70% of requests
- T2 (soft ask): 25% of requests
- T3 (hard ask): 5% of requests
- **Result:** Users see confirmation only when it matters

### Insight 2: Single Context Layer > Multi-Layer Refresh
- Original proposal: Load context → Refresh preferences → Refresh config
- Problem: Race conditions, inconsistency, complexity
- Solution: Load once at session start, tools fetch fresh data
- **Result:** 50% less complexity, fewer bugs

### Insight 3: Tools Must Be Primitives
- Bad: `tool_schedule_and_send_reminder` (workflow)
- Good: `tool_schedule_event` + `tool_send_email` (primitives)
- **Result:** Agent can reason about each step, compose creatively

### Insight 4: Server-Side Approval is Critical
- Client-side approval can be bypassed by prompt injection
- Server-side approval cannot be bypassed (agent doesn't control server)
- **Result:** Injection-resistant security model

### Insight 5: Prompt-Native Features Scale
- To add feature: Update system prompt
- To add tool: Add to tool registry (data, not code)
- To add rule: Modify prompt constraints
- **Result:** Fast iterations without redeployment

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│                  "Book me for 2 PM"                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
        ┌───────────────────────────────────┐
        │    Agent Reasoning System          │
        │                                   │
        │ System Prompt + Context Injected  │
        │ Tool: check_availability         │
        │ Tool: create_booking             │
        │ Tool: send_email                 │
        └───────────────┬───────────────────┘
                        │
                        ↓ Tool Request
        ┌───────────────────────────────────┐
        │  /api/agent/approve Endpoint      │
        │                                   │
        │ 1. Verify session ownership       │
        │ 2. Check tool availability        │
        │ 3. Route by trust tier:           │
        │    - T1: Execute immediately      │
        │    - T2: Execute (soft ask done)  │
        │    - T3: Require confirmation     │
        └───────────────┬───────────────────┘
                        │
                        ↓ Authorized Request
        ┌───────────────────────────────────┐
        │     Tool Implementation            │
        │                                   │
        │ 1. Inject tenantId from context   │
        │ 2. Validate business rules        │
        │ 3. Update database                │
        │ 4. Return result                  │
        └───────────────┬───────────────────┘
                        │
                        ↓ Result
        ┌───────────────────────────────────┐
        │    Agent Formats Response          │
        │   "Booking confirmed for 2 PM"    │
        └───────────────────────────────────┘
```

---

## Validation Checklist

Before deploying an agent system:

- [ ] All user actions mapped to tools
- [ ] Tools are primitives (one action each)
- [ ] Trust tiers assigned to all tools
- [ ] System prompt written with 5-10 examples
- [ ] Session context loads at auth time
- [ ] Context is immutable for session duration
- [ ] `/api/agent/approve` endpoint implements routing
- [ ] Confirmation codes verified server-side
- [ ] TenantId injected from context (not params)
- [ ] T1 tests pass (execute without ask)
- [ ] T2 tests pass (execute after soft ask)
- [ ] T3 tests pass (blocked without code)
- [ ] Cross-session attacks rejected
- [ ] Tenant isolation verified
- [ ] Injection attacks tested

---

## Related Documentation

### Multi-Tenant Security
- [/CLAUDE.md](/CLAUDE.md) - Global patterns for tenant isolation
- [docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md](/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md) - Multi-tenant patterns

### System Architecture
- [/ARCHITECTURE.md](/ARCHITECTURE.md) - System design principles
- [/DEVELOPING.md](/DEVELOPING.md) - Development workflow

### Security
- [docs/security/SECRET_ROTATION_GUIDE.md](/docs/security/SECRET_ROTATION_GUIDE.md) - Secret management
- [docs/solutions/security-issues/PREVENT-CRUD-ROUTE-VULNERABILITIES.md](/docs/solutions/security-issues/PREVENT-CRUD-ROUTE-VULNERABILITIES.md) - Route security

### Similar Patterns
- [docs/solutions/methodology/multi-agent-code-review-process.md](/docs/solutions/methodology/multi-agent-code-review-process.md) - Multi-agent review process
- [docs/solutions/best-practices/service-layer-patterns-MAIS-20251204.md](/docs/solutions/best-practices/service-layer-patterns-MAIS-20251204.md) - Service layer patterns

---

## FAQ

**Q: Why three trust tiers and not two or four?**
A: Three is the minimum set covering all use cases:
- T1 for safe reads (no friction)
- T2 for safe writes (minimal friction)
- T3 for dangerous actions (maximum safety)
Four would over-engineer; two would conflate different risk levels.

**Q: Can trust tiers be per-user?**
A: Yes! Use `context.trustTierOverrides` to override defaults per user role.

**Q: What if user forgets confirmation code format?**
A: System prompt includes examples. Code format is self-documenting: "Type 'CONFIRM REFUND alice@example.com' to proceed."

**Q: How long should confirmation codes be valid?**
A: 5 minutes. Trades off UX (user won't forget) vs security (limited replay window).

**Q: Can I use database transactions instead of confirmation codes?**
A: No. Confirmation codes are about user approval, not data consistency. Use both: transactions ensure data integrity, codes ensure user intent.

**Q: What if the agent doesn't have a tool to do what the user asks?**
A: Agent should explain clearly: "I can't [action]. I can [these alternatives]."
Use capability map to ensure this doesn't happen often.

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-26 | 1.0 | Initial design documentation after 6-agent review |

---

## Contact & Questions

For questions about this pattern:
1. Check QUICK_REFERENCE.md (most answers there)
2. Read relevant section in SYSTEM_PATTERNS.md
3. Review the 6 specialist findings in REVIEW_METHODOLOGY.md

---

**Last Updated:** 2025-12-26
**Status:** Production-Ready (validated by 6 specialists)

