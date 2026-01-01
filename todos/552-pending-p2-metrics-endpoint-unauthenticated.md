---
status: pending
priority: p2
issue_id: '552'
tags: [code-review, security, agent-ecosystem, observability]
dependencies: []
---

# P2: Metrics Endpoint Exposed Without Authentication

## Problem Statement

The `/metrics`, `/metrics/json`, and `/metrics/agent` endpoints have **no authentication** and explicitly state "No authentication required - designed for scraping by monitoring tools."

These endpoints expose:

- Agent type information (`agent_type` labels)
- Tool names and usage patterns (`tool_name` labels)
- Session counts and behavior metrics
- Error rates and types
- Process memory and CPU usage

**Why it matters:** Attackers could use this information for reconnaissance - understanding system internals, identifying tools for exploitation, and monitoring when systems are under stress for timing attacks.

## Findings

| Reviewer          | Finding                                                        |
| ----------------- | -------------------------------------------------------------- |
| Security Reviewer | P2: Metrics endpoint exposes internal information without auth |

## Proposed Solutions

### Option 1: IP Allowlist for Internal Scrapers (Recommended)

**Effort:** Small (1-2 hours)

Add middleware that only allows metrics access from known IPs:

```typescript
const ALLOWED_METRICS_IPS = ['127.0.0.1', '10.0.0.0/8', 'prometheus-ip'];

metricsRouter.use((req, res, next) => {
  const clientIP = req.ip;
  if (!isAllowedIP(clientIP, ALLOWED_METRICS_IPS)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});
```

**Pros:**

- Simple to implement
- No changes to Prometheus config

**Cons:**

- Need to maintain IP list
- Won't work with dynamic IPs

### Option 2: Bearer Token for Metrics Scraping

**Effort:** Small (1-2 hours)

Require a static bearer token:

```typescript
const METRICS_TOKEN = process.env.METRICS_BEARER_TOKEN;

metricsRouter.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${METRICS_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

**Pros:**

- Works with any IP
- Easy to rotate

**Cons:**

- Token management
- Must configure Prometheus with auth

### Option 3: Render Internal Service Network

**Effort:** Small (1 hour)

If deployed on Render, use internal service networking so `/metrics` is only accessible from within the private network.

**Pros:**

- No code changes
- Platform-native security

**Cons:**

- Platform-specific

## Recommended Action

For Render deployment, combine **Option 3** (internal network) with **Option 2** (bearer token) as defense-in-depth.

## Technical Details

**Affected Files:**

- `server/src/routes/metrics.routes.ts`
- `.env.example` (add METRICS_BEARER_TOKEN)

**Current Comment in Code:**

```typescript
// No authentication required - designed for scraping by monitoring tools
```

## Acceptance Criteria

- [ ] Add authentication middleware to metrics routes
- [ ] Document METRICS_BEARER_TOKEN in .env.example
- [ ] Update Prometheus scrape config with bearer token
- [ ] Verify metrics still accessible from monitoring

## Work Log

| Date       | Action                   | Learnings                       |
| ---------- | ------------------------ | ------------------------------- |
| 2026-01-01 | Created from code review | Security Sentinel flagged as P2 |

## Resources

- Prometheus bearer token auth: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config
