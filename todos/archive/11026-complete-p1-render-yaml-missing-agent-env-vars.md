---
status: pending
priority: p1
issue_id: '11026'
tags: [code-review, ops, deployment, render, chatbot]
dependencies: []
---

# 11026: render.yaml Missing Critical Agent Env Vars — Operational Gap

## Problem Statement

The following env vars are required for the chatbot (and tenant agent) to function,
but are absent from `render.yaml`:

- `BOOKING_TOKEN_SECRET` — **required (Zod min 32 chars) — server crashes at startup if unset**
- `CUSTOMER_AGENT_URL`
- `TENANT_AGENT_URL`
- `RESEARCH_AGENT_URL`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`

They ARE manually set in the Render dashboard (confirmed by production logs). But
`render.yaml` is the infrastructure-as-code source of truth. Any blueprint redeployment,
new developer onboarding, or disaster recovery would be missing these with no
documented trail in code. This was the original cause of "chatbot never worked" —
they weren't set at all initially.

## Findings

**File:** `render.yaml`

The file ends at `GOOGLE_VERTEX_LOCATION`. All agent-related vars and auth credentials
are absent.

**Confirmed working (from production logs):**

```
[CustomerAgent] ADK session created  ← CUSTOMER_AGENT_URL is set
[CloudRunAuth] Initialized with service account credentials  ← GOOGLE_SERVICE_ACCOUNT_JSON is set
```

## Proposed Solution

Add `sync: false` placeholder entries to `render.yaml`:

```yaml
- key: BOOKING_TOKEN_SECRET
  sync: false # REQUIRED: min 32 chars — server crashes at startup if unset
- key: CUSTOMER_AGENT_URL
  sync: false # Cloud Run URL for customer-facing agent
- key: TENANT_AGENT_URL
  sync: false # Cloud Run URL for tenant admin agent
- key: RESEARCH_AGENT_URL
  sync: false # Cloud Run URL for web research agent (optional)
- key: GOOGLE_SERVICE_ACCOUNT_JSON
  sync: false # GCP service account JSON for Cloud Run auth (required on Render)
- key: GOOGLE_CLOUD_PROJECT
  sync: false # GCP project ID (e.g., handled-484216)
- key: GOOGLE_CLOUD_LOCATION
  sync: false # GCP region (e.g., us-central1)
```

**Pros:** Documents the required vars in code. `sync: false` means Render won't try
to sync values from a file; they remain manually managed in the dashboard.
**Effort:** Trivial
**Risk:** None — values stay in dashboard, YAML just documents them.

## Acceptance Criteria

- [ ] All agent env vars documented in render.yaml with `sync: false`
- [ ] Verified the dashboard values are unchanged after commit

## Work Log

- 2026-02-20: Found during review. These were the original missing vars that prevented the chatbot from ever working.
- 2026-02-20: Upgraded from P2 to P1 — integration review determined this is a critical ops/deployment gap.
