# Vertex AI Native Evaluation & Observability

**Created:** 2026-01-26
**Status:** Active
**Replaces:** Legacy `server/src/agent/evals/` system (deleted in Phase 3b)

---

## Overview

MAIS uses Google Cloud's native observability tools for agent evaluation and monitoring. This replaces the custom evaluation framework that was deleted during the legacy agent migration.

**Key Benefits:**

- Zero maintenance overhead - Google manages the infrastructure
- Automatic integration with Cloud Run services
- Built-in distributed tracing across agent-to-agent calls
- Real-time alerting without custom code

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY STACK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Cloud Trace  │    │Cloud Logging │    │  Cloud       │       │
│  │              │    │              │    │  Monitoring  │       │
│  │ Distributed  │    │ Structured   │    │  Metrics &   │       │
│  │ Tracing      │    │ Logs         │    │  Alerts      │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             │                                    │
│                    ┌────────▼────────┐                           │
│                    │  Cloud Run      │                           │
│                    │  Agent Services │                           │
│                    └─────────────────┘                           │
│                                                                  │
│  Agents: concierge-agent, booking-agent, marketing-agent,       │
│          storefront-agent, research-agent, project-hub-agent    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Cloud Trace (Distributed Tracing)

**Status:** Enabled (initialized 2026-01-26)

Cloud Trace provides distributed tracing across all Cloud Run agent services.

**Access:** [Cloud Trace Explorer](https://console.cloud.google.com/traces/explorer?project=handled-484216)

**Use Cases:**

- Track request flow: Backend → Concierge → Specialist agents
- Identify latency bottlenecks in agent chains
- Debug slow responses by examining span durations
- Correlate errors across multiple services

**Key Metrics:**

- Span duration (heatmap view)
- Service latency percentiles (p50, p95, p99)
- Error rates by span

### 2. Cloud Monitoring (Metrics & Alerts)

**Status:** Active with 2 alert policies

**Access:** [Cloud Monitoring Alerting](https://console.cloud.google.com/monitoring/alerting?project=handled-484216)

**Existing Alert Policies:**

| Policy Name                         | Type    | Condition              | Created    |
| ----------------------------------- | ------- | ---------------------- | ---------- |
| Project Hub Agent - Slow Tool Calls | Metrics | Tool latency threshold | 2026-01-24 |
| Project Hub Agent - Tool Errors     | Metrics | Error rate threshold   | 2026-01-24 |

**Adding New Alerts:**

1. Navigate to Cloud Monitoring → Alerting → Create Policy
2. Select metric type (e.g., `run.googleapis.com/request_latencies`)
3. Configure threshold and aggregation
4. Add notification channels (email, Slack, PagerDuty)

**Recommended Alerts for All Agents:**

```yaml
# Example: High Error Rate Alert
metric: run.googleapis.com/request_count
filter: resource.type="cloud_run_revision" AND metric.labels.response_code_class="5xx"
threshold: > 5 errors in 5 minutes
severity: Critical

# Example: High Latency Alert
metric: run.googleapis.com/request_latencies
filter: resource.type="cloud_run_revision"
threshold: p95 > 10000ms (10 seconds)
severity: Warning
```

### Alert Policy Setup Guide

**Current Coverage:**

| Agent             | Error Rate Alert | Latency Alert | Status           |
| ----------------- | ---------------- | ------------- | ---------------- |
| project-hub-agent | ✅               | ✅            | Monitored        |
| concierge-agent   | ❌               | ❌            | **Needs alerts** |
| booking-agent     | ❌               | ❌            | **Needs alerts** |
| marketing-agent   | ❌               | ❌            | **Needs alerts** |
| storefront-agent  | ❌               | ❌            | **Needs alerts** |
| research-agent    | ❌               | ❌            | **Needs alerts** |

**Recommended Thresholds:**

- **Error Rate:** Alert if error rate exceeds 1% over a 5-minute window
- **Latency:** Alert if p95 latency exceeds 5 seconds

#### Step 1: Create Error Rate Alert

1. Navigate to [Cloud Monitoring Alerting](https://console.cloud.google.com/monitoring/alerting?project=handled-484216)
2. Click **+ CREATE POLICY**
3. Click **Select a metric**
4. In the metric selector:
   - Resource type: `Cloud Run Revision`
   - Metric: `Request count` (`run.googleapis.com/request_count`)
5. Click **Apply**
6. Add a filter:
   - Click **Add filter**
   - Field: `service_name`
   - Value: `concierge-agent` (or the agent you're configuring)
7. Add another filter:
   - Field: `response_code_class`
   - Value: `5xx`
8. Configure the threshold:
   - Rolling window: `5 min`
   - Rolling window function: `rate`
   - Condition: `Is above`
   - Threshold: `0.01` (1%)
9. Click **Next**
10. Configure notifications:
    - Add your notification channel (email, Slack, etc.)
11. Name the alert: `[Agent Name] - Error Rate > 1%`
    - Example: `Concierge Agent - Error Rate > 1%`
12. Click **CREATE POLICY**

#### Step 2: Create Latency Alert

1. Navigate to [Cloud Monitoring Alerting](https://console.cloud.google.com/monitoring/alerting?project=handled-484216)
2. Click **+ CREATE POLICY**
3. Click **Select a metric**
4. In the metric selector:
   - Resource type: `Cloud Run Revision`
   - Metric: `Request latencies` (`run.googleapis.com/request_latencies`)
5. Click **Apply**
6. Add a filter:
   - Click **Add filter**
   - Field: `service_name`
   - Value: `concierge-agent` (or the agent you're configuring)
7. Configure the aggregation:
   - Aggregation: `95th percentile`
8. Configure the threshold:
   - Rolling window: `5 min`
   - Condition: `Is above`
   - Threshold: `5000` (5 seconds in milliseconds)
9. Click **Next**
10. Configure notifications:
    - Add your notification channel (email, Slack, etc.)
11. Name the alert: `[Agent Name] - P95 Latency > 5s`
    - Example: `Concierge Agent - P95 Latency > 5s`
12. Click **CREATE POLICY**

#### Agents Requiring Alert Setup

Create both alert types (error rate + latency) for each of these agents:

1. **concierge-agent** - Orchestrator for tenant dashboard
2. **booking-agent** - Customer booking flow (high priority - handles payments)
3. **marketing-agent** - Marketing content generation
4. **storefront-agent** - Storefront configuration
5. **research-agent** - Business research tools

**Total alerts to create:** 10 (2 per agent × 5 agents)

#### Alert Naming Convention

Use consistent naming for easy filtering:

```
[Agent Display Name] - [Metric Type] [Condition]
```

Examples:

- `Concierge Agent - Error Rate > 1%`
- `Concierge Agent - P95 Latency > 5s`
- `Booking Agent - Error Rate > 1%`
- `Booking Agent - P95 Latency > 5s`

#### MQL Queries (Advanced)

For users who prefer MQL (Monitoring Query Language):

**Error Rate Alert:**

```
fetch cloud_run_revision
| metric 'run.googleapis.com/request_count'
| filter resource.service_name == 'concierge-agent'
| filter metric.response_code_class == '5xx'
| align rate(5m)
| every 1m
| condition val() > 0.01
```

**Latency Alert:**

```
fetch cloud_run_revision
| metric 'run.googleapis.com/request_latencies'
| filter resource.service_name == 'concierge-agent'
| align p95(5m)
| every 1m
| condition val() > 5000
```

---

### 3. Cloud Logging (Structured Logs)

**Access:** [Logs Explorer](https://console.cloud.google.com/logs/query?project=handled-484216)

**Useful Queries:**

```
# All agent errors
resource.type="cloud_run_revision"
resource.labels.service_name=~".*-agent"
severity>=ERROR

# Specific agent logs
resource.type="cloud_run_revision"
resource.labels.service_name="concierge-agent"

# Tool execution logs
resource.type="cloud_run_revision"
jsonPayload.message=~"tool"
```

### 4. Cloud Run Built-in Metrics

Each Cloud Run service automatically exposes metrics via the Observability tab:

**Access:** Cloud Run → [service-name] → Observability

**Available Metrics:**

- Request count (by status code)
- Request latencies (p50, p95, p99)
- End-to-end request latency
- Latency breakdown (cold start vs execution)
- Instance count
- Memory utilization
- CPU utilization

---

## Trajectory Evaluation

For evaluating agent behavior (tool calling sequences), use manual testing with Cloud Trace analysis:

### Manual Trajectory Verification

1. **Trigger a known scenario** (e.g., booking request)
2. **Open Cloud Trace** and find the trace
3. **Verify tool sequence** matches expected:

```
Expected Booking Flow:
1. [Concierge] Receive request
2. [Concierge] Route to booking-agent
3. [Booking] get_availability tool
4. [Booking] get_services tool
5. [Booking] create_booking tool
6. [Booking] Return confirmation
```

### Future: Automated Trajectory Evaluation

When Vertex AI GenAI Evaluation supports Cloud Run agents, implement:

```python
# Planned: Vertex AI Evaluation API
from google.cloud import aiplatform

evaluation_config = {
    "metrics": [
        "trajectory_exact_match",
        "trajectory_precision",
        "trajectory_recall"
    ],
    "reference_trajectories": [
        {
            "user_input": "I want to book a wedding session",
            "expected_tools": [
                "get_services",
                "check_availability",
                "create_booking"
            ]
        }
    ]
}
```

---

## Deployed Agents Reference

| Agent             | Cloud Run URL                                              | Last Deploy | Purpose                           |
| ----------------- | ---------------------------------------------------------- | ----------- | --------------------------------- |
| concierge-agent   | https://concierge-agent-506923455711.us-central1.run.app   | 2026-01-25  | Orchestrator for tenant dashboard |
| booking-agent     | https://booking-agent-506923455711.us-central1.run.app     | 2026-01-18  | Customer booking flow             |
| marketing-agent   | https://marketing-agent-506923455711.us-central1.run.app   | 2026-01-18  | Marketing content generation      |
| storefront-agent  | https://storefront-agent-506923455711.us-central1.run.app  | 2026-01-25  | Storefront configuration          |
| research-agent    | https://research-agent-506923455711.us-central1.run.app    | 2026-01-18  | Business research tools           |
| project-hub-agent | https://project-hub-agent-506923455711.us-central1.run.app | 2026-01-25  | Customer project management       |

**Full registry:** `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`

---

## Comparison: Old vs New

| Aspect             | Old (Deleted)      | New (Vertex AI Native)    |
| ------------------ | ------------------ | ------------------------- |
| Metrics collection | Custom code        | Cloud Run automatic       |
| Tracing            | Custom spans       | Cloud Trace automatic     |
| Alerts             | Manual checks      | Cloud Monitoring policies |
| Trajectory eval    | Custom evaluator   | Manual + future Vertex AI |
| Maintenance        | High (custom code) | Zero (managed service)    |
| Cost               | Compute + storage  | Pay-per-use (minimal)     |

---

## Quick Reference URLs

| Tool               | URL                                                                         |
| ------------------ | --------------------------------------------------------------------------- |
| Cloud Run Services | https://console.cloud.google.com/run?project=handled-484216                 |
| Cloud Trace        | https://console.cloud.google.com/traces/explorer?project=handled-484216     |
| Cloud Monitoring   | https://console.cloud.google.com/monitoring?project=handled-484216          |
| Alerting Policies  | https://console.cloud.google.com/monitoring/alerting?project=handled-484216 |
| Logs Explorer      | https://console.cloud.google.com/logs/query?project=handled-484216          |
| Error Reporting    | https://console.cloud.google.com/errors?project=handled-484216              |

---

## Related Documentation

- `server/src/agent-v2/deploy/SERVICE_REGISTRY.md` - Agent deployment registry
- `docs/adrs/ADR-018-hub-and-spoke-agent-architecture.md` - Architecture decision
- `plans/LEGACY_AGENT_MIGRATION_PLAN.md` - Migration history

---

## Changelog

- **2026-01-26:** Added Alert Policy Setup Guide
  - Step-by-step instructions for creating error rate and latency alerts
  - Listed 5 agents needing alerts (concierge, booking, marketing, storefront, research)
  - Added MQL query examples for advanced users
- **2026-01-26:** Initial setup
  - Enabled Cloud Trace storage
  - Verified existing monitoring alerts
  - Created this documentation
