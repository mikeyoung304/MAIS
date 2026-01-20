# Prevention Strategies: Dual Deployment Architecture (Backend + Cloud Run Agents)

**Problem:** New agent features merged to `main` but didn't appear in production because agents deploy separately from the backend API.

**Root Cause:** Asynchronous deployment architecture

- Backend API (Render) auto-deploys on `main` push
- Cloud Run agents deploy in separate workflow (`deploy-agents.yml`)
- No cross-deployment validation or sequencing

**Impact:** Gap between backend and agent versions in production

---

## 1. CI/CD Prevention: Deployment Coordination & Monitoring

### 1.1 Enforce Synchronized Deployments

**Add to `deploy-production.yml` post-deployment validation:**

```yaml
# Add after deploy-client-production job succeeds
post-deployment-agent-sync:
  name: Verify Agent Deployment Sync
  runs-on: ubuntu-latest
  needs: [deploy-client-production]
  if: github.ref == 'refs/heads/main'
  timeout-minutes: 10

  steps:
    - name: Check agent deployment status
      run: |
        echo "🤖 Checking if agent deployments are synced with API deployment..."

        # Get API version from Render
        API_DEPLOYMENT_TIME=$(curl -s https://api.mais.app/health | jq '.deployedAt' || echo "unknown")
        echo "API deployed at: $API_DEPLOYMENT_TIME"

        # Get agent versions from Cloud Run
        for AGENT in concierge marketing storefront research booking; do
          SERVICE_URL="https://${AGENT}-agent-506923455711.us-central1.run.app"
          AGENT_DEPLOYMENT_TIME=$(curl -s -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
            "$SERVICE_URL/health" 2>/dev/null | jq '.deployedAt' || echo "unknown")

          echo "Agent '$AGENT' deployed at: $AGENT_DEPLOYMENT_TIME"

          # If agent deployment is older than 5 minutes compared to API, flag for manual check
          if [ "$AGENT_DEPLOYMENT_TIME" != "unknown" ] && [ "$API_DEPLOYMENT_TIME" != "unknown" ]; then
            TIME_DIFF=$(($(date +%s -d "$API_DEPLOYMENT_TIME") - $(date +%s -d "$AGENT_DEPLOYMENT_TIME")))
            if [ $TIME_DIFF -gt 300 ]; then
              echo "⚠️  WARNING: Agent '$AGENT' deployment is >5 min behind API"
            fi
          fi
        done

    - name: Trigger manual agent deployment if needed
      if: failure()
      run: |
        echo "❌ Agent deployment sync check failed"
        echo "Manual action required: Run 'deploy-agents.yml' workflow manually"
        exit 1
```

### 1.2 Add Pre-Deployment Checklist

**New workflow: `pre-deployment-agent-verification.yml`**

Runs automatically before `deploy-production.yml` to verify agents don't need updating:

```yaml
name: Pre-Deployment Agent Verification

on:
  workflow_run:
    workflows: ['Deploy to Production']
    types: [requested]

jobs:
  verify-agents-not-stale:
    name: Verify Agent Code Not Modified
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Check for agent changes
        id: agent-check
        run: |
          AGENT_DIRS="server/src/agent-v2/deploy/concierge server/src/agent-v2/deploy/marketing server/src/agent-v2/deploy/storefront server/src/agent-v2/deploy/research server/src/agent-v2/deploy/booking"

          MODIFIED_AGENTS=""
          for AGENT_DIR in $AGENT_DIRS; do
            if git diff --name-only HEAD~1 HEAD | grep -q "$AGENT_DIR"; then
              AGENT_NAME=$(basename "$AGENT_DIR")
              MODIFIED_AGENTS="$MODIFIED_AGENTS $AGENT_NAME"
            fi
          done

          if [ -n "$MODIFIED_AGENTS" ]; then
            echo "⚠️  ALERT: Agent code modified in this commit:"
            echo "$MODIFIED_AGENTS"
            echo "agents_modified=true" >> $GITHUB_OUTPUT
            echo "modified_agents=$MODIFIED_AGENTS" >> $GITHUB_OUTPUT
          else
            echo "✅ No agent code changes detected"
            echo "agents_modified=false" >> $GITHUB_OUTPUT
          fi

      - name: Create PR comment warning
        if: steps.agent-check.outputs.agents_modified == 'true' && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ **AGENT DEPLOYMENT REMINDER**\n\nThis PR modifies agent code. After merging to main:\n\n1. Monitor API deployment completion\n2. Run `deploy-agents.yml` manually if agents modified\n3. Modified agents: ${{ steps.agent-check.outputs.modified_agents }}\n\nWithout manual agent deployment, new agent features won\'t appear in production.\n\n[Deploy Agents Workflow](../../actions/workflows/deploy-agents.yml)'
            })

      - name: Add deployment checklist to merge commit
        if: steps.agent-check.outputs.agents_modified == 'true'
        run: |
          cat > agent-deployment-checklist.txt << 'EOF'
          ✓ API deployment succeeded
          [ ] Agent deployment triggered
          [ ] concierge agent deployed
          [ ] marketing agent deployed
          [ ] storefront agent deployed
          [ ] research agent deployed
          [ ] booking agent deployed
          [ ] Smoke tests passed
          EOF

          echo "::notice::Save this checklist and verify all agent deployments complete"
          cat agent-deployment-checklist.txt
```

### 1.3 Deployment Monitoring Dashboard

**Create GitHub Actions status board in workflow summary:**

```yaml
post-deployment-status:
  name: Deployment Status Dashboard
  runs-on: ubuntu-latest
  needs: [deploy-api-production, deploy-client-production, post-deployment-validation]
  if: always()

  steps:
    - name: Generate deployment matrix
      run: |
        cat > deployment-status.md << 'EOF'
        # 📊 Production Deployment Status

        | Component | Status | Deployed At | Health |
        |-----------|--------|-------------|--------|
        | API (Render) | ${{ needs.deploy-api-production.result }} | [View →](https://api.mais.app/health) | [Check →](https://api.mais.app/health) |
        | Client (Vercel) | ${{ needs.deploy-client-production.result }} | [View →](https://mais.app) | [Check →](https://mais.app) |
        | **Agents (Cloud Run)** | ⏳ **MANUAL** | [Dashboard →](https://console.cloud.google.com/run) | |
        | └─ concierge | ? | [Deploy →](../../actions/workflows/deploy-agents.yml?agent=concierge) | [Health →](https://concierge-agent-506923455711.us-central1.run.app) |
        | └─ marketing | ? | [Deploy →](../../actions/workflows/deploy-agents.yml?agent=marketing) | [Health →](https://marketing-agent-506923455711.us-central1.run.app) |
        | └─ storefront | ? | [Deploy →](../../actions/workflows/deploy-agents.yml?agent=storefront) | [Health →](https://storefront-agent-506923455711.us-central1.run.app) |
        | └─ research | ? | [Deploy →](../../actions/workflows/deploy-agents.yml?agent=research) | [Health →](https://research-agent-506923455711.us-central1.run.app) |
        | └─ booking | ? | [Deploy →](../../actions/workflows/deploy-agents.yml?agent=booking) | [Health →](https://booking-agent-506923455711.us-central1.run.app) |

        **⚠️ NOTE:** Agents deploy independently. If you modified agent code:
        1. Wait for API deployment to complete (green checkmark above)
        2. Click [Deploy Agents →](../../actions/workflows/deploy-agents.yml) workflow link
        3. Select agents that changed and click "Run workflow"
        EOF

        cat deployment-status.md >> $GITHUB_STEP_SUMMARY
```

---

## 2. Documentation Prevention: Developer Knowledge Transfer

### 2.1 PR Template Addition

**Add to `.github/pull_request_template.md`:**

```markdown
## 🤖 Agent Deployment Checklist

If this PR modifies agent code, you MUST manually trigger deployment after merge:

**Modified agents:** <!-- List agents modified in this PR -->

- [ ] concierge
- [ ] marketing
- [ ] storefront
- [ ] research
- [ ] booking
- [ ] None (API/client only)

**Post-merge steps:**

1. After API deployment completes (status checks pass on main)
2. Go to [Actions → Deploy AI Agents workflow](../../actions/workflows/deploy-agents.yml)
3. Click "Run workflow" → Select agents → Submit
4. Wait for agents to deploy (5-10 min per agent)

**Why?** Agents deploy to Cloud Run separately from the API. Without manual trigger, new agent features won't appear in production.

See: [docs/solutions/DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md](./docs/solutions/DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md)
```

### 2.2 Developer Quick Reference Card

**Create: `docs/solutions/AGENT_DEPLOYMENT_QUICK_REFERENCE.md`**

```markdown
# Agent Deployment Quick Reference

## Architecture Overview
```

┌─────────────────────────────────────────────┐
│ GitHub Actions on main push │
├─────────────────────────────────────────────┤
│ ✅ Tests + Build (automatic) │
│ ✅ API deploys to Render (automatic) │
│ ✅ Client deploys to Vercel (automatic) │
│ ⏳ Agents deploy to Cloud Run (MANUAL) │
└─────────────────────────────────────────────┘

```

## Quick Links

| Task | Link | Time |
|------|------|------|
| Trigger Agent Deploy | [Click here](https://github.com/mikeyoung/MAIS/actions/workflows/deploy-agents.yml) | 5-15 min |
| Check Agent Status | [Cloud Run Dashboard](https://console.cloud.google.com/run?project=handled-484216) | instant |
| View Agent Logs | [Cloud Logging](https://console.cloud.google.com/logs?project=handled-484216) | instant |

## When to Trigger Manual Agent Deployment

Trigger **immediately after** API deployment if you modified:

- `server/src/agent-v2/deploy/concierge/src/**`
- `server/src/agent-v2/deploy/marketing/src/**`
- `server/src/agent-v2/deploy/storefront/src/**`
- `server/src/agent-v2/deploy/research/src/**`
- `server/src/agent-v2/deploy/booking/src/**`

## Manual Deployment Steps

1. Open [GitHub Actions Workflows](https://github.com/mikeyoung/MAIS/actions/workflows/deploy-agents.yml)
2. Click **"Run workflow"** (blue button)
3. Select agents to deploy:
   - `all` = Deploy all agents
   - `concierge` = Deploy only concierge
   - etc.
4. Click **"Run workflow"**
5. Monitor [Actions → Deploy AI Agents](https://github.com/mikeyoung/MAIS/actions/workflows/deploy-agents.yml)
6. Verify each agent deployed (green checkmarks)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No changes detected" | Check if code actually in agent dirs, or use `force: true` |
| Agent deploy failed | Check [Cloud Logging](https://console.cloud.google.com/logs) for errors |
| Agent responds with 500 | Likely compilation error - check build logs in Actions |
| Agent unreachable | May need authentication - curl with `-H "Authorization: Bearer $(gcloud auth print-identity-token)"` |

## Common Mistakes

❌ **DON'T** assume agents deployed automatically with API
❌ **DON'T** skip agent deployment if you touched agent code
❌ **DON'T** test agent features in production without verifying deployment
✅ **DO** check action history to confirm agents deployed successfully
✅ **DO** share agent deployment status with team before coordinating tests
✅ **DO** add agent changes to your PR description
```

### 2.3 Update CLAUDE.md Project Instructions

**Add section to `/Users/mikeyoung/CODING/MAIS/CLAUDE.md`:**

```markdown
## Agent Deployment Architecture

**CRITICAL:** Agents deploy independently from the backend API.

### Deployment Flow

**Backend API (Automatic):**

1. Code pushed to `main`
2. `deploy-production.yml` runs automatically
3. Tests → Build → Migrate DB → Deploy to Render (15-20 min)
4. Status: ✅ Automatic

**Cloud Run Agents (Manual Trigger Required):**

1. Agent code pushed to `main`
2. `deploy-agents.yml` **does NOT run automatically** from main push
3. **You must manually trigger:** [GitHub Actions → Deploy AI Agents](../../actions/workflows/deploy-agents.yml)
4. Select modified agents → Run workflow (5-15 min per agent)
5. Status: ⏳ **Manual**

### When to Trigger Agent Deployment

**Always trigger manual deployment if you modified:**
```

server/src/agent-v2/deploy/{agent_name}/src/\*\*
server/src/agent-v2/deploy/{agent_name}/package.json
server/src/agent-v2/deploy/{agent_name}/tsconfig.json

````

**Do NOT assume automatic deployment.** Recent issue: agent features merged but didn't deploy because manual trigger was skipped.

### Manual Deployment Checklist

- [ ] API deployment completed and verified healthy
- [ ] Identified which agents you modified
- [ ] Triggered [Deploy Agents workflow](../../actions/workflows/deploy-agents.yml)
- [ ] Verified all agent deployments succeeded
- [ ] Tested agent features in production (or staging)

### Verification Steps

```bash
# 1. Check API deployed
curl https://api.mais.app/health

# 2. List agents in Cloud Run
gcloud run services list --project=handled-484216

# 3. Check specific agent
gcloud run services describe concierge-agent \
  --region=us-central1 \
  --project=handled-484216 \
  --format='value(status.observedGeneration)'

# 4. Tail agent logs
gcloud run services logs read concierge-agent \
  --region=us-central1 \
  --project=handled-484216 \
  --limit=50
````

### Emergency Rollback

If agent has critical bug after deployment:

```bash
# Rollback to previous revision
gcloud run services update-traffic {agent}-agent \
  --region=us-central1 \
  --project=handled-484216 \
  --to-revisions LATEST=0,{previous-revision-id}=100
```

See: [docs/solutions/DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md](./DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md)

````

---

## 3. Testing Prevention: Catch Deployment Gaps in PR Review

### 3.1 PR Validation Addition

**Add to `main-pipeline.yml` - new job after build:**

```yaml
agent-deployment-impact:
  name: Agent Deployment Impact Analysis
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Analyze agent changes
      id: analysis
      run: |
        # Find modified agent directories
        MODIFIED_DIRS=$(git diff --name-only origin/main HEAD | grep "server/src/agent-v2/deploy/" | cut -d/ -f5 | sort -u)

        if [ -z "$MODIFIED_DIRS" ]; then
          echo "has_agent_changes=false" >> $GITHUB_OUTPUT
          exit 0
        fi

        echo "has_agent_changes=true" >> $GITHUB_OUTPUT
        echo "modified_agents=$(echo $MODIFIED_DIRS | tr '\n' ',' | sed 's/,$//')" >> $GITHUB_OUTPUT

        # Count changes
        CHANGE_COUNT=$(echo "$MODIFIED_DIRS" | wc -w)
        echo "change_count=$CHANGE_COUNT" >> $GITHUB_OUTPUT

    - name: Add PR review checklist comment
      if: steps.analysis.outputs.has_agent_changes == 'true'
      uses: actions/github-script@v7
      with:
        script: |
          const agents = '${{ steps.analysis.outputs.modified_agents }}'.split(',').filter(Boolean);
          const checklist = agents.map(agent => `- [ ] ${agent} agent`).join('\n');

          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `## 🤖 Agent Deployment Impact\n\nThis PR modifies agent code. **Post-merge deployment required:**\n\n${checklist}\n\n**Action Required After Merge:**\n1. Wait for API deployment (automatic)\n2. Run [Deploy Agents Workflow](../../actions/workflows/deploy-agents.yml)\n3. Select: ${agents.join(', ')}\n\n**Why manual?** Agents deploy separately to Cloud Run. Without this step, new features won't appear in production.`
          })

    - name: Add review note to PR
      if: steps.analysis.outputs.has_agent_changes == 'true'
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.issues.addLabels({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            labels: ['agent-changes', 'requires-manual-deploy']
          })
````

### 3.2 Code Review Guidance

**Add to `.github/CODEOWNERS`:**

```
# Agent changes require deployment coordination review
server/src/agent-v2/deploy/concierge/src/ @deployment-team
server/src/agent-v2/deploy/marketing/src/ @deployment-team
server/src/agent-v2/deploy/storefront/src/ @deployment-team
server/src/agent-v2/deploy/research/src/ @deployment-team
server/src/agent-v2/deploy/booking/src/ @deployment-team
```

**Add to code review template:**

```markdown
### Deployment Verification Checklist

- [ ] If agent code modified, confirm manual deployment plan in PR description
- [ ] All tests passing (automatic)
- [ ] Type safety verified (automatic)
- [ ] Post-merge: Agent deployment steps documented for reviewer

### Questions Before Approval

1. Does this PR modify any agent code?
2. If yes, has reviewer added reminder comment about manual deployment?
3. Is the merge commit message clear about deployment requirements?
```

---

## 4. Checklist Items: Updated PR Templates & Deployment Procedures

### 4.1 Enhanced PR Template

**File: `.github/pull_request_template.md`**

```markdown
<!-- Required fields marked with ⚠️ for agent PRs -->

## Description

<!-- Describe the changes -->

## Type of Change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Documentation update
- [ ] Infrastructure/CI-CD

## Changes to Agent Code?

⚠️ **If you modified any agent code, complete this section:**
```

Modified agents:

- [ ] concierge
- [ ] marketing
- [ ] storefront
- [ ] research
- [ ] booking

Post-merge deployment required: YES / NO

```

## Deployment Checklist

**Before Merge:**
- [ ] All CI checks passing
- [ ] Type checking passed (`npm run typecheck`)
- [ ] Tests passing (`npm run test`)
- [ ] No console.log statements (use logger)
- [ ] Multi-tenant isolation verified

**After Merge (If Agent Code Modified):**
- [ ] API deployment completed and verified
- [ ] [Triggered agent deployment workflow](https://github.com/mikeyoung/MAIS/actions/workflows/deploy-agents.yml)
- [ ] Selected correct agents to deploy
- [ ] Waited for all agents to complete (~10-15 min)
- [ ] Verified agent health in [Cloud Run console](https://console.cloud.google.com/run)
- [ ] Tested feature in production
- [ ] Shared status with team

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests updated (if UI changes)
- [ ] Manual testing completed

## Related Issues

Closes #<!-- issue number -->

## Additional Notes

<!-- Any other information reviewers should know -->
```

### 4.2 Deployment Runbook

**File: `docs/DEPLOYMENT_RUNBOOK.md`**

```markdown
# Deployment Runbook

## Production Deployment Flow

### Phase 1: Automatic (GitHub Actions)

When you push to `main` or create a version tag:
```

✅ PR Validation (8-12 min)
✅ Pre-deployment checks (5 min)
✅ Build production artifacts (10 min)
✅ Database migrations (requires approval - 15 min)
✅ Deploy API to Render (15 min) → Verify health
✅ Deploy Client to Vercel (15 min) → Verify health
✅ Post-deployment E2E tests (25 min)

````

**Status:** [GitHub Actions](https://github.com/mikeyoung/MAIS/actions)

### Phase 2: Manual - Agent Deployment (IF AGENT CODE MODIFIED)

**When:** After Phase 1 completes successfully

**Duration:** 5-15 minutes per agent

**Steps:**

1. Open [Deploy Agents Workflow](https://github.com/mikeyoung/MAIS/actions/workflows/deploy-agents.yml)
2. Click blue **"Run workflow"** button
3. Select agents to deploy
4. Click **"Run workflow"**
5. Monitor deployment (green checkmarks = success)

**No manual deployment = new agent features won't appear in production**

### Full Deployment Procedure

```bash
# 1. Create feature branch and develop
git checkout -b feat/agent-feature

# 2. Modify agent code
# server/src/agent-v2/deploy/{agent}/src/**

# 3. Commit and push
git add .
git commit -m "feat(concierge-agent): add new capability"
git push origin feat/agent-feature

# 4. Create PR (includes agent deployment reminder)
# → Fill out checklist → Request review

# 5. After approval, merge to main
# → This triggers automatic deployment

# 6. WAIT for automatic deployment to complete
# → Check: https://github.com/mikeyoung/MAIS/actions
# → Wait for "✅ Production Deployment Complete"

# 7. MANUALLY trigger agent deployment
# → Go to: https://github.com/mikeyoung/MAIS/actions/workflows/deploy-agents.yml
# → Run workflow with your agent name(s)
# → Wait for green checkmarks (5-15 min)

# 8. Verify in production
curl https://concierge-agent-506923455711.us-central1.run.app/health
curl https://api.mais.app/health

# 9. Test feature end-to-end
# Visit https://app.mais.app and test new capability
````

### Rollback Procedures

**If API deployment fails:**

```bash
# Render automatically shows previous revisions
# Go to: https://dashboard.render.com
# Select: mais-api service
# Click: Rollback to previous deployment
```

**If agent deployment fails:**

```bash
# Google Cloud Console rollback
gcloud run services update-traffic concierge-agent \
  --to-revisions LATEST=0,${PREVIOUS_REVISION}=100 \
  --region us-central1 \
  --project handled-484216

# Or use Cloud Console:
# https://console.cloud.google.com/run
# → Select agent service
# → Revisions tab
# → Switch traffic to previous revision
```

**If database migration fails:**

```bash
# Contact DBA or follow migration rollback docs
# Go to: https://console.cloud.google.com/sql
# View recent activity and logs
```

### Troubleshooting

| Issue                                       | Solution                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Agent deployment says "No changes detected" | Use `force: true` in workflow dispatch, or verify agent code was actually modified              |
| Agent returns 500 error                     | Check [Cloud Logs](https://console.cloud.google.com/logs) - likely TypeScript compilation error |
| API health check fails                      | Verify DATABASE_URL and secrets in Render dashboard                                             |
| Vercel deployment timeout                   | Check [Vercel dashboard](https://vercel.com) for service issues                                 |
| E2E tests fail in production                | May be test timing issue - check test results in Actions artifacts                              |

### Monitoring Post-Deployment

```bash
# 1. Check API health
curl https://api.mais.app/health | jq .

# 2. Check agent health (requires auth)
gcloud auth print-identity-token | \
xargs -I {} curl -H "Authorization: Bearer {}" \
  https://concierge-agent-506923455711.us-central1.run.app/health

# 3. Stream agent logs
gcloud run services logs read concierge-agent \
  --limit=50 \
  --region us-central1 \
  --project handled-484216

# 4. Monitor Cloud Run metrics
# https://console.cloud.google.com/run
# → Select service → Metrics tab
```

````

---

## 5. Monitoring & Alerting: Know When Deployments Fail

### 5.1 GitHub Actions Notifications

**Enable in GitHub:**
1. Settings → Notifications → Enable workflow notifications
2. Set alerts for: Failed deployments

**Add Slack integration to workflow:**

```yaml
post-deployment-notification:
  name: Send Deployment Notification
  runs-on: ubuntu-latest
  needs: [deploy-api-production, deploy-client-production]
  if: always()

  steps:
    - name: Determine deployment status
      id: status
      run: |
        if [ "${{ needs.deploy-api-production.result }}" = "success" ] && \
           [ "${{ needs.deploy-client-production.result }}" = "success" ]; then
          echo "status=✅ SUCCESS"
          echo "color=good"
        else
          echo "status=❌ FAILED"
          echo "color=danger"
        fi
        echo "status=$status" >> $GITHUB_OUTPUT
        echo "color=$color" >> $GITHUB_OUTPUT

    - name: Send Slack notification
      if: env.SLACK_WEBHOOK_URL != ''
      uses: slackapi/slack-github-action@v1
      with:
        payload: |
          {
            "text": "${{ steps.status.outputs.status }} Production Deployment",
            "blocks": [
              {
                "type": "header",
                "text": {
                  "type": "plain_text",
                  "text": "🚀 Production Deployment Status"
                }
              },
              {
                "type": "section",
                "fields": [
                  {
                    "type": "mrkdwn",
                    "text": "*API Deployment:*\n${{ needs.deploy-api-production.result }}"
                  },
                  {
                    "type": "mrkdwn",
                    "text": "*Client Deployment:*\n${{ needs.deploy-client-production.result }}"
                  }
                ]
              },
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "⚠️ *REMINDER:* Don't forget manual agent deployment!\n[Deploy Agents →](https://github.com/mikeyoung/MAIS/actions/workflows/deploy-agents.yml)"
                }
              },
              {
                "type": "actions",
                "elements": [
                  {
                    "type": "button",
                    "text": {
                      "type": "plain_text",
                      "text": "View Deployment"
                    },
                    "url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                  },
                  {
                    "type": "button",
                    "text": {
                      "type": "plain_text",
                      "text": "Deploy Agents"
                    },
                    "url": "${{ github.server_url }}/${{ github.repository }}/actions/workflows/deploy-agents.yml"
                  }
                ]
              }
            ]
          }
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
````

### 5.2 Cloud Run Health Checks

**Add automated monitoring script:**

**File: `scripts/monitor-agent-deployments.sh`**

```bash
#!/bin/bash

# Monitor Cloud Run agents for stale deployments

AGENTS=("concierge" "marketing" "storefront" "research" "booking")
PROJECT_ID="handled-484216"
REGION="us-central1"
THRESHOLD_MINUTES=60  # Alert if agent not deployed in last 60 min

echo "🤖 Agent Deployment Status Check"
echo "=================================="
echo "Checked at: $(date)"
echo ""

STALE_AGENTS=""

for AGENT in "${AGENTS[@]}"; do
  SERVICE_NAME="${AGENT}-agent"

  # Get last deployment time
  LAST_REVISION=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format='value(status.latestCreatedRevision)' 2>/dev/null)

  if [ -z "$LAST_REVISION" ]; then
    echo "❌ $AGENT: Service not found"
    continue
  fi

  # Get revision deployment time
  DEPLOY_TIME=$(gcloud run revisions describe "$LAST_REVISION" \
    --region "$REGION" \
    --service "$SERVICE_NAME" \
    --project "$PROJECT_ID" \
    --format='value(metadata.creationTimestamp)' 2>/dev/null)

  if [ -z "$DEPLOY_TIME" ]; then
    echo "⚠️  $AGENT: Could not determine deployment time"
    continue
  fi

  # Calculate minutes since deployment
  DEPLOY_EPOCH=$(date -d "$DEPLOY_TIME" +%s)
  NOW_EPOCH=$(date +%s)
  MINUTES_AGO=$(( ($NOW_EPOCH - $DEPLOY_EPOCH) / 60 ))

  if [ "$MINUTES_AGO" -gt "$THRESHOLD_MINUTES" ]; then
    echo "⚠️  $AGENT: Not deployed in $MINUTES_AGO minutes (threshold: $THRESHOLD_MINUTES)"
    STALE_AGENTS="$STALE_AGENTS $AGENT"
  else
    echo "✅ $AGENT: Recently deployed ($MINUTES_AGO min ago)"
  fi
done

echo ""
if [ -n "$STALE_AGENTS" ]; then
  echo "⚠️  ALERT: Stale agents detected:$STALE_AGENTS"
  echo "Run: github.com/.../actions/workflows/deploy-agents.yml"
  exit 1
else
  echo "✅ All agents recently deployed"
  exit 0
fi
```

**Run via cron job (every 6 hours):**

```yaml
name: Monitor Agent Deployments

on:
  schedule:
    - cron: '0 */6 * * *' # Every 6 hours
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: handled-484216

      - name: Run monitoring script
        run: chmod +x scripts/monitor-agent-deployments.sh && ./scripts/monitor-agent-deployments.sh

      - name: Alert on stale agents
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '⚠️ Alert: Stale Agent Deployments Detected',
              body: 'One or more agents have not been deployed recently. [Deploy now →](../../actions/workflows/deploy-agents.yml)',
              labels: ['alert', 'deployment'],
              assignees: ['@DevOps-team']  # Adjust to your team
            })
```

### 5.3 Deployment Status Dashboard

**Create public status board:**

**File: `docs/DEPLOYMENT_STATUS.md`**

```markdown
# Current Production Status

**Last Updated:** [Auto-updates via GitHub Action]

## API & Client

| Service     | Status                   | Deployment                               | Health Check                          |
| ----------- | ------------------------ | ---------------------------------------- | ------------------------------------- |
| Backend API | [Check →](../../actions) | [Render →](https://dashboard.render.com) | [Live →](https://api.mais.app/health) |
| Frontend    | [Check →](../../actions) | [Vercel →](https://vercel.com)           | [Live →](https://mais.app)            |

## Cloud Run Agents

**⚠️ Manual deployment required after API updates**

| Agent      | Status                                               | Cloud Run                                                                          | Logs                                            | Last Deploy                                              |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| concierge  | [Check →](../../actions/workflows/deploy-agents.yml) | [View →](https://console.cloud.google.com/run/detail/us-central1/concierge-agent)  | [Logs →](https://console.cloud.google.com/logs) | [Auto-check](../../actions/workflows/monitor-agents.yml) |
| marketing  | [Check →](../../actions/workflows/deploy-agents.yml) | [View →](https://console.cloud.google.com/run/detail/us-central1/marketing-agent)  | [Logs →](https://console.cloud.google.com/logs) | [Auto-check](../../actions/workflows/monitor-agents.yml) |
| storefront | [Check →](../../actions/workflows/deploy-agents.yml) | [View →](https://console.cloud.google.com/run/detail/us-central1/storefront-agent) | [Logs →](https://console.cloud.google.com/logs) | [Auto-check](../../actions/workflows/monitor-agents.yml) |
| research   | [Check →](../../actions/workflows/deploy-agents.yml) | [View →](https://console.cloud.google.com/run/detail/us-central1/research-agent)   | [Logs →](https://console.cloud.google.com/logs) | [Auto-check](../../actions/workflows/monitor-agents.yml) |
| booking    | [Check →](../../actions/workflows/deploy-agents.yml) | [View →](https://console.cloud.google.com/run/detail/us-central1/booking-agent)    | [Logs →](https://console.cloud.google.com/logs) | [Auto-check](../../actions/workflows/monitor-agents.yml) |

## Quick Links

- **Deploy Agents:** [GitHub Actions](https://github.com/mikeyoung/MAIS/actions/workflows/deploy-agents.yml)
- **Check Logs:** [Cloud Logging](https://console.cloud.google.com/logs?project=handled-484216)
- **Cloud Run Dashboard:** [Google Cloud Console](https://console.cloud.google.com/run?project=handled-484216)
- **View Deployments:** [GitHub Actions](https://github.com/mikeyoung/MAIS/actions)
```

---

## Summary: Prevention Checklist

**Implement these in order:**

- [ ] **CI/CD Prevention (1h)**
  - Add post-deployment sync check to `deploy-production.yml`
  - Create `pre-deployment-agent-verification.yml` workflow
  - Add deployment status dashboard to workflow summary

- [ ] **Documentation Prevention (2h)**
  - Update `.github/pull_request_template.md` with agent deployment checklist
  - Create `docs/solutions/AGENT_DEPLOYMENT_QUICK_REFERENCE.md`
  - Add agent deployment section to `CLAUDE.md`

- [ ] **Testing Prevention (1h)**
  - Add agent impact analysis job to `main-pipeline.yml`
  - Update `.github/CODEOWNERS` for agent directories
  - Create code review guidance document

- [ ] **Checklist Updates (1.5h)**
  - Enhanced PR template with post-merge checklist
  - Create `docs/DEPLOYMENT_RUNBOOK.md`
  - Update GitHub issue templates

- [ ] **Monitoring & Alerting (2.5h)**
  - Add Slack notifications to workflows
  - Create `scripts/monitor-agent-deployments.sh`
  - Set up cron-based monitoring workflow
  - Create `docs/DEPLOYMENT_STATUS.md` dashboard

**Total Implementation Time:** ~8 hours

**Long-term Benefit:** Zero missed agent deployments, clearer deployment architecture awareness, faster troubleshooting of deployment issues.

---

## References

- [Dual Deployment Architecture Diagram](#deployment-architecture--monitoring)
- [deploy-agents.yml](../../.github/workflows/deploy-agents.yml)
- [deploy-production.yml](../../.github/workflows/deploy-production.yml)
- [WORKFLOWS_README.md](../../.github/workflows/WORKFLOWS_README.md)
- [Cloud Run Service Registry](./AGENT_DEPLOYMENT_QUICK_REFERENCE.md)
