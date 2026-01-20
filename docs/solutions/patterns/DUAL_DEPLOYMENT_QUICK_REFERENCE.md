# Dual Deployment Quick Reference Card

**Print this and pin it at your desk!**

## Problem

Agent code merged to main but didn't deploy because Cloud Run agents deploy separately.

---

## The Two Deployments

```
┌─────────────────────────────────────────┐
│  You push to main                       │
├─────────────────────────────────────────┤
│  ✅ Automatic:                          │
│  • Tests run                            │
│  • API builds & deploys to Render      │
│  • Client deploys to Vercel            │
│  • E2E tests run                        │
│                                         │
│  ⏳ Manual (YOUR JOB):                  │
│  • Deploy agents to Cloud Run          │
│  • IF you modified agent code          │
│  • Otherwise skip!                      │
└─────────────────────────────────────────┘
```

---

## When to Deploy Agents

**Deploy agents ONLY if you modified:**

```
server/src/agent-v2/deploy/*/src/**
server/src/agent-v2/deploy/*/package.json
```

**Check your PR:** Did you modify agent code? If NO → you're done. If YES → continue below.

---

## How to Deploy Agents (3 steps)

### Step 1: Wait for API to Deploy

- Go to [GitHub Actions](https://github.com/mikeyoung/MAIS/actions)
- Find your deployment
- Wait for ✅ "Production Deployment Complete"

### Step 2: Trigger Agent Deployment

- Open [Deploy Agents Workflow](https://github.com/mikeyoung/MAIS/actions/workflows/deploy-agents.yml)
- Click blue **"Run workflow"** button
- Select agents you modified (or `all`)
- Click **"Run workflow"**

### Step 3: Verify Deployment

- Watch for green ✅ on all agents
- Takes 5-15 minutes per agent
- Check [Cloud Run Dashboard](https://console.cloud.google.com/run?project=handled-484216)

---

## Quick Links

| Task                     | Link                                                                           | Time |
| ------------------------ | ------------------------------------------------------------------------------ | ---- |
| **Trigger Agent Deploy** | [Click](https://github.com/mikeyoung/MAIS/actions/workflows/deploy-agents.yml) | 10s  |
| Check Deploy Status      | [GitHub Actions](https://github.com/mikeyoung/MAIS/actions)                    | 30s  |
| View Agent Logs          | [Cloud Logging](https://console.cloud.google.com/logs?project=handled-484216)  | 1m   |
| Cloud Run Dashboard      | [Google Console](https://console.cloud.google.com/run?project=handled-484216)  | 1m   |

---

## Commands to Check Status

```bash
# See if agents deployed recently
gcloud run services list --project=handled-484216

# Check specific agent status
gcloud run services describe concierge-agent \
  --region=us-central1 \
  --project=handled-484216

# View agent logs (last 50 lines)
gcloud run services logs read concierge-agent \
  --limit=50 \
  --region=us-central1 \
  --project=handled-484216
```

---

## Common Mistakes ❌

- ❌ Assume agents deployed automatically
- ❌ Skip agent deployment if you touched agent code
- ❌ Test in production without confirming deployment
- ❌ Forget to tell team about agents needing manual deploy

---

## If Something Goes Wrong

| Problem                 | Solution                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| "No changes detected"   | Verify agent code actually modified, or use `force: true`                                                      |
| Agent returns 500 error | Check [Cloud Logs](https://console.cloud.google.com/logs) for TypeScript errors                                |
| Agent won't deploy      | Check [deploy-agents.yml logs](https://github.com/mikeyoung/MAIS/actions/workflows/deploy-agents.yml)          |
| Need to rollback        | See [DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md](../DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md#emergency-rollback) |

---

## Full Reference

**Complete guide:** [docs/solutions/DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md](../DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md)

**Runbook:** [docs/DEPLOYMENT_RUNBOOK.md](../DEPLOYMENT_RUNBOOK.md)

---

## Key Numbers to Remember

- **5-15 min** = Time per agent deployment
- **30 min** = Total deployment (all agents)
- **60+ min** = Alert if agent not deployed recently
- **2 workflows** = Automatic (API/Client) + Manual (Agents)
- **5 agents** = concierge, marketing, storefront, research, booking

---

## Remember

> "Agents deploy separately. **Don't forget the manual step or new features won't appear in production.**"

---

**Last Updated:** 2026-01-20
**For Questions:** Check [docs/solutions/DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md](../DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md)
