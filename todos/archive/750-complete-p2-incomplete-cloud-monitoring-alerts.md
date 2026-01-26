# Incomplete Cloud Monitoring Alerts for Agent Services

## Metadata

- **ID:** 750
- **Status:** ready
- **Priority:** p2
- **Tags:** code-review, observability, devops
- **Created:** 2026-01-26
- **Source:** Legacy Agent Migration Review

## Problem Statement

Only 2 Cloud Monitoring alert policies exist, both for Project Hub Agent. The other 5 deployed agents (concierge, booking, marketing, storefront, research) have NO alert coverage for errors or latency issues.

**Impact:** Production issues with 5/6 agents will go unnoticed until users report problems.

## Findings

**Data Integrity Guardian finding:**

| Agent             | Alert Policies | Status          |
| ----------------- | -------------- | --------------- |
| project-hub-agent | 2              | Monitored       |
| concierge-agent   | 0              | **UNMONITORED** |
| booking-agent     | 0              | **UNMONITORED** |
| marketing-agent   | 0              | **UNMONITORED** |
| storefront-agent  | 0              | **UNMONITORED** |
| research-agent    | 0              | **UNMONITORED** |

The documentation (`docs/architecture/VERTEX_AI_NATIVE_EVALUATION.md`) includes recommended alert configurations but they are not implemented.

## Proposed Solutions

### Option 1: Create alert policies via GCP Console (Recommended)

Follow the templates in VERTEX_AI_NATIVE_EVALUATION.md to create:

- Error rate alert (>1% over 5 min)
- Latency alert (p95 >5s)

For each of the 5 unmonitored agents.

**Pros:** Uses existing documentation, quick to implement
**Cons:** Manual GCP console work
**Effort:** Medium (1-2 hours)
**Risk:** Low

### Option 2: Terraform/Infrastructure-as-Code

Create Terraform configs for alert policies.

**Pros:** Reproducible, version controlled
**Cons:** Requires Terraform setup if not already in place
**Effort:** Large
**Risk:** Low

### Option 3: Accept current coverage

Project Hub is most critical; others have Cloud Logging for manual inspection.

**Pros:** No work required
**Cons:** Silent failures in production
**Effort:** None
**Risk:** Medium

## Technical Details

**Services to add alerts for:**

- `concierge-agent` - Primary customer-facing
- `booking-agent` - Customer booking flow
- `marketing-agent` - Content generation
- `storefront-agent` - Storefront editing
- `research-agent` - Market research

## Acceptance Criteria

- [ ] All 6 agents have error rate alert (>1% threshold)
- [ ] All 6 agents have latency alert (p95 >5s threshold)
- [ ] Alert notifications route to appropriate channel (email/Slack)

## Work Log

| Date       | Action                   | Learnings                               |
| ---------- | ------------------------ | --------------------------------------- |
| 2026-01-26 | Created from code review | Phase 4 only partially completed alerts |

## Resources

- Alert templates: `docs/architecture/VERTEX_AI_NATIVE_EVALUATION.md`
- GCP Monitoring: https://console.cloud.google.com/monitoring
