# Repository Cleanup Plan

**Type:** Maintenance/Housekeeping
**Priority:** P1 (Medium-High)
**Estimated Effort:** 4-6 hours across 3 phases

## Overview

Clean up the MAIS repository by archiving stale documentation, fixing gitignore gaps, consolidating scattered plans, and bringing documentation into compliance with ADR-004 (time-based archive strategy).

## Problem Statement

The repository has accumulated:
- **46 untracked files** in root (analysis docs, test scripts, images)
- **57 plan files** in `/plans/` with unclear status
- **17 UPPERCASE analysis files** that should be archived
- **Build artifacts** being tracked (tsconfig.tsbuildinfo)
- **Inconsistent documentation structure** despite ADR-004 defining clear conventions

This sprawl increases cognitive load, makes navigation difficult, and violates established conventions.

---

## Current State Analysis

### Root Directory Sprawl (46 untracked files)

| Category | Count | Size | Examples |
|----------|-------|------|----------|
| Analysis/Research docs | 17 | ~270KB | `BOOKING_FIX_ANALYSIS.md`, `RESEARCH_*.md` |
| Diagnostic scripts | 12 | ~63KB | `test-smoke.mjs`, `capture-landing.js` |
| Screenshot images | 3 | ~2MB | `landing-page-full.png` |
| Summary text files | 6 | ~35KB | `TODO_TESTS_SUMMARY.txt` |
| Other | 8 | ~50KB | `render.yaml`, `DEFERRED.md` |

### Plans Directory (57 files)

| Status | Count | Examples |
|--------|-------|----------|
| Active/Recent | ~25 | `booking-flow-fix-complete.md`, `mvp-*.md` |
| Stale (>90 days) | ~20 | Old feature plans, superseded versions |
| Completed | ~12 | Executed plans needing archive |

### Gitignore Gaps

| Pattern | Status | Impact |
|---------|--------|--------|
| `*.tsbuildinfo` | Missing | Build artifact tracked |
| `test-*.js` | Missing | 7 diagnostic scripts untracked |
| `*.png` (root) | Missing | 3 large images |
| `server/tmp/` | Missing | Dev email sinks exposed |

---

## Proposed Solution

### Phase 1: Git Hygiene (30 min)

**Goal:** Prevent future accumulation of build artifacts and temp files.

#### 1.1 Update `.gitignore`

Add these patterns:

```gitignore
# Build cache files
**/*.tsbuildinfo

# Diagnostic/test scripts (root level)
/test-*.js
/test-*.mjs
/capture-*.js
/check-users.js
/view-app.js
/verify-design.js

# Screenshot artifacts
/*.png
/*.jpg

# Server temporary data
server/tmp/
```

#### 1.2 Fix Tracked Build Artifact

```bash
# Stop tracking the modified file
git rm --cached packages/contracts/tsconfig.tsbuildinfo
git add .gitignore
git commit -m "build(gitignore): stop tracking tsbuildinfo and temp files"
```

---

### Phase 2: Archive Documentation (2-3 hours)

**Goal:** Move completed/historical documentation to `docs/archive/2025-12/` per ADR-004.

#### 2.1 Create Archive Structure (per ADR-004)

```bash
mkdir -p docs/archive/2025-12/{analyses,investigations,reports,plans}
```

#### 2.2 Archive Root Analysis Files

**Files to archive → `docs/archive/2025-12/analyses/`:**

```
A11Y_FIX_PR16_SVG_COLORS.md
A11Y_REVIEW_INDEX.md
A11Y_REVIEW_PR16_HowItWorks.md
A11Y_REVIEW_PR16_QUICK_SUMMARY.md
BOOKING_FIX_ANALYSIS.md
EARLY_ACCESS_EMAIL_REDESIGN_ANALYSIS.md
RESEARCH_INDEX.md
RESEARCH_SUMMARY.md
UX_AUDIT_LA_PETIT_MARIAGE.md
```

**Files to archive → `docs/archive/2025-12/investigations/`:**

```
SEEDING_AND_DATA_MIGRATION_RESEARCH.md
SEEDING_STRATEGY_QUICK_REFERENCE.md
SEEDING_TECHNICAL_PATTERNS.md
PREVENTION_STRATEGIES_SUMMARY.md
PACKAGE_GROUPING_PREVENTION_SUMMARY.md
```

#### 2.3 Files to KEEP at Root (Active/Core)

| File | Reason |
|------|--------|
| `README.md` | Project entry point |
| `CLAUDE.md` | AI assistant context |
| `ARCHITECTURE.md` | Core documentation (linked from README) |
| `DEVELOPING.md` | Core documentation (linked from CONTRIBUTING) |
| `TESTING.md` | Core documentation |
| `DECISIONS.md` | ADR index |
| `CONTRIBUTING.md` | Contributor guide |
| `CHANGELOG.md` | Release history |
| `SECURITY.md` | Security policy |
| `DEFERRED.md` | Active deferral tracking |
| `PLAN.md` | **ACTIVE** - HowItWorks redesign in progress |

#### 2.4 Delete Temporary Files

After archiving documentation, delete/gitignore these artifacts:

**Diagnostic scripts (add to .gitignore, delete local copies):**
- `test-smoke.mjs`
- `test-playwright-diagnostics.js`
- `test-redesign.js`
- `test-body-parsing.mjs`
- `test-login-browser.mjs`
- `test-theming.mjs`
- `test-ui-upgrade.mjs`
- `view-app.js`
- `verify-design.js`
- `capture-landing.js`
- `capture-lavender-design.js`
- `check-users.js`

**Screenshot artifacts (add to .gitignore, delete local copies):**
- `landing-page-full.png`
- `landing-page-viewport.png`
- `app-view.png`

**Summary text files (archive or delete):**
- `PREVENTION_STRATEGIES_FILES.txt`
- `QA_TEST_SUMMARY.txt`
- `TODO_TESTS_SUMMARY.txt`
- `ARCHITECTURE_AUDIT_SUMMARY.txt`
- `REFACTOR_SUCCESS_SUMMARY.txt`
- `TYPESCRIPT_AUDIT_SUMMARY.txt`

---

### Phase 3: Plans Directory Consolidation (1-2 hours)

**Goal:** Triage 57 plan files, archive completed/stale ones.

#### 3.1 Triage Criteria

| Status | Action | Criteria |
|--------|--------|----------|
| **ACTIVE** | Keep in `/plans/` | Modified in last 30 days, work ongoing |
| **COMPLETED** | Archive to `/docs/archive/2025-12/plans/` | Work finished, referenced for history |
| **STALE** | Archive to `/docs/archive/2025-12/plans/` | >90 days old, no recent activity |
| **SUPERSEDED** | Delete or archive | Replaced by newer version |

#### 3.2 Plans to Archive (Completed/Stale)

Based on analysis, these are candidates for archiving:

```
# Stale execution tracking
BATCH-RUNNER-PROMPT.md
EXECUTION-STATUS.md
NEW-CHAT-PROMPT.md

# Superseded booking plans (keep only -complete.md version)
booking-flow-fix-mvp.md
booking-flow-fix-hybrid.md
BOOKING_FIX_STANDALONE.md

# Completed feature plans
feat-how-it-works-dual-panel.md
feat-mobile-landing-hero-refresh.md
feat-homepage-anchor-nav-storefront-mockup.md
feat-navigation-strategy-overhaul.md
feat-segment-package-hierarchy-ui.md
feat-segment-tier-storefront-redesign.md
feat-segmented-customer-journey.md
feat-supabase-storage-uploads.md (Phase 5.1 complete)
feat-tenant-customer-storefront-routing.md
feat-tenant-dashboard-segment-hierarchy.md
feat-tenant-dashboard-visual-editor.md
feat-tenant-storefront-builder.md
feat-unified-login-experience.md

# Completed fixes
fix-database-schema-drift-booking-type.md
fix-scheduling-platform-p1-critical-issues.md
fix-supabase-key-configuration-consistency.md
fix-supabase-storage-security-issues.md
fix-usevisualeditor-remaining-bugs.md
fix-vibe-coding-debt.md
fix-storefront-package-click-navigation.md

# Historical planning
landing-page-apple-minimalism.md
landing-page-redesign-managed-storefronts.md
little-bit-farm-production-setup.md
mais-codebase-cleanup-p1-issues.md
mvp-gaps-handoff-prompt.md
mvp-gaps-implementation-plan.md
mvp-gaps-phased-implementation.md
mvp-roadmap.md
mvp-sprint-3-weeks-to-launch.md
saas-research-feature-enhancements.md
saas-research-strategic-evolution.md
scheduling-platform-acuity-alternative.md
SCHEDULING-ACUITY-PARITY-EXECUTION-PLAN.md
```

#### 3.3 Plans to KEEP Active

```
# MVP tracking (if still in MVP sprint)
mvp-gaps-todos.md

# Booking flow (canonical version)
booking-flow-fix-complete.md

# Active feature work
browse-packages-ui-overhaul.md
early-access-email-redesign.md
la-petit-mariage-storefront-bug.md
lbhf-corporate-wellness-optimized.md
lbhf-corporate-wellness-update.md
resolve-open-todos-prioritized.md
pending-todos-triage-and-governance.md
tier-architecture-code-review-fixes.md
resolve-all-pending-todos-phased-plan.md
p1-issues-password-reset-ui-and-fixes.md
date-booking-hardening-plan.md
```

---

## Acceptance Criteria

### Phase 1: Git Hygiene
- [ ] `.gitignore` updated with 5 new patterns
- [ ] `packages/contracts/tsconfig.tsbuildinfo` no longer tracked
- [ ] `git status` shows fewer untracked files

### Phase 2: Documentation Archive
- [ ] 14 root analysis files moved to `docs/archive/2025-12/analyses/`
- [ ] Archive structure follows ADR-004 conventions
- [ ] No broken links in README.md, CONTRIBUTING.md, CLAUDE.md
- [ ] Core documentation (11 files) remains at root

### Phase 3: Plans Consolidation
- [ ] 35+ stale/completed plans archived
- [ ] ~15-20 active plans remain in `/plans/`
- [ ] No duplicate plan versions (only canonical copies kept)
- [ ] Archive README.md created with plan index

### Validation
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (no broken imports)
- [ ] All markdown links verified working

---

## Rollback Strategy

### Pre-Cleanup Checkpoint

```bash
# Create rollback tag
git tag -a cleanup-checkpoint-$(date +%Y%m%d) \
  -m "Pre-cleanup state with $(git status --porcelain | wc -l) pending files"

# Create cleanup branch (never modify main directly)
git checkout -b chore/repo-cleanup-2025-12
```

### If Something Breaks

```bash
# Option 1: Revert specific commit
git revert HEAD

# Option 2: Full rollback to checkpoint
git checkout cleanup-checkpoint-20251223 -- .

# Option 3: Abandon cleanup branch
git checkout main
git branch -D chore/repo-cleanup-2025-12
```

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Broken documentation links | Medium | Medium | Validate links before merge |
| Archive wrong file (active work) | Low | High | Review PLAN.md status before archiving |
| Gitignore too aggressive | Low | Medium | Test patterns on branch first |
| Team confusion on new locations | Medium | Low | Update CLAUDE.md with archive paths |

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Untracked files in root | 46 | <10 |
| Files in `/plans/` | 57 | ~15-20 |
| Documentation in proper locations | ~60% | 95% |
| Gitignore patterns covering temp files | Incomplete | Complete |

---

## Implementation Notes

### Order of Operations

1. **Phase 1 first** - Fix gitignore before any archiving
2. **Phase 2 second** - Archive documentation
3. **Phase 3 last** - Consolidate plans (depends on understanding what's active)

### Files Requiring Manual Review

Before archiving, confirm status of:
- `PLAN.md` - Currently shows HowItWorks redesign; verify if active
- `DEFERRED.md` - Active tracking file; keep at root
- Any `*-update.md` or `*-optimized.md` variants - determine canonical version

### Post-Cleanup Updates

After cleanup, update these files:
- `CLAUDE.md` - Add archive location guidance
- `docs/INDEX.md` - Update navigation to archived content
- `README.md` - Verify all links still work

---

## References

### Internal
- `docs/adrs/ADR-004-time-based-archive-strategy.md` - Archive conventions
- `docs/adrs/ADR-002-documentation-naming-standards.md` - Naming patterns
- `docs/DIATAXIS_IMPLEMENTATION_GUIDE.md` - Documentation framework

### Research Findings
- 46 untracked files identified (17 analysis docs, 12 scripts, 3 images, 14 other)
- 57 plan files with ~35 candidates for archiving
- ADR-004 accepted but not yet implemented
- Core documentation (11 files) must remain at root for link integrity

---

## Appendix: File Inventory

### Root Analysis Files (17 total, archive all)

```
A11Y_FIX_PR16_SVG_COLORS.md
A11Y_REVIEW_INDEX.md
A11Y_REVIEW_PR16_HowItWorks.md
A11Y_REVIEW_PR16_QUICK_SUMMARY.md
BOOKING_FIX_ANALYSIS.md
EARLY_ACCESS_EMAIL_REDESIGN_ANALYSIS.md
PACKAGE_GROUPING_PREVENTION_SUMMARY.md
PREVENTION_STRATEGIES_FILES.txt
PREVENTION_STRATEGIES_SUMMARY.md
RESEARCH_INDEX.md
RESEARCH_SUMMARY.md
SEEDING_AND_DATA_MIGRATION_RESEARCH.md
SEEDING_STRATEGY_QUICK_REFERENCE.md
SEEDING_TECHNICAL_PATTERNS.md
UX_AUDIT_LA_PETIT_MARIAGE.md
```

### Diagnostic Scripts (12 total, gitignore all)

```
capture-landing.js
capture-lavender-design.js
check-users.js
test-body-parsing.mjs
test-login-browser.mjs
test-playwright-diagnostics.js
test-redesign.js
test-smoke.mjs
test-theming.mjs
test-ui-upgrade.mjs
verify-design.js
view-app.js
```

### Screenshot Artifacts (3 total, gitignore all)

```
landing-page-full.png
landing-page-viewport.png
app-view.png
```
