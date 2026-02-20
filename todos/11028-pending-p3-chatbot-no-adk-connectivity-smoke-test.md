---
status: pending
priority: p3
issue_id: '11028'
tags: [code-review, customer-agent, chatbot, testing, ops]
dependencies: []
---

# 11028: No ADK Connectivity Smoke Test — Broken Agent URL Ships Undetected

## Problem Statement

There are zero tests or health checks that verify the ADK Cloud Run endpoint is
actually reachable. All existing tests mock network calls. A misconfigured or missing
`CUSTOMER_AGENT_URL`, expired service account credential, or broken Cloud Run deploy
would ship silently — and did (see root cause in REVIEW-SUMMARY.md: chatbot was broken
for weeks with no automated signal).

The health endpoint (`/v1/public/chat/health`) is tenant-facing and checks env vars,
not actual connectivity. There is no internal endpoint that operations can ping to verify
the full agent auth chain works end-to-end.

## Findings

**Current health check:**

```typescript
// server/src/routes/public-customer-chat.routes.ts:128
const apiKeyConfigured = !!getConfig().CUSTOMER_AGENT_URL; // after fix from 11024
```

This checks env var presence, not agent reachability. If `CUSTOMER_AGENT_URL` is set to
a wrong URL or the Cloud Run service is down, health still returns `available: true`.

**No existing test covers:**

- Actual ADK session creation
- Identity token acquisition via service account
- Cloud Run 403 (missing auth) vs 404 (wrong session) error handling

## Proposed Solutions

### Option A — Internal ADK ping endpoint (Recommended)

Add a `/v1/internal/agents/health` route that:

1. Attempts to create a throwaway ADK session (`userId: 'health-check'`)
2. Immediately deletes it
3. Returns `{ customer_agent: 'ok' | 'unreachable' | 'unauthorized', latency_ms }`

Wire this into the existing `/health/ready` endpoint response.

**Pros:** Catches real failures. Latency data. Can page on failure.
**Cons:** Requires a valid ADK session endpoint to exist (it does).
**Effort:** Small
**Risk:** Low — throwaway session, no state

### Option B — Integration test with real ADK (run in CI with env vars)

Add a Vitest integration test that runs only when `CUSTOMER_AGENT_URL` is set:

```typescript
it.skipIf(!process.env.CUSTOMER_AGENT_URL)('can create ADK session', async () => {
  const result = await service.createSession(testTenantId, testUserId);
  expect(result.adkSessionId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
});
```

**Pros:** Tests the real auth chain in CI.
**Cons:** Requires secrets in CI; doesn't help with runtime monitoring.
**Effort:** Small
**Risk:** None

### Option C — Accept the limitation, add runbook

Document "how to verify the chatbot is working" in `DEVELOPING.md` with a curl command
that exercises the full chain.

**Pros:** Immediate. No code change.
**Cons:** Manual. Doesn't prevent the next silent breakage.
**Effort:** Trivial
**Risk:** None

## Recommended Action

Option A + Option C — the internal health endpoint gives continuous visibility; the
runbook helps for manual verification during incidents.

## Acceptance Criteria

- [ ] A health signal exists that reflects actual ADK reachability (not just env var presence)
- [ ] Can distinguish between: agent reachable | agent unreachable | auth failure
- [ ] Latency visible for on-call monitoring

## Work Log

- 2026-02-20: Found during customer chatbot end-to-end review. The chatbot was broken for
  weeks with no automated signal — this is the prevention measure.
