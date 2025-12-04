---
status: complete
priority: p3
issue_id: '011'
tags: [documentation, cleanup, architecture]
dependencies: []
---

# Consolidate ADR Locations

## Problem Statement

The project has two separate ADR (Architecture Decision Record) locations with different numbering schemes and formats:

1. `/DECISIONS/` (root) - 2 ADRs, minimal format (300 bytes each)
2. `/docs/adrs/` - 4+ ADRs, comprehensive format (5,000+ bytes each)

This creates confusion about where ADRs should be documented.

## Solution Implemented

**Solution 1 was executed:** Merged all ADRs to `docs/adrs/` with consolidated numbering.

### What Was Done

1. **Removed DECISIONS/ directory** - No longer exists at root level
2. **Consolidated all ADRs** - Now 13 technical ADRs in `docs/adrs/`:
   - ADR-001 through ADR-005: Documentation governance ADRs
   - ADR-006 through ADR-013: Technical architecture ADRs
3. **Created comprehensive index** - `DECISIONS.md` at root serves as navigation
4. **Updated migration notes** - Documented consolidation on 2025-12-02

### Acceptance Criteria Status

- [x] DECISIONS/ folder removed
- [x] All ADRs in docs/adrs/ (14 files total: 13 ADRs + README)
- [x] Index document created (DECISIONS.md at root)
- [x] No numbering collisions (ADR-001 through ADR-013)
- [x] Cross-references updated

## Current State

**docs/adrs/ contents (verified 2025-12-03):**

- ADR-001: Adopt Diataxis Framework (documentation)
- ADR-002: Documentation Naming Standards (documentation)
- ADR-003: Sprint Documentation Lifecycle (documentation)
- ADR-004: Time-Based Archive Strategy (documentation)
- ADR-005: Documentation Security Review (documentation)
- ADR-006: Modular Monolith Architecture (technical)
- ADR-007: Mock-First Development (technical)
- ADR-008: Pessimistic Locking (superseded, technical)
- ADR-009: Webhook Dead Letter Queue (technical)
- ADR-010: Git History Rewrite for Secrets (technical)
- ADR-011: PaymentProvider Interface (technical)
- ADR-012: Full Test Coverage (technical)
- ADR-013: PostgreSQL Advisory Locks (active, technical)

**Root DECISIONS.md:**

- Serves as comprehensive index
- Contains quick reference by category
- Decision process documentation
- ADR creation guidelines
- Migration notes explaining consolidation

## Work Log

| Date       | Status      | Action                                    |
| ---------- | ----------- | ----------------------------------------- |
| 2025-11-24 | Created     | Two ADR locations identified              |
| 2025-12-02 | In Progress | Consolidated ADRs from multiple locations |
| 2025-12-03 | Complete    | Verified consolidation, documented status |

## Follow-Up Work

The following ADRs remain as potential future work (marked as "Solution 3" in original TODO):

- ADR-014: Multi-Tenant Data Isolation Strategy
- ADR-015: Dependency Injection Container Pattern
- ADR-016: ts-rest Contract-First API Design
- ADR-017: Prisma ORM and Migration Strategy

These were not required for this consolidation task but should be considered for future documentation sprints.

## Notes

The consolidation approach chosen (Solution 1) was optimal for the current state:

- Low effort implementation
- Clear single source of truth
- Comprehensive ADR index
- Room for future technical ADRs

The project now has a well-organized, single ADR location with clear naming conventions and comprehensive indexing.
