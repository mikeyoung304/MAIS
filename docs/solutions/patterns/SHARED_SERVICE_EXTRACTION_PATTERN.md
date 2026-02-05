# Shared Service Extraction Pattern: CloudRunAuthService

**Category:** Patterns / Refactoring
**Date:** 2026-02-05

## Problem

4 files independently implemented identical `getIdentityToken()` functions for Cloud Run service-to-service authentication (~240 lines duplicated):

- `tenant-admin-tenant-agent.routes.ts` — standalone function
- `vertex-agent.service.ts` — private class method + constructor credential parsing
- `customer-agent.service.ts` — private class method + constructor credential parsing
- `project-hub-agent.service.ts` — private class method + constructor credential parsing

Each had the same 3-tier fallback: metadata service → JWT → gcloud CLI, but they evolved independently with slightly different error handling and logging.

## Solution: Module-Level Singleton

```typescript
// server/src/services/cloud-run-auth.service.ts
export class CloudRunAuthService {
  private tokenCache = new Map<string, CachedToken>();
  private serviceAccountCredentials: ServiceAccountCreds | null = null;

  constructor() { /* Zod safeParse credentials from env */ }

  async getIdentityToken(audience: string): Promise<string | null> { /* cached */ }
  clearCacheFor(audience: string): void { /* for 401/403 retry */ }
  private async fetchIdentityToken(audience: string): Promise<string | null> { /* 3-tier */ }
}

export const cloudRunAuth = new CloudRunAuthService();
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Module-level singleton | No DI container needed; stateless service benefits from reuse |
| Per-audience caching | Different Cloud Run services need different tokens |
| 55-minute TTL | Under GCP's 60-minute token lifetime |
| `clearCacheFor(audience)` | Supports 401/403 cache invalidation retry |
| ADC dropped | `GoogleAuth.getIdTokenClient()` silently returns empty headers on non-GCP |
| Zod safeParse for credentials | Runtime validation at construction (Pitfall #62) |
| Static `child_process` import | Simpler than dynamic; gcloud is dev-only fallback |

### Consumer Update Pattern

```typescript
// Before (in each service):
import { GoogleAuth, JWT } from 'google-auth-library';
private auth: GoogleAuth;
private serviceAccountCredentials: any;
constructor() { /* 15-20 lines of credential parsing */ }
private async getIdentityToken(): Promise<string | null> { /* 50-70 lines */ }

// After (one line import, one line call):
import { cloudRunAuth } from './cloud-run-auth.service';
const token = await cloudRunAuth.getIdentityToken(getAgentUrl());
```

## When to Apply This Pattern

Extract a shared service when:
1. **3+ files** have identical or near-identical implementations
2. The logic is **stateless or cache-only** (no per-request state)
3. The function has **external dependencies** (credentials, tokens) that benefit from reuse
4. Each copy has **evolved independently** with slight drift

## When NOT to Apply

- 2 files with similar code — wait for the third (Rule of Three)
- Per-request state needed — use DI instead of singleton
- Logic is trivially small (< 10 lines) — duplication is fine

## Testing

4 unit tests cover the service:
1. JWT token fetch + cache hit on second call
2. Fallback chain: JWT fails → gcloud CLI succeeds
3. Malformed JSON credentials → Zod rejects gracefully
4. Completely invalid JSON → constructor handles without crash

```bash
npm run --workspace=server test -- cloud-run-auth
```

## Result

- ~240 lines of duplication → 1 shared 140-line service
- 4 consumer files simplified (removed class fields, constructor parsing, private methods)
- Per-audience caching prevents redundant token fetches
- Single place to update auth logic for all agents

## Related

- `server/src/services/cloud-run-auth.service.ts` — the service
- `server/src/services/__tests__/cloud-run-auth.service.test.ts` — tests
- `docs/plans/2026-02-04-refactor-shared-cloud-run-auth-service-plan.md` — original plan
- Pitfall #62: Type assertion without validation (Zod safeParse)
