# Enterprise Review: Consolidated Findings Report

**Date:** 2026-02-08
**Reviewers:** Architecture Strategist, Security Sentinel, Performance Oracle, Code Simplicity Reviewer
**Scope:** Full codebase — agent system, dashboard, backend services, frontend stores
**Files Examined:** 130+ files across all workspaces

---

## Executive Summary

| Agent                   | P1 Critical | P2 Important | P3 Nice-to-Have | Total  |
| ----------------------- | ----------- | ------------ | --------------- | ------ |
| Security Sentinel       | 4           | 8            | 5               | 17     |
| Performance Oracle      | 7           | 5            | 4               | 16     |
| Architecture Strategist | 5           | 11           | 7               | 23     |
| **Deduplicated Total**  | **12**      | **18**       | **12**          | **42** |

After deduplication across agents, **42 unique findings** across the codebase.

### Existing Deferred Todos (8)

| ID              | Priority | Status         | Verdict                                                     |
| --------------- | -------- | -------------- | ----------------------------------------------------------- |
| #800            | P1       | **RESOLVED**   | `store_discovery_fact` tool now exists at `discovery.ts:61` |
| #5194           | P2       | Still relevant | No rate limiting on agent-to-backend calls                  |
| #5204           | P2       | Still relevant | AgentPanel 746-line god component                           |
| #807            | P2       | Still relevant | Weak agent repetition prevention                            |
| section-id      | P2       | Theoretical    | Section ID collision risk                                   |
| #576            | P4       | Still relevant | Direct Prisma in routes                                     |
| #599            | P3       | Still relevant | Missing adversarial test scenarios                          |
| structuredClone | P3       | Premature      | structuredClone on hot path                                 |

---

## P1 — Critical (12 findings)

### Security

**SEC-01: CORS allows ALL HTTPS origins in production**

- `server/src/app.ts:139` — Any HTTPS site can make credentialed cross-origin requests
- Combined with `credentials: true`, attacker-controlled domains read tenant data
- **Fix:** Tenant-configured domain allowlist or dedicated widget endpoint

**SEC-02: `constantTimeCompare` leaks secret length (2 files)**

- `server/src/routes/internal.routes.ts:177-188`
- `server/src/routes/metrics.routes.ts:91-101`
- Early return on length mismatch → timing oracle
- **Fix:** Use `crypto.timingSafeEqual` (already correct in `internal-agent.routes.ts`)

**SEC-03: Error messages returned verbatim in 500 responses (3 locations)**

- `tenant-admin-tenant-agent.routes.ts:657,1038`, `internal-agent.routes.ts:2853`
- Prisma/Cloud Run errors leak schema details and service URLs
- **Fix:** Generic response + correlation ID

**SEC-04: Impersonation tokens use 7-day expiry**

- `server/src/services/identity.service.ts:63-68` — code has TODO acknowledging this
- **Fix:** 1-2 hour expiry + `type: 'impersonation'` claim + audit logging

### Performance

**PERF-01: 5 unbounded `findMany` calls violating Pitfall #60**

- `catalog.repository.ts` — `getAllPackages()`, `getAllPackagesWithAddOns()`, `getAllAddOns()` (3 methods)
- `service.repository.ts` — `getAll()`, `getActiveServices()` (2 methods)
- `tenant.repository.ts` — `list()`, `listWithStats()` (admin)
- `project-hub.service.ts` — `getTimeline()` (unbounded event history)
- `audit.service.ts` — `getEntityHistory()` (unbounded audit log)
- **Fix:** Add `take` parameter to all 8 methods

**PERF-02: 4 sequential query chains that should be `Promise.all`**

- `context-builder.service.ts:363-368` — `hasDraft` + `hasPublished` in `getBootstrapData()`
- `context-builder.service.ts:600-601` — `getPageStructure` + `hasDraft` in `buildStorefrontState()`
- **Fix:** Two-line change saving 20-40ms per agent session init

### Architecture

**ARCH-01: ADK client code triplicated across 3 agent services (~540 lines waste)**

- `vertex-agent.service.ts`, `customer-agent.service.ts`, `project-hub-agent.service.ts`
- ADK Zod schemas + `fetchWithTimeout()` + `extractAgentResponse()` + `extractToolCalls()` copy-pasted
- Code simplicity reviewer confirmed all three `extractToolCalls` are functionally identical
- **Fix:** Extract to `server/src/lib/adk-client.ts`

**ARCH-02: Agent services bypass DI container entirely**

- None of the 3 agent communication services registered in `di.ts`
- Instantiated inline in route handlers → untestable, invisible dependencies
- Violates Pitfalls #72, #76
- **Fix:** Register all agent services in Container interface

**ARCH-03: `internal-agent.routes.ts` is 2,895-line monolith**

- 25+ endpoints covering bootstrap, discovery, storefront CRUD, project hub, vocabulary, booking
- Duplicates Zod schemas from contracts, mixes business logic with HTTP handling
- **Fix:** Split into 4-5 domain-specific route files

**ARCH-04: `PageName` type defined in 4 separate locations**

- `packages/contracts/src/landing-page.ts:42` (canonical)
- `server/src/lib/ports.ts:1154` (duplicate)
- `server/src/routes/internal-agent.routes.ts:131` (inline)
- `apps/web/src/stores/agent-ui-store.ts:322` as `validPages` (duplicate)
- **Fix:** Single source in `@macon/contracts`, all others import

**ARCH-05: `guided-refinement.ts` duplicated identically (309 lines x 2)**

- `server/src/types/guided-refinement.ts`
- `server/src/agent-v2/deploy/tenant/src/types/guided-refinement.ts`
- `diff` produces zero output — byte-for-byte identical
- **Fix:** Share from contracts or build-time copy

**ARCH-06a: Multi-page model declared removed but still implemented (Pitfall #90)**

- Deprecated in 3 places (CLAUDE.md, agent-ui-store comments, archived todo #5217)
- Still active in 6 files: `PageSwitcher.tsx`, `toggle-page.ts` (132-line agent tool), `agent-ui-store.ts` (`setPreviewPage`, `currentPage`, `extractPageFromSectionId`), `LivePreview.tsx`
- **BUG:** `toggle-page` tool calls deleted backend route `/storefront/toggle-page` → 500 error
- **Fix:** Complete the removal — delete PageSwitcher, toggle-page tool, currentPage field, extractPageFromSectionId, setPreviewPage action

**ARCH-06b: `AdvisorMemoryRepository` dead port + mock (confirmed zero consumers)**

- `server/src/lib/ports.ts:1031-1069` — port interface, zero imports
- `server/src/adapters/mock/advisor-memory.repository.ts` — 95 lines, zero instantiations
- DI comments confirm: "removed - replaced by ContextBuilderService"
- **Fix:** Delete interface + mock + export statement

---

## P2 — Important (18 findings)

### Security

| ID     | Finding                                                            | File                                      | Fix                                           |
| ------ | ------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------- |
| SEC-05 | Impersonation endpoint lacks dedicated rate limiter                | `auth.routes.ts:818`                      | Add impersonation-specific rate limiter       |
| SEC-06 | Session deletion is a no-op (returns success, session stays alive) | `tenant-admin-tenant-agent.routes.ts:394` | Local blocklist of closed session IDs         |
| SEC-07 | Admin packages uses hardcoded `DEFAULT_TENANT`                     | `admin-packages.routes.ts:7`              | Verify if mounted in prod, add guard          |
| SEC-08 | `publicProjectRateLimiter` missing `isTestEnvironment` bypass      | `public-project.routes.ts:55`             | Add standard bypass (Pitfall #19)             |
| SEC-09 | Input sanitization skipped for ALL internal agent routes           | `app.ts:188-199`                          | Target specific fields, not entire route tree |
| SEC-10 | Password validation: 8 chars only, no complexity                   | `auth.routes.ts:403`                      | Add strength requirements or `zxcvbn`         |
| SEC-11 | Signup reveals email uniqueness via 409                            | `auth.routes.ts:416`                      | Generic response + email to existing user     |
| SEC-12 | CSP allows `unsafe-inline` for scripts                             | `app.ts:67`                               | Nonce-based CSP                               |

### Performance

| ID      | Finding                                               | File                             | Fix                                          |
| ------- | ----------------------------------------------------- | -------------------------------- | -------------------------------------------- |
| PERF-03 | Sequential queries in `confirmChatbotBooking()`       | `booking.service.ts:279-295`     | `Promise.all` for package + add-ons          |
| PERF-04 | Unbounded `Map` in `ReflectAndRetryPlugin`            | `reflect-retry.ts:91`            | Use `lru-cache` with TTL                     |
| PERF-05 | `recentlyBackfilled` Set: max size but no TTL         | `context-builder.service.ts:210` | Replace with `lru-cache` (already installed) |
| PERF-06 | No caching on `findBySlugPublic` tenant lookups       | `tenant.repository.ts`           | LRU cache with 60s TTL                       |
| PERF-07 | Two sequential DB queries on public sections endpoint | `public-tenant.routes.ts:321`    | Cache slug-to-ID mapping                     |

### Architecture

| ID      | Finding                                                   | File                                                     | Fix                                            |
| ------- | --------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| ARCH-06 | DI container 816 LOC with mock/real duplication           | `di.ts`                                                  | Wire services once using adapter interfaces    |
| ARCH-07 | `VertexAgentService` 1,090 LOC doing too much             | `vertex-agent.service.ts`                                | Extract ADK client, keep thin orchestrator     |
| ARCH-08 | `ProjectHubAgentService` module-level singleton           | `project-hub-agent.service.ts:506`                       | Pitfall #13, #78 — use DI container            |
| ARCH-09 | `ContextBuilderService` created in 3 locations without DI | `routes/index.ts:704,775`, `vertex-agent.service.ts:210` | Register once in container                     |
| ARCH-10 | Internal agent routes bypass ts-rest contracts            | `internal-agent.routes.ts`                               | Evaluate ts-rest adoption for type-safe client |

---

## P3 — Nice-to-Have (12 findings)

| ID      | Finding                                                     | File                                      |
| ------- | ----------------------------------------------------------- | ----------------------------------------- |
| SEC-13  | Dev routes guarded by ADAPTERS_PRESET but not NODE_ENV      | `app.ts:310`                              |
| SEC-14  | Stripe Connect webhooks missing idempotency check           | `stripe-connect-webhooks.routes.ts`       |
| SEC-15  | Metrics path normalization misses CUIDs (only UUIDs)        | `metrics.routes.ts:230`                   |
| SEC-16  | No audit trail for impersonation actions                    | `auth.routes.ts`                          |
| PERF-08 | `ComingSoonDisplay` subscribes to object reference          | `ComingSoonDisplay.tsx:131`               |
| PERF-09 | Layout component has 10 separate store subscriptions        | `layout.tsx:67-77`                        |
| PERF-10 | Only 1 component uses `useShallow` (codebase-wide)          | Multiple files                            |
| ARCH-11 | Deprecated multi-page model artifacts (4 locations)         | `agent-ui-store.ts`                       |
| ARCH-12 | `selectProgress` deprecated but still exported              | `refinement-store.ts:353`                 |
| ARCH-13 | Dead `AdvisorMemoryRepository` port + mock                  | `ports.ts:1031`, mock adapter             |
| ARCH-14 | `callMaisApi` duplicated in tenant + customer agent deploys | `deploy/*/src/utils.ts`                   |
| ARCH-15 | `BlockType` redefined locally in tenant agent deploy        | `deploy/tenant/src/context-builder.ts:23` |

---

## Refactoring Roadmap

### Sprint 1: Critical Security + Quick Performance Wins + Legacy Cleanup (1-2 days)

1. **Fix CORS** — tenant-configured allowlist (SEC-01)
2. **Replace `constantTimeCompare`** with `crypto.timingSafeEqual` in 2 files (SEC-02)
3. **Sanitize 500 responses** — generic message + correlation ID in 3 locations (SEC-03)
4. **Shorten impersonation token** to 2h expiry (SEC-04)
5. **`Promise.all` in context builder** — two-line fix, 20-40ms per session (PERF-02)
6. **Add `take` to unbounded queries** — 8 methods across 5 files (PERF-01)
7. **Complete multi-page model removal** — delete PageSwitcher, toggle-page tool, deprecated store artifacts (ARCH-06a) — **BUG: tool calls deleted route**
8. **Delete AdvisorMemory dead code** — port interface + mock adapter (ARCH-06b)

### Sprint 2: Extract ADK Client + DI Wiring (2-3 days)

7. **Create `adk-client.ts`** — extract shared schemas + parsing (ARCH-01)
8. **Register agent services in DI** — `VertexAgentService`, `CustomerAgentService`, `ProjectHubAgentService`, `ContextBuilderService` (ARCH-02, ARCH-08, ARCH-09)
9. **Remove module-level singleton** in `ProjectHubAgentService` (ARCH-08)
10. **Consolidate `PageName`** to single source in contracts (ARCH-04)

### Sprint 3: Route Splitting + Contract Adoption (3-5 days)

11. **Split `internal-agent.routes.ts`** into domain-specific files (ARCH-03)
12. **Move Zod schemas to contracts** from inline route definitions
13. **Evaluate ts-rest** for internal agent endpoints (ARCH-10)

### Sprint 4: Dead Code Purge + Polish (2-3 days)

14. **Delete ~3,000 lines of dead frontend code:**
    - `offline-storage.ts` (765 LOC, zero imports)
    - `MicroInteraction.tsx` (338 LOC, zero imports)
    - `PressableButton.tsx` (154 LOC, zero imports)
    - `BottomNavigation.tsx`, `MobileBottomLayerProvider.tsx`, `ViewportProvider.tsx` (zero imports)
    - `parseHighlights.ts`, `SkeletonGallery.tsx`, `SkeletonList.tsx` (zero imports)
    - `build-mode/config.ts`, `build-mode/navigation.ts` (~100 LOC, zero imports)
15. **Delete ~870 lines of dead llm/ module** — `pricing.ts`, `retry.ts`, `message-adapter.ts`, `errors.ts` (only `getVertexClient` from `vertex-client.ts` still used)
16. **Delete ~770 lines of dead agent-v2 internals:**
    - `IsolatedMemoryBank` (244 LOC, all TODO stubs)
    - `ReflectAndRetryPlugin` (280 LOC, never imported by agents)
    - `agent-v2/shared/` modules (test-only, not production code)
    - `agent-v2/index.ts` barrel (never imported by server)
17. **Remove deprecated store artifacts** — `selectProgress`, multi-page model remnants already handled in Sprint 1 (ARCH-11-12)
18. **Add slug-to-tenant LRU cache** (PERF-06)
19. **Security hardening** — impersonation rate limiter, password strength, email enumeration (SEC-05-12)
20. **Adopt `useShallow`** across Zustand selectors (PERF-10)
21. **Clean up stale TODO comments** — TODO-708, TODO-329, TODO-278, TODO-154 reference completed work

### Future: Agent Deploy Shared Package

22. **Create `@macon/agent-shared`** workspace package for `callMaisApi`, `callBackendAPI`, `guided-refinement.ts`, `BlockType` (ARCH-05, ARCH-14, ARCH-15)

---

## Positive Observations

The review identified many strong practices already in place:

1. **Consistent tenant scoping** in all Prisma repositories
2. **Zod validation** on inputs throughout route handlers
3. **Rate limiting** coverage across auth, agent, and public endpoints
4. **Webhook signature verification** and idempotency (main webhook handler)
5. **Advisory locks** for double-booking prevention
6. **Password reset** uses hashed tokens with 1-hour expiry
7. **Helmet security headers** configured (HSTS, referrer policy, CSP)
8. **Honeypot bot protection** on booking endpoints
9. **Nested impersonation prevention** in auth flow
10. **Section Blueprint** pattern as single source of truth (recent dashboard rebuild)
11. **ViewState discriminated union** with exhaustive `never` check

---

## Recommendation

**Run `/workflows:plan` on Sprint 1** (Critical Security + Quick Performance Wins).

Rationale: Sprint 1 contains 6 items that are all low-risk, well-scoped, and high-impact. The security fixes (CORS, timing comparison, error leakage, impersonation expiry) address real vulnerabilities. The performance fixes (`Promise.all`, `take` parameters) are mechanical changes with clear patterns. This sprint alone would resolve 10+ findings in 1-2 days and immediately improve the security posture.

Sprint 2 (ADK Client + DI) is the highest-leverage architectural change — eliminating ~540 lines of duplication and making agent services testable — but requires more careful planning to avoid regressions.
