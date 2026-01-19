# Vertex AI Agent System: Plan Retrospective & Lessons Learned

**Date:** January 19, 2026
**Plan Reference:** `plans/VERTEX-AI-EXECUTION-PLAN.md`
**Status:** Phase 5 in progress, 19 issues identified in code review
**Purpose:** Document what went wrong to optimize future plans

---

## Executive Summary

The Vertex AI Agent Rebuild project successfully deployed 5 agents to Cloud Run in 6 weeks. However, a code review at the Phase 4→5 boundary identified **19 issues** (5 P1, 11 P2, 3 P3) that should have been caught earlier. This retrospective analyzes:

1. What the plan got right
2. What slipped through the cracks
3. Why the gates failed to catch issues
4. Concrete improvements for future plans

**Key Finding:** The plan optimized for _deployment velocity_ over _code quality_. Gates verified "is it running?" but not "is it correct?" This created technical debt that now blocks Phase 5.

---

## Table of Contents

1. [Plan Timeline vs Reality](#plan-timeline-vs-reality)
2. [Issues by Origin Phase](#issues-by-origin-phase)
3. [Gate Failure Analysis](#gate-failure-analysis)
4. [Systemic Patterns](#systemic-patterns)
5. [What the Plan Got Right](#what-the-plan-got-right)
6. [What the Plan Got Wrong](#what-the-plan-got-wrong)
7. [Recommendations for Future Plans](#recommendations-for-future-plans)
8. [Appendix: Full Issue Mapping](#appendix-full-issue-mapping)

---

## Plan Timeline vs Reality

### Planned Schedule

```
Week 1      Week 2      Weeks 3-4    Weeks 5-6    Weeks 7-8
┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ PHASE 1 │ │ PHASE 2 │ │ PHASE 3  │ │ PHASE 4  │ │ PHASE 5  │
│Foundation│ │ Booking │ │Specialists│ │Concierge │ │Project   │
│ Setup   │ │  Agent  │ │ Agents   │ │+ Integrate│ │  Hub     │
└─────────┘ └─────────┘ └──────────┘ └──────────┘ └──────────┘
     │           │            │            │            │
     ▼           ▼            ▼            ▼            ▼
   GATE 1     GATE 2       GATE 3       GATE 4       GATE 5
```

### Actual Timeline

| Phase     | Planned Duration | Actual Duration | Variance     | Notes                               |
| --------- | ---------------- | --------------- | ------------ | ----------------------------------- |
| Phase 1   | Week 1           | 1 day           | -4 days      | GCP setup was straightforward       |
| Phase 2   | Week 2           | 2 days          | -5 days      | Booking agent simpler than expected |
| Phase 3   | Weeks 3-4        | 3 days          | -11 days     | All 3 specialists deployed quickly  |
| Phase 4   | Weeks 5-6        | 4 days          | -10 days     | Concierge + frontend integration    |
| **Total** | **6 weeks**      | **~10 days**    | **-32 days** | Compressed 6x                       |

### The Problem with Speed

The plan was completed **6x faster than estimated**. This sounds good, but:

1. **No time for code review** between phases
2. **Gates became rubber stamps** - "it deploys" = pass
3. **Technical debt accumulated silently** - issues weren't visible until code review
4. **Copy-paste proliferated** - faster than proper abstraction

---

## Issues by Origin Phase

### Phase 2: Booking Agent (First Agent)

The Booking agent established patterns that all subsequent agents copied - including bad patterns.

| Issue ID | Issue                     | What Happened                                              |
| -------- | ------------------------- | ---------------------------------------------------------- |
| 5185     | getTenantId inconsistency | Booking used simple 1-tier pattern; later agents copied it |
| 5191     | Empty secret fallback     | `INTERNAL_API_SECRET \|\| ''` pattern started here         |
| 5196     | console.log not logger    | Booking used console.log; all agents copied it             |

**Phase 2 Gate Criteria (what was checked):**

- [x] Agent responds to "What services?"
- [x] Tenant isolation verified
- [x] Response latency < 3 seconds
- [x] No errors in Cloud Logging

**What the gate missed:**

- [ ] Code follows project patterns (logger, not console.log)
- [ ] Environment variables fail-fast on missing
- [ ] getTenantId handles all context types

### Phase 3: Specialist Agents (Marketing, Storefront, Research)

Three agents deployed in 3 days. Speed came at a cost.

| Issue ID | Issue                                | Which Agent | What Happened                                                    |
| -------- | ------------------------------------ | ----------- | ---------------------------------------------------------------- |
| 5186     | publish_draft no confirmation        | Storefront  | T3 action without programmatic enforcement                       |
| 5188     | Tools return instructions            | Marketing   | Misunderstood FunctionTool pattern                               |
| 5189     | Dead code sanitize function          | Research    | Wrote security code, forgot to call it                           |
| 5195     | Nonexistent specialists mentioned    | Research    | System prompt references Image/Video agents that don't exist yet |
| 5197     | Prompt injection patterns duplicated | Research    | Copied from old codebase instead of extracting                   |
| 5198     | discard_draft T3 no confirm          | Storefront  | Same issue as 5186                                               |
| 5199     | publish/preview params unused        | Storefront  | Dead code from copy-paste                                        |
| 5201     | Research tenantId unused             | Research    | Parameter defined but never used                                 |
| 5202     | HTTP URL validation                  | Research    | No validation on scrape URLs                                     |
| 5203     | z.any() content parameter            | Marketing   | Type safety shortcut                                             |

**Phase 3 Gate Criteria (what was checked):**

- [x] Marketing Specialist deployed and responding
- [x] Storefront Specialist deployed and responding
- [x] Research Specialist deployed and responding
- [x] All specialists return valid JSON
- [x] Prompt injection filtering active on Research

**What the gate missed:**

- [ ] Tools actually do what they claim (Marketing returns instructions!)
- [ ] T3 actions have programmatic enforcement
- [ ] No dead code
- [ ] System prompts reference only existing agents
- [ ] Security functions are actually called

### Phase 4: Concierge Orchestrator

The orchestrator introduced A2A communication - and new failure modes.

| Issue ID | Issue                      | What Happened                                                  |
| -------- | -------------------------- | -------------------------------------------------------------- |
| 5185     | getTenantId inconsistency  | Concierge passes state as plain object; specialists expect Map |
| 5187     | No request timeouts        | All fetch() calls have no timeout                              |
| 5190     | Hardcoded fallback URLs    | Development URLs left in production code                       |
| 5192     | Module-level mutable state | Session cache has no TTL, unbounded growth                     |
| 5193     | No circuit breaker         | Specialist failures cascade to Concierge                       |
| 5194     | No rate limiting           | No protection against abuse                                    |
| 5200     | Retry no backoff           | Retries happen immediately, no exponential backoff             |

**Phase 4 Gate Criteria (what was checked):**

- [x] Concierge deployed and routing correctly
- [x] "Write headlines" routes to Marketing
- [x] "Research competitors" routes to Research
- [x] "Change layout" routes to Storefront
- [x] Preview panel updates in real-time
- [x] ReflectAndRetry catches specialist failures
- [x] Tenant dashboard chat functional

**What the gate missed:**

- [ ] Fetch calls have timeouts
- [ ] Specialist failures don't hang Concierge
- [ ] No hardcoded URLs
- [ ] Session state doesn't grow unbounded
- [ ] Rate limiting in place

---

## Gate Failure Analysis

### Why Gates Passed Despite Issues

| Gate   | Criteria Type  | What It Caught                | What It Missed             |
| ------ | -------------- | ----------------------------- | -------------------------- |
| Gate 1 | Infrastructure | APIs enabled, buckets created | N/A (infrastructure only)  |
| Gate 2 | Functional     | "Does it respond?"            | Code quality, patterns     |
| Gate 3 | Functional     | "Do all 3 respond?"           | Tool correctness, security |
| Gate 4 | Functional     | "Does routing work?"          | Resilience, edge cases     |

**Pattern:** All gates tested the **happy path**. None tested:

- Error handling
- Edge cases
- Code quality
- Security depth
- Performance under load

### Gate Criteria vs Issue Distribution

```
           Gate 2          Gate 3          Gate 4
              │                │                │
   Issues:    │                │                │
   ┌──────────┼────────────────┼────────────────┼──────────┐
   │ P1: 5185 │ P1: 5186, 5188 │ P1: 5187       │          │
   │ P2: 5191 │     5189       │ P2: 5190, 5192 │          │
   │     5196 │ P2: 5195, 5197 │     5193, 5194 │          │
   │          │     5198, 5199 │     5200       │          │
   │          │ P3: 5201, 5202 │                │          │
   │          │     5203       │                │          │
   └──────────┴────────────────┴────────────────┴──────────┘
              3 issues         10 issues        6 issues
```

**Phase 3 was the biggest source of issues** (10 of 19). This makes sense:

- 3 agents deployed in 3 days
- No code review between agents
- Copy-paste from Booking agent (which had its own issues)

---

## Systemic Patterns

### Pattern 1: Copy-Paste Proliferation

**What happened:**

1. Booking agent was built first with certain patterns
2. Marketing copied Booking's code
3. Storefront copied Marketing's code
4. Research copied Storefront's code
5. Concierge copied patterns from all

**The drift:**

```
Booking → Marketing → Storefront → Research → Concierge
   │          │            │            │           │
   └─ 1-tier  └─ 2-tier    └─ 4-tier    └─ 1-tier   └─ expects
      getTenantId           getTenantId    (regressed)    4-tier
```

**Why it happened:**

- No shared utilities package in plan
- "Standalone deployment" pattern encouraged copy-paste
- No code review to catch drift

**Prevention:**

- Extract shared utilities before building second agent
- Require code review between agents
- Add "no copy-paste without extraction" gate criterion

### Pattern 2: Happy Path Testing Only

**What happened:**

- Gates only tested "does it work?"
- Never tested "what happens when it fails?"
- Never tested "what happens with malformed input?"

**Example - Gate 4 should have caught:**

```typescript
// Test: What happens when specialist times out?
// Expected: Timeout after 30s, graceful error
// Actual: Hangs indefinitely (issue 5187)

// Test: What happens when specialist returns error?
// Expected: Retry with backoff
// Actual: Immediate retry, no backoff (issue 5200)
```

**Prevention:**

- Add "failure mode" tests to every gate
- Require chaos testing before gate pass
- Include latency budget in gate criteria

### Pattern 3: Security as Afterthought

**What happened:**

- Security functions were written but not called (5189)
- Trust tier enforcement was prompt-based, not programmatic (5186, 5198)
- URL validation was skipped (5202)

**Why it happened:**

- Plan focused on "get it working"
- Security was planned for Phase 7 "Polish"
- Gates didn't include security criteria

**Prevention:**

- Security criteria in every gate, not just final phase
- "Defense in depth" checklist for each agent
- Require security review before deployment

### Pattern 4: Environment Configuration Shortcuts

**What happened:**

- Hardcoded URLs for faster development (5190)
- Empty string fallbacks mask misconfiguration (5191)
- Module-level state doesn't survive restarts (5192)

**Why it happened:**

- Development velocity prioritized
- "Will fix before production" never happened
- No "configuration audit" gate criterion

**Prevention:**

- Fail-fast on missing env vars from day 1
- No hardcoded values even in development
- Configuration audit in every gate

### Pattern 5: Documentation Drift

**What happened:**

- Research agent's system prompt mentions Image and Video specialists (5195)
- These agents don't exist until Phase 6
- Users see confusing "I'll delegate to the Image specialist" that fails

**Why it happened:**

- System prompts copied from design documents
- Design documents described final state, not current state
- No "prompt accuracy" gate criterion

**Prevention:**

- System prompts should only reference existing capabilities
- Add "prompt accuracy" test to gates
- Version control prompts with capability matrix

---

## What the Plan Got Right

### 1. Phased Approach with Gates

The fundamental structure was sound. Problems arose from gate criteria, not the gating concept.

### 2. Clear Ownership

Single document as source of truth (`VERTEX-AI-EXECUTION-PLAN.md`) prevented confusion.

### 3. Abort Conditions

Plan specified when to stop:

> - **Tenant data leaks between tenants** - Fundamental security failure
> - **Latency consistently > 10s** - UX unacceptable

These weren't triggered, which is good.

### 4. Decision Points

Plan included explicit decision moments:

> After Gate 2, choose:
>
> - Everything works smoothly → Continue to Phase 3
> - Minor issues but functional → Continue, note issues for Phase 7

### 5. Documentation Requirements

Plan referenced existing documentation rather than duplicating:

> → Reference: `vertex-ai-implementation-playbook.md` Section 2.7

---

## What the Plan Got Wrong

### 1. Gate Criteria Were Too Shallow

**Problem:** Gates only verified deployment, not quality.

**Example - Gate 3 criteria:**

```markdown
| Criteria                                      | Check |
| --------------------------------------------- | ----- |
| Marketing Specialist deployed and responding  | ✅    |
| Storefront Specialist deployed and responding | ✅    |
| Research Specialist deployed and responding   | ✅    |
```

**What was needed:**

```markdown
| Criteria                                         | Check |
| ------------------------------------------------ | ----- |
| Marketing Specialist deployed and responding     | ☐     |
| Marketing tools return content, not instructions | ☐     |
| Storefront T3 actions have confirmation params   | ☐     |
| Research sanitize function called on all content | ☐     |
| No dead code in any agent                        | ☐     |
| All agents use shared logger, not console.log    | ☐     |
| Code review completed by second person           | ☐     |
```

### 2. No Code Review Requirement

**Problem:** Plan had no code review between phases.

**Impact:** Issues accumulated across 4 phases before anyone reviewed the code.

**What was needed:**

```markdown
### Pre-Gate Code Review Checklist

- [ ] Another engineer has reviewed all new code
- [ ] Shared patterns extracted (no copy-paste)
- [ ] Security functions called, not just defined
- [ ] Environment variables fail-fast
```

### 3. No Shared Utilities Phase

**Problem:** Plan created standalone agents that couldn't share code.

**Impact:** Same patterns implemented 5 different ways across 5 agents.

**What was needed:**

```markdown
## Phase 2.5: Shared Utilities (Before Third Agent)

- [ ] Extract getTenantId to shared package
- [ ] Extract fetchWithTimeout to shared package
- [ ] Extract logger configuration to shared package
- [ ] All agents import from shared package
```

### 4. Security Deferred to Phase 7

**Problem:** Plan put security in final "Polish" phase.

**Impact:** Security issues in P1 priority blocking Phase 5.

**What was needed:**
Security criteria in every gate:

```markdown
### Gate 3 Security Criteria

- [ ] All T3 actions have programmatic enforcement
- [ ] All external content is sanitized
- [ ] All URLs are validated before fetch
- [ ] No secrets have empty fallbacks
```

### 5. No Failure Mode Testing

**Problem:** Plan only tested happy path.

**Impact:** Resilience issues (timeouts, circuit breakers, backoff) undiscovered.

**What was needed:**

```markdown
### Gate 4 Failure Mode Tests

- [ ] Simulate specialist timeout (60s delay) → Concierge times out at 30s
- [ ] Simulate specialist error → Concierge retries with backoff
- [ ] Simulate 100 concurrent requests → Rate limiter activates
- [ ] Kill specialist mid-request → Graceful error message
```

### 6. Timeline Estimates Wildly Off

**Problem:** 6-week plan completed in ~10 days.

**Impact:** Compressed timeline meant no buffer for quality work.

**What was needed:**
Either:

- More accurate estimates (2 weeks, not 6)
- OR explicit "use extra time for quality" guidance

---

## Recommendations for Future Plans

### 1. Two-Tier Gate Criteria

Every gate should have:

**Tier 1: Functional (required)**

- Does it deploy?
- Does it respond correctly?
- Is tenant isolation working?

**Tier 2: Quality (required)**

- Has code been reviewed?
- Are shared patterns extracted?
- Are security measures in place?
- Do failure modes work correctly?

### 2. Mandatory Code Review Phase

Add explicit code review between major phases:

```markdown
## Phase 3.5: Code Review (1 day)

**Objective:** Review all Phase 3 code before Concierge integration.

- [ ] Another engineer reviews Marketing agent
- [ ] Another engineer reviews Storefront agent
- [ ] Another engineer reviews Research agent
- [ ] Shared patterns identified and extracted
- [ ] Security checklist completed for each agent

**GATE 3.5: Code Review Complete**
All issues must be addressed before Phase 4.
```

### 3. Shared Utilities from Day 1

Before building the second component that shares patterns:

```markdown
## Phase 2.5: Extract Shared Utilities

**Trigger:** Before building Marketing agent (second agent)

- [ ] Create `server/src/agent-v2/shared/` directory
- [ ] Extract getTenantId with 4-tier fallback
- [ ] Extract fetchWithTimeout utility
- [ ] Extract logger configuration
- [ ] Extract environment validation (requireEnv)
- [ ] All subsequent agents MUST use shared utilities
```

### 4. Security in Every Phase

Add security criteria to every gate, not just the final phase:

```markdown
### Security Criteria (Every Gate)

- [ ] No hardcoded secrets or URLs
- [ ] Environment variables fail-fast on missing
- [ ] External content sanitized
- [ ] T3 actions have programmatic enforcement
- [ ] Rate limiting in place
- [ ] Timeouts on all network calls
```

### 5. Failure Mode Testing

Add chaos/failure testing to gate criteria:

```markdown
### Failure Mode Tests (Gate 4+)

- [ ] Timeout test: Mock 60s delay → verify 30s timeout
- [ ] Error test: Mock 500 error → verify retry with backoff
- [ ] Overload test: 100 concurrent → verify rate limiting
- [ ] Crash test: Kill process mid-request → verify graceful error
```

### 6. Timeline Buffers for Quality

If a phase completes early, use the time for quality:

```markdown
### Early Completion Protocol

If a phase completes ahead of schedule:

1. DO NOT proceed immediately to next phase
2. Use remaining time for:
   - Code review
   - Failure mode testing
   - Documentation updates
   - Extracting shared patterns
3. Only proceed when quality criteria met
```

### 7. Documentation Accuracy Gates

Verify documentation matches reality:

```markdown
### Documentation Accuracy (Every Gate)

- [ ] System prompts only reference existing capabilities
- [ ] README reflects current state, not future state
- [ ] API docs match actual endpoints
- [ ] Error messages match actual behavior
```

---

## Improved Gate Template

Use this template for all future gates:

```markdown
## GATE [N]: [Phase Name] Complete

### Functional Criteria (all required)

| Criteria                        | Check |
| ------------------------------- | ----- |
| Component deployed successfully | ☐     |
| Happy path tested and working   | ☐     |
| Tenant isolation verified       | ☐     |
| Response latency within budget  | ☐     |

### Quality Criteria (all required)

| Criteria                                  | Check |
| ----------------------------------------- | ----- |
| Code reviewed by another engineer         | ☐     |
| Shared patterns extracted (no copy-paste) | ☐     |
| No dead code                              | ☐     |
| Uses project patterns (logger, etc.)      | ☐     |

### Security Criteria (all required)

| Criteria                                     | Check |
| -------------------------------------------- | ----- |
| No hardcoded secrets or URLs                 | ☐     |
| Environment variables fail-fast              | ☐     |
| External content sanitized                   | ☐     |
| Trust tier actions enforced programmatically | ☐     |

### Resilience Criteria (Phase 3+)

| Criteria                        | Check |
| ------------------------------- | ----- |
| All network calls have timeouts | ☐     |
| Failures handled gracefully     | ☐     |
| Retries use exponential backoff | ☐     |
| Rate limiting in place          | ☐     |

### Documentation Criteria

| Criteria                                     | Check |
| -------------------------------------------- | ----- |
| Prompts only reference existing capabilities | ☐     |
| README is accurate                           | ☐     |
| Runbook updated                              | ☐     |

### ABORT CONDITIONS

- [Specific conditions that should stop progress]

### DECISION POINT

- [Explicit choices to make before continuing]
```

---

## Appendix: Full Issue Mapping

### Issues by Phase Origin

| Issue | Priority | Phase | Title                          | Root Cause            |
| ----- | -------- | ----- | ------------------------------ | --------------------- |
| 5185  | P1       | 2,4   | getTenantId inconsistency      | Copy-paste divergence |
| 5186  | P1       | 3     | publish_draft no confirmation  | Security deferred     |
| 5187  | P1       | 4     | No request timeouts            | Happy path only       |
| 5188  | P1       | 3     | Marketing returns instructions | No code review        |
| 5189  | P1       | 3     | Dead sanitize function         | Rushed sprint         |
| 5190  | P2       | 4     | Hardcoded fallback URLs        | Dev shortcuts         |
| 5191  | P2       | 2     | Empty secret fallback          | No fail-fast          |
| 5192  | P2       | 4     | Module-level mutable state     | No production review  |
| 5193  | P2       | 4     | No circuit breaker             | Resilience deferred   |
| 5194  | P2       | 4     | No rate limiting               | Security deferred     |
| 5195  | P2       | 3     | Nonexistent specialists        | Doc drift             |
| 5196  | P2       | 2     | console.log not logger         | Pattern not enforced  |
| 5197  | P2       | 3     | Prompt injection duplicated    | No shared utils       |
| 5198  | P2       | 3     | discard_draft no confirm       | Security deferred     |
| 5199  | P2       | 3     | Unused params                  | Dead code             |
| 5200  | P2       | 4     | Retry no backoff               | Resilience deferred   |
| 5201  | P3       | 3     | Research tenantId unused       | Dead code             |
| 5202  | P3       | 3     | HTTP URL validation            | Security deferred     |
| 5203  | P3       | 3     | z.any() content                | Type safety shortcut  |

### Issues by Root Cause

| Root Cause                    | Count | Issues                       |
| ----------------------------- | ----- | ---------------------------- |
| Security deferred to Phase 7  | 5     | 5186, 5194, 5198, 5202, 5203 |
| No code review                | 4     | 5188, 5189, 5199, 5201       |
| Copy-paste without extraction | 3     | 5185, 5196, 5197             |
| Happy path testing only       | 3     | 5187, 5192, 5200             |
| Development shortcuts         | 2     | 5190, 5191                   |
| Documentation drift           | 1     | 5195                         |
| Resilience deferred           | 1     | 5193                         |

### Issues by Gate That Should Have Caught Them

| Gate   | Should Have Caught                                         | Count |
| ------ | ---------------------------------------------------------- | ----- |
| Gate 2 | 5185, 5191, 5196                                           | 3     |
| Gate 3 | 5186, 5188, 5189, 5195, 5197, 5198, 5199, 5201, 5202, 5203 | 10    |
| Gate 4 | 5187, 5190, 5192, 5193, 5194, 5200                         | 6     |

---

## Conclusion

The Vertex AI Agent Rebuild achieved its primary goal: **5 agents deployed and communicating in production**. However, the speed of execution created technical debt that now requires remediation.

**Key Lessons:**

1. Gates must test quality, not just functionality
2. Code review must happen between phases, not after all phases
3. Security must be in every gate, not deferred to "polish"
4. Shared patterns must be extracted before the second copy
5. Failure mode testing must happen before integration

**Next Steps:**

1. Fix 5 P1 issues before continuing Phase 5
2. Apply improved gate template to remaining phases
3. Add code review requirement to Phase 5 and beyond
4. Create shared utilities package for remaining agents

---

**Document Metadata:**

- **Created:** 2026-01-19
- **Author:** Code Review Agent
- **Related:** `plans/VERTEX-AI-EXECUTION-PLAN.md`, `todos/51*-pending*.md`
- **Tags:** retrospective, lessons-learned, process-improvement, agent-v2
