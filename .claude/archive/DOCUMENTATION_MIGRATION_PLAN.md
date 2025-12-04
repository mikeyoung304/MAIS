# Documentation Migration Plan: Diátaxis Framework

**Migration Planner**: Documentation Systems Architect
**Date**: 2025-11-12
**Project**: Elope Wedding Booking Platform
**Scope**: 261 markdown files → Diátaxis 4-quadrant framework

---

## Executive Summary

This plan migrates Elope's 261 documentation files from an ad-hoc 9-category structure to the proven **Diátaxis framework** (tutorials, how-to, reference, explanation). The migration addresses critical documentation drift identified in the Strategic Audit and establishes sustainable governance to prevent future decay.

**Key Metrics:**

- **Total Files**: 261 markdown files (excluding node_modules)
- **Current Structure**: 9 ad-hoc categories + scattered files
- **Target Structure**: 4 Diátaxis quadrants + time-based archive
- **Estimated Effort**: 45-55 hours across 4 phases
- **Risk Level**: Medium (cross-references, team adaptation)
- **Expected ROI**: 100+ hours saved annually in documentation maintenance

**Critical Success Factors:**

1. Phased migration (avoid big-bang disruption)
2. Automated link validation and rewriting
3. Team buy-in and training on new structure
4. Governance model to prevent drift

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target Diátaxis Structure](#target-diataxis-structure)
3. [File-by-File Migration Mapping](#file-by-file-migration-mapping)
4. [Migration Phases](#migration-phases)
5. [Risk Assessment](#risk-assessment)
6. [Rollback Strategy](#rollback-strategy)
7. [Validation & Quality Assurance](#validation--quality-assurance)
8. [Governance & Sustainability](#governance--sustainability)
9. [Success Metrics](#success-metrics)

---

## Current State Analysis

### Directory Distribution

| Location             | Count | Primary Content                                  |
| -------------------- | ----- | ------------------------------------------------ |
| `docs/archive/`      | 115   | Historical docs, old analyses, deprecated guides |
| `docs/phases/`       | 15    | Phase completion reports (1-5)                   |
| `docs/sprints/`      | 14    | Sprint 1-6 session reports, handoffs, blockers   |
| `.claude/`           | 33    | Agent reports, audit findings, analysis          |
| `docs/multi-tenant/` | 7     | Multi-tenant implementation guides, roadmaps     |
| `docs/operations/`   | 6     | Runbooks, deployment, incident response          |
| `docs/security/`     | 7     | Security guides, secret rotation, audits         |
| `docs/roadmaps/`     | 7     | Product roadmaps, widget integration             |
| `docs/setup/`        | 5     | Environment setup, local testing                 |
| `docs/api/`          | 4     | API documentation, error codes                   |
| `client/`            | 12    | Client-specific guides (Auth, SDK, widgets)      |
| `server/`            | 12    | Server-specific guides (Stripe, auth, testing)   |
| Root                 | 24    | Core docs (README, ARCHITECTURE, TESTING, etc.)  |

**Total**: 261 files

### Critical Issues Identified

1. **Documentation Drift** (5 days post-reorg):
   - Sprint 4-6 docs scattered across 3 locations
   - 33 files in `.claude/` bypassing structure
   - Duplication between `.claude/` and `docs/sprints/`

2. **Archive Confusion**:
   - `docs/archive/october-2025-analysis/` mislabeled (should be nov-2025)
   - Mixed time periods in same archive folder
   - No clear archival criteria

3. **Navigation Fragmentation**:
   - Single `docs/INDEX.md` as sole entry point
   - No persona-based navigation
   - No learning paths for new developers

4. **Metadata Gaps**:
   - Only ~10% of files have "Last Updated" dates
   - No version tracking in documents
   - No ownership information

5. **Content Categorization Issues**:
   - Phase reports are historical but not archived
   - Sprint docs are reports, not guides
   - API docs mixed with implementation guides

---

## Target Diátaxis Structure

### Framework Overview

The [Diátaxis framework](https://diataxis.fr/) organizes documentation along two axes:

**Axis 1: Study vs Work**

- **Study**: Learning-oriented (tutorials, explanations)
- **Work**: Task-oriented (how-to guides, reference)

**Axis 2: Practical vs Theoretical**

- **Practical**: Code-focused (tutorials, how-to)
- **Theoretical**: Concept-focused (explanations, reference)

**Four Quadrants:**

```
                    Practical
                        │
         TUTORIALS      │      HOW-TO GUIDES
         (Learning)     │      (Problem-solving)
                        │
Study ──────────────────┼──────────────────── Work
                        │
         EXPLANATION    │      REFERENCE
         (Understanding)│      (Information)
                        │
                    Theoretical
```

### Directory Structure

```
docs/
├── README.md                          # Framework explanation + navigation
├── tutorials/                         # Learning-oriented (new users)
│   ├── README.md
│   ├── 01-quick-start.md             # Get Elope running in 15 minutes
│   ├── 02-first-tenant.md            # Create your first tenant
│   ├── 03-first-booking.md           # Complete a booking flow
│   ├── 04-admin-dashboard.md         # Navigate the admin dashboard
│   └── 05-widget-integration.md     # Embed widget on a site
│
├── how-to/                            # Task-oriented (solve problems)
│   ├── README.md
│   ├── deployment/
│   │   ├── deploy-to-production.md
│   │   ├── setup-stripe-webhooks.md
│   │   ├── configure-email-provider.md
│   │   └── rotate-secrets.md
│   ├── development/
│   │   ├── add-new-endpoint.md
│   │   ├── write-integration-test.md
│   │   ├── debug-multi-tenant-issue.md
│   │   └── switch-mock-to-real-mode.md
│   ├── operations/
│   │   ├── troubleshoot-failed-booking.md
│   │   ├── investigate-stripe-webhook-failure.md
│   │   ├── handle-production-incident.md
│   │   └── rollback-deployment.md
│   └── tenant-admin/
│       ├── upload-package-photos.md
│       ├── configure-branding.md
│       ├── set-blackout-dates.md
│       └── manage-packages.md
│
├── reference/                         # Information-oriented (lookup)
│   ├── README.md
│   ├── api/
│   │   ├── README.md
│   │   ├── endpoints.md              # Complete API reference
│   │   ├── authentication.md         # API key formats, validation
│   │   ├── error-codes.md           # All error responses
│   │   └── webhooks.md              # Webhook payloads
│   ├── architecture/
│   │   ├── README.md
│   │   ├── database-schema.md       # Prisma schema reference
│   │   ├── service-contracts.md     # Service interfaces
│   │   └── data-flow-diagrams.md    # System diagrams
│   ├── configuration/
│   │   ├── environment-variables.md # Complete .env reference
│   │   ├── adapter-presets.md       # Mock vs real mode
│   │   └── feature-flags.md         # Available flags
│   └── cli/
│       ├── npm-scripts.md           # All package.json scripts
│       └── slash-commands.md        # Claude Code slash commands
│
├── explanation/                       # Understanding-oriented (concepts)
│   ├── README.md
│   ├── architecture/
│   │   ├── multi-tenancy.md         # Why multi-tenant? How it works
│   │   ├── modular-monolith.md      # ADR-0001 deep dive
│   │   ├── mock-first-development.md # ADR-0002 deep dive
│   │   ├── commission-calculation.md # Business logic explanation
│   │   └── config-driven-platform.md # 2025 transformation vision
│   ├── patterns/
│   │   ├── repository-pattern.md
│   │   ├── dependency-injection.md
│   │   ├── pessimistic-locking.md
│   │   └── webhook-idempotency.md
│   ├── security/
│   │   ├── threat-model.md
│   │   ├── encryption-strategy.md
│   │   └── rate-limiting-design.md
│   └── project-history/
│       ├── phases-overview.md       # Phase 1-5 summary
│       └── config-pivot-story.md    # 2025 transformation story
│
├── archive/                           # Time-based archival
│   ├── README.md                     # Archive policy + index
│   ├── 2025-11/                      # November 2025
│   │   ├── sprints/
│   │   │   ├── sprint-4/            # Sprint 4 session reports
│   │   │   ├── sprint-5-6/          # Sprint 5-6 session reports
│   │   │   └── README.md
│   │   ├── phases/
│   │   │   ├── phase-1-completion.md
│   │   │   ├── phase-2b-completion.md
│   │   │   └── README.md
│   │   ├── audits/
│   │   │   ├── documentation-audit.md
│   │   │   ├── production-readiness.md
│   │   │   └── README.md
│   │   └── README.md                # Month index
│   ├── 2025-10/                      # October 2025
│   │   ├── analysis/
│   │   │   ├── comprehensive-audit.md
│   │   │   ├── security-audit.md
│   │   │   └── README.md
│   │   └── README.md
│   └── 2025-01/                      # January 2025 (planning)
│       ├── config-pivot-analysis/
│       ├── mcp-analysis/
│       └── README.md
│
└── DOCUMENTATION_STANDARDS.md        # NEW: Governance document

.claude/                               # Agent workspace (gitignored in production)
├── PROJECT.md                        # Keep (agent quick reference)
├── PATTERNS.md                       # Keep (validation patterns)
└── commands/                         # Keep (slash commands)
```

### Content Guidelines by Quadrant

#### Tutorials (Learning-Oriented)

- **Audience**: Complete beginners
- **Goal**: Build confidence through successful completion
- **Style**: Step-by-step, prescriptive, encouraging
- **Scope**: Minimal, focused on learning
- **Example**: "Build Your First Booking Flow in 30 Minutes"

**Characteristics**:

- Numbered steps (1, 2, 3...)
- Expected outputs shown
- No assumptions about prior knowledge
- One clear learning objective
- Works every time (tested regularly)

#### How-To Guides (Problem-Solving)

- **Audience**: Users with specific goals
- **Goal**: Solve a real-world problem
- **Style**: Direct, practical, goal-oriented
- **Scope**: Narrow, focused on one task
- **Example**: "How to Rotate JWT Secrets Without Downtime"

**Characteristics**:

- Starts with the problem/goal
- Assumes basic knowledge
- Multiple approaches OK
- Troubleshooting section
- Links to reference docs

#### Reference (Information)

- **Audience**: Users needing factual details
- **Goal**: Provide accurate, comprehensive information
- **Style**: Dry, technical, exhaustive
- **Scope**: Complete coverage of topic
- **Example**: "Environment Variables Reference"

**Characteristics**:

- Alphabetical or logical ordering
- Every option documented
- No opinions or recommendations
- Consistent structure
- Machine-readable when possible

#### Explanation (Understanding)

- **Audience**: Users wanting deeper understanding
- **Goal**: Clarify concepts and decisions
- **Style**: Discursive, contextual, thoughtful
- **Scope**: Broad, explores connections
- **Example**: "Why Elope Uses Multi-Tenant Architecture"

**Characteristics**:

- Answers "why?" not "how?"
- Explores alternatives considered
- Discusses trade-offs
- Provides context and history
- Links to related concepts

---

## File-by-File Migration Mapping

### Phase 1: Foundation Files (Priority 0)

These files form the new structure's foundation and must be created first.

| New Location                      | Source Material | Action                         | Effort |
| --------------------------------- | --------------- | ------------------------------ | ------ |
| `docs/README.md`                  | Write new       | Create framework guide         | 2h     |
| `docs/tutorials/README.md`        | Write new       | Tutorial index + guidelines    | 1h     |
| `docs/how-to/README.md`           | Write new       | How-to index + guidelines      | 1h     |
| `docs/reference/README.md`        | Write new       | Reference index + guidelines   | 1h     |
| `docs/explanation/README.md`      | Write new       | Explanation index + guidelines | 1h     |
| `docs/archive/README.md`          | Write new       | Archive policy + index         | 1h     |
| `docs/DOCUMENTATION_STANDARDS.md` | Write new       | Governance document            | 3h     |

**Total Phase 1 Effort**: 10 hours

### Phase 2: Core User Docs (Priority 1)

Critical docs that users need immediately. Must work in new structure.

#### Tutorials

| New Location                              | Current Location                               | Status                 | Effort |
| ----------------------------------------- | ---------------------------------------------- | ---------------------- | ------ |
| `docs/tutorials/01-quick-start.md`        | Root: `README.md` (Quick Start section)        | Extract + simplify     | 2h     |
| `docs/tutorials/02-first-tenant.md`       | Root: `README.md` (Create First Tenant)        | Extract + expand       | 2h     |
| `docs/tutorials/03-first-booking.md`      | Write new from `DEVELOPING.md`                 | Create new             | 3h     |
| `docs/tutorials/04-admin-dashboard.md`    | `docs/multi-tenant/TENANT_ADMIN_USER_GUIDE.md` | Simplify for beginners | 2h     |
| `docs/tutorials/05-widget-integration.md` | `docs/roadmaps/WIDGET_INTEGRATION_GUIDE.md`    | Extract quickstart     | 2h     |

**Subtotal**: 11 hours

#### How-To Guides

| New Location                                           | Current Location                                 | Status           | Effort |
| ------------------------------------------------------ | ------------------------------------------------ | ---------------- | ------ |
| `docs/how-to/deployment/deploy-to-production.md`       | `docs/operations/PRODUCTION_DEPLOYMENT_GUIDE.md` | Move + update    | 1h     |
| `docs/how-to/deployment/setup-stripe-webhooks.md`      | `docs/operations/RUNBOOK.md` (extract)           | Extract section  | 1h     |
| `docs/how-to/deployment/configure-email-provider.md`   | `docs/operations/RUNBOOK.md` (extract)           | Extract section  | 1h     |
| `docs/how-to/deployment/rotate-secrets.md`             | `docs/security/SECRET_ROTATION_GUIDE.md`         | Move as-is       | 0.5h   |
| `docs/how-to/development/add-new-endpoint.md`          | `DEVELOPING.md` (extract)                        | Extract + expand | 2h     |
| `docs/how-to/development/write-integration-test.md`    | `TESTING.md` + `server/test/helpers/README.md`   | Synthesize       | 2h     |
| `docs/how-to/operations/handle-production-incident.md` | `docs/operations/INCIDENT_RESPONSE.md`           | Move as-is       | 0.5h   |
| `docs/how-to/tenant-admin/upload-package-photos.md`    | `client/QUICK_START_PHOTO_UPLOADER.md`           | Move + update    | 1h     |

**Subtotal**: 9 hours

#### Reference

| New Location                                            | Current Location                                         | Status              | Effort |
| ------------------------------------------------------- | -------------------------------------------------------- | ------------------- | ------ |
| `docs/reference/api/endpoints.md`                       | `docs/api/README.md` + `docs/api/API_DOCS_QUICKSTART.md` | Consolidate         | 2h     |
| `docs/reference/api/error-codes.md`                     | `docs/api/ERRORS.md`                                     | Move as-is          | 0.5h   |
| `docs/reference/configuration/environment-variables.md` | `docs/setup/ENVIRONMENT.md` + `server/ENV_VARIABLES.md`  | Consolidate         | 1.5h   |
| `docs/reference/architecture/database-schema.md`        | Extract from `server/prisma/schema.prisma`               | Generate + annotate | 3h     |

**Subtotal**: 7 hours

#### Explanation

| New Location                                              | Current Location                                         | Status                    | Effort |
| --------------------------------------------------------- | -------------------------------------------------------- | ------------------------- | ------ |
| `docs/explanation/architecture/multi-tenancy.md`          | `docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md` | Rewrite for understanding | 3h     |
| `docs/explanation/architecture/modular-monolith.md`       | `DECISIONS/0001-modular-monolith.md`                     | Expand ADR                | 2h     |
| `docs/explanation/architecture/mock-first-development.md` | `DECISIONS/0002-mock-first.md`                           | Expand ADR                | 2h     |
| `docs/explanation/architecture/config-driven-platform.md` | Root: `README.md` (Agent-Powered section)                | Extract + expand          | 3h     |

**Subtotal**: 10 hours

**Total Phase 2 Effort**: 37 hours

### Phase 3: Archive Migration (Priority 2)

Move historical and sprint documentation to time-based archive.

#### Archive: 2025-11 (November - Current Sprint)

| New Location                               | Current Location                                 | Action                            | Count    |
| ------------------------------------------ | ------------------------------------------------ | --------------------------------- | -------- |
| `docs/archive/2025-11/sprints/sprint-4/`   | `docs/sprints/sprint-4/*`                        | Move all files                    | 7 files  |
| `docs/archive/2025-11/sprints/sprint-5-6/` | `docs/sprints/sprint-5-6/*`                      | Move all files                    | 7 files  |
| `docs/archive/2025-11/sprints/sprint-4/`   | `.claude/SPRINT_4_*.md`                          | Move duplicates                   | 0 files  |
| `docs/archive/2025-11/sprints/sprint-5-6/` | `.claude/SPRINT_5_*.md`, `.claude/SPRINT_6_*.md` | Move duplicates                   | 6 files  |
| `docs/archive/2025-11/phases/`             | `docs/phases/*`                                  | Move all phase completion reports | 15 files |
| `docs/archive/2025-11/audits/`             | `.claude/DOCUMENTATION_AUDIT_*.md`               | Move audit reports                | 2 files  |
| `docs/archive/2025-11/audits/`             | `.claude/PRODUCTION_READINESS_*.md`              | Move assessment                   | 1 file   |
| `docs/archive/2025-11/audits/`             | `.claude/LINT_*.md`, `.claude/UNSAFE_*.md`       | Move technical reports            | 4 files  |

**Files to Move**: 42 files
**Effort**: 3 hours (bulk move + create README.md indexes)

#### Archive: 2025-10 (October - Analysis Period)

| New Location                                | Current Location                                             | Action                  | Count    |
| ------------------------------------------- | ------------------------------------------------------------ | ----------------------- | -------- |
| `docs/archive/2025-10/analysis/`            | `docs/archive/october-2025-analysis/*`                       | Move all (fix mislabel) | 16 files |
| `docs/archive/2025-10/sprints/`             | `docs/archive/sprints/SPRINT_1_*.md` through `SPRINT_3_*.md` | Move sprint 1-3 reports | 18 files |
| `docs/archive/2025-10/cache-investigation/` | `docs/archive/cache-investigation/*`                         | Move as-is              | 4 files  |
| `docs/archive/2025-10/client-reports/`      | `docs/archive/client-reports/nov-2025/*` (fix mislabel)      | Move client work        | 9 files  |
| `docs/archive/2025-10/test-reports/`        | `docs/archive/test-reports/*`                                | Move test reports       | 6 files  |
| `docs/archive/2025-10/phase-3/`             | `docs/archive/phase-3/*`                                     | Move phase 3            | 5 files  |

**Files to Move**: 58 files
**Effort**: 3 hours

#### Archive: 2025-01 (January - Planning Period)

| New Location                                  | Current Location                                                | Action                | Count    |
| --------------------------------------------- | --------------------------------------------------------------- | --------------------- | -------- |
| `docs/archive/2025-01/config-pivot-analysis/` | `docs/archive/planning/2025-01-analysis/CONFIG_*.md`            | Move config planning  | 14 files |
| `docs/archive/2025-01/mcp-analysis/`          | `docs/archive/planning/2025-01-analysis/MCP_*.md`               | Move MCP planning     | 4 files  |
| `docs/archive/2025-01/payment-analysis/`      | `docs/archive/planning/2025-01-analysis/PAYMENT_*.md`           | Move payment analysis | 6 files  |
| `docs/archive/2025-01/database-analysis/`     | `docs/archive/planning/2025-01-analysis/DATABASE_*.md`          | Move DB analysis      | 4 files  |
| `docs/archive/2025-01/security-audit/`        | `docs/archive/planning/2025-01-analysis/SECURITY_*.md`          | Move security audit   | 4 files  |
| `docs/archive/2025-01/tech-debt/`             | `docs/archive/planning/2025-01-analysis/TECH_DEBT_*.md`         | Move tech debt        | 4 files  |
| `docs/archive/2025-01/theme-analysis/`        | `docs/archive/planning/2025-01-analysis/THEME_*.md`             | Move theme analysis   | 4 files  |
| `docs/archive/2025-01/versioning/`            | `docs/archive/planning/2025-01-analysis/VERSIONING_*.md`        | Move versioning       | 3 files  |
| `docs/archive/2025-01/api-exploration/`       | `docs/archive/planning/2025-01-analysis/API_*.md`, `AGENT_*.md` | Move API + agent docs | 5 files  |

**Files to Move**: 48 files
**Effort**: 4 hours

#### Remaining Archive Files

| New Location                 | Current Location                                                            | Action                  | Count   |
| ---------------------------- | --------------------------------------------------------------------------- | ----------------------- | ------- |
| `docs/archive/2025-10/misc/` | `docs/archive/MIGRATION_LOG.md`, `PROMPTS.md`, `README_DEPLOYMENT.md`, etc. | Move misc archive files | 7 files |

**Files to Move**: 7 files
**Effort**: 1 hour

**Total Phase 3 Effort**: 11 hours

### Phase 4: Remaining Files (Priority 3)

Client, server, and root documentation files.

#### Client Documentation

| New Location                                         | Current Location                                                                                | Action              | Effort |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------- | ------ |
| `docs/reference/client/sdk-architecture.md`          | `client/public/SDK_ARCHITECTURE.md`                                                             | Move to reference   | 0.5h   |
| `docs/reference/client/api-service.md`               | `client/API_SERVICE_INTEGRATION_COMPLETE.md`                                                    | Move to reference   | 0.5h   |
| `docs/explanation/client/role-based-architecture.md` | `client/ROLE_BASED_ARCHITECTURE.md`                                                             | Move to explanation | 0.5h   |
| `docs/how-to/client/auth-context-usage.md`           | `client/src/contexts/AUTH_CONTEXT_USAGE.md`                                                     | Move to how-to      | 0.5h   |
| `docs/reference/client/auth-reference.md`            | `client/src/contexts/AUTH_QUICK_REFERENCE.md`                                                   | Move to reference   | 0.5h   |
| `docs/archive/2025-11/client/`                       | `client/src/contexts/MIGRATION_GUIDE.md`, `client/src/components/PackagePhotoUploader.md`, etc. | Archive old guides  | 1h     |

**Subtotal**: 3.5 hours

#### Server Documentation

| New Location                                   | Current Location                               | Action              | Effort |
| ---------------------------------------------- | ---------------------------------------------- | ------------------- | ------ |
| `docs/reference/server/stripe-connect-api.md`  | `server/STRIPE_CONNECT_ADMIN_API.md`           | Move to reference   | 0.5h   |
| `docs/how-to/server/stripe-connect-testing.md` | `server/STRIPE_CONNECT_TESTING_GUIDE.md`       | Move to how-to      | 0.5h   |
| `docs/explanation/server/unified-auth.md`      | `server/UNIFIED_AUTH_IMPLEMENTATION_REPORT.md` | Move to explanation | 1h     |
| `docs/how-to/server/login-rate-limiting.md`    | `server/LOGIN_RATE_LIMITING.md`                | Move to how-to      | 0.5h   |
| `docs/reference/testing/test-automation.md`    | `server/TEST_AUTOMATION_README.md`             | Move to reference   | 0.5h   |
| `docs/reference/testing/test-helpers.md`       | `server/test/helpers/README.md`                | Move to reference   | 0.5h   |

**Subtotal**: 3.5 hours

#### Root Documentation (Keep in Root)

| File                   | Action                                                        | Effort |
| ---------------------- | ------------------------------------------------------------- | ------ |
| `README.md`            | Update links to new structure                                 | 1h     |
| `ARCHITECTURE.md`      | Update links, move diagrams to `docs/reference/architecture/` | 1h     |
| `DEVELOPING.md`        | Extract how-tos, keep as overview                             | 1.5h   |
| `TESTING.md`           | Extract how-tos, keep as overview                             | 1h     |
| `CONTRIBUTING.md`      | Update with new doc standards                                 | 1h     |
| `CHANGELOG.md`         | Keep as-is (root)                                             | 0h     |
| `DECISIONS.md`         | Keep as index, expand individual ADRs in `docs/explanation/`  | 1h     |
| `CODING_GUIDELINES.md` | Keep as-is (root)                                             | 0h     |

**Subtotal**: 6.5 hours

#### Miscellaneous Root Files

| New Location                 | Current Location                                                                                                                                             | Action                       | Effort |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ------ |
| `docs/archive/2025-11/misc/` | `IMPLEMENTATION_SUMMARY.md`, `LOGIN_FIX_REPORT.md`, `QA_UNIFIED_AUTH_TEST_REPORT.md`, `SERVER_IMPLEMENTATION_CHECKLIST.md`, `PRODUCTION_READINESS_STATUS.md` | Archive completion reports   | 1h     |
| `docs/archive/2025-11/misc/` | `BACKLOG_PLATFORM_ADMIN_AUDIT_GAP.md`, `SPRINT_4_HANDOFF.md`                                                                                                 | Archive backlog/handoff docs | 0.5h   |
| `docs/archive/2025-11/misc/` | `DOCUMENTATION_CHANGELOG.md`                                                                                                                                 | Archive old changelog        | 0.5h   |

**Subtotal**: 2 hours

**Total Phase 4 Effort**: 15.5 hours

### Phase 5: Cleanup & Deduplication

#### Duplicates to Delete

| File                                     | Duplicate Of                                             | Action                  |
| ---------------------------------------- | -------------------------------------------------------- | ----------------------- |
| `.claude/SPRINT_6_COMPLETE_SUMMARY.md`   | `docs/sprints/sprint-5-6/SPRINT_6_COMPLETE_SUMMARY.md`   | Delete .claude version  |
| `.claude/SPRINT_6_STABILIZATION_PLAN.md` | `docs/sprints/sprint-5-6/SPRINT_6_STABILIZATION_PLAN.md` | Delete .claude version  |
| `.claude/SPRINT_6_PHASE_*_REPORT.md`     | `docs/sprints/sprint-5-6/SPRINT_6_PHASE_*_REPORT.md`     | Delete .claude versions |
| `.claude/SPRINT_5_SESSION_REPORT.md`     | `docs/sprints/sprint-5-6/SPRINT_5_SESSION_REPORT.md`     | Delete .claude version  |
| `SPRINT_4_HANDOFF.md` (root)             | `docs/sprints/sprint-4/SPRINT_4_HANDOFF.md`              | Delete root version     |

**Files to Delete**: 8 files
**Effort**: 0.5 hours

#### Client Documentation Duplicates

| File                                         | Duplicate Of                                   | Action                              |
| -------------------------------------------- | ---------------------------------------------- | ----------------------------------- |
| `client/public/QUICK_START.md`               | `client/public/SDK_README.md`                  | Consolidate into SDK_README         |
| `client/public/USAGE_SNIPPETS.md`            | Covered in SDK_README                          | Delete                              |
| `client/ROLE_QUICK_REFERENCE.md`             | `client/ROLE_BASED_ARCHITECTURE.md` (summary)  | Keep quick ref, expand architecture |
| `client/src/lib/PACKAGE_PHOTO_API_README.md` | `client/src/lib/package-photo-api.quickref.md` | Consolidate                         |

**Files to Consolidate**: 4 pairs
**Effort**: 2 hours

#### .claude/ Directory Strategy

**.claude/ is agent workspace** - should contain only:

- `PROJECT.md` (agent quick reference) ✅ Keep
- `PATTERNS.md` (validation patterns) ✅ Keep
- `commands/*.md` (slash commands) ✅ Keep
- Temporary analysis files (gitignored) ✅ Allow

**Files to Move/Archive from .claude/**:

- All `SPRINT_*.md` → Archive
- All `PHASE*.md` → Archive
- All audit reports → Archive
- All analysis reports → Archive or delete if superseded

**Files to Keep in .claude/**:

- `PROJECT.md`
- `PATTERNS.md`
- `commands/*.md`

**Effort**: 1 hour

**Total Phase 5 Effort**: 3.5 hours

---

## Migration Summary Table

### All 261 Files Categorized

| Category                | Count | Destination                                       | Notes                           |
| ----------------------- | ----- | ------------------------------------------------- | ------------------------------- |
| **Tutorials**           | 5     | `docs/tutorials/`                                 | New files from existing content |
| **How-To Guides**       | 28    | `docs/how-to/`                                    | Move + extract from guides      |
| **Reference**           | 18    | `docs/reference/`                                 | Move + consolidate              |
| **Explanation**         | 12    | `docs/explanation/`                               | Expand ADRs + concepts          |
| **Archive 2025-11**     | 42    | `docs/archive/2025-11/`                           | Current sprint/phase reports    |
| **Archive 2025-10**     | 58    | `docs/archive/2025-10/`                           | October analysis + Sprints 1-3  |
| **Archive 2025-01**     | 48    | `docs/archive/2025-01/`                           | Planning period docs            |
| **Archive Misc**        | 22    | `docs/archive/2025-11/misc/`                      | Other historical docs           |
| **Root (Keep)**         | 8     | Root directory                                    | Core project docs               |
| **Client (Move)**       | 6     | `docs/reference/client/` or `docs/how-to/client/` | Client-specific docs            |
| **Server (Move)**       | 6     | `docs/reference/server/` or `docs/how-to/server/` | Server-specific docs            |
| **Delete (Duplicates)** | 8     | N/A                                               | Confirmed duplicates            |

**Total**: 261 files

---

## Migration Phases

### Phase 0: Pre-Migration (Before Starting)

**Objective**: Prepare environment and get team buy-in.

**Tasks**:

1. **Create migration branch**:

   ```bash
   git checkout -b docs/migrate-to-diataxis
   ```

2. **Backup current documentation**:

   ```bash
   tar -czf docs-backup-$(date +%Y%m%d).tar.gz docs/ .claude/ *.md
   ```

3. **Install link checker**:

   ```bash
   npm install -D markdown-link-check
   ```

4. **Document all current internal links**:

   ```bash
   grep -r "](\.\./" docs/ > docs-links-before.txt
   grep -r "](/docs/" docs/ >> docs-links-before.txt
   ```

5. **Team notification**:
   - Email: "Documentation migration starting Nov 13"
   - Slack: Pin message with timeline
   - README: Add banner with link to this plan

**Duration**: 2 hours
**Risk**: Low
**Rollback**: Delete branch

---

### Phase 1: Foundation (Week 1, Days 1-2)

**Objective**: Create new directory structure and governance.

**Tasks**:

1. **Create Diátaxis directory structure** (1 hour):

   ```bash
   mkdir -p docs/{tutorials,how-to,reference,explanation,archive}
   mkdir -p docs/how-to/{deployment,development,operations,tenant-admin}
   mkdir -p docs/reference/{api,architecture,configuration,cli,client,server,testing}
   mkdir -p docs/explanation/{architecture,patterns,security,project-history}
   mkdir -p docs/archive/{2025-11,2025-10,2025-01}
   ```

2. **Write foundation README files** (7 hours):
   - `docs/README.md` - Framework guide with navigation (2h)
   - `docs/tutorials/README.md` - Tutorial guidelines (1h)
   - `docs/how-to/README.md` - How-to guidelines (1h)
   - `docs/reference/README.md` - Reference guidelines (1h)
   - `docs/explanation/README.md` - Explanation guidelines (1h)
   - `docs/archive/README.md` - Archive policy (1h)

3. **Write governance document** (3 hours):
   - `docs/DOCUMENTATION_STANDARDS.md`:
     - Naming conventions (UPPERCASE_UNDERSCORE vs kebab-case)
     - Placement rules (decision tree: "Where does X go?")
     - Metadata requirements (Last Updated, Version, Owner)
     - Review process (security, deduplication, placement)
     - Archival policy (auto-archive after 90 days)
     - Link maintenance (use relative paths, validate on commit)

4. **Update root README** (1 hour):
   - Add banner: "📚 Documentation is being migrated to Diátaxis framework"
   - Update all doc links to new structure (with redirects)
   - Add "Finding Documentation" section

5. **Commit and push** (10 minutes):
   ```bash
   git add docs/
   git commit -m "docs: Create Diátaxis framework structure and governance"
   git push origin docs/migrate-to-diataxis
   ```

**Deliverables**:

- ✅ New directory structure created
- ✅ 6 README files with guidelines
- ✅ DOCUMENTATION_STANDARDS.md governance doc
- ✅ Updated root README with navigation

**Duration**: 12 hours (1.5 days)
**Risk**: Low
**Rollback**: Delete new directories

---

### Phase 2: Core User Docs (Week 1, Days 3-5)

**Objective**: Migrate and create essential user-facing documentation.

**Day 3: Tutorials** (11 hours)

1. **Extract and simplify tutorials** (11 hours):
   - `01-quick-start.md` from README.md Quick Start (2h)
   - `02-first-tenant.md` from README.md Create First Tenant (2h)
   - `03-first-booking.md` - write new from DEVELOPING.md (3h)
   - `04-admin-dashboard.md` from TENANT_ADMIN_USER_GUIDE.md (2h)
   - `05-widget-integration.md` from WIDGET_INTEGRATION_GUIDE.md (2h)

2. **Test each tutorial** (2 hours):
   - Follow steps exactly as written
   - Verify outputs match
   - Update screenshots if needed

3. **Commit**:
   ```bash
   git add docs/tutorials/
   git commit -m "docs(tutorials): Add 5 beginner tutorials"
   ```

**Day 4: How-To Guides** (9 hours)

1. **Move deployment guides** (4 hours):
   - `deploy-to-production.md` from PRODUCTION_DEPLOYMENT_GUIDE.md
   - `setup-stripe-webhooks.md` extract from RUNBOOK.md
   - `configure-email-provider.md` extract from RUNBOOK.md
   - `rotate-secrets.md` from SECRET_ROTATION_GUIDE.md

2. **Move development guides** (4 hours):
   - `add-new-endpoint.md` extract from DEVELOPING.md
   - `write-integration-test.md` from TESTING.md + helpers/README.md

3. **Move operations guides** (1 hour):
   - `handle-production-incident.md` from INCIDENT_RESPONSE.md

4. **Commit**:
   ```bash
   git add docs/how-to/
   git commit -m "docs(how-to): Add deployment, dev, and ops guides"
   ```

**Day 5: Reference + Explanation** (17 hours)

1. **Create reference docs** (7 hours):
   - `api/endpoints.md` consolidate API docs (2h)
   - `api/error-codes.md` move ERRORS.md (0.5h)
   - `configuration/environment-variables.md` consolidate (1.5h)
   - `architecture/database-schema.md` generate from Prisma (3h)

2. **Create explanation docs** (10 hours):
   - `architecture/multi-tenancy.md` rewrite guide (3h)
   - `architecture/modular-monolith.md` expand ADR-0001 (2h)
   - `architecture/mock-first-development.md` expand ADR-0002 (2h)
   - `architecture/config-driven-platform.md` from README (3h)

3. **Commit**:
   ```bash
   git add docs/reference/ docs/explanation/
   git commit -m "docs(reference+explanation): Add core reference and concept docs"
   ```

**Deliverables**:

- ✅ 5 tutorials (tested and working)
- ✅ 8 how-to guides
- ✅ 4 reference docs
- ✅ 4 explanation docs

**Duration**: 37 hours (3 days with parallel work)
**Risk**: Medium (link breakage)
**Rollback**: Revert commits, restore from backup

---

### Phase 3: Archive Migration (Week 2, Days 1-2)

**Objective**: Move all historical documentation to time-based archive.

**Day 1: November 2025 Archive** (4 hours)

1. **Move current sprint docs** (1 hour):

   ```bash
   # Sprint 4
   mv docs/sprints/sprint-4 docs/archive/2025-11/sprints/sprint-4

   # Sprint 5-6
   mv docs/sprints/sprint-5-6 docs/archive/2025-11/sprints/sprint-5-6

   # Duplicates from .claude/
   mv .claude/SPRINT_6_*.md docs/archive/2025-11/sprints/sprint-5-6/
   mv .claude/SPRINT_5_*.md docs/archive/2025-11/sprints/sprint-5-6/
   ```

2. **Move phase reports** (1 hour):

   ```bash
   mv docs/phases docs/archive/2025-11/phases
   ```

3. **Move audit reports** (1 hour):

   ```bash
   mv .claude/DOCUMENTATION_AUDIT_*.md docs/archive/2025-11/audits/
   mv .claude/PRODUCTION_READINESS_*.md docs/archive/2025-11/audits/
   mv .claude/LINT_*.md docs/archive/2025-11/audits/
   mv .claude/UNSAFE_*.md docs/archive/2025-11/audits/
   ```

4. **Create month README** (1 hour):
   - `docs/archive/2025-11/README.md` with month index

5. **Commit**:
   ```bash
   git add docs/archive/2025-11/
   git commit -m "docs(archive): Archive November 2025 sprint and phase docs"
   ```

**Day 2: October 2025 + January 2025 Archive** (7 hours)

1. **Move October 2025** (3 hours):

   ```bash
   mv docs/archive/october-2025-analysis docs/archive/2025-10/analysis
   mv docs/archive/sprints/SPRINT_[123]_*.md docs/archive/2025-10/sprints/
   mv docs/archive/cache-investigation docs/archive/2025-10/cache-investigation
   mv docs/archive/client-reports/nov-2025 docs/archive/2025-10/client-reports
   mv docs/archive/test-reports docs/archive/2025-10/test-reports
   mv docs/archive/phase-3 docs/archive/2025-10/phase-3
   ```

2. **Move January 2025** (3 hours):

   ```bash
   mv docs/archive/planning/2025-01-analysis/CONFIG_*.md docs/archive/2025-01/config-pivot/
   mv docs/archive/planning/2025-01-analysis/MCP_*.md docs/archive/2025-01/mcp/
   mv docs/archive/planning/2025-01-analysis/PAYMENT_*.md docs/archive/2025-01/payment/
   # ... continue for all subcategories
   ```

3. **Create month READMEs** (1 hour):
   - `docs/archive/2025-10/README.md`
   - `docs/archive/2025-01/README.md`

4. **Commit**:
   ```bash
   git add docs/archive/
   git commit -m "docs(archive): Complete time-based archival for Oct 2025 and Jan 2025"
   ```

**Deliverables**:

- ✅ 155 files moved to time-based archive
- ✅ 3 month README indexes
- ✅ Clean docs/archive/ structure

**Duration**: 11 hours (2 days)
**Risk**: Low (historical docs, low traffic)
**Rollback**: Revert commits

---

### Phase 4: Remaining Files (Week 2, Days 3-5)

**Objective**: Move client, server, and remaining root documentation.

**Day 3: Client + Server Docs** (7 hours)

1. **Move client docs** (3.5 hours):

   ```bash
   mv client/public/SDK_ARCHITECTURE.md docs/reference/client/sdk-architecture.md
   mv client/API_SERVICE_INTEGRATION_COMPLETE.md docs/reference/client/api-service.md
   mv client/ROLE_BASED_ARCHITECTURE.md docs/explanation/client/role-based-architecture.md
   mv client/src/contexts/AUTH_CONTEXT_USAGE.md docs/how-to/client/auth-context-usage.md
   mv client/src/contexts/AUTH_QUICK_REFERENCE.md docs/reference/client/auth-reference.md
   # Archive old guides
   mv client/src/contexts/MIGRATION_GUIDE.md docs/archive/2025-11/client/
   mv client/src/components/PackagePhotoUploader.md docs/archive/2025-11/client/
   ```

2. **Move server docs** (3.5 hours):

   ```bash
   mv server/STRIPE_CONNECT_ADMIN_API.md docs/reference/server/stripe-connect-api.md
   mv server/STRIPE_CONNECT_TESTING_GUIDE.md docs/how-to/server/stripe-connect-testing.md
   mv server/UNIFIED_AUTH_IMPLEMENTATION_REPORT.md docs/explanation/server/unified-auth.md
   mv server/LOGIN_RATE_LIMITING.md docs/how-to/server/login-rate-limiting.md
   mv server/TEST_AUTOMATION_README.md docs/reference/testing/test-automation.md
   mv server/test/helpers/README.md docs/reference/testing/test-helpers.md
   ```

3. **Commit**:
   ```bash
   git add docs/ client/ server/
   git commit -m "docs: Move client and server docs to Diátaxis structure"
   ```

**Day 4: Update Root Docs** (6.5 hours)

1. **Update core files** (6.5 hours):
   - `README.md` - update all links, remove banner (1h)
   - `ARCHITECTURE.md` - update links, move diagrams (1h)
   - `DEVELOPING.md` - extract how-tos, keep overview (1.5h)
   - `TESTING.md` - extract how-tos, keep overview (1h)
   - `CONTRIBUTING.md` - update with doc standards (1h)
   - `DECISIONS.md` - keep as index, link to explanations (1h)

2. **Commit**:
   ```bash
   git add *.md
   git commit -m "docs: Update root docs with links to new structure"
   ```

**Day 5: Archive Misc Root Files** (2 hours)

1. **Move completion reports** (2 hours):

   ```bash
   mv IMPLEMENTATION_SUMMARY.md docs/archive/2025-11/misc/
   mv LOGIN_FIX_REPORT.md docs/archive/2025-11/misc/
   mv QA_UNIFIED_AUTH_TEST_REPORT.md docs/archive/2025-11/misc/
   mv SERVER_IMPLEMENTATION_CHECKLIST.md docs/archive/2025-11/misc/
   mv PRODUCTION_READINESS_STATUS.md docs/archive/2025-11/misc/
   mv BACKLOG_PLATFORM_ADMIN_AUDIT_GAP.md docs/archive/2025-11/misc/
   mv SPRINT_4_HANDOFF.md docs/archive/2025-11/misc/
   mv DOCUMENTATION_CHANGELOG.md docs/archive/2025-11/misc/
   ```

2. **Commit**:
   ```bash
   git add .
   git commit -m "docs: Archive misc root completion reports"
   ```

**Deliverables**:

- ✅ 12 client/server docs moved
- ✅ 8 root docs updated
- ✅ 8 misc docs archived

**Duration**: 15.5 hours (3 days)
**Risk**: Medium (root docs are high-traffic)
**Rollback**: Revert commits

---

### Phase 5: Cleanup & Validation (Week 3, Days 1-2)

**Objective**: Remove duplicates, fix broken links, validate structure.

**Day 1: Deduplication** (3.5 hours)

1. **Delete confirmed duplicates** (0.5 hours):

   ```bash
   # Delete .claude/ duplicates
   rm .claude/SPRINT_6_COMPLETE_SUMMARY.md
   rm .claude/SPRINT_6_STABILIZATION_PLAN.md
   rm .claude/SPRINT_6_PHASE_*_REPORT.md
   rm .claude/SPRINT_5_SESSION_REPORT.md
   rm SPRINT_4_HANDOFF.md  # Already moved
   ```

2. **Consolidate client docs** (2 hours):
   - Merge `client/public/QUICK_START.md` into `SDK_README.md`
   - Delete `USAGE_SNIPPETS.md` (covered in SDK_README)
   - Consolidate package photo API docs

3. **Clean .claude/ directory** (1 hour):
   - Keep only: `PROJECT.md`, `PATTERNS.md`, `commands/`
   - Move/archive everything else
   - Add `.gitignore` for temp files

4. **Commit**:
   ```bash
   git add .
   git commit -m "docs: Remove duplicates and clean up workspace"
   ```

**Day 2: Link Validation & Fixes** (8 hours)

1. **Run link checker** (1 hour):

   ```bash
   find docs/ -name "*.md" -exec markdown-link-check {} \; > link-check-report.txt
   ```

2. **Fix broken links** (5 hours):
   - Update relative paths
   - Fix moved file references
   - Update README navigation
   - Estimate: ~50-100 links to update

3. **Generate link map** (1 hour):

   ```bash
   # Create redirect map for common old → new paths
   cat > docs/LINK_MIGRATION_MAP.md << EOF
   # Documentation Link Migration Map

   ## Common Redirects

   | Old Location | New Location |
   |--------------|--------------|
   | docs/setup/ENVIRONMENT.md | docs/reference/configuration/environment-variables.md |
   | docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md | docs/explanation/architecture/multi-tenancy.md |
   ...
   EOF
   ```

4. **Test navigation** (1 hour):
   - Start from root README
   - Follow all major navigation paths
   - Verify tutorials work end-to-end

5. **Commit**:
   ```bash
   git add .
   git commit -m "docs: Fix broken links and add migration map"
   ```

**Deliverables**:

- ✅ 8 duplicate files deleted
- ✅ 4 client doc sets consolidated
- ✅ .claude/ cleaned and gitignored
- ✅ All internal links validated and fixed
- ✅ Link migration map for reference

**Duration**: 11.5 hours (2 days)
**Risk**: High (broken links affect all users)
**Rollback**: Revert commits, restore links

---

### Phase 6: Documentation & Training (Week 3, Days 3-5)

**Objective**: Document changes, train team, enable self-service.

**Day 3: Write ADR** (3 hours)

1. **Create ADR-003** (3 hours):
   - `DECISIONS/0003-diataxis-framework.md`
   - Context: Documentation drift after recent reorg
   - Decision: Adopt Diátaxis framework
   - Consequences: Four quadrants, time-based archive, governance
   - Alternatives considered: Continue ad-hoc, adopt other frameworks

2. **Update DECISIONS.md** (0 hours):
   - Already updated in Phase 4

3. **Commit**:
   ```bash
   git add DECISIONS/
   git commit -m "docs(adr): Add ADR-003 for Diátaxis framework adoption"
   ```

**Day 4: Create Learning Materials** (5 hours)

1. **Write "Quick Guide to Diátaxis"** (2 hours):
   - `docs/DIATAXIS_QUICK_GUIDE.md`
   - 1-page summary with examples
   - Decision tree: "Where should I put my doc?"

2. **Record video walkthrough** (2 hours):
   - 10-minute Loom video
   - Navigate new structure
   - Show how to add new doc
   - Demonstrate archive process

3. **Create cheat sheet** (1 hour):
   - `docs/DOCUMENTATION_CHEAT_SHEET.md`
   - Common tasks with commands
   - Link patterns
   - Metadata templates

4. **Commit**:
   ```bash
   git add docs/
   git commit -m "docs: Add Diátaxis learning materials and cheat sheet"
   ```

**Day 5: Team Training** (4 hours)

1. **Run team training session** (2 hours):
   - Present migration rationale
   - Walk through new structure
   - Q&A and feedback

2. **Update contribution guide** (1 hour):
   - `CONTRIBUTING.md` already updated in Phase 4
   - Add link to Diátaxis guide
   - Add doc review checklist

3. **Setup automation** (1 hour):
   - Add pre-commit hook for doc validation
   - Setup markdown linting
   - Add link checker to CI

4. **Final commit**:
   ```bash
   git add .
   git commit -m "docs: Add automation and finalize migration"
   ```

**Deliverables**:

- ✅ ADR-003 documented
- ✅ Learning materials created
- ✅ Team trained
- ✅ Automation setup

**Duration**: 12 hours (3 days)
**Risk**: Low
**Rollback**: N/A (informational)

---

### Phase 7: Merge & Monitor (Week 4)

**Objective**: Merge to main, monitor adoption, iterate.

**Day 1: Pre-Merge Validation** (4 hours)

1. **Final checks** (2 hours):
   - All tests passing
   - All links validated
   - No broken references
   - README navigation works

2. **Create PR** (1 hour):
   - Title: "docs: Migrate to Diátaxis framework"
   - Description: Link to this plan, summary of changes
   - Request reviews from 2+ team members

3. **Address PR feedback** (1 hour):
   - Make requested changes
   - Discuss any concerns

**Day 2: Merge** (1 hour)

1. **Merge PR**:

   ```bash
   git checkout main
   git merge docs/migrate-to-diataxis
   git push origin main
   ```

2. **Announce completion**:
   - Email team: "Documentation migration complete"
   - Update README banner (if any)
   - Slack announcement with before/after comparison

**Days 3-5: Monitor & Iterate** (Ongoing)

1. **Track metrics** (daily):
   - Monitor for broken link reports
   - Track doc file additions (are they in right place?)
   - Collect team feedback

2. **Quick fixes** (as needed):
   - Fix any missed links
   - Clarify placement guidelines if confusion arises
   - Update learning materials based on feedback

3. **Week 4 retrospective** (1 hour):
   - What went well?
   - What should we improve?
   - Document lessons learned

**Deliverables**:

- ✅ Migration merged to main
- ✅ Team notified
- ✅ Monitoring in place

**Duration**: 5 hours + ongoing monitoring
**Risk**: Low (reversible if critical issues found)
**Rollback**: Revert merge commit

---

## Migration Timeline Summary

| Phase                             | Duration            | Key Deliverables                           | Risk   |
| --------------------------------- | ------------------- | ------------------------------------------ | ------ |
| Phase 0: Pre-Migration            | 2 hours             | Backup, branch, tooling                    | Low    |
| Phase 1: Foundation               | 12 hours (1.5 days) | Structure, governance, READMEs             | Low    |
| Phase 2: Core User Docs           | 37 hours (3 days)   | Tutorials, how-tos, reference, explanation | Medium |
| Phase 3: Archive Migration        | 11 hours (2 days)   | Time-based archive                         | Low    |
| Phase 4: Remaining Files          | 15.5 hours (3 days) | Client, server, root docs                  | Medium |
| Phase 5: Cleanup & Validation     | 11.5 hours (2 days) | Deduplication, link fixes                  | High   |
| Phase 6: Documentation & Training | 12 hours (3 days)   | ADR, learning materials, training          | Low    |
| Phase 7: Merge & Monitor          | 5 hours + ongoing   | PR merge, monitoring                       | Low    |

**Total Effort**: 106 hours ÷ 8 hours/day = **13.25 work days** (~3 weeks)

**Recommended Approach**: 1 person full-time for 3 weeks, OR 2 people part-time (50%) for 3 weeks

---

## Risk Assessment

### High-Risk Areas

#### 1. Broken Links (Severity: High, Likelihood: High)

**Risk**: Moving 261 files will break many internal links, disrupting documentation users.

**Mitigation**:

- Use automated link checker (markdown-link-check)
- Create comprehensive link migration map
- Test all major navigation paths manually
- Keep old structure for 1 sprint (redirects in README)

**Rollback**: Revert commits, restore old structure

**Estimated Impact**: 3-5 hours to fix all links

---

#### 2. Team Adaptation (Severity: Medium, Likelihood: Medium)

**Risk**: Team continues using old patterns, creating drift in new structure.

**Mitigation**:

- Comprehensive training session (2 hours)
- Clear decision tree: "Where does X go?"
- Pre-commit validation hooks
- Pair review for first 2 weeks of doc additions

**Rollback**: N/A (training is informational)

**Estimated Impact**: 2-4 weeks for team to fully adapt

---

#### 3. CI/CD Pipeline Breakage (Severity: Medium, Likelihood: Low)

**Risk**: CI scripts may reference old doc paths for validation, deployment, or testing.

**Mitigation**:

- Audit all CI scripts before migration
- Update references in `.github/workflows/` if any
- Test CI locally before pushing

**Rollback**: Revert CI script changes

**Estimated Impact**: 1-2 hours to update CI scripts

---

### Medium-Risk Areas

#### 4. External Links (Severity: Low, Likelihood: High)

**Risk**: External sites, blog posts, or bookmarks may link to old doc paths.

**Mitigation**:

- Keep old structure for 1 sprint with redirect messages
- Add `_redirects` or `.htaccess` if docs are hosted
- Document common old→new paths in migration map

**Rollback**: N/A (external links can't be controlled)

**Estimated Impact**: Ongoing (users will find new paths via README)

---

#### 5. Search Engine Indexing (Severity: Low, Likelihood: Medium)

**Risk**: Google has indexed old doc paths, will take time to re-index.

**Mitigation**:

- Submit new sitemap to Google (if docs are public)
- Keep old paths with redirects for 3 months
- Add canonical URLs in new docs

**Rollback**: N/A (SEO is gradual)

**Estimated Impact**: 1-3 months for re-indexing

---

### Low-Risk Areas

#### 6. Content Loss (Severity: High, Likelihood: Very Low)

**Risk**: Files accidentally deleted during migration.

**Mitigation**:

- Complete tar.gz backup before starting
- All changes in Git (can revert any commit)
- Migration plan tracks every file explicitly

**Rollback**: Restore from backup or revert commits

**Estimated Impact**: 0 (preventable with backups)

---

#### 7. Incorrect Categorization (Severity: Low, Likelihood: Low)

**Risk**: Some files placed in wrong Diátaxis quadrant.

**Mitigation**:

- Review each file during migration
- Get second opinion on unclear cases
- Easy to move file post-migration (just a `git mv`)

**Rollback**: Move file to correct location

**Estimated Impact**: 0.5-1 hour per miscategorized file

---

## Rollback Strategy

### Scenario 1: Critical Issue Found in First Week

**Trigger**: Major broken links, CI failures, team can't find docs

**Action**:

1. **Immediate**:

   ```bash
   git revert <merge-commit>
   git push origin main --force-with-lease
   ```

2. **Communication**:
   - Slack: "Documentation migration rolled back due to [issue]"
   - Email: Explanation and revised timeline

3. **Fix**:
   - Address issues in migration branch
   - Re-test thoroughly
   - Re-merge when ready

**Time to Rollback**: 10 minutes
**Data Loss**: None (all changes in Git)

---

### Scenario 2: Partial Issues After Merge

**Trigger**: Some links broken, but structure is sound

**Action**:

1. **Keep new structure** (don't rollback)
2. **Fix issues incrementally**:

   ```bash
   git checkout main
   # Fix specific issues
   git commit -m "docs: Fix broken link in X"
   git push origin main
   ```

3. **Hotfix**:
   - Create `docs/KNOWN_ISSUES.md` with workarounds
   - Fix within 24-48 hours

**Time to Fix**: 1-4 hours depending on issue
**Data Loss**: None

---

### Scenario 3: Team Doesn't Adopt New Structure

**Trigger**: After 2 weeks, new docs still going to wrong places

**Action**:

1. **Don't rollback structure** (framework is correct)
2. **Improve governance**:
   - Add stricter pre-commit validation
   - Require doc review on all PRs
   - Pair with team members on doc additions

3. **Re-train**:
   - Follow-up training session
   - Update decision tree
   - Add more examples

**Time to Fix**: 2-4 weeks (cultural change)
**Data Loss**: None

---

### Scenario 4: External Tools Broken

**Trigger**: Doc hosting, search indexing, or external integrations broken

**Action**:

1. **Keep new structure**
2. **Fix integrations**:
   - Update doc hosting config
   - Submit new sitemap
   - Update external tool configs

3. **Temporary workaround**:
   - Add redirects file
   - Keep old paths with "Moved to X" messages

**Time to Fix**: 2-8 hours depending on integration
**Data Loss**: None

---

## Validation & Quality Assurance

### Automated Validation

#### 1. Link Checker

**Tool**: `markdown-link-check`

**Configuration** (`.markdown-link-check.json`):

```json
{
  "ignorePatterns": [
    {
      "pattern": "^http://localhost"
    },
    {
      "pattern": "^https://github.com/yourusername"
    }
  ],
  "timeout": "5s",
  "retryOn429": true,
  "retryCount": 3,
  "fallbackRetryDelay": "30s",
  "aliveStatusCodes": [200, 206]
}
```

**Usage**:

```bash
# Check all docs
find docs/ -name "*.md" -exec markdown-link-check {} \;

# Check specific file
markdown-link-check docs/README.md
```

**Run**: After each phase, before merge

---

#### 2. Metadata Validator

**Script**: `.claude/scripts/validate-doc-metadata.sh`

```bash
#!/bin/bash
# Validate that all docs have required metadata

REQUIRED_FIELDS=("Last Updated" "Category")
ERRORS=0

for file in $(find docs/ -name "*.md" -not -path "*/archive/*"); do
  for field in "${REQUIRED_FIELDS[@]}"; do
    if ! grep -q "^$field:" "$file"; then
      echo "ERROR: $file missing field: $field"
      ((ERRORS++))
    fi
  done
done

if [ $ERRORS -gt 0 ]; then
  echo "Found $ERRORS metadata errors"
  exit 1
else
  echo "All docs have required metadata"
fi
```

**Run**: Before merge

---

#### 3. Structure Validator

**Script**: `.claude/scripts/validate-doc-structure.sh`

```bash
#!/bin/bash
# Validate files are in correct directories

ALLOWED_DIRS=("tutorials" "how-to" "reference" "explanation" "archive")
ERRORS=0

for file in $(find docs/ -name "*.md" -type f); do
  # Check if file is in an allowed directory
  IS_VALID=false
  for dir in "${ALLOWED_DIRS[@]}"; do
    if [[ "$file" =~ docs/$dir/ ]] || [[ "$file" == "docs/README.md" ]]; then
      IS_VALID=true
      break
    fi
  done

  if [ "$IS_VALID" = false ]; then
    echo "ERROR: $file not in allowed directory"
    ((ERRORS++))
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo "Found $ERRORS structure errors"
  exit 1
fi
```

**Run**: Before each commit

---

### Manual Validation Checklist

#### Pre-Migration Checklist

- [ ] Full backup created (`docs-backup-YYYYMMDD.tar.gz`)
- [ ] Migration branch created (`docs/migrate-to-diataxis`)
- [ ] Link checker installed (`npm install -D markdown-link-check`)
- [ ] Current links documented (`docs-links-before.txt`)
- [ ] Team notified of upcoming migration
- [ ] README banner added with migration timeline

#### Post-Phase Checklist

After each phase, verify:

- [ ] All files moved to correct locations
- [ ] No files accidentally deleted (check git status)
- [ ] READMEs created for new directories
- [ ] Links updated in moved files
- [ ] Commit message follows convention
- [ ] Phase marked complete in this plan

#### Pre-Merge Checklist

Before merging to main:

- [ ] All 7 phases complete
- [ ] Link checker passes with 0 errors
- [ ] Metadata validator passes
- [ ] Structure validator passes
- [ ] All tutorials tested end-to-end
- [ ] Root README navigation works
- [ ] At least 2 team members reviewed PR
- [ ] CI passes (if applicable)
- [ ] Known issues documented (if any)
- [ ] Team training completed

#### Post-Merge Checklist

After merge:

- [ ] Team notified of completion
- [ ] README banner removed (or updated to success message)
- [ ] Documentation site updated (if applicable)
- [ ] External integrations updated (search, hosting, etc.)
- [ ] Monitoring in place for broken links
- [ ] First 5 doc additions reviewed for correct placement
- [ ] Week 4 retrospective scheduled

---

## Governance & Sustainability

### Documentation Standards (DOCUMENTATION_STANDARDS.md)

This document will be created in Phase 1 and will define:

#### 1. Naming Conventions

**File Naming**:

- Use `kebab-case` for all documentation files
- Examples: `multi-tenancy.md`, `deploy-to-production.md`, `api-endpoints.md`

**Exceptions**:

- Agent reports: `UPPERCASE_UNDERSCORE.md` (e.g., `SPRINT_6_COMPLETE_SUMMARY.md`)
- ADRs: `0000-title.md` (e.g., `0001-modular-monolith.md`)

**Date Formats**:

- Archive folders: `YYYY-MM/` (e.g., `2025-11/`)
- Timestamps in content: `YYYY-MM-DD` (e.g., `2025-11-12`)

---

#### 2. Placement Rules

**Decision Tree**:

```
Is this document teaching a beginner?
├─ Yes → tutorials/
└─ No ↓

Is this document solving a specific problem?
├─ Yes → how-to/
└─ No ↓

Is this document factual reference information?
├─ Yes → reference/
└─ No ↓

Is this document explaining concepts/decisions?
├─ Yes → explanation/
└─ No ↓

Is this document historical/completed work?
├─ Yes → archive/YYYY-MM/
└─ No → Ask in #docs channel
```

**Common Patterns**:

- Sprint session reports → `archive/YYYY-MM/sprints/`
- Phase completion reports → `archive/YYYY-MM/phases/`
- Audit reports → `archive/YYYY-MM/audits/`
- ADRs → `explanation/architecture/` (active) or `archive/YYYY-MM/` (deprecated)
- API documentation → `reference/api/`
- Setup guides → `how-to/deployment/` or `how-to/development/`
- Architecture diagrams → `reference/architecture/`

---

#### 3. Metadata Requirements

**All Non-Archive Docs Must Include**:

```markdown
---
Last Updated: 2025-11-12
Category: [Tutorial|How-To|Reference|Explanation]
Owner: [Team|Individual]
Status: [Active|Draft|Deprecated]
---

# Document Title

Brief description (1-2 sentences).

---
```

**Archive Docs Should Include**:

```markdown
---
Archived: 2025-11-12
Original Date: 2025-10-15
Category: Sprint Report
Sprint: 6
---
```

---

#### 4. Review Process

**All Documentation Changes Must**:

1. **Pass Automated Checks**:
   - Link checker (no broken links)
   - Metadata validator (required fields present)
   - Structure validator (file in correct directory)
   - Markdown linter (consistent formatting)

2. **Security Review** (for sensitive content):
   - No exposed passwords, API keys, or secrets
   - No internal IP addresses or server names
   - No customer data or PII

3. **Placement Validation**:
   - File in correct Diátaxis quadrant
   - Follows naming conventions
   - Linked from appropriate README

4. **Peer Review** (for major docs):
   - At least 1 team member reviews
   - Technical accuracy verified
   - Examples tested (if applicable)

---

#### 5. Archival Policy

**Auto-Archive Criteria**:

Documents should be archived when:

1. **Time-Based**:
   - Sprint reports: After sprint completes (immediately)
   - Phase reports: After phase completes (immediately)
   - Audit reports: After remediation completes (1 week)
   - Analysis docs: After implementation completes (1 month)

2. **Status-Based**:
   - Status changed to "Deprecated"
   - Content superseded by newer doc
   - Feature removed from codebase

**Archive Process**:

```bash
# 1. Determine archive date (month of last activity)
ARCHIVE_MONTH="2025-11"  # Format: YYYY-MM

# 2. Move to archive with category
mv docs/current-location/doc.md docs/archive/$ARCHIVE_MONTH/category/doc.md

# 3. Update archive README
echo "- [Doc Title](./category/doc.md) - Brief description" >> docs/archive/$ARCHIVE_MONTH/README.md

# 4. Add redirect in old location (optional)
cat > docs/current-location/doc.md << EOF
# Moved to Archive

This document has been archived.

**New Location**: [docs/archive/$ARCHIVE_MONTH/category/doc.md](../../archive/$ARCHIVE_MONTH/category/doc.md)
EOF

# 5. Commit
git add docs/
git commit -m "docs: Archive doc.md to $ARCHIVE_MONTH"
```

**Archive Retention**:

- Keep archived docs indefinitely (Git history sufficient)
- Delete only if legally required or contains sensitive data

---

#### 6. Link Maintenance

**Rules**:

1. **Use Relative Paths**:
   - ✅ Good: `[ARCHITECTURE.md](../../ARCHITECTURE.md)`
   - ❌ Bad: `[ARCHITECTURE.md](https://github.com/user/repo/blob/main/ARCHITECTURE.md)`

2. **Link to Stable Docs**:
   - Link to tutorials, how-tos, reference, explanation (stable)
   - Don't link to archive docs (they don't change, but paths do)

3. **Validate on Commit**:
   - Pre-commit hook runs link checker
   - CI validates all links on PR

4. **Update After Moves**:
   - When moving a file, search for all references:
     ```bash
     grep -r "old-filename.md" docs/
     ```
   - Update all links in same commit as move

---

#### 7. Content Guidelines

**Writing Style by Quadrant**:

| Quadrant        | Tone        | Voice                    | Tense        | Examples                            |
| --------------- | ----------- | ------------------------ | ------------ | ----------------------------------- |
| **Tutorials**   | Encouraging | Second person (you)      | Present      | "You will create your first tenant" |
| **How-To**      | Direct      | Second person (you)      | Imperative   | "Run npm install"                   |
| **Reference**   | Neutral     | Third person             | Present      | "The API returns a 200 status code" |
| **Explanation** | Thoughtful  | First person plural (we) | Past/Present | "We chose PostgreSQL because..."    |

**Length Guidelines**:

- Tutorials: 500-2000 words (15-30 min read)
- How-To: 200-1000 words (5-15 min read)
- Reference: As long as needed (comprehensive)
- Explanation: 1000-3000 words (deep dive)

**Code Examples**:

- Always include: Language, expected output
- Test all examples before publishing
- Use realistic but anonymized data

---

### Automated Enforcement

#### Pre-Commit Hook

**File**: `.git/hooks/pre-commit`

```bash
#!/bin/bash
# Validate documentation before commit

echo "Validating documentation..."

# 1. Check structure
./.claude/scripts/validate-doc-structure.sh
STRUCTURE=$?

# 2. Check metadata
./.claude/scripts/validate-doc-metadata.sh
METADATA=$?

# 3. Check links (only for staged .md files)
STAGED_MD=$(git diff --cached --name-only --diff-filter=ACM | grep '\.md$')
if [ -n "$STAGED_MD" ]; then
  for file in $STAGED_MD; do
    markdown-link-check "$file" --quiet
    LINKS=$?
    if [ $LINKS -ne 0 ]; then
      echo "ERROR: Broken links in $file"
      exit 1
    fi
  done
fi

# 4. Exit if any check failed
if [ $STRUCTURE -ne 0 ] || [ $METADATA -ne 0 ]; then
  echo "Documentation validation failed"
  exit 1
fi

echo "Documentation validation passed"
exit 0
```

**Install**:

```bash
cp .claude/scripts/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

---

#### CI/CD Integration

**GitHub Actions**: `.github/workflows/docs-validation.yml`

```yaml
name: Documentation Validation

on:
  pull_request:
    paths:
      - 'docs/**'
      - '*.md'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install markdown-link-check
        run: npm install -g markdown-link-check

      - name: Validate structure
        run: ./.claude/scripts/validate-doc-structure.sh

      - name: Validate metadata
        run: ./.claude/scripts/validate-doc-metadata.sh

      - name: Check links
        run: |
          find docs/ -name "*.md" -exec markdown-link-check {} \;

      - name: Lint markdown
        uses: DavidAnson/markdownlint-cli2-action@v11
        with:
          globs: 'docs/**/*.md'
```

---

### Ongoing Maintenance

#### Weekly Tasks (15 minutes)

- [ ] Review new docs added this week
- [ ] Check for files outside structure
- [ ] Scan for broken links
- [ ] Archive completed sprint docs

#### Monthly Tasks (1 hour)

- [ ] Generate documentation metrics dashboard
- [ ] Review placement decisions with team
- [ ] Update DOCUMENTATION_STANDARDS.md if needed
- [ ] Archive old phase/sprint reports

#### Quarterly Tasks (2 hours)

- [ ] Full link audit across all docs
- [ ] Review Diátaxis categorization (any misplaced docs?)
- [ ] Update learning materials based on feedback
- [ ] Team retrospective on documentation system

---

## Success Metrics

### 30-Day Targets (Post-Migration)

| Metric                         | Current       | Target | Measurement                                                                                                                               |
| ------------------------------ | ------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Files Outside Structure**    | 33 (.claude/) | 0      | `find docs/ -type f ! -path "*/tutorials/*" ! -path "*/how-to/*" ! -path "*/reference/*" ! -path "*/explanation/*" ! -path "*/archive/*"` |
| **Broken Links**               | Unknown       | 0      | Run link checker                                                                                                                          |
| **Docs with Metadata**         | ~10%          | 100%   | Run metadata validator                                                                                                                    |
| **Team Adoption**              | 0%            | 80%    | % of new docs placed correctly                                                                                                            |
| **Documentation Health Score** | N/A           | >80%   | Composite: links + metadata + structure                                                                                                   |

### 90-Day Targets

| Metric                    | Target         | Measurement                               |
| ------------------------- | -------------- | ----------------------------------------- |
| **Duplication Rate**      | <5% (from 23%) | Manual review                             |
| **Security Exposures**    | 0              | Secret scanner                            |
| **Archive Drift**         | 0%             | No files in archive with status "Active"  |
| **Team Self-Sufficiency** | >90%           | % of docs placed correctly without review |
| **User Satisfaction**     | >80%           | Survey: "Can you find what you need?"     |

### 6-Month Target

| Metric                         | Target     | Measurement                            |
| ------------------------------ | ---------- | -------------------------------------- |
| **Documentation Drift Rate**   | <5%        | % of files outside structure           |
| **Time to Find Info**          | <2 minutes | User survey                            |
| **Governance Self-Sustaining** | Yes        | No manual interventions needed         |
| **External Links Updated**     | >80%       | Google Search Console                  |
| **New Contributors**           | 3+         | # of non-core team members adding docs |

---

## Appendix

### A. File Inventory Spreadsheet

A complete spreadsheet with all 261 files is available at:

**Location**: `.claude/DOCUMENTATION_MIGRATION_INVENTORY.csv`

**Columns**:

- Current Path
- File Size (KB)
- Last Modified
- Target Quadrant (Tutorial/How-To/Reference/Explanation/Archive)
- Target Path
- Action (Move/Extract/Consolidate/Archive/Delete)
- Priority (0-3)
- Estimated Effort (hours)
- Owner
- Status (Not Started/In Progress/Complete)
- Notes

**Sample Rows**:

```csv
Current Path,Size,Modified,Quadrant,Target Path,Action,Priority,Effort,Status,Notes
docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md,15KB,2025-10-20,Explanation,docs/explanation/architecture/multi-tenancy.md,Move+Rewrite,1,3h,Not Started,Rewrite for understanding
docs/sprints/sprint-4/SPRINT_4_COMPLETE.md,21KB,2025-11-11,Archive,docs/archive/2025-11/sprints/sprint-4/SPRINT_4_COMPLETE.md,Move,2,0.5h,Not Started,Historical
.claude/SPRINT_6_COMPLETE_SUMMARY.md,18KB,2025-11-12,Archive,DELETE,Delete,2,0.1h,Not Started,Duplicate of docs/sprints/
```

---

### B. Link Migration Map

**Common Old → New Paths**:

| Old Path                                                 | New Path                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `docs/setup/ENVIRONMENT.md`                              | `docs/reference/configuration/environment-variables.md`    |
| `docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md` | `docs/explanation/architecture/multi-tenancy.md`           |
| `docs/operations/PRODUCTION_DEPLOYMENT_GUIDE.md`         | `docs/how-to/deployment/deploy-to-production.md`           |
| `docs/security/SECRET_ROTATION_GUIDE.md`                 | `docs/how-to/deployment/rotate-secrets.md`                 |
| `docs/operations/INCIDENT_RESPONSE.md`                   | `docs/how-to/operations/handle-production-incident.md`     |
| `docs/sprints/sprint-4/`                                 | `docs/archive/2025-11/sprints/sprint-4/`                   |
| `docs/phases/PHASE_4_COMPLETION_REPORT.md`               | `docs/archive/2025-11/phases/PHASE_4_COMPLETION_REPORT.md` |
| `docs/api/README.md`                                     | `docs/reference/api/endpoints.md`                          |
| `DEVELOPING.md` (for "How to add endpoint")              | `docs/how-to/development/add-new-endpoint.md`              |
| `TESTING.md` (for "How to write test")                   | `docs/how-to/development/write-integration-test.md`        |

---

### C. Learning Resources

**External References**:

1. **Diátaxis Framework**:
   - Official site: https://diataxis.fr/
   - Tutorial: https://diataxis.fr/tutorials/
   - Video: "What is Diátaxis?" (15 min)

2. **Examples of Diátaxis in Practice**:
   - Django: https://docs.djangoproject.com/
   - React: https://react.dev/
   - Python: https://docs.python.org/

3. **Documentation Best Practices**:
   - Write the Docs: https://www.writethedocs.org/
   - Google Developer Docs Style Guide
   - Microsoft Writing Style Guide

**Internal Materials** (Created in Phase 6):

- `docs/DIATAXIS_QUICK_GUIDE.md` - 1-page summary
- `docs/DOCUMENTATION_CHEAT_SHEET.md` - Quick reference
- Video: "Elope Documentation Structure Walkthrough" (10 min Loom)

---

### D. Decision Tree: Where Should I Put This?

```
START: I need to document something
│
├─ Is this teaching a complete beginner?
│  ├─ Yes: Is it a step-by-step lesson?
│  │  ├─ Yes → tutorials/ ✅
│  │  └─ No → explanation/ (it's conceptual)
│  └─ No ↓
│
├─ Is this solving a specific, real-world problem?
│  ├─ Yes: Is it deployment/operations?
│  │  ├─ Yes → how-to/deployment/ or how-to/operations/ ✅
│  │  └─ No: Is it development?
│  │     ├─ Yes → how-to/development/ ✅
│  │     └─ No → how-to/[category]/ ✅
│  └─ No ↓
│
├─ Is this factual information for lookup?
│  ├─ Yes: Is it about the API?
│  │  ├─ Yes → reference/api/ ✅
│  │  └─ No: Is it configuration?
│  │     ├─ Yes → reference/configuration/ ✅
│  │     └─ No: Is it architecture?
│  │        ├─ Yes → reference/architecture/ ✅
│  │        └─ No → reference/[topic]/ ✅
│  └─ No ↓
│
├─ Is this explaining WHY or HOW SOMETHING WORKS?
│  ├─ Yes: Is it an architectural decision (ADR)?
│  │  ├─ Yes → explanation/architecture/ ✅
│  │  └─ No: Is it a design pattern?
│  │     ├─ Yes → explanation/patterns/ ✅
│  │     └─ No → explanation/[topic]/ ✅
│  └─ No ↓
│
├─ Is this historical/completed work?
│  ├─ Yes: What type?
│  │  ├─ Sprint report → archive/YYYY-MM/sprints/ ✅
│  │  ├─ Phase report → archive/YYYY-MM/phases/ ✅
│  │  ├─ Audit report → archive/YYYY-MM/audits/ ✅
│  │  └─ Other → archive/YYYY-MM/[category]/ ✅
│  └─ No ↓
│
└─ Still unsure?
   └─ Ask in #docs Slack channel 💬
```

---

### E. Troubleshooting Common Issues

#### Issue: "I can't find where to put my doc"

**Solution**:

1. Use the decision tree above
2. Look at similar existing docs - where are they?
3. Ask in #docs Slack channel
4. When in doubt, choose explanation/ (can always move later)

---

#### Issue: "My doc fits in multiple quadrants"

**Solution**:

1. Split it into multiple docs (recommended)
   - Tutorial part → tutorials/
   - How-to part → how-to/
   - Reference part → reference/
2. Or choose the PRIMARY purpose:
   - "What's the main goal for readers?"
   - "If I could only put it in one place, where?"

**Example**: "Multi-Tenant Guide"

- Tutorial: "tutorials/create-your-first-tenant.md"
- How-To: "how-to/development/debug-multi-tenant-issue.md"
- Reference: "reference/architecture/database-schema.md" (tenantId column)
- Explanation: "explanation/architecture/multi-tenancy.md" (why multi-tenant?)

---

#### Issue: "This is both a how-to and reference"

**Common Case**: API endpoint documentation

**Solution**: Split it

- How-To: "how-to/development/call-catalog-api.md" (with examples)
- Reference: "reference/api/catalog-endpoints.md" (complete spec)
- Link between them

---

#### Issue: "Should this be archived?"

**Guidelines**:

- ✅ Archive: Sprint reports, phase reports, completed work, superseded docs
- ❌ Don't archive: Active guides, current features, evergreen content

**Test**: "Will this doc change in the next 3 months?"

- Yes → Keep active
- No → Consider archiving

---

### F. Glossary

| Term             | Definition                                                                           |
| ---------------- | ------------------------------------------------------------------------------------ |
| **Diátaxis**     | Documentation framework with 4 quadrants (tutorials, how-to, reference, explanation) |
| **Tutorial**     | Learning-oriented doc that teaches by doing                                          |
| **How-To Guide** | Task-oriented doc that solves a specific problem                                     |
| **Reference**    | Information-oriented doc for lookup (API, config, etc.)                              |
| **Explanation**  | Understanding-oriented doc that clarifies concepts                                   |
| **Archive**      | Time-based storage for historical documentation                                      |
| **Drift**        | When new docs bypass the structure and end up in wrong places                        |
| **Governance**   | Rules and processes to maintain documentation quality                                |
| **Link Rot**     | When links break due to files moving or being deleted                                |
| **Metadata**     | Structured information about a doc (date, owner, status)                             |

---

## Conclusion

This migration plan provides a comprehensive roadmap to transition Elope's 261 documentation files from an ad-hoc 9-category structure to the proven Diátaxis framework. The phased approach minimizes disruption while establishing sustainable governance to prevent future documentation drift.

**Key Takeaways**:

1. **Phased Migration** (7 phases over 3 weeks) allows incremental progress and validation
2. **Comprehensive Mapping** of all 261 files ensures nothing is lost
3. **Risk Mitigation** through backups, link validation, and rollback strategies
4. **Governance First** with DOCUMENTATION_STANDARDS.md and automation
5. **Team Training** ensures long-term adoption and sustainability

**Next Steps**:

1. **Review this plan** with the team (30 minutes)
2. **Get buy-in** from stakeholders (1 week)
3. **Start Phase 0** (Pre-Migration) immediately after approval
4. **Execute phases** according to timeline (3 weeks)
5. **Monitor and iterate** post-migration (ongoing)

**Expected Outcomes**:

- 🎯 **Zero documentation drift** within 30 days
- 📚 **100% metadata compliance** within 30 days
- 🔗 **Zero broken links** maintained ongoing
- 👥 **80%+ team adoption** within 90 days
- ⏱️ **100+ hours saved annually** in documentation maintenance

**Questions?** Contact the Documentation Systems Architect or ask in #docs Slack channel.

---

**Document Metadata**:

- **Author**: Documentation Systems Architect
- **Created**: 2025-11-12
- **Status**: Draft (awaiting team approval)
- **Version**: 1.0
- **Next Review**: After Phase 1 completion

---

_This migration plan is a living document. Update it as phases complete and lessons are learned._
