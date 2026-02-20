---
status: pending
priority: p1
issue_id: '11024'
tags: [code-review, customer-agent, chatbot, health-check, ops]
dependencies: []
---

# 11024: Health Check Uses Wrong Env Var — Lies About Chatbot Availability

## Problem Statement

The `/v1/public/chat/health` endpoint checks `GOOGLE_VERTEX_PROJECT` to determine
if chat is available. The actual chat operation requires `CUSTOMER_AGENT_URL`. If
`CUSTOMER_AGENT_URL` is unset or misconfigured, health returns `available: true`
but every chat message fails with "Connection issue."

This is why multiple previous "fix" agents incorrectly declared the chatbot working —
they checked the health endpoint and saw `available: true`.

## Findings

**File:** `server/src/routes/public-customer-chat.routes.ts:128`

```typescript
const apiKeyConfigured = !!getConfig().GOOGLE_VERTEX_PROJECT; // ❌ wrong var
```

`GOOGLE_VERTEX_PROJECT` is used for the tenant admin Vertex AI integration,
not for the customer agent. The customer agent uses `CUSTOMER_AGENT_URL` (Cloud Run).

## Proposed Solutions

### Option A — Check CUSTOMER_AGENT_URL (Recommended)

```typescript
const apiKeyConfigured = !!getConfig().CUSTOMER_AGENT_URL;
```

**Pros:** Accurately reflects whether the customer agent is reachable.
**Effort:** Trivial
**Risk:** None

### Option B — Check both (belt-and-suspenders)

```typescript
const apiKeyConfigured = !!getConfig().CUSTOMER_AGENT_URL && !!getConfig().GOOGLE_VERTEX_PROJECT;
```

**Pros:** More complete — covers both the agent URL and the GCP project.
**Effort:** Trivial
**Risk:** None

## Recommended Action

Option A — `CUSTOMER_AGENT_URL` is the primary gating dependency.

## Acceptance Criteria

- [ ] Health endpoint returns `available: false` with `reason: 'api_not_configured'` when `CUSTOMER_AGENT_URL` is unset
- [ ] Health endpoint returns `available: true` when both tenant and `CUSTOMER_AGENT_URL` are present
- [ ] Unit test for the health endpoint updated to cover this case

## Work Log

- 2026-02-20: Found during review. Root cause of why previous "fixes" were declared working incorrectly.
- 2026-02-20: Upgraded from P2 to P1 — integration review determined this is a critical correctness issue.
