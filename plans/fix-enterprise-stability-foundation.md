# Enterprise Stability Foundation Audit & Remediation Plan

**Created:** 2026-01-20
**Status:** Ready for Review
**Complexity:** A LOT (Comprehensive)
**Estimated Duration:** 2-3 weeks

## Executive Summary

MAIS has accumulated technical debt across four interconnected systems that are causing production reliability issues. This plan addresses the **root causes** rather than symptoms, establishing enterprise-grade stability through:

1. **Migration System Consolidation** - Fix duplicate numbering, prevent rollback execution
2. **CI/CD Pipeline Hardening** - Remove silent failures, enforce gates
3. **Agent Deployment Verification** - Add functional smoke tests post-deploy
4. **Observability Foundation** - Enable Sentry, add alerting, instrument agents

### The Hidden Root Cause

```
Your storefront fix didn't deploy because:
  Code Merged → CI Failed (integration tests need DB) → Render Didn't Deploy

But even if CI passed, agent features could fail because:
  Agent Code Merged → Separate Workflow → Can Fail Silently → Feature Broken
```

**This plan closes both gaps.**

---

## Problem Statement

### Current State: "It Works on My Machine" at Scale

| System            | Enterprise Expectation           | Current Reality                                  |
| ----------------- | -------------------------------- | ------------------------------------------------ |
| **Migrations**    | Deterministic schema state       | Duplicates cause random order execution          |
| **CI/CD**         | Failures block deployment        | `continue-on-error: true` allows silent failures |
| **Agents**        | Verified functional after deploy | HTTP 200 check only, no functional test          |
| **Observability** | Know when production breaks      | Sentry optional, no alerting configured          |

### Impact

- **Storefront headlines bug**: Fix merged but not deployed for days
- **Schema drift**: `chatEnabled` column may or may not exist depending on migration order
- **Agent outages**: Users experience broken features with no alerts to engineering
- **Silent test failures**: Integration and E2E tests fail without blocking deploys

---

## Proposed Solution

### Architecture: Defense in Depth

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENTERPRISE STABILITY LAYERS                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: SCHEMA INTEGRITY                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • Single migration numbering (no duplicates)                           │ │
│  │ • Rollback files renamed/removed                                       │ │
│  │ • Pre-commit hook validates sequence                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              ↓                                               │
│  Layer 2: CI ENFORCEMENT                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • Integration tests run against properly migrated DB                   │ │
│  │ • Remove ALL continue-on-error except informational                    │ │
│  │ • E2E tests orchestrated with real services                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              ↓                                               │
│  Layer 3: DEPLOYMENT VERIFICATION                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • Agent smoke tests verify tool execution                              │ │
│  │ • Main pipeline waits for agent workflow success                       │ │
│  │ • Automatic rollback on health check failure                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              ↓                                               │
│  Layer 4: OBSERVABILITY                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • Sentry REQUIRED (not optional)                                       │ │
│  │ • Alert on error rate spike                                            │ │
│  │ • Agent call tracing with correlation IDs                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Approach

### Phase 1: Migration System Consolidation (3-4 days)

**Goal:** Deterministic schema state in every environment

#### 1.1 Fix Duplicate Migration Numbers

**Current Problem:**

```
16_add_customer_chat_support.sql           ← Runs first (adds chatEnabled)
16_add_customer_chat_support_rollback.sql  ← Runs second (REMOVES chatEnabled!)
17_add_subscription_tier.sql               ← Duplicate
17_add_session_type_index.sql              ← Duplicate
23_add_landing_page_draft.sql              ← Duplicate
23_booking_links_phase1.sql                ← Duplicate
```

**Fix:**

```bash
# Rename to unique sequential numbers
16_add_customer_chat_support.sql           → Keep as-is
16_add_customer_chat_support_rollback.sql  → DELETE (or move to archive/)
17_add_subscription_tier.sql               → Keep as-is
17_add_session_type_index.sql              → 17b_add_session_type_index.sql
23_add_landing_page_draft.sql              → Keep as-is
23_booking_links_phase1.sql                → 23b_booking_links_phase1.sql
```

**Files to modify:**

- `server/prisma/migrations/16_add_customer_chat_support_rollback.sql` → DELETE
- `server/prisma/migrations/17_add_session_type_index.sql` → RENAME to `17b_*`
- `server/prisma/migrations/23_booking_links_phase1.sql` → RENAME to `23b_*`

#### 1.2 Add Migration Ordering Validation

**New file:** `server/scripts/validate-migrations.ts`

```typescript
/**
 * Pre-commit hook to validate migration numbering
 * Fails if:
 * - Duplicate numbers found
 * - Rollback files exist alongside originals
 * - Gaps in sequence > 1
 */
import { readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '../prisma/migrations');

function validateMigrations(): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{2}_.*\.sql$/.test(f))
    .sort();

  const numbers = new Map<string, string[]>();

  for (const file of files) {
    const num = file.slice(0, 2);
    if (!numbers.has(num)) numbers.set(num, []);
    numbers.get(num)!.push(file);
  }

  let hasErrors = false;

  for (const [num, filesWithNum] of numbers) {
    if (filesWithNum.length > 1) {
      console.error(`❌ Duplicate migration number ${num}:`);
      filesWithNum.forEach((f) => console.error(`   - ${f}`));
      hasErrors = true;
    }

    if (filesWithNum.some((f) => f.includes('rollback'))) {
      console.error(`❌ Rollback file found: ${filesWithNum.find((f) => f.includes('rollback'))}`);
      console.error(`   Rollbacks should be new forward migrations, not paired files`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log('✅ Migration numbering validated');
}

validateMigrations();
```

**Add to package.json:**

```json
{
  "scripts": {
    "validate:migrations": "tsx server/scripts/validate-migrations.ts"
  }
}
```

**Add to pre-commit hook** (`.husky/pre-commit`):

```bash
npm run validate:migrations
```

#### 1.3 Update CI Migration Application

**File:** `.github/workflows/main-pipeline.yml` (lines 312-327)

**Current (broken):**

```bash
for file in server/prisma/migrations/[0-9][0-9]_*.sql; do
  # Applies in alphabetical order - rollbacks run after originals!
  psql -f "$file"
done
```

**Fixed:**

```bash
# Apply migrations in strict numeric order, skip rollback files
for file in $(ls server/prisma/migrations/[0-9][0-9]_*.sql | sort -V); do
  filename=$(basename "$file")

  # Skip destructive reset
  if [ "$filename" = "00_supabase_reset.sql" ]; then
    echo "⏭️ Skipping destructive migration: $filename"
    continue
  fi

  # Skip rollback files (should be deleted, but belt-and-suspenders)
  if [[ "$filename" == *"rollback"* ]]; then
    echo "⏭️ Skipping rollback migration: $filename"
    continue
  fi

  echo "📦 Applying: $filename"
  PGPASSWORD=postgres psql -h localhost -U postgres -d mais_test -f "$file"
done
```

---

### Phase 2: CI/CD Pipeline Hardening (2-3 days)

**Goal:** No silent failures - tests must pass or deployment blocks

#### 2.1 Remove continue-on-error from Critical Paths

**File:** `.github/workflows/deploy-production.yml`

**Changes:**

```yaml
# Line 131 - Lint (REMOVE continue-on-error)
- name: Lint
  run: npm run lint
  # REMOVED: continue-on-error: true
  # If lint fails, fix it. 305 errors is tech debt, not acceptable baseline.

# Line 166 - Integration Tests (CONDITIONAL, not silent)
- name: Integration Tests
  run: npm run test:integration -- --coverage
  # REMOVED: continue-on-error: true
  env:
    DATABASE_URL: ${{ secrets.CI_DATABASE_URL }}
  # Now properly fails if tests fail. Tests skip gracefully if no DATABASE_URL.

# Line 184 - E2E Tests (CONDITIONAL on infrastructure)
- name: E2E Tests
  if: env.E2E_INFRASTRUCTURE_READY == 'true'
  run: npm run test:e2e
  # REMOVED: continue-on-error: true
  # Tests only run when infrastructure is ready. When they run, they must pass.
```

#### 2.2 Fix Integration Test Database Configuration

**Problem:** CI doesn't have `DATABASE_URL` configured, causing tests to skip.

**Solution A (Recommended): Use GitHub Actions PostgreSQL service**

The service already exists in main-pipeline.yml. Ensure deploy-production.yml uses it:

```yaml
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: mais_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_test
```

**Solution B (Alternative): Use test database in Supabase**

Add `CI_DATABASE_URL` secret pointing to dedicated test database. Less isolation but simpler.

#### 2.3 E2E Test Infrastructure Setup

**File:** `.github/workflows/main-pipeline.yml` (E2E job)

**Current issue:** E2E tests require running servers but CI doesn't properly orchestrate them.

**Add server startup orchestration:**

```yaml
e2e-tests:
  runs-on: ubuntu-latest
  needs: [build]
  services:
    postgres:
      image: postgres:16
      # ... (same config as integration tests)

  steps:
    - uses: actions/checkout@v4

    - name: Install dependencies
      run: npm ci

    - name: Apply migrations
      run: |
        cd server && npx prisma migrate deploy
        # Apply manual migrations (with validation)
        npm run validate:migrations
        for file in $(ls prisma/migrations/[0-9][0-9]_*.sql | grep -v rollback | sort -V); do
          psql -f "$file"
        done
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_test

    - name: Start API server
      run: |
        cd server && npm run build
        npm run start:mock &
        echo $! > /tmp/api.pid
      env:
        PORT: 3001
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_test

    - name: Wait for API
      run: npx wait-on http://localhost:3001/health --timeout 60000

    - name: Start Next.js
      run: |
        cd apps/web && npm run build
        npm run start &
        echo $! > /tmp/web.pid
      env:
        NEXT_PUBLIC_API_URL: http://localhost:3001

    - name: Wait for Next.js
      run: npx wait-on http://localhost:3000 --timeout 60000

    - name: Run E2E tests
      run: npm run test:e2e

    - name: Cleanup
      if: always()
      run: |
        kill $(cat /tmp/api.pid) || true
        kill $(cat /tmp/web.pid) || true
```

---

### Phase 3: Agent Deployment Verification (2-3 days)

**Goal:** Agent deployments verified functional before considered complete

#### 3.1 Create Agent Health Check Endpoint

**New file:** `server/src/routes/internal-agent-health.routes.ts`

```typescript
import { Router } from 'express';
import { logger } from '../lib/core/logger';

const router = Router();

interface AgentHealthResult {
  agent: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    reachable: boolean;
    toolsRegistered: boolean;
    canCallBackend: boolean;
    responseTime: number;
  };
  error?: string;
}

/**
 * Deep health check for all deployed agents
 * Called by GitHub Actions after deployment to verify functionality
 */
router.get('/v1/internal/agents/health', async (req, res) => {
  const agents = [
    { name: 'booking', url: process.env.BOOKING_AGENT_URL },
    { name: 'marketing', url: process.env.MARKETING_AGENT_URL },
    { name: 'storefront', url: process.env.STOREFRONT_AGENT_URL },
    { name: 'research', url: process.env.RESEARCH_AGENT_URL },
    { name: 'concierge', url: process.env.CONCIERGE_AGENT_URL },
  ];

  const results: AgentHealthResult[] = [];

  for (const agent of agents) {
    if (!agent.url) {
      results.push({
        agent: agent.name,
        status: 'unhealthy',
        checks: {
          reachable: false,
          toolsRegistered: false,
          canCallBackend: false,
          responseTime: -1,
        },
        error: 'URL not configured',
      });
      continue;
    }

    const start = Date.now();
    try {
      // 1. Check if agent responds
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${agent.url}/health`, {
        signal: controller.signal,
        headers: { 'X-Health-Check': 'true' },
      });
      clearTimeout(timeout);

      const responseTime = Date.now() - start;

      if (!response.ok) {
        results.push({
          agent: agent.name,
          status: 'unhealthy',
          checks: { reachable: false, toolsRegistered: false, canCallBackend: false, responseTime },
          error: `HTTP ${response.status}`,
        });
        continue;
      }

      // 2. Verify tools are registered (agent-specific check)
      const healthData = await response.json();
      const toolsRegistered = healthData.tools?.length > 0;

      // 3. Verify agent can call backend (if applicable)
      const canCallBackend = healthData.backendConnected ?? true;

      results.push({
        agent: agent.name,
        status: toolsRegistered && canCallBackend ? 'healthy' : 'degraded',
        checks: { reachable: true, toolsRegistered, canCallBackend, responseTime },
      });
    } catch (error) {
      results.push({
        agent: agent.name,
        status: 'unhealthy',
        checks: {
          reachable: false,
          toolsRegistered: false,
          canCallBackend: false,
          responseTime: Date.now() - start,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const allHealthy = results.every((r) => r.status === 'healthy');
  const anyUnhealthy = results.some((r) => r.status === 'unhealthy');

  res.status(anyUnhealthy ? 503 : 200).json({
    overall: allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded',
    agents: results,
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

#### 3.2 Add Agent Smoke Tests to Deployment Workflow

**File:** `.github/workflows/deploy-agents.yml`

**Add after deployment step:**

```yaml
- name: Verify Agent Deployment
  run: |
    echo "🔍 Verifying agent deployments..."

    # Wait for Cloud Run to stabilize
    sleep 30

    # Call backend health check endpoint
    HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" \
      "${{ secrets.BACKEND_URL }}/v1/internal/agents/health" \
      -H "Authorization: Bearer ${{ secrets.INTERNAL_API_SECRET }}")

    HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
    BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

    echo "Health check response: $BODY"

    if [ "$HTTP_CODE" != "200" ]; then
      echo "❌ Agent health check failed with status $HTTP_CODE"
      echo "::error::Agent deployment verification failed"
      exit 1
    fi

    # Parse response and check each agent
    UNHEALTHY=$(echo "$BODY" | jq -r '.agents[] | select(.status == "unhealthy") | .agent')

    if [ -n "$UNHEALTHY" ]; then
      echo "❌ Unhealthy agents detected:"
      echo "$UNHEALTHY"
      echo "::error::Some agents failed health check: $UNHEALTHY"
      exit 1
    fi

    echo "✅ All agents healthy"
```

#### 3.3 Link Main Pipeline to Agent Deployment

**File:** `.github/workflows/main-pipeline.yml`

**Add job that waits for agent deployment:**

```yaml
verify-agent-deployment:
  needs: [build]
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - name: Check for agent changes
      id: agent-changes
      run: |
        # Check if any agent code changed
        CHANGED=$(git diff --name-only ${{ github.event.before }} ${{ github.sha }} | grep -E '^server/src/agent-v2/deploy/' || true)
        if [ -n "$CHANGED" ]; then
          echo "has_changes=true" >> $GITHUB_OUTPUT
        else
          echo "has_changes=false" >> $GITHUB_OUTPUT
        fi

    - name: Wait for agent deployment workflow
      if: steps.agent-changes.outputs.has_changes == 'true'
      uses: lewagon/wait-on-check-action@v1.3.4
      with:
        ref: ${{ github.sha }}
        check-name: 'deploy-agents'
        repo-token: ${{ secrets.GITHUB_TOKEN }}
        wait-interval: 30
        allowed-conclusions: success

    - name: Verify agents healthy
      if: steps.agent-changes.outputs.has_changes == 'true'
      run: |
        curl -f "${{ secrets.BACKEND_URL }}/v1/internal/agents/health" \
          -H "Authorization: Bearer ${{ secrets.INTERNAL_API_SECRET }}"
```

---

### Phase 4: Observability Foundation (3-4 days)

**Goal:** Know when production breaks before users tell you

#### 4.1 Make Sentry Required

**File:** `server/src/lib/errors/sentry.ts`

**Change from:**

```typescript
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.warn('SENTRY_DSN not configured, error tracking disabled');
    return; // Silent failure!
  }
  // ...
}
```

**To:**

```typescript
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (process.env.NODE_ENV === 'production' && !dsn) {
    throw new Error(
      'SENTRY_DSN is required in production. ' +
        'Set SENTRY_DSN environment variable or set NODE_ENV=development.'
    );
  }

  if (!dsn) {
    logger.info('SENTRY_DSN not configured (non-production), error tracking disabled');
    return;
  }
  // ...
}
```

**Add to Render environment variables:** `SENTRY_DSN`

#### 4.2 Add Agent Request Correlation

**File:** `server/src/agent-v2/services/agent-gateway.service.ts`

**Add correlation ID to agent calls:**

```typescript
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../lib/core/logger';

export async function callAgent(
  agentUrl: string,
  payload: unknown,
  options: { tenantId: string; userId?: string }
): Promise<unknown> {
  const correlationId = uuidv4();
  const childLogger = logger.child({
    correlationId,
    tenantId: options.tenantId,
    agentUrl,
  });

  childLogger.info('Calling agent');
  const start = Date.now();

  try {
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
        'X-Tenant-ID': options.tenantId,
      },
      body: JSON.stringify(payload),
    });

    const duration = Date.now() - start;
    childLogger.info({ duration, status: response.status }, 'Agent response received');

    if (!response.ok) {
      childLogger.error({ status: response.status }, 'Agent call failed');
      throw new Error(`Agent returned ${response.status}`);
    }

    return response.json();
  } catch (error) {
    const duration = Date.now() - start;
    childLogger.error({ error, duration }, 'Agent call error');
    throw error;
  }
}
```

#### 4.3 Add Deployment Alerting

**File:** `.github/workflows/deploy-production.yml`

**Add Slack notification on failure:**

```yaml
- name: Notify on Failure
  if: failure()
  uses: slackapi/slack-github-action@v1.24.0
  with:
    channel-id: ${{ secrets.SLACK_DEPLOY_CHANNEL }}
    slack-message: |
      🚨 *Production Deployment Failed*

      *Commit:* ${{ github.sha }}
      *Author:* ${{ github.actor }}
      *Message:* ${{ github.event.head_commit.message }}

      <${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Workflow>
  env:
    SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}

- name: Notify on Success
  if: success()
  uses: slackapi/slack-github-action@v1.24.0
  with:
    channel-id: ${{ secrets.SLACK_DEPLOY_CHANNEL }}
    slack-message: |
      ✅ *Production Deployed Successfully*

      *Version:* ${{ github.ref_name }}
      *Commit:* ${{ github.sha }}

      <${{ secrets.PRODUCTION_URL }}|View Production>
  env:
    SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

#### 4.4 Add Error Rate Alerting (Sentry)

**Configure in Sentry Dashboard:**

1. Create alert rule: "Error Rate Spike"
   - Condition: Error count > 10 in 5 minutes
   - Action: Send to Slack channel

2. Create alert rule: "Critical Errors"
   - Condition: Error level = fatal
   - Action: Page on-call via PagerDuty/Opsgenie

---

## Implementation Phases

### Phase 1: Migration System (Days 1-3)

- [ ] Delete rollback migration files
- [ ] Rename duplicate-numbered migrations
- [ ] Add migration validation script
- [ ] Add pre-commit hook
- [ ] Update CI migration application logic
- [ ] Test locally with fresh database
- [ ] Deploy and verify production schema

### Phase 2: CI/CD Hardening (Days 4-6)

- [ ] Remove `continue-on-error` from critical paths
- [ ] Configure CI database properly
- [ ] Add E2E test infrastructure
- [ ] Verify all tests pass in CI
- [ ] Merge and monitor first deployment

### Phase 3: Agent Verification (Days 7-9)

- [ ] Create agent health check endpoint
- [ ] Add smoke tests to deploy-agents.yml
- [ ] Link main pipeline to agent deployment
- [ ] Test with intentional agent failure
- [ ] Document rollback procedure

### Phase 4: Observability (Days 10-14)

- [ ] Make Sentry required in production
- [ ] Add correlation IDs to agent calls
- [ ] Configure Slack deployment notifications
- [ ] Set up Sentry alert rules
- [ ] Create runbook for common alerts
- [ ] Document on-call procedures

---

## Acceptance Criteria

### Functional Requirements

- [ ] All migrations apply in deterministic order
- [ ] CI fails if any test fails (no silent skips on failure)
- [ ] Agent deployments verified functional before considered complete
- [ ] Production errors visible in Sentry within 1 minute
- [ ] Deployment failures notify team via Slack

### Non-Functional Requirements

- [ ] Migration validation runs < 5 seconds
- [ ] Agent health check completes < 30 seconds
- [ ] No manual intervention required for standard deployments
- [ ] Alert fatigue minimized (no duplicate alerts)

### Quality Gates

- [ ] All existing tests pass after migration changes
- [ ] CI pipeline runs end-to-end successfully
- [ ] Sentry receives test error in staging
- [ ] Slack receives test deployment notification

---

## Risk Analysis & Mitigation

| Risk                                          | Impact | Likelihood | Mitigation                                     |
| --------------------------------------------- | ------ | ---------- | ---------------------------------------------- |
| Migration renames break production            | HIGH   | LOW        | Apply to staging first, verify schema matches  |
| Removing continue-on-error blocks all deploys | HIGH   | MEDIUM     | Fix tests before removing, have rollback ready |
| Agent health check too strict                 | MEDIUM | MEDIUM     | Start with lenient checks, tighten gradually   |
| Sentry rate limits                            | LOW    | LOW        | Use sampling (already configured at 50%)       |

---

## Future Considerations

After this foundation is stable:

1. **Distributed Tracing** - Add OpenTelemetry for full request traces
2. **Performance Dashboards** - Grafana with p50/p95/p99 latencies
3. **Canary Deployments** - Gradual rollout with automatic rollback
4. **Chaos Engineering** - Intentional failure injection to test resilience
5. **SLO/SLI Definition** - Formal reliability targets with error budgets

---

## References

### Internal References

- Migration system: `server/prisma/migrations/`
- CI workflows: `.github/workflows/`
- Agent deployment: `.github/workflows/deploy-agents.yml`
- Sentry config: `server/src/lib/errors/sentry.ts`
- Health checks: `server/src/routes/health.routes.ts`

### Documentation

- `docs/solutions/SCHEMA_DRIFT_PREVENTION.md`
- `docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md`
- `CLAUDE.md` (Pitfalls 54-57)

### Prevention Patterns

- Pitfall #54: Agent deployment separate from main
- Pitfall #55: Agent deployment verification
- Pitfall #56: Wrapper format on WRITE
- Pitfall #57: Wrapper format on READ

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
