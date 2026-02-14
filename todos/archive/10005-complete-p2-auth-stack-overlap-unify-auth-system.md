# TODO 10005: Unify Auth System — Auth Stack Overlap

**Priority:** P2
**Status:** complete
**Source:** Technical Debt Audit 2026-02-13, Issue #4
**Audit Doc:** `docs/solutions/architecture/TECHNICAL_DEBT_AUDIT_2026-02-13.md`
**Completed:** 2026-02-14

## Problem

Multiple auth mechanisms coexisted:

- 4 cookie names in `auth-constants.ts:10-22`
- Multiple route mounts in `server/src/routes/index.ts:449,500,526`

## Resolution

Audited all auth paths. Frontend exclusively uses `/v1/auth/login` (unified endpoint).
Two legacy login endpoints had zero frontend references:

1. **`/v1/admin/login`** — Removed from ts-rest contract, OpenAPI docs, and handler
2. **`/v1/tenant-auth/login`** — Removed from Express router (kept `/me` endpoint)

The 4 cookie names are NOT dead — they're a priority lookup chain for NextAuth v4→v5
backward compatibility (HTTPS → HTTP, v5 → v4). These must remain.

### Changes Made

- `packages/contracts/src/api.v1.ts` — Removed `adminLogin` and `tenantLogin` contract entries
- `server/src/routes/index.ts` — Removed dead handlers, rate limit references, auth bypass for `/v1/admin/login`
- `server/src/routes/tenant-auth.routes.ts` — Removed `/login` route, kept `/me`
- `server/src/routes/admin.routes.ts` — Removed dead `login()` method from AdminController
- `server/src/di.ts` — Removed TenantAuthController from DI, simplified AdminController constructor
- `server/src/api-docs.ts` — Updated references to use `/v1/auth/login`, removed dead OpenAPI spec

### What Remains (auth-related)

- `/v1/tenant-auth/me` — Still needed for token verification
- `/v1/auth/*` routes — Canonical unified auth system
- 4 NextAuth cookie names — Required for v4→v5 backward compatibility
