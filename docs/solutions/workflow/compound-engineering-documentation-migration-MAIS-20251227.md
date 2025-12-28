---
module: MAIS
date: 2025-12-27
problem_type: workflow_optimization
component: .claude/lessons, docs/solutions/, CLAUDE.md
symptoms:
  - Legacy "lessons" system existed alongside compound-engineering docs
  - Lessons referenced non-existent /workflows:codify command
  - Redundant content between lessons and docs/solutions/
  - Stale sprint goals (54 days old) in CLAUDE.md
  - Broken documentation links in CLAUDE.md
root_cause: Documentation system drift from compound-engineering as codebase evolved
resolution_type: migration_pattern
severity: P2
tags: [documentation, compound-engineering, migration, claude-md, lessons-system]
status: stable
last_verified: 2025-12-27
---

# Documentation System Migration to Compound-Engineering

**Problem:** A legacy "lessons" system in `.claude/lessons/` existed alongside the compound-engineering documentation system, causing confusion and redundancy.

**Solution:** Delete legacy system, create "Required Reading" critical patterns file, clean up CLAUDE.md.

---

## Problem Statement

The MAIS codebase had accumulated a custom "lessons" documentation system that:

1. **Predated compound-engineering** - Created before `/workflows:compound` existed
2. **Used non-standard format** - Custom `CL-XXX-NNN` IDs instead of YAML frontmatter
3. **Referenced non-existent command** - `lessons/README.md` referenced `/workflows:codify` (doesn't exist)
4. **Duplicated existing content** - All 4 lessons covered topics already in `docs/solutions/` and CLAUDE.md

Additionally, CLAUDE.md had:

- **Stale sprint goals** - November 2025 section still present (54 days old)
- **Broken links** - 2 documentation references pointing to moved/renamed files

---

## Root Cause Analysis

### Why This Happened

1. **Organic growth** - Documentation systems evolved over time without consolidation
2. **No governance check** - New documentation systems added without checking compound-engineering compatibility
3. **Stale content not archived** - Sprint goals should have been moved to `docs/archive/` on completion

### The Legacy Lessons System

```
.claude/lessons/
├── README.md                           # Index referencing /workflows:codify
├── CL-TENANT-001-tenant-scoping.md    # Multi-tenant isolation
├── CL-ADAPTER-001-mock-first-dev.md   # Mock-first development
├── CL-SERVICE-001-service-layer.md    # Service layer architecture
└── CL-SAVE-001-autosave-race.md       # Auto-save race conditions
```

**Problems:**

- No YAML frontmatter (not searchable by compound-docs)
- Custom ID format not compatible with compound-engineering
- `/workflows:codify` doesn't exist - correct command is `/workflows:compound`

---

## Solution

### Step 1: Delete Legacy Lessons System

```bash
rm -rf /Users/mikeyoung/CODING/MAIS/.claude/lessons
```

**Rationale:** All content was already covered:
| Lesson | Existing Coverage |
|--------|-------------------|
| CL-TENANT-001 | CLAUDE.md §Multi-Tenant, docs/solutions/ |
| CL-ADAPTER-001 | CLAUDE.md §Architecture Patterns |
| CL-SERVICE-001 | CLAUDE.md §Layered Architecture |
| CL-SAVE-001 | General pattern, not MAIS-specific |

### Step 2: Create Critical Patterns File

Created `docs/solutions/patterns/mais-critical-patterns.md` as "Required Reading" for all agents.

**Purpose:** Consolidate the 10 most critical patterns that ALL agents must apply before generating code.

**Contents:**

1. Multi-tenant query isolation
2. Tenant-scoped cache keys
3. Repository interface signatures
4. Email normalization
5. Single Prisma client instance
6. ts-rest route handler types
7. Foreign key ownership validation
8. Logger instead of console
9. Prisma JSON field updates
10. Advisory locks for race conditions

### Step 3: Clean Up CLAUDE.md

**Removed:**

- Entire "Current Sprint Goals" section (lines 706-748) - 54 days stale

**Fixed:**

- Updated `vercel-nextjs-npm-workspaces-root-directory.md` → added `-MAIS-20251226` suffix
- Removed archived `CODE-REVIEW-ANY-TYPE-CHECKLIST.md` reference

**Added:**

- Link to new `mais-critical-patterns.md` at top of Prevention Strategies

### Step 4: Configure Context7 MCP

```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp
```

**Purpose:** Fetch up-to-date, version-specific documentation for frameworks (Next.js, Prisma, etc.)

---

## Prevention Checklist

Before adding ANY new documentation system:

- [ ] **Check compound-engineering compatibility** - Does it integrate with `/workflows:compound`?
- [ ] **Verify location** - Should it be in `docs/solutions/` (compound-engineering native)?
- [ ] **Search existing docs** - Is content already covered elsewhere?
- [ ] **Use YAML frontmatter** - Required for searchability
- [ ] **Index the documentation** - Add to PREVENTION-STRATEGIES-INDEX.md
- [ ] **Update CLAUDE.md** - Add 1-liner link if important

### Signs of Documentation Drift

Watch for these symptoms:

1. **Multiple locations for same topic** - grep finds duplicates
2. **Orphaned systems** - docs not indexed anywhere
3. **Conflicting information** - test counts differ across files
4. **Non-standard formats** - missing YAML frontmatter
5. **Stale content** - sprint goals from months ago

### Maintenance Schedule

| Frequency | Task                                |
| --------- | ----------------------------------- |
| Weekly    | Check for broken links in CLAUDE.md |
| Monthly   | Archive completed sprint goals      |
| Quarterly | Full documentation audit            |

---

## Quick Reference

### Compound-Engineering Native Components

| Component             | Location         | Purpose                                 |
| --------------------- | ---------------- | --------------------------------------- |
| `docs/solutions/`     | Compound docs    | Problem solutions with YAML frontmatter |
| `todos/`              | File-based todos | Work tracking across sessions           |
| `/workflows:compound` | Command          | Document solved problems                |
| `/workflows:plan`     | Command          | Plan before implementation              |
| `/workflows:work`     | Command          | Execute plans systematically            |
| `/workflows:review`   | Command          | Multi-agent code review                 |

### What NOT to Create

- ❌ Standalone "lessons" directories
- ❌ Documentation in `.claude/` (use `docs/solutions/`)
- ❌ Unindexed documentation
- ❌ Non-YAML formatted solution docs

### Correct Command Reference

| Old (Wrong)         | New (Correct)         |
| ------------------- | --------------------- |
| `/workflows:codify` | `/workflows:compound` |

---

## Related Documents

- [PREVENTION-STRATEGIES-INDEX.md](../PREVENTION-STRATEGIES-INDEX.md) - Master navigation hub
- [mais-critical-patterns.md](../patterns/mais-critical-patterns.md) - Required Reading for all agents
- [ADR-002-documentation-naming-standards.md](../../adrs/ADR-002-documentation-naming-standards.md) - Naming conventions
- [DOCUMENTATION_STANDARDS.md](../../DOCUMENTATION_STANDARDS.md) - Governance standards

---

## Commit Reference

**Commit:** `e1c6593` - `chore(docs): migrate to compound-engineering documentation system`

**Changes:**

- 5 files deleted (.claude/lessons/)
- 1 file created (docs/solutions/patterns/mais-critical-patterns.md)
- 1 file modified (CLAUDE.md)
- Net: 260 insertions, 361 deletions

---

**Last Updated:** 2025-12-27
**Maintainer:** Generated via /workflows:compound
