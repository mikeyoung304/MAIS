# Quality Remediation Quick Start Guide

> **Purpose**: Single entry point for implementing the MAIS Quality Remediation Plan
> **Created**: 2025-12-26
> **For**: New chat context or developer onboarding

## TL;DR

Transform MAIS from 6.9/10 quality score to enterprise-grade (80% coverage, <200 line services, full observability) in 6-8 weeks.

## Key Documents

| Document              | Location                                                                                     | Purpose                     |
| --------------------- | -------------------------------------------------------------------------------------------- | --------------------------- |
| **Main Plan**         | `plans/MAIS-quality-remediation-plan.md`                                                     | Full implementation details |
| **CI Enhancements**   | `plans/CI-ENHANCEMENT-SPEC.md`                                                               | GitHub workflow changes     |
| **Decision Log**      | `plans/QUALITY-DECISIONS-LOG.md`                                                             | Why we made key choices     |
| **Findings Analysis** | `docs/solutions/code-review-patterns/QUALITY_REMEDIATION_FINDINGS_ANALYSIS-MAIS-20251226.md` | Original audit findings     |

## What We're Building

### Current State

- BookingService: 1,394 lines (monolith)
- Coverage: 43% lines, 30% threshold
- Frontend tests: 5 files
- ESLint errors: 195
- CI build time: 4m 30s
- No distributed tracing
- No performance budgets

### Enterprise Target (Week 8)

- BookingService: 8 focused services (<200 lines each)
- Coverage: 80% lines, 80% threshold
- Frontend tests: 50+ files
- ESLint errors: 0
- CI build time: <30s (Turborepo cache)
- OpenTelemetry tracing
- SLO-based performance budgets

## Phase Overview

### Phase 0: Foundation (Week 1-2) - START HERE

| Task                               | Days | Key Files                                              |
| ---------------------------------- | ---- | ------------------------------------------------------ |
| P0-1: BookingService Decomposition | 5    | `server/src/services/booking.service.ts` → 8 new files |
| P0-2: Frontend Component Tests     | 3    | `apps/web/vitest.config.mts`, `*/__tests__/*.test.tsx` |
| P0-3: Tenant Isolation Tests       | 1    | `server/test/integration/tenant-isolation.test.ts`     |
| P0-4: Coverage Thresholds (50%)    | 0.5  | `server/vitest.config.ts`                              |
| P0-5: Turborepo Setup              | 1    | `turbo.json`, `.github/workflows/main-pipeline.yml`    |

### Phase 1: Quality Infrastructure (Week 3-4)

| Task                         | Days | Key Files                                 |
| ---------------------------- | ---- | ----------------------------------------- |
| P1-1: OpenTelemetry Tracing  | 3    | `server/src/lib/observability/tracing.ts` |
| P1-2: ESLint Resolution      | 2    | Multiple files, then remove baseline      |
| P1-3: Renovate Bot           | 0.5  | `renovate.json`                           |
| P1-4: axe-core Accessibility | 1    | `e2e/tests/accessibility.spec.ts`         |
| P1-5: Performance Budgets    | 1    | `.slo.yml`, `e2e/tests/performance/`      |
| P1-6: Security Scanning      | 0.5  | `.github/workflows/security-scan.yml`     |

### Phase 2: Excellence (Week 5-6)

| Task                           | Days | Key Files                             |
| ------------------------------ | ---- | ------------------------------------- |
| P2-1: Coverage → 65%           | 2    | Add tests to reach threshold          |
| P2-2: noUncheckedIndexedAccess | 1    | `*/tsconfig.json`                     |
| P2-3: Event Store (Audit)      | 2    | `server/src/lib/audit/event-store.ts` |
| P2-4: Mutation Testing         | 2    | `stryker.config.json`                 |

### Phase 3: Scale Readiness (Week 7-8)

| Task                      | Days | Key Files                       |
| ------------------------- | ---- | ------------------------------- |
| P3-1: Coverage → 80%      | 4    | Add tests to reach threshold    |
| P3-2: APM Dashboard       | 2    | Honeycomb/Datadog configuration |
| P3-3: Load Testing        | 2    | k6 scripts                      |
| P3-4: Bundle Size Budgets | 1    | `apps/web/next.config.js`       |

## Critical First Steps

### 1. Update ESLint Baseline (5 min)

Current CI uses baseline of 305, but actual is 195:

```yaml
# .github/workflows/main-pipeline.yml line 98
BASELINE=195 # Changed from 305
```

### 2. Start BookingService Decomposition

```bash
# Create new service files
touch server/src/services/checkout-session.factory.ts
touch server/src/services/wedding-booking.orchestrator.ts
touch server/src/services/appointment-booking.service.ts
touch server/src/services/booking-lifecycle.service.ts
touch server/src/services/booking-query.service.ts
touch server/src/services/refund-processing.service.ts
```

### 3. Add Turborepo

```bash
npm install turbo -D
# Then create turbo.json (see plan for config)
```

## Key Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Type check
npm run typecheck

# Lint check
npm run lint

# E2E tests
npm run test:e2e
```

## Enterprise Quality Gates (Target)

All PRs must pass:

- [ ] Unit tests (coverage > 80%)
- [ ] Integration tests
- [ ] E2E tests
- [ ] Accessibility tests (WCAG 2.1 AA)
- [ ] Performance budgets (p95 < 200ms)
- [ ] Security scan (no high-severity)
- [ ] Mutation score > 70%
- [ ] Bundle size within budget
- [ ] ESLint errors = 0

## Questions?

The main plan at `plans/MAIS-quality-remediation-plan.md` has full details including:

- Code examples for each task
- Acceptance criteria
- Risk mitigation strategies
- Architecture diagrams

## Review Consensus

This plan was approved by 3 specialist reviewers:

1. **DHH (Rails Philosophy)**: Endorsed decomposition, 4-6 week timeline
2. **Enterprise Architect**: Recommended 8 services (not 3), added OpenTelemetry
3. **Simplicity Advocate**: Validated enterprise KISS, added tenant isolation tests

All agreed: **Enterprise quality > speed/cost**
