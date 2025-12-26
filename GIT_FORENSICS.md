# GIT_FORENSICS.md

**Generated:** 2025-12-26
**Repository:** MAIS (Macon AI Solutions)
**Total Commits Analyzed:** 524+ commits
**Contributors:** 1 (mikeyoung304)
**Analysis Period:** October 2025 - December 2025 (primary development window)

---

## 1. Change Heatmap (Top Churn Files/Directories)

### Top 20 Most Modified Files (with commit counts)

| Rank | File | Commits | Category |
|------|------|---------|----------|
| 1 | `server/src/routes/index.ts` | 38 | Route aggregation |
| 2 | `packages/contracts/src/dto.ts` | 35 | API contracts |
| 3 | `server/src/di.ts` | 34 | Dependency injection |
| 4 | `packages/contracts/src/api.v1.ts` | 32 | API contract definitions |
| 5 | `server/src/lib/ports.ts` | 29 | Repository interfaces |
| 6 | `server/src/adapters/prisma/catalog.repository.ts` | 28 | Catalog data access |
| 7 | `server/prisma/schema.prisma` | 28 | Database schema |
| 8 | `server/src/adapters/mock/index.ts` | 27 | Mock implementations |
| 9 | `server/src/app.ts` | 26 | Express app configuration |
| 10 | `client/src/pages/Home/HeroSection.tsx` | 26 | Landing page hero |
| 11 | `server/src/routes/tenant-admin.routes.ts` | 24 | Tenant admin API |
| 12 | `package-lock.json` | 24 | Dependencies |
| 13 | `server/src/adapters/prisma/booking.repository.ts` | 23 | Booking data access |
| 14 | `server/package.json` | 23 | Server dependencies |
| 15 | `README.md` | 22 | Project documentation |
| 16 | `packages/contracts/tsconfig.tsbuildinfo` | 22 | Build artifacts |
| 17 | `server/src/services/booking.service.ts` | 21 | Booking business logic |
| 18 | `CLAUDE.md` | 21 | AI assistant instructions |
| 19 | `server/src/routes/webhooks.routes.ts` | 17 | Stripe webhooks |
| 20 | `server/src/middleware/rateLimiter.ts` | 17 | Rate limiting |

### Hot Directories (by total file changes)

| Rank | Directory | File Changes | Purpose |
|------|-----------|--------------|---------|
| 1 | `client/src` | 1,558 | Legacy Vite SPA admin |
| 2 | `docs/archive` | 842 | Historical documentation |
| 3 | `server/src` | 794 | Express API server |
| 4 | `docs/solutions` | 442 | Problem-solution documentation |
| 5 | `apps/web` | 331 | Next.js storefronts (NEW) |
| 6 | `server/test` | 324 | Test files |
| 7 | `apps/api` | 158 | API app (deprecated?) |
| 8 | `packages/contracts` | 132 | ts-rest API contracts |
| 9 | `server/prisma` | 106 | Database schema & migrations |
| 10 | `.github/workflows` | 49 | CI/CD pipelines |

### Analysis

- **Contracts & DI are central:** `dto.ts`, `api.v1.ts`, `ports.ts`, and `di.ts` form the core architecture - changes here cascade
- **Booking is complex:** `booking.service.ts` and `booking.repository.ts` have high churn due to double-booking prevention
- **Landing page iteration:** `HeroSection.tsx` shows marketing/copy refinement (26 commits)
- **Next.js migration active:** `apps/web` is a newer directory with 331 file changes, indicating rapid development

---

## 2. Decision Timeline with Commit References

### Major Architecture Decisions

| Date | Commit | Decision | Impact |
|------|--------|----------|--------|
| 2025-10-23 | `3264a2a` | Hexagonal to layered architecture | Simplified structure, clearer boundaries |
| 2025-10-29 | `77783dc` | Webhook error handling + race condition prevention | Added dead letter queue pattern |
| 2025-11-06 | `d0a6f9f` | Multi-tenant Phase 1 foundation | Database schema + core services + middleware |
| 2025-11-06 | `efda74b` | Complete Phase 1 with critical security fix | Tenant isolation hardened |
| 2025-11-07 | `9e68ab4` | Login rate limiting implementation | Security hardening |
| 2025-11-15 | `fdf69c9` | TypeScript safety + database optimization | Type system improvements |
| 2025-11-22 | `a246124` | **Advisory locks over SELECT FOR UPDATE** | Fixed P2034 deadlocks |
| 2025-11-22 | `f772fb7` | Platform admin impersonation feature | Multi-tenant admin tooling |
| 2025-11-25 | `d992052` | Tenant self-signup backend | Onboarding flow |
| 2025-11-27 | `862a324` | Acuity-like scheduling platform | Major feature addition |
| 2025-12-02 | `417b8c0` | **ts-rest `any` type documentation** | Library limitation documented |
| 2025-12-06 | `546eb97` | Early-access waitlist persistence | Pre-launch feature |
| 2025-12-16 | `d93c2fe` | **Next.js App Router migration begins** | SSR tenant storefronts |
| 2025-12-20 | `591ea50` | NextAuth.js v5 integration | Authentication migration |
| 2025-12-23 | `fc4201f` | BullMQ async webhook processing | Scalability improvement |
| 2025-12-24 | `ff904bc` | Date booking wizard with security hardening | Booking flow completion |
| 2025-12-25 | `f68e9f5` | Multi-page tenant sites | Locked template system |

### Multi-Tenant Implementation Timeline

| Date | Commit | Milestone |
|------|--------|-----------|
| 2025-11-06 | `d0a6f9f` | Phase 1 foundation - database schema, core services, middleware |
| 2025-11-06 | `efda74b` | Phase 1 complete with critical security fix |
| 2025-11-22 | `b502bee` | Add tenantId to Payment model (cross-tenant data leakage fix) |
| 2025-11-22 | `9e76bf7` | Segment repository cross-tenant isolation |
| 2025-12-06 | `1c84391` | Parallel TODO resolution (16 TODOs including tenant fixes) |
| 2025-12-25 | `7894417` | TOCTOU fix: Add tenantId to all update/delete WHERE clauses |

### Next.js Migration Timeline (ADR-014)

| Date | Commit | Phase |
|------|--------|-------|
| 2025-12-16 | `d93c2fe` | Phase 1: Add Next.js app for SSR tenant websites |
| 2025-12-17 | `c3068ce` | Phase 2: Connect tenant landing page to real API |
| 2025-12-18 | `030602f` | Phase 3: Admin dashboard foundation |
| 2025-12-19 | `a6b286d` | Phase 4: Tenant admin pages and auth flows |
| 2025-12-20 | `591ea50` | Phase 5: NextAuth.js v5 integration |
| 2025-12-21 | `4eaf68d` | Phase 6: Booking flow for tenant storefronts |
| 2025-12-22 | `b303bd9` | Custom domain support |
| 2025-12-22 | `15321a6` | ISR revalidation, sitemap, robots.txt |
| 2025-12-25 | `f68e9f5` | Multi-page tenant sites with navigation |
| 2025-12-25 | `a659b76` | Page Management UI with section editors |

### API Contract Evolution

| Date | Commit | Change |
|------|--------|--------|
| 2025-11-15 | `fdf69c9` | TypeScript safety improvements |
| 2025-12-03 | `a3b9f59` | Add-on CRUD routes with code review fixes |
| 2025-12-06 | `1c84391` | Resolve 16 TODOs including API contract fixes |
| 2025-12-16 | `0cbe2dc` | DATE booking type flow for wedding packages |
| 2025-12-23 | `fc4201f` | BullMQ async processing + price validation |
| 2025-12-25 | `29062a7` | Add tier field to PackageDtoSchema |

### Security Hardening Commits

| Date | Commit | Fix |
|------|--------|-----|
| 2025-11-07 | `9e68ab4` | Login rate limiting |
| 2025-11-22 | `b502bee` | Add tenantId to Payment model |
| 2025-11-22 | `9e76bf7` | Segment repository cross-tenant isolation |
| 2025-11-28 | `d531964` | Sanitize webhook error logging (PII exposure) |
| 2025-11-30 | `d7804c5` | P2 security & validation fixes (8 issues) |
| 2025-12-06 | `b787c49` | P1/P2 early-access vulnerabilities |
| 2025-12-20 | `ce6443d` | Harden DATE booking flow |
| 2025-12-23 | `482a2e7` | File upload size, ARIA labels, token validation |
| 2025-12-24 | `ff904bc` | Date booking wizard with security hardening |
| 2025-12-25 | `7894417` | TOCTOU fix for update/delete methods |

---

## 3. "Weird but Justified" List

### 3.1 ts-rest Route Handlers Use `{ req: any }` (Commit `417b8c0`)

**Pattern:** Route handlers in `server/src/routes/*.routes.ts` use `{ req: any }` type.

**Justification:** ts-rest has type compatibility issues with Express 4.x/5.x. This is a library limitation, not a code smell. Documented in `docs/solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md`.

**Do NOT:** Remove these `any` types or "fix" them - it will break builds.

### 3.2 Advisory Locks Over SELECT FOR UPDATE (Commit `a246124`)

**Pattern:** `pg_advisory_xact_lock()` instead of `SELECT FOR UPDATE`.

**Justification:** SELECT FOR UPDATE caused P2034 deadlocks under concurrent booking attempts. Advisory locks provide serialization without row-level locking conflicts. See ADR-013.

**History:**
- Initial: Used optimistic locking
- Problem: Deadlocks under high concurrency
- Solution: PostgreSQL advisory locks with transaction-scoped release

### 3.3 Hybrid Migration System (Prisma + Raw SQL)

**Pattern:** Two migration patterns coexist - Prisma migrations for tables/columns, manual SQL for enums/indexes/RLS.

**Justification:** Prisma cannot handle all PostgreSQL features (enums, RLS policies, custom indexes). The hybrid approach uses each tool where it excels.

**Key Files:**
- Prisma migrations: `server/prisma/migrations/`
- Manual migrations: Same folder, but `.sql` files applied separately
- Documentation: `docs/solutions/SCHEMA_DRIFT_PREVENTION.md`

### 3.4 Dual Routing Pattern in Next.js (`/t/[slug]` and `/t/_domain`)

**Pattern:** Tenant storefronts exist at both `/t/[slug]/...` and `/t/_domain/...`.

**Justification:** Custom domain support requires a parallel route structure. `_domain` routes handle requests when middleware resolves a custom domain (e.g., `photography.example.com`). See ADR-014.

**Middleware Flow:**
1. Request to `photography.example.com`
2. Middleware looks up domain in database
3. Rewrites to `/t/_domain/...` with tenant context

### 3.5 Mock Adapter Has 170+ Lines of Hardcoded Data (Commit `7894417`)

**Pattern:** `server/src/adapters/mock/index.ts` contains substantial inline test data.

**Justification:** Mock-first development strategy (ADR-007). The mock adapter provides a complete in-memory implementation for development and testing without external dependencies.

### 3.6 Defense-in-Depth Validation (Won't Fix from Review 415)

**Pattern:** Zod validation occurs at both API boundary AND in service/repository layers.

**Justification:** Intentional defense-in-depth. Review finding 415 suggested consolidation, but the team marked it "won't fix" - industry standard is to validate at multiple layers for security.

---

## 4. "Safe Refactor Zones" List

### 4.1 Core Library (`server/src/lib/core/`)

**Status:** Stable (15 total commits, minimal recent changes)
**Last Major Change:** `7c13fe0` (2025-11-30) - Architecture logging fixes
**Test Coverage:** Good - config, logger, events well-tested
**Safe Operations:**
- Adding new utilities
- Extending logger functionality
- Adding event types

### 4.2 Legacy Client Features (`client/src/features/`)

**Status:** Stable but declining (20 commits in last 3 months)
**Context:** Legacy Vite SPA being replaced by Next.js
**Safe Operations:**
- Bug fixes only
- No new features (invest in `apps/web` instead)
- UI polish acceptable

### 4.3 Test Fixtures (`server/test/fixtures/`)

**Status:** Very stable
**Safe Operations:**
- Adding new fixtures
- Updating existing fixtures for new test cases
- No risk of production impact

### 4.4 Documentation (`docs/`)

**Status:** Actively maintained but low-risk
**Safe Operations:**
- Adding new guides
- Updating ADRs
- Archiving old documentation

### 4.5 Seed Data (`server/prisma/seeds/`)

**Status:** Stable with clear patterns
**Recent Addition:** `plate.ts` (2025-12-25) - new tenant seed
**Safe Operations:**
- Adding new tenant seeds following existing patterns
- Updating existing seeds with guard clauses

### 4.6 Shared Package (`packages/shared/`)

**Status:** Very stable (37 total changes, minimal recent activity)
**Safe Operations:**
- Adding new utilities
- Type definitions

---

## 5. "Do-Not-Touch Casually" List

### 5.1 Payment/Stripe Integration (CRITICAL)

**Files:**
- `server/src/adapters/stripe.adapter.ts`
- `server/src/routes/webhooks.routes.ts`
- `server/src/routes/stripe-connect-webhooks.routes.ts`
- `packages/contracts/src/stripe-connect.ts`

**History:** 10+ commits fixing webhook idempotency, race conditions, and error handling

**Critical Commits:**
- `8b08443` - Webhook idempotency race condition fix
- `fc4201f` - BullMQ async processing
- `d531964` - Sanitize webhook error logging (PII exposure)

**Rules:**
- ALWAYS maintain idempotency checks
- NEVER log full event payloads (PII)
- Test with `stripe listen --forward-to` before merging

### 5.2 Auth/Security Middleware (CRITICAL)

**Files:**
- `server/src/middleware/tenant.ts` (6 commits)
- `server/src/middleware/auth.ts`
- `server/src/middleware/rateLimiter.ts` (17 commits)
- `apps/web/src/lib/auth.ts`

**Critical Commits:**
- `efda74b` - Critical security fix in tenant isolation
- `9e68ab4` - Login rate limiting
- `591ea50` - NextAuth.js v5 integration

**Rules:**
- NEVER bypass tenant validation
- Rate limiter has IPv6 quirks (commit `4e6dcd8`)
- Test auth changes with E2E tests

### 5.3 Database Migrations (CRITICAL)

**Files:**
- `server/prisma/schema.prisma` (28 commits!)
- `server/prisma/migrations/`

**Critical Commits:**
- `8cbfa6c` - Consolidate Prisma migrations to fix schema drift
- `5114e8b` - Resolve schema drift with scheduling platform
- `f03e69d` - Skip destructive 00_supabase_reset.sql

**Rules:**
- NEVER modify applied migrations
- Use hybrid pattern (see section 3.3)
- Always `prisma generate` after schema changes
- Test migrations on dev before CI

### 5.4 Multi-Tenant Isolation Logic (CRITICAL)

**Files:**
- `server/src/lib/ports.ts` (29 commits)
- `server/src/adapters/prisma/*.repository.ts`
- Any query with `tenantId` filtering

**Critical Commits:**
- `d0a6f9f` - Phase 1 foundation
- `b502bee` - Add tenantId to Payment model
- `9e76bf7` - Segment repository isolation
- `7894417` - TOCTOU fix for update/delete

**Rules:**
- ALL queries MUST filter by `tenantId`
- ALL cache keys MUST include `tenantId`
- Repository methods REQUIRE `tenantId` as first parameter

### 5.5 Core Booking Logic (CRITICAL)

**Files:**
- `server/src/services/booking.service.ts` (21 commits)
- `server/src/services/availability.service.ts`
- `server/src/adapters/prisma/booking.repository.ts` (23 commits)

**Critical Commits:**
- `a246124` - Advisory locks for race condition
- `ce6443d` - Harden DATE booking flow
- `ff904bc` - Date booking wizard with security hardening
- `c95477d` - Resolve 8 code review findings

**Rules:**
- ALWAYS use advisory locks for booking creation
- Wrap availability check + booking in same transaction
- Test double-booking prevention before any changes

### 5.6 Dependency Injection Container (HIGH RISK)

**Files:**
- `server/src/di.ts` (34 commits - highest churn!)

**Context:** All service wiring happens here based on `ADAPTERS_PRESET`

**Rules:**
- Changes cascade to ALL services
- Test both mock and real presets
- Update mock adapters when adding new services

### 5.7 API Contracts (HIGH RISK)

**Files:**
- `packages/contracts/src/dto.ts` (35 commits)
- `packages/contracts/src/api.v1.ts` (32 commits)

**Rules:**
- Breaking changes require frontend coordination
- Use Zod schema evolution patterns
- Run `npm run typecheck` across all workspaces

### 5.8 CI/CD Workflows (CAUTION)

**Files:**
- `.github/workflows/main-pipeline.yml` (18 commits)
- `.github/workflows/deploy-production.yml` (14 commits)

**Context:** 20+ CI fixes in December 2025 alone (commits `8c04b7c` through `f03e69d`)

**Known Issues:**
- Migration order matters (commit `4715322`)
- Manual SQL migrations run separately (commit `3ac8fb0`)
- DIRECT_URL required for Prisma (commit `cd330e8`)

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total commits analyzed | 524+ |
| Contributors | 1 |
| Most modified file | `server/src/routes/index.ts` (38 commits) |
| Highest churn directory | `client/src` (1,558 file changes) |
| ADRs documented | 14 |
| Security-related commits | 20+ |
| Multi-tenant isolation commits | 10+ |
| Next.js migration commits | 25+ |
| CI/CD fix commits | 20+ |

---

## Recommendations

1. **Before touching booking logic:** Read ADR-013 (advisory locks) and test double-booking prevention
2. **Before modifying contracts:** Run `npm run typecheck` across all workspaces
3. **Before CI changes:** Review the December 2025 fix history (`8c04b7c` - `f03e69d`)
4. **Before auth changes:** Test with E2E and verify tenant isolation
5. **When in doubt:** Check if there's an ADR or prevention strategy document

---

*This report was generated through git forensics analysis. For the most current state, always consult the git history directly.*
