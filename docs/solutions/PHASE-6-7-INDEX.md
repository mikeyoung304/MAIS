---
module: MAIS
type: index
date: 2026-01-02
tags: [agent-eval, phase-6-7, index, navigation, solutions]
---

# Phase 6-7 Agent Evaluation Remediation - Complete Index

**Date:** 2026-01-02
**Status:** Complete (Phase 1-4 + Phase 7 remediation)
**Scope:** 15 solutions extracted and documented
**Audience:** All engineers working on agent evaluation features

---

## Document Map

### Quick Start (2-5 Minutes)

Start here if you just want the essentials:

**[Phase-6-7-Solutions-Summary-MAIS-20260102.md](./Phase-6-7-Solutions-Summary-MAIS-20260102.md)** (7 KB, 5 min read)

- 15 solutions in table format
- Before/after code examples
- File locations with line numbers
- 2-minute code review checklist
- Quick learning path

### Comprehensive Reference (15-30 Minutes)

Read this for deep understanding:

**[Phase-6-7-Agent-Evaluation-Solutions-Extract-MAIS-20260102.md](./Phase-6-7-Agent-Evaluation-Solutions-Extract-MAIS-20260102.md)** (34 KB, 20 min read)

- Complete explanation of all 15 solutions
- What was the problem
- What was the fix
- Code examples (concrete + patterns)
- Why it matters (business/technical)
- Implementation checklist
- Testing patterns

### Original Documentation

Reference the original comprehensive guides:

**Phase 1-4 (P1 Issues):**

- [agent-evaluation-system-remediation-MAIS-20260102.md](./agent-evaluation-system-remediation-MAIS-20260102.md) - 7 P1 fixes with Kieran/DHH patterns
- [patterns/agent-evaluation-remediation-prevention-MAIS-20260102.md](./patterns/agent-evaluation-remediation-prevention-MAIS-20260102.md) - Prevention strategies for Phase 1-4

**Phase 7 (P2 Issues):**

- [patterns/P2_AGENT_EVAL_SUMMARY-MAIS-20260102.md](./patterns/P2_AGENT_EVAL_SUMMARY-MAIS-20260102.md) - Executive summary of P2 issues
- [patterns/P2_AGENT_EVAL_QUICK_REFERENCE-MAIS-20260102.md](./patterns/P2_AGENT_EVAL_QUICK_REFERENCE-MAIS-20260102.md) - 30-second reference
- [patterns/P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md](./patterns/P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md) - Deep prevention guide

---

## 15 Solutions at a Glance

### Phase 1-4: P1 Critical Issues

| #   | Solution                | Category      | Complexity |
| --- | ----------------------- | ------------- | ---------- |
| 1   | DI Constructor Ordering | Architecture  | Medium     |
| 2   | Tenant Scoping          | Security      | Critical   |
| 3   | Promise Cleanup         | Performance   | Medium     |
| 4   | Type Safety (Prisma 7)  | Code Quality  | Medium     |
| 5   | Domain Errors           | Architecture  | Simple     |
| 6   | Database Indexes        | Performance   | Simple     |
| 7   | JSON Type Casting       | Compatibility | Simple     |

**Where to Learn:** Full Solutions Extract, Section "Phase 1-4"

### Phase 6: Code Quality

| #   | Solution                | Category       | Complexity |
| --- | ----------------------- | -------------- | ---------- |
| 8   | PII Redactor Extraction | DRY            | Simple     |
| 9   | N+1 Query Fix           | Performance    | Simple     |
| 10  | Orphaned Data Cleanup   | Data Integrity | Simple     |

**Where to Learn:** Full Solutions Extract, Section "Phase 6"

### Phase 7: P2 Security & Quality

| #   | Solution                 | Category    | Complexity |
| --- | ------------------------ | ----------- | ---------- |
| 11  | tenantId in Queries      | Security    | Simple     |
| 12  | CLI Validation           | Reliability | Simple     |
| 13  | Duplicated DI Extraction | DRY         | Simple     |
| 14  | Silent Test Skips        | Testing     | Simple     |
| 15  | Sequential Processing    | Performance | Medium     |

**Where to Learn:** Full Solutions Extract, Section "Phase 7"

---

## How to Use These Documents

### For Code Authors

**Before implementing agent-eval features:**

1. Read Summary (5 min): [Phase-6-7-Solutions-Summary-MAIS-20260102.md](./Phase-6-7-Solutions-Summary-MAIS-20260102.md)
2. Reference the Checklist (2 min)
3. Check file locations for working examples

**During code review comments:**

Use the quick reference in Summary to link patterns:

```markdown
Check Solution 2 (Tenant Scoping):
→ server/src/agent/evals/pipeline.ts#123

Check Solution 12 (CLI Validation):
→ server/scripts/run-eval-batch.ts#90-96
```

---

### For Code Reviewers

**2-minute review process:**

1. Open Summary → use Checklist section
2. Check 4 key patterns:
   - tenantId in WHERE clauses (Solution 11)
   - CLI args validated with Zod (Solution 12)
   - No duplicated DI blocks (Solution 13)
   - No early return() in tests (Solution 14)
3. Link to Full Extract if detailed explanation needed

**Common review comments:**

```
💡 Pattern 2 (Tenant Scoping):
All database methods need tenantId as first parameter.
See: Phase-6-7-Solutions-Summary-MAIS-20260102.md

💡 Pattern 12 (CLI Validation):
Validate CLI arguments with Zod before use.
See: server/scripts/run-eval-batch.ts#90-96
```

---

### For Onboarding New Team Members

**Week 1: Foundations**

1. Read Summary (5 min)
2. Watch video: "Agent Evaluation System Overview" (15 min)
3. Implement one simple fix (e.g., Solution 11 - tenantId)

**Week 2: Deep Dive**

1. Read Full Solutions Extract (20 min)
2. Review 3 key files:
   - `server/src/agent/evals/pipeline.ts` - All phase 1 solutions
   - `server/src/lib/pii-redactor.ts` - Solution 8
   - `server/scripts/run-eval-batch.ts` - Solutions 11, 12, 15

**Week 3: Internalization**

1. Implement 2-3 solutions in real code
2. Present one pattern to team
3. Contribute improvement to documentation

---

### For DevOps / Tooling Teams

**To automate detection (optional):**

See [patterns/P2_AGENT_EVAL_ESLINT_RULES-MAIS-20260102.md](./patterns/P2_AGENT_EVAL_ESLINT_RULES-MAIS-20260102.md)

Recommended rollout:

- Week 1: `no-silent-test-skips` rule
- Week 2: `no-duplicated-di-initialization` rule
- Week 3: `require-tenant-id-in-queries` rule

---

## Search Guide

**Looking for:**

| Topic                           | Document            | Section                         |
| ------------------------------- | ------------------- | ------------------------------- |
| How to fix constructor ordering | Solutions Extract   | Solution 1                      |
| Tenant isolation patterns       | Solutions Extract   | Solution 2                      |
| Memory leak prevention          | Solutions Extract   | Solution 3                      |
| Prisma 7 JSON casting           | Solutions Extract   | Solution 4                      |
| Error handling architecture     | Solutions Extract   | Solution 5                      |
| Database index patterns         | Solutions Extract   | Solution 6                      |
| PII redaction                   | Solutions Extract   | Solution 8                      |
| N+1 query prevention            | Solutions Extract   | Solution 9                      |
| Database cleanup jobs           | Solutions Extract   | Solution 10                     |
| Defense-in-depth security       | Solutions Extract   | Solution 11                     |
| CLI validation                  | Solutions Extract   | Solution 12                     |
| DI code deduplication           | Solutions Extract   | Solution 13                     |
| Test skip patterns              | Solutions Extract   | Solution 14                     |
| Parallelization strategies      | Solutions Extract   | Solution 15                     |
| Quick reference                 | Summary             | Entire document                 |
| Code review checklist           | Summary             | Section "2-Minute Checklist"    |
| Before/after examples           | Summary             | Section "Before/After Examples" |
| Prevention strategies           | P2 Prevention Guide | All sections                    |
| ESLint automation               | P2 ESLint Rules     | All sections                    |

---

## Key Takeaways

### Security

- **Tenant Isolation:** Always include tenantId in queries (Solution 2, 11)
- **Defense-in-Depth:** Multi-layer isolation validates at every step
- **CLI Validation:** Fail fast with validation errors (Solution 12)

### Performance

- **Database Indexes:** Composite indexes on (tenantId, field) (Solution 6)
- **Batch Operations:** Use updateMany(), not loops (Solution 9)
- **Concurrent Processing:** Parallel workers with rate limiting (Solution 15)

### Code Quality

- **DI Pattern:** Dependencies before config (Solution 1)
- **Type Safety:** Use type guards, never ! assertions (Solution 4)
- **No Duplication:** Extract shared code to helpers (Solutions 8, 13)

### Testing

- **Visible Skips:** Use it.skipIf(), not early returns (Solution 14)
- **Tenant Isolation:** Integration tests verify cross-tenant safety
- **Performance Tests:** Verify index usage with benchmarks

---

## File Locations (All Code)

**Core Implementations:**

```
server/src/agent/evals/
  ├── pipeline.ts           (Solutions 1, 2, 3, 4, 7)
  ├── evaluator.ts          (Solution 1)
  └── agent-eval-errors.ts  (Solution 5)

server/src/agent/feedback/
  └── review-queue.ts       (Solutions 2, 4, 9)

server/src/lib/
  ├── pii-redactor.ts       (Solution 8)
  └── errors/
      └── agent-eval-errors.ts (Solution 5)

server/src/jobs/
  └── cleanup.ts            (Solution 10)

server/src/di.ts            (Solution 13)

server/prisma/
  └── schema.prisma         (Solution 6 - indexes)

server/scripts/
  └── run-eval-batch.ts     (Solutions 11, 12, 15)

server/test/
  └── agent-eval/
      └── tenant-isolation.test.ts (Solution 14)
```

---

## Impact Summary

| Category              | Before                       | After                    | Improvement                |
| --------------------- | ---------------------------- | ------------------------ | -------------------------- |
| **Query Performance** | 100-500ms                    | <10ms                    | 10-50x faster              |
| **Database Queries**  | N (1000s in batch)           | 1-10                     | Batch operations           |
| **Memory Usage**      | Growing unbounded            | Stable                   | No leaks                   |
| **Test Coverage**     | Silent skips                 | Visible status           | True CI metrics            |
| **Concurrent Load**   | Sequential                   | 4 workers                | 3-5x throughput            |
| **Security Issues**   | High (cross-tenant possible) | P0 (tenantId everywhere) | Zero cross-tenant exposure |
| **Code Duplication**  | 200+ lines                   | 0 lines                  | 100% eliminated            |

---

## Maintenance & Updates

**This documentation is living:**

- Updated whenever agent evaluation system changes
- Links to source code are maintained
- Examples kept in sync with actual code
- Prevention strategies prevent similar issues

**To update this index:**

1. New solution? Add to appropriate phase section
2. File moved? Update file locations
3. New document? Add to document map above

---

## Related Learning

**From CLAUDE.md:**

- Critical Patterns: `docs/solutions/patterns/mais-critical-patterns.md`
- Multi-Tenant Guide: `docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`
- Compound Engineering: `CLAUDE.md` → "Compound Engineering" section

**From Code:**

- DI Pattern: Read `server/src/di.ts` for full container setup
- Tenant Pattern: Read `server/src/middleware/tenant.ts` for resolution
- Error Pattern: Read `server/src/lib/errors/base.ts` for base class

---

## Next Steps

**This week:**

- [ ] Read Summary (5 min)
- [ ] Share with team
- [ ] Add to PR template

**This month:**

- [ ] Use checklist on all agent-eval PRs
- [ ] Implement 2-3 solutions in your code
- [ ] Suggest ESLint rules for automation

**This quarter:**

- [ ] All 4 ESLint rules in CI pipeline
- [ ] Integrate checklist into code review workflow
- [ ] Document similar patterns from other domains

---

## FAQ

**Q: Do I need to read all documents?**
A: Start with Summary (5 min). Read Full Extract if you're implementing or need deep understanding.

**Q: Where are working examples?**
A: In the code files listed in "File Locations". Each has inline comments.

**Q: How long does this take to learn?**
A: 5 minutes for summary, 20 minutes for full understanding, 1 hour to implement in your code.

**Q: Can I use these patterns elsewhere?**
A: Yes! All 15 apply across the entire codebase. Examples are agent-eval specific, but patterns are universal.

**Q: Are all 15 issues fixed?**
A: Yes, all fixed in commits fcf6004c, 39d9695f, 458702e7, face8697. This documentation prevents recurrence.

**Q: How do I set up ESLint automation?**
A: See `patterns/P2_AGENT_EVAL_ESLINT_RULES-MAIS-20260102.md`. Recommended: Start with `no-silent-test-skips`.

---

## Version History

| Version | Date       | Changes                                                   |
| ------- | ---------- | --------------------------------------------------------- |
| 1.0     | 2026-01-02 | Initial release - Complete Phase 6-7 solutions extraction |

---

## Document Stats

| Document        | Size  | Time   | Purpose                          |
| --------------- | ----- | ------ | -------------------------------- |
| This Index      | 8 KB  | 5 min  | Navigation & overview            |
| Quick Summary   | 7 KB  | 5 min  | Essential patterns + checklist   |
| Full Extract    | 34 KB | 20 min | Complete explanations + examples |
| Phase 1-4 Guide | 25 KB | 15 min | Prevention strategies            |
| Phase 7 Summary | 8 KB  | 5 min  | Executive overview               |
| P2 Prevention   | 20 KB | 15 min | Deep prevention guide            |
| P2 ESLint Rules | 6 KB  | 10 min | Automation setup                 |

**Total:** ~108 KB, comprehensive coverage

---

**Start Reading:**

1. **I have 5 minutes:** [Phase-6-7-Solutions-Summary-MAIS-20260102.md](./Phase-6-7-Solutions-Summary-MAIS-20260102.md)
2. **I have 20 minutes:** [Phase-6-7-Agent-Evaluation-Solutions-Extract-MAIS-20260102.md](./Phase-6-7-Agent-Evaluation-Solutions-Extract-MAIS-20260102.md)
3. **I need deep context:** [agent-evaluation-system-remediation-MAIS-20260102.md](./agent-evaluation-system-remediation-MAIS-20260102.md)

---

**Last Updated:** 2026-01-02
**Maintained By:** Prevention Engineering Team
**Audience:** All engineers working with agent evaluation system
