# Agent Deployment & CI/CD Setup

**Status:** Solved
**Date:** 2026-01-20
**Impact:** P1 - Agents now automatically deploy when code changes
**Time to Debug:** 2+ hours (manual deployments masked root cause)

---

## Problem Statement

Session Bootstrap feature was merged to `main` and working in development, but the onboarding agent wasn't deployed to production Cloud Run. This caused the feature to be unavailable in the production environment despite code being in the repository.

**Root Cause:** Agent services deploy to Google Cloud Run independently from the backend (which deploys to Render). No automated CI/CD pipeline existed for agents—they required manual deployment via ADK CLI, which is error-prone and easily forgotten.

---

## Solution Overview

This solution implements a complete automated deployment system for agents:

1. **Immediate Fix** - Manual deployment command for existing agents
2. **CI/CD Automation** - GitHub Actions workflow that auto-deploys on code changes
3. **GCP Infrastructure** - Workload Identity Federation for secure GitHub-to-GCP authentication
4. **Configuration** - GitHub secrets for secure credential management

---

## Part 1: Manual Deployment (Immediate Fix)

Use this command to manually deploy agents to Cloud Run when needed:

```bash
cd server/src/agent-v2/deploy/concierge
npm install
npm run deploy
```

**Expected output:**

```
Deploying agent-v2 agents to Cloud Run...
Deploying concierge to region us-central1...
✓ Deployment complete: concierge-agent-00013-rwh
```

**Verify deployment:**

```bash
gcloud run services list --platform managed --region us-central1 | grep concierge
```

---

## Part 2: CI/CD Workflow (Automated Deployment)

### File: `.github/workflows/deploy-agents.yml`

```yaml
name: Deploy Agents

on:
  push:
    branches: [main]
    paths:
      - 'server/src/agent-v2/**'
      - '.github/workflows/deploy-agents.yml'
  workflow_dispatch:
    inputs:
      agent:
        description: 'Specific agent to deploy (leave empty for all changed)'
        required: false
        type: string

env:
  GCP_PROJECT_ID: handled-484216
  GCP_REGION: us-central1

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      agents: ${{ steps.detect.outputs.agents }}
      deploy-all: ${{ steps.detect.outputs.deploy-all }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - id: detect
        run: |
          if [[ "${{ github.event_name }}" == "workflow_dispatch" ]]; then
            if [[ -n "${{ github.event.inputs.agent }}" ]]; then
              echo "agents=${{ github.event.inputs.agent }}" >> $GITHUB_OUTPUT
              echo "deploy-all=false" >> $GITHUB_OUTPUT
            else
              echo "agents=concierge" >> $GITHUB_OUTPUT
              echo "deploy-all=true" >> $GITHUB_OUTPUT
            fi
          else
            # Detect changed agent directories
            CHANGED=$(git diff --name-only origin/main...HEAD | grep 'server/src/agent-v2/deploy/' | cut -d/ -f5 | sort -u | tr '\n' ',' | sed 's/,$//')
            if [[ -z "$CHANGED" ]]; then
              CHANGED="concierge"
            fi
            echo "agents=$CHANGED" >> $GITHUB_OUTPUT
            echo "deploy-all=false" >> $GITHUB_OUTPUT
          fi

      - name: Log detected agents
        run: |
          echo "Detected agents to deploy: ${{ steps.detect.outputs.agents }}"
          echo "Deploy all: ${{ steps.detect.outputs.deploy-all }}"

  deploy:
    needs: detect-changes
    runs-on: ubuntu-latest
    strategy:
      matrix:
        agent: ${{ fromJson(format('[{0}]', needs.detect-changes.outputs.agents)) }}
      max-parallel: 3
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        working-directory: server/src/agent-v2/deploy/${{ matrix.agent }}
        run: npm install

      - name: Deploy ${{ matrix.agent }} agent
        working-directory: server/src/agent-v2/deploy/${{ matrix.agent }}
        run: |
          echo "Deploying ${{ matrix.agent }} agent..."
          npm run deploy

      - name: Verify deployment
        run: |
          gcloud run services describe ${{ matrix.agent }}-agent \
            --region ${{ env.GCP_REGION }} \
            --platform managed \
            --format='value(status.url)'

      - name: Post deployment status
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const status = '${{ job.status }}' === 'success' ? '✅' : '❌';
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `${status} Agent deployment for **${{ matrix.agent }}** ${{ job.status }}`
            });
```

### How It Works

**Triggers:**

- Push to `main` when files in `server/src/agent-v2/` change
- Manual trigger via GitHub Actions UI with optional agent name

**Behavior:**

- Detects which agents changed since last commit
- Deploys in parallel (max 3 concurrent)
- Each agent gets separate gcloud authentication
- Posts status comment on related PR/issue

**Failure handling:**

- If any agent deployment fails, entire matrix job fails
- Logs include full GCP error output for debugging
- GitHub status checks will block merge if configured

---

## Part 3: GCP Infrastructure (Workload Identity Federation)

This setup enables GitHub Actions to authenticate to GCP without storing static credentials.

### Prerequisites

```bash
# Set project variables
export PROJECT_ID="handled-484216"
export PROJECT_NUMBER="506923455711"
export REGION="us-central1"
export GITHUB_REPO="mikeyoung304/MAIS"
```

### 1. Create Workload Identity Pool

```bash
gcloud iam workload-identity-pools create github-actions \
  --project=$PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions"
```

Output example:

```
Created workload identity pool [github-actions].
```

### 2. Create OIDC Provider

```bash
gcloud iam workload-identity-pools providers create-oidc github \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-actions \
  --display-name="GitHub" \
  --attribute-mapping='google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.environment=assertion.environment,attribute.repository=assertion.repository' \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-condition="assertion.repository_owner == 'mikeyoung304'"
```

Verify:

```bash
gcloud iam workload-identity-pools providers describe github \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-actions \
  --format='value(name)'
```

Output format: `projects/506923455711/locations/global/workloadIdentityPools/github-actions/providers/github`

### 3. Create Service Account

```bash
gcloud iam service-accounts create github-actions-deploy \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions Deploy Service Account"
```

### 4. Grant Required Roles

```bash
# Cloud Run Developer - deploy/manage services
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:github-actions-deploy@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/run.developer

# Storage Admin - push containers to GCS
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:github-actions-deploy@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/storage.admin

# Artifact Registry Writer - push to Artifact Registry
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:github-actions-deploy@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/artifactregistry.writer

# Service Account User - needed for Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:github-actions-deploy@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/iam.serviceAccountUser
```

### 5. Create Workload Identity Binding

```bash
gcloud iam service-accounts add-iam-policy-binding \
  github-actions-deploy@$PROJECT_ID.iam.gserviceaccount.com \
  --project=$PROJECT_ID \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/attribute.repository/$GITHUB_REPO"
```

Verify the binding:

```bash
gcloud iam service-accounts get-iam-policy \
  github-actions-deploy@$PROJECT_ID.iam.gserviceaccount.com \
  --project=$PROJECT_ID
```

---

## Part 4: GitHub Secrets Configuration

Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

### 1. `GCP_WORKLOAD_IDENTITY_PROVIDER`

**Value:** The full provider resource name from Part 3, Step 2

```
projects/506923455711/locations/global/workloadIdentityPools/github-actions/providers/github
```

**Retrieve if needed:**

```bash
gcloud iam workload-identity-pools providers describe github \
  --project=handled-484216 \
  --location=global \
  --workload-identity-pool=github-actions \
  --format='value(name)'
```

### 2. `GCP_SERVICE_ACCOUNT`

**Value:** The service account email from Part 3, Step 3

```
github-actions-deploy@handled-484216.iam.gserviceaccount.com
```

---

## Testing the Setup

### Test 1: Manual GitHub Actions Trigger

1. Go to **Actions** tab in repository
2. Select **Deploy Agents** workflow
3. Click **Run workflow**
4. Choose branch: `main`
5. Optionally specify agent name in input field
6. Click **Run workflow**

Expected: Workflow completes in 2-3 minutes, all jobs pass

### Test 2: Automatic Trigger on Code Change

1. Make a change to `server/src/agent-v2/deploy/concierge/`
2. Commit and push to `main`
3. Go to **Actions** tab
4. Watch **Deploy Agents** workflow run automatically

Expected: Workflow detects change, deploys agent, posts status

### Test 3: Verify Cloud Run Deployment

```bash
# List running agent services
gcloud run services list \
  --region us-central1 \
  --filter="name:agent" \
  --format='table(name,status.url,status.conditions[0].lastUpdateTime)'

# Check specific agent
gcloud run services describe concierge-agent \
  --region us-central1 \
  --format='table(metadata.generation,status.conditions[0].message)'
```

---

## Common Deployment Scenarios

### Scenario 1: Deploy Single Agent Manually

```bash
cd server/src/agent-v2/deploy/concierge
npm install
npm run deploy
```

### Scenario 2: Deploy All Agents

```bash
# Via workflow_dispatch
gh workflow run deploy-agents.yml -r main --inputs agent=""

# Or manually (all agents)
for agent in server/src/agent-v2/deploy/*/; do
  agent_name=$(basename "$agent")
  cd "$agent"
  npm install && npm run deploy
  cd - > /dev/null
done
```

### Scenario 3: Verify Recent Deployment

```bash
# Check deployment history
gcloud run services describe concierge-agent \
  --region us-central1 \
  --format='value(metadata.generation, status.latestReadyRevision)'

# View logs from latest deployment
gcloud run services logs read concierge-agent \
  --region us-central1 \
  --limit=50
```

### Scenario 4: Rollback to Previous Version

```bash
# List available revisions
gcloud run revisions list \
  --service=concierge-agent \
  --region=us-central1

# Route 100% traffic to specific revision
gcloud run services update concierge-agent \
  --region=us-central1 \
  --to-revisions=concierge-agent-00012-abc
```

---

## Troubleshooting

### Workflow Fails with "Authentication failed"

**Cause:** GCP secrets not configured or workload identity binding missing

**Fix:**

1. Verify `GCP_WORKLOAD_IDENTITY_PROVIDER` secret value is correct
2. Verify `GCP_SERVICE_ACCOUNT` secret value is correct
3. Verify service account has required roles (Part 3, Step 4)
4. Check workload identity binding (Part 3, Step 5)

**Debug:**

```bash
# Verify service account exists and has roles
gcloud iam service-accounts describe \
  github-actions-deploy@handled-484216.iam.gserviceaccount.com

# Check bindings
gcloud iam service-accounts get-iam-policy \
  github-actions-deploy@handled-484216.iam.gserviceaccount.com
```

### Agent Fails to Start on Cloud Run

**Cause:** Missing environment variables, incorrect agent name, or build errors

**Debug:**

```bash
# View deployment logs
gcloud run services logs read concierge-agent --region us-central1 --limit=100

# Check service status
gcloud run services describe concierge-agent --region us-central1

# Verify deployed image
gcloud run services describe concierge-agent \
  --region us-central1 \
  --format='value(spec.template.spec.containers[0].image)'
```

### Workflow Detects Wrong Agents

**Cause:** Git diff logic incorrect or changed files not matching pattern

**Debug:**

```bash
# Check what git diff shows locally
git diff --name-only origin/main...HEAD | grep 'server/src/agent-v2/deploy/'

# Manually test agent detection
git diff --name-only origin/main...HEAD | \
  grep 'server/src/agent-v2/deploy/' | \
  cut -d/ -f5 | \
  sort -u
```

---

## Prevention Checklist

When deploying new agents:

- [ ] Create `server/src/agent-v2/deploy/{agent-name}/` directory
- [ ] Add `package.json` with `npm run deploy` script
- [ ] Add `npm run deploy` implementation (ADK CLI call)
- [ ] Test manual deployment: `cd server/src/agent-v2/deploy/{agent-name} && npm run deploy`
- [ ] Verify agent appears in Cloud Run: `gcloud run services list | grep {agent-name}`
- [ ] Commit changes to `main`
- [ ] Verify automatic workflow triggers and deploys agent
- [ ] Document agent in this file's "Supported Agents" section

## Supported Agents

| Agent     | Directory                               | Cloud Run Service | Status      |
| --------- | --------------------------------------- | ----------------- | ----------- |
| Concierge | `server/src/agent-v2/deploy/concierge/` | `concierge-agent` | ✅ Deployed |

---

## Related Documentation

- `.github/workflows/deploy-agents.yml` - Full workflow configuration
- `server/src/agent-v2/deploy/concierge/` - Agent deployment code
- `docs/solutions/ADK_A2A_PREVENTION_INDEX.md` - Agent development patterns
- GCP Workload Identity docs: https://cloud.google.com/iam/docs/workload-identity-federation

---

## Summary

**Problem:** Manual agent deployments → missed production updates
**Solution:** Automated CI/CD with GitHub Actions + GCP Workload Identity
**Time saved:** 5+ minutes per deployment × multiple daily deploys = hours/week
**Risk reduction:** Eliminates manual deployment errors, enables reliable rollbacks

Deploy agents with confidence. Push code → agents auto-deploy. Done.
