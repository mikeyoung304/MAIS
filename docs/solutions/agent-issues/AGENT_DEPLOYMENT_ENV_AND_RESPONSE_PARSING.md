---
title: "Agent Deployment Env Vars & ADK Response Parsing"
pattern_name: ADK_BUILD_RUNTIME_ENV_VAR_SEPARATION
date: 2026-02-11
severity: P1
category: agent-issues
components:
  - server/src/agent-v2/deploy/tenant/src/tools/research.ts
  - .github/workflows/deploy-agents.yml
  - server/src/routes/tenant-admin-tenant-agent.routes.ts
  - server/src/lib/adk-client.ts
symptoms:
  - "Agent temporarily unavailable" on first chat message
  - "Invalid agent response format" on second/third message
  - Render logs show "RESEARCH_AGENT_URL environment variable is required"
  - Zod validation error on path [6, "content"] with message "Required"
  - Cloud Run health checks pass but agent crashes on first real request
root_causes:
  - ADK deploy cloud_run uses .env for BUILD but not Cloud Run RUNTIME env vars
  - Module-level throw crashes entire agent at import time
  - ADK error events have errorCode but no content field; local Zod schema required content
tags:
  - adk
  - cloud-run
  - env-vars
  - zod
  - graceful-degradation
  - deployment
  - response-parsing
related_pitfalls: [34, 40, 41, 42, 47, 50, 51, 56, 81]
commits:
  - "61a0928c: fix: graceful degradation for missing RESEARCH_AGENT_URL + CI env var injection"
  - "ecd43467: fix: handle ADK error events with missing content in response parser"
---

# Agent Deployment Env Vars & ADK Response Parsing

## Problem Summary

During production smoke testing of the onboarding question reordering feature (`20a72f4a`), two P1 bugs were discovered that made the tenant agent completely non-functional:

1. **Agent down**: Cloud Run tenant-agent crashed on first request because `RESEARCH_AGENT_URL` was missing at runtime (health checks passed)
2. **Response parsing failure**: After fixing #1, the agent's third response included an ADK error event without a `content` field, causing Zod validation to reject the entire response

Both issues passed CI, passed Cloud Run health checks, and only surfaced during real user interaction.

## Investigation Steps

### Bug 1: Missing Runtime Env Vars

1. Navigated to production dashboard, sent message to agent
2. Got "Agent temporarily unavailable" error in UI
3. Checked Render logs: `"error":"RESEARCH_AGENT_URL environment variable is required"`
4. Traced to `research.ts` line 26-28 — module-level `throw` killed agent at import time
5. Verified Cloud Run health check passed (basic HTTP server responds before module crash)
6. Root cause: ADK `deploy cloud_run` reads `.env` for BUILD-time injection but does NOT set Cloud Run RUNTIME environment variables

### Bug 2: ADK Error Event Without Content

1. After deploying env var fix, retested — Q1 and Q2 worked
2. Q2 answer ("wedding photographer") triggered "Invalid agent response format"
3. Render logs showed Zod error: `"path": [6, "content"], "message": "Required"`
4. ADK response had 7 events; event at index 6 had `errorCode: "UNKNOWN_ERROR"` but no `content` field
5. Local `AdkResponseSchema` in route file required `content` on every event
6. Shared `adk-client.ts` already had `content: optional()` — but the route used its own stricter schema (Pitfall #18: duplicate schemas)

## Root Cause Analysis

### Bug 1: ADK Build vs Runtime Environment Gap

```
ADK deploy cloud_run workflow:
  1. Reads .env file           ← BUILD-TIME: injects env vars into Docker build
  2. Builds container
  3. Pushes to Cloud Run       ← RUNTIME: env vars NOT propagated
  4. Health check passes       ← HTTP server starts before module imports crash
  5. First request → import research.ts → throw Error → 500
```

The `.env` file created in CI had `RESEARCH_AGENT_URL`, but ADK only used it during the Docker build step. Cloud Run's runtime environment was empty.

### Bug 2: ADK Error Events Are Structurally Different

```
Normal ADK event:
  { content: { role: "model", parts: [{ text: "..." }] } }

Error ADK event:
  { errorCode: "UNKNOWN_ERROR", errorMessage: "..." }
  ← NO content field
```

Vertex AI occasionally returns error events in the response array (e.g., when a tool call fails internally). These events have a fundamentally different shape — they carry `errorCode`/`errorMessage` instead of `content`.

## Solution

### Fix 1: Graceful Degradation for Missing RESEARCH_AGENT_URL

**File:** `server/src/agent-v2/deploy/tenant/src/tools/research.ts`

```typescript
// BEFORE: Module-level throw crashes entire agent
const RESEARCH_AGENT_URL = process.env.RESEARCH_AGENT_URL;
if (!RESEARCH_AGENT_URL) {
  throw new Error('RESEARCH_AGENT_URL environment variable is required');
}

// AFTER: Warn at startup, guard at execute time
const RESEARCH_AGENT_URL = process.env.RESEARCH_AGENT_URL;
if (!RESEARCH_AGENT_URL) {
  logger.warn(
    {},
    '[Research] RESEARCH_AGENT_URL not set — direct research delegation disabled, will use backend pre-computed results only'
  );
}

// In execute(), before Tier 3 direct call:
if (!RESEARCH_AGENT_URL) {
  return {
    success: false,
    businessType,
    location,
    error: 'Research service not configured',
    suggestion: 'Continue without research data. Ask the user about their pricing directly.',
  };
}
```

**Why this works:** The research tool has 3 tiers — in-memory cache, backend pre-computed results, and direct Cloud Run call. Only Tier 3 needs `RESEARCH_AGENT_URL`. Tiers 1-2 continue working without it.

### Fix 2: CI Env Var Injection After ADK Deploy

**File:** `.github/workflows/deploy-agents.yml`

```yaml
# After npx adk deploy cloud_run:
echo "Setting runtime environment variables on Cloud Run..."
ENV_ARGS=""
while IFS='=' read -r key value; do
[[ -z "$key" || "$key" =~ ^# ]] && continue
ENV_ARGS="${ENV_ARGS}${key}=${value},"
done < .env
ENV_ARGS="${ENV_ARGS%,}"

if [ -n "$ENV_ARGS" ]; then
gcloud run services update ${{ matrix.agent }}-agent \
--region=${{ env.GOOGLE_CLOUD_REGION }} \
--update-env-vars="$ENV_ARGS" --quiet
fi
```

**Why this works:** Explicitly calls `gcloud run services update --update-env-vars` to set runtime env vars on Cloud Run after ADK deploy completes.

### Fix 3: Optional Content in ADK Response Schema

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`

```typescript
// BEFORE: content required on every event
const AdkResponseSchema = z.array(
  z.object({
    content: z.object({
      /* ... */
    }),
  })
);

// AFTER: content optional, error fields added
const AdkResponseSchema = z.array(
  z.object({
    content: z
      .object({
        /* ... */
      })
      .optional(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
  })
);

// Guard in extractDashboardActions:
for (const item of data) {
  if (!item.content?.parts) continue; // Skip error events
  for (const part of item.content.parts) {
    /* ... */
  }
}
```

**Why not use shared schema?** The shared `AdkRunResponseSchema` in `adk-client.ts` is a union type (`z.array() | z.object()`). The route's `extractDashboardActions` iterates over the response directly, which TypeScript rejects on a union. Keeping a local array-only schema with `content: optional()` was the pragmatic fix.

## Prevention Strategies

### Rule 1: Never throw at module level for optional dependencies

```
Detection: grep -rn "throw.*required" server/src/agent-v2/deploy/*/src/
Prevention: Use logger.warn at module scope + guard in execute()
```

Module-level throws kill the entire agent process. For tools that have fallback paths, use graceful degradation. Only `throw` at module level for truly critical dependencies (e.g., `INTERNAL_API_SECRET` needed by every tool).

### Rule 2: Always set Cloud Run runtime env vars explicitly in CI

```
Detection: Check deploy workflow for gcloud run services update --update-env-vars
Prevention: After every ADK deploy, run explicit gcloud env var injection
```

ADK `deploy cloud_run` is unreliable for runtime env var propagation. The belt-and-suspenders approach: keep the `.env` file for ADK build AND explicitly set runtime vars via `gcloud`.

### Rule 3: ADK response schemas must treat content as optional

```
Detection: grep -n "content: z.object" server/src/routes/*agent*
Prevention: All ADK event schemas use content: z.object({...}).optional()
```

Vertex AI can return error events at any position in the response array. Any code iterating ADK events must guard: `if (!event.content?.parts) continue`.

### Rule 4: Don't duplicate shared schemas (Pitfall #18)

```
Detection: diff <(grep -h "AdkResponseSchema\|AdkEventSchema" server/src/lib/adk-client.ts) \
               <(grep -h "AdkResponseSchema\|AdkEventSchema" server/src/routes/*agent*)
Prevention: Use shared schema when possible; if local schema needed, keep it in sync
```

The route file had its own `AdkResponseSchema` that was stricter than the shared one. When the shared schema was updated to handle optional content, the local copy wasn't updated.

### Rule 5: Health checks don't prove agent functionality

```
Detection: Smoke test after every agent deployment
Prevention: CI should include a minimal end-to-end test (send message, verify response)
```

Cloud Run health checks only prove the HTTP server started. Module-level crashes happen on first real request when agent code is loaded.

## Test Cases

### Regression Test: Missing RESEARCH_AGENT_URL

```bash
# Simulate missing env var locally
unset RESEARCH_AGENT_URL
# Start tenant agent — should NOT crash
# Send chat message — should work (research returns graceful fallback)
# Verify log: "[Research] RESEARCH_AGENT_URL not set"
```

### Regression Test: ADK Error Event

```typescript
// Mock ADK response with error event
const responseWithError = [
  { content: { role: 'model', parts: [{ text: "Here's your website" }] } },
  { content: { role: 'model', parts: [{ functionCall: { name: 'update_section', args: {} } }] } },
  { errorCode: 'UNKNOWN_ERROR', errorMessage: 'Internal error' }, // No content!
];
// Verify: Zod parse succeeds, extractDashboardActions skips error event
```

### Smoke Test Checklist (Post-Deploy)

1. Navigate to tenant dashboard
2. Send Q1 answer (location) — verify agent responds with Q2
3. Send Q2 answer (business type) — verify agent responds without "Invalid format"
4. Verify tool calls executed (store_discovery_fact visible in response)
5. Verify research delegation attempted (check Cloud Run logs)

## Cross-References

### Related Documentation

- [AGENT_FAILURES.md](./AGENT_FAILURES.md) — Root cause of Pitfall #81 (ADK deploy without .env in CI)
- [AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md](./AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md) — Agent onboarding first-draft flow
- [ONBOARDING_AGENT_PRODUCTION_BUGS_AUTH_TRANSFORM_RESPONSE_MISMATCH.md](./ONBOARDING_AGENT_PRODUCTION_BUGS_AUTH_TRANSFORM_RESPONSE_MISMATCH.md) — Previous production agent bugs

### Related Prevention Docs

- [ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md](../patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md) — Agent dev checklist
- [ADK_A2A_PREVENTION_INDEX.md](../patterns/ADK_A2A_PREVENTION_INDEX.md) — ADK integration patterns
- [ZOD_PARAMETER_VALIDATION_PREVENTION.md](../patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md) — Zod validation patterns

### CLAUDE.md Pitfalls Referenced

- **#18** — Duplicated tool logic (local schema vs shared adk-client.ts)
- **#34** — Hardcoded Cloud Run URLs (always use env vars)
- **#40** — Missing Cloud Run env vars (validate at startup)
- **#41** — Empty secret fallback (use requireEnv for critical, warn for optional)
- **#42** — No fetch timeouts (research tool uses 90s timeout)
- **#47** — FunctionTool API mismatch (execute context is ToolContext | undefined)
- **#50** — Dual deployment architecture (Render vs Cloud Run)
- **#51** — Agent deployment verification (check GitHub Actions after merge)
- **#56** — Missing Zod safeParse (response validation)
- **#81** — ADK deployment without .env in CI

## Key Takeaway

**ADK `deploy cloud_run` has a build-time/runtime env var gap.** The `.env` file is consumed during Docker build but not propagated to Cloud Run runtime environment. Always follow up with explicit `gcloud run services update --update-env-vars`. And never use module-level `throw` for dependencies that have fallback paths — use graceful degradation so the agent stays alive even with partial capability.
