# Documentation Hygiene Sprint

**Priority:** P1 - Execute after P0 security fixes
**Total Time:** ~8 hours
**North Star:** Each unit of work should make future work easier

---

## Problem Statement

Documentation entropy is violating compound engineering principles:

- 7 files for agent architecture (should be 2)
- 360 completed TODOs still in active directory
- 3 major features without ADRs
- 262 prevention strategies with significant duplication
- CLAUDE.md has 4 stale items

**Impact:** Future developers spend 7.5x longer finding answers than necessary.

---

## Phase 1: Quick Wins (30 minutes)

### 1.1 Archive Completed TODOs

```bash
cd /Users/mikeyoung/CODING/MAIS

# Create archive directory
mkdir -p todos/archive/2025-12-completed

# Move all completed TODOs (001-360 range)
mv todos/*-complete-*.md todos/archive/2025-12-completed/

# Verify only pending/deferred remain
ls todos/*.md | wc -l  # Should be ~15-20 files
```

**Expected result:** `todos/` directory drops from 448 → ~20 files

### 1.2 Update CLAUDE.md Test Count

**File:** `CLAUDE.md` line ~35

```markdown
# FROM:

- 771 server tests + 114 E2E tests (22 passing after migration fixes)

# TO:

- 771 server tests + 114 E2E tests
```

### 1.3 Add Dark Mode to Current Status

**File:** `CLAUDE.md` line ~25

```markdown
# ADD after "Current branch: `main` (production-ready)":

- Dark mode: COMPLETE (Graphite Dark with Electric Sage brand refresh)
- Growth Assistant: COMPLETE (two-phase proposal/executor pattern)
```

---

## Phase 2: Agent Architecture Consolidation (2 hours)

### 2.1 Current State (7 files, 128KB)

```
docs/solutions/agent-design/
├── AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (26KB)
├── AGENT-ARCHITECTURE-INDEX-MAIS-20251228.md (13KB)
├── AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md (11KB)
├── AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md (5KB)
├── AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md (50KB)
├── AGENT-TOOL-QUICK-CHECKLIST-MAIS-20251228.md (11KB)
└── TODO-450-FALSE-POSITIVE-ARCHITECTURE-ANALYSIS.md (12KB)
```

### 2.2 Target State (2 files, ~40KB)

```
docs/solutions/agent-design/
├── AGENT-ARCHITECTURE.md           # The decision + rationale (merged from 4 files)
└── AGENT-CHECKLIST.md              # Quick reference (merged from 2 files)
```

### 2.3 Consolidation Steps

**Step 1: Create AGENT-ARCHITECTURE.md**

Merge these into one coherent document:

- `AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md` (core decision)
- `AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md` (evaluation criteria)
- `AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md` (prevention strategies)
- `TODO-450-FALSE-POSITIVE-ARCHITECTURE-ANALYSIS.md` (case study)

**Structure:**

```markdown
# Agent Architecture Decision

## Summary

The proposal/executor pattern IS the agent service layer.

## Decision

[From AGENT-TOOL-ARCHITECTURE-DECISION]

## Evaluation Criteria

[From AGENT-ARCHITECTURE-EVALUATION]

## Prevention Strategies

[Top 10 from AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES]

## Case Study: TODO-450 False Positive

[Condensed from TODO-450 analysis]
```

**Step 2: Create AGENT-CHECKLIST.md**

Merge these:

- `AGENT-ARCHITECTURE-REVIEW-CHECKLIST-MAIS-20251228.md`
- `AGENT-TOOL-QUICK-CHECKLIST-MAIS-20251228.md`

**Structure:**

```markdown
# Agent Architecture Checklist

## Quick Decision Tree

[From QUICK-CHECKLIST]

## Code Review Checklist

[From REVIEW-CHECKLIST]

## Common Mistakes

[Condensed list]
```

**Step 3: Archive originals**

```bash
mkdir -p docs/archive/2025-12/agent-design-consolidation
mv docs/solutions/agent-design/*-MAIS-20251228.md docs/archive/2025-12/agent-design-consolidation/
```

**Step 4: Update CLAUDE.md references**

Replace all references to old filenames with new consolidated names.

---

## Phase 3: Create Missing ADRs (2 hours)

### 3.1 ADR-016: Growth Assistant Two-Phase Execution

**File:** `docs/adrs/ADR-016-growth-assistant-two-phase-execution.md`

```markdown
# ADR-016: Growth Assistant Two-Phase Execution Pattern

## Status

Accepted

## Context

The AI Business Growth Agent needs to make database changes safely while maintaining
user trust and audit trails.

## Decision

Implement a two-phase command pattern:

1. **Phase 1 (Tool):** User query → LLM → Tool call → Proposal (preview)
2. **Phase 2 (Executor):** User confirms → Executor re-validates → Prisma → Result

Read tools use direct Prisma queries (idempotent, no approval needed).
Write tools create proposals with trust tiers (T1/T2/T3).

## Consequences

- Transparency: Users see what will happen before approval
- Safety: Executor re-validates ownership before mutation
- Audit: All proposals are logged

## References

- `server/src/agent/tools/read-tools.ts`
- `server/src/agent/tools/write-tools.ts`
- `server/src/agent/proposals/proposal.service.ts`
```

### 3.2 ADR-017: Dark Mode Brand System

**File:** `docs/adrs/ADR-017-dark-mode-brand-system.md`

```markdown
# ADR-017: Dark Mode Brand System

## Status

Accepted

## Context

MAIS needed a distinctive visual identity that works in both light and dark modes
while maintaining brand consistency.

## Decision

Implement "Graphite Dark with Electric Sage":

- Primary background: Graphite (#1a1a1a)
- Accent color: Electric Sage (#7fb069)
- System-preference detection with manual toggle
- CSS custom properties for theme switching

## Consequences

- Consistent brand across light/dark modes
- Reduced eye strain for extended use
- Accessible contrast ratios (WCAG AA)

## References

- `docs/design/BRAND_VOICE_GUIDE.md`
- `apps/web/src/styles/globals.css`
```

### 3.3 ADR-018: Landing Page Config-Driven Architecture

**File:** `docs/adrs/ADR-018-landing-page-config-driven.md`

```markdown
# ADR-018: Landing Page Config-Driven Architecture

## Status

Accepted

## Context

Tenant landing pages need flexible content without code changes.

## Decision

Implement page-based configuration system:

- 7 page types: home, about, services, faq, contact, gallery, testimonials
- 7 section types: hero, text, gallery, testimonials, faq, contact, cta
- Config stored in tenant.landingPageConfig JSON
- SectionRenderer dispatches to modular components

## Consequences

- Non-technical users can modify landing pages
- New section types require code changes
- Migration path from legacy config via normalizeToPages()

## References

- `packages/contracts/src/schemas/landing-page.schema.ts`
- `apps/web/src/lib/tenant.ts`
- `apps/web/src/components/tenant/SectionRenderer.tsx`
```

---

## Phase 4: Create Documentation Index (1 hour)

### 4.1 Create /docs/INDEX.md

**File:** `docs/INDEX.md`

```markdown
# MAIS Documentation Index

> **Start here** to find what you need.

## Learning the System

| Topic            | Document                            | Description                                   |
| ---------------- | ----------------------------------- | --------------------------------------------- |
| Project overview | [CLAUDE.md](/CLAUDE.md)             | Start here - commands, patterns, architecture |
| Architecture     | [ARCHITECTURE.md](/ARCHITECTURE.md) | System design, multi-tenant patterns          |
| Development      | [DEVELOPING.md](/DEVELOPING.md)     | Local setup, commands, workflows              |
| Testing          | [TESTING.md](/TESTING.md)           | Test strategy, running tests                  |

## Architectural Decisions (ADRs)

| ADR                                                                   | Decision                      |
| --------------------------------------------------------------------- | ----------------------------- |
| [ADR-006](/docs/adrs/ADR-006-modular-monolith-architecture.md)        | Modular monolith architecture |
| [ADR-007](/docs/adrs/ADR-007-mock-first-development.md)               | Mock-first development        |
| [ADR-013](/docs/adrs/ADR-013-postgresql-advisory-locks.md)            | Advisory locks for booking    |
| [ADR-014](/docs/adrs/ADR-014-nextjs-app-router-migration.md)          | Next.js App Router migration  |
| [ADR-016](/docs/adrs/ADR-016-growth-assistant-two-phase-execution.md) | Growth Assistant pattern      |
| [ADR-017](/docs/adrs/ADR-017-dark-mode-brand-system.md)               | Dark mode brand system        |
| [ADR-018](/docs/adrs/ADR-018-landing-page-config-driven.md)           | Landing page config system    |

## Prevention Strategies (Top 10)

| Pattern                                                                                             | When to Use          |
| --------------------------------------------------------------------------------------------------- | -------------------- |
| [Tenant isolation](/docs/solutions/patterns/mais-critical-patterns.md)                              | All database queries |
| [Agent architecture](/docs/solutions/agent-design/AGENT-ARCHITECTURE.md)                            | Agent tool changes   |
| [Schema drift](/docs/solutions/database-issues/schema-drift-prevention-MAIS-20251204.md)            | Database migrations  |
| [Type safety](/docs/solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md) | ts-rest routes       |

## Operations

| Guide                                                      | Purpose              |
| ---------------------------------------------------------- | -------------------- |
| [Secret rotation](/docs/security/SECRET_ROTATION_GUIDE.md) | Rotate credentials   |
| [Deployment](/docs/operations/)                            | Deploy to production |

## Design

| Resource                                         | Purpose          |
| ------------------------------------------------ | ---------------- |
| [Brand voice](/docs/design/BRAND_VOICE_GUIDE.md) | UI copy and tone |
```

---

## Phase 5: Prevention Strategy Pruning (2 hours)

### 5.1 Identify Candidates for Archive

Run this analysis:

```bash
# Find files older than 30 days with no recent edits
find docs/solutions -name "*.md" -mtime +30 | wc -l

# Find duplicate patterns (similar names)
ls docs/solutions/*.md | grep -i "INDEX\|index" | wc -l
```

### 5.2 Archive Criteria

Move to `docs/archive/2025-12/prevention-cleanup/` if:

- [ ] Superseded by a newer document
- [ ] One-time fix (not a recurring pattern)
- [ ] Duplicate of an ADR
- [ ] INDEX file pointing to archived content
- [ ] Contains only TODO references (belongs in todos/)

### 5.3 Expected Results

| Category                    | Current | After Pruning |
| --------------------------- | ------- | ------------- |
| Total prevention strategies | 262     | ~60           |
| INDEX files                 | 55+     | ~10           |
| Agent-related files         | 27      | 5             |

---

## Verification Checklist

After completing all phases:

- [ ] `todos/` has < 25 files (active work only)
- [ ] `docs/solutions/agent-design/` has 2-3 files (consolidated)
- [ ] 3 new ADRs exist (016, 017, 018)
- [ ] `docs/INDEX.md` exists and links work
- [ ] CLAUDE.md references updated and accurate
- [ ] No broken internal links in docs/

---

## Compound Engineering Metrics

### Before Sprint

| Metric                              | Value                 |
| ----------------------------------- | --------------------- |
| Time to find agent architecture     | ~15 min               |
| TODO signal-to-noise                | 1.1% (5/448)          |
| ADR coverage                        | 83% (15/18 decisions) |
| Prevention strategy discoverability | Low                   |

### After Sprint (Target)

| Metric                              | Value        | Improvement     |
| ----------------------------------- | ------------ | --------------- |
| Time to find agent architecture     | ~2 min       | **7.5x faster** |
| TODO signal-to-noise                | 25% (5/20)   | **23x better**  |
| ADR coverage                        | 100% (18/18) | Complete        |
| Prevention strategy discoverability | High         | Indexed         |

---

## Execution Command

When ready to implement:

```bash
/workflows:work plans/doc-hygiene-sprint.md
```

---

_Plan created: 2025-12-28_
_Aligned with: Compound Engineering North Star_
_Prerequisite: Complete P0 security fixes first_
