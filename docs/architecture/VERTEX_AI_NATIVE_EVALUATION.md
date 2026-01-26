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

- **2026-01-26:** Initial setup
  - Enabled Cloud Trace storage
  - Verified existing monitoring alerts
  - Created this documentation
