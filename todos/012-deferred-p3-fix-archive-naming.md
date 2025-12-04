---
status: pending
priority: p3
issue_id: '012'
tags: [documentation, archive, compliance]
dependencies: ['001', '002', '005', '006']
deferred_until: '2026-Q1'
deferred_reason: 'Batch migration of 220+ files requires dedicated documentation cleanup sprint'
---

# Fix Archive File Naming Compliance

## Problem Statement

Per ADR-004 (Time-Based Archive Strategy), archived files should have YYYY-MM-DD date prefixes. Currently, **98% of archived files (220/225) are non-compliant** with this naming convention. This makes it difficult to understand when documents were created.

## Findings

**Compliance analysis:**

| Archive Month | Total Files | Date-Prefixed | Non-Compliant  | Compliance |
| ------------- | ----------- | ------------- | -------------- | ---------- |
| 2025-01       | 42          | 0             | 42 (100%)      | 0%         |
| 2025-10       | 18          | ~5            | ~13 (72%)      | ~28%       |
| 2025-11       | 165         | ~0            | ~165 (100%)    | 0%         |
| **Total**     | **225**     | **~5**        | **~220 (98%)** | **~2%**    |

**Example violations:**

- `docs/archive/2025-11/analysis/CODE_HEALTH_INDEX.md`
  - Should be: `2025-11-XX-code-health-index.md`
- `docs/archive/2025-11/sprints/SPRINT_2_1_ROLLBACK_GUIDE.md`
  - Should be: `2025-11-XX-sprint-2-1-rollback-guide.md`

**Additional issues:**

- Nested subdirectories (e.g., `cache-investigation/`) violate flat structure
- Non-standard categories (12+ instead of ADR-004's 5)

## Proposed Solutions

### Solution 1: Batch Rename with Git History Dates (Recommended)

- Extract creation dates from git history
- Rename all 220 files with YYYY-MM-DD prefix
- Effort: Large (4-6 hours)
- Risk: Medium - many file moves
- Pros: Full compliance, clear history

### Solution 2: Manual Date Assignment

- Assign mid-month dates (YYYY-MM-15) for unknown dates
- Faster but less accurate
- Effort: Medium (2-3 hours)
- Risk: Low
- Cons: Dates may not be accurate

### Solution 3: Leave Non-Compliant, Fix Going Forward

- Only apply convention to new archives
- Effort: None
- Risk: Low
- Cons: Inconsistent archive, ADR-004 not enforced

## Recommended Action

**DEFERRED (P3)** - Document and apply convention to new archives going forward.

This is a significant undertaking (220+ files, ~4-6 hours) best handled in a dedicated documentation cleanup sprint. For now:

1. Apply YYYY-MM-DD naming convention to ALL NEW archives going forward
2. Document current state and migration strategy
3. Schedule batch migration for Q1 2026 documentation cleanup sprint

## Technical Details

**Rename script concept:**

```bash
#!/bin/bash
# Rename archive files with date prefix

for file in docs/archive/2025-11/**/*.md; do
    # Skip README files
    [[ $(basename "$file") == "README.md" ]] && continue

    # Get creation date from git (or use default)
    DATE=$(git log --diff-filter=A --format="%ad" --date=short -- "$file" | head -1)
    DATE=${DATE:-"2025-11-15"}  # Default to mid-month if unknown

    # Convert to lowercase kebab-case
    BASENAME=$(basename "$file" .md)
    LOWERCASE=$(echo "$BASENAME" | tr '[:upper:]_' '[:lower:]-')

    # Build new path
    DIR=$(dirname "$file")
    NEW_NAME="${DATE}-${LOWERCASE}.md"

    # Rename
    git mv "$file" "$DIR/$NEW_NAME"
done
```

**Flatten nested directories:**

```bash
# Move files from cache-investigation/ up one level
for file in docs/archive/2025-11/investigations/cache-investigation/*.md; do
    git mv "$file" "docs/archive/2025-11/investigations/"
done
rmdir docs/archive/2025-11/investigations/cache-investigation/
```

## Current State Analysis (2025-12-03)

**Archive Structure Findings:**

- **Total files**: 315 (310 markdown + 5 other)
- **Compliant files**: 0 files with YYYY-MM-DD\_ prefix (0%)
- **Non-compliant files**: 310+ files (100%)
- **Year-month dirs**: 5 months (2025-01, 2025-10, 2025-11, 2025-12, legacy)
- **Legacy undated dirs**: bugfixes/, planning/, sprints/ (no date info)

**Compliance Status:**
| Period | Status | Notes |
|--------|--------|-------|
| 2025-01 | 42 files | No date prefixes (legacy from project pivot) |
| 2025-10 | 18 files | No date prefixes (audit/analysis work) |
| 2025-11 | 165 files | Organized by category (good structure) but no file-level date prefixes |
| 2025-12 | 71 files | Most recent, same pattern - organized but undated files |
| Legacy | 19 files | Completely unorganized (bugfixes/, planning/, sprints/) |

**Key Finding**: The directory-level YYYY-MM structure is in place (per ADR-004), but individual FILE-level YYYY-MM-DD prefixes are not implemented. This is Phase 2 of the ADR implementation that was never completed.

## Acceptance Criteria (Deferred)

**For New Archives (Ongoing)**:

- [ ] All NEW archived files have YYYY-MM-DD prefix in filename
- [ ] All NEW archives use proper categories (sprints, investigations, decisions, incidents, reports)
- [ ] Code review validates archive naming per CLAUDE.md
- [ ] No nested subdirectories in new archives

**For Legacy Migration (Q1 2026)**:

- [ ] Migration script written and tested
- [ ] Git history analyzed to extract completion dates
- [ ] All 220 existing files renamed with dates
- [ ] Validation script confirms 100% compliance
- [ ] No broken internal links after migration

## Work Log

| Date       | Action      | Notes                                                                       |
| ---------- | ----------- | --------------------------------------------------------------------------- |
| 2025-11-24 | Created     | 98% non-compliance identified                                               |
| 2025-12-03 | Analyzed    | Confirmed 0% file-level compliance, directory structure partially compliant |
| 2025-12-03 | Recommended | Defer batch migration to Q1 2026, apply convention going forward            |

## Decision Rationale

**Why Defer This Task?**

1. **Scale**: 220+ files requiring careful date extraction from git history
2. **Effort**: 4-6 hours work with high precision required
3. **Priority**: P3 task - lower urgency than P1/P2 defects
4. **Risk**: Many file moves could cause git conflicts or broken links
5. **Timing**: Better handled in dedicated documentation sprint than ad-hoc

**Why Apply Convention Going Forward?**

1. **No Ongoing Cost**: New archives are infrequent (2-5 per month)
2. **Prevention**: Stops growth of non-compliant archive
3. **Documentation**: CLAUDE.md already specifies convention
4. **Scalability**: Reduces migration burden (don't need to migrate new files)

**Example Implementation for New Archives**:

When archiving a new document (e.g., Sprint 7 retrospective completed 2025-12-10):

```bash
# OLD (current practice)
# docs/archive/2025-12/sprints/SPRINT_7_RETROSPECTIVE.md

# NEW (per ADR-004 convention)
# docs/archive/2025-12/sprints/2025-12-10-sprint-7-retrospective.md
```

## Migration Strategy (Q1 2026)

Once this becomes a higher priority, use this approach:

1. **Extract Git Dates** (lowest effort, highest accuracy):

   ```bash
   for file in docs/archive/2025-*/**/*.md; do
       DATE=$(git log --diff-filter=A --format="%ad" --date=short -- "$file" | head -1)
       echo "$file → ${DATE:-UNKNOWN}"
   done
   ```

2. **Review Dates with Team** (ensures correctness):
   - Identify ambiguous dates
   - Verify completion vs creation dates
   - Handle special cases (multi-month projects)

3. **Batch Rename** (git history preserved):

   ```bash
   # Use script to move files while preserving git history
   git mv "docs/archive/2025-11/sprints/FILE.md" \
          "docs/archive/2025-11/sprints/2025-11-12-file.md"
   ```

4. **Validate** (ensure 100% compliance):
   - Run scripts/validate-archives.sh
   - Check for broken links
   - Review in code review

5. **Commit** (clear commit message):

   ```
   docs: migrate archive files to YYYY-MM-DD naming per ADR-004

   Completed migration of 220+ archived files to date-prefixed naming convention.
   - Extracted completion dates from git history
   - No files changed, only renamed for consistency
   - Fixes 98% non-compliance issue (TODO-012)
   ```

## Resources

- ADR-004: Time-based archive strategy
- Archive location: `docs/archive/2025-*/`
- Validation: `find docs/archive -name "*.md" -not -name "2025-*-*-*.md"`
