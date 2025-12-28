# MAIS Deep Codebase Research Prompt

## Executive Summary

This prompt drives a comprehensive enterprise-readiness audit of the MAIS multi-tenant SaaS platform. Based on parallel analysis by 10 specialized agents examining 490 source files, 844 markdown documents, 488 git commits, and 771+ tests, we have identified 20 critical research areas requiring deep investigation.

**Platform Snapshot:**

- 130 server TypeScript files, 353 client files
- 16 Prisma migrations, 89 database indexes
- 13 Architecture Decision Records
- Security rating: A- (93/100)
- Test count: 771 unit + 21 E2E
- Git history: 488 commits (176 fixes, 113 features, 29 CI fixes)

---

## Master Research Prompt

You are conducting a comprehensive enterprise-readiness audit of the MAIS codebase. Your goal is to systematically analyze each of the 20 research areas below, identify specific issues, and provide actionable remediation plans with code examples.

**Codebase Context:**

- Multi-tenant modular monolith (Express + React + Prisma + PostgreSQL)
- Ports/adapters architecture with dependency injection
- ts-rest + Zod for type-safe API contracts
- Mock-first development workflow
- Target: Enterprise SaaS with tenant data isolation

**Research Methodology:**

1. Read all relevant source files for each area
2. Cross-reference with documentation and ADRs
3. Identify gaps between documented patterns and implementation
4. Prioritize findings: P0 (critical), P1 (high), P2 (medium), P3 (low)
5. Provide specific file paths, line numbers, and code fixes

---

## The 20 Deep Research Areas

### AREA 1: God Component Decomposition

**Priority:** P1 | **Files:** 5 components >400 lines

**Research Scope:**

- `server/src/services/booking.service.ts` (1394 lines) - Needs domain separation
- `server/src/routes/tenant-admin.routes.ts` (1317 lines) - Route handler bloat
- `client/src/features/admin/AdminCalendar.tsx` (estimated >400 lines)
- Other large service/component files

**Questions to Answer:**

1. What cohesive sub-domains exist within each god component?
2. Which responsibilities can be extracted to dedicated services?
3. What's the refactoring strategy that maintains backward compatibility?
4. How do we maintain test coverage during decomposition?

**Deliverable:** Refactoring plan with extracted module boundaries, interface definitions, and migration steps.

---

### AREA 2: Type Safety Enforcement

**Priority:** P1 | **Metrics:** 242 `as any`, 4 `z.any()`, 14 route type assertions

**Research Scope:**

```bash
# Find all type safety violations
grep -r "as any" server/src/ client/src/
grep -r "z\.any()" packages/contracts/
grep -r ": any" server/src/ --include="*.ts"
```

**Questions to Answer:**

1. Which `as any` instances are legitimate library limitations (ts-rest/Express)?
2. Which can be replaced with proper type guards or generics?
3. Are `z.any()` schemas in contracts actually typed at runtime?
4. What's the path to `strict: true` without breaking changes?

**Deliverable:** Categorized list of type violations with fix strategies. Preserve documented library limitations per ADR patterns.

---

### AREA 3: Tenant Cascade Deletion Safety (P0)

**Priority:** P0 (CRITICAL) | **Risk:** Data integrity, orphaned records

**Research Scope:**

- `server/prisma/schema.prisma` - All tenant relationships
- `server/src/services/` - Deletion logic
- Database constraints and cascade behavior

**Questions to Answer:**

1. What happens when a tenant is deleted? Are all child records cleaned up?
2. Are there orphaned record scenarios (bookings without tenants)?
3. What's the cascade delete order to prevent FK violations?
4. Do we need soft-delete with retention policies for compliance?

**Deliverable:** Data relationship map, cascade deletion order, migration script for adding proper `onDelete` constraints.

---

### AREA 4: Foreign Key Constraint Gaps

**Priority:** P1 | **Files:** Customer, Package, TenantSettings

**Research Scope:**

```sql
-- Audit FK constraints
SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

**Questions to Answer:**

1. Which relationships lack explicit `onDelete` behavior?
2. Are there dangling references possible in Customer→Booking relationships?
3. What's the migration strategy for adding constraints to existing data?
4. Do any constraint additions require data cleanup first?

**Deliverable:** Prisma schema patch with missing FK constraints, data cleanup scripts.

---

### AREA 5: CI Pipeline Stability

**Priority:** P1 | **Metrics:** 29 CI fix commits (indicates instability)

**Research Scope:**

- `.github/workflows/` - All workflow files
- Git log for "ci:" prefixed commits
- Test flakiness patterns

**Questions to Answer:**

1. What are the recurring CI failure modes?
2. Are there timing-dependent tests causing flakiness?
3. Is the CI matrix (Node versions, OS) appropriate?
4. What's the average CI run time and can it be parallelized better?

**Deliverable:** CI stability report with specific flaky test fixes, workflow optimizations.

---

### AREA 6: API Documentation Generation

**Priority:** P2 | **Gap:** No auto-generated API docs

**Research Scope:**

- `packages/contracts/` - All contract definitions
- Existing documentation in `docs/reference/`
- ts-rest documentation capabilities

**Questions to Answer:**

1. Can we auto-generate OpenAPI from ts-rest contracts?
2. What documentation is missing for each endpoint?
3. Should we use Swagger UI or a static site generator?
4. How do we keep docs in sync with contract changes?

**Deliverable:** OpenAPI generation script, documentation pipeline, CI integration.

---

### AREA 7: Frontend Test Coverage

**Priority:** P1 | **Metrics:** Only 5 test files for 353 source files

**Research Scope:**

- `client/src/**/*.test.tsx` - Existing tests
- `client/src/features/` - Feature modules needing coverage
- `e2e/` - E2E test coverage

**Questions to Answer:**

1. What's the current line/branch coverage percentage?
2. Which critical user flows lack test coverage?
3. What testing patterns should we standardize (RTL, MSW)?
4. How do we mock tenant context effectively?

**Deliverable:** Testing strategy document, coverage targets by feature, sample test patterns.

---

### AREA 8: Console.log Cleanup

**Priority:** P2 | **Metrics:** 407 console.log occurrences

**Research Scope:**

```bash
grep -rn "console\." server/src/ client/src/ --include="*.ts" --include="*.tsx"
```

**Questions to Answer:**

1. Which console.logs are debug artifacts vs. intentional?
2. Should we use a logger abstraction in the client?
3. What ESLint rules prevent new console.log additions?
4. Are there console.errors that should be Sentry reports?

**Deliverable:** Cleanup script, ESLint configuration, logger abstraction for client.

---

### AREA 9: Error Boundary Coverage

**Priority:** P2 | **Risk:** Uncaught errors crash entire app

**Research Scope:**

- `client/src/` - Error boundary implementations
- React error handling patterns
- Sentry integration points

**Questions to Answer:**

1. Do all route-level components have error boundaries?
2. Are async errors (TanStack Query) properly captured?
3. What's the user experience when an error occurs?
4. Are errors properly categorized for Sentry alerting?

**Deliverable:** Error boundary wrapper component, route-level integration, Sentry error categorization.

---

### AREA 10: Large File Decomposition Strategy

**Priority:** P2 | **Files:** di.ts (745 lines), routes files

**Research Scope:**

- `server/src/di.ts` - DI container complexity
- Route files exceeding 500 lines
- Service files with multiple domains

**Questions to Answer:**

1. Can di.ts be split into domain-specific containers?
2. Are there route handlers doing too much business logic?
3. What's the ideal file size threshold (300 lines?)?
4. How do we enforce file size limits in CI?

**Deliverable:** File decomposition map, refactoring PRs, CI file-size linter.

---

### AREA 11: Database Index Optimization

**Priority:** P2 | **Current:** 89 indexes

**Research Scope:**

- `server/prisma/schema.prisma` - Index definitions
- Slow query patterns
- Missing composite indexes

**Questions to Answer:**

1. Are there queries running without index support?
2. Are composite indexes ordered correctly for query patterns?
3. Are there redundant or unused indexes?
4. What's the write performance impact of current indexes?

**Deliverable:** Index audit report, optimization recommendations, EXPLAIN ANALYZE results.

---

### AREA 12: Contract Versioning Strategy

**Priority:** P2 | **Risk:** Breaking API changes

**Research Scope:**

- `packages/contracts/` - Current contract structure
- API versioning patterns
- Client compatibility

**Questions to Answer:**

1. How do we version breaking API changes?
2. Is there a deprecation policy for old endpoints?
3. How do mobile clients handle API version mismatches?
4. Should we use URL versioning (/v2/) or header versioning?

**Deliverable:** Versioning strategy document, migration guide template.

---

### AREA 13: Component Duplication Consolidation

**Priority:** P2 | **Estimated:** 10-15 duplicated patterns

**Research Scope:**

- `client/src/ui/` - Shared components
- `client/src/features/*/components/` - Feature components
- Similar form patterns

**Questions to Answer:**

1. What UI patterns are duplicated across features?
2. Are there inconsistent button/input/card implementations?
3. What belongs in shared `ui/` vs feature-specific?
4. Is there a component library documentation gap?

**Deliverable:** Duplication report, component consolidation plan, Storybook setup.

---

### AREA 14: Form Handling Standardization

**Priority:** P2 | **Pattern:** react-hook-form + Zod

**Research Scope:**

- All form components
- Validation patterns
- Error display consistency

**Questions to Answer:**

1. Are all forms using react-hook-form consistently?
2. Is Zod validation shared between client and server?
3. Are error messages user-friendly and consistent?
4. What's the form submission loading state pattern?

**Deliverable:** Form pattern documentation, shared validation utilities.

---

### AREA 15: Accessibility Audit

**Priority:** P1 | **Compliance:** WCAG 2.1 AA target

**Research Scope:**

- All interactive components
- Color contrast
- Keyboard navigation
- Screen reader compatibility

**Questions to Answer:**

1. Do all interactive elements have proper ARIA labels?
2. Is keyboard navigation working for all flows?
3. Are color contrasts meeting AA standards?
4. Is there a skip-to-content link?

**Deliverable:** Accessibility audit report, remediation checklist, automated a11y testing.

---

### AREA 16: Performance Optimization

**Priority:** P2 | **Areas:** Image loading, bundle size, API calls

**Research Scope:**

- Bundle analysis
- Image optimization
- API waterfall patterns
- React re-render analysis

**Questions to Answer:**

1. What's the current bundle size and can it be reduced?
2. Are images lazy-loaded with proper placeholders?
3. Are there API call waterfalls that could be parallelized?
4. Are React components memoized appropriately?

**Deliverable:** Performance audit, optimization checklist, Core Web Vitals baseline.

---

### AREA 17: Documentation Gap Analysis

**Priority:** P2 | **Files:** 844 markdown, gaps in API/component docs

**Research Scope:**

- All documentation directories
- README completeness
- Onboarding documentation

**Questions to Answer:**

1. What documentation is outdated or contradictory?
2. Are all public APIs documented?
3. Is the developer onboarding path clear?
4. Are operational runbooks complete?

**Deliverable:** Documentation gap report, priority documentation tasks.

---

### AREA 18: Webhook Reliability Enhancement

**Priority:** P1 | **Pattern:** Dead-letter queue (ADR-009)

**Research Scope:**

- `server/src/routes/webhooks.routes.ts`
- WebhookEvent model
- Retry logic

**Questions to Answer:**

1. Is the dead-letter queue being processed?
2. What's the retry strategy for failed webhooks?
3. Are there monitoring alerts for DLQ depth?
4. How do we replay failed webhooks manually?

**Deliverable:** DLQ processing job, monitoring dashboard, replay CLI tool.

---

### AREA 19: Distributed Tracing Implementation

**Priority:** P2 | **Current:** Sentry, no trace propagation

**Research Scope:**

- Request tracing
- Span propagation
- Correlation IDs

**Questions to Answer:**

1. Can we trace a request across API→Service→Database?
2. Are correlation IDs propagated in logs?
3. What's the Sentry tracing integration status?
4. Should we add OpenTelemetry?

**Deliverable:** Tracing middleware, correlation ID propagation, Sentry tracing config.

---

### AREA 20: Application Metrics & Alerting

**Priority:** P2 | **Current:** Basic health checks

**Research Scope:**

- Health check endpoints
- Business metrics
- Infrastructure metrics

**Questions to Answer:**

1. What business metrics should we track (bookings/day, revenue)?
2. Are there SLOs defined for critical endpoints?
3. What alerting thresholds are appropriate?
4. Should we use Prometheus/Grafana or cloud-native?

**Deliverable:** Metrics specification, alerting rules, dashboard templates.

---

## Execution Instructions

When running this research prompt, structure your work as follows:

### Phase 1: Critical Path (P0-P1)

Research areas: 3, 4, 2, 1, 5, 7, 15, 18
Estimated scope: 8 areas requiring immediate attention

### Phase 2: Quality Improvements (P2)

Research areas: 6, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20
Estimated scope: 12 areas for quality enhancement

### Output Format

For each research area, provide:

```markdown
## AREA [N]: [Title]

### Findings

- [Specific file:line references]
- [Code examples of issues found]
- [Quantified impact]

### Root Cause Analysis

- [Why this issue exists]
- [What allowed it to persist]

### Remediation Plan

1. [Step 1 with code example]
2. [Step 2 with code example]
3. [Verification method]

### Estimated Effort

- Complexity: [Low/Medium/High]
- Files affected: [count]
- Test updates required: [Yes/No]

### Dependencies

- [Other areas that must be addressed first]
- [External dependencies]
```

---

## Success Criteria

The audit is complete when:

1. All 20 areas have been researched with specific findings
2. P0 issues have immediate remediation PRs
3. P1 issues have detailed plans with effort estimates
4. P2 issues are documented in backlog with priority ranking
5. A prioritized remediation roadmap exists
6. CI/CD enhancements prevent regression
7. Documentation gaps are filled

---

## Appendix: Key File Locations

```
# Architecture
server/src/di.ts                    # Dependency injection (745 lines)
server/src/lib/ports.ts             # Repository interfaces
server/src/lib/entities.ts          # Domain models

# Services
server/src/services/booking.service.ts      # 1394 lines (god component)
server/src/services/catalog.service.ts
server/src/services/availability.service.ts

# Database
server/prisma/schema.prisma         # 686 lines, 15 tables
server/prisma/migrations/           # 16 migrations

# Contracts
packages/contracts/src/             # ts-rest + Zod definitions

# Frontend
client/src/features/                # Feature modules
client/src/ui/                      # Shared components

# Documentation
ARCHITECTURE.md                     # System design
DECISIONS.md                        # ADR index
docs/adrs/                          # Architecture Decision Records
docs/solutions/                     # Prevention strategies (208 files)
```

---

_Generated: 2024-12-24_
_Research Agents: 10 parallel fact-finders_
_Source Files Analyzed: 490_
_Documentation Files: 844_
_Git Commits Analyzed: 488_
