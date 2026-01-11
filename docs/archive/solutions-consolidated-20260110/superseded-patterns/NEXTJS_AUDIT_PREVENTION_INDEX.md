---
title: Next.js Audit Prevention - Complete Index
category: patterns
type: index
tags: [next.js, migration, prevention, audit, reference]
date_created: 2026-01-08
---

# Next.js Audit Prevention - Complete Index

**Status:** Active Prevention System
**Scope:** Next.js App Router migrations, multi-tenant SSR patterns
**Last Updated:** 2026-01-08

---

## Overview

This index consolidates all prevention strategies from the Next.js migration audit. The audit revealed three critical patterns that should be prevented in future migrations.

### Three Core Patterns

1. **Server/Client Import Boundary Tainting** - Files importing server-only modules poison entire component trees
2. **Multi-Reviewer Effectiveness** - Different reviewers catch different error classes
3. **Large Codebase Audit Methodology** - Parallel agents are 4x faster than sequential review

---

## Documentation Structure

### Quick Start (2 minutes)

**Start here for immediate application:**

- **[NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md)** - Print & pin checklist
  - File naming convention (.utils.ts / .server.ts)
  - Multi-reviewer checklist
  - Pre/during/post-migration gates
  - 2-minute read, all essentials covered

### Comprehensive Guides (15-30 minutes)

**Deep understanding of each pattern:**

1. **[NEXTJS_AUDIT_PREVENTION_STRATEGIES.md](NEXTJS_AUDIT_PREVENTION_STRATEGIES.md)** (30 min read)
   - Pattern 1: Import boundary tainting (4 strategies)
   - Pattern 2: Multi-reviewer effectiveness (3 strategies)
   - Pattern 3: Audit methodology (3 strategies)
   - ESLint rules, implementation checklists
   - When to apply each pattern

2. **[NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md](NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md)** (20 min read)
   - Deep dive into tainting mechanism
   - File organization patterns
   - Common mistakes and fixes
   - Detection and migration guide
   - Testing strategies

### Implementation Guide (varies)

**Step-by-step implementation for teams:**

- **[NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md](NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md)** (varies by phase)
  - Phase 1: Setup (2-3 days)
  - Phase 2: First migration (1 week)
  - Phase 3: Full migration (2 weeks)
  - Phase 4: Ongoing prevention (continuous)
  - Team onboarding templates
  - Success criteria and metrics

### Related Context Documents

**Background and context:**

- **[ADR-014: Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)** - Architecture decisions
- **[Next.js Migration Lessons Learned](../code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)** - 10 key lessons from the audit
- **[Multi-Agent Code Review Process](../methodology/multi-agent-code-review-process.md)** - Review methodology overview

---

## Which Document Should I Read?

### "I'm about to start a Next.js migration"

**Read in this order:**

1. [NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md) (2 min)
2. [NEXTJS_AUDIT_PREVENTION_STRATEGIES.md](NEXTJS_AUDIT_PREVENTION_STRATEGIES.md) (30 min)
3. [NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md](NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md) (reference as you build)

### "I need to understand server/client imports"

**Read these:**

1. [NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md](NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md) - Complete guide
2. [NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md) - Checklist
3. [NEXTJS_AUDIT_PREVENTION_STRATEGIES.md](NEXTJS_AUDIT_PREVENTION_STRATEGIES.md) - Strategy section 1

### "I'm reviewing a Next.js migration PR"

**Use these:**

1. [NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md) - Merge gates checklist
2. [NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md](NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md) - Common mistakes section
3. Run `/workflows:review` for comprehensive multi-agent review

### "I need to set up CI/CD and ESLint rules"

**See these sections:**

1. [NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md](NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md) - Phase 4: Prevention System
2. [NEXTJS_AUDIT_PREVENTION_STRATEGIES.md](NEXTJS_AUDIT_PREVENTION_STRATEGIES.md) - ESLint rule section
3. Copy ESLint config from either document

### "I'm training my team on Next.js patterns"

**Share these:**

1. [NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md) - Start here (2 min)
2. [NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md](NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md) - Deep dive (20 min)
3. [NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md](NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md#team-onboarding) - Onboarding section

### "We hit an import error during build"

**Find your error:**

| Error                                                 | Document                                 | Section                 |
| ----------------------------------------------------- | ---------------------------------------- | ----------------------- |
| "is marked with 'server-only' but imported in Client" | NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md | Troubleshooting         |
| "Cannot import X from Y"                              | NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md | Common Mistakes         |
| Build fails in CI but passes locally                  | NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md     | Troubleshooting         |
| Multiple import violations                            | NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md | Detecting Tainted Files |

---

## Key Concepts at a Glance

### 1. Import Tainting

**The Problem:**

```typescript
// ❌ This file is TAINTED because it imports server-only API
import { cookies } from 'next/headers';

export function isAdmin(role?: string) {
  // ← Can't be used by clients!
  return role === 'ADMIN';
}
```

**The Solution:**

```typescript
// ✅ Separate into two files

// Pure utilities (client-safe)
// auth.utils.ts
export function isAdmin(role?: string) {
  return role === 'ADMIN';
}

// Server-only (server-safe)
// auth.server.ts
import 'server-only';
import { cookies } from 'next/headers';
// ...
```

**File Naming Convention:**

- `.utils.ts` = Pure utilities, shareable, no server imports
- `.server.ts` = Server-only functions, has server imports

### 2. Multi-Reviewer Pattern

**The Insight:**
Different reviewers catch different errors:

| Reviewer Type      | Catches           | Single Reviewer Misses? |
| ------------------ | ----------------- | ----------------------- |
| Type Safety        | Build failures    | ✓                       |
| Architecture       | Design violations | ✓                       |
| Code Quality (DRY) | Duplication       | ✓                       |

**Solution:** Use `/workflows:review` for 8-agent parallel review

### 3. Large Codebase Audit

**Speed Comparison:**

- Sequential review: 4 hours (1 reviewer × 4 domains)
- Parallel agents: 1-2 hours (4 agents simultaneously)

**Method:**

1. Create focused exploration agents (one per domain)
2. Launch all in parallel
3. Collect findings in standard format
4. Deduplicate and prioritize

---

## Document Quick Links

### Prevention Strategies (Main Reference)

| Document                                                                             | Purpose                  | Length | Audience          |
| ------------------------------------------------------------------------------------ | ------------------------ | ------ | ----------------- |
| [NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md)                   | Checklists & quick fixes | 2 min  | Everyone          |
| [NEXTJS_AUDIT_PREVENTION_STRATEGIES.md](NEXTJS_AUDIT_PREVENTION_STRATEGIES.md)       | Complete strategies      | 30 min | Architects, leads |
| [NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md](NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md) | Deep technical guide     | 20 min | Developers        |
| [NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md](NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md)         | Phase-by-phase setup     | varies | Project managers  |

### Context & Background

| Document                                                                                                       | Purpose                                  |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| [ADR-014: Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)                     | Why we migrated, what we learned         |
| [Next.js Migration Lessons Learned](../code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md) | 10 key lessons from post-migration audit |
| [Multi-Agent Code Review Process](../methodology/multi-agent-code-review-process.md)                           | How the parallel review worked           |

---

## Key Statistics

### From the Original Audit

| Metric               | Value     |
| -------------------- | --------- |
| Files Changed        | 106       |
| Lines Added          | ~16,000   |
| Phases Complete      | 6         |
| Duration (planned)   | 6-8 weeks |
| Duration (actual)    | 2-3 weeks |
| Code Review Findings | 14        |
| P1 (Critical)        | 8         |
| P2 (Important)       | 5         |
| P3 (Nice-to-have)    | 1         |
| Parallel Agents Used | 8         |
| Total Review Time    | ~2 hours  |

### Prevention Impact

| Metric                          | Before Prevention | With Prevention                 |
| ------------------------------- | ----------------- | ------------------------------- |
| Import tainting errors          | 2-3 per sprint    | 0 (prevented by ESLint)         |
| Code review time                | 4-6 hours         | 1-2 hours (parallel agents)     |
| Build failures from imports     | 3-5               | 0 (caught by ESLint pre-commit) |
| Developer confusion on patterns | High              | Low (clear documentation)       |

---

## Implementation Roadmap

### Week 1: Setup

- [ ] Read [NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md)
- [ ] Read [NEXTJS_AUDIT_PREVENTION_STRATEGIES.md](NEXTJS_AUDIT_PREVENTION_STRATEGIES.md)
- [ ] Follow Phase 1 in [NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md](NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md)

### Week 2: First Module

- [ ] Select first module to refactor
- [ ] Follow Phase 2 in implementation guide
- [ ] Merge refactored module

### Weeks 3-4: Full Migration

- [ ] Apply pattern to all modules
- [ ] Follow Phase 3 in implementation guide
- [ ] Run `/workflows:review` for comprehensive audit

### Ongoing: Prevention

- [ ] Implement Phase 4 in implementation guide
- [ ] Add ESLint rules to pre-commit
- [ ] Update CI/CD pipeline
- [ ] Train team on patterns

---

## ESLint Configuration

Prevents violations automatically:

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "next/headers",
            "importNames": ["cookies", "headers"],
            "message": "Taints entire file. Move to .server.ts"
          },
          {
            "name": "next/navigation",
            "importNames": ["redirect", "notFound"],
            "message": "Server-only. Use in .server.ts only"
          }
        ]
      }
    ]
  }
}
```

See [NEXTJS_AUDIT_PREVENTION_STRATEGIES.md](NEXTJS_AUDIT_PREVENTION_STRATEGIES.md#eslint-prevention) for full config.

---

## Common Questions

### Q: Do I need to do all three patterns?

**A:** It depends:

| Change              | Pattern 1 | Pattern 2 | Pattern 3 |
| ------------------- | :-------: | :-------: | :-------: |
| Small bug fix       |     -     |     -     |     -     |
| Framework migration |     ✓     |     ✓     |     ✓     |
| Auth system         |     ✓     |     ✓     |     ✓     |
| Data access layer   |     ✓     |     -     |     ✓     |
| Pre-launch audit    |     -     |     ✓     |     ✓     |

### Q: What if we're already in the middle of a migration?

**A:** Start with Phase 1 (setup) and apply to new code. Refactor existing code during Phase 2.

### Q: How long does implementation take?

**A:** 3-4 weeks total:

- Phase 1: 2-3 days (setup)
- Phase 2: 1 week (first module)
- Phase 3: 2 weeks (full migration)
- Phase 4: ongoing (maintenance)

### Q: Can we skip any phases?

**A:** No. Each phase builds on the previous:

- Skip Phase 1 → developers confused, inconsistent patterns
- Skip Phase 2 → wrong approach applied to all code
- Skip Phase 3 → technical debt accumulates
- Skip Phase 4 → patterns degrade, violations return

### Q: Which reviewer should look at my PR?

**A:** Use this matrix:

| Change Type | Required                   | Optional |
| ----------- | -------------------------- | -------- |
| Migration   | Type Safety + Architecture | DRY      |
| Auth        | Security + Type Safety     | DRY      |
| Data Access | Security + Performance     | DRY      |

Or run `/workflows:review` for all 8 agents.

---

## Getting Help

### For Questions About:

- **Import tainting mechanism:** [NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md](NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md)
- **ESLint configuration:** [NEXTJS_AUDIT_PREVENTION_STRATEGIES.md](NEXTJS_AUDIT_PREVENTION_STRATEGIES.md#eslint-prevention)
- **Implementation timeline:** [NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md](NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md)
- **Multi-reviewer process:** [Multi-Agent Code Review Process](../methodology/multi-agent-code-review-process.md)
- **Specific build error:** Troubleshooting section in [NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md](NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md)

### For Reviewers:

Use [NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md) merge gates checklist

### For Project Managers:

Reference [NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md](NEXTJS_AUDIT_IMPLEMENTATION_GUIDE.md#timeline-summary) timeline and success criteria

### For Individual Contributors:

Start with [NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md), then [NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md](NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md)

---

## Document Maintenance

| Document              | Last Updated | Maintainer | Status |
| --------------------- | ------------ | ---------- | ------ |
| This index            | 2026-01-08   | Mike Young | Active |
| Quick Reference       | 2026-01-08   | Mike Young | Active |
| Prevention Strategies | 2026-01-08   | Mike Young | Active |
| Best Practices        | 2026-01-08   | Mike Young | Active |
| Implementation Guide  | 2026-01-08   | Mike Young | Active |

**Update frequency:** Quarterly or when new patterns discovered

---

## Summary

The Next.js audit revealed three critical patterns to prevent in future migrations:

1. **Separate `.utils.ts` from `.server.ts`** to avoid import tainting
2. **Use parallel multi-reviewer approach** to catch all error classes
3. **Use parallel agents** to audit large codebases efficiently

All patterns are documented with:

- Quick reference checklist (2 min)
- Comprehensive strategies (30 min)
- Technical deep dives (20 min)
- Phase-by-phase implementation (3-4 weeks)

**Get started:** Read [NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md) now (2 minutes)

---

## Tags

`next.js` `migration` `prevention` `strategies` `audit` `server-components` `import-tainting` `code-review` `best-practices` `implementation` `index`
