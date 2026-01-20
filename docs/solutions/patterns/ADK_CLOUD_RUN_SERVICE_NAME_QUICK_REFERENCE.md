---
module: MAIS
date: 2026-01-18
problem_type: quick_reference
component: agent-v2/deploy
tags: [google-adk, cloud-run, deployment, quick-reference, cheat-sheet]
---

# ADK Cloud Run Service Name - Quick Reference

**Print and pin this next to deployment docs!**

---

## The Rule

```
EVERY adk deploy cloud_run command MUST include:
--service_name={agent-name}-agent
```

---

## Correct Pattern

```bash
# CORRECT - explicit service name
npx adk deploy cloud_run \
  --project=handled-484216 \
  --region=us-central1 \
  --service_name=booking-agent     # <-- REQUIRED

# WRONG - defaults cause conflicts
npx adk deploy cloud_run \
  --project=handled-484216 \
  --region=us-central1
  # Missing --service_name = will overwrite other agents!
```

---

## Package.json Template

```json
{
  "scripts": {
    "deploy": "npm run build && npx adk deploy cloud_run --project=${GOOGLE_CLOUD_PROJECT:-handled-484216} --region=${GOOGLE_CLOUD_LOCATION:-us-central1} --service_name=YOUR-AGENT-agent",
    "deploy:dry-run": "npm run build && npx adk deploy cloud_run --project=${GOOGLE_CLOUD_PROJECT:-handled-484216} --region=${GOOGLE_CLOUD_LOCATION:-us-central1} --service_name=YOUR-AGENT-agent --dry-run"
  }
}
```

---

## Naming Convention

| Agent      | Service Name       |
| ---------- | ------------------ |
| booking    | `booking-agent`    |
| storefront | `storefront-agent` |
| marketing  | `marketing-agent`  |
| research   | `research-agent`   |

**Pattern:** `{lowercase-name}-agent`

---

## Pre-Deploy Checklist

```
[ ] --service_name in package.json deploy script
[ ] --service_name in package.json deploy:dry-run script
[ ] Service name follows {name}-agent pattern
[ ] Service name is unique (not already deployed)
[ ] SERVICE_REGISTRY.md updated
```

---

## Quick Validation

```bash
# Check for missing --service_name
grep -r "adk deploy cloud_run" server/src/agent-v2/deploy/*/package.json | grep -v "service_name"

# List deployed services
gcloud run services list --region=us-central1 --project=handled-484216
```

---

## If You Forgot

**Symptom:** Wrong agent responding after deployment

**Fix:**

1. Add `--service_name={agent}-agent` to package.json
2. Redeploy: `npm run deploy`
3. Verify: Check Cloud Run URL matches agent

---

See: [Full Prevention Guide](./ADK_CLOUD_RUN_SERVICE_NAME_PREVENTION.md)
