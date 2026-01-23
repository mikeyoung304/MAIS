# Cloud Run Agent Deployment Prevention

**Problem ID:** CI-CLOUDRUN-001
**Discovered:** 2026-01-23
**Severity:** HIGH - Agent features don't deploy despite code merging

## The Problem

Cloud Run agent deployments failed silently for 3+ days. Code merged to `main` included T3 confirmation enforcement, TTLCache fixes, and other agent improvements - none of which deployed to production.

## Root Cause

Two issues combined to create silent failures:

### Issue 1: Missing Workflow Permissions

The `deploy-agents.yml` workflow used Workload Identity Federation but lacked the required `id-token: write` permission:

```yaml
# BROKEN - No permissions block
deploy-agent:
  name: Deploy ${{ matrix.agent }}
  runs-on: ubuntu-latest
  # ... no permissions specified
```

**Error:**

```
google-github-actions/auth failed with: GitHub Actions did not inject
$ACTIONS_ID_TOKEN_REQUEST_TOKEN or $ACTIONS_ID_TOKEN_REQUEST_URL into this job.
```

### Issue 2: Invalid Health Check Endpoint

The workflow tried to verify deployment by hitting `/health`, which ADK agents don't expose:

```yaml
# BROKEN - ADK agents don't have /health
HTTP_STATUS=$(curl "$SERVICE_URL/health")
# Returns 404 or 403
```

## The Fix

### Fix 1: Add Workload Identity Permissions

```yaml
deploy-agent:
  name: Deploy ${{ matrix.agent }}
  runs-on: ubuntu-latest

  # Required for Workload Identity Federation with Google Cloud
  permissions:
    contents: read
    id-token: write
```

### Fix 2: Use gcloud Service Status Instead of HTTP Health Check

```yaml
# CORRECT - Use Cloud Run's built-in status
SERVICE_STATUS=$(gcloud run services describe ${{ matrix.agent }}-agent \
--region=${{ env.GOOGLE_CLOUD_REGION }} \
--format='value(status.conditions[0].status)')

if [ "$SERVICE_STATUS" = "True" ]; then
echo "Service is healthy"
fi
```

## Why This Went Undetected

1. **Narrow trigger paths** - Workflow only runs on changes to `server/src/agent-v2/deploy/*/src/**`
2. **Recent work elsewhere** - Most commits touched main agent code, not deploy directories
3. **No workflow failure alerting** - GitHub Actions failures don't notify by default
4. **Dual deployment architecture** - Backend (Render) and Frontend (Vercel) deploy separately from Agents (Cloud Run)

## Prevention Checklist

When creating new GitHub Actions workflows with Google Cloud:

- [ ] Add `permissions: { contents: read, id-token: write }` for Workload Identity Federation
- [ ] Use `gcloud` commands for health checks, not custom HTTP endpoints
- [ ] Set up workflow failure notifications (Slack, email, etc.)
- [ ] Document the workflow in `WORKFLOWS_README.md`
- [ ] Test workflow changes with `workflow_dispatch` before relying on auto-triggers

## Detection Commands

```bash
# Check recent Cloud Run deployment runs
gh run list --workflow="Deploy AI Agents to Cloud Run" --limit 5

# View failure logs
gh run view <run-id> --log-failed

# Manually trigger deployment to test fixes
gh workflow run "Deploy AI Agents to Cloud Run" --field agent=all --field force=true

# Verify services are deployed
gcloud run services list --project=handled-484216 --region=us-central1
```

## Related

- **Pitfall #54:** Dual deployment architecture - agents deploy separately via GitHub Actions
- **Pitfall #55:** Agent deployment verification - check GitHub Actions after merging agent changes
- `docs/solutions/ci-cd/SILENT_CI_FAILURES_PREVENTION.md` - Related CI failure patterns

## Commits

- `a9244be9` - Add id-token permission
- `1d21bc99` - Add authentication to health checks (intermediate fix)
- `4e8628b3` - Use gcloud service status for health checks (final fix)
