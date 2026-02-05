# ADK Agent Service Registry

This document tracks all deployed ADK agent services to prevent naming conflicts.

**IMPORTANT:** Update this registry BEFORE deploying a new agent.

---

## Active Services

| Agent Name | Service Name     | Cloud Run URL                                           | Status | Last Deploy |
| ---------- | ---------------- | ------------------------------------------------------- | ------ | ----------- |
| customer   | `customer-agent` | https://customer-agent-506923455711.us-central1.run.app | Active | 2026-01-31  |
| research   | `research-agent` | https://research-agent-506923455711.us-central1.run.app | Active | 2026-01-18  |
| tenant     | `tenant-agent`   | https://tenant-agent-506923455711.us-central1.run.app   | Active | 2026-01-31  |

## Archived Services (Retired)

| Agent Name  | Former Service Name | Retired Date | Reason                                            |
| ----------- | ------------------- | ------------ | ------------------------------------------------- |
| storefront  | `storefront-agent`  | 2026-01-30   | Tools migrated to tenant-agent (Phase 2b)         |
| marketing   | `marketing-agent`   | 2026-01-30   | Tools migrated to tenant-agent (Phase 2c)         |
| concierge   | `concierge-agent`   | 2026-01-30   | Routing absorbed into tenant-agent (Phase 2d)     |
| booking     | `booking-agent`     | 2026-01-31   | Tools migrated to customer-agent (Phase 3)        |
| project-hub | `project-hub-agent` | 2026-01-31   | Tools migrated to customer+tenant-agent (Phase 3) |

> **Note:** After Phase 3 migration:
>
> - `tenant-agent` handles all tenant-facing tasks (storefront, marketing, project management)
> - `customer-agent` handles all customer-facing tasks (booking, project hub)
> - See `docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md` for migration plan.
> - Archived agents are available in git history for reference (retired agents: concierge, marketing, storefront, booking, project-hub).

---

## Naming Convention

### Pattern

```
{agent-name}-agent
```

### Examples

- `booking-agent` (correct)
- `storefront-agent` (correct)
- `adk-agent` (WRONG - default, will conflict)
- `my-cool-agent` (WRONG - doesn't follow pattern)

### Rules

1. All lowercase
2. Single word or hyphenated identifier
3. MUST end with `-agent` suffix
4. MUST be unique across all agents

---

## Reserved Names (DO NOT USE)

| Name         | Reason                         |
| ------------ | ------------------------------ |
| `adk-agent`  | ADK default - causes conflicts |
| `agent`      | Too generic                    |
| `default`    | Reserved                       |
| `test-agent` | Reserved for testing           |

---

## Adding a New Agent

### Pre-Deployment Checklist

1. **Choose unique name** following `{name}-agent` pattern
2. **Verify uniqueness** - Check table above
3. **Add to registry** - Update table BEFORE deploying
4. **Use template** - Copy from existing agent's package.json
5. **Validate** - Run `bash server/src/agent-v2/scripts/validate-deploy-config.sh`

### After Deployment

1. Update the "Cloud Run URL" column
2. Update the "Status" column to "Active"
3. Update the "Last Deploy" column with date

---

## Verification Commands

```bash
# List all Cloud Run services in project
gcloud run services list --region=us-central1 --project=handled-484216

# Verify specific service exists
gcloud run services describe booking-agent --region=us-central1 --project=handled-484216

# Get service URL
gcloud run services describe booking-agent --region=us-central1 --project=handled-484216 --format='value(status.url)'

# Test service health
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://booking-agent-506923455711.us-central1.run.app/list-apps
```

---

## Troubleshooting

### "Wrong agent responding after deployment"

**Cause:** Deployed without `--service_name`, overwrote existing service

**Fix:**

1. Re-deploy the overwritten agent: `cd server/src/agent-v2/deploy/{agent} && npm run deploy`
2. Add `--service_name` to the conflicting agent's package.json
3. Re-deploy the conflicting agent

### "Service already exists error"

**Cause:** Trying to create service with name already in use

**Fix:**

1. Check this registry for existing service
2. Choose a different name
3. Update registry and retry

---

## Related Documentation

- [ADK Deployment Pattern](../../docs/solutions/patterns/adk-agent-deployment-pattern.md)
- [Service Name Prevention](../../docs/solutions/patterns/ADK_CLOUD_RUN_SERVICE_NAME_PREVENTION.md)
- [Quick Reference](../../docs/solutions/patterns/ADK_CLOUD_RUN_SERVICE_NAME_QUICK_REFERENCE.md)

---

**Last Updated:** 2026-02-05 (removed phantom archive directory references; agents available in git history)
