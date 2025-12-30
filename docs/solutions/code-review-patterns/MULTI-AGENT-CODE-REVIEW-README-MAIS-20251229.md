# Multi-Agent Code Review Prevention Strategies

**Created:** 2025-12-29
**Status:** Complete
**Audience:** All engineers, especially those building agent/chatbot features

---

## Quick Start (2 Minutes)

1. **New to multi-agent reviews?** → Start here: [Delivery Summary](./MULTI-AGENT-CODE-REVIEW-DELIVERY-SUMMARY-MAIS-20251229.md)

2. **Before every commit?** → Use this: [Quick Reference](./MULTI-AGENT-CODE-REVIEW-QUICK-REFERENCE-MAIS-20251229.md) (print it!)

3. **Doing a code review?** → Check this: [Prevention Strategies](./MULTI-AGENT-CODE-REVIEW-PREVENTION-STRATEGIES-MAIS-20251229.md) (Part 1, "Agent Assignment Matrix")

4. **Setting up your team?** → Follow this: [Implementation Guide](./MULTI-AGENT-CODE-REVIEW-IMPLEMENTATION-GUIDE-MAIS-20251229.md)

---

## Documents Overview

### 1. Delivery Summary (5 min read)

**File:** `MULTI-AGENT-CODE-REVIEW-DELIVERY-SUMMARY-MAIS-20251229.md`

Start here if you want an overview. Covers:

- What was delivered (4 documents)
- Key findings from analysis
- How to use these docs
- Quick reference

**Best for:** First-time readers, team leaders, decision makers

---

### 2. Quick Reference (5 min read + daily use)

**File:** `MULTI-AGENT-CODE-REVIEW-QUICK-REFERENCE-MAIS-20251229.md`

Print this and pin to your desk. Daily reference with:

- Agent assignment matrix (30 seconds to find right reviewer)
- 3-minute pre-commit checks (copy-paste ready)
- 4 anti-patterns with code examples
- Database quick checks
- React patterns
- Error handling template
- Command reference

**Best for:** Daily development work, code reviews, quick lookups

---

### 3. Prevention Strategies (20 min read)

**File:** `MULTI-AGENT-CODE-REVIEW-PREVENTION-STRATEGIES-MAIS-20251229.md`

Deep dive into:

**Part 1: Running Effective Multi-Agent Reviews**

- When parallel agents work (large changes, multiple domains, quality gates)
- Which agents to assign (assignment matrix)
- How to synthesize findings (categorize, identify patterns, create dependencies)

**Part 2: Common Patterns to Watch For**

- Sequential execution where parallel is possible
- Nested transactions in PostgreSQL
- Missing validation in recovery paths
- Information leakage in error messages

**Part 3: Future Agent/Chatbot PR Checklist**

- Architecture & dependencies
- Data isolation & security
- Proposal execution flow
- Database performance
- React patterns
- Testing
- Code quality
- Environment

**Part 4: Files to Monitor**

- Core agent files
- Type declaration files
- Database schema files
- Test files

**Best for:** Code reviewers, architects, engineers implementing agent features

---

### 4. Implementation Guide (15 min setup + ongoing)

**File:** `MULTI-AGENT-CODE-REVIEW-IMPLEMENTATION-GUIDE-MAIS-20251229.md`

Step-by-step integration:

**Phase 1: Setup (1 hour)**

- PR template
- Pre-commit hook
- ESLint rules
- Quality gate script

**Phase 2: CI/CD Integration (1 hour)**

- GitHub Actions
- Pre-submission automation

**Phase 3: Developer Workflow (ongoing)**

- Daily checklist
- Per-commit verification
- Multi-agent review requests
- Code review synthesis

**Phase 4: Maintenance (weekly)**

- Quality report script
- Agent feature audit

**Phase 5: Scaling (team)**

- Team guidelines
- Onboarding template

**Plus:** Troubleshooting, metrics, rollout plan

**Best for:** Tech leads, DevOps, team onboarding

---

## Reading Paths by Role

### Software Engineer (Building Features)

1. Read: Quick Reference (5 min) - keep at desk
2. Before first commit: Run pre-submission script from Implementation Guide
3. When code reviewing: Use Prevention Strategies Part 1 (Agent Assignment)
4. Deep dive: Read Prevention Strategies Part 2 (Anti-patterns)

**Total setup time:** 15 minutes

### Code Reviewer

1. Read: Quick Reference (5 min)
2. Bookmark: Prevention Strategies Part 1 (Agent Assignment Matrix)
3. For complex reviews: Use Prevention Strategies Part 3 (PR Checklist)
4. Optional: Read Part 2 (Anti-patterns) for context

**Total setup time:** 10 minutes

### Team Lead / Tech Lead

1. Read: Delivery Summary (5 min)
2. Read: Implementation Guide Phase 5 (Team Integration)
3. Plan: Use Rollout Plan from Implementation Guide
4. Reference: Keep Prevention Strategies bookmarked

**Total setup time:** 20 minutes

### DevOps Engineer

1. Read: Implementation Guide Phase 2 (CI/CD)
2. Setup: GitHub Actions + pre-submission scripts
3. Monitor: Phase 4 (Weekly quality reports)
4. Reference: Quick Reference for metrics

**Total setup time:** 1-2 hours

### New Team Member

1. Read: Delivery Summary (5 min)
2. Read: Quick Reference (5 min)
3. Follow: Implementation Guide Phase 5 (Onboarding template)
4. First PR: Use agent/chatbot checklist from Prevention Strategies Part 3

**Total setup time:** 1 hour

---

## Key Takeaways

### The Core Problem

Manual code reviews miss issues that multi-agent reviews catch (40% more issues with 6+ specialized agents).

### The Solution

Assign domain-specific agents in parallel:

- **architecture-strategist** → Circular dependencies
- **typescript-reviewer** → Type safety
- **security-sentinel** → Security
- **performance-oracle** → Database performance
- **code-simplicity-reviewer** → Readability

### The Anti-Patterns to Avoid

1. Sequential execution → Slow operations
2. Nested transactions → Complex error handling
3. No validation in recovery → Stale data execution
4. Leaky error messages → Information disclosure

### The Implementation

- 5-phase rollout (2 hours setup + ongoing)
- CI/CD integration with GitHub Actions
- Pre-commit hooks for quality gates
- Weekly metrics tracking

---

## Before Your Next PR

```bash
# Run this before git push
./scripts/pre-submission-check.sh

# If agent/chatbot changes, request review
/workflows:review --agents architecture-strategist,security-sentinel,typescript-reviewer
```

---

## Weekly Checklist

Every Friday:

```bash
# Run quality report
./scripts/weekly-quality-report.sh

# Review metrics
# - Circular dependencies: 0 (target)
# - TypeScript errors: 0 (target)
# - Test pass rate: >95% (target)
```

---

## Monthly Audit

For agent features:

```bash
# Verify executor registrations
rg "registerProposalExecutor" server/src/agent/executors/index.ts | wc -l

# Check tenant isolation
rg "tenantId" server/src/routes/agent.routes.ts | wc -l

# Review error handling
rg "ErrorMessages" server/src/agent --type ts | wc -l
```

---

## Questions?

**Q: Where do I find help?**
A: See "Reading Paths by Role" above. Start with the document for your scenario.

**Q: How do I request multi-agent review?**
A:

```markdown
/workflows:review --agents architecture-strategist,security-sentinel,typescript-reviewer
```

**Q: What if a check fails?**
A: Fix the issue and re-run. All checks are blockers before merge.

**Q: Can I skip checks if I'm in a hurry?**
A: No. The checks catch issues that would take 10x longer to debug later.

**Q: How do I contribute improvements?**
A: Edit the relevant document and run `/workflows:compound` to capture the solution.

---

## Document Statistics

| Document              | Lines     | Size      | Read Time     |
| --------------------- | --------- | --------- | ------------- |
| Prevention Strategies | 996       | 31 KB     | 20-30 min     |
| Quick Reference       | 386       | 8.3 KB    | 5 min         |
| Implementation Guide  | 741       | 16 KB     | 15 min        |
| Delivery Summary      | 411       | 13 KB     | 5 min         |
| **Total**             | **2,534** | **68 KB** | **45-65 min** |

---

## Navigation

**Jump to:**

- [Full Prevention Strategies Guide](./MULTI-AGENT-CODE-REVIEW-PREVENTION-STRATEGIES-MAIS-20251229.md)
- [Quick Reference (Print This!)](./MULTI-AGENT-CODE-REVIEW-QUICK-REFERENCE-MAIS-20251229.md)
- [Implementation Guide](./MULTI-AGENT-CODE-REVIEW-IMPLEMENTATION-GUIDE-MAIS-20251229.md)
- [Delivery Summary](./MULTI-AGENT-CODE-REVIEW-DELIVERY-SUMMARY-MAIS-20251229.md)

---

**Last Updated:** 2025-12-29
**Status:** Ready for team use
**Next Review:** 2026-01-29 (monthly)
