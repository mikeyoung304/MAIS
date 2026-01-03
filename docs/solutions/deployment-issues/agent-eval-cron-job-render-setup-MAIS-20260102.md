---
title: Agent Evaluation Cron Job Setup on Render
slug: agent-eval-cron-job-render-setup
category: Deployment Issues
tags:
  - agent-evaluation
  - cron-jobs
  - render
  - deployment
  - llm-evaluation
severity: P1
component: Render Blueprint, Agent Evaluation Pipeline
symptoms:
  - Agent evaluation runs are not happening automatically
  - Conversations are not being evaluated on schedule
  - Manual evaluation via CLI works but scheduled runs don't
  - Missing evaluation results in flagged conversations not being detected
---

## Summary

The agent evaluation system requires periodic batch processing to evaluate unevaluated conversation traces. This documentation covers the Render cron job setup that runs `run-eval-batch.ts` every 15 minutes to evaluate traces across all active tenants.

**Key Components:**

1. Render cron job service in `render.yaml`
2. CLI script `run-eval-batch.ts` with argument parsing
3. Evaluation pipeline integration with sampling configuration
4. Environment-specific configuration for model selection

## Architecture

### Evaluation Flow

```
Cron Job (every 15 min)
  ↓
run-eval-batch.ts (CLI)
  ├── Parse args (--max-per-tenant, --dry-run, --tenant-id)
  ├── Load active tenants
  ├── For each tenant:
  │   ├── Get unevaluated traces (limited by maxPerTenant)
  │   ├── Create evaluator + pipeline
  │   └── Process batch → evaluate & flag
  └── Log results to stdout + logger
```

### Key Design Decision: External Cron Jobs

Per DHH review: Use external cron (Render, AWS EventBridge) instead of in-process schedulers.

**Benefits:**

- Better visibility and control
- Easier to monitor and debug
- Can run without keeping API service alive
- Separates concerns (API vs batch processing)
- Easy to adjust schedule without redeploying API

## Implementation

### 1. Render Blueprint Configuration

**File:** `render.yaml`

```yaml
services:
  # Existing API service...
  - type: web
    name: mais-api
    # ... config ...

  # NEW: Agent Evaluation Cron Job
  - type: cron
    name: mais-eval-batch
    runtime: node
    region: oregon
    plan: starter
    schedule: '*/15 * * * *' # Every 15 minutes
    buildCommand: npm ci && npm run build --workspace=@macon/contracts && npm run build --workspace=@macon/shared && cd server && npm run prisma:generate
    startCommand: cd server && npx tsx scripts/run-eval-batch.ts
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: DIRECT_URL
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
```

**Why both `DATABASE_URL` and `DIRECT_URL`?**

Prisma 7 requires both URLs during build:

- `DATABASE_URL` = Session Pooler (port 5432, pgbouncer mode) - used at runtime for queries
- `DIRECT_URL` = Transaction Pooler (port 6543, no pgbouncer) - used during `prisma generate` for schema introspection

Without `DIRECT_URL`, `prisma generate` fails with:

```
PrismaConfigEnvError: Cannot resolve environment variable: DIRECT_URL
```

**Schedule Cron Expression:**

```
*/15 * * * *
 │  │ │ │ │
 │  │ │ │ └─ Day of week (0-6)
 │  │ │ └─── Month (1-12)
 │  │ └───── Day of month (1-31)
 │  └─────── Hour (0-23)
 └────────── Minute (*/15 = every 15 minutes)
```

Running every 15 minutes provides:

- Quick feedback on evaluation status
- Low compute cost (starter plan)
- 96 runs per day (reasonable volume)
- Real-time flagging for problematic conversations

### 2. CLI Script

**File:** `server/scripts/run-eval-batch.ts`

Core features:

#### Argument Parsing

```typescript
interface CliOptions {
  maxPerTenant: number; // Default: 50
  dryRun: boolean; // Preview without executing
  tenantId?: string; // Single tenant filter
  help: boolean; // Show usage
}

// Usage examples:
// pnpm eval-batch                          # Run with defaults
// pnpm eval-batch --dry-run                # Preview
// pnpm eval-batch --max-per-tenant=100     # More traces
// pnpm eval-batch --tenant-id=abc123       # Single tenant
```

#### Environment Validation

```typescript
// Required environment variables:
// - ANTHROPIC_API_KEY: For evaluation model API calls
// - DATABASE_URL: For trace data (Session Pooler, port 5432)
// - DIRECT_URL: For prisma generate during build (Transaction Pooler, port 6543)

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is required.');
  process.exit(1);
}
```

**Note:** `DIRECT_URL` is validated at build time by Prisma, not at runtime by the script.

#### Batch Processing

```typescript
async function runEvaluationBatch(
  prisma: PrismaClient,
  options: CliOptions
): Promise<{ results: BatchResult[]; summary: BatchSummary }> {
  // 1. Get active tenants (or single tenant if specified)
  const tenants = await prisma.tenant.findMany({
    where: tenantId ? { id: tenantId, isActive: true } : { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });

  // 2. Create evaluator + pipeline
  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(prisma, evaluator, {
    asyncProcessing: false, // Sync for CLI
  });

  // 3. For each tenant
  for (const tenant of tenants) {
    // Get unevaluated traces (limited)
    const traceIds = await pipeline.getUnevaluatedTraces(tenant.id, maxPerTenant);

    if (traceIds.length === 0) continue; // Skip if nothing to evaluate

    // Process batch
    await pipeline.processBatch(tenant.id, traceIds);

    // Count flagged
    const flaggedCount = await prisma.conversationTrace.count({
      where: {
        tenantId: tenant.id,
        id: { in: traceIds },
        flagged: true,
      },
    });

    results.push({
      tenantId: tenant.id,
      businessName: displayName,
      tracesFound: traceIds.length,
      evaluated: traceIds.length,
      flagged: flaggedCount,
      errors: 0,
    });
  }

  // 4. Return summary
  return { results, summary };
}
```

#### Defense-in-Depth Query Scoping

```typescript
// Include tenantId even though traceIds are already tenant-scoped
// This prevents accidental cross-tenant data leakage
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    tenantId: tenant.id, // ✅ Always include
    id: { in: traceIds }, // Filtered by trace IDs
    flagged: true, // Only flagged traces
  },
});
```

#### Output Format

```
🤖 Agent Evaluation Batch Runner

Configuration:
  Max per tenant: 50
  Dry run:        No
  Tenant filter:  All active tenants

Found 5 active tenant(s) to process.

📊 Bella Weddings: 12 trace(s) to evaluate
   ✅ Evaluated: 12, Flagged: 2
📊 Studio Props: 8 trace(s) to evaluate
   ✅ Evaluated: 8, Flagged: 1
📊 Coach Coaching: 0 trace(s) to evaluate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 EVALUATION BATCH SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tenants processed:  3
Traces found:       20
Traces evaluated:   20
Traces flagged:     3
Errors:             0
Duration:           12.45s
```

### 3. Model Configuration

**Current:** `claude-haiku-4-5-20251001`

The Render cron job uses this model because:

- **Low cost:** $0.80/million input tokens
- **Fast inference:** 15-min batch window
- **Good accuracy:** Sufficient for evaluation rubrics
- **Production-ready:** Reliable model in API availability

**Why not Claude Opus 4.5?**

- Higher cost per token
- Longer latency (10+ seconds per evaluation)
- 96 runs/day × many traces = expensive
- Haiku accuracy is sufficient for current rubrics

**Model selection logic:**

```typescript
const evaluator = createEvaluator();
// Internally selects claude-haiku-4-5-20251001
```

### 4. Sampling Configuration

For production with low trace volume, use 100% sampling:

```typescript
const pipeline = createEvalPipeline(prisma, evaluator, {
  asyncProcessing: false,
  sampling: 1.0, // Evaluate ALL traces (100%)
});
```

**Sampling levels:**

```
1.0  = 100% (all traces)  - Use when: < 100 traces/day
0.5  = 50%  (half)        - Use when: 100-500 traces/day
0.1  = 10%  (sampling)    - Use when: > 500 traces/day
```

With 100% sampling, even small volumes are fully evaluated, ensuring quality insight.

## Deployment Checklist

### On Render Dashboard

1. **Create Cron Job Service**
   - Type: `Cron Job`
   - Name: `mais-eval-batch`
   - Runtime: `Node`
   - Region: `Oregon` (same as API)
   - Plan: `Starter` (free tier, only billed for compute)
   - Schedule: `*/15 * * * *`
   - Build command: (as shown above)
   - Start command: (as shown above)

2. **Set Environment Variables**
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = Session Pooler URL (port 5432 with pgbouncer, from Supabase Connect → Session Pooler)
   - `DIRECT_URL` = Transaction Pooler URL (port 6543, no pgbouncer, from Supabase Connect → Transaction Pooler)
   - `ANTHROPIC_API_KEY` = (from Anthropic dashboard)

   **Important:** Both database URLs are required. `DATABASE_URL` is used at runtime, `DIRECT_URL` is used during `prisma generate` in the build step.

3. **Link to Repository**
   - Connect GitHub repo
   - Select `main` branch
   - Enable automatic deployments

4. **Monitor First Run**
   - Check render logs
   - Verify traces are being evaluated
   - Confirm flagged conversations are detected

### Local Testing

```bash
# Default run (50 traces per tenant)
npm run eval-batch

# Preview without executing
npm run eval-batch -- --dry-run

# Evaluate more traces per tenant
npm run eval-batch -- --max-per-tenant=100

# Single tenant
npm run eval-batch -- --tenant-id=abc123

# View help
npm run eval-batch -- --help
```

## Monitoring

### Key Metrics

From the batch summary:

```
Tenants processed:  5
Traces found:       47
Traces evaluated:   47
Traces flagged:     6
Errors:             0
Duration:           23.45s
```

**Monitor these KPIs:**

- `Traces evaluated per run` - Should be close to total traces available
- `Traces flagged ratio` - Currently ~12% (6/47)
- `Error count` - Should be 0
- `Duration` - Should be < 30s for < 50 traces

### Render Logs

Render stores cron job logs for 7 days. Key log lines:

```
✅ Created Prisma barrel file: src/generated/prisma/index.ts
📊 Tenant A: 12 trace(s) to evaluate
   ✅ Evaluated: 12, Flagged: 2
📊 Tenant B: 8 trace(s) to evaluate
   ✅ Evaluated: 8, Flagged: 1
```

### Application Logs

Structured logs via `logger.info`:

```json
{
  "level": "info",
  "message": "Processing evaluation batch",
  "tenantId": "abc123",
  "businessName": "Bella Weddings",
  "traceCount": 12
}
```

## Troubleshooting

### Cron job not running

**Check:**

1. Cron service is active on Render dashboard
2. Build command succeeds (check logs)
3. `ANTHROPIC_API_KEY` is set
4. `DATABASE_URL` is set and valid

**Solution:**

```bash
# Manually test the script locally
npm run eval-batch -- --dry-run
```

### "Cannot find module './generated/prisma'"

**This is the Prisma 7 barrel file issue.** See the related solution:
`docs/solutions/build-issues/prisma-7-barrel-file-render-deployment-MAIS-20260102.md`

The `buildCommand` must include `npm run prisma:generate` which automatically creates the barrel file.

### "PrismaConfigEnvError: Cannot resolve environment variable: DIRECT_URL"

**Cause:** Prisma 7 requires `DIRECT_URL` during `prisma generate` for schema introspection.

**Solution:**

1. Render dashboard → mais-eval-batch → Environment
2. Add `DIRECT_URL` environment variable
3. Value: Transaction Pooler URL from Supabase (port 6543, no pgbouncer)
   - Supabase Dashboard → Connect → Transaction Pooler → Copy connection string
4. Redeploy the cron job

**Note:** `DATABASE_URL` uses Session Pooler (port 5432 with pgbouncer) for runtime queries, while `DIRECT_URL` uses Transaction Pooler (port 6543) for build-time schema introspection.

### "ANTHROPIC_API_KEY environment variable is required"

Ensure the environment variable is set in Render dashboard:

1. Render dashboard → mais-eval-batch → Environment
2. Add: `ANTHROPIC_API_KEY` = (your API key from Anthropic)
3. Deploy

### "No active tenants found to process"

This is normal if you're testing with a fresh database. The script will log this and exit cleanly.

To test:

```bash
# Create a test tenant first
npm run create-tenant

# Then run eval batch
npm run eval-batch
```

## Next Steps

### Phase 6: Cost Optimization

- Monitor actual token usage and costs
- Adjust sampling if traces exceed 500/day
- Consider batch consolidation (e.g., every 30 min instead of 15)

### Phase 7: Enhanced Monitoring

- Add Render metrics to dashboard
- Set up alerts for error rates > 5%
- Track evaluation latency trends

## References

- **Render Cron Jobs:** https://render.com/docs/cron-jobs
- **Agent Evaluation Pipeline:** `/server/src/agent/evals/pipeline.ts`
- **Evaluation Batch CLI:** `/server/scripts/run-eval-batch.ts`
- **Related:** `docs/solutions/build-issues/prisma-7-barrel-file-render-deployment-MAIS-20260102.md`

## Commit Reference

Session: Agent Eval Cron Job Setup on Render
Fixes:

1. Added `mais-eval-batch` cron service to `render.yaml`
2. Implemented `run-eval-batch.ts` CLI with argument parsing
3. Configured 15-minute schedule for batch processing
4. Set up environment variables for production
5. Added defense-in-depth query scoping (tenantId + traceIds)
