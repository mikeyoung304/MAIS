---
status: pending
priority: p1
issue_id: '570'
tags: [code-review, devops, production, infrastructure]
dependencies: []
---

# P1: Production API Running on Render Free Tier

## Problem Statement

The production API is deployed on Render's free tier (`plan: free` in render.yaml), which has severe limitations:

- **Cold starts**: Pods spin down after 15 minutes of inactivity
- **No SLA**: No uptime guarantees
- **Limited resources**: Insufficient memory/CPU for production workloads
- **Latency spikes**: First request after cold start can take 30+ seconds

This is a **production reliability issue** that can cause significant user experience problems.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/render.yaml` (line 10)

```yaml
services:
  - type: web
    name: mais-api
    plan: free # PROBLEM: Free tier in production
```

**Evidence from DevOps agent:**

- Render free tier has 15-minute inactivity timeout
- No guaranteed uptime SLA
- Limited compute resources cause request timeouts under load

## Proposed Solutions

### Option A: Upgrade to Starter Plan (Recommended)

**Pros:** Always-on, no cold starts, basic SLA, affordable ($7/month)
**Cons:** Monthly cost
**Effort:** Small (config change)
**Risk:** Low

### Option B: Add Keep-Alive Cron Job

**Pros:** Free, prevents cold starts
**Cons:** Wasteful, doesn't solve resource limits, still no SLA
**Effort:** Small
**Risk:** Medium (doesn't fully solve the problem)

### Option C: Migrate to Different Provider

**Pros:** More control, better pricing at scale
**Cons:** Significant effort, new tooling to learn
**Effort:** Large
**Risk:** Medium

## Recommended Action

**Choose Option A** - Upgrade to Render Starter plan

## Technical Details

**Affected files:**

- `render.yaml` - Change `plan: free` to `plan: starter`

**Database changes:** None

## Acceptance Criteria

- [ ] `render.yaml` updated with `plan: starter` for production API
- [ ] Staging can remain on free tier
- [ ] Billing confirmed and approved
- [ ] No more cold start latency spikes observed

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2026-01-01 | Created | Found during comprehensive code review |

## Resources

- [Render Pricing](https://render.com/pricing)
- render.yaml configuration
