# Documentation Reorganization Migration Plan

Generated: November 7, 2025

## Overview
This plan reorganizes 74+ root-level documentation files into a structured docs/ directory. The goal is to reduce root clutter while maintaining accessibility and preserving all documentation links.

## Files Staying in Root (8 core files)
These files remain at root level as they are frequently accessed entry points:
- [ ] README.md (main project README)
- [ ] DEVELOPING.md (developer workflow)
- [ ] CONTRIBUTING.md (contribution guidelines)
- [ ] CHANGELOG.md (version history)
- [ ] ARCHITECTURE.md (system architecture)
- [ ] TESTING.md (testing strategy)
- [ ] CODING_GUIDELINES.md (code standards)
- [ ] DECISIONS.md (architectural decisions)

## Files to Move

### To docs/setup/ (5 files)
Setup and getting started documentation:
- [ ] ENVIRONMENT.md → docs/setup/ENVIRONMENT.md
- [ ] SUPABASE.md → docs/setup/SUPABASE.md
- [ ] SUPABASE_INTEGRATION_COMPLETE.md → docs/setup/SUPABASE_INTEGRATION_COMPLETE.md
- [ ] LOCAL_TESTING_GUIDE.md → docs/setup/LOCAL_TESTING_GUIDE.md

### To docs/security/ (6 files)
Security documentation and procedures:
- [ ] SECURITY.md → docs/security/SECURITY.md
- [ ] SECRET_ROTATION_GUIDE.md → docs/security/SECRET_ROTATION_GUIDE.md
- [ ] SECRETS_ROTATION.md → docs/security/SECRETS_ROTATION.md (consolidate with above)
- [ ] IMMEDIATE_SECURITY_ACTIONS.md → docs/security/IMMEDIATE_SECURITY_ACTIONS.md
- [ ] AUDIT_SECURITY.md → docs/archive/oct-22-analysis/AUDIT_SECURITY.md
- [ ] AUDIT_SECURITY_PHASE2B.md → docs/security/AUDIT_SECURITY_PHASE2B.md
- [ ] SECRETS.md → docs/security/SECRETS.md

### To docs/operations/ (6 files)
Operational procedures and deployment:
- [ ] RUNBOOK.md → docs/operations/RUNBOOK.md
- [ ] INCIDENT_RESPONSE.md → docs/operations/INCIDENT_RESPONSE.md
- [ ] PRODUCTION_DEPLOYMENT_GUIDE.md → docs/operations/PRODUCTION_DEPLOYMENT_GUIDE.md
- [ ] DEPLOY_NOW.md → docs/operations/DEPLOY_NOW.md
- [ ] DEPLOYMENT_INSTRUCTIONS.md → docs/operations/DEPLOYMENT_INSTRUCTIONS.md
- [ ] README_DEPLOYMENT.md → docs/operations/README_DEPLOYMENT.md
- [ ] SERVER_IMPLEMENTATION_CHECKLIST.md → docs/operations/SERVER_IMPLEMENTATION_CHECKLIST.md

### To docs/architecture/ (3 files)
Architecture documentation:
- [ ] ARCHITECTURE_DIAGRAM.md → docs/architecture/ARCHITECTURE_DIAGRAM.md
- [ ] AUDIT_ARCHITECTURE.md → docs/archive/oct-22-analysis/AUDIT_ARCHITECTURE.md

### To docs/api/ (3 files)
API documentation:
- [ ] API_DOCS_QUICKSTART.md → docs/api/API_DOCS_QUICKSTART.md
- [ ] API_DOCUMENTATION_COMPLETION_REPORT.md → docs/api/API_DOCUMENTATION_COMPLETION_REPORT.md
- [ ] ERRORS.md → docs/api/ERRORS.md

### To docs/multi-tenant/ (6 files)
Multi-tenant implementation:
- [ ] MULTI_TENANT_ROADMAP.md → docs/multi-tenant/MULTI_TENANT_ROADMAP.md
- [ ] MULTI_TENANT_IMPLEMENTATION_GUIDE.md → docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md
- [ ] MULTI_TENANT_QUICK_START.md → docs/multi-tenant/MULTI_TENANT_QUICK_START.md
- [ ] TENANT_ADMIN_USER_GUIDE.md → docs/multi-tenant/TENANT_ADMIN_USER_GUIDE.md
- [ ] MULTI_TENANCY_IMPLEMENTATION_PLAN.md → docs/multi-tenant/MULTI_TENANCY_IMPLEMENTATION_PLAN.md
- [ ] MULTI_TENANCY_READINESS_REPORT.md → docs/multi-tenant/MULTI_TENANCY_READINESS_REPORT.md

### To docs/phases/ (15 files - archive)
Phase completion reports (historical):
- [ ] PHASE_1_COMPLETION_REPORT.md → docs/phases/PHASE_1_COMPLETION_REPORT.md
- [ ] PHASE_2_ASSESSMENT.md → docs/phases/PHASE_2_ASSESSMENT.md
- [ ] PHASE_2_BRANDING_API_IMPLEMENTATION.md → docs/phases/PHASE_2_BRANDING_API_IMPLEMENTATION.md
- [ ] PHASE_2_WIDGET_CORE_COMPLETION_REPORT.md → docs/phases/PHASE_2_WIDGET_CORE_COMPLETION_REPORT.md
- [ ] PHASE_2_WIDGET_SUMMARY.md → docs/phases/PHASE_2_WIDGET_SUMMARY.md
- [ ] PHASE_2B_COMPLETION_REPORT.md → docs/phases/PHASE_2B_COMPLETION_REPORT.md
- [ ] PHASE_2C_TEST_COVERAGE_REPORT.md → docs/phases/PHASE_2C_TEST_COVERAGE_REPORT.md
- [ ] PHASE_2D_COMPLETION_REPORT.md → docs/phases/PHASE_2D_COMPLETION_REPORT.md
- [ ] PHASE_2D_FILES_SUMMARY.md → docs/phases/PHASE_2D_FILES_SUMMARY.md
- [ ] PHASE_3_STRIPE_CONNECT_COMPLETION_REPORT.md → docs/phases/PHASE_3_STRIPE_CONNECT_COMPLETION_REPORT.md
- [ ] PHASE_4_TENANT_ADMIN_COMPLETION_REPORT.md → docs/phases/PHASE_4_TENANT_ADMIN_COMPLETION_REPORT.md
- [ ] PHASE_4_IMPLEMENTATION_COMPLETE.md → docs/phases/PHASE_4_IMPLEMENTATION_COMPLETE.md
- [ ] PHASE_5_IMPLEMENTATION_SPEC.md → docs/phases/PHASE_5_IMPLEMENTATION_SPEC.md
- [ ] PHASE_5_EXECUTION_PLAN.md → docs/phases/PHASE_5_EXECUTION_PLAN.md

### To docs/roadmaps/ (7 files)
Product roadmaps and planning:
- [ ] ROADMAP.md → docs/roadmaps/ROADMAP.md
- [ ] IMPROVEMENT-ROADMAP-OPTIMIZED.md → docs/roadmaps/IMPROVEMENT-ROADMAP-OPTIMIZED.md
- [ ] IMPROVEMENT-ROADMAP.md → docs/roadmaps/IMPROVEMENT-ROADMAP.md
- [ ] EMBEDDABLE_STOREFRONT_RESEARCH.md → docs/roadmaps/EMBEDDABLE_STOREFRONT_RESEARCH.md
- [ ] EMBEDDABLE_MULTI_TENANT_IMPLEMENTATION_PLAN.md → docs/roadmaps/EMBEDDABLE_MULTI_TENANT_IMPLEMENTATION_PLAN.md
- [ ] WIDGET_INTEGRATION_GUIDE.md → docs/roadmaps/WIDGET_INTEGRATION_GUIDE.md
- [ ] SDK_IMPLEMENTATION_REPORT.md → docs/roadmaps/SDK_IMPLEMENTATION_REPORT.md

### To docs/archive/ (23+ files)
Outdated documentation and old audits:
- [ ] AUDIT_CODE_QUALITY.md → docs/archive/oct-22-analysis/AUDIT_CODE_QUALITY.md
- [ ] AUDIT_DOCUMENTATION.md → docs/archive/oct-22-analysis/AUDIT_DOCUMENTATION.md
- [ ] AUDIT_DOCUMENTATION_COMPREHENSIVE.md → docs/archive/oct-22-analysis/AUDIT_DOCUMENTATION_COMPREHENSIVE.md
- [ ] AUDIT_INTEGRATION.md → docs/archive/oct-22-analysis/AUDIT_INTEGRATION.md
- [ ] AUDIT_PERFORMANCE.md → docs/archive/oct-22-analysis/AUDIT_PERFORMANCE.md
- [ ] AUDIT_TEST_COVERAGE.md → docs/archive/oct-22-analysis/AUDIT_TEST_COVERAGE.md
- [ ] MASTER_AUDIT_REPORT.md → docs/archive/oct-22-analysis/MASTER_AUDIT_REPORT.md
- [ ] REMEDIATION_COMPLETE.md → docs/archive/oct-22-analysis/REMEDIATION_COMPLETE.md
- [ ] REMEDIATION_PLAN.md → docs/archive/oct-22-analysis/REMEDIATION_PLAN.md
- [ ] QA_UNIFIED_AUTH_TEST_REPORT.md → docs/archive/QA_UNIFIED_AUTH_TEST_REPORT.md
- [ ] work-log.md → docs/archive/work-log.md
- [ ] MIGRATION_LOG.md → docs/archive/MIGRATION_LOG.md
- [ ] TYPOGRAPHY_IMPROVEMENTS.md → docs/archive/TYPOGRAPHY_IMPROVEMENTS.md
- [ ] IMPLEMENTATION_SUMMARY.md → docs/archive/IMPLEMENTATION_SUMMARY.md
- [ ] AGENT_1_TENANT_AUTH_REPORT.md → docs/archive/AGENT_1_TENANT_AUTH_REPORT.md
- [ ] AGENT_2_REPORT.md → docs/archive/AGENT_2_REPORT.md
- [ ] AGENT_2_TENANT_API_REPORT.md → docs/archive/AGENT_2_TENANT_API_REPORT.md
- [ ] AGENT_3_FRONTEND_REPORT.md → docs/archive/AGENT_3_FRONTEND_REPORT.md
- [ ] AGENT_3_COMPONENT_TREE.md → docs/archive/AGENT_3_COMPONENT_TREE.md
- [ ] AGENT_4_BRANDING_DOCS_REPORT.md → docs/archive/AGENT_4_BRANDING_DOCS_REPORT.md
- [ ] PROMPTS.md → docs/archive/PROMPTS.md

### Special Cases (Keep Root or Move Later)
Files to evaluate separately:
- [ ] PROMPTS.md - May be useful for AI development workflows (archive for now)

## Link Updates Required

### Critical Files with Many Links to Update
Files that reference moved documents (priority order):

1. **README.md** (22+ links)
   - ./TESTING.md → no change (stays in root)
   - ./DEVELOPING.md → no change (stays in root)
   - ./MULTI_TENANT_ROADMAP.md → ./docs/multi-tenant/MULTI_TENANT_ROADMAP.md
   - ./ARCHITECTURE.md → no change (stays in root)
   - ./MULTI_TENANT_IMPLEMENTATION_GUIDE.md → ./docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md
   - ./SUPABASE.md → ./docs/setup/SUPABASE.md
   - ./RUNBOOK.md → ./docs/operations/RUNBOOK.md
   - ./INCIDENT_RESPONSE.md → ./docs/operations/INCIDENT_RESPONSE.md
   - ./WIDGET_INTEGRATION_GUIDE.md → ./docs/roadmaps/WIDGET_INTEGRATION_GUIDE.md
   - ./API_DOCS_QUICKSTART.md → ./docs/api/API_DOCS_QUICKSTART.md
   - ./DECISIONS.md → no change (stays in root)
   - ./ENVIRONMENT.md → ./docs/setup/ENVIRONMENT.md
   - ./SECRETS.md → ./docs/security/SECRETS.md
   - ./SECURITY.md → ./docs/security/SECURITY.md
   - ./SECRET_ROTATION_GUIDE.md → ./docs/security/SECRET_ROTATION_GUIDE.md
   - ./IMMEDIATE_SECURITY_ACTIONS.md → ./docs/security/IMMEDIATE_SECURITY_ACTIONS.md
   - ./PHASE_1_COMPLETION_REPORT.md → ./docs/phases/PHASE_1_COMPLETION_REPORT.md
   - ./PHASE_2B_COMPLETION_REPORT.md → ./docs/phases/PHASE_2B_COMPLETION_REPORT.md

2. **DEVELOPING.md** (7 links)
   - ./MULTI_TENANT_ROADMAP.md → ./docs/multi-tenant/MULTI_TENANT_ROADMAP.md
   - ./PHASE_5_IMPLEMENTATION_SPEC.md → ./docs/phases/PHASE_5_IMPLEMENTATION_SPEC.md
   - ./PHASE_4_TENANT_ADMIN_COMPLETION_REPORT.md → ./docs/phases/PHASE_4_TENANT_ADMIN_COMPLETION_REPORT.md
   - ./SECRET_ROTATION_GUIDE.md → ./docs/security/SECRET_ROTATION_GUIDE.md
   - ./IMMEDIATE_SECURITY_ACTIONS.md → ./docs/security/IMMEDIATE_SECURITY_ACTIONS.md
   - ./SECURITY.md → ./docs/security/SECURITY.md

3. **CONTRIBUTING.md** (6 links)
   - ./SUPABASE.md → ./docs/setup/SUPABASE.md
   - ./DEVELOPING.md → no change (stays in root)
   - ./TESTING.md → no change (stays in root)
   - ./ARCHITECTURE.md → no change (stays in root)
   - ./CODING_GUIDELINES.md → no change (stays in root)
   - ./DECISIONS.md → no change (stays in root)

4. **ARCHITECTURE.md** (2 links)
   - ./MULTI_TENANT_IMPLEMENTATION_GUIDE.md → ./docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md
   - ./PHASE_1_COMPLETION_REPORT.md → ./docs/phases/PHASE_1_COMPLETION_REPORT.md

5. **RUNBOOK.md** (3 links - will be moved itself)
   - ./SECURITY.md → ../security/SECURITY.md (relative from new location)
   - ./SECRET_ROTATION_GUIDE.md → ../security/SECRET_ROTATION_GUIDE.md
   - ./IMMEDIATE_SECURITY_ACTIONS.md → ../security/IMMEDIATE_SECURITY_ACTIONS.md

### Within docs/ Directory
Navigation README files already created with correct relative paths:
- docs/README.md
- docs/setup/README.md
- docs/security/README.md
- docs/operations/README.md
- docs/multi-tenant/README.md
- docs/api/README.md
- docs/architecture/README.md
- docs/roadmaps/README.md
- docs/phases/README.md
- docs/archive/README.md

## Execution Plan

### Phase 1: Preparation (Complete)
- [x] Create docs/ subdirectories
- [x] Create navigation README.md files in each subdirectory
- [x] Verify directory structure

### Phase 2: Move Files & Update Links (Next Step)
Execute in this order to minimize broken links:

1. **Move Archive Files First** (lowest impact)
   - Move all AUDIT_* files to docs/archive/oct-22-analysis/
   - Move all AGENT_* reports to docs/archive/
   - Move work-log.md, MIGRATION_LOG.md, etc.

2. **Move Phase Reports** (referenced by few files)
   - Move all PHASE_* files to docs/phases/

3. **Move Specialized Documentation**
   - Multi-tenant files → docs/multi-tenant/
   - Roadmap files → docs/roadmaps/
   - API files → docs/api/
   - Architecture files → docs/architecture/

4. **Move Operations & Security** (frequently referenced)
   - Operations files → docs/operations/
   - Security files → docs/security/

5. **Move Setup Files Last** (most referenced)
   - Setup files → docs/setup/

6. **Update Links in Root Files**
   - README.md (22+ links)
   - DEVELOPING.md (7 links)
   - CONTRIBUTING.md (6 links)
   - ARCHITECTURE.md (2 links)

### Phase 3: Verification
1. Run link checker to find broken links
2. Test all documentation navigation paths
3. Verify all README.md files render correctly
4. Update any missed references

## Estimated Time
- **Total Migration Time:** 60-90 minutes
- **File Moves:** 30 minutes
- **Link Updates:** 30-45 minutes
- **Verification:** 15 minutes

## Rollback Plan
If issues arise:
1. All files are version controlled in git
2. Can revert with: `git checkout HEAD -- docs/ *.md`
3. Or selectively restore specific files

## Success Criteria
- [ ] All files successfully moved to target directories
- [ ] All links in root files updated and working
- [ ] No broken links in moved documentation
- [ ] All README.md navigation files functional
- [ ] Documentation structure matches plan
- [ ] Git commit preserves file history

## Notes
- Use `git mv` to preserve file history
- Test each batch of moves before proceeding
- Keep this migration plan for future reference
- Update CHANGELOG.md with reorganization details
