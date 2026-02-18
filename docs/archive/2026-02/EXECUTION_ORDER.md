# Documentation Reorganization - Execution Order

Generated: November 7, 2025

## Overview

This document provides the precise execution order to minimize broken links during the documentation reorganization. Follow these steps sequentially.

## Prerequisites

- [x] Directory structure created in `/Users/mikeyoung/CODING/MAIS/docs/`
- [x] Navigation README.md files created in each subdirectory
- [x] Migration plan reviewed and approved
- [ ] Backup created (recommended: create git branch)

## Pre-Migration: Create Safety Branch

```bash
cd /Users/mikeyoung/CODING/MAIS
git checkout -b docs-reorganization
git add docs/
git commit -m "docs: create directory structure and navigation files"
```

## Execution Phases

### Phase 1: Archive Files (Lowest Impact)

**Estimated Time:** 10 minutes
**Risk Level:** LOW - These files are rarely referenced

#### Step 1.1: Move October 22 Audit Files

```bash
# Move audit files to archive
git mv AUDIT_ARCHITECTURE.md docs/archive/oct-22-analysis/
git mv AUDIT_CODE_QUALITY.md docs/archive/oct-22-analysis/
git mv AUDIT_DOCUMENTATION.md docs/archive/oct-22-analysis/
git mv AUDIT_DOCUMENTATION_COMPREHENSIVE.md docs/archive/oct-22-analysis/
git mv AUDIT_INTEGRATION.md docs/archive/oct-22-analysis/
git mv AUDIT_PERFORMANCE.md docs/archive/oct-22-analysis/
git mv AUDIT_SECURITY.md docs/archive/oct-22-analysis/
git mv AUDIT_TEST_COVERAGE.md docs/archive/oct-22-analysis/
git mv MASTER_AUDIT_REPORT.md docs/archive/oct-22-analysis/
git mv REMEDIATION_COMPLETE.md docs/archive/oct-22-analysis/
git mv REMEDIATION_PLAN.md docs/archive/oct-22-analysis/
```

#### Step 1.2: Move Agent Reports

```bash
git mv AGENT_1_TENANT_AUTH_REPORT.md docs/archive/
git mv AGENT_2_REPORT.md docs/archive/
git mv AGENT_2_TENANT_API_REPORT.md docs/archive/
git mv AGENT_3_FRONTEND_REPORT.md docs/archive/
git mv AGENT_3_COMPONENT_TREE.md docs/archive/
git mv AGENT_4_BRANDING_DOCS_REPORT.md docs/archive/
```

#### Step 1.3: Move Miscellaneous Archive Files

```bash
git mv work-log.md docs/archive/
git mv MIGRATION_LOG.md docs/archive/
git mv TYPOGRAPHY_IMPROVEMENTS.md docs/archive/
git mv IMPLEMENTATION_SUMMARY.md docs/archive/
git mv QA_UNIFIED_AUTH_TEST_REPORT.md docs/archive/
git mv PROMPTS.md docs/archive/
```

**Checkpoint:** Verify no broken links (none expected)

---

### Phase 2: Phase Reports (Low Impact)

**Estimated Time:** 5 minutes
**Risk Level:** LOW - Only referenced in README.md and ARCHITECTURE.md

#### Step 2.1: Move All Phase Reports

```bash
git mv PHASE_1_COMPLETION_REPORT.md docs/phases/
git mv PHASE_2_ASSESSMENT.md docs/phases/
git mv PHASE_2_BRANDING_API_IMPLEMENTATION.md docs/phases/
git mv PHASE_2_WIDGET_CORE_COMPLETION_REPORT.md docs/phases/
git mv PHASE_2_WIDGET_SUMMARY.md docs/phases/
git mv PHASE_2B_COMPLETION_REPORT.md docs/phases/
git mv PHASE_2C_TEST_COVERAGE_REPORT.md docs/phases/
git mv PHASE_2D_COMPLETION_REPORT.md docs/phases/
git mv PHASE_2D_FILES_SUMMARY.md docs/phases/
git mv PHASE_3_STRIPE_CONNECT_COMPLETION_REPORT.md docs/phases/
git mv PHASE_4_TENANT_ADMIN_COMPLETION_REPORT.md docs/phases/
git mv PHASE_4_IMPLEMENTATION_COMPLETE.md docs/phases/
git mv PHASE_5_IMPLEMENTATION_SPEC.md docs/phases/
git mv PHASE_5_EXECUTION_PLAN.md docs/phases/
```

**Note:** Links will break temporarily in README.md and DEVELOPING.md - will fix in Phase 6

---

### Phase 3: Roadmap & API Files (Medium Impact)

**Estimated Time:** 5 minutes
**Risk Level:** MEDIUM - Referenced in README.md

#### Step 3.1: Move Roadmap Files

```bash
git mv ROADMAP.md docs/roadmaps/
git mv IMPROVEMENT-ROADMAP-OPTIMIZED.md docs/roadmaps/
git mv IMPROVEMENT-ROADMAP.md docs/roadmaps/
git mv EMBEDDABLE_STOREFRONT_RESEARCH.md docs/roadmaps/
git mv EMBEDDABLE_MULTI_TENANT_IMPLEMENTATION_PLAN.md docs/roadmaps/
git mv WIDGET_INTEGRATION_GUIDE.md docs/roadmaps/
git mv SDK_IMPLEMENTATION_REPORT.md docs/roadmaps/
```

#### Step 3.2: Move API Files

```bash
git mv API_DOCS_QUICKSTART.md docs/api/
git mv API_DOCUMENTATION_COMPLETION_REPORT.md docs/api/
git mv ERRORS.md docs/api/
```

---

### Phase 4: Architecture & Multi-Tenant Files (Medium Impact)

**Estimated Time:** 5 minutes
**Risk Level:** MEDIUM - Referenced in README.md and ARCHITECTURE.md

#### Step 4.1: Move Architecture Files

```bash
git mv ARCHITECTURE_DIAGRAM.md docs/architecture/
```

#### Step 4.2: Move Multi-Tenant Files

```bash
git mv MULTI_TENANT_ROADMAP.md docs/multi-tenant/
git mv MULTI_TENANT_IMPLEMENTATION_GUIDE.md docs/multi-tenant/
git mv MULTI_TENANT_QUICK_START.md docs/multi-tenant/
git mv TENANT_ADMIN_USER_GUIDE.md docs/multi-tenant/
git mv MULTI_TENANCY_IMPLEMENTATION_PLAN.md docs/multi-tenant/
git mv MULTI_TENANCY_READINESS_REPORT.md docs/multi-tenant/
```

---

### Phase 5: Operations & Security Files (High Impact)

**Estimated Time:** 10 minutes
**Risk Level:** HIGH - Frequently referenced

#### Step 5.1: Move Operations Files

```bash
git mv RUNBOOK.md docs/operations/
git mv INCIDENT_RESPONSE.md docs/operations/
git mv PRODUCTION_DEPLOYMENT_GUIDE.md docs/operations/
git mv DEPLOY_NOW.md docs/operations/
git mv DEPLOYMENT_INSTRUCTIONS.md docs/operations/
git mv README_DEPLOYMENT.md docs/operations/
git mv SERVER_IMPLEMENTATION_CHECKLIST.md docs/operations/
```

#### Step 5.2: Update Internal Links in RUNBOOK.md

After moving RUNBOOK.md, update its internal references:

```bash
# Edit docs/operations/RUNBOOK.md
# Change:
#   ./SECURITY.md → ../security/SECURITY.md
#   ./SECRET_ROTATION_GUIDE.md → ../security/SECRET_ROTATION_GUIDE.md
#   ./IMMEDIATE_SECURITY_ACTIONS.md → ../security/IMMEDIATE_SECURITY_ACTIONS.md
```

#### Step 5.3: Move Security Files

```bash
git mv SECURITY.md docs/security/
git mv SECRET_ROTATION_GUIDE.md docs/security/
git mv SECRETS_ROTATION.md docs/security/
git mv IMMEDIATE_SECURITY_ACTIONS.md docs/security/
git mv AUDIT_SECURITY_PHASE2B.md docs/security/
git mv SECRETS.md docs/security/
```

---

### Phase 6: Setup Files (High Impact)

**Estimated Time:** 5 minutes
**Risk Level:** HIGH - Referenced in README.md and CONTRIBUTING.md

#### Step 6.1: Move Setup Files

```bash
git mv ENVIRONMENT.md docs/setup/
git mv SUPABASE.md docs/setup/
git mv SUPABASE_INTEGRATION_COMPLETE.md docs/setup/
git mv LOCAL_TESTING_GUIDE.md docs/setup/
```

---

### Phase 7: Update Root File Links (CRITICAL)

**Estimated Time:** 20 minutes
**Risk Level:** CRITICAL - Must be done carefully

#### Step 7.1: Update README.md

Edit `/Users/mikeyoung/CODING/MAIS/README.md` and update these links:

```markdown
# Old → New

./MULTI_TENANT_ROADMAP.md → ./docs/multi-tenant/MULTI_TENANT_ROADMAP.md
./MULTI_TENANT_IMPLEMENTATION_GUIDE.md → ./docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md
./SUPABASE.md → ./docs/setup/SUPABASE.md
./RUNBOOK.md → ./docs/operations/RUNBOOK.md
./INCIDENT_RESPONSE.md → ./docs/operations/INCIDENT_RESPONSE.md
./WIDGET_INTEGRATION_GUIDE.md → ./docs/roadmaps/WIDGET_INTEGRATION_GUIDE.md
./API_DOCS_QUICKSTART.md → ./docs/api/API_DOCS_QUICKSTART.md
./PHASE_5_IMPLEMENTATION_SPEC.md → ./docs/phases/PHASE_5_IMPLEMENTATION_SPEC.md
./ENVIRONMENT.md → ./docs/setup/ENVIRONMENT.md
./SECRETS.md → ./docs/security/SECRETS.md
./SECURITY.md → ./docs/security/SECURITY.md
./SECRET_ROTATION_GUIDE.md → ./docs/security/SECRET_ROTATION_GUIDE.md
./IMMEDIATE_SECURITY_ACTIONS.md → ./docs/security/IMMEDIATE_SECURITY_ACTIONS.md
./PHASE_1_COMPLETION_REPORT.md → ./docs/phases/PHASE_1_COMPLETION_REPORT.md
./PHASE_2B_COMPLETION_REPORT.md → ./docs/phases/PHASE_2B_COMPLETION_REPORT.md
```

#### Step 7.2: Update DEVELOPING.md

Edit `/Users/mikeyoung/CODING/MAIS/DEVELOPING.md`:

```markdown
# Old → New

../MULTI_TENANT_ROADMAP.md → ./docs/multi-tenant/MULTI_TENANT_ROADMAP.md
../PHASE_5_IMPLEMENTATION_SPEC.md → ./docs/phases/PHASE_5_IMPLEMENTATION_SPEC.md
../PHASE_4_TENANT_ADMIN_COMPLETION_REPORT.md → ./docs/phases/PHASE_4_TENANT_ADMIN_COMPLETION_REPORT.md
./SECRET_ROTATION_GUIDE.md → ./docs/security/SECRET_ROTATION_GUIDE.md
./IMMEDIATE_SECURITY_ACTIONS.md → ./docs/security/IMMEDIATE_SECURITY_ACTIONS.md
./SECURITY.md → ./docs/security/SECURITY.md
```

#### Step 7.3: Update CONTRIBUTING.md

Edit `/Users/mikeyoung/CODING/MAIS/CONTRIBUTING.md`:

```markdown
# Old → New

./SUPABASE.md → ./docs/setup/SUPABASE.md (appears twice: lines 83, 644)
```

#### Step 7.4: Update ARCHITECTURE.md

Edit `/Users/mikeyoung/CODING/MAIS/ARCHITECTURE.md`:

```markdown
# Old → New

./MULTI_TENANT_IMPLEMENTATION_GUIDE.md → ./docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md
./PHASE_1_COMPLETION_REPORT.md → ./docs/phases/PHASE_1_COMPLETION_REPORT.md
```

---

### Phase 8: Verification & Testing

**Estimated Time:** 15 minutes
**Risk Level:** N/A - Verification only

#### Step 8.1: Manual Link Verification

Click through all links in these files:

- [ ] README.md - All links work
- [ ] DEVELOPING.md - All links work
- [ ] CONTRIBUTING.md - All links work
- [ ] ARCHITECTURE.md - All links work
- [ ] docs/README.md - Navigation works
- [ ] Each docs/\*/README.md - Navigation works

#### Step 8.2: Automated Link Checking (Optional but Recommended)

```bash
# Install link checker (if not already installed)
npm install -g markdown-link-check

# Check all markdown files
find . -name "*.md" -not -path "./node_modules/*" -exec markdown-link-check {} \;
```

#### Step 8.3: Visual Verification

```bash
# View directory structure
tree docs/ -L 2

# Expected output:
# docs/
# ├── README.md
# ├── MIGRATION_PLAN.md
# ├── LINK_UPDATES_NEEDED.md
# ├── EXECUTION_ORDER.md
# ├── api/
# │   ├── README.md
# │   ├── API_DOCS_QUICKSTART.md
# │   ├── API_DOCUMENTATION_COMPLETION_REPORT.md
# │   └── ERRORS.md
# ├── architecture/
# │   ├── README.md
# │   └── ARCHITECTURE_DIAGRAM.md
# ├── archive/
# │   ├── README.md
# │   ├── oct-22-analysis/
# │   └── overnight-runs/
# ├── multi-tenant/
# │   ├── README.md
# │   └── [6 files]
# ├── operations/
# │   ├── README.md
# │   └── [7 files]
# ├── phases/
# │   ├── README.md
# │   └── [14 files]
# ├── roadmaps/
# │   ├── README.md
# │   └── [7 files]
# ├── security/
# │   ├── README.md
# │   └── [6 files]
# └── setup/
#     ├── README.md
#     └── [4 files]
```

---

### Phase 9: Commit Changes

**Estimated Time:** 5 minutes

#### Step 9.1: Review Changes

```bash
git status
git diff README.md
git diff DEVELOPING.md
git diff CONTRIBUTING.md
git diff ARCHITECTURE.md
```

#### Step 9.2: Stage All Changes

```bash
git add -A
```

#### Step 9.3: Commit with Descriptive Message

```bash
git commit -m "docs: reorganize documentation into structured directories

- Created docs/ directory with 10 subdirectories
- Moved 74+ documentation files to appropriate categories
- Updated all links in root documentation files
- Added navigation README files in each category

Structure:
- docs/setup/ - Environment & database setup (4 files)
- docs/api/ - API documentation (3 files)
- docs/operations/ - Deployment & runbooks (7 files)
- docs/security/ - Security procedures (6 files)
- docs/architecture/ - System architecture (2 files)
- docs/multi-tenant/ - Multi-tenant guides (6 files)
- docs/phases/ - Historical phase reports (14 files)
- docs/roadmaps/ - Product roadmaps (7 files)
- docs/archive/ - Outdated documentation (23+ files)

All links verified and working. No broken references."
```

#### Step 9.4: Push to Remote (Optional)

```bash
git push origin docs-reorganization
```

---

## Post-Migration Tasks

### Update CHANGELOG.md

Add entry to CHANGELOG.md:

```markdown
## [Unreleased]

### Changed

- **Documentation Structure**: Reorganized 74+ documentation files into structured `/docs` directory
  - Created 9 category subdirectories with navigation files
  - Updated all cross-references in root documentation
  - Archived outdated audit reports and phase completion documents
  - Improved documentation discoverability and maintenance
```

### Create GitHub Discussion/Issue (Optional)

Inform team of documentation reorganization with summary and navigation guide.

---

## Rollback Procedure (If Needed)

If issues are discovered:

```bash
# Option 1: Revert the commit
git revert HEAD

# Option 2: Reset to previous commit (destructive)
git reset --hard HEAD^

# Option 3: Restore specific files
git checkout HEAD^ -- path/to/file.md
```

---

## Success Criteria Checklist

- [ ] All files moved to correct directories
- [ ] All navigation README.md files in place
- [ ] README.md links updated and working
- [ ] DEVELOPING.md links updated and working
- [ ] CONTRIBUTING.md links updated and working
- [ ] ARCHITECTURE.md links updated and working
- [ ] No broken links found by automated checker
- [ ] Directory structure matches plan
- [ ] Git history preserved (used `git mv`)
- [ ] Changes committed with descriptive message
- [ ] CHANGELOG.md updated

---

## Total Estimated Time

| Phase                                | Time       | Risk     |
| ------------------------------------ | ---------- | -------- |
| Phase 1: Archive Files               | 10 min     | LOW      |
| Phase 2: Phase Reports               | 5 min      | LOW      |
| Phase 3: Roadmap & API               | 5 min      | MEDIUM   |
| Phase 4: Architecture & Multi-Tenant | 5 min      | MEDIUM   |
| Phase 5: Operations & Security       | 10 min     | HIGH     |
| Phase 6: Setup Files                 | 5 min      | HIGH     |
| Phase 7: Update Root Links           | 20 min     | CRITICAL |
| Phase 8: Verification                | 15 min     | N/A      |
| Phase 9: Commit                      | 5 min      | N/A      |
| **Total**                            | **80 min** |          |

**Recommended:** Set aside 90 minutes for buffer time.

---

## Notes

- Use `git mv` to preserve file history
- Test frequently during execution
- Don't skip verification steps
- Keep this execution order document for reference
- Consider doing this during low-traffic period
