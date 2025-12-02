# Architecture Documentation

This directory contains architectural documentation for the MAIS project, including system design documents and Architectural Decision Records (ADRs).

## Core Architecture
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - System architecture overview
- [ARCHITECTURE_DIAGRAM.md](../../ARCHITECTURE_DIAGRAM.md) - Visual architecture diagrams

## Architectural Decision Records (ADRs)

ADRs document significant architectural decisions made during the project. Each ADR captures the context, decision, alternatives considered, and consequences.

**Current ADRs:**
- *[To be created: ADR-001-adopt-diataxis-framework.md]*
- *[To be created: ADR-002-documentation-naming-standards.md]*
- *[To be created: ADR-003-sprint-documentation-location.md]*

**Creating a new ADR:**
1. Copy `ADR-TEMPLATE.md`
2. Name it `ADR-{NNN}-{decision-title}.md` where NNN is the next sequential number (zero-padded)
3. Fill in all sections
4. Submit PR for team review
5. Once accepted, update status to "Accepted" and merge

**ADR Lifecycle:**
- **Proposed:** Under discussion
- **Accepted:** Approved and active
- **Deprecated:** No longer recommended but not replaced
- **Superseded:** Replaced by a newer ADR (link to replacement)

**ADRs are NEVER archived.** They are permanent historical records of decisions.

### What is an ADR?

An **Architectural Decision Record** (ADR) is a document that captures an important architectural decision made along with its context and consequences.

**When to write an ADR:**
- Choosing a framework or library (e.g., React vs Vue, Prisma vs TypeORM)
- Defining system boundaries (e.g., microservices vs monolith)
- Establishing patterns (e.g., authentication approach, error handling)
- Making infrastructure decisions (e.g., database choice, deployment strategy)
- Changing significant existing patterns

**When NOT to write an ADR:**
- Bug fixes (unless they require architectural changes)
- Feature implementations within existing patterns
- Configuration changes
- Minor refactoring
- Routine maintenance

See [ADR-TEMPLATE.md](./ADR-TEMPLATE.md) for the full template and structure.

## Audits & Analysis
- [AUDIT_ARCHITECTURE.md](../../AUDIT_ARCHITECTURE.md) - Architecture audit (Oct 22)

## See Also
- [Multi-Tenant Documentation](../multi-tenant/) - Multi-tenant architecture
- [API Documentation](../api/) - API design
- [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md) - Documentation governance standards
- [ADR GitHub organization](https://adr.github.io/) - ADR best practices and examples
