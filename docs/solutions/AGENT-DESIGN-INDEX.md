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

1.  **Security Prevention (P0 Critical)**
    - Tenant isolation enforcement
    - Data injection prevention
    - Sensitive field deny list
    - Approval mechanisms
    - Audit trail patterns

2.  **UX Prevention**
    - Confirmation fatigue solution (trust tiers)
    - Onboarding branching
    - Error handling for humans
    - Confirmation vocabulary

3.  **Simplicity Prevention**
    - Tool proliferation prevention
    - Feature deferral decision tree
    - Single context injection
    - Combined vs separate tools

4.  **Architecture Prevention**
    - Tools as primitives vs workflows
    - Action parity verification
    - Server-side approval mechanism
    - Type safety patterns

5.  **Common Pitfalls & Recovery**
    - Confirm fatigue (detection + recovery)
    - Agent bypasses approval (detection + recovery)
    - Tool explosion (detection + recovery)
    - Context staleness (detection + recovery)

6.  **Implementation Patterns**
    - Branded types for ID safety
    - Discriminated union errors
    - Proposal state machines
    - Structured logging with correlation
    - Token budget service

7.  **Multi-Agent Review Process**
    - 6-reviewer structure
    - Approval criteria
    - Review output format

8.  **Appendices**
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

1.  **Decision Tree Flowchart**
    - Is this essential?
    - Can existing tools do it?
    - What's the trust tier?
    - Is this buildable?

2.  **Step-by-Step Walkthrough**
    - Decision points for each step
    - Examples of each decision
    - Go/No-Go criteria

3.  **Example Decisions**
    - Custom domains (deferrable example)
    - Update package price (build example)
    - Reschedule booking (deferrable example)
    - Social media content (phase 3 example)

4.  **Tool Specification Template**
    - Input/output schemas
    - Security checks
    - Error cases
    - Test requirements

5.  **Escalation Guide**
    - When to talk to security
    - When to talk to architecture
    - When to talk to product
    - When to talk to implementation

6.  **Decision Log Template**
    - Documenting decisions
    - Tracking approvals
    - Recording rationale

7.  **Tips & Tricks**
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

### 5. **AGENT-TOOL-ADDITION-PREVENTION.md** (NEW - 456 lines)

**The Operational Pattern** - Use when adding features to UI or agent

**Contents:**

1.  **Problem Pattern**
    - Hardcoded error messages in frontend
    - Action parity gaps (UI-only actions)

2.  **Prevention Strategy #1: Backend-Driven Error Messages**
    - Service layer domain errors with reason codes
    - Route mapping errors to HTTP responses
    - Contract definition for error schemas
    - Frontend reading backend error reasons
    - Agent tools receiving same error format
    - System prompt explaining error meanings

3.  **Prevention Strategy #2: Action Parity Checklist**
    - Audit: List all UI actions
    - Verification: Create missing tools
    - Testing: Full integration tests
    - When NOT to create tools (cosmetics, navigation)

4.  **Prevention Strategy #3: Trust Tier Guidelines**
    - T1 (Auto): No confirmation, safe operations
    - T2 (Soft): Soft confirmation for reversible changes
    - T3 (Hard): Explicit confirmation for irreversible changes
    - Error handling for each tier

5.  **Code Examples**
    - Complete pattern: Feature with dynamic errors
    - Pattern: Tool for previously UI-only action

6.  **Quick Checklist & Decision Tree**
    - 7-step verification process
    - Decision tree for "should this be a tool?"

**Best For:**

- Adding new features to UI
- Creating new agent tools
- Fixing hardcoded error messages
- Ensuring action parity
- New team members learning the pattern

**Time to Use:** 15 minutes planning + implementation time

---

### 6. **AGENT-TOOL-ADDITION-QUICK-CHECKLIST.md** (NEW - 234 lines)

**The Quick Reference** - Print and use daily

**Contents:**

1.  **Pre-Implementation (15 min)**
    - Feature discovery questions
    - Action parity audit
    - Trust tier assignment

2.  **Backend Error Messages Pattern**
    - Step 1: Service domain error
    - Step 2: Route mapping
    - Step 3: Contract definition
    - Step 4: Frontend usage
    - Step 5: Agent tool usage
    - Step 6: System prompt

3.  **Agent Tool Addition Checklist**
    - Planning (30 min)
    - Implementation (coding)
    - Testing (before PR)
    - Documentation

4.  **Action Parity Verification Template**
    - UI actions listed
    - Tools created
    - Error scenarios documented

5.  **Error Message Pattern Quick Ref**
    - What NOT to do
    - What to do correctly

6.  **Common Mistakes**
    - Hardcoded error messages
    - Missing agent tools
    - Different error messages (UI vs agent)
    - Inconsistent confirmation flows
    - Sensitive data in errors

**Best For:**

- Daily reference while implementing
- Ensuring consistency
- Quick verification before commit
- Onboarding new developers

**Time to Use:** 5 minutes per feature + reference during work

**Print:** Yes - pin to desk

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

### "I need to add a new feature to an agent or UI"

1. Start: AGENT-TOOL-ADDITION-QUICK-CHECKLIST.md (5 min orientation)
2. Plan: Use "Pre-Implementation" section
3. Code: Follow "Backend Error Messages Pattern" (6-step flow)
4. Verify: Use "Action Parity Verification Template"
5. Reference: AGENT-TOOL-ADDITION-PREVENTION.md (complete code examples)
6. Pin: AGENT-TOOL-ADDITION-QUICK-CHECKLIST.md to desk for daily use

### "I'm fixing hardcoded error messages"

1. Understand: AGENT-TOOL-ADDITION-PREVENTION.md → "Strategy #1"
2. Follow: Step 1-6 pattern (Service → Route → Contract → Frontend → Agent → Prompt)
3. Check: "Common Pitfalls" section for what you might have missed
4. Verify: Error message appears consistently in UI and agent

### "I discovered a missing agent tool"

1. Verify: Action parity using AGENT-TOOL-ADDITION-QUICK-CHECKLIST.md
2. Implement: Use "Agent Tool Addition Checklist" section
3. Reference: AGENT-TOOL-ADDITION-PREVENTION.md → "Pattern: Tool for previously UI-only action"
4. Test: Include error handling for all error scenarios
5. Document: Add to system prompt

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

| Document                      | Lines     | Size      | Focus                        | Read Time      |
| ----------------------------- | --------- | --------- | ---------------------------- | -------------- |
| Summary                       | 463       | 13KB      | Navigation & concepts        | 30 min         |
| Quick Checklist               | 443       | 13KB      | Day-to-day reference         | 20 min         |
| Prevention Strategies         | 1,488     | 39KB      | Comprehensive playbook       | 2-3 hours      |
| Decision Tree                 | 565       | 17KB      | Tool evaluation              | 10-15 min/tool |
| Tool Addition Prevention      | 456       | 14KB      | Feature addition patterns    | 30 min         |
| Tool Addition Quick Checklist | 234       | 7KB       | Daily feature reference      | 5 min          |
| **TOTAL**                     | **3,649** | **103KB** | Complete system + operations | 3.5-4 hours    |

---

## How These Documents Work Together

```
┌──────────────────────────────────────────────────────────────────┐
│        Agent Design Prevention Strategies System (Complete)       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  DESIGNING NEW AGENTS:                                           │
│  ├─ ENTRY POINT: SUMMARY.md (overview)                          │
│  ├─ DAILY REFERENCE: QUICK-CHECKLIST.md (pinned to desk)       │
│  ├─ DEEP DIVES: PREVENTION-STRATEGIES.md (playbook)            │
│  ├─ DECISIONS: DECISION-TREE.md (tool decisions)                │
│  └─ REAL EXAMPLE: plans/MAIS-BUSINESS-ADVISOR-*.md             │
│                                                                   │
│  ADDING FEATURES TO AGENTS:                                      │
│  ├─ QUICK START: TOOL-ADDITION-QUICK-CHECKLIST.md (pinned)     │
│  ├─ PATTERNS: TOOL-ADDITION-PREVENTION.md (code examples)       │
│  ├─ STRATEGY #1: Backend-driven error messages (6 steps)        │
│  ├─ STRATEGY #2: Action parity audit & tools                    │
│  └─ STRATEGY #3: Trust tier guidelines                          │
│                                                                   │
│  When designing: QUICK-CHECKLIST + PREVENTION-STRATEGIES        │
│  When adding features: TOOL-ADDITION-QUICK-CHECKLIST + examples │
│  When stuck: Check relevant "Common Pitfalls & Recovery"        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
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

| Version | Date       | Creator     | Changes                                                  |
| ------- | ---------- | ----------- | -------------------------------------------------------- |
| 1.0     | 2025-12-26 | Claude Code | Initial release from MAIS Business Advisor System design |

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

**Core philosophy:** _Prevent problems through clear thinking, not through trust. Enforce at architecture level, not prompt level._

Key insight from the design process: **Multi-agent review (Architecture, Security, UX, Agent-Native, Implementation, Simplicity) is essential.** It catches problems that no single reviewer would see.

---

## Document Links

### Agent Design (New Systems)

**Start here:** [AGENT-DESIGN-SUMMARY.md](./AGENT-DESIGN-SUMMARY.md)

**Daily reference:** [AGENT-DESIGN-QUICK-CHECKLIST.md](./AGENT-DESIGN-QUICK-CHECKLIST.md) (print & pin)

**Complete guide:** [AGENT-DESIGN-PREVENTION-STRATEGIES.md](./AGENT-DESIGN-PREVENTION-STRATEGIES.md)

**Tool decisions:** [AGENT-TOOL-DESIGN-DECISION-TREE.md](./AGENT-TOOL-DESIGN-DECISION-TREE.md)

### Agent Tool Addition (Adding Features)

**Quick start:** [AGENT-TOOL-ADDITION-QUICK-CHECKLIST.md](./AGENT-TOOL-ADDITION-QUICK-CHECKLIST.md) (print & pin)

**Full patterns:** [AGENT-TOOL-ADDITION-PREVENTION.md](./AGENT-TOOL-ADDITION-PREVENTION.md)

### Real Examples

**Complete system:** [MAIS Business Advisor System](../../plans/MAIS-BUSINESS-ADVISOR-SYSTEM.md)

---

_Last Updated: 2025-12-28_
_Status: Complete system (design + operations) for all MAIS agent work_
