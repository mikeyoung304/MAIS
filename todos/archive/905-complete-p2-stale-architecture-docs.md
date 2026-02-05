---
status: complete
priority: p2
issue_id: 905
tags: [docs-audit, architecture-docs, section-content, multi-agent-review]
dependencies: [900]
completed_date: 2026-02-05
---

# Architecture Docs Describe Deleted SectionContent/LandingPageConfig Systems

## Problem Statement

Multiple architecture docs in `docs/architecture/` describe systems that were deleted in the Phase 5 Section Content Migration (Feb 2, 2026). These docs reference `landingPageConfig`, `landingPageConfigDraft`, `storefrontDraft`, and `storefrontPublished` — columns that no longer exist in the schema.

**Why it matters:**

- ARCHITECTURE.md lines 689-757 describe `landingPageConfig` as "primary storage"
- BUILD_MODE_VISION.md describes a draft/publish system using deleted columns
- AGENT_FIRST_ARCHITECTURE_SPEC.md references `storefrontDraft` as migration target
- DELETION_MANIFEST.md describes completed deletions as if they're future work
- 39+ solution docs reference these deleted patterns without deprecation notices

## Findings

**From Git History Agent and Docs Bloat Agent:**

### Architecture Docs Needing Update

| Document                           | Issue                                                               |
| ---------------------------------- | ------------------------------------------------------------------- |
| `ARCHITECTURE.md` (lines 689-757)  | `landingPageConfig` as primary storage — replaced by SectionContent |
| `BUILD_MODE_VISION.md`             | Draft system using deleted columns                                  |
| `AGENT_FIRST_ARCHITECTURE_SPEC.md` | `storefrontDraft` migration target was itself deleted               |
| `DELETION_MANIFEST.md`             | Describes past-tense deletions as future work                       |
| `PROJECT_HUB_ARCHITECTURE.md`      | References `project-hub-agent` Cloud Run URL                        |
| `VERTEX_AI_NATIVE_EVALUATION.md`   | All 6 old agent names in monitoring targets                         |

### Solution Docs (39 files reference landingPageConfig/LandingPageService)

Key clusters to deprecate:

- WRAPPER*FORMAT*\* family (6+ files) — pattern eliminated
- DUAL*DRAFT*\* family (3+ files) — system eliminated
- STOREFRONT-AGENT-\* files — agent retired

### Stale Plans at Root Level

| Plan                                                  | Issue                                            |
| ----------------------------------------------------- | ------------------------------------------------ |
| `plans/LEGACY_AGENT_MIGRATION_PLAN.md`                | Says AdvisorMemoryService "still used" — deleted |
| `plans/ENTERPRISE-SPRINT-PLAN.md`                     | References old agent names                       |
| `plans/PLAN-project-hub-security-and-architecture.md` | project-hub-agent was retired                    |

## Recommended Fix

1. Update ARCHITECTURE.md to describe SectionContent as canonical storage
2. Rewrite BUILD_MODE_VISION.md for SectionContent-based architecture
3. Update AGENT_FIRST_ARCHITECTURE_SPEC.md migration target
4. Mark DELETION_MANIFEST.md items as COMPLETED
5. Add "SUPERSEDED" headers to obsolete solution docs
6. Archive completed plans

## Sources

- Git History Agent: Section 2, Priority 1-3
- Docs Bloat Agent: 39 landingPageConfig references, 9 wrapper format files obsolete
- Conflicting Docs Agent: Conflict 6 (ARCHITECTURE.md storage)
