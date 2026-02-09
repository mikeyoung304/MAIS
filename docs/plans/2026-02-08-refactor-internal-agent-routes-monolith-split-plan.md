---
title: 'refactor: Split internal-agent.routes.ts monolith into domain-based route files'
type: refactor
date: 2026-02-08
todo: '#5241'
branch: refactor/enterprise-review-sprint5
---

# refactor: Split internal-agent.routes.ts monolith into domain-based route files

## Overview

`server/src/routes/internal-agent.routes.ts` is a 2,889-line monolith containing **41 endpoints**, **34 inline Zod schemas**, and multiple caches/helpers. It is the largest non-generated source file in the codebase and any change to agent-backend communication requires navigating ~3000 lines.

This plan splits it into **5 domain route files** + **1 shared module** + **1 thin aggregator**, following the existing factory-function pattern used by `tenant-admin-*.routes.ts` files.

**Constraints:**

- Zero API changes — same paths, same behavior, pure restructuring
- No domain file exceeds 800 LOC
- Zod schemas stay with the domain that owns them (no contracts migration)
- `internal-agent-health.routes.ts` is untouched
- Clean typecheck required before commit

## Problem Statement

| Metric                  | Current                                            | Target                                  |
| ----------------------- | -------------------------------------------------- | --------------------------------------- |
| Files                   | 1                                                  | 7 (5 domains + 1 shared + 1 aggregator) |
| Largest file            | 2,889 LOC                                          | <800 LOC                                |
| Endpoints per file      | 41                                                 | 4-13                                    |
| Shared code duplication | `verifyInternalSecret` duplicated in health routes | Single shared module                    |

## Architecture: Domain Assignment

Research revealed **41 endpoints** (not the originally estimated 25+), grouping naturally into **5 domains**:

### Domain 1: Discovery (6 endpoints, ~450 LOC)

| Endpoint                      | Lines   | Purpose                             |
| ----------------------------- | ------- | ----------------------------------- |
| `POST /bootstrap`             | 377-463 | Session bootstrap with slot machine |
| `POST /mark-greeted`          | 474-490 | Mark session greeted                |
| `POST /complete-onboarding`   | 503-576 | Complete onboarding flow            |
| `POST /mark-reveal-completed` | 584-611 | Mark reveal as completed            |
| `POST /store-discovery-fact`  | 637-708 | Store discovery fact                |
| `POST /get-discovery-facts`   | 715-746 | Get discovery facts                 |

**Schemas:** `BootstrapRequestSchema`, `MarkGreetedSchema`, `CompleteOnboardingSchema`, `StoreDiscoveryFactSchema`, `DISCOVERY_FACT_KEYS`
**Caches:** `bootstrapCache` (LRU, 1000 entries, 30min TTL), `greetedSessionsCache` (LRU, 5000 entries, 1hr TTL)
**Helpers:** `invalidateBootstrapCache()`, `buildGreetingKey()`, `hasSessionBeenGreeted()`, `markSessionGreeted()`
**Dependencies:** `tenantRepo`, `contextBuilder`, `catalogService`, `computeSlotMachine`

### Domain 2: Storefront (12 endpoints, ~650 LOC)

| Endpoint                            | Lines     | Purpose                |
| ----------------------------------- | --------- | ---------------------- |
| `POST /storefront/structure`        | 1157-1217 | Get page structure     |
| `POST /storefront/section`          | 1222-1252 | Get section content    |
| `POST /storefront/update-section`   | 1257-1295 | Update section         |
| `POST /storefront/add-section`      | 1300-1346 | Add new section        |
| `POST /storefront/remove-section`   | 1351-1382 | Remove section         |
| `POST /storefront/reorder-sections` | 1387-1417 | Reorder sections       |
| `POST /storefront/update-branding`  | 1424-1463 | Update branding        |
| `POST /storefront/preview`          | 1468-1493 | Preview storefront     |
| `POST /storefront/publish`          | 1498-1551 | Publish all sections   |
| `POST /storefront/discard`          | 1556-1604 | Discard all drafts     |
| `POST /storefront/publish-section`  | 1613-1659 | Publish single section |
| `POST /storefront/discard-section`  | 1662-1723 | Discard single section |

**Schemas:** `GetPageStructureSchema`, `GetSectionContentSchema`, `UpdateSectionSchema`, `AddSectionSchema`, `RemoveSectionSchema`, `ReorderSectionsSchema`, `UpdateBrandingSchema`, `PublishSectionSchema`, `DiscardSectionSchema`, `PAGE_NAMES`, `SECTION_TYPES`
**Dependencies:** `sectionContentService`, `tenantRepo`

> **Why not include `generate-variants` and `manage-packages`?** Including them would push this file to ~890 LOC, exceeding the 800 LOC limit. `generate-variants` uses Vertex AI (like the marketing endpoints) and `manage-packages` is a 177-line endpoint that has a distinct concern (catalog management vs. section editing). Both fit better in the marketing domain file.

### Domain 3: Marketing & Generation (5 endpoints + vocabulary, ~650 LOC)

| Endpoint                                       | Lines     | Purpose                               |
| ---------------------------------------------- | --------- | ------------------------------------- |
| `POST /storefront/generate-variants`           | 1808-1931 | Generate section variants (Vertex AI) |
| `POST /marketing/generate-headline`            | 2104-2137 | Generate headline                     |
| `POST /marketing/generate-tagline`             | 2140-2172 | Generate tagline                      |
| `POST /marketing/generate-service-description` | 2175-2211 | Generate service description          |
| `POST /marketing/refine-copy`                  | 2214-2247 | Refine marketing copy                 |
| `POST /manage-packages`                        | 2619-2796 | Manage service packages               |
| `POST /vocabulary/resolve`                     | 2554-2583 | Resolve vocabulary to BlockType       |

**Rationale for grouping:** These endpoints share a common thread — they are **content generation/management tools** for the tenant agent. `generate-variants` uses the same Vertex AI infrastructure as the marketing endpoints. `manage-packages` is catalog setup (tenant-facing, not customer-facing booking). `vocabulary/resolve` is a small (30-line) resolver that maps vocabulary to storefront section types — too small for its own file, closest affinity to content generation.

**Schemas:** `GenerateSectionVariantsSchema`, `GenerateHeadlineSchema`, `GenerateTaglineSchema`, `GenerateServiceDescriptionSchema`, `RefineCopySchema`, `ManagePackagesSchema`, `ResolveVocabularySchema`, `TONE_VARIANTS`
**Caches:** `variantGenerationRateLimit` (LRU, 1000 entries, 1min TTL)
**Helpers:** `buildVariantGenerationPrompt()`, `buildMarketingPrompt()`, `generateMarketingContent()`, `getVertexModule()` (lazy Vertex AI import)
**Dependencies:** `tenantRepo`, `catalogService`, `vocabularyEmbeddingService`, Vertex AI (lazy import)

### Domain 4: Booking (7 endpoints, ~460 LOC)

| Endpoint                | Lines     | Purpose                 |
| ----------------------- | --------- | ----------------------- |
| `POST /services`        | 752-785   | List available services |
| `POST /service-details` | 791-831   | Get service details     |
| `POST /availability`    | 837-903   | Check availability      |
| `POST /business-info`   | 909-944   | Get business info       |
| `POST /faq`             | 950-1012  | Answer FAQ              |
| `POST /recommend`       | 1018-1086 | Recommend package       |
| `POST /create-booking`  | 1092-1148 | Create booking          |

**Schemas:** `GetServicesSchema`, `GetServiceDetailsSchema`, `CheckAvailabilitySchema`, `AnswerFaqSchema`, `RecommendPackageSchema`, `CreateBookingSchema`
**Dependencies:** `catalogService`, `schedulingAvailabilityService`, `bookingService`, `tenantRepo`, `serviceRepo`

> **`/business-info` and `/faq`** are customer-agent endpoints (service discovery context). They retrieve tenant metadata for the customer-facing booking flow, so they belong in Booking, not Discovery.

### Domain 5: Project Hub (9 endpoints, ~300 LOC)

| Endpoint                               | Lines     | Purpose                    |
| -------------------------------------- | --------- | -------------------------- |
| `POST /project-hub/bootstrap-customer` | 2307-2327 | Customer project bootstrap |
| `POST /project-hub/bootstrap-tenant`   | 2330-2350 | Tenant project bootstrap   |
| `POST /project-hub/project-details`    | 2353-2373 | Get project details        |
| `POST /project-hub/timeline`           | 2376-2396 | Get project timeline       |
| `POST /project-hub/pending-requests`   | 2399-2423 | List pending requests      |
| `POST /project-hub/create-request`     | 2426-2453 | Create request             |
| `POST /project-hub/approve-request`    | 2456-2482 | Approve request            |
| `POST /project-hub/deny-request`       | 2485-2512 | Deny request               |
| `POST /project-hub/list-projects`      | 2515-2540 | List all projects          |

**Schemas:** `ProjectHubBootstrapCustomerSchema`, `ProjectHubGetProjectSchema`, `ProjectHubGetTimelineSchema`, `ProjectHubCreateRequestSchema`, `ProjectHubHandleRequestSchema`, `ProjectHubDenyRequestSchema`, `ProjectHubListProjectsSchema`, `PROJECT_REQUEST_TYPES`
**Dead code:** `_ProjectHubAddNoteSchema` (prefixed `_`, unused) — delete during split
**Dependencies:** `projectHubService` (only dependency)

### Shared Module

**File:** `internal-agent-shared.ts` (~80 LOC)

Extracts code currently duplicated or shared across all domains:

| Export                              | Current Location | Used By                                           |
| ----------------------------------- | ---------------- | ------------------------------------------------- |
| `verifyInternalSecret` middleware   | Lines 274-298    | All domain routers                                |
| `handleError(res, error, endpoint)` | Lines 2808-2848  | All domain routers                                |
| `TenantIdSchema`                    | Lines 81-83      | Discovery, Storefront, Marketing, Booking         |
| `InternalAgentRoutesDeps` interface | Lines 231-242    | Aggregator (split into per-domain sub-interfaces) |

> **Bonus fix:** The health routes file has its own `verifyInternalSecret` that does NOT use `timingSafeCompare`. Once the shared module exists, import from there — but that is out of scope for this PR (health routes are untouched per constraints).

## File Structure

```
server/src/routes/
├── internal-agent.routes.ts                  # Thin aggregator (<100 LOC)
├── internal-agent-shared.ts                  # Shared middleware + helpers (~80 LOC)
├── internal-agent-discovery.routes.ts        # Bootstrap, facts, onboarding (~450 LOC)
├── internal-agent-storefront.routes.ts       # Section CRUD, publish/discard (~650 LOC)
├── internal-agent-marketing.routes.ts        # Variants, copy gen, packages, vocab (~650 LOC)
├── internal-agent-booking.routes.ts          # Services, availability, booking (~460 LOC)
├── internal-agent-project-hub.routes.ts      # Project CRUD, timeline, requests (~300 LOC)
├── internal-agent-health.routes.ts           # UNTOUCHED (existing, 176 LOC)
└── index.ts                                  # Registration unchanged
```

**Estimated total:** ~2,690 LOC across 7 files (vs 2,889 in monolith — delta is dead code removal + deduplication of `handleError`/`TenantIdSchema`)

## Implementation Phases

### Phase 1: Create shared module (`internal-agent-shared.ts`)

1. Extract `verifyInternalSecret` middleware (with `timingSafeCompare`)
2. Extract `handleError` helper
3. Extract `TenantIdSchema`
4. Define per-domain dependency interfaces:

```typescript
// internal-agent-shared.ts

export interface DiscoveryRoutesDeps {
  tenantRepo: PrismaTenantRepository;
  contextBuilder: ContextBuilderService;
  catalogService: CatalogService;
  internalApiSecret?: string;
}

export interface StorefrontRoutesDeps {
  sectionContentService: SectionContentService;
  tenantRepo: PrismaTenantRepository;
  internalApiSecret?: string;
}

export interface MarketingRoutesDeps {
  tenantRepo: PrismaTenantRepository;
  catalogService: CatalogService;
  vocabularyEmbeddingService?: VocabularyEmbeddingService;
  internalApiSecret?: string;
}

export interface BookingRoutesDeps {
  catalogService: CatalogService;
  schedulingAvailabilityService: SchedulingAvailabilityService;
  bookingService: BookingService;
  tenantRepo: PrismaTenantRepository;
  serviceRepo: ServiceRepository;
  internalApiSecret?: string;
}

export interface ProjectHubRoutesDeps {
  projectHubService: ProjectHubService;
  internalApiSecret?: string;
}

// Union for the aggregator
export type InternalAgentRoutesDeps = DiscoveryRoutesDeps &
  StorefrontRoutesDeps &
  MarketingRoutesDeps &
  BookingRoutesDeps &
  ProjectHubRoutesDeps;
```

### Phase 2: Extract domain route files (one at a time, test after each)

**Order matters** — start with the simplest domain to establish the pattern:

1. **Project Hub** (~300 LOC, single dependency) — easiest, establishes pattern
2. **Booking** (~460 LOC) — no caches, no lazy imports
3. **Discovery** (~450 LOC) — has caches but no Vertex AI
4. **Storefront** (~650 LOC) — largest domain, section CRUD
5. **Marketing** (~650 LOC) — has Vertex AI lazy imports, rate limiter

Each extraction follows this template:

```typescript
// internal-agent-{domain}.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import { verifyInternalSecret, handleError, TenantIdSchema } from './internal-agent-shared';
import type { {Domain}RoutesDeps } from './internal-agent-shared';

// --- Schemas ---
const SomeSchema = z.object({ ... });

// --- Helpers (if any) ---

// --- Factory ---
export function createInternalAgent{Domain}Routes(deps: {Domain}RoutesDeps): Router {
  const router = Router();
  router.use(verifyInternalSecret(deps.internalApiSecret));

  router.post('/endpoint', async (req, res) => { ... });

  return router;
}
```

### Phase 3: Rewrite aggregator (`internal-agent.routes.ts`)

Reduce to a thin composition file (<100 LOC):

```typescript
// internal-agent.routes.ts
import { Router } from 'express';
import type { InternalAgentRoutesDeps } from './internal-agent-shared';
import { createInternalAgentDiscoveryRoutes } from './internal-agent-discovery.routes';
import { createInternalAgentStorefrontRoutes } from './internal-agent-storefront.routes';
import { createInternalAgentMarketingRoutes } from './internal-agent-marketing.routes';
import { createInternalAgentBookingRoutes } from './internal-agent-booking.routes';
import { createInternalAgentProjectHubRoutes } from './internal-agent-project-hub.routes';

export function createInternalAgentRoutes(deps: InternalAgentRoutesDeps): Router {
  const router = Router();

  // Mount domain routers — order doesn't matter (no path conflicts)
  router.use('/', createInternalAgentDiscoveryRoutes(deps));
  router.use('/', createInternalAgentBookingRoutes(deps));
  router.use('/storefront', createInternalAgentStorefrontRoutes(deps));
  router.use('/', createInternalAgentMarketingRoutes(deps));
  router.use('/project-hub', createInternalAgentProjectHubRoutes(deps));

  return router;
}
```

**Critical detail:** Storefront endpoints already use `/storefront/` prefix, and Project Hub uses `/project-hub/` prefix. The domain routers for these will define routes WITHOUT the prefix (e.g., `router.post('/structure', ...)`) and the aggregator mounts them at the prefix. Discovery, Booking, and Marketing endpoints use root-level paths, so they mount at `/`.

### Phase 4: Verify and clean up

1. Delete `_ProjectHubAddNoteSchema` (unused dead code)
2. Run clean typecheck: `rm -rf server/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`
3. Run tests: `npm run --workspace=server test`
4. Verify no file exceeds 800 LOC: `wc -l server/src/routes/internal-agent*.ts`
5. Verify `index.ts` registration is unchanged — still imports from `./internal-agent.routes` and mounts at `/v1/internal/agent`

## Acceptance Criteria

- [x] `internal-agent.routes.ts` is <100 LOC (thin aggregator) — 54 LOC
- [x] No domain route file exceeds 800 LOC — max is 793 (marketing)
- [x] All 41 endpoints respond identically (same paths, same behavior)
- [x] `index.ts` registration unchanged — single import, single mount
- [x] `internal-agent-health.routes.ts` untouched
- [x] Dead code `_ProjectHubAddNoteSchema` deleted
- [x] Clean typecheck passes: `rm -rf server/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`
- [x] Server tests pass: `npm run --workspace=server test` — 2056 passed, 0 failed

## Risk Analysis

| Risk                                    | Likelihood | Impact                 | Mitigation                                                                        |
| --------------------------------------- | ---------- | ---------------------- | --------------------------------------------------------------------------------- |
| Path prefix mismatch after split        | Medium     | High (404s)            | Careful mapping of prefix vs mount point; verify every endpoint                   |
| Missing import after extraction         | Low        | Medium (compile error) | Clean typecheck catches this                                                      |
| Cache behavior change                   | Low        | Low                    | Caches are module-scoped; moving to domain file preserves behavior                |
| Vertex AI lazy import breaks            | Low        | Medium                 | Test marketing endpoints after split                                              |
| `verifyInternalSecret` middleware order | Low        | High (auth bypass)     | Each domain router applies `router.use(verifyInternalSecret)` as first middleware |

## LOC Budget Verification

| File                                    | Estimated LOC | Under 800? |
| --------------------------------------- | ------------- | ---------- |
| `internal-agent.routes.ts` (aggregator) | ~60           | Yes        |
| `internal-agent-shared.ts`              | ~80           | Yes        |
| `internal-agent-discovery.routes.ts`    | ~450          | Yes        |
| `internal-agent-storefront.routes.ts`   | ~650          | Yes        |
| `internal-agent-marketing.routes.ts`    | ~650          | Yes        |
| `internal-agent-booking.routes.ts`      | ~460          | Yes        |
| `internal-agent-project-hub.routes.ts`  | ~300          | Yes        |

## References

- Todo: `todos/5241-deferred-p3-internal-agent-routes-monolith.md`
- Source file: `server/src/routes/internal-agent.routes.ts` (2,889 lines)
- Route registration: `server/src/routes/index.ts:779-791`
- Health routes pattern: `server/src/routes/internal-agent-health.routes.ts`
- Existing split pattern: `tenant-admin-*.routes.ts` files
- Pitfall #79: Orphan imports after large deletions — always clean typecheck
