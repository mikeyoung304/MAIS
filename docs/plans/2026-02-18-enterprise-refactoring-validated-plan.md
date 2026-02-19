# Enterprise Refactoring — Validated Plan

**Date:** 2026-02-18
**Source:** `docs/plans/2026-02-18-enterprise-refactoring-scan-results.md` (4-agent scan)
**Validation:** 6 deep-dive agents verified every finding against live codebase
**Status:** Sprints B, A, D complete. Sprint C deferred. D2 and A3 deferred.

---

## Validation Summary

| Category     | Original Findings | Confirmed | Partially Confirmed | False Positive |
| ------------ | :---------------: | :-------: | :-----------------: | :------------: |
| P1 Critical  |         3         |     1     |          2          |       0        |
| P2 Server    |        10         |     3     |          2          |       5        |
| P2 Contracts |         6         |     4     |          1          |       1        |
| P2 Frontend  |         5         |     1     |          1          |       3        |
| P2 Database  |         4         |     1     |          0          |       3        |
| **Total**    |      **28**       |  **10**   |        **6**        |     **12**     |

**False positive rate: 43%** — the scan significantly over-reported issues.

---

## Confirmed Findings (Sorted by Sprint)

### Sprint B: Harden the Boundaries (RECOMMENDED FIRST)

> **Why first:** Concrete, verifiable contract changes. Low regression risk (additive schemas, status code changes). Highest safety ROI per hour. Each fix is independently shippable.

#### B1. Replace `z.any()` on branding update [P1] [~30 min]

- **File:** `packages/contracts/src/dto.ts:679`
- **Current:** `branding: z.record(z.string(), z.any()).optional()`
- **Fix:** Replace with typed `BrandingSchema` matching `TenantBrandingDtoSchema` (line 342)
- **Note:** The other 2 `z.any()` usages (webhook line 188, upload line 296) are **justified** — Stripe needs raw body, ts-rest doesn't handle multipart. Add inline comments documenting why.

#### B2. Add pagination to 12 unbounded list endpoints [P1] [~3 hours]

- **File:** `packages/contracts/src/api.v1.ts`
- **Endpoints needing pagination (with line numbers):**

| Endpoint                          | Line | Current Response                  |
| --------------------------------- | ---- | --------------------------------- |
| `getTiers`                        | 84   | `z.array(TierDtoSchema)`          |
| `tenantAdminGetBlackouts`         | 344  | `z.array(BlackoutDtoSchema)`      |
| `tenantAdminGetBookings`          | 395  | Has filters, no skip/take         |
| `platformGetAllTenants`           | 432  | `includeTest` filter only         |
| `adminGetBlackouts`               | 552  | No query params                   |
| `tenantAdminGetSegments`          | 650  | `z.array(SegmentDtoSchema)`       |
| `tenantAdminGetAddOns`            | 758  | `z.array(AddOnDtoSchema)`         |
| `getSegments`                     | 863  | `z.array(SegmentDtoSchema)`       |
| `getServices`                     | 1017 | `z.array(PublicServiceDtoSchema)` |
| `tenantAdminGetServices`          | 1129 | `z.array(ServiceDtoSchema)`       |
| `tenantAdminGetAvailabilityRules` | 1210 | `serviceId` filter only           |
| `tenantAdminGetCustomers`         | 1341 | `z.array(CustomerDtoSchema)`      |

- **Pattern:** Add `PaginatedQuerySchema` (skip/take with defaults) + `PaginatedResponseSchema<T>` wrapper. Reference existing `adminGetBookings` (line 535) which already has cursor pagination.
- **Dependency:** Contract changes → route handler changes → frontend caller changes. **Separate PR per batch** (catalog endpoints, booking endpoints, admin endpoints).

#### B3. Unify branding schemas [P2] [~1 hour]

- **Files:**
  - `packages/contracts/src/dto.ts:342` — `TenantBrandingDtoSchema` (uses `logo`, bare `z.string()` colors)
  - `packages/contracts/src/dto.ts:354` — `UpdateBrandingDtoSchema` (uses `fontPreset`, no logo field, inline hex regex)
  - `packages/contracts/src/dto.ts:997` — `TenantPublicDtoSchema.branding` (uses `logoUrl`, `HexColorSchema`, font enum)
- **Mismatches:** `logo` vs `logoUrl`, `fontFamily` vs `fontPreset`, different color validation strictness
- **Fix:** Create single `BrandingSchema` with strict validation (`HexColorSchema`, font enum, `logoUrl`). All three locations reference it. Map legacy `logo` → `logoUrl` in a transform if DB uses `logo`.

#### B4. Create shared `SlugSchema` [P2] [~30 min]

- **Files:**
  - `packages/contracts/src/dto.ts` — 7 slug validations with inconsistent rules
  - `packages/contracts/src/api.v1.ts:271-278` — path param slug with stricter regex
- **Inconsistencies:**
  - Max lengths: 50 (tenant create) vs 63 (public lookup) vs 100 (everything else)
  - Regex: `/^[a-z0-9-]+$/` allows `--leading-trailing--` vs `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` (strict, no leading/trailing hyphens)
- **Fix:** Create `SlugSchema` in `dto.ts` with strict regex + max 63 (DNS label limit). All 8 locations use it. Separate `TenantSlugSchema` with min 2 if tenant slugs need different minimums.

#### B5. Standardize POST → 201 for creation endpoints [P2] [~30 min]

- **File:** `packages/contracts/src/api.v1.ts`
- **Violations (return 200 instead of 201):**
  - `adminCreateBlackout` — line 577
  - `adminCreateAddOn` — line 602
  - `tenantAdminCreateSegment` — line 668
- **Fix:** Change response status to 201 in contract. Verify route handlers return 201 (ts-rest auto-maps).

#### B6. Add error.tsx to 4 tenant route directories [P2] [~30 min]

- **Missing:**
  - `apps/web/src/app/(protected)/tenant/projects/error.tsx`
  - `apps/web/src/app/(protected)/tenant/revenue/error.tsx`
  - `apps/web/src/app/(protected)/tenant/settings/error.tsx`
  - `apps/web/src/app/(protected)/tenant/website/error.tsx`
- **Note:** Parent `tenant/error.tsx` catches these already — errors won't be unhandled. These add route-specific recovery UIs.
- **Note:** Original claim about `admin/new` is FALSE — `admin/tenants/new/error.tsx` already exists.

**Sprint B Total: ~6 hours | 1-2 PRs | Low regression risk**

---

### Sprint A: See Everything (Observability)

> **Why second:** Metrics infrastructure already exists (was falsely reported as missing). The real gaps are narrower than the scan suggested.

#### A1. Wire `createMetricsMiddleware()` into Express pipeline [P1] [~30 min]

- **File:** `server/src/routes/metrics.routes.ts:207-237`
- **Current state:** Full prom-client setup exists (counters, gauges, 3 endpoints at `/metrics`, `/metrics/json`, `/metrics/agent`). Bearer token auth. BUT `createMetricsMiddleware()` is defined and **never imported** — HTTP request/duration counters are always zero.
- **Fix:** Import and use in `server/src/app.ts` middleware chain. One line: `app.use(createMetricsMiddleware())`.
- **NOT needed:** Prometheus setup, counter definitions, auth — all already done.

#### A2. Add Redis + Supabase to health checks [P2] [~1 hour]

- **Files:**
  - `server/src/routes/health.routes.ts` — 3-tier system (live/ready/deep) exists
  - `server/src/services/health-check.service.ts` — checks Stripe, Postmark, GCal (shallow)
- **Missing checks:** Redis connectivity (PING), Supabase Storage (HEAD request)
- **Fix:** Add `checkRedis()` and `checkSupabaseStorage()` to `HealthCheckService`. Wire into `/health/ready`.

#### A3. Centralize remaining `process.env` reads [P2] [~3 hours]

- **Current state:** Two Zod config schemas exist (`config.ts` covers 24 vars, `env.schema.ts` covers ~15 vars). ~75-80 reads bypass them across ~30 files.
- **Top offenders:**
  - `server/src/di.ts` — 12 direct reads (REDIS_URL, STORAGE_MODE, agent URLs, etc.)
  - `server/src/agent-v2/config/vertex-config.ts` — 7 reads (Vertex AI config)
  - `server/src/lib/errors/sentry.ts` — 5 reads
  - `server/src/llm/vertex-client.ts` — 5 reads
  - `server/src/config/database.ts` — 4 reads (Supabase config)
- **Fix:** Expand `ConfigSchema` in `config.ts` to cover all env vars. Export typed `config` object. Replace direct reads with `config.REDIS_URL`, etc.
- **Exclusion:** Agent deploy copies (`agent-v2/deploy/*/src/utils.ts`) run on Cloud Run, not Express — they MUST read `process.env` directly. Don't centralize those.

**Sprint A Total: ~4.5 hours | 1 PR | Low regression risk**

---

### Sprint C: Decompose the Giants (God Files)

> **Why third:** Highest effort, highest risk. Each split touches many imports. Must be done incrementally with passing tests between each step.

All 7 god files are **confirmed** at their exact line counts:

| File                         | Lines | Splitability | Suggested Decomposition                                                                                     |
| ---------------------------- | ----- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| `booking.repository.ts`      | 1,253 | High         | Extract `bookingMapper.ts` (165L), `TimeslotBookingRepository`, `BookingReminderRepository`                 |
| `ports.ts`                   | 1,244 | High         | 8 files under `ports/` by domain (catalog, booking, project, cache, storage, auth, tenant, section-content) |
| `mock/index.ts`              | 1,197 | High         | 1 file per mock class + barrel re-export                                                                    |
| `project-hub.service.ts`     | 976   | Medium-High  | `ProjectHubAuthService`, `ProjectRequestService`, `ProjectHubQueryService`                                  |
| `vertex-agent.service.ts`    | 896   | Medium       | `AgentSessionService` + keep orchestrator thin                                                              |
| `di.ts`                      | 841   | Low          | Split mock/real branches; coupling is inherent to DI containers                                             |
| `section-content.service.ts` | 815   | Medium       | Extract `section-defaults.ts`, `section-validation.ts`                                                      |

**Also found (not in original scan):**

- `api-docs.ts` — 1,030 lines (static OpenAPI spec, not behavioral — low priority)
- `tenant-admin-tenant-agent.routes.ts` — 934 lines (cohesive route handler — low priority)

**Dependency order:**

1. `ports.ts` first (all others import from it — split must be re-exported from barrel `ports/index.ts`)
2. `mock/index.ts` second (mirrors ports)
3. Remaining files in any order (independent)

**Sprint C Total: ~12-16 hours | 1 PR per god file (7 PRs) | Medium regression risk**

---

### Sprint D: Polish (Consistency + DX)

#### D1. Central `QueryLimits` config [P2] [~1 hour]

- **Current:** 7+ locations with inconsistent MAX_LIMIT (50/100/200/500)
- **Key locations:** `project-hub.service.ts:588` (50), `booking.service.ts:400` (100), `booking.repository.ts:713` (500), `catalog.repository.ts:19` (100), `tenant.repository.ts:72-74` (50/500/100)
- **Fix:** Create `server/src/lib/core/query-limits.ts` with domain-specific defaults. Import everywhere.

#### D2. Audit `as any` — justify or eliminate [P2] [~2 hours]

- **Actual count:** ~42 in 13 non-test files (scan claimed 86/17 — inflated)
- **Top offender:** `mock/index.ts` (14) — mutating readonly booking properties
- **Recurring pattern:** `tenant.secrets as any`, `tenant.branding as any` (~10 occurrences across 4 files) — solvable with `PrismaJsonField<T>` helper from `types/prisma-json.ts`
- **Fix:** Add justification comments to legitimate uses, replace Prisma JSON casts with typed helpers, fix mock mutations.

#### D3. Remove 4 legacy OnboardingPhase enum values [P2] [~1 hour]

- **File:** `server/prisma/schema.prisma:997-1006`
- **Dead values:** `DISCOVERY`, `MARKET_RESEARCH`, `SERVICES`, `MARKETING`
- **Active values:** `NOT_STARTED`, `BUILDING`, `COMPLETED`, `SKIPPED`
- **Fix:** Custom migration SQL (`ALTER TYPE`) to remove dead values. Verify no production rows use them first.

#### D4. Delete dead code — branded types, Result stub, money utility [P2] [~30 min]

- `packages/shared/src/branded-types.ts` (306L) — zero imports anywhere in monorepo
- `packages/shared/src/result.ts` (6L) — zero usage outside the type definition
- `packages/shared/src/money.ts` — `toCents`/`fromCents` never imported
- **Fix:** Delete all three, remove from `packages/shared/src/index.ts` re-exports.
- **Or:** If branded types are desired for future use, keep but track as intentional.

#### D5. Clean up dead build route [P3] [~15 min]

- `apps/web/src/app/(protected)/tenant/build/` — layout has `@deprecated` JSDoc, page.tsx redirects to dashboard
- **Fix:** Delete directory if no longer needed, or keep as redirect for bookmarked URLs.

#### D6. Delete `selectProgress` deprecated export [P3] [~15 min]

- `apps/web/src/stores/refinement-store.ts` — `selectProgress` has `@deprecated` tag, zero active consumers
- **Fix:** Remove export and function definition.

**Sprint D Total: ~5 hours | 1-2 PRs | Low-Medium regression risk**

---

## Dropped Findings (False Positives)

| #             | Original Claim                                                          | Why Dropped                                                                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1 (partial)  | No metrics endpoint                                                     | Full prom-client setup exists with 3 endpoints and auth. Only the middleware wiring is missing.                                                                                                        |
| A3            | 59 console.log violations                                               | Actual: 0 runtime violations. 30 total occurrences = 11 JSDoc examples + 7 intentional Cloud Run loggers + 12 migration scripts.                                                                       |
| S6            | 3 duplicate transaction retry impls                                     | 5 retry patterns exist but serve completely different failure modes (DB deadlock, email 429, JSON clobber, ADK 404, infra). Architecturally correct — not duplicated.                                  |
| S8            | Impersonation has no expiry                                             | Tokens expire in 2 hours (`expiresIn: '2h'` in `identity.service.ts:71`). Has `startedAt` audit trail.                                                                                                 |
| S9            | N+1 query patterns                                                      | All cited methods use single queries with Prisma `include` (JOINs). No loops containing DB queries found.                                                                                              |
| D22           | Tenant model has 48 fields                                              | Actual: 40 columns (not 48). Wide but not pathological. Split would add required JOIN on every tenant lookup.                                                                                          |
| D23           | Missing indexes on AgentSession/AddOn                                   | AgentSession has no `userId` field (uses `customerId`/`tenantId`); AddOn already has `@@index([tenantId, active])` and `@@index([tenantId, segmentId])`.                                               |
| D25           | VocabularyEmbedding unused                                              | Full 404-line service exists, pgvector extension in migration, wired into DI. Only genuine gap: missing IVFFlat vector index.                                                                          |
| F19           | 4-level prop drilling in DateBookingWizard                              | Actual: 2 levels. Sub-steps are co-located in same file, not nested components.                                                                                                                        |
| F20           | Gallery images not keyboard-navigable                                   | Images wrapped in `<button>` with `aria-label` and visible focus ring. Fully WCAG compliant.                                                                                                           |
| F21           | 3 deprecated exports (refinement-store, useSectionsDraft, build/layout) | refinement-store is actively used by 6 files. useSectionsDraft is current implementation. build/layout is a dead route dir, not a module export. Only `selectProgress` (unlisted) is truly deprecated. |
| C15 (partial) | Systemic query param coercion inconsistency                             | Only 2 instances of `z.enum(['true','false'])`, same field name. Narrow quirk, not systemic.                                                                                                           |

---

## Execution Recommendation

### Recommended order: B → A → D → C

| Sprint                   | Effort  | Risk    | Impact                   | PRs |
| ------------------------ | ------- | ------- | ------------------------ | --- |
| **B: Harden Boundaries** | ~6h     | Low     | High (safety)            | 1-2 |
| **A: Observability**     | ~4.5h   | Low     | High (visibility)        | 1   |
| **D: Polish**            | ~5h     | Low-Med | Medium (DX)              | 1-2 |
| **C: Decompose Giants**  | ~12-16h | Medium  | Medium (maintainability) | 7   |

**Start with Sprint B** because:

1. Every fix is independently verifiable with existing tests
2. Pagination + schema fixes directly address Pitfall #13 (unbounded queries)
3. Contract changes surface type errors at compile time — regressions are caught immediately
4. Smallest blast radius — contracts are additive, not destructive

**Skip Sprint C for now** — god file decomposition is high effort with no user-facing benefit. Only pursue if team velocity is suffering from merge conflicts in those files.

---

## PR Strategy

| PR    | Contents                                                                        | Dependencies                    |
| ----- | ------------------------------------------------------------------------------- | ------------------------------- |
| PR-B1 | SlugSchema + branding unification + z.any() fix + POST→201                      | None                            |
| PR-B2 | Pagination (contracts + route handlers + frontend callers)                      | None (can parallel with B1)     |
| PR-B3 | 4 error.tsx files                                                               | None                            |
| PR-A1 | Metrics middleware wiring + health check expansion + process.env centralization | None                            |
| PR-D1 | QueryLimits config + `as any` audit + dead code deletion + enum cleanup         | After B2 (pagination constants) |
