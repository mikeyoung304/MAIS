---
module: MAIS
date: 2025-12-28
problem_type: index
component: agent/architecture
tags: [agent-architecture, index, reference, prevention]
---

# Agent Architecture Documentation Index (2025-12-28)

Complete reference for agent architecture patterns, decisions, and prevention strategies in MAIS.

## Overview

The MAIS agent uses a sophisticated **proposal/executor pattern** for safe, transparent AI interactions. This pattern IS the agent service layer. Additional service layers should NOT be added.

**Decision Made:** 2025-12-28 - Multi-agent review unanimously rejected proposal to add domain service layer to agent tools.

---

## Core Documents (Read These First)

### 1. The Architectural Decision

**File:** `AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md`

**What it covers:**

- Why proposal/executor pattern IS the agent service layer
- Why request for service layers gets rejected
- Multi-agent review consensus (4 experts, all agreed)
- Tactical improvements that were accepted instead

**Read this when:**

- Proposing agent architecture changes
- Wondering why we don't use domain services
- Curious about the decision rationale

**Key insight:** "Tools ARE the service layer via proposal/executor pattern"

---

### 2. Evaluation and Prevention Strategies

**File:** `AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md`

**What it covers:**

- Decision framework for evaluating agent architecture changes
- Red flags that indicate over-engineering
- When services WOULD be appropriate
- Common objections and responses
- Implementation guidelines

**Read this when:**

- Evaluating a proposed agent architecture change
- Tempted to add services or layers
- Need to explain why current pattern is good
- Writing code review feedback

**Key sections:**

1. Decision Framework (4 critical questions)
2. Red Flags for Over-Engineering (4 patterns)
3. Signs the Current Pattern Is Working (4 indicators)
4. When Services WOULD Be Appropriate (3 scenarios)
5. Common Objections and Responses (4 questions)

**Length:** 26,893 bytes (comprehensive)

---

### 3. Code Review Checklist

**File:** `AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md`

**What it covers:**

- Pre-review checklist for authors (8 items)
- Review checklist for reviewers (20+ items)
- Red flags to reject (5 patterns)
- Green flags to accept (5 patterns)
- Decision tree (one-pager)
- Templates for good/rejected proposals

**Read this when:**

- Reviewing agent tool PRs
- Writing code review feedback
- Need quick reference during standup
- Unsure about accepting/rejecting proposal

**Key features:**

- Red/green flag tables
- Before/after examples
- One-page decision tree
- 30-second TL;DR version

**Length:** 11,213 bytes (quick reference)

---

## Tool-Specific Prevention (Related)

### 4. Agent Tool Architecture Prevention Strategies

**File:** `AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md`

**What it covers:**

- 7 specific tool architecture issues (P1-P3 severity)
- Issue 451: Unbounded query prevention
- Issue 452: Duplicate tool prevention
- Issue 453: Type safety prevention
- Issue 454: Soft-confirm timing prevention
- Issue 455: Error handling DRY prevention
- Issue 456: Database index prevention
- Issue 457: Query parallelization prevention

**Read this when:**

- Adding new agent tools
- Fixing bugs in existing tools
- Need specific patterns (pagination, error handling, etc.)
- Implementing tool improvements

**Scope:** Tool implementation quality (not architecture)

---

## Quick Navigation

### By Use Case

#### "I'm proposing a change to agent architecture"

1. Read: AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md (why current pattern works)
2. Use: AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (Section 1: Decision Framework)
3. Checklist: AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md (Author checklist)

#### "I'm reviewing an agent tool PR"

1. Use: AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md (all sections)
2. Reference: AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md (if tool-specific issue)

#### "I'm unsure if we should add a service layer"

1. Read: AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md (Why proposal/executor is enough)
2. Read: AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (Section 4: When Services Would Be Appropriate)
3. Skim: AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md (Red flags section)

#### "I need quick reference during standup/chat"

1. Use: AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md (start with TL;DR)
2. Reference: Quick takeaways at end

#### "I'm writing a new tool"

1. Reference: AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md (Sections 1-7)
2. Use: AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md (ensure patterns)

---

### By Content Type

#### Decisions and Rationale

- AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md - Core decision
- AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (Section 7) - Multi-agent review summary

#### How-To and Patterns

- AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (Sections 4-5) - When services apply
- AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (Section 8) - Implementation guidelines
- AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md (all) - Tool patterns

#### Red Flags and Anti-Patterns

- AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (Section 2) - Over-engineering patterns
- AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md (Red Flags section) - Things to reject
- AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (Section 7) - Multi-agent consensus on issues

#### Checklists and Quick Reference

- AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md (all) - Comprehensive checklists
- AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (Section 6) - Code review checklist
- AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md (Code Review sections) - Tool-specific checklists

---

## Key Concepts

### The Proposal/Executor Pattern (Agent Service Layer)

```
User Message
    ↓
LLM Reasoning
    ↓
Tool Call
    ↓
createProposal()           ← Phase 1: Tool validation, LLM transparency
    ↓
User Confirmation
    ↓
Executor::execute()        ← Phase 2: Re-validation, execution
    ↓
Prisma
    ↓
Result
```

**Why this is the service layer:**

1. Tools act like request validators (Phase 1 validation)
2. Executors act like business logic appliers (Phase 2 execution)
3. Proposal is the deferred command object
4. Two-phase execution provides safety through re-validation

**Why NOT to add services on top:**

1. Would obscure transparency (LLM can't inspect hidden logic)
2. Would break the command pattern (execution would happen earlier)
3. Would add indirection without benefit (not solving real problem)
4. Would violate agent-specific optimization (agent != REST)

---

### Agent ≠ REST

| Concern          | REST APIs                         | Agent Tools                     |
| ---------------- | --------------------------------- | ------------------------------- |
| **Goal**         | Data consistency across endpoints | LLM transparency + safety       |
| **Optimization** | Hide implementation, cache, reuse | Expose behavior, validate twice |
| **Layer**        | Service → Repository              | Tool → Proposal → Executor      |
| **Concern**      | Consistency of API contract       | Consistency of tool behavior    |
| **Abstraction**  | More = better                     | Less = better                   |

REST patterns don't apply to agents because optimization targets differ.

---

### Legitimate vs. Cargo-Cult Duplication

**Legitimate duplication** (KEEP):

```
API route: fetch bookings → serialize → filter by role → cache
Agent tool: fetch bookings → limit for tokens → raw data for LLM

Same query, different processing. Worth keeping separate.
```

**Illegitimate duplication** (FIX):

```
Tool A: get_bookings filters by status NOT IN (CANCELED)
Tool B: get_customer_bookings filters by status IN (CONFIRMED, PAID)

Different filters for same data. This is a bug.
```

---

## Related Issues

### Closed (Won't Fix)

- **TODO-450** - "Add service layer to agent tools"
  - Decision: Won't fix (proposal/executor already serves this role)
  - Related docs: AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md

### Open (For Implementation)

- **Issues 451-457** - 7 specific tool architecture improvements (P1-P3)
  - Related docs: AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md
  - Issues cover: unbounded queries, duplicates, type safety, timing, DRY, indexes, parallelization

---

## Integration with CLAUDE.md

The main project instructions (CLAUDE.md) reference these documents in the **Agent Architecture** section.

See: `CLAUDE.md` → "Agent Architecture (Agent-Native Patterns)"

Quick links added there:

- AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md
- AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md
- AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md
- AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md

---

## Training Path (For New Team Members)

### Day 1: Understand the Pattern

1. Read CLAUDE.md → Agent Architecture section (5 min)
2. Read AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md (15 min)
3. Skim AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (20 min)

**Done:** You understand why proposal/executor pattern is good

### Week 1: Be Ready to Review

1. Study AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md (30 min)
2. Review past agent tool PRs with this checklist (1-2 hours)
3. Practice on next agent tool PR

**Done:** You can review agent tool changes effectively

### Before Making Changes

1. Reference AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (5 min)
2. Answer 4 questions from Section 1: Decision Framework
3. Proceed or iterate on design

**Done:** You won't propose over-engineered solutions

---

## FAQ (Frequently Asked Questions)

### Q: Why don't we use the domain service layer for agent tools?

**A:** The proposal/executor pattern already IS the agent service layer. Adding domain services would:

1. Hide behavior from the LLM (reduce transparency)
2. Break the two-phase execution (reduce safety)
3. Add indirection without solving a real problem

See: AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md

---

### Q: What if two tools fetch the same data differently?

**A:** That's legitimate duplication if the data is used differently:

- Agent tool might paginate for token budget
- API route might cache for performance
- Different contexts, different optimizations

Only consolidate if same concern (e.g., both conflict checks).

See: AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (Section 2: Pattern 2)

---

### Q: Can we add a service for rate-limiting / audit logging?

**A:** YES, if it's a cross-cutting concern:

- Rate-limiting affects all tools → Service makes sense
- Audit logging affects all operations → Service makes sense
- Conflict detection affects specific tools → Helper function is enough

The key: Does this cut across multiple features?

See: AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (Section 4: Scenario 3)

---

### Q: What if there's code duplication in tools?

**A:** Extract helpers, not services:

- Duplication in 3+ tools → Extract to helper function
- Different concerns in each tool → Keep separation

Helpers enable reuse without adding abstraction layers.

See: AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md (Green Flags: Extracting Helpers)

---

### Q: Why is LLM transparency so important?

**A:** The LLM needs to reason about what tools return:

- If you hide logic in services, LLM can't inspect it
- LLM makes worse decisions without understanding data
- Transparency = LLM can predict tool behavior

Direct Prisma queries are transparent. Services add a black box.

See: AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (Section 1: Question 2)

---

## Authorship and Review

**Documents Created:** 2025-12-28
**Author Context:** Multi-agent review of TODO-450 (add service layer proposal)
**Reviewers (Expert Agents):**

- Architecture Strategist (DHH-style): REJECT
- TypeScript Specialist (Kieran): CONDITIONAL
- Code Simplicity: REJECT
- Agent-Native Design: REJECT

**Consensus:** Don't refactor. Proposal/executor pattern is excellent.

---

## Version History

| Date       | Change             | Document                   |
| ---------- | ------------------ | -------------------------- |
| 2025-12-28 | Initial creation   | All documents              |
| 2025-12-28 | Added to CLAUDE.md | Agent Architecture section |

---

## Next Steps

1. **Share with team:** Reference these docs in agent architecture discussions
2. **Use in code reviews:** Apply checklists to upcoming agent tool PRs
3. **Update when:** New issues arise, patterns evolve, decisions change
4. **Archive old patterns:** Move superseded docs to `/docs/archive/YYYY-MM/`

---

**Quick Access:**

- **PDF these files:**
  - AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md (print for standup)
  - AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (detailed reference)

- **Link in PRs:**
  - Reference checklist in PR template comment
  - Link specific sections in code review feedback

- **Reference in CLAUDE.md:**
  - Links already added to Agent Architecture section

---

**Document Status:** Ready for team use
**Last Updated:** 2025-12-28
**Maintained By:** Agent architecture team
