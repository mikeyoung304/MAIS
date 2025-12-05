---
module: MAIS
date: 2025-12-04
problem_type: documentation_gap
component: docs/solutions
symptoms:
  - PREVENTION-*.md files have inconsistent formats
  - No YAML frontmatter for machine parsing
  - SCREAMING_SNAKE_CASE naming instead of kebab-case
  - Files not organized by problem_type category
root_cause: Documentation predates Compounding Engineering adoption
resolution_type: migration_plan
severity: P2
tags: [documentation, migration, compounding-engineering]
---

# Migration Plan: PREVENTION-*.md Files to Compounding Engineering Schema

## Overview

This plan migrates 15 existing PREVENTION-*.md files to the Compounding Engineering v2.4.1 schema format with proper YAML frontmatter and category-based organization.

## Current State Analysis

### Files to Migrate (15 total)

| Current File | Status | Target Category | Target Name |
|--------------|--------|-----------------|-------------|
| `PREVENTION-TS-REST-ANY-TYPE.md` | No YAML | `best-practices/` | `ts-rest-any-type-MAIS-*.md` |
| `PREVENTION-ANY-TYPES-QUICK-REF.md` | No YAML | `best-practices/` | `any-types-quick-ref-MAIS-*.md` |
| `PREVENTION-ENTITY-TYPE-ERRORS.md` | No YAML | `logic-errors/` | `cascading-entity-type-errors-MAIS-*.md` |
| `PREVENTION-STRATEGY-DATABASE-CLIENT-MISMATCH.md` | Has YAML (partial) | `database-issues/` | `database-client-mismatch-MAIS-*.md` |
| `PREVENTION-SCHEMA-DRIFT-IMPLEMENTATION.md` | No YAML | `database-issues/` | `schema-drift-prevention-MAIS-*.md` |
| `PREVENTION-IMPLEMENTATION-ROADMAP.md` | No YAML | Archive | N/A (meta-doc) |
| `PREVENTION-QUICK-REFERENCE.md` | No YAML | Keep as index | N/A |
| `PREVENTION-STRATEGIES-INDEX.md` | No YAML | Keep as index | N/A |
| `PREVENTION-STRATEGIES-QUICK-REFERENCE.md` | No YAML | Merge with above | N/A |
| `PREVENTION-TODO-182-191-*.md` (5 files) | No YAML | Archive | N/A (sprint-specific) |
| `security-issues/PREVENTION-STRATEGY-EMAIL-CASE-SENSITIVITY.md` | Unknown | `security-issues/` | Already correct path |

### Required Changes per File

1. **Add YAML frontmatter** with required fields:
   - `module: MAIS`
   - `date: YYYY-MM-DD` (original creation or migration date)
   - `problem_type:` (from enum)
   - `component:` (affected codebase area)
   - `symptoms:` (list of detection signals)
   - `root_cause:` (one-line summary)
   - `resolution_type:` (fix_type)
   - `severity:` (P0-P3)
   - `tags:` (array)

2. **Move to category subdirectory** based on `problem_type`:
   - `best_practice` → `docs/solutions/best-practices/`
   - `logic_error` → `docs/solutions/logic-errors/`
   - `database_issue` → `docs/solutions/database-issues/`
   - `security_issue` → `docs/solutions/security-issues/`
   - `developer_experience` → `docs/solutions/developer-experience/`

3. **Rename to kebab-case** with naming convention:
   - `{descriptive-name}-{module}-{YYYYMMDD}.md`

## Migration Execution Plan

### Phase 1: High-Value Technical Docs (5 files)

These contain critical prevention knowledge and should be migrated first.

```bash
# Execute in order:
1. PREVENTION-TS-REST-ANY-TYPE.md → best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md
2. PREVENTION-ENTITY-TYPE-ERRORS.md → logic-errors/cascading-entity-type-errors-MAIS-20251204.md
3. PREVENTION-STRATEGY-DATABASE-CLIENT-MISMATCH.md → database-issues/database-client-mismatch-MAIS-20251204.md
4. PREVENTION-SCHEMA-DRIFT-IMPLEMENTATION.md → database-issues/schema-drift-prevention-MAIS-20251204.md
5. security-issues/PREVENTION-STRATEGY-EMAIL-CASE-SENSITIVITY.md → (add YAML frontmatter only)
```

### Phase 2: Reference/Quick-Ref Docs (3 files)

Keep as index files but add YAML frontmatter for consistency.

```bash
1. PREVENTION-QUICK-REFERENCE.md → Add frontmatter, keep location
2. PREVENTION-STRATEGIES-INDEX.md → Add frontmatter, keep location
3. PREVENTION-ANY-TYPES-QUICK-REF.md → best-practices/any-types-quick-reference-MAIS-20251204.md
```

### Phase 3: Archive Sprint-Specific Docs (6 files)

Move to archive with date prefix.

```bash
1. PREVENTION-TODO-182-191-*.md → docs/archive/2024-11/PREVENTION-TODO-182-191-*.md
2. PREVENTION-IMPLEMENTATION-ROADMAP.md → docs/archive/2024-11/PREVENTION-IMPLEMENTATION-ROADMAP.md
3. PREVENTION-STRATEGIES-QUICK-REFERENCE.md → Merge into PREVENTION-QUICK-REFERENCE.md, then archive
```

## YAML Frontmatter Template

```yaml
---
module: MAIS
date: 2025-12-04
problem_type: best_practice  # Or: logic_error, database_issue, security_issue, etc.
component: server/routes     # Or: client/features, prisma/schema, etc.
symptoms:
  - First detection signal
  - Second detection signal
root_cause: One-line explanation of why this happens
resolution_type: fix_with_pattern  # Or: architectural_pattern, hotfix, workaround
severity: P1
related_files:
  - path/to/related/file.ts
tags: [tag1, tag2, tag3]
---
```

## Valid `problem_type` Values (from Compounding Engineering schema)

- `build_error`
- `test_failure`
- `runtime_error`
- `performance_issue`
- `database_issue`
- `security_issue`
- `ui_bug`
- `integration_issue`
- `logic_error`
- `developer_experience`
- `workflow_issue`
- `best_practice`
- `documentation_gap`

## Update CLAUDE.md After Migration

After migration, update CLAUDE.md references:

```markdown
## Key Documentation (Old → New)

- PREVENTION-TS-REST-ANY-TYPE.md → docs/solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md
- PREVENTION-ENTITY-TYPE-ERRORS.md → docs/solutions/logic-errors/cascading-entity-type-errors-MAIS-20251204.md
```

## Validation Checklist

After each migration:

- [ ] YAML frontmatter passes schema validation
- [ ] File is in correct category subdirectory
- [ ] Filename follows kebab-case-{module}-{date}.md pattern
- [ ] Old file removed or redirected
- [ ] Any CLAUDE.md references updated
- [ ] `git diff` shows only formatting changes (content preserved)

## Estimated Effort

| Phase | Files | Time |
|-------|-------|------|
| Phase 1 | 5 | 30 min |
| Phase 2 | 3 | 15 min |
| Phase 3 | 6 | 20 min |
| CLAUDE.md updates | 1 | 10 min |
| **Total** | **15** | **~1.25 hours** |

## Decision: Execute Now or Defer?

**Recommendation:** Execute Phase 1 now (high-value docs), defer Phases 2-3 to separate PR.

This preserves critical prevention knowledge in schema-compliant format while keeping the migration manageable.

---

## Migration Completed: 2025-12-04

**Status: ✅ ALL PHASES COMPLETE**

### Execution Summary

| Phase | Files | Status |
|-------|-------|--------|
| Phase 1 | 5 | ✅ Complete |
| Phase 2 | 3 | ✅ Complete |
| Phase 3 | 7 | ✅ Complete |
| CLAUDE.md | 1 | ✅ Complete |
| Cleanup | 12 | ✅ Complete |

### Files Migrated

**best-practices/**
- `ts-rest-any-type-library-limitations-MAIS-20251204.md`
- `any-types-quick-reference-MAIS-20251204.md`

**logic-errors/**
- `cascading-entity-type-errors-MAIS-20251204.md`

**database-issues/**
- `database-client-mismatch-MAIS-20251204.md`
- `schema-drift-prevention-MAIS-20251204.md`

**security-issues/**
- `PREVENTION-STRATEGY-EMAIL-CASE-SENSITIVITY.md` (frontmatter added)

**archive/2024-11/**
- 5 TODO-182-191 files + 2 meta-docs archived

### Remaining Index Files (Kept in Place)
- `PREVENTION-QUICK-REFERENCE.md` - Updated with YAML frontmatter
- `PREVENTION-STRATEGIES-INDEX.md` - Updated with YAML frontmatter
