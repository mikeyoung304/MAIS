# Archive

This directory contains outdated documentation and historical reports that are no longer actively referenced.

**Archive Date:** 2025-11-11 (Sprint 4 documentation cleanup)

---

## Directory Structure

### `/sprints` - Sprint Session Reports (Sprint 1-3)

Historical sprint session reports superseded by current sprint documentation.

**18 files archived:**

- Sprint 1: 6 session reports
- Sprint 2: 6 session reports
- Sprint 3: 6 session reports

**Current reference:** See `/server/SPRINT_4_*.md` for latest sprint work

### `/cache-investigation` - Early Cache Analysis

Initial cache isolation investigation and analysis reports from October 2024.

**4 files archived:**

- `CACHE_INVESTIGATION_SUMMARY.md`
- `CACHE_ISOLATION_REPORT.md`
- `cache-flow-diagram.md`
- `cache-key-analysis.md`

**Current reference:** See `.claude/CACHE_WARNING.md` for current cache security patterns

### `/phase-3` - Phase 3 Completion Reports

Phase 3 multi-tenant refactoring completion reports and assessments.

**5 files archived:**

- `PHASE_3_COMPLETE.md`
- `PHASE_3_COMPLETION_REPORT.md`
- `PHASE_3_PROGRESS.md`
- `PHASE_3_SECURITY_ASSESSMENT.md`
- `PHASE_3_SUMMARY.md`

**Current reference:** See `PRODUCTION_READINESS_STATUS.md` for current production status

### `/test-reports` - Historical Test Status Reports

Test recovery and stabilization reports from Sprint 2 and early Sprint 3.

**6 files archived:**

- `TEST_QUICK_FIX.md`
- `TEST_RECOVERY_PLAN.md`
- `TEST_STATUS_VISUAL.md`
- Test coverage assessments
- Test stabilization guides

**Current reference:** See `/server/test/helpers/README.md` for current test patterns

### `/oct-22-analysis` - October 22 Audit Reports

Comprehensive audit reports from October 22, 2024 (existing archive).

**Current reference:** See Sprint 4+ documentation for latest audit results

### `/overnight-runs` - Automated Analysis Runs

Automated overnight analysis runs (existing archive).

---

## When to Use Archived Documentation

### Use Archived Docs When:

- Researching historical decisions and context
- Understanding evolution of architecture patterns
- Reviewing past sprint objectives and outcomes
- Investigating specific dates/phases of development

### Use Current Docs When:

- Onboarding new team members
- Implementing new features
- Following best practices
- Understanding current architecture

---

## Current Documentation Reference Map

| Topic                 | Archived Location               | Current Reference                    |
| --------------------- | ------------------------------- | ------------------------------------ |
| Sprint Work           | `/archive/sprints/`             | `/server/SPRINT_4_*.md`              |
| Cache Security        | `/archive/cache-investigation/` | `.claude/CACHE_WARNING.md`           |
| Production Status     | `/archive/phase-3/`             | `PRODUCTION_READINESS_STATUS.md`     |
| Test Patterns         | `/archive/test-reports/`        | `/server/test/helpers/README.md`     |
| Multi-Tenant Patterns | Sprint reports                  | `.claude/PATTERNS.md`                |
| Integration Tests     | Test reports                    | `/server/test/integration/*.spec.ts` |

---

## Archive Maintenance Guidelines

### When to Archive Documents

- Sprint session reports after sprint completion
- Investigation reports superseded by implementation
- Completion reports after next phase begins
- Duplicate or outdated guides replaced by new versions

### File Naming Convention

Archived files retain original names but are organized by:

- Category (sprints, cache-investigation, phase-3, test-reports)
- Date archived (documented in this README)
- Sprint/phase context

### Adding New Archives

1. Create appropriate subdirectory if needed
2. Move files with original names preserved
3. Update this README with:
   - Archive date
   - File count and description
   - Current reference mapping
4. Add redirect notice to old location (if in active docs)

---

## Sprint 4 Documentation Reorganization

**Date:** 2025-11-11
**Context:** Sprint 4 Session 2 - Documentation cleanup and archiving

**What Changed:**

- Created structured archive with 4 categories
- Moved 33 historical files to archive
- Established current vs. archived documentation distinction
- Created reference mappings for team onboarding

**Why:**

- Reduce noise in project root
- Improve onboarding experience (current docs only)
- Preserve historical context for research
- Maintain institutional knowledge as codebase matures

**Impact:**

- Cleaner documentation structure
- Faster navigation to current best practices
- Historical context preserved but separated
- Single source of truth for each topic

---

## Note

These documents are preserved for historical reference only. **Always refer to the main documentation for current information.**

For questions about archived content or documentation organization, see:

- **Current Sprint Work:** `/server/SPRINT_4_*.md`
- **Production Status:** `PRODUCTION_READINESS_STATUS.md`
- **Test Helpers:** `/server/test/helpers/README.md`
- **Cache Security:** `.claude/CACHE_WARNING.md`
