# Enterprise Stability Foundation - Synthesized Plan

**Created:** 2026-01-20
**Status:** ✅ Implemented (2026-01-20)
**Complexity:** MEDIUM (Focused)
**Estimated Duration:** 1-2 days

## Executive Summary

This plan synthesizes feedback from enterprise-focused agents (Architecture Strategist, Data Migration Expert, Deployment Verification Agent, Security Sentinel) to create a **quality-first, automation-where-it-matters** approach to stability.

**Philosophy:** Build automation that runs forever, skip ceremony that requires maintenance.

---

## The Problem

Your storefront fix didn't deploy because:

1. CI tests failed silently (`continue-on-error: true`)
2. Migrations have duplicate numbers causing unpredictable schema state
3. No visibility into whether agents actually work post-deployment

---

## Implementation Phases

### Phase 1: Schema Integrity (4 hours)

**Goal:** Deterministic migrations that can never drift again

#### 1.1 Fix Existing Migration Issues (30 min)

```bash
# Delete rollback file (causes chatEnabled to be removed after being added)
rm server/prisma/migrations/16_add_customer_chat_support_rollback.sql

# Rename duplicates to use suffixes
mv server/prisma/migrations/17_add_session_type_index.sql \
   server/prisma/migrations/17b_add_session_type_index.sql
mv server/prisma/migrations/23_booking_links_phase1.sql \
   server/prisma/migrations/23b_booking_links_phase1.sql
```

- [x] Delete `16_add_customer_chat_support_rollback.sql`
- [x] Rename `17_add_session_type_index.sql` → `17b_add_session_type_index.sql`
- [x] Rename `23_booking_links_phase1.sql` → `23b_booking_links_phase1.sql`

#### 1.2 Build Migration Validation Script (2 hours)

**File:** `server/scripts/validate-migrations.ts`

```typescript
/**
 * Validates migration file naming conventions.
 * Run on pre-commit for any migration changes.
 *
 * Fails if:
 * - Duplicate base numbers without suffixes (01, 01 - not 01, 01a)
 * - Rollback files exist (use forward migrations instead)
 */
import { readdirSync } from 'fs';
import { join, basename } from 'path';

const MIGRATIONS_DIR = join(__dirname, '../prisma/migrations');

function validateMigrations(): void {
  const sqlFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{2}[a-z]?_.*\.sql$/.test(f))
    .sort();

  const errors: string[] = [];

  // Check 1: No rollback files
  const rollbacks = sqlFiles.filter((f) => f.toLowerCase().includes('rollback'));
  if (rollbacks.length > 0) {
    errors.push(
      `❌ Rollback files found (use forward migrations instead):\n` +
        rollbacks.map((f) => `   - ${f}`).join('\n')
    );
  }

  // Check 2: No duplicate base numbers without suffixes
  const baseNumbers = new Map<string, string[]>();
  for (const file of sqlFiles) {
    if (file.toLowerCase().includes('rollback')) continue;

    const match = file.match(/^(\d{2})([a-z])?_/);
    if (match) {
      const base = match[1];
      const suffix = match[2] || '';

      if (!baseNumbers.has(base)) baseNumbers.set(base, []);
      baseNumbers.get(base)!.push({ file, suffix });
    }
  }

  for (const [num, files] of baseNumbers) {
    const withoutSuffix = files.filter((f) => !f.suffix);
    if (withoutSuffix.length > 1) {
      errors.push(
        `❌ Duplicate migration number ${num} without suffixes:\n` +
          files.map((f) => `   - ${f.file}`).join('\n') +
          `\n   Use suffixes like ${num}a_, ${num}b_ to differentiate`
      );
    }
  }

  if (errors.length > 0) {
    console.error('\n🚨 Migration validation failed:\n');
    errors.forEach((e) => console.error(e + '\n'));
    process.exit(1);
  }

  console.log('✅ Migration validation passed');
  console.log(`   ${sqlFiles.length} migration files checked`);
}

validateMigrations();
```

- [x] Create `server/scripts/validate-migrations.ts`
- [x] Add script to `package.json`: `"validate:migrations": "tsx scripts/validate-migrations.ts"`
- [x] Test locally: `npm run validate:migrations`

#### 1.3 Add Pre-Commit Hook (10 min)

**File:** `.husky/pre-commit` (add to existing)

```bash
# Validate migrations if any migration files changed
if git diff --cached --name-only | grep -q "server/prisma/migrations/"; then
  echo "🔍 Validating migration files..."
  npm run --workspace=server validate:migrations
fi
```

- [x] Update `.husky/pre-commit` with migration validation

#### 1.4 Update CI Migration Application (15 min)

**File:** `.github/workflows/main-pipeline.yml`

Update the migration application loop to skip rollback files:

```bash
# Apply manual SQL migrations (skip rollbacks)
for file in $(ls server/prisma/migrations/[0-9][0-9]*.sql 2>/dev/null | sort -V); do
  filename=$(basename "$file")

  # Skip destructive reset
  if [ "$filename" = "00_supabase_reset.sql" ]; then
    echo "⏭️ Skipping: $filename (destructive)"
    continue
  fi

  # Skip rollback files
  if [[ "$filename" == *"rollback"* ]]; then
    echo "⏭️ Skipping: $filename (rollback)"
    continue
  fi

  echo "📦 Applying: $filename"
  PGPASSWORD=postgres psql -h localhost -U postgres -d mais_test -f "$file"
done
```

- [x] Update `main-pipeline.yml` migration loop to skip rollbacks

---

### Phase 2: CI Enforcement (1 hour)

**Goal:** Tests that fail visibly, not silently

#### 2.1 Remove Silent Failures

**File:** `.github/workflows/deploy-production.yml`

```yaml
# Line 166 - Integration Tests
- name: Run integration tests
  run: npm run test:integration -- --coverage
  # REMOVED: continue-on-error: true
  # Tests skip gracefully when DATABASE_URL not set

# Line 184 - E2E Tests
- name: Run E2E tests
  run: npm run test:e2e
  # REMOVED: continue-on-error: true
  # Tests skip gracefully when infrastructure not ready
```

**Keep `continue-on-error: true` on:**

- Lint (305 errors baseline - fix separately)
- Coverage upload (informational)
- Snyk scan (conditional on token)

- [x] Remove `continue-on-error: true` from integration tests (line 166)
- [x] Remove `continue-on-error: true` from E2E tests (line 184)
- [x] Verify tests skip gracefully when env vars missing

---

### Phase 3: Deployment Verification (3 hours)

**Goal:** Know that deployments actually work, not just respond

#### 3.1 Build Agent Health Endpoint (2 hours)

**File:** `server/src/routes/internal-agent-health.routes.ts`

```typescript
import { Router, Request, Response } from 'express';
import { logger } from '../lib/core/logger';

const router = Router();

interface AgentHealth {
  name: string;
  reachable: boolean;
  latencyMs: number;
  error?: string;
}

interface HealthResponse {
  healthy: boolean;
  timestamp: string;
  agents: AgentHealth[];
}

const AGENT_URLS = {
  booking: process.env.BOOKING_AGENT_URL,
  marketing: process.env.MARKETING_AGENT_URL,
  storefront: process.env.STOREFRONT_AGENT_URL,
  research: process.env.RESEARCH_AGENT_URL,
  concierge: process.env.CONCIERGE_AGENT_URL,
} as const;

/**
 * Health check for all deployed agents.
 * Called by GitHub Actions after deployment.
 */
router.get('/agents/health', async (_req: Request, res: Response) => {
  const results: AgentHealth[] = [];

  for (const [name, url] of Object.entries(AGENT_URLS)) {
    if (!url) {
      results.push({ name, reachable: false, latencyMs: -1, error: 'URL not configured' });
      continue;
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
        headers: { 'X-Health-Check': 'true' },
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - start;

      results.push({
        name,
        reachable: response.ok,
        latencyMs,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      });
    } catch (error) {
      results.push({
        name,
        reachable: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const allReachable = results.every((r) => r.reachable);

  const response: HealthResponse = {
    healthy: allReachable,
    timestamp: new Date().toISOString(),
    agents: results,
  };

  logger.info({ agentHealth: response }, 'Agent health check completed');

  res.status(allReachable ? 200 : 503).json(response);
});

export default router;
```

**Register the route in `server/src/index.ts`:**

```typescript
import internalAgentHealthRoutes from './routes/internal-agent-health.routes';

// Mount under internal prefix (after auth middleware)
app.use('/v1/internal', verifyInternalSecret, internalAgentHealthRoutes);
```

- [x] Create `server/src/routes/internal-agent-health.routes.ts`
- [x] Register route in Express app
- [ ] Add agent URL env vars to Render if not present (manual step)

#### 3.2 Make Agent Workflow Fail on Health Check Failure (15 min)

**File:** `.github/workflows/deploy-agents.yml`

Replace the permissive health check with a failing one:

```yaml
- name: Verify deployment health
  run: |
    echo "🔍 Verifying agent health..."

    # Wait for Cloud Run to stabilize
    sleep 15

    # Check agent health with timeout
    HTTP_STATUS=$(curl -s -o /tmp/health.json -w "%{http_code}" \
      --max-time 30 \
      "$SERVICE_URL/health" || echo "000")

    if [ "$HTTP_STATUS" = "000" ]; then
      echo "❌ Agent unreachable after deployment"
      exit 1
    elif [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
      echo "✅ Agent healthy (HTTP $HTTP_STATUS)"
      cat /tmp/health.json
    else
      echo "❌ Agent unhealthy (HTTP $HTTP_STATUS)"
      cat /tmp/health.json
      exit 1
    fi
```

- [x] Update `deploy-agents.yml` health check to exit 1 on failure

#### 3.3 Use Deep Health Check in Production Deploy (10 min)

**File:** `.github/workflows/deploy-production.yml`

```yaml
# Change from /health to /health/ready
- name: Verify production health
  run: |
    if curl -f -s "${{ env.PRODUCTION_API_URL }}/health/ready" > /dev/null; then
      echo "✅ API is healthy (database connected)"
    else
      echo "❌ API health check failed"
      exit 1
    fi
```

- [x] Update production health check to use `/health/ready`

---

### Phase 4: Observability (1 hour)

**Goal:** Know when production breaks

#### 4.1 Require Sentry in Production (10 min)

**File:** `server/src/lib/errors/sentry.ts`

```typescript
export function initSentry(): { enabled: boolean } {
  const dsn = process.env.SENTRY_DSN;

  // Fail fast in production if Sentry not configured
  if (process.env.NODE_ENV === 'production' && !dsn) {
    throw new Error(
      'SENTRY_DSN is required in production. ' +
        'Set SENTRY_DSN environment variable or use NODE_ENV=development.'
    );
  }

  if (!dsn) {
    logger.info('Sentry disabled (non-production, no SENTRY_DSN)');
    return { enabled: false };
  }

  // ... existing Sentry initialization ...

  logger.info('Sentry initialized');
  return { enabled: true };
}
```

- [x] Update `sentry.ts` to throw in production without SENTRY_DSN
- [ ] Verify SENTRY_DSN is set in Render environment variables (manual step)

#### 4.2 Add Request ID to Agent Calls (30 min)

**File:** `server/src/agent-v2/services/vertex-agent.service.ts`

```typescript
// In the method that calls agents, add X-Request-ID header
const response = await fetch(agentUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Request-ID': req.id || crypto.randomUUID(), // From request logger middleware
    'X-Tenant-ID': tenantId,
  },
  body: JSON.stringify(payload),
});
```

- [x] Pass X-Request-ID header to agent calls
- [x] Log request ID on agent response (in existing logging)

---

## Verification Checklist

After implementation, verify:

- [x] `npm run validate:migrations` passes
- [x] Pre-commit hook runs on migration changes
- [x] CI applies migrations without rollback files
- [x] Integration tests fail visibly (not silently) when they fail
- [x] `/v1/internal/agents/health` returns agent status
- [x] Agent deployment fails if health check fails
- [x] Production deploy uses `/health/ready`
- [x] Server fails to start without SENTRY_DSN in production

---

## What We Deferred (Add Later When Needed)

| Feature                     | When to Add                                              |
| --------------------------- | -------------------------------------------------------- |
| Slack notifications         | When team > 3 people or on-call rotation exists          |
| PagerDuty/Opsgenie          | When you have formal on-call                             |
| Sentry alert rules          | When you have traffic that warrants monitoring           |
| Cross-workflow coordination | When agent deploys frequently fail (hasn't happened yet) |
| Full distributed tracing    | When debugging latency across services                   |

---

## Time Investment

| Phase                            | Time         | Value                          |
| -------------------------------- | ------------ | ------------------------------ |
| Phase 1: Schema Integrity        | 4 hours      | Prevents schema drift forever  |
| Phase 2: CI Enforcement          | 1 hour       | Makes test failures visible    |
| Phase 3: Deployment Verification | 3 hours      | Catches broken deployments     |
| Phase 4: Observability           | 1 hour       | Ensures production visibility  |
| **Total**                        | **~9 hours** | **Enterprise-grade stability** |

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
