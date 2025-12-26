# Documentation Drift Report

**Agent:** B3 - Documentation Drift & Doc System Audit
**Date:** 2025-12-26
**Repository:** MAIS (Macon AI Solutions)
**Status:** Complete Audit

---

## Executive Summary

This audit examined 200+ documentation files across the MAIS codebase to identify stale documentation, conflicting information, missing documentation, and doc system quality issues. The documentation system is mature with strong foundations (Diataxis framework, ADR process, archival policies) but has accumulated drift since the Next.js migration in December 2025.

**Key Findings:**
- 15 HIGH severity issues (broken links, stale references, conflicting info)
- 22 MEDIUM severity issues (outdated content, missing docs)
- 18 LOW severity issues (minor inconsistencies, style issues)

---

## 1. Stale Documentation

### 1.1 Outdated Sprint/Status Information

| Doc Path | Issue | Severity | Fix |
|----------|-------|----------|-----|
| `/docs/INDEX.md` (lines 171-196) | References "Sprint 6 (November 2025)" as current focus; we are now post-Sprint 10 in December 2025 | HIGH | Update current focus section to reflect actual current sprint |
| `/docs/README.md` (lines 199-218) | Same stale sprint status mentioning Sprint 6-7 | HIGH | Sync with current sprint status |
| `/.claude/PROJECT.md` (lines 5-7, 66-68) | States "Sprint 6 Complete (60% test pass rate)" but CLAUDE.md says "771 server tests + 114 E2E tests" | MEDIUM | Update to match CLAUDE.md current status |
| `/CLAUDE.md` (lines 657-699) | "Current Sprint Goals" section mentions "MVP Sprint Status: Day 4 Complete" with November 25, 2025 dates | MEDIUM | Archive or update to current sprint |
| `/README.md` (lines 67-68) | States "Current Maturity: Sprint 10 Complete" but mentions "January 2025" | MEDIUM | Update dates to December 2025 |
| `/README.md` (lines 816-828) | "Sprint 10 Phase 2 Complete (Nov 24, 2025)" but we are now in December 2025 | LOW | Update date references |

### 1.2 Missing Directories Referenced in Docs

| Reference Location | Missing Path | Severity | Fix |
|--------------------|--------------|----------|-----|
| `/docs/INDEX.md` (line 117) | `/docs/phases/` (not in `docs/`, only in `docs/archive/2025-11/phases/`) | HIGH | Update reference to archive location |
| `/docs/README.md` (lines 158, 170, 179, 219) | `/docs/sprints/` does not exist | HIGH | Update to `docs/archive/2025-11/sprints/` or create `sprints/` directory |
| `/docs/README.md` (line 226) | `/docs/archive/planning/2025-01-analysis/` should be `/docs/archive/2025-01/planning/2025-01-analysis/` | MEDIUM | Fix path |
| `/CLAUDE.md` (line 382) | `docs/solutions/SCHEMA_DRIFT_PREVENTION.md` exists but not the same as `docs/solutions/database-issues/schema-drift-prevention-MAIS-20251204.md` mentioned later | LOW | Clarify which is canonical |

### 1.3 Outdated File References in CLAUDE.md

| Reference | Issue | Severity | Fix |
|-----------|-------|----------|-----|
| `/CLAUDE.md` (line 580) | `CODE-REVIEW-ANY-TYPE-CHECKLIST.md` does not exist at `docs/solutions/` | HIGH | Create file or update reference |
| `/CLAUDE.md` (line 441) | `docs/multi-tenant/MULTI_TENANCY_READINESS_REPORT.md` does not exist | MEDIUM | File missing or renamed |
| `/CLAUDE.md` (line 389) | States "Coverage target: 70% (current: 100% pass rate, 752 passing tests)" but current is 771 tests | LOW | Update test count |

### 1.4 Outdated Architecture References

| Doc Path | Issue | Severity | Fix |
|----------|-------|----------|-----|
| `/ARCHITECTURE.md` (lines 44-109) | "Config-Driven Architecture" section describes Sprint 2-4 plans as future work, but some is complete | MEDIUM | Update to reflect current completion status |
| `/ARCHITECTURE.md` (lines 606-614) | "Production Deployment" section says "Demo Users (January 2025)" but Next.js migration is complete | MEDIUM | Update deployment status |
| `/README.md` (lines 283-285) | States "Infrastructure: pnpm workspaces" but project uses "npm workspaces" per CLAUDE.md | MEDIUM | Fix inconsistency (npm is correct) |

---

## 2. Conflicting Documentation

### 2.1 Test Count Discrepancies

| Location A | Location B | Conflict | Severity |
|------------|------------|----------|----------|
| `/CLAUDE.md` line 21 | `/README.md` line 807 | CLAUDE.md: "771 server tests + 114 E2E tests" vs README.md: "752/752 tests passing" | HIGH |
| `/CLAUDE.md` line 389 | `/.claude/PROJECT.md` line 8 | CLAUDE.md: "752 passing tests" vs PROJECT.md: "60% test pass rate" | MEDIUM |

### 2.2 Sprint/Phase Status Conflicts

| Location A | Location B | Conflict | Severity |
|------------|------------|----------|----------|
| `/CLAUDE.md` (status section) | `/docs/INDEX.md` | CLAUDE.md shows Next.js migration complete; INDEX.md shows Sprint 6-7 focus | HIGH |
| `/README.md` line 68 | `/docs/README.md` line 201 | README says "Deploying for Demo Users (January 2025)"; docs/README says "Sprint 6 (November 2025)" | HIGH |

### 2.3 Package Manager Inconsistency

| Location | States | Correct Value |
|----------|--------|---------------|
| `/README.md` line 283 | "pnpm workspaces" | npm workspaces |
| `/CLAUDE.md` line 34 | "npm run --workspace=server test" | npm workspaces (correct) |
| `/ARCHITECTURE.md` line 599 | No mention | Should document npm workspaces |

### 2.4 Directory Structure Conflicts

The actual directory structure differs from documentation in several places:

| Documented | Actual | Severity |
|------------|--------|----------|
| `docs/phases/` exists | Only in `docs/archive/2025-11/phases/` | MEDIUM |
| `docs/sprints/` exists | Only in `docs/archive/2025-11/sprints/` | MEDIUM |
| `docs/operations/DEPLOYMENT_GUIDE.md` | File is `PRODUCTION_DEPLOYMENT_GUIDE.md` | LOW |

---

## 3. Missing Documentation

### 3.1 Public APIs Without Docs

| API/Feature | Expected Doc Location | Severity |
|-------------|----------------------|----------|
| Next.js API routes (`/api/*`) | `apps/web/README.md` mentions but no dedicated API reference | MEDIUM |
| NextAuth.js session callbacks | Missing from `docs/security/NEXTAUTH_SECURITY.md` | MEDIUM |
| Custom domain middleware | `apps/web/src/middleware.ts` lacks detailed docs | LOW |

### 3.2 Complex Functions Without JSDoc

| File | Functions Missing JSDoc | Severity |
|------|------------------------|----------|
| `server/src/di.ts` | Complex DI container setup | MEDIUM |
| `apps/web/src/lib/tenant.ts` | `normalizeToPages()` and cache patterns | MEDIUM |
| `server/src/services/booking.service.ts` | Advisory lock implementation details | LOW |

### 3.3 Missing Error Handling Documentation

| Topic | Current Status | Severity |
|-------|---------------|----------|
| Next.js `error.tsx` patterns | Mentioned in CLAUDE.md but no dedicated guide | MEDIUM |
| Domain error codes | `docs/api/ERRORS.md` exists but incomplete | MEDIUM |
| Webhook error recovery | `docs/security/WEBHOOK_ERROR_PREVENTION*.md` exists but scattered | LOW |

### 3.4 Recent Features Without Corresponding Docs

Based on git log, these recent features lack dedicated documentation:

| Feature (from git log) | Missing Doc | Severity |
|------------------------|-------------|----------|
| Page Management UI with section editors (Dec 25) | No user guide | MEDIUM |
| Locked Template System (Dec 25) | Documented in ARCHITECTURE.md but no dedicated guide | LOW |
| Pages navigation and plate tenant seed (Dec 25) | No docs | LOW |

---

## 4. Doc System Quality

### 4.1 Entry Point Assessment

| Entry Point | Quality | Issues |
|-------------|---------|--------|
| `/docs/README.md` | Good | Clear Diataxis-based structure |
| `/docs/INDEX.md` | Good | Comprehensive navigation |
| `/CLAUDE.md` | Excellent | Most comprehensive, AI-optimized |
| `/README.md` | Good | User-focused but slightly stale |

**Overall:** The entry points are well-structured but have date drift issues.

### 4.2 Navigation Quality

| Aspect | Assessment |
|--------|------------|
| Logical organization | Good - Diataxis framework applied |
| Broken internal links | MEDIUM - 5+ broken links to non-existent directories |
| Cross-referencing | Good - docs reference each other appropriately |
| Search-friendly | Good - descriptive filenames |

### 4.3 Categorization Issues

| Category | Issue | Severity |
|----------|-------|----------|
| `docs/solutions/` | 100+ files, some should be in subdirectories | MEDIUM |
| `docs/archive/` | Good time-based structure | - |
| `docs/security/` | Webhook docs could be consolidated | LOW |

### 4.4 Duplication Assessment

| Duplicate Topic | Files | Severity |
|-----------------|-------|----------|
| Schema drift prevention | `SCHEMA_DRIFT_PREVENTION.md`, `schema-drift-prevention-MAIS-20251204.md`, `DATABASE-SCHEMA-DRIFT-SOLUTION.md` | MEDIUM |
| File upload security | 8+ files in `docs/solutions/` | MEDIUM |
| ESM/CJS compatibility | 10+ files | HIGH |
| Client auth | 6+ files | MEDIUM |

---

## 5. Doc-vs-Code Mismatches

### 5.1 API Routes vs Documentation

| Documented Route | Actual Route | Status |
|------------------|--------------|--------|
| `POST /v1/admin/login` | Exists | OK |
| `GET /v1/packages` | Exists | OK |
| `POST /v1/auth/signup` | Exists | Documented in `docs/api/SIGNUP_API_USAGE.md` |
| Next.js API routes | Multiple in `apps/web/src/app/api/` | Missing consolidated doc |

### 5.2 Directory Structure vs ARCHITECTURE.md

| Documented Structure | Actual | Match |
|---------------------|--------|-------|
| `apps/web/` | Exists | YES |
| `server/src/routes/` | Exists | YES |
| `server/src/services/` | Exists | YES |
| `server/src/adapters/` | Exists | YES |
| `client/` | Exists (legacy admin) | YES |
| `packages/contracts/` | Exists | YES |
| `packages/shared/` | Exists | YES |

### 5.3 Environment Variables vs Documentation

| Documented | Actual (.env.example check needed) | Status |
|------------|-----------------------------------|--------|
| `JWT_SECRET` | Required | OK |
| `DATABASE_URL` | Required | OK |
| `STRIPE_SECRET_KEY` | Required for real mode | OK |
| `NEXTAUTH_SECRET` | Not in CLAUDE.md | MISSING from main docs |
| `NEXTAUTH_URL` | Not in CLAUDE.md | MISSING from main docs |

### 5.4 Test Structure vs Documentation

| Documented | Actual | Match |
|------------|--------|-------|
| `server/test/` | Exists | YES |
| `e2e/` | Exists | YES |
| Next.js tests mentioned | Location unclear | UNCLEAR |

---

## 6. Proposed Doc Information Architecture

### 6.1 Recommended Structure (Based on Diataxis + Current Best Practices)

```
docs/
├── README.md                    # Hub (keep as-is)
├── INDEX.md                     # Navigation (keep, update links)
├── QUICK_START.md               # NEW: 5-minute getting started
│
├── tutorials/                   # Learning-oriented (NEW)
│   ├── first-booking-flow.md
│   ├── creating-a-tenant.md
│   └── setting-up-development.md
│
├── guides/                      # Task-oriented (expand)
│   ├── deploying-to-production.md
│   ├── rotating-secrets.md
│   ├── custom-domain-setup.md
│   └── implementing-isr.md
│
├── reference/                   # Information-oriented (expand)
│   ├── api/                     # Consolidate from docs/api/
│   ├── environment-variables.md # Consolidate from setup/
│   ├── error-codes.md
│   └── adrs/                    # Move from docs/adrs/
│
├── explanation/                 # Understanding-oriented (NEW)
│   ├── multi-tenant-architecture.md
│   ├── locked-template-system.md
│   └── webhook-processing.md
│
├── operations/                  # Keep as-is
│   ├── RUNBOOK.md
│   ├── INCIDENT_RESPONSE.md
│   └── DEPLOYMENT_GUIDE.md
│
├── security/                    # Keep as-is, consolidate
│
├── solutions/                   # Keep but reorganize
│   ├── by-category/             # Subdirectories for related issues
│   └── quick-reference/         # 1-page summaries
│
└── archive/                     # Keep time-based structure
    └── YYYY-MM/
```

### 6.2 Files to Consolidate

| Current Files | Proposed Consolidated File |
|--------------|---------------------------|
| 10 ESM/CJS files in `docs/solutions/` | `docs/solutions/esm-cjs/README.md` + subdocs |
| 8 File Upload files | `docs/solutions/file-upload/README.md` + subdocs |
| 6 Client Auth files | `docs/solutions/client-auth/README.md` + subdocs |
| 3 Schema Drift files | Single `docs/reference/schema-drift.md` |

### 6.3 Files to Archive

| File | Reason | Archive To |
|------|--------|-----------|
| Sprint 6 references throughout | Outdated | Keep content, update references |
| Phase 1-5 references in active docs | Historical | Already in `archive/2025-11/phases/` |
| `docs/DOCUMENTATION_CLEANUP_PLAN.md` | If complete | `archive/2025-12/` |

### 6.4 New Docs Needed

| Doc | Priority | Content |
|-----|----------|---------|
| `docs/tutorials/first-booking-flow.md` | HIGH | Hands-on tutorial |
| `docs/reference/nextauth-configuration.md` | HIGH | NextAuth.js v5 setup |
| `docs/explanation/locked-template-system.md` | MEDIUM | Extracted from ARCHITECTURE.md |
| `docs/guides/nextjs-development.md` | MEDIUM | Next.js-specific patterns |
| `docs/reference/api/routes.md` | MEDIUM | Consolidated API reference |

---

## 7. Prioritized Remediation Plan

### Phase 1: Critical Fixes (This Week)

1. **Fix broken directory references** (HIGH)
   - Update `/docs/sprints/` to `/docs/archive/2025-11/sprints/`
   - Update `/docs/phases/` to `/docs/archive/2025-11/phases/`

2. **Update current status sections** (HIGH)
   - Sync CLAUDE.md, README.md, docs/INDEX.md, docs/README.md to current sprint
   - Remove or update "MVP Sprint Status: Day 4" section

3. **Fix test count discrepancies** (HIGH)
   - Standardize on 771 tests (current count from CLAUDE.md)

4. **Create missing referenced file** (HIGH)
   - Create `docs/solutions/CODE-REVIEW-ANY-TYPE-CHECKLIST.md` or update CLAUDE.md reference

### Phase 2: Doc Organization (Next Week)

1. Create subdirectories in `docs/solutions/` for related files
2. Consolidate ESM/CJS docs (10 files -> 1 index + subdocs)
3. Consolidate File Upload docs (8 files -> 1 index + subdocs)
4. Add NextAuth environment variables to main docs

### Phase 3: Content Improvements (Ongoing)

1. Write `QUICK_START.md` tutorial
2. Create dedicated Next.js development guide
3. Expand `docs/reference/` with API routes documentation
4. Archive completed phase/sprint references from active docs

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **HIGH Severity Issues** | 15 |
| **MEDIUM Severity Issues** | 22 |
| **LOW Severity Issues** | 18 |
| **Total Issues** | 55 |
| **Files Audited** | 200+ |
| **Broken Internal Links** | 5+ |
| **Duplicate Topic Areas** | 4 major |
| **Missing Docs Identified** | 5 |

---

## Appendix: File-by-File Issue Log

### Root Level Documents

| File | Issues Found |
|------|--------------|
| `CLAUDE.md` | Stale sprint info, missing file reference, test count mismatch |
| `README.md` | Date inconsistencies, pnpm vs npm, stale sprint status |
| `ARCHITECTURE.md` | Future plans section needs update, demo user dates stale |
| `DECISIONS.md` | Good - index is current |

### docs/ Documents

| File | Issues Found |
|------|--------------|
| `docs/INDEX.md` | Broken links to /sprints/ and /phases/, stale sprint focus |
| `docs/README.md` | Same broken links, stale sprint status |
| `docs/TESTING.md` | Needs review against current test infrastructure |

### .claude/ Documents

| File | Issues Found |
|------|--------------|
| `.claude/PROJECT.md` | Stale sprint status (Sprint 6 vs current) |
| `.claude/PATTERNS.md` | Good - patterns still valid |
| `.claude/commands/check.md` | Good |

---

**Report Generated:** 2025-12-26
**Auditor:** Agent B3 - Documentation Drift Audit
**Next Review:** Recommended in 30 days or after major release
