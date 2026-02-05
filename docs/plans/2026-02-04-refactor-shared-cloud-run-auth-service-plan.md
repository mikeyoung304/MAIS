---
title: 'Extract shared CloudRunAuthService to deduplicate JWT identity token logic'
type: refactor
date: 2026-02-04
reviewed: 2026-02-04
reviewers: ['dhh-rails-reviewer', 'kieran-typescript-reviewer', 'code-simplicity-reviewer']
verdict: 'SHIP IT (with revisions applied)'
---

# ♻️ Extract Shared CloudRunAuthService

## Overview

Four files in the MAIS backend independently implement identical `getIdentityToken()` functions for Cloud Run service-to-service authentication. Each copy parses the same environment variable, constructs the same JWT client, follows the same 3-tier fallback, and does zero token caching. This refactor extracts a single `CloudRunAuthService` with per-audience token caching (55-min TTL), reducing ~240 lines of duplicated auth logic to ~80 lines in one canonical service.

## Problem Statement

### Current Duplication

| File                                                    | Line     | Audience             | Cache | Priority Tiers         |
| ------------------------------------------------------- | -------- | -------------------- | ----- | ---------------------- |
| `server/src/routes/tenant-admin-tenant-agent.routes.ts` | 794-866  | `TENANT_AGENT_URL`   | ❌    | Metadata → JWT → ADC   |
| `server/src/services/vertex-agent.service.ts`           | 992-1052 | `TENANT_AGENT_URL`   | ❌    | JWT → ADC → gcloud CLI |
| `server/src/services/customer-agent.service.ts`         | 606-652  | `CUSTOMER_AGENT_URL` | ❌    | JWT → ADC → gcloud CLI |
| `server/src/services/project-hub-agent.service.ts`      | 428-484  | `CUSTOMER_AGENT_URL` | ❌    | JWT → ADC → gcloud CLI |

**Constructor duplication** (credential parsing):

- `vertex-agent.service.ts:216-233` — parses `GOOGLE_SERVICE_ACCOUNT_JSON`, stores credentials
- `customer-agent.service.ts:162-178` — same parsing, same storage
- `project-hub-agent.service.ts` — same parsing, same storage
- `tenant-admin-tenant-agent.routes.ts:820-826` — inline parsing per call

### Why This Matters

1. **Inconsistency risk:** The routes file includes a Cloud Run metadata check (`process.env.K_SERVICE`) that the 3 services lack. Bug fixes to one copy may not propagate to others.
2. **No token caching:** Google ID tokens are valid ~1 hour. We fetch a fresh token on _every_ Cloud Run call — unnecessary latency and external API calls.
3. **Maintenance burden:** 4 copies × ~60 lines = ~240 lines of auth boilerplate that must stay in sync.
4. **Pitfall #36 history:** The `GoogleAuth.getIdTokenClient()` silent-failure bug was discovered in production and fixed in commit `dcd0ca65` — but only in the routes file. The same risk exists if any copy drifts.

## Proposed Solution

Create `server/src/services/cloud-run-auth.service.ts` — a singleton service that:

1. Parses `GOOGLE_SERVICE_ACCOUNT_JSON` once at construction
2. Provides `getIdentityToken(audience: string): Promise<string | null>`
3. Caches tokens per audience URL with 55-minute TTL
4. Implements the unified 3-tier fallback: Cloud Run metadata → JWT.fetchIdToken() → gcloud CLI

> **Note:** We intentionally drop the GoogleAuth ADC fallback (Priority 3 in current code). Per `docs/solutions/JWT_ID_TOKEN_FOR_CLOUD_RUN_AUTH.md`, `GoogleAuth.getIdTokenClient().getRequestHeaders()` silently returns empty headers for service accounts on non-GCP environments. It has never reliably worked in this codebase. The 2-tier fallback (JWT on Render, gcloud CLI for local dev) covers all actual environments. If ADC ever becomes needed, it can be added back as a middle tier.

### Auth Fallback Strategy

```
Environment        │ What Works
───────────────────┼──────────────────────────────
Cloud Run (GCP)    │ Metadata service (fastest, <5ms)
Render (production)│ JWT.fetchIdToken() with service account
Local dev          │ gcloud auth print-identity-token
```

## Technical Approach

### New File: `server/src/services/cloud-run-auth.service.ts`

```typescript
import { execSync } from 'child_process'; // static import — Node built-in (review feedback: DHH)
import { z } from 'zod';
import { JWT } from 'google-auth-library';
import { logger } from '../lib/core/logger';

interface CachedToken {
  token: string;
  expiresAt: number; // Unix ms
}

const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutes (tokens valid ~1 hour)

// Zod schema for credential validation (review feedback: Kieran, Pitfall #62)
const ServiceAccountSchema = z.object({
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});

export class CloudRunAuthService {
  private serviceAccountCredentials: z.infer<typeof ServiceAccountSchema> | null = null;

  /** Per-audience token cache (e.g., tenant-agent vs customer-agent URLs) */
  private tokenCache = new Map<string, CachedToken>();

  constructor() {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      try {
        const parsed = JSON.parse(serviceAccountJson);
        const result = ServiceAccountSchema.safeParse(parsed);
        if (result.success) {
          this.serviceAccountCredentials = result.data;
          logger.info('[CloudRunAuth] Initialized with service account credentials');
        } else {
          logger.error(
            { error: result.error.message },
            '[CloudRunAuth] GOOGLE_SERVICE_ACCOUNT_JSON missing required fields (client_email, private_key)'
          );
        }
      } catch (e) {
        logger.error(
          { error: e instanceof Error ? e.message : String(e) },
          '[CloudRunAuth] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON'
        );
      }
    } else {
      logger.info('[CloudRunAuth] No service account configured (local dev mode)');
    }
  }

  /**
   * Get an identity token for a Cloud Run audience URL.
   * Uses 3-tier fallback: Metadata service → JWT → gcloud CLI.
   * Tokens are cached for 55 minutes per audience URL.
   */
  async getIdentityToken(audience: string): Promise<string | null> {
    // Check cache first
    const cached = this.tokenCache.get(audience);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const token = await this.fetchIdentityToken(audience);
    if (token) {
      this.tokenCache.set(audience, {
        token,
        expiresAt: Date.now() + TOKEN_TTL_MS,
      });
    }
    return token;
  }

  /** Clear cached token for an audience. Call on 401/403 before retrying. */
  clearCacheFor(audience: string): void {
    this.tokenCache.delete(audience);
  }

  private async fetchIdentityToken(audience: string): Promise<string | null> {
    // Priority 1: Cloud Run metadata service (fastest when on GCP)
    if (process.env.K_SERVICE) {
      try {
        const metadataUrl =
          'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';
        const response = await fetch(`${metadataUrl}?audience=${audience}`, {
          headers: { 'Metadata-Flavor': 'Google' },
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const token = await response.text();
          logger.debug('[CloudRunAuth] Got token via metadata service');
          return token;
        }
      } catch (error) {
        logger.warn({ error }, '[CloudRunAuth] Metadata service unavailable');
      }
    }

    // Priority 2: JWT with service account (Render, CI)
    if (this.serviceAccountCredentials) {
      try {
        const jwtClient = new JWT({
          email: this.serviceAccountCredentials.client_email,
          key: this.serviceAccountCredentials.private_key,
        });
        const idToken = await jwtClient.fetchIdToken(audience);
        if (idToken) {
          logger.debug('[CloudRunAuth] Got token via JWT (service account)');
          return idToken;
        }
        logger.warn('[CloudRunAuth] JWT.fetchIdToken returned empty token');
      } catch (e) {
        logger.warn(
          { error: e instanceof Error ? e.message : String(e) },
          '[CloudRunAuth] JWT fetchIdToken failed'
        );
      }
    }

    // Priority 3: gcloud CLI (local development)
    try {
      const token = execSync('gcloud auth print-identity-token', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      if (token) {
        logger.debug('[CloudRunAuth] Got token via gcloud CLI (local dev)');
        return token;
      }
    } catch {
      // Expected on non-local environments (Render, Cloud Run)
    }

    logger.warn(
      { audience },
      '[CloudRunAuth] No identity token available - requests will be unauthenticated'
    );
    return null;
  }
}

// Module-level singleton (review feedback: DHH + Simplicity — no DI ceremony needed)
export const cloudRunAuth = new CloudRunAuthService();
```

### Changes to Consumers

Each consumer replaces its private `getIdentityToken()` + constructor credential parsing with a single import of the shared singleton.

**Import pattern (same for all consumers):**

```typescript
import { cloudRunAuth } from '../services/cloud-run-auth.service';
```

#### `vertex-agent.service.ts`

```diff
+import { cloudRunAuth } from '../services/cloud-run-auth.service';

 export class VertexAgentService {
-  private auth: GoogleAuth;
-  private serviceAccountCredentials: { ... } | null = null;

   constructor(prisma: PrismaClient) {
     // ... session service, context builder init unchanged ...
-    // Remove: 15 lines of GOOGLE_SERVICE_ACCOUNT_JSON parsing
-    // Remove: GoogleAuth initialization
   }

   // In createSession(), sendMessage(), etc.:
-  const token = await this.getIdentityToken();
+  const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());

-  // Remove: private async getIdentityToken() { ... } (60 lines)
 }
```

#### `customer-agent.service.ts`

```diff
+import { cloudRunAuth } from '../services/cloud-run-auth.service';

 export class CustomerAgentService {
-  private auth: GoogleAuth;
-  private serviceAccountCredentials: { ... } | null = null;

   constructor(prisma: PrismaClient) {
     // ... session service init unchanged ...
-    // Remove: 15 lines of GOOGLE_SERVICE_ACCOUNT_JSON parsing
   }

-  const token = await this.getIdentityToken();
+  const token = await cloudRunAuth.getIdentityToken(getCustomerAgentUrl());

-  // Remove: private async getIdentityToken() { ... } (46 lines)
 }
```

#### `project-hub-agent.service.ts`

```diff
+import { cloudRunAuth } from '../services/cloud-run-auth.service';

 export class ProjectHubAgentService {
-  private auth: GoogleAuth;
-  private serviceAccountCredentials: { ... } | null = null;

   constructor(prisma: PrismaClient) {
-    // Remove: credential parsing
   }

-  const token = await this.getIdentityToken();
+  const token = await cloudRunAuth.getIdentityToken(getCustomerAgentUrl());

-  // Remove: private async getIdentityToken() { ... } (56 lines)
 }
```

#### `tenant-admin-tenant-agent.routes.ts`

```diff
+import { cloudRunAuth } from '../services/cloud-run-auth.service';

 // In route handlers:
-const token = await getIdentityToken();
+const token = await cloudRunAuth.getIdentityToken(getTenantAgentUrl());

-// Remove: async function getIdentityToken() { ... } (72 lines)
-// Remove: inline GOOGLE_SERVICE_ACCOUNT_JSON parsing
```

### DI Wiring: Module-Level Singleton (Decision Final)

The `CloudRunAuthService` is exported as a module-level singleton from `cloud-run-auth.service.ts`. Consumers import it directly. No DI container changes, no constructor injection.

**Rationale (from review):** The agent services aren't in `di.ts` today. The auth service has no dependencies besides `process.env` and `logger`. Adding DI ceremony for a leaf singleton with zero swappable dependencies is complexity theater. If agent services ever move into the DI container, the auth service moves with them — that's a future refactor, not this one.

```typescript
// In any consumer file:
import { cloudRunAuth } from '../services/cloud-run-auth.service';

const token = await cloudRunAuth.getIdentityToken(agentUrl);
```

For tests: `jest.mock('../services/cloud-run-auth.service')` to stub the singleton.

## Acceptance Criteria

- [x] `CloudRunAuthService` created at `server/src/services/cloud-run-auth.service.ts`
- [x] 3-tier fallback implemented: Cloud Run metadata → JWT.fetchIdToken() → gcloud CLI
- [x] Per-audience token caching with 55-minute TTL
- [x] `clearCacheFor(audience)` method included for 401/403 recovery
- [x] Zod `safeParse` validates credential structure in constructor
- [x] Static `import { execSync }` (not dynamic import)
- [x] Module-level singleton exported: `export const cloudRunAuth = new CloudRunAuthService()`
- [x] `getIdentityToken()` removed from all 4 consumer files
- [x] Constructor credential parsing removed from 3 service files
- [x] `google-auth-library` `GoogleAuth` import removed from consumers (only `JWT` needed in shared service)
- [x] All existing callers updated to use singleton import
- [x] Existing behavior preserved — no change to auth headers sent to Cloud Run
- [x] 2-3 unit tests: cache hit, fallback chain, malformed credentials
- [x] `rm -rf server/dist packages/*/dist && npm run --workspace=server typecheck` passes (Pitfall #87, #93)
- [x] `npm run --workspace=apps/web typecheck` passes
- [x] `npm test` passes with no regressions (21 pre-existing @macon/contracts resolution failures unchanged)

## Edge Cases & SpecFlow Analysis

### Cache Expiry Race Condition

**Scenario:** Two concurrent requests both find the cache expired and both call `fetchIdentityToken()` simultaneously.

**Risk:** Low. Both get valid tokens. Slightly wasteful (two JWT operations instead of one) but not harmful. The Map is single-threaded in Node.js so no data corruption.

**Mitigation (not needed now):** If this ever becomes a concern, add a `pendingFetches` Map to deduplicate in-flight requests. YAGNI for now.

### Token Refresh on Error

**Scenario:** A cached token becomes invalid before the 55-minute TTL (e.g., service account key rotation).

**Risk:** Medium. Cloud Run returns 401/403. The caller sees an auth failure.

**Mitigation:** `clearCacheFor(audience)` method is included in v1 (review feedback: all 3 reviewers agreed). Callers can invoke it on 401/403 responses and retry.

### Different Audiences for Same Service Account

**Scenario:** `TENANT_AGENT_URL` and `CUSTOMER_AGENT_URL` are different Cloud Run services. JWT ID tokens are audience-specific.

**Risk:** Critical if we used a single cached token. **Handled** by using a `Map<string, CachedToken>` keyed by audience URL.

### Environment Without Service Account

**Scenario:** Local development without `GOOGLE_SERVICE_ACCOUNT_JSON`.

**Risk:** None. Falls through to gcloud CLI. Same behavior as today. Log message is clear.

### Empty or Malformed `GOOGLE_SERVICE_ACCOUNT_JSON`

**Scenario:** Env var is set but contains invalid JSON.

**Risk:** Low. Constructor catches parse errors, logs them, and sets `serviceAccountCredentials = null`. Falls through to gcloud CLI. Same as current behavior.

### Unbounded Map Growth (Pitfall #50)

**Scenario:** If audience URLs were user-supplied, the Map could grow unbounded.

**Risk:** None in practice. MAIS has exactly 2 audience URLs (tenant-agent, customer-agent). The Map will have at most 2-3 entries. Not worth adding TTL eviction or max-size limits. If a 3rd agent URL is added in the future, the Map handles it automatically.

## Implementation Checklist

### Phase 1: Create CloudRunAuthService

- [x] Create `server/src/services/cloud-run-auth.service.ts`
- [x] Implement constructor with Zod `safeParse` credential validation (Pitfall #62)
- [x] Implement `getIdentityToken(audience)` with cache check
- [x] Implement `clearCacheFor(audience)` for 401/403 recovery
- [x] Implement `fetchIdentityToken(audience)` with 3-tier fallback
- [x] Static `import { execSync } from 'child_process'` (not dynamic import)
- [x] Add `AbortSignal.timeout(5000)` on metadata fetch (Pitfall #46)
- [x] Export module-level singleton: `export const cloudRunAuth = new CloudRunAuthService()`

### Phase 2: Wire Up and Deduplicate

- [x] Update `tenant-admin-tenant-agent.routes.ts`: import singleton, remove `getIdentityToken()` function (~72 lines) + inline credential parsing
- [x] Update `vertex-agent.service.ts`: import singleton, remove private `getIdentityToken()` (~60 lines) + constructor credential parsing (~18 lines)
- [x] Update `customer-agent.service.ts`: import singleton, remove private `getIdentityToken()` (~46 lines) + constructor credential parsing (~16 lines)
- [x] Update `project-hub-agent.service.ts`: import singleton, remove private `getIdentityToken()` (~56 lines) + constructor credential parsing (~16 lines)
- [x] Remove unused `GoogleAuth` imports from consumer files
- [x] Verify constructor signatures unchanged (no new params — singleton is imported, not injected)

### Phase 3: Tests

- [x] Unit test: JWT tier returns token, cache hit on second call (no re-fetch)
- [x] Unit test: fallback chain (JWT fails → gcloud CLI)
- [x] Unit test: malformed `GOOGLE_SERVICE_ACCOUNT_JSON` handled gracefully (Zod rejects, falls through)

### Phase 4: Verify

- [x] `rm -rf server/dist packages/*/dist && npm run --workspace=server typecheck` (Pitfall #87, #93)
- [x] `npm run --workspace=apps/web typecheck`
- [x] `npm test` — all existing tests pass (no regressions)
- [ ] Manual verification: start `npm run dev:api` and confirm agent chat still authenticates

## Files Changed

| File                                                           | Change                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `server/src/services/cloud-run-auth.service.ts`                | **NEW** — shared auth service + exported singleton                                                     |
| `server/src/services/__tests__/cloud-run-auth.service.test.ts` | **NEW** — 3 unit tests (cache, fallback, validation)                                                   |
| `server/src/routes/tenant-admin-tenant-agent.routes.ts`        | Remove `getIdentityToken()` (~72 lines) + credential parsing, import singleton                         |
| `server/src/services/vertex-agent.service.ts`                  | Remove `getIdentityToken()` (~60 lines) + constructor credential parsing (~18 lines), import singleton |
| `server/src/services/customer-agent.service.ts`                | Remove `getIdentityToken()` (~46 lines) + constructor credential parsing (~16 lines), import singleton |
| `server/src/services/project-hub-agent.service.ts`             | Remove `getIdentityToken()` (~56 lines) + constructor credential parsing (~16 lines), import singleton |

**Net impact:** ~+100 lines (new service + tests) / ~-284 lines (removed duplication) = **~184 lines removed**

## Deployment & Environment Impact

**This refactor requires zero changes outside of code.** It reads the exact same env vars, uses the same auth strategy, and produces identical `Authorization: Bearer <token>` headers.

### Environment Variable Audit

| Variable                      | Where Set                 | Change Needed? | Notes                                              |
| ----------------------------- | ------------------------- | -------------- | -------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Render dashboard (manual) | ❌ No          | Same JSON, now parsed in 1 place instead of 4      |
| `TENANT_AGENT_URL`            | `.env.example` + Render   | ❌ No          | Read by `getTenantAgentUrl()` helper (unchanged)   |
| `CUSTOMER_AGENT_URL`          | `.env.example` + Render   | ❌ No          | Read by `getCustomerAgentUrl()` helper (unchanged) |
| `RESEARCH_AGENT_URL`          | `.env.example` + Render   | ❌ No          | Not used by these 4 consumers                      |
| `K_SERVICE`                   | Auto-set by Cloud Run     | ❌ No          | Runtime detection, not configurable                |

### Platform-by-Platform Assessment

| Platform                              | Impact                                                     | Action Required |
| ------------------------------------- | ---------------------------------------------------------- | --------------- |
| **Local dev** (gcloud CLI)            | None — same fallback to `gcloud auth print-identity-token` | None            |
| **Render** (production)               | None — same `GOOGLE_SERVICE_ACCOUNT_JSON` in dashboard     | None            |
| **GitHub Actions** (CI/CD)            | None — tests run in mock mode, no auth needed              | None            |
| **GitHub Secrets**                    | None — `GOOGLE_SERVICE_ACCOUNT_JSON` value unchanged       | None            |
| **Cloud Run** (agent deployment)      | None — this changes backend, not agent containers          | None            |
| **gcloud** (service account)          | None — same service account, same `roles/run.invoker`      | None            |
| `render.yaml`                         | None — agent auth vars managed in dashboard, not blueprint | None            |
| `.github/workflows/deploy-agents.yml` | None — deploys agents to Cloud Run, not backend auth       | None            |

### What Actually Improves (No Config Change)

The only observable change in production is **fewer `JWT.fetchIdToken()` calls** due to 55-minute token caching. Instead of fetching a fresh token on every Cloud Run request (~100ms each), cached tokens serve instantly. This is a performance improvement with zero configuration.

## References

- `docs/solutions/JWT_ID_TOKEN_FOR_CLOUD_RUN_AUTH.md` — canonical auth pattern documentation
- `docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md` — Pitfall #36: Identity token auth
- CLAUDE.md Pitfall #46 — Missing fetch timeouts (AbortSignal on metadata fetch)
- CLAUDE.md Pitfall #50 — Module-level cache unbounded (Map bounded by known audience count)
- CLAUDE.md Pitfall #71 — Over-engineering detection (kept simple: no LRU, no Redis, just a Map)
- Commit `dcd0ca65` — Original JWT.fetchIdToken() fix for Render auth
- Commit `d5658955` — Explicit service account credentials refinement

## Review Decisions Log (2026-02-04)

Three-agent parallel review by `dhh-rails-reviewer`, `kieran-typescript-reviewer`, `code-simplicity-reviewer`.

| Decision               | Chosen                        | Rationale                                                                          |
| ---------------------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| DI approach            | Module-level singleton export | DHH + Simplicity: no DI ceremony for a leaf service with no swappable deps         |
| Port interface         | ❌ No `ICloudRunAuthService`  | DHH + Simplicity: "there will never be two implementations"; jest.mock for tests   |
| Credential validation  | Zod `safeParse`               | Kieran: Pitfall #62, cheap insurance for runtime data                              |
| `clearCacheFor()`      | ✅ In v1                      | All 3: caching without invalidation is incomplete; 3-line method                   |
| ADC fallback           | ❌ Dropped                    | DHH: proven broken per `docs/solutions/JWT_ID_TOKEN_FOR_CLOUD_RUN_AUTH.md`         |
| `child_process` import | Static                        | DHH: Node built-in, dynamic import adds nothing                                    |
| Unit tests             | 3 tests                       | Kieran: auth-touching code needs tests; Simplicity: keep it proportional           |
| GoogleAuth ADC tier    | Omitted                       | All 3: never worked reliably, metadata + JWT + gcloud covers all real environments |
