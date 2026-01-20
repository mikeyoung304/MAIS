---
title: 'ADK Cloud Run Deploy Overwrites Previous Agents with Default Service Name'
created: '2026-01-18'
category: 'deployment'
tags:
  - 'google-adk'
  - 'cloud-run'
  - 'multi-agent'
  - 'deployment-configuration'
  - 'service-naming'
severity: 'high'
component: 'server/src/agent-v2/deploy'
symptoms:
  - 'Only one Cloud Run service visible after deploying multiple agents'
  - "Service named 'adk-default-service-name' instead of agent-specific name"
  - 'Later agent deployments silently overwrite earlier ones'
  - 'gcloud run services list shows fewer services than expected'
  - 'Agent endpoints return responses from wrong agent'
---

# ADK Cloud Run Multi-Agent Service Naming Issue

## Problem Summary

When deploying multiple ADK agents to Cloud Run using `npx adk deploy cloud_run`, all agents are deployed to the same service called `adk-default-service-name` unless the `--service_name` option is explicitly provided. This causes previously deployed agents to be overwritten by subsequent deployments.

## Symptoms

1. Deploy Agent A with `npm run deploy` - appears successful
2. Service URL shows: `adk-default-service-name-{project-number}.{region}.run.app`
3. Deploy Agent B - also appears successful
4. Running `gcloud run services list` shows only one "adk-default-service-name" service
5. Agent A is no longer accessible - it has been replaced by Agent B

## Root Cause

The Google ADK CLI (`@google/adk ^0.2.4`) has a default value for the `--service_name` option:

```bash
$ npx adk deploy cloud_run --help
# Output shows:
#   --service_name [string]  Optional. The service name to use in Cloud Run.
#                            Default: "adk-default-service-name"
```

When `--service_name` is not specified, **ALL agents deploy to the same Cloud Run service**, causing overwrites.

## Solution

**Always specify `--service_name` explicitly in deploy scripts.**

### Correct package.json deploy script

```json
{
  "scripts": {
    "deploy": "npm run build && npx adk deploy cloud_run --project=${GOOGLE_CLOUD_PROJECT:-handled-484216} --region=${GOOGLE_CLOUD_LOCATION:-us-central1} --service_name={agent-name}-agent",
    "deploy:dry-run": "npm run build && npx adk deploy cloud_run --project=${GOOGLE_CLOUD_PROJECT:-handled-484216} --region=${GOOGLE_CLOUD_LOCATION:-us-central1} --service_name={agent-name}-agent --dry-run"
  }
}
```

Replace `{agent-name}` with the actual agent name (e.g., `booking`, `marketing`, `storefront`, `research`).

### Examples from MAIS codebase

| Agent      | Service Name Flag                 |
| ---------- | --------------------------------- |
| Booking    | `--service_name=booking-agent`    |
| Marketing  | `--service_name=marketing-agent`  |
| Storefront | `--service_name=storefront-agent` |
| Research   | `--service_name=research-agent`   |

## Step-by-Step Fix

### If you already have an incorrectly deployed service:

1. **Identify the incorrect service:**

   ```bash
   gcloud run services list --region=us-central1
   # Look for "adk-default-service-name"
   ```

2. **Delete the incorrect service:**

   ```bash
   gcloud run services delete adk-default-service-name --region=us-central1 --quiet
   ```

3. **Update package.json** to include `--service_name`:

   ```json
   "deploy": "npm run build && npx adk deploy cloud_run --project=handled-484216 --region=us-central1 --service_name=your-agent-name"
   ```

4. **Redeploy with correct name:**

   ```bash
   cd server/src/agent-v2/deploy/{agent-name}
   npm run deploy
   ```

5. **Verify the deployment:**
   ```bash
   gcloud run services list --region=us-central1
   # Should now show "your-agent-name" instead of "adk-default-service-name"
   ```

## Verification

After deploying, verify each agent has its own distinct service:

```bash
# List all Cloud Run services
gcloud run services list --project=handled-484216 --region=us-central1

# Expected output:
# SERVICE            URL
# booking-agent      https://booking-agent-506923455711.us-central1.run.app
# marketing-agent    https://marketing-agent-506923455711.us-central1.run.app
# storefront-agent   https://storefront-agent-506923455711.us-central1.run.app
# research-agent     https://research-agent-506923455711.us-central1.run.app
```

Test each agent individually:

```bash
TOKEN=$(gcloud auth print-identity-token)
curl -s -H "Authorization: Bearer $TOKEN" \
  https://marketing-agent-506923455711.us-central1.run.app/list-apps
# Should return: ["agent"]
```

## Prevention Strategies

### 1. Code Review Checklist

When reviewing ADK agent PRs, verify:

- [ ] `package.json` has explicit `--service_name` in deploy script
- [ ] `--service_name` follows convention: `{agent-purpose}-agent`
- [ ] `deploy:dry-run` script also has `--service_name`
- [ ] No duplicate service names across agents

### 2. Pre-Deploy Validation

Before deploying any agent:

```bash
# Check current services
gcloud run services list --region=us-central1

# Verify package.json has service_name
grep "service_name" package.json
```

### 3. Naming Convention

| Agent Purpose       | Service Name       | URL Pattern                               |
| ------------------- | ------------------ | ----------------------------------------- |
| Customer booking    | `booking-agent`    | `booking-agent-{num}.{region}.run.app`    |
| Marketing copy      | `marketing-agent`  | `marketing-agent-{num}.{region}.run.app`  |
| Storefront editing  | `storefront-agent` | `storefront-agent-{num}.{region}.run.app` |
| Competitor research | `research-agent`   | `research-agent-{num}.{region}.run.app`   |
| Orchestration       | `concierge-agent`  | `concierge-agent-{num}.{region}.run.app`  |

### 4. Template for New Agents

When creating a new agent, copy this package.json template:

```json
{
  "name": "handled-{purpose}-agent",
  "version": "1.0.0",
  "description": "Standalone {Purpose} Agent for HANDLED",
  "main": "dist/agent.js",
  "scripts": {
    "build": "tsc",
    "dev": "npx adk dev",
    "deploy": "npm run build && npx adk deploy cloud_run --project=${GOOGLE_CLOUD_PROJECT:-handled-484216} --region=${GOOGLE_CLOUD_LOCATION:-us-central1} --service_name={purpose}-agent",
    "deploy:dry-run": "npm run build && npx adk deploy cloud_run --project=${GOOGLE_CLOUD_PROJECT:-handled-484216} --region=${GOOGLE_CLOUD_LOCATION:-us-central1} --service_name={purpose}-agent --dry-run"
  },
  "dependencies": {
    "@google/adk": "^0.2.4",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@google/adk-devtools": "^0.2.4",
    "typescript": "^5.8.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

## Related Documentation

- [ADK Agent Deployment Pattern](../patterns/adk-agent-deployment-pattern.md) - Standalone package structure
- [ADK Backend Integration Pattern](../patterns/adk-agent-backend-integration-pattern.md) - Backend API integration
- [ADK Bundler Issue](../integration-issues/adk-cloud-run-bundler-transitive-imports.md) - Why standalone packages are needed

## Key Insight

The ADK CLI assumes single-agent deployment by default. For multi-agent systems like MAIS, you MUST explicitly name each service to prevent silent overwrites. This is not a bug - it's a design assumption that doesn't match our use case.

**The Rule:** Every `adk deploy cloud_run` command MUST include `--service_name={unique-name}`.
