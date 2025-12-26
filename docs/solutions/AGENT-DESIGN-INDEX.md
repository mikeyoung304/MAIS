# Agent Design Prevention Strategies - Complete Index

> **Date:** 2025-12-26
> **Status:** Foundation documentation for all future MAIS AI agent designs
> **Total Lines:** 2,959 | **4 Documents** | **Est. Read Time:** 3-4 hours comprehensive, 30 min quick reference
> **Audience:** AI agent designers, architects, code reviewers

---

## Document Overview

### 1. **AGENT-DESIGN-SUMMARY.md** (463 lines)
   **The Bridge Document** - Use this as entry point

   - What this system is
   - Documentation map
   - Core concepts (trust tiers, proposals, action parity)
   - The 4 prevention categories
   - How to use this system for common scenarios
   - When to escalate
   - Key metrics
   - Next steps

   **Best For:**
   - Understanding the overall system
   - Navigating to right document for your task
   - Getting context before deep dives
   - Training new team members

   **Time to Read:** 30 minutes

---

### 2. **AGENT-DESIGN-QUICK-CHECKLIST.md** (443 lines)
   **The Action Document** - Print and pin this

   - Pre-Design Phase (1 hour)
   - Design Phase (1-2 days)
   - Review Phase (3-5 days)
   - Implementation Phase (2-4 weeks)
   - Testing Phase (1-2 weeks)
   - Launch Phase (1 week)
   - Common pitfalls quick reference
   - Success metrics
   - Template: Design Kickoff
   - Template: Design Feedback

   **Best For:**
   - Daily reference during design/review/implementation
   - Keeping work on track
   - Avoiding common mistakes
   - Onboarding new designers

   **Time to Read:** 20 minutes (reference, not linear)

   **Print:** Yes - pin to desk or workspace

---

### 3. **AGENT-DESIGN-PREVENTION-STRATEGIES.md** (1,488 lines)
   **The Complete Playbook** - Reference for deep understanding

   **Sections:**

   1. **Security Prevention (P0 Critical)**
      - Tenant isolation enforcement
      - Data injection prevention
      - Sensitive field deny list
      - Approval mechanisms
      - Audit trail patterns

   2. **UX Prevention**
      - Confirmation fatigue solution (trust tiers)
      - Onboarding branching
      - Error handling for humans
      - Confirmation vocabulary

   3. **Simplicity Prevention**
      - Tool proliferation prevention
      - Feature deferral decision tree
      - Single context injection
      - Combined vs separate tools

   4. **Architecture Prevention**
      - Tools as primitives vs workflows
      - Action parity verification
      - Server-side approval mechanism
      - Type safety patterns

   5. **Common Pitfalls & Recovery**
      - Confirm fatigue (detection + recovery)
      - Agent bypasses approval (detection + recovery)
      - Tool explosion (detection + recovery)
      - Context staleness (detection + recovery)

   6. **Implementation Patterns**
      - Branded types for ID safety
      - Discriminated union errors
      - Proposal state machines
      - Structured logging with correlation
      - Token budget service

   7. **Multi-Agent Review Process**
      - 6-reviewer structure
      - Approval criteria
      - Review output format

   8. **Appendices**
      - Checklists for agent design
      - Implementation templates

   **Best For:**
   - Deep understanding of each prevention area
   - Code examples and patterns
   - Error recovery procedures
   - Implementation guidance
   - Comprehensive reference

   **Time to Read:** 2-3 hours (comprehensive), 45 minutes (specific section)

---

### 4. **AGENT-TOOL-DESIGN-DECISION-TREE.md** (565 lines)
   **The Decision Framework** - Use for "Should I build this?"

   **Contents:**

   1. **Decision Tree Flowchart**
      - Is this essential?
      - Can existing tools do it?
      - What's the trust tier?
      - Is this buildable?

   2. **Step-by-Step Walkthrough**
      - Decision points for each step
      - Examples of each decision
      - Go/No-Go criteria

   3. **Example Decisions**
      - Custom domains (deferrable example)
      - Update package price (build example)
      - Reschedule booking (deferrable example)
      - Social media content (phase 3 example)

   4. **Tool Specification Template**
      - Input/output schemas
      - Security checks
      - Error cases
      - Test requirements

   5. **Escalation Guide**
      - When to talk to security
      - When to talk to architecture
      - When to talk to product
      - When to talk to implementation

   6. **Decision Log Template**
      - Documenting decisions
      - Tracking approvals
      - Recording rationale

   7. **Tips & Tricks**
      - Tool combination patterns
      - Making decisions visible
      - Testing before building
      - Keeping tools primitive

   **Best For:**
   - Evaluating specific tool proposals
   - Deciding build vs defer
   - Combining similar tools
   - Documenting decisions

   **Time to Use:** 10-15 minutes per tool decision

---

## Quick Navigation

### "I need to design a new agent system"
1. Read: AGENT-DESIGN-SUMMARY.md (overview)
2. Use: AGENT-DESIGN-QUICK-CHECKLIST.md (pre-design phase)
3. Reference: AGENT-DESIGN-PREVENTION-STRATEGIES.md (full playbook)
4. Review with: 6-person team
5. Implement using: Implementation patterns from playbook

### "I need to evaluate if we should build a specific tool"
1. Use: AGENT-TOOL-DESIGN-DECISION-TREE.md (decision flow)
2. If building: Write tool specification (from same document)
3. If deferring: Document rationale in decision log

### "I'm reviewing agent design from another engineer"
1. Use: AGENT-DESIGN-QUICK-CHECKLIST.md (review phase section)
2. Check: AGENT-DESIGN-PREVENTION-STRATEGIES.md (your domain: security/UX/architecture/etc)
3. Provide: Feedback using template from QUICK-CHECKLIST.md

### "I need to recover from an agent design problem"
1. Identify: Which problem category (security/UX/simplicity/architecture)
2. Go to: AGENT-DESIGN-PREVENTION-STRATEGIES.md → "Common Pitfalls & Recovery"
3. Follow: Recovery steps for your specific pitfall

### "I need code examples and patterns"
1. Go to: AGENT-DESIGN-PREVENTION-STRATEGIES.md → "Implementation Patterns"
2. Examples include:
   - Branded types (prevent ID confusion)
   - Discriminated union errors (type-safe error handling)
   - Proposal state machines (server-side approval)
   - Structured logging (with correlation IDs)
   - Token budget service (resource management)

### "I need to understand MAIS agent philosophy"
1. Start: AGENT-DESIGN-SUMMARY.md (core concepts section)
2. Real example: plans/MAIS-BUSINESS-ADVISOR-SYSTEM.md
3. Detailed: AGENT-DESIGN-PREVENTION-STRATEGIES.md (any section)

---

## Key Concepts at a Glance

### Trust Tiers (Critical)
```
T1 (Auto)      → Execute immediately, report result
                  Examples: blackouts, branding, file uploads

T2 (Soft)      → "I'll update X. Say 'wait' if wrong" (auto-confirms after next message)
                  Examples: package changes, pricing, landing page

T3 (Hard)      → Require explicit "yes"/"confirm"/"do it"
                  Examples: cancellations, refunds, deletes with bookings
```

### Server-Side Proposals (Critical)
```
Tool call → Proposal created (pending) → Agent shows → User confirms → Executed
           (stored in DB, not just prompt)                            (audit logged)
```

### Tool Categories
```
Read Tools      (9+)     - Get current data
Write Tools     (T1/T2)  - Create/update, safe or reversible
Sensitive Tools (T3)     - Risky operations
```

### Action Parity
```
Principle: Agent can do everything UI can do
Verify: For every UI action → corresponding agent tool exists
```

### Prevention Baseline
```
Security   → Tenant isolation at tool level, approval enforcement, audit logging
UX         → Trust tiers to avoid fatigue, helpful errors, branching onboarding
Simplicity → <20 tools, tools are primitives, static context
Architecture → Tools orchestrated by prompts, verified action parity
```

---

## Document Statistics

| Document | Lines | Size | Focus | Read Time |
|----------|-------|------|-------|-----------|
| Summary | 463 | 13KB | Navigation & concepts | 30 min |
| Quick Checklist | 443 | 13KB | Day-to-day reference | 20 min |
| Prevention Strategies | 1,488 | 39KB | Comprehensive playbook | 2-3 hours |
| Decision Tree | 565 | 17KB | Tool evaluation | 10-15 min/tool |
| **TOTAL** | **2,959** | **82KB** | Complete system | 3-4 hours |

---

## How These Documents Work Together

```
┌─────────────────────────────────────────────────────┐
│     Agent Design Prevention Strategies System        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ENTRY POINT: SUMMARY.md                           │
│  └─ What is this? Core concepts? How to use?      │
│                                                      │
│  DAILY REFERENCE: QUICK-CHECKLIST.md               │
│  └─ Pre-design, design, review, impl, test, launch│
│     (Keep pinned to desk)                          │
│                                                      │
│  DEEP DIVES: PREVENTION-STRATEGIES.md              │
│  ├─ Security (isolation, injection, approval)     │
│  ├─ UX (tiers, onboarding, errors)                │
│  ├─ Simplicity (tools, deferral, context)        │
│  ├─ Architecture (primitives, parity, proposals)  │
│  ├─ Pitfalls & recovery (4 scenarios)             │
│  ├─ Implementation patterns (6 code patterns)      │
│  ├─ Multi-agent review (6-person process)         │
│  └─ Templates (checklists, specifications)        │
│                                                      │
│  TOOL DECISIONS: DECISION-TREE.md                  │
│  └─ Is this tool essential? Build or defer?       │
│     (Use for each new tool proposed)               │
│                                                      │
│  REAL EXAMPLES: plans/MAIS-BUSINESS-ADVISOR-*.md  │
│  └─ See all principles applied in real 3-agent    │
│     system (Onboarding, Builder, Advisor)         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Usage Timeline

### Week 1: Foundation
- [ ] Read SUMMARY.md (30 min)
- [ ] Skim QUICK-CHECKLIST.md (20 min)
- [ ] Review DECISION-TREE.md (20 min)
- [ ] Examine MAIS example from plans/ (2 hours)
- **Total:** ~3 hours

### Ongoing: Design Process
- [ ] Use QUICK-CHECKLIST.md weekly
- [ ] Reference DECISION-TREE.md for tool decisions
- [ ] Consult PREVENTION-STRATEGIES.md for specific topics
- [ ] Apply patterns from "Implementation Patterns" section

### When Needed: Problem Solving
- [ ] Hit a pitfall? → PREVENTION-STRATEGIES.md
- [ ] Evaluate tool? → DECISION-TREE.md
- [ ] Need code pattern? → PREVENTION-STRATEGIES.md
- [ ] Reviewing design? → QUICK-CHECKLIST.md

---

## Document Cross-References

### SUMMARY points to:
- QUICK-CHECKLIST (daily reference)
- PREVENTION-STRATEGIES (deep dives)
- DECISION-TREE (tool decisions)
- MAIS example (real implementation)

### QUICK-CHECKLIST points to:
- PREVENTION-STRATEGIES (detailed checklists)
- DECISION-TREE (tool deferral)
- Common pitfalls recovery steps

### PREVENTION-STRATEGIES points to:
- QUICK-CHECKLIST (condensed versions)
- DECISION-TREE (feature deferral)
- Code patterns (implementation)
- MAIS example (real usage)

### DECISION-TREE points to:
- PREVENTION-STRATEGIES (background on concepts)
- QUICK-CHECKLIST (tool specification template)

---

## Key Lessons Captured

These documents capture **4 major lessons** from the MAIS Business Advisor System design:

1. **Security:** System prompts alone aren't controls
   → Enforce tenant isolation at tool level
   → Use server-side proposals for approval
   → Audit log all mutations

2. **UX:** Not all operations need confirmation
   → Use trust tiers (T1/T2/T3)
   → Define soft-confirm (T2) and hard-confirm (T3)
   → Avoid confirmation fatigue

3. **Simplicity:** Fewer tools > more features
   → Combined CRUD operations
   → Aggressive feature deferral
   → Move logic to prompts, not tools

4. **Architecture:** Tools are primitives
   → Each tool does ONE thing
   → Orchestrate with system prompt
   → Verify action parity

---

## Metrics to Track

After implementing an agent, track:

- **Security:** 0 incidents, 100% audit coverage
- **UX:** <2 confirmations per session average
- **Simplicity:** Tool count <20
- **Architecture:** 100% action parity, <5% error rate

---

## Getting Help

- **General questions:** #agents Slack channel
- **Security concerns:** Talk to security lead (escalation guide in PREVENTION-STRATEGIES)
- **Architecture questions:** Talk to architecture lead
- **Feature deferral:** Talk to product lead
- **Timeline/feasibility:** Talk to implementation lead

---

## Version Control

| Version | Date | Creator | Changes |
|---------|------|---------|---------|
| 1.0 | 2025-12-26 | Claude Code | Initial release from MAIS Business Advisor System design |

**Next review:** 2026-01-26 (post-launch learnings from advisor system)

---

## Compliance Checklist

Before shipping ANY agent system:

- [ ] All 4 security checks pass (isolation, injection, approval, audit)
- [ ] Trust tiers defined and enforced
- [ ] Action parity verified
- [ ] Tool count < 20
- [ ] ≥5 of 6 reviewers approved
- [ ] All tests pass (unit/integration/E2E/security)
- [ ] Performance targets met
- [ ] Monitoring configured
- [ ] Rollback plan documented

---

## Document Interoperability

These 4 documents work as a system:

```
Quick decision?          → Start with DECISION-TREE
Need context?            → Start with SUMMARY
Daily work?              → Pin QUICK-CHECKLIST
Deep research?           → Use PREVENTION-STRATEGIES
Real example?            → See plans/MAIS-BUSINESS-ADVISOR-SYSTEM.md
```

All documents cross-reference each other. Use the one that matches your current need, and it will guide you to the next resource.

---

## Final Notes

These documents represent the **complete prevention strategy** for AI agent design at MAIS, derived from the rigorous multi-agent review process (6 specialists) that designed the Business Advisor System.

**Core philosophy:** *Prevent problems through clear thinking, not through trust. Enforce at architecture level, not prompt level.*

Key insight from the design process: **Multi-agent review (Architecture, Security, UX, Agent-Native, Implementation, Simplicity) is essential.** It catches problems that no single reviewer would see.

---

**Start here:** [AGENT-DESIGN-SUMMARY.md](./AGENT-DESIGN-SUMMARY.md)

**Daily reference:** [AGENT-DESIGN-QUICK-CHECKLIST.md](./AGENT-DESIGN-QUICK-CHECKLIST.md) (print & pin)

**Complete guide:** [AGENT-DESIGN-PREVENTION-STRATEGIES.md](./AGENT-DESIGN-PREVENTION-STRATEGIES.md)

**Tool decisions:** [AGENT-TOOL-DESIGN-DECISION-TREE.md](./AGENT-TOOL-DESIGN-DECISION-TREE.md)

**Real example:** [MAIS Business Advisor System](../../plans/MAIS-BUSINESS-ADVISOR-SYSTEM.md)

---

*Last Updated: 2025-12-26*
*Status: Foundation documentation for all future MAIS agent work*
