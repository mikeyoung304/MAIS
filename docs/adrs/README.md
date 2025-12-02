# Architectural Decision Records (ADRs)

This directory contains Architectural Decision Records (ADRs) for the MAIS platform. ADRs document significant architectural decisions made during the project, including the context, decision, and consequences.

## Documentation Framework ADRs

These ADRs establish the documentation standards and practices for the MAIS project:

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./ADR-001-adopt-diataxis-framework.md) | Adopt Diátaxis Framework | Accepted | 2025-11 |
| [ADR-002](./ADR-002-documentation-naming-standards.md) | Documentation Naming Standards | Accepted | 2025-11 |
| [ADR-003](./ADR-003-sprint-documentation-lifecycle.md) | Sprint Documentation Lifecycle | Accepted | 2025-11 |
| [ADR-004](./ADR-004-time-based-archive-strategy.md) | Time-Based Archive Strategy | Accepted | 2025-11 |
| [ADR-005](./ADR-005-documentation-security-review.md) | Documentation Security Review | Accepted | 2025-11 |

## Architecture ADRs

These ADRs document technical architecture decisions:

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-006](./ADR-006-modular-monolith-architecture.md) | Modular Monolith Architecture | Accepted | 2025-10 |
| [ADR-007](./ADR-007-mock-first-development.md) | Mock-First Development Strategy | Accepted | 2025-10 |
| [ADR-008](./ADR-008-pessimistic-locking-booking-race-conditions.md) | Pessimistic Locking for Booking Race Conditions | Accepted | 2025-10 |
| [ADR-009](./ADR-009-database-webhook-dead-letter-queue.md) | Database-Backed Webhook Dead Letter Queue | Accepted | 2025-10 |
| [ADR-010](./ADR-010-git-history-rewrite-secret-removal.md) | Git History Rewrite for Secret Removal | Accepted | 2025-11 |
| [ADR-011](./ADR-011-payment-provider-interface.md) | Payment Provider Interface Abstraction | Accepted | 2025-10 |
| [ADR-012](./ADR-012-full-test-coverage-webhook-handler.md) | Full Test Coverage for Webhook Handler | Accepted | 2025-10 |
| [ADR-013](./ADR-013-postgresql-advisory-locks.md) | PostgreSQL Advisory Locks for Critical Sections | Accepted | 2025-11 |

## About ADRs

An Architectural Decision Record (ADR) captures a significant architectural decision along with its context and consequences. Each ADR follows a consistent format:

- **Title**: Short descriptive name
- **Status**: Proposed, Accepted, Deprecated, or Superseded
- **Context**: The issue motivating this decision
- **Decision**: The change we're proposing or have made
- **Consequences**: What becomes easier or harder as a result
- **Alternatives Considered**: Other options that were evaluated

## Related Documentation

- [ARCHITECTURE.md](../../ARCHITECTURE.md) - System architecture overview
- [DECISIONS.md](../../DECISIONS.md) - Complete list of all architectural decisions (includes ADRs)
- [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md) - Documentation governance

## Creating New ADRs

When making a significant architectural decision:

1. Create a new file: `ADR-NNN-short-title.md` (increment NNN from the last ADR)
2. Follow the ADR template structure (see existing ADRs)
3. Include: Status, Context, Decision, Consequences, Alternatives
4. Update this README with a new entry
5. Update [DECISIONS.md](../../DECISIONS.md) with the decision

---

**Last Updated:** 2025-12-02
**Maintainer:** Technical Lead
**Total ADRs:** 13
