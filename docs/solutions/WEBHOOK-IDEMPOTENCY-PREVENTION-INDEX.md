---
title: Webhook Idempotency Prevention - Documentation Index
category: prevention
tags: [webhooks, idempotency, race-conditions, index]
priority: P1
---

# Webhook Idempotency Prevention - Documentation Index

This index helps you navigate the webhook idempotency prevention documentation. Choose the document that matches your need.

---

## Quick Decision Tree

```
Are you...

├─ In a code review?
│  └─→ Use CODE REVIEW CHECKLIST
│
├─ Implementing a webhook handler?
│  └─→ Start with QUICK REFERENCE, then read FULL STRATEGIES
│
├─ Debugging a race condition?
│  └─→ Jump to "Common Pitfalls" in FULL STRATEGIES
│
├─ Looking for one-page summary?
│  └─→ Use QUICK REFERENCE (print & pin!)
│
└─ Want comprehensive understanding?
   └─→ Read FULL STRATEGIES start to finish
```

---

## Documentation Map

### For Everyone: Start Here

1. **[WEBHOOK-IDEMPOTENCY-QUICK-REFERENCE.md](./WEBHOOK-IDEMPOTENCY-QUICK-REFERENCE.md)** (5 min read)
   - One-page cheat sheet
   - Print and pin to your wall
   - Key patterns at a glance
   - Common mistakes highlighted

### For Implementers: Build It Right

2. **[WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md)** (30 min read)
   - Complete prevention strategies
   - Design patterns with code examples
   - Interface design approaches
   - Testing strategies with real test code
   - Implementation patterns by use case
   - Migration guide for existing handlers
   - Monitoring & observability setup
   - Common pitfalls & fixes

### For Code Reviewers: Check It Properly

3. **[WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md)** (20 min read)
   - 6-phase code review checklist
   - What to look for in each phase
   - Red flags and antipatterns
   - Approval criteria
   - Questions to ask during review

### Reference Materials: Deep Dives

4. **[IDEMPOTENCY_IMPLEMENTATION.md](../../../server/IDEMPOTENCY_IMPLEMENTATION.md)** (Project-specific)
   - Current implementation details
   - Key generation strategies
   - Usage examples in codebase
   - Testing with Stripe CLI
   - Monitoring metrics

### Real Code Examples

5. **[webhook-race-conditions.spec.ts](../../../server/test/integration/webhook-race-conditions.spec.ts)** (Test examples)
   - Concurrent test patterns
   - High-concurrency stress tests
   - Data integrity verification
   - Edge cases

6. **[webhooks.routes.ts](../../../server/src/routes/webhooks.routes.ts)** (Implementation reference)
   - Actual webhook handler
   - Error handling patterns
   - Tenant isolation implementation
   - Logging & monitoring

---

## By Role

### Software Engineer Implementing a Feature

1. Read: [QUICK REFERENCE](./WEBHOOK-IDEMPOTENCY-QUICK-REFERENCE.md)
2. Study: "Implementation Patterns by Use Case" in [FULL STRATEGIES](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md)
3. Reference: [Project Implementation](../../../server/IDEMPOTENCY_IMPLEMENTATION.md)
4. Write: Tests following [Test Examples](../../../server/test/integration/webhook-race-conditions.spec.ts)
5. Review: Your own code with [CODE REVIEW CHECKLIST](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md)

### Code Reviewer

1. Study: [CODE REVIEW CHECKLIST](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md) (5-10 min before reviewing)
2. Reference: [QUICK REFERENCE](./WEBHOOK-IDEMPOTENCY-QUICK-REFERENCE.md) for pattern checking
3. Deep dive: [FULL STRATEGIES](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md) for understanding
4. Verify: Concurrent tests match patterns in [Test Examples](../../../server/test/integration/webhook-race-conditions.spec.ts)

### Tech Lead / Architect

1. Read: [FULL STRATEGIES](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md) (complete understanding)
2. Review: [CODE REVIEW CHECKLIST](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md) (ensure team uses it)
3. Monitor: Team adoption via metrics in [IDEMPOTENCY_IMPLEMENTATION.md](../../../server/IDEMPOTENCY_IMPLEMENTATION.md)
4. Iterate: Update checklists based on real issues encountered

### New Team Member / Onboarding

1. Print: [QUICK REFERENCE](./WEBHOOK-IDEMPOTENCY-QUICK-REFERENCE.md)
2. Read: [FULL STRATEGIES](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md) - "Problem Pattern" and "Solution Pattern"
3. Study: Real examples in [webhooks.routes.ts](../../../server/src/routes/webhooks.routes.ts)
4. Practice: Write a webhook handler following [FULL STRATEGIES](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md) patterns

---

## By Problem

### "I'm seeing race condition bugs"

1. Diagnose: Check [Common Pitfalls](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md#7-common-pitfalls--how-to-avoid-them) section
2. Fix: Follow [Pattern A: Webhook Event Deduplication](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md#pattern-a-webhook-event-deduplication)
3. Test: Add concurrent tests from [Test Strategy](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md#3-test-strategy-concurrent-operations-testing)
4. Verify: Use [CODE REVIEW CHECKLIST](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md) Phase 3

### "I'm implementing a webhook handler"

1. Design: Follow [Pattern A](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md#pattern-a-webhook-event-deduplication) or [Pattern B](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md#pattern-b-idempotency-key-caching)
2. Code: Reference [Project Implementation](../../../server/IDEMPOTENCY_IMPLEMENTATION.md) for patterns
3. Test: Create tests following [Test Examples](../../../server/test/integration/webhook-race-conditions.spec.ts)
4. Review: Self-review with [CODE REVIEW CHECKLIST](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md)

### "I'm reviewing webhook code"

1. Checklist: Use [CODE REVIEW CHECKLIST](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md) - Phase by Phase
2. Verify: Concurrent tests exist and pass (Phase 3)
3. Check: Database constraint exists and is composite key (Phase 1)
4. Ensure: Specific error handling for P2002 (Phase 2)

### "I want to understand the root cause"

1. Pattern: Read "The Problem" section in [QUICK REFERENCE](./WEBHOOK-IDEMPOTENCY-QUICK-REFERENCE.md)
2. Deep dive: Read "Design Pattern: Atomic Record-and-Check" in [FULL STRATEGIES](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md)
3. Visualize: Review [Race Condition Test](../../../server/test/integration/webhook-race-conditions.spec.ts#L113-L150)

### "I need to migrate existing code"

1. Guide: [Migration Guide](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md#8-migration-guide-add-idempotency-to-existing-handler) in FULL STRATEGIES
2. Steps: Follow 4-step process (schema → code → tests → deploy)
3. Verify: Concurrent tests pass before deployment
4. Monitor: Check metrics post-deployment

### "I'm deploying this"

1. Checklist: Use "Deployment Checklist" in [CODE REVIEW CHECKLIST](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md) Phase 6
2. Setup: Configure monitoring per [Monitoring & Observability](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md#6-monitoring--observability)
3. Verify: Check logs for expected "Duplicate webhook" messages
4. Rollback: Have plan from [Migration Guide](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md#8-migration-guide-add-idempotency-to-existing-handler)

---

## Document Structure

### QUICK REFERENCE

```
├─ The Problem (visual)
├─ The Solution (visual)
├─ Implementation Pattern
├─ Database Schema
├─ Concurrent Testing
├─ Tenant Isolation
├─ Error Handling
├─ Common Mistakes (table)
├─ Code Review Red Flags
├─ Test Template
├─ Monitoring
└─ Deployment Checklist
```

**Best for:** Quick lookup, teaching, reference during coding

### FULL STRATEGIES

```
├─ Executive Summary
├─ 1. Design Pattern: Atomic Record-and-Check
├─ 2. Interface Design: Return Success/Failure
├─ 3. Test Strategy: Concurrent Operations Testing
├─ 4. Code Review Checklist for Webhook Handlers
├─ 5. Implementation Patterns by Use Case
│  ├─ Pattern A: Webhook Event Deduplication
│  ├─ Pattern B: Idempotency Key Caching
│  └─ Pattern C: Double-Booking Prevention
├─ 6. Monitoring & Observability
├─ 7. Common Pitfalls & How to Avoid Them
├─ 8. Migration Guide
├─ 9. Quick Reference Checklist
└─ 10. References & Further Reading
```

**Best for:** Understanding, implementation, design decisions, learning

### CODE REVIEW CHECKLIST

```
├─ Phase 1: Design Review
│  ├─ Database Design
│  ├─ Error Handling Strategy
│  └─ Tenant Isolation
├─ Phase 2: Implementation Review
│  ├─ Atomic Operations
│  ├─ Return Values & Semantics
│  └─ tenantId Usage
├─ Phase 3: Testing Review
│  ├─ Concurrency Testing
│  ├─ Data Integrity Verification
│  ├─ Tenant Isolation Tests
│  └─ High-Concurrency Stress Test
├─ Phase 4: Code Quality Review
│  ├─ Logging & Observability
│  └─ Type Safety
├─ Phase 5: Documentation Review
│  ├─ Code Comments
│  └─ Migration Documentation
├─ Phase 6: Deployment & Operations
│  ├─ Deployment Checklist
│  └─ Monitoring Setup
├─ Summary Checklist
├─ Quick Red Flags
└─ Questions to Ask
```

**Best for:** Code review, quality assurance, team standardization

---

## How to Use Each Document

### QUICK REFERENCE - Use This When

- You need a quick refresher (5 min)
- You're writing code and need a pattern (search for "✅")
- You want to check if something is wrong (search for "❌")
- You're in a code review and need to validate something fast
- You're onboarding and need the essentials

**Navigation:**

- Use Ctrl+F to search for patterns
- Look for ✅ (correct patterns) and ❌ (antipatterns)
- Reference the comparison table for common mistakes

### FULL STRATEGIES - Use This When

- You're implementing a new feature (30 min read before coding)
- You want to understand the "why" behind the patterns
- You're designing a new webhook handler
- You need to debug a race condition
- You're migrating existing code
- You're setting up monitoring

**Navigation:**

- Start with "Executive Summary"
- Jump to "Design Pattern" if you understand the problem
- Use "Implementation Patterns" for copy-paste templates
- Reference "Common Pitfalls" when debugging

### CODE REVIEW CHECKLIST - Use This When

- You're reviewing webhook code (open alongside the PR)
- You want to ensure quality standards
- You're training someone on what to look for
- You need to verify approval criteria before merge

**Navigation:**

- Start with Phase 1 (Design)
- Don't skip Phase 3 (Testing - most important)
- Use "Red Flags" section during review
- End with "Approval Criteria" for final check

---

## Key Concepts Across Documents

### Atomic Database Constraint

- **QUICK REFERENCE:** "Use database unique constraints"
- **FULL STRATEGIES:** "Design Pattern: Atomic Record-and-Check" (Section 1)
- **CODE REVIEW:** "Phase 1: Database Design"
- **Real Code:** [webhook.repository.ts](../../../server/src/adapters/prisma/webhook.repository.ts)

### Concurrent Testing

- **QUICK REFERENCE:** "Test with Promise.allSettled"
- **FULL STRATEGIES:** "Test Strategy: Concurrent Operations Testing" (Section 3)
- **CODE REVIEW:** "Phase 3: Testing Review"
- **Real Code:** [webhook-race-conditions.spec.ts](../../../server/test/integration/webhook-race-conditions.spec.ts)

### Tenant Isolation

- **QUICK REFERENCE:** "Composite Key with tenantId"
- **FULL STRATEGIES:** "Tenant Isolation" in multiple sections
- **CODE REVIEW:** "Phase 1: Tenant Isolation" and "Phase 2: tenantId Usage"
- **Real Code:** [webhooks.routes.ts](../../../server/src/routes/webhooks.routes.ts) lines 131-169

### Error Handling (P2002)

- **QUICK REFERENCE:** "Catch specific error code"
- **FULL STRATEGIES:** "Interface Design: Return Success/Failure" (Section 2)
- **CODE REVIEW:** "Phase 2: Error Handling Strategy"
- **Real Code:** [webhook.repository.ts](../../../server/src/adapters/prisma/webhook.repository.ts) lines 102-126

---

## Learning Path

### Beginner (0 race conditions detected)

Day 1: Read QUICK REFERENCE (5 min)
Day 2: Implement following Pattern A from FULL STRATEGIES
Day 3: Self-review with CODE REVIEW CHECKLIST
Day 4: Submit for review, iterate on feedback

### Intermediate (found 1 race condition, fixed it)

Day 1: Read "Common Pitfalls" in FULL STRATEGIES
Day 2: Review existing implementation in webhooks.routes.ts
Day 3: Study tests in webhook-race-conditions.spec.ts
Day 4: Review team's code using CODE REVIEW CHECKLIST

### Advanced (reviewing others' code regularly)

Day 1: Read FULL STRATEGIES start-to-finish
Day 2: Use CODE REVIEW CHECKLIST on 5 real PRs
Day 3: Contribute to team patterns & improvements
Day 4: Mentor juniors using QUICK REFERENCE

---

## FAQ: Which Document Should I Read?

| Question                                     | Answer                                               |
| -------------------------------------------- | ---------------------------------------------------- |
| "I have 5 min. What should I read?"          | QUICK REFERENCE                                      |
| "I need to implement a webhook handler"      | FULL STRATEGIES: Pattern A                           |
| "I'm reviewing code, where's the checklist?" | CODE REVIEW CHECKLIST                                |
| "What's the root cause of race conditions?"  | QUICK REFERENCE: "The Problem"                       |
| "How do I test this properly?"               | FULL STRATEGIES: Section 3                           |
| "What common mistakes should I avoid?"       | QUICK REFERENCE: Mistakes table                      |
| "I'm migrating existing code"                | FULL STRATEGIES: Section 8                           |
| "How do I set up monitoring?"                | FULL STRATEGIES: Section 6                           |
| "Show me real code examples"                 | webhooks.routes.ts & webhook-race-conditions.spec.ts |
| "What should I include in code review?"      | CODE REVIEW CHECKLIST: Phases 1-5                    |

---

## Maintaining These Documents

### When to Update

- New pattern discovered (add to FULL STRATEGIES)
- Common question from team (add to FAQ)
- Real incident occurred (add to Common Pitfalls)
- Project code changes significantly (update Real Code Examples)

### How to Update

1. Update relevant section in FULL STRATEGIES (source of truth)
2. Propagate key changes to QUICK REFERENCE (keep in sync)
3. Update CODE REVIEW CHECKLIST if approval criteria changed
4. Update Real Code references if implementation changed

### Version History

- 2025-12-01: Initial release (3 documents, comprehensive)

---

## Related Documentation

- [PREVENTION-STRATEGIES-INDEX.md](./PREVENTION-STRATEGIES-INDEX.md) - All prevention strategies
- [COMPREHENSIVE-PREVENTION-STRATEGIES.md](./COMPREHENSIVE-PREVENTION-STRATEGIES.md) - System-wide patterns
- [CLAUDE.md](../../../CLAUDE.md) - Project conventions
- [DECISIONS.md](../../../DECISIONS.md) - Architectural decision records (ADR-002: Webhook Idempotency)

---

## Quick Links

### For Implementers

- [Copy-Paste Pattern A](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md#pattern-a-webhook-event-deduplication)
- [Copy-Paste Pattern B](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md#pattern-b-idempotency-key-caching)
- [Test Template](./WEBHOOK-IDEMPOTENCY-QUICK-REFERENCE.md#test-template)

### For Reviewers

- [Phase 1: Design Checklist](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md#phase-1-design-review)
- [Phase 3: Testing Checklist](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md#phase-3-testing-review)
- [Approval Criteria](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md#approval-criteria)

### For Leaders

- [Metrics to Track](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md#key-metrics-to-track)
- [Deployment Checklist](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md#phase-6-deployment--operations)
- [Team Training](./WEBHOOK-IDEMPOTENCY-QUICK-REFERENCE.md)

---

## Print & Pin

You can print these documents for reference:

- **QUICK REFERENCE** (1 page) - Pin at desk
- **CODE REVIEW CHECKLIST** (1-2 pages) - Print for code review sessions
- **Common Mistakes** (from QUICK REFERENCE) - Laminate as desk reference

---

**Questions?** Ask your tech lead or refer to the DECISIONS.md file for architectural context.
