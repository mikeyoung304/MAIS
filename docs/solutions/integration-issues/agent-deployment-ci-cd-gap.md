---
title: Agent Deployment Out of Sync with Backend CI/CD Pipeline
slug: agent-deployment-ci-cd-gap
category: integration-issues
severity: high
component: [agent-deployment, ci-cd, concierge-agent]
symptoms:
  - Session bootstrap feature merged but onboarding behavior missing in production
  - Backend endpoints working (all 30 unit tests passing)
  - E2E tests showed agent responding but no onboarding mode engagement
  - Feature worked in development but not production
  - Agent endpoints returning default responses instead of bootstrap logic
root_cause: Dual deployment architecture - backend auto-deploys to Render via CI/CD, but Cloud Run agents required manual deployment and were 2 days out of date
solution_type: ci-cd-setup
date_solved: 2026-01-20
time_to_solve: ~2 hours
recurrence_risk: low
---

# Agent Deployment Out of Sync with Backend CI/CD Pipeline

## Problem Statement

Session Bootstrap feature was merged to `main` branch, but the Concierge agent in production wasn't showing onboarding behavior. Backend endpoints were working correctly (all 30 unit tests passing), but the agent appeared to ignore the new bootstrap tools.

### Symptoms Observed

1. **Feature invisible in production** - Onboarding mode never activated despite code being merged
2. **Backend working correctly** - All `/bootstrap`, `/store-discovery-fact`, `/get-discovery-facts` endpoints returned correct data
3. **Agent responding but not bootstrapping** - Agent would respond to messages but never called `bootstrap_session` tool
4. **No deployment errors** - No visible failures in any CI/CD pipeline

### Investigation Steps

1. ✅ Tested backend endpoints via curl - all working
2. ✅ Ran unit tests - 30/30 passing
3. ✅ E2E testing with Playwright - agent responded but no onboarding
4. ❓ Checked when agent was last deployed - **2 days before session bootstrap merge**
5. 💡 Discovered: Agents deploy to Cloud Run separately from backend (Render)

## Root Cause

**Dual Deployment Architecture Gap**

| Component   | Platform  | Deployment Method   | Auto-Deploy? |
| ----------- | --------- | ------------------- | ------------ |
| Backend API | Render    | Deploy hook on push | ✅ Yes       |
| Frontend    | Vercel    | Git integration     | ✅ Yes       |
| AI Agents   | Cloud Run | ADK manual deploy   | ❌ No        |

The backend auto-deploys to Render when code is pushed to `main`, but agents require manual deployment to Cloud Run via the ADK CLI. No CI/CD existed for agent deployment, so agent code changes sat undeployed.

## Solution

### Part 1: Immediate Fix (Manual Deployment)

```bash
cd server/src/agent-v2/deploy/concierge
npm install
npm run deploy
```

**Result:** Deployed revision `concierge-agent-00013-rwh` - onboarding mode immediately started working.

### Part 2: Automated CI/CD (GitHub Actions)

Created `.github/workflows/deploy-agents.yml`:

```yaml
name: Deploy AI Agents to Cloud Run

on:
  push:
    branches: [main]
    paths:
      - 'server/src/agent-v2/deploy/*/src/**'
      - 'server/src/agent-v2/deploy/*/package.json'
  workflow_dispatch:
    inputs:
      agent:
        description: 'Agent to deploy (or "all")'
        type: choice
        options: [all, concierge, marketing, storefront, research, booking]

jobs:
  detect-changes:
    # Identifies which agents have changes

  deploy-agent:
    strategy:
      matrix:
        agent: ${{ fromJson(needs.detect-changes.outputs.agents) }}
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - run: |
          cd server/src/agent-v2/deploy/${{ matrix.agent }}
          npm install && npm run build
          npx adk deploy cloud_run --service_name=${{ matrix.agent }}-agent
```

**Key Features:**

- Auto-deploys when agent files change on `main`
- Detects which agents changed (only deploys modified ones)
- Parallel deployment via matrix strategy
- Manual trigger option for specific agents

### Part 3: GCP Workload Identity Federation

Set up secure keyless authentication for GitHub Actions:

```bash
# 1. Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-actions" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# 2. Create OIDC Provider
gcloud iam workload-identity-pools providers create-oidc "github" \
  --location="global" \
  --workload-identity-pool="github-actions" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository_owner == 'mikeyoung304'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 3. Create Service Account
gcloud iam service-accounts create "github-actions-deploy" \
  --display-name="GitHub Actions Deploy"

# 4. Grant Permissions
gcloud projects add-iam-policy-binding handled-484216 \
  --member="serviceAccount:github-actions-deploy@handled-484216.iam.gserviceaccount.com" \
  --role="roles/run.developer"

# 5. Allow GitHub to Impersonate
gcloud iam service-accounts add-iam-policy-binding \
  github-actions-deploy@handled-484216.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/506923455711/locations/global/workloadIdentityPools/github-actions/attribute.repository/mikeyoung304/MAIS"
```

### Part 4: GitHub Secrets Configuration

Add to repository secrets (Settings → Secrets → Actions):

| Secret                           | Value                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/506923455711/locations/global/workloadIdentityPools/github-actions/providers/github` |
| `GCP_SERVICE_ACCOUNT`            | `github-actions-deploy@handled-484216.iam.gserviceaccount.com`                                 |

## Verification

After implementing, verify the fix:

1. **Manual trigger test:**
   - Go to Actions → "Deploy AI Agents to Cloud Run"
   - Run workflow → Select "concierge"
   - Verify deployment succeeds

2. **Auto-deploy test:**
   - Make a small change to `server/src/agent-v2/deploy/concierge/src/agent.ts`
   - Push to `main`
   - Verify workflow triggers and deploys

3. **Production verification:**
   - Navigate to tenant dashboard
   - Check AI Assistant shows onboarding progress
   - Send message and verify `bootstrap_session` tool is called

## Prevention Strategies

### 1. CI/CD Prevention (Now Automated)

- ✅ GitHub Actions workflow auto-deploys on agent changes
- Monitor workflow runs in Actions tab
- Set up Slack notifications for deployment failures

### 2. Documentation Prevention

- ✅ Updated `DEVELOPING.md` with agent deployment section
- ✅ Updated `WORKFLOWS_README.md` with new workflow
- Added to CLAUDE.md pitfalls: "Dual deployment architecture"

### 3. Code Review Prevention

- When reviewing PRs that touch `server/src/agent-v2/deploy/*/src/**`:
  - Verify CI workflow will trigger
  - Check if manual deployment needed for other agents

### 4. Monitoring Prevention

- Check Cloud Run console for deployment timestamps
- Compare backend deploy time vs agent deploy time
- Alert if gap > 1 hour after merge

## Related Documentation

- `DEVELOPING.md` - Agent Development & Deployment section
- `.github/workflows/WORKFLOWS_README.md` - Workflow documentation
- `docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md` - Agent dev guide
- `docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md` - A2A patterns
- `docs/solutions/JWT_ID_TOKEN_FOR_CLOUD_RUN_AUTH.md` - Cloud Run auth
- CLAUDE.md pitfalls #32-53 - ADK/A2A specific issues

## Key Takeaway

**The platform has dual deployment architecture:**

- Backend (Render) + Frontend (Vercel) = auto-deploy ✅
- Agents (Cloud Run) = now auto-deploy via GitHub Actions ✅

When making agent changes, the workflow automatically detects and deploys. For emergency manual deployment:

```bash
cd server/src/agent-v2/deploy/[agent-name]
npm install && npm run deploy
```

---

_Documented: 2026-01-20 | Recurrence Risk: Low (automated)_
