#!/usr/bin/env tsx

/**
 * CLI command to run evaluation batch
 *
 * Evaluates unevaluated conversation traces across all active tenants.
 * Per DHH review: Use external cron (e.g., Render cron jobs) instead of
 * in-process scheduler for better visibility and control.
 *
 * Usage:
 *   pnpm eval-batch
 *   pnpm eval-batch --max-per-tenant=100
 *   pnpm eval-batch --dry-run
 *   pnpm eval-batch --tenant-id=<specific-tenant>
 *
 * Options:
 *   --max-per-tenant  Maximum traces to evaluate per tenant (default: 50)
 *   --dry-run         Show what would be evaluated without running
 *   --tenant-id       Only process a specific tenant
 *
 * External cron trigger (e.g., Render cron jobs):
 *   0 *\/15 * * * * pnpm eval-batch
 *
 * @see plans/agent-eval-remediation-plan.md Phase 4.3
 */

import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { createEvalPipeline, createEvaluator } from '../src/agent/evals';
import { logger } from '../src/lib/core/logger';
import { sanitizeError } from '../src/lib/core/error-sanitizer';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface BatchResult {
  tenantId: string;
  businessName: string;
  tracesFound: number;
  evaluated: number;
  flagged: number;
  errors: number;
}

interface BatchSummary {
  tenantsProcessed: number;
  totalTracesFound: number;
  totalEvaluated: number;
  totalFlagged: number;
  totalErrors: number;
  durationMs: number;
}

interface CliOptions {
  maxPerTenant: number;
  dryRun: boolean;
  tenantId?: string;
  help: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Argument Parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    maxPerTenant: 50,
    dryRun: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--max-per-tenant=')) {
      const value = parseInt(arg.split('=')[1], 10);
      if (!isNaN(value) && value > 0) {
        options.maxPerTenant = value;
      }
    } else if (arg.startsWith('--tenant-id=')) {
      const tenantId = arg.split('=')[1]?.trim();
      if (!tenantId) {
        console.error('Error: --tenant-id requires a value');
        process.exit(1);
      }
      const result = z.string().uuid().safeParse(tenantId);
      if (!result.success) {
        console.error('Error: --tenant-id must be a valid UUID');
        process.exit(1);
      }
      options.tenantId = result.data;
    }
  }

  return options;
}

function printUsage() {
  console.log(`
Usage: pnpm eval-batch [options]

Evaluate unevaluated conversation traces across all active tenants.

Options:
  --max-per-tenant=N  Maximum traces to evaluate per tenant (default: 50)
  --dry-run           Show what would be evaluated without running
  --tenant-id=ID      Only process a specific tenant
  --help, -h          Show this help message

Examples:
  pnpm eval-batch                          # Run with defaults
  pnpm eval-batch --dry-run                # Preview what would run
  pnpm eval-batch --max-per-tenant=100     # Evaluate more traces per tenant
  pnpm eval-batch --tenant-id=abc123       # Only process specific tenant

Cron integration (Render):
  0 */15 * * * * pnpm eval-batch           # Run every 15 minutes
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Logic
// ─────────────────────────────────────────────────────────────────────────────

async function runEvaluationBatch(
  prisma: PrismaClient,
  options: CliOptions
): Promise<{ results: BatchResult[]; summary: BatchSummary }> {
  const startTime = Date.now();
  const { maxPerTenant, dryRun, tenantId } = options;

  // Get tenants to process
  const whereClause = tenantId
    ? { id: tenantId, status: 'ACTIVE' as const }
    : { status: 'ACTIVE' as const };

  const tenants = await prisma.tenant.findMany({
    where: whereClause,
    select: { id: true, businessName: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });

  if (tenants.length === 0) {
    console.log('No active tenants found to process.');
    return {
      results: [],
      summary: {
        tenantsProcessed: 0,
        totalTracesFound: 0,
        totalEvaluated: 0,
        totalFlagged: 0,
        totalErrors: 0,
        durationMs: Date.now() - startTime,
      },
    };
  }

  console.log(`\nFound ${tenants.length} active tenant(s) to process.\n`);

  // Create evaluator and pipeline
  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(prisma, evaluator, {
    asyncProcessing: false, // Sync for CLI - we want to wait for results
  });

  const results: BatchResult[] = [];

  for (const tenant of tenants) {
    const displayName = tenant.businessName || tenant.slug || tenant.id;

    try {
      // Get unevaluated traces for this tenant
      const traceIds = await pipeline.getUnevaluatedTraces(tenant.id, maxPerTenant);

      if (traceIds.length === 0) {
        // Skip tenants with no traces to evaluate
        continue;
      }

      console.log(`📊 ${displayName}: ${traceIds.length} trace(s) to evaluate`);

      if (dryRun) {
        results.push({
          tenantId: tenant.id,
          businessName: displayName,
          tracesFound: traceIds.length,
          evaluated: 0,
          flagged: 0,
          errors: 0,
        });
        continue;
      }

      // Process the batch
      logger.info(
        {
          tenantId: tenant.id,
          businessName: displayName,
          traceCount: traceIds.length,
        },
        'Processing evaluation batch'
      );

      await pipeline.processBatch(tenant.id, traceIds);

      // Get flagged count after evaluation
      // Defense-in-depth: include tenantId even though traceIds are already tenant-scoped
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

      console.log(`   ✅ Evaluated: ${traceIds.length}, Flagged: ${flaggedCount}`);
    } catch (error) {
      logger.error(
        {
          tenantId: tenant.id,
          error: sanitizeError(error),
        },
        'Evaluation batch failed for tenant'
      );

      results.push({
        tenantId: tenant.id,
        businessName: displayName,
        tracesFound: 0,
        evaluated: 0,
        flagged: 0,
        errors: 1,
      });

      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Wait for any pending async evaluations
  await pipeline.waitForPending();

  // Build summary
  const summary: BatchSummary = {
    tenantsProcessed: results.length,
    totalTracesFound: results.reduce((sum, r) => sum + r.tracesFound, 0),
    totalEvaluated: results.reduce((sum, r) => sum + r.evaluated, 0),
    totalFlagged: results.reduce((sum, r) => sum + r.flagged, 0),
    totalErrors: results.reduce((sum, r) => sum + r.errors, 0),
    durationMs: Date.now() - startTime,
  };

  return { results, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Entry Point
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🤖 Agent Evaluation Batch Runner\n');

  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  // Validate ANTHROPIC_API_KEY
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required.\n');
    console.error('Set it in your .env file or export it before running this script.\n');
    process.exit(1);
  }

  // Validate DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is required.\n');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  Max per tenant: ${options.maxPerTenant}`);
  console.log(`  Dry run:        ${options.dryRun ? 'Yes' : 'No'}`);
  console.log(`  Tenant filter:  ${options.tenantId || 'All active tenants'}`);

  // Initialize Prisma with driver adapter (Prisma 7)
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const { results, summary } = await runEvaluationBatch(prisma, options);

    // Print summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 EVALUATION BATCH SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (options.dryRun) {
      console.log('🔍 DRY RUN - No evaluations were performed\n');
    }

    console.log(`Tenants processed:  ${summary.tenantsProcessed}`);
    console.log(`Traces found:       ${summary.totalTracesFound}`);
    console.log(`Traces evaluated:   ${summary.totalEvaluated}`);
    console.log(`Traces flagged:     ${summary.totalFlagged}`);
    console.log(`Errors:             ${summary.totalErrors}`);
    console.log(`Duration:           ${(summary.durationMs / 1000).toFixed(2)}s`);

    if (results.length > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 RESULTS BY TENANT');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.table(
        results.map((r) => ({
          Tenant: r.businessName.substring(0, 30),
          Found: r.tracesFound,
          Evaluated: r.evaluated,
          Flagged: r.flagged,
          Errors: r.errors,
        }))
      );
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Log summary for external monitoring
    logger.info(summary, 'Evaluation batch completed');

    process.exit(summary.totalErrors > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error during evaluation batch:\n');
    console.error(error instanceof Error ? error.message : error);
    logger.error({ error: sanitizeError(error) }, 'Evaluation batch failed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
