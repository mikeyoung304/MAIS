---
title: "Agent Evaluation Cron Job Setup on Render"
slug: agent-eval-cron-job-setup
date: 2026-01-03
category: patterns
severity: P2
tags: [agent-eval, cron, render, llm-as-judge, haiku]
---

# Agent Evaluation Cron Job Setup on Render

## Overview

Set up automated agent conversation evaluation using Claude Haiku 4.5 as an LLM-as-Judge, running every 15 minutes via Render cron jobs.

## Configuration

### render.yaml

```yaml
# Agent Evaluation Cron Job
- type: cron
  name: mais-eval-batch
  runtime: node
  region: oregon
  plan: starter
  schedule: "*/15 * * * *"  # Every 15 minutes
  buildCommand: npm ci && npm run build --workspace=@macon/contracts && npm run build --workspace=@macon/shared && cd server && npm run prisma:generate
  startCommand: cd server && npx tsx scripts/run-eval-batch.ts
  envVars:
    - key: NODE_ENV
      value: production
    - key: DATABASE_URL
      sync: false
    - key: ANTHROPIC_API_KEY
      sync: false
```

### Required Environment Variables

| Key | Description |
|-----|-------------|
| `DATABASE_URL` | Copy from mais-api service |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

## Key Settings

### Model Selection

```typescript
// server/src/agent/evals/evaluator.ts
const DEFAULT_EVAL_MODEL = 'claude-haiku-4-5';  // Fast, cheap, smart
```

### Sampling Rate

```typescript
// server/src/agent/evals/pipeline.ts
const DEFAULT_CONFIG: PipelineConfig = {
  samplingRate: 1.0,  // 100% for low-volume phase
  evaluateFlagged: true,
  evaluateFailedTasks: true,
  batchSize: 10,
  asyncProcessing: true,
};
```

## Cost Estimate

- **Haiku 4.5:** $1/$5 per million input/output tokens
- **Per evaluation:** ~$0.01-0.05
- **100 conversations/day:** ~$3-5/month

## Manual Run

```bash
cd server && npx tsx scripts/run-eval-batch.ts
cd server && npx tsx scripts/run-eval-batch.ts --dry-run
cd server && npx tsx scripts/run-eval-batch.ts --tenant-id=<uuid>
```

## Architecture

```
Conversation → ConversationTrace (DB)
                      ↓
              (5-min cooldown)
                      ↓
Cron Job → EvalPipeline → Claude Haiku 4.5
                      ↓
              evalScore, evalDimensions saved
```
