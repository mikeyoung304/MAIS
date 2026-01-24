# Project Hub Agent - Performance Baseline

**Date Established:** 2026-01-24 (Phase 2)
**Status:** Instrumentation Deployed

---

## Overview

This document tracks performance baselines for the Project Hub agent. Metrics are collected via structured logging to Cloud Logging, enabling p50/p95 analysis through Log Analytics.

## Metrics Collection

### Log Format

Tool calls emit structured JSON logs with the following fields:

```json
{
  "level": "info",
  "msg": "[ProjectHub] Tool get_project_status completed in 234ms",
  "metric": "tool_latency",
  "toolName": "get_project_status",
  "durationMs": 234,
  "success": true,
  "bucket": "normal",
  "timestamp": "2026-01-24T12:34:56.789Z"
}
```

### Performance Buckets

| Bucket    | Duration       | Target |
| --------- | -------------- | ------ |
| fast      | < 100ms        | 80%    |
| normal    | 100ms - 500ms  | 15%    |
| slow      | 500ms - 2000ms | 5%     |
| very_slow | > 2000ms       | 0%     |

## Cloud Logging Queries

### Query Tool Latency (Last Hour)

```sql
-- Cloud Logging Log Analytics SQL
SELECT
  jsonPayload.toolName,
  COUNT(*) as total_calls,
  APPROX_QUANTILES(CAST(jsonPayload.durationMs AS INT64), 100)[OFFSET(50)] as p50_ms,
  APPROX_QUANTILES(CAST(jsonPayload.durationMs AS INT64), 100)[OFFSET(95)] as p95_ms,
  APPROX_QUANTILES(CAST(jsonPayload.durationMs AS INT64), 100)[OFFSET(99)] as p99_ms,
  AVG(CAST(jsonPayload.durationMs AS INT64)) as avg_ms,
  COUNTIF(jsonPayload.success = true) / COUNT(*) * 100 as success_rate
FROM `handled-484216.global._Default._AllLogs`
WHERE
  resource.type = "cloud_run_revision"
  AND resource.labels.service_name = "project-hub-agent"
  AND jsonPayload.metric = "tool_latency"
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
GROUP BY jsonPayload.toolName
ORDER BY total_calls DESC;
```

### Query Latency Distribution by Bucket

```sql
SELECT
  jsonPayload.toolName,
  jsonPayload.bucket,
  COUNT(*) as count
FROM `handled-484216.global._Default._AllLogs`
WHERE
  resource.type = "cloud_run_revision"
  AND resource.labels.service_name = "project-hub-agent"
  AND jsonPayload.metric = "tool_latency"
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY jsonPayload.toolName, jsonPayload.bucket
ORDER BY jsonPayload.toolName, jsonPayload.bucket;
```

### Query Error Rates by Tool

```sql
SELECT
  jsonPayload.toolName,
  COUNTIF(jsonPayload.success = false) as errors,
  COUNT(*) as total,
  COUNTIF(jsonPayload.success = false) / COUNT(*) * 100 as error_rate,
  ARRAY_AGG(DISTINCT jsonPayload.errorType IGNORE NULLS LIMIT 5) as error_types
FROM `handled-484216.global._Default._AllLogs`
WHERE
  resource.type = "cloud_run_revision"
  AND resource.labels.service_name = "project-hub-agent"
  AND jsonPayload.metric = "tool_latency"
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY jsonPayload.toolName
HAVING errors > 0
ORDER BY error_rate DESC;
```

## gcloud CLI Commands

### View Recent Tool Calls

```bash
# View last 100 tool latency logs
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="project-hub-agent" AND jsonPayload.metric="tool_latency"' \
  --project=handled-484216 \
  --limit=100 \
  --format='table(jsonPayload.toolName,jsonPayload.durationMs,jsonPayload.success,jsonPayload.bucket)'
```

### View Slow Calls Only

```bash
# Calls taking > 2 seconds
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="project-hub-agent" AND jsonPayload.metric="tool_latency" AND jsonPayload.bucket="very_slow"' \
  --project=handled-484216 \
  --limit=50 \
  --format='json'
```

### View Errors Only

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="project-hub-agent" AND jsonPayload.metric="tool_latency" AND jsonPayload.success=false' \
  --project=handled-484216 \
  --limit=50 \
  --format='table(jsonPayload.toolName,jsonPayload.durationMs,jsonPayload.errorType)'
```

## Expected Baseline Values

Based on Phase 1 deployment characteristics:

| Tool                            | Expected p50 | Expected p95 | Notes                               |
| ------------------------------- | ------------ | ------------ | ----------------------------------- |
| `bootstrap_project_hub_session` | ~200ms       | ~500ms       | Initial session + API call          |
| `get_project_status`            | ~150ms       | ~400ms       | Single API call                     |
| `get_prep_checklist`            | ~150ms       | ~400ms       | Single API call                     |
| `answer_prep_question`          | ~200ms       | ~600ms       | May include LLM processing          |
| `submit_request`                | ~300ms       | ~800ms       | Write operation + event logging     |
| `get_timeline`                  | ~150ms       | ~400ms       | Read operation                      |
| `get_pending_requests`          | ~150ms       | ~400ms       | Read operation                      |
| `get_customer_activity`         | ~200ms       | ~500ms       | Aggregation query                   |
| `approve_request`               | ~300ms       | ~800ms       | Write + event logging               |
| `deny_request`                  | ~300ms       | ~800ms       | Write + event logging               |
| `send_message_to_customer`      | ~400ms       | ~1000ms      | Write + optional email notification |
| `update_project_status`         | ~300ms       | ~800ms       | Write + event logging               |

**SLO Target:** p95 < 3000ms for all tools

## Monitoring Alerts (Phase 3)

To be implemented in Phase 3:

1. **High Latency Alert:** p95 > 3000ms for any tool over 5 minute window
2. **Error Rate Alert:** > 5% error rate for any tool over 5 minute window
3. **Slow Bucket Alert:** > 10% of calls in "very_slow" bucket over 15 minute window

## Baseline Collection Process

1. Deploy instrumentation (Phase 2 - Complete)
2. Wait for production traffic (1 week recommended)
3. Run queries above to establish actual baseline
4. Update this document with measured values
5. Set alerts based on baseline + margin

## Related Documentation

- [PROJECT_HUB_ARCHITECTURE.md](../architecture/PROJECT_HUB_ARCHITECTURE.md)
- [Phase 1 Deployment Report](../deployment/PROJECT_HUB_PHASE_1_DEPLOYMENT_REPORT.md)

---

## Baseline Measurements

### Initial Measurement: [PENDING]

_Baseline will be recorded here after 1 week of production traffic._

| Tool | Calls | p50 | p95 | p99 | Success Rate |
| ---- | ----- | --- | --- | --- | ------------ |
| TBD  | -     | -   | -   | -   | -            |

---

**Last Updated:** 2026-01-24
**Author:** Claude Opus 4.5
