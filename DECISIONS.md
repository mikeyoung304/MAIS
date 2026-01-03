# Architecture Decision Records (ADRs)

This document serves as an index to all Architecture Decision Records (ADRs) for the MAIS platform. All detailed ADRs are maintained in the `docs/adrs/` directory.

## Active ADRs

### Documentation & Process (ADR-001 to ADR-005)

- [ADR-001: Adopt Diataxis Framework](docs/adrs/ADR-001-adopt-diataxis-framework.md) - Documentation framework and structure
- [ADR-002: Documentation Naming Standards](docs/adrs/ADR-002-documentation-naming-standards.md) - File naming conventions and organization
- [ADR-003: Sprint Documentation Lifecycle](docs/adrs/ADR-003-sprint-documentation-lifecycle.md) - Documentation lifecycle management
- [ADR-004: Time-Based Archive Strategy](docs/adrs/ADR-004-time-based-archive-strategy.md) - Documentation archiving approach
- [ADR-005: Documentation Security Review](docs/adrs/ADR-005-documentation-security-review.md) - Security review process for docs

### Architecture & Design (ADR-006 to ADR-007)

- [ADR-006: Modular Monolith Architecture](docs/adrs/ADR-006-modular-monolith-architecture.md) - Core architectural pattern (ports/adapters)
- [ADR-007: Mock-First Development](docs/adrs/ADR-007-mock-first-development.md) - Development workflow and adapter strategy

### Concurrency & Reliability (ADR-008, ADR-009, ADR-013)

- [ADR-008: Pessimistic Locking for Booking Race Conditions](docs/adrs/ADR-008-pessimistic-locking-booking-race-conditions.md) - **SUPERSEDED by ADR-013**
- [ADR-009: Database-Based Webhook Dead Letter Queue](docs/adrs/ADR-009-database-webhook-dead-letter-queue.md) - Webhook reliability and idempotency
- [ADR-013: PostgreSQL Advisory Locks](docs/adrs/ADR-013-postgresql-advisory-locks.md) - **ACTIVE** Double-booking prevention (supersedes ADR-008)

### Security (ADR-010)

- [ADR-010: Git History Rewrite for Secret Removal](docs/adrs/ADR-010-git-history-rewrite-secret-removal.md) - Secret management and git history cleanup

### Integration & Testing (ADR-011, ADR-012)

- [ADR-011: PaymentProvider Interface](docs/adrs/ADR-011-payment-provider-interface.md) - Payment abstraction layer (Stripe)
- [ADR-012: Full Test Coverage for Webhook Handler](docs/adrs/ADR-012-full-test-coverage-webhook-handler.md) - Testing standards for critical paths

### Frontend & Multi-Tenant (ADR-014 to ADR-017)

- [ADR-014: Next.js App Router Migration](docs/adrs/ADR-014-nextjs-app-router-migration.md) - Migration from Vite SPA to Next.js 14 for tenant storefronts
- [ADR-015: API Proxy Pattern](docs/adrs/ADR-015-api-proxy-pattern.md) - Secure proxy pattern for Next.js client component authentication
- [ADR-016: Field Naming Conventions](docs/adrs/ADR-016-field-naming-conventions.md) - Database vs API/Frontend field naming (title/name, priceCents/basePrice)
- [ADR-017: Dark Theme Auth Pages](docs/adrs/ADR-017-dark-theme-auth-pages.md) - Dark graphite theme for signup/login vs light marketing site

## Quick Reference by Category

### Architecture Patterns

- **Modular Monolith:** ADR-006
- **Ports & Adapters:** ADR-006, ADR-011
- **Mock-First:** ADR-007
- **Next.js App Router:** ADR-014
- **API Proxy:** ADR-015
- **Field Naming:** ADR-016

### Concurrency Control

- **Double-Booking Prevention:** ADR-013 (active), ADR-008 (superseded)
- **Webhook Idempotency:** ADR-009

### Testing & Quality

- **Test Coverage:** ADR-012
- **Mock Adapters:** ADR-007

### Security

- **Secret Management:** ADR-010
- **Documentation Security:** ADR-005

## Decision Summary Table

| ADR     | Decision                       | Status     | Priority | Category      |
| ------- | ------------------------------ | ---------- | -------- | ------------- |
| ADR-001 | Adopt Diataxis Framework       | Accepted   | P1       | Documentation |
| ADR-002 | Documentation Naming Standards | Accepted   | P1       | Documentation |
| ADR-003 | Sprint Documentation Lifecycle | Accepted   | P1       | Documentation |
| ADR-004 | Time-Based Archive Strategy    | Accepted   | P1       | Documentation |
| ADR-005 | Documentation Security Review  | Accepted   | P1       | Documentation |
| ADR-006 | Modular Monolith Architecture  | Accepted   | P0       | Architecture  |
| ADR-007 | Mock-First Development         | Accepted   | P0       | Development   |
| ADR-008 | Pessimistic Locking            | Superseded | -        | Concurrency   |
| ADR-009 | Webhook Dead Letter Queue      | Accepted   | P0       | Reliability   |
| ADR-010 | Git History Rewrite            | Pending    | P1       | Security      |
| ADR-011 | PaymentProvider Interface      | Accepted   | P1       | Architecture  |
| ADR-012 | Full Test Coverage (Webhooks)  | Accepted   | P0       | Testing       |
| ADR-013 | PostgreSQL Advisory Locks      | Accepted   | P0       | Concurrency   |
| ADR-014 | Next.js App Router Migration   | Accepted   | P0       | Frontend      |
| ADR-015 | API Proxy Pattern              | Accepted   | P1       | Architecture  |
| ADR-016 | Field Naming Conventions       | Accepted   | P2       | Architecture  |
| ADR-017 | Dark Theme Auth Pages          | Accepted   | P2       | Frontend      |

## Decision Process

All architectural decisions follow this process:

1. **Proposal:** Engineer identifies problem and proposes solution
2. **Discussion:** Team reviews alternatives and trade-offs
3. **Decision:** Team lead approves or requests changes
4. **Documentation:** Decision recorded as ADR in `docs/adrs/`
5. **Implementation:** Code changes made, tests written
6. **Review:** PR review confirms decision was implemented correctly

## Creating New ADRs

When creating a new ADR:

1. Use the next available ADR number (ADR-014, ADR-015, etc.)
2. Follow the template in `docs/architecture/adr-template.md`
3. Create file in `docs/adrs/` with format: `ADR-XXX-brief-description.md`
4. Include these sections:
   - Context (why this decision is needed)
   - Decision (what we're doing)
   - Consequences (positive, negative, risks)
   - Alternatives Considered (what we rejected and why)
   - Implementation Details
   - References
   - Related ADRs
5. Update this index file (DECISIONS.md)
6. Create PR for review

## Updating Existing ADRs

**Important:** ADRs are immutable once accepted.

If a decision needs to change:

1. Create a new ADR that supersedes the old one
2. Mark the old ADR with `Status: Superseded by ADR-XXX`
3. Reference the old ADR in the new ADR's "Related ADRs" section
4. Update this index to reflect the supersession

**Example:** ADR-008 (Pessimistic Locking) was superseded by ADR-013 (Advisory Locks) when we discovered deadlock issues.

## References

- ADR Template: [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- ADR Tools: [adr-tools](https://github.com/npryce/adr-tools)
- Template Location: `docs/architecture/adr-template.md`

## Migration Notes

**2025-12-02:** Consolidated ADRs from multiple locations:

- Moved minimal ADRs from `/DECISIONS/` to comprehensive docs in `docs/adrs/`
- Extracted ADRs from root `DECISIONS.md` into separate files
- Renumbered to avoid conflicts (documentation ADRs: 001-005, technical ADRs: 006-013)
- This file converted from detailed ADR storage to index/navigation
