# Enterprise Refactoring Scan Results

**Date:** 2026-02-18
**Branch:** `fix/supabase-pro-optimization`
**Status:** Analysis complete, awaiting sprint selection
**Scanned by:** 4 parallel agents (server, frontend, contracts, architecture)

---

## Overall Assessment: 7.5/10

The codebase is **well-engineered, not vibe-coded.** Centralized DI, layered architecture, ts-rest contracts, multi-tenant isolation, 8-stage CI pipeline. The gap to enterprise is **observability** (no metrics/tracing), **consistency** (scattered config, cache key drift), and **decomposition** (7 god files).

---

## Architecture Scorecard

| Category             | Grade  | Notes                                                                           |
| -------------------- | ------ | ------------------------------------------------------------------------------- |
| Dependency Injection | A+     | Centralized container, lifecycle management, setter injection for circular deps |
| CI/CD Pipeline       | A      | 8-stage quality gates, workspace-level typecheck, coverage tracking             |
| Middleware Chain     | A      | Clean execution order, proper error mapping, rate limiting                      |
| Error Taxonomy       | A      | DomainError + AppError, Sentry integration, Zod→400 mapping                     |
| Auth/Authz           | A-     | Multi-tenant isolation, advisory locks, API key format validation               |
| Database Schema      | A-     | Good indexes, smart composites, tenant-scoped uniqueness                        |
| Caching              | A-     | Helper layer exists, but SET/DEL key drift risk is silent                       |
| Logging              | A-     | Pino structured logging, but 59 console.log remain in 12 files                  |
| Configuration        | B+     | Central config exists but 110 `process.env` reads scattered                     |
| Testing              | B      | Good coverage, 969 TODOs, inconsistent colocation patterns                      |
| **Monitoring**       | **C+** | **No metrics endpoint, no distributed tracing, minimal health checks**          |
| API Versioning       | C      | Only v1, no deprecation strategy                                                |
| Frontend             | A-     | 0 P1 issues, 11 P2, 23 P3 — enterprise-ready                                    |

---

## P1 Findings (Critical)

### 1. Observability Gap (Grade: C+)

No Prometheus/StatsD metrics endpoint. No OpenTelemetry distributed tracing. Agent calls to Cloud Run are black boxes. Health checks only verify database — no Redis, Stripe, Postmark, GCal dependency checks. Cannot set SLAs, detect regressions, or alert on failures.

**Files:**

- `server/src/index.ts` — health check setup
- `server/src/app.ts` — middleware chain (no metrics middleware)

### 2. Seven God Files (800-1,253 lines each)

| File                                               | Lines | Problem                                                  |
| -------------------------------------------------- | ----- | -------------------------------------------------------- |
| `server/src/adapters/prisma/booking.repository.ts` | 1,253 | CRUD + advisory locks + retry logic + conflict detection |
| `server/src/lib/ports.ts`                          | 1,244 | 15+ interfaces, 80+ methods in one file                  |
| `server/src/adapters/mock/index.ts`                | 1,197 | All mock repos in single file                            |
| `server/src/services/project-hub.service.ts`       | 976   | Queries + commands + events + timeline                   |
| `server/src/services/vertex-agent.service.ts`      | 896   | Init + routing + tool dispatch + token counting          |
| `server/src/di.ts`                                 | 841   | 40+ services wired in one function                       |
| `server/src/services/section-content.service.ts`   | 815   | CRUD + publishing + undo/redo + sanitization             |

**Decomposition strategy for each:**

- **booking.repository.ts** → `BookingQueryRepository`, `BookingMutationRepository`, `BookingAdvisoryLockService`, `BookingConflictDetector`
- **ports.ts** → `ports/catalog.ports.ts`, `ports/booking.ports.ts`, `ports/project.ports.ts`, `ports/cache.ports.ts`, `ports/storage.ports.ts`
- **mock/index.ts** → `mock/catalog.mock.ts`, `mock/booking.mock.ts`, `mock/project.mock.ts`, `mock/base.mock.ts`
- **project-hub.service.ts** → `ProjectQueryService`, `ProjectRequestService`, `ProjectEventService` + facade
- **vertex-agent.service.ts** → `AgentMessageRouter`, `AgentContextBuilder`, `AgentTokenCounter` + thin orchestrator
- **di.ts** → `di/catalog.di.ts`, `di/booking.di.ts`, `di/core.di.ts`, `di/base.ts` + `buildContainer()` composer
- **section-content.service.ts** → `SectionContentValidator`, `SectionVersioningService`, `SectionPublishingService`

### 3. Contract Validation Gaps

| Finding                             | File                               | Line(s)                                | Risk                                                                  |
| ----------------------------------- | ---------------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| `z.any()` on webhook body           | `packages/contracts/src/api.v1.ts` | 188                                    | Bypasses all validation                                               |
| `z.any()` on file upload body       | `packages/contracts/src/api.v1.ts` | 296                                    | Bypasses all validation                                               |
| `z.any()` on branding update        | `packages/contracts/src/dto.ts`    | 679                                    | Unvalidated JSON to DB                                                |
| 4 list endpoints missing pagination | `api.v1.ts`                        | Blackouts, Segments, AddOns, Customers | Unbounded queries                                                     |
| Branding schema duplication         | `dto.ts`                           | 342 vs 997                             | Different validation rules, field name mismatch (`logo` vs `logoUrl`) |
| Slug validation inconsistency       | `dto.ts`                           | 611 vs 270                             | Different max lengths (100 vs 63), different regex                    |

---

## P2 Findings (Important)

### Server

| #   | Finding                                      | Location                                               | Fix                                              |
| --- | -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------ |
| 1   | 110 scattered `process.env` reads            | 50+ files                                              | Expand ConfigSchema, read once at startup        |
| 2   | Cache key drift — SET != DEL keys silently   | 50+ locations                                          | Central `CacheKeys` registry with typed builders |
| 3   | 86 `as any` without justification            | 17 server files                                        | Audit each, add comments or type guards          |
| 4   | 59 `console.log` remaining                   | 12 server files                                        | Replace with `logger.info/debug`                 |
| 5   | Hardcoded `MAX_LIMIT` constants              | project-hub, booking, context-builder services         | Central `QueryLimits` config                     |
| 6   | 3 separate transaction retry implementations | booking.repo, appointment-booking, tenant-provisioning | Extract shared `executeWithRetry()`              |
| 7   | Hardcoded URLs in source                     | app.ts, internal.routes, billing routes                | Move to `config.ts`                              |
| 8   | Impersonation has no expiry                  | `middleware/tenant-auth.ts:51-78`                      | Add `impersonationExpiresAt` to token            |
| 9   | N+1 query patterns                           | project-hub.service.ts:551-558, tenant.repository      | Add explicit `select`, query profiling           |
| 10  | 969 TODO/FIXME comments                      | across codebase                                        | Triage and resolve or document                   |

### Contracts

| #   | Finding                                                     | Location                  | Fix                                                     |
| --- | ----------------------------------------------------------- | ------------------------- | ------------------------------------------------------- |
| 11  | Inconsistent HTTP status codes — POST returning 200 vs 201  | `api.v1.ts`               | Standardize: POST creation = 201                        |
| 12  | Branded types defined but unused in contracts               | `shared/branded-types.ts` | Create branded Zod schemas                              |
| 13  | Internal agent routes bypass contract system                | 25+ endpoints             | Add contracts or document exemption                     |
| 14  | Result type missing utilities (`Ok()`, `Err()`, `unwrap()`) | `shared/result.ts`        | Add helper functions                                    |
| 15  | Query param coercion inconsistent                           | `api.v1.ts:436`           | Use `z.coerce.boolean()` not `z.enum(['true','false'])` |
| 16  | Money utility not used in schemas                           | `shared/money.ts`         | Create `PriceCentsSchema`                               |

### Frontend

| #   | Finding                                       | Location                                                                                | Fix                              |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------- |
| 17  | 9 components >200 lines                       | DateBookingWizard (782L), ProjectHubChatWidget (758L), SectionEditorDialog (674L), etc. | Extract sub-components           |
| 18  | 4 missing `error.tsx` files                   | `/app/(protected)/tenant/` — projects, revenue, settings + admin/new                    | Add error boundaries             |
| 19  | Prop drilling in DateBookingWizard (4 levels) | DateBookingWizard.tsx                                                                   | Extract `useDateWizardContext()` |
| 20  | Gallery images not keyboard-navigable         | GallerySection                                                                          | Add Space/Enter handlers         |
| 21  | 3 deprecated exports still present            | refinement-store, useSectionsDraft, build/layout                                        | Archive or remove                |

### Database

| #   | Finding                              | Location                                                    | Fix                                             |
| --- | ------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------- |
| 22  | Tenant model has 48 fields (bloat)   | `prisma/schema.prisma`                                      | Consider splitting into Tenant + TenantSettings |
| 23  | Missing indexes on frequent queries  | AgentSession (userId, createdAt), AddOn (segmentId, active) | Add composite indexes                           |
| 24  | 4 legacy OnboardingPhase enum values | schema.prisma                                               | Deprecate or remove                             |
| 25  | VocabularyEmbedding model incomplete | schema.prisma                                               | pgvector implemented but no code uses it        |

---

## P3 Findings (Nice-to-Have)

- API versioning strategy (Accept-Version headers, deprecation timeline)
- Bundle size monitoring enforcement in CI
- Security test suite (CORS, rate limiting, CSRF)
- Performance benchmarks in CI
- 3 unnecessary `'use client'` directives on mostly-static layouts
- 15-20 interactive buttons missing explicit `aria-label`
- Focus trap audit for custom (non-Radix) modals
- Agent system prompt size (442 lines) — could modularize

---

## Recommended Sprint Sequence

### Sprint A: See Everything (Observability)

1. Add Prometheus metrics endpoint + basic counters (request rate, latency, errors)
2. Add dependency health checks to `/health/ready` (Redis, Stripe, Postmark)
3. Replace 59 `console.log` with structured logger
4. Centralize 110 `process.env` reads into ConfigSchema

### Sprint B: Harden the Boundaries (Contracts + Validation)

5. Replace `z.any()` with proper schemas (webhook, upload, branding)
6. Add pagination to 4 unbounded list endpoints
7. Standardize error status codes across all endpoints
8. Create shared `SlugSchema`, `PriceCentsSchema`, branded type schemas
9. Add 4 missing `error.tsx` to frontend routes

### Sprint C: Decompose the Giants (God Files)

10. Split `ports.ts` by domain (catalog, booking, project, cache)
11. Split `di.ts` into domain-specific builders
12. Extract `BookingAdvisoryLockService` + `executeWithRetry()` utility
13. Decompose `ProjectHubService` into query/command/event services
14. Split `MockAdapter` per domain

### Sprint D: Polish (Consistency + DX)

15. Central `CacheKeys` registry + `QueryLimits` config
16. Audit 86 `as any` — justify or eliminate
17. Frontend component decomposition (top 3 largest)
18. Accessibility fixes (gallery keyboard nav, modal focus traps)

---

## Quick Wins (< 2 hours each)

1. **Add 4 missing error.tsx files** — 30 min
2. **Replace console.log globally** — 1 hour (grep + replace)
3. **Create QueryLimits config** — 1 hour
4. **Standardize POST → 201** — 1 hour
5. **Fix slug validation inconsistency** — 30 min
6. **Archive 3 deprecated frontend exports** — 30 min
