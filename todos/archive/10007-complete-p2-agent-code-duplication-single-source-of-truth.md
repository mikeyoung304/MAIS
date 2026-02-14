# TODO 10007: Agent Code Duplication -- Eliminate Intentional Copies

**Priority:** P2
**Status:** complete
**Source:** Technical Debt Audit 2026-02-13, Issue #7
**Audit Doc:** `docs/solutions/architecture/TECHNICAL_DEBT_AUDIT_2026-02-13.md`

## Problem

Agent deploy directories intentionally copy shared utilities (comment at `utils.ts:10-13`). Drift tests exist in `constants-sync.test.ts` but copies can still diverge between deploys.

## Resolution

### Approach: Canonical Source + Prebuild Copy

Cloud Run agents deploy as standalone services via `adk deploy cloud_run`, which packages
only the agent's own directory. This means agents cannot use npm workspace imports or
TypeScript project references -- the `rootDir: "./src"` constraint is inherent to ADK's
deployment model.

**Solution:** A single canonical `agent-utils.ts` is maintained at
`server/src/agent-v2/shared/agent-utils.ts`. Each agent's `package.json` has a `prebuild`
script (`cp ../../shared/agent-utils.ts src/utils.ts`) that copies it before every build.

### Changes Made

1. **Created canonical source:** `server/src/agent-v2/shared/agent-utils.ts`
   - Superset of all shared utilities (logger, fetchWithTimeout, callMaisApi, callBackendAPI,
     callMaisApiTyped, getTenantId, requireTenantId, validateParams, wrapToolExecute,
     ToolError, TTLCache, getSessionContext, CustomerSessionContext)
   - Unified log prefix `[Agent]` instead of agent-specific prefixes
   - Includes all HTTPS validation hosts (localhost, 127.0.0.1, 0.0.0.0, [::1], host.docker.internal)
   - Includes `debug` level on logger (was missing from customer/research copies)

2. **Added prebuild scripts:** Both `tenant/package.json` and `customer/package.json` now
   have `"prebuild": "cp ../../shared/agent-utils.ts src/utils.ts"` which runs automatically
   before `npm run build`.

3. **Created sync shell script:** `server/src/agent-v2/scripts/sync-agent-utils.sh` for
   manual syncing during development.

4. **Extended drift detection tests:** `server/src/lib/constants-sync.test.ts` now verifies
   byte-for-byte identity between canonical and agent copies (2 new tests).

5. **Fixed research agent bugs found during audit:**
   - Fixed template literal bug (line 430): single-quoted string with `${}` never interpolated
   - Added missing HTTPS validation hosts (0.0.0.0, [::1], host.docker.internal)
   - Fixed unused `catch (e)` -> bare `catch` blocks

### Key Files

- `server/src/agent-v2/shared/agent-utils.ts` -- canonical source of truth
- `server/src/agent-v2/scripts/sync-agent-utils.sh` -- manual sync script
- `server/src/agent-v2/deploy/tenant/package.json` -- prebuild: cp
- `server/src/agent-v2/deploy/customer/package.json` -- prebuild: cp
- `server/src/lib/constants-sync.test.ts` -- drift detection (4 tests)
- `server/src/agent-v2/deploy/research/src/agent.ts` -- bug fixes (not synced, inlined)

### Why Not a Shared npm Package?

`adk deploy cloud_run` copies ONLY the agent directory to a temp folder for deployment.
External npm packages from the monorepo workspace would need to be published to a registry
or bundled. The prebuild copy approach achieves the same single-source-of-truth guarantee
with zero infrastructure changes.

### Research Agent Note

The research agent inlines all utilities directly in `agent.ts` (no separate `utils.ts`).
It was not converted to the copy pattern because it would require a major refactor to
extract ~90 lines of inlined code into a separate file. Drift bugs found during this
audit were fixed directly in-place.
