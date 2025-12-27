/**
 * Health Check Routes
 *
 * Provides three health check endpoints for Kubernetes/Docker monitoring:
 * - /health/live  - Liveness probe (is process running?)
 * - /health/ready - Readiness probe (can handle requests?)
 * - /health       - Legacy endpoint (maps to liveness)
 */

import type { Express, Request, Response } from 'express';
import { logger } from '../lib/core/logger';
import type { PrismaClient } from '../generated/prisma';
import type { Config } from '../lib/core/config';
import type { HealthCheckService } from '../services/health-check.service';

export interface HealthCheckDeps {
  prisma?: PrismaClient;
  config: Config;
  startTime: number;
  healthCheckService?: HealthCheckService;
}

export function registerHealthRoutes(app: Express, deps: HealthCheckDeps): void {
  /**
   * Liveness Probe - K8s uses this to restart unhealthy pods
   * Returns 200 if the application process is running
   * Should NEVER check external dependencies (DB, Stripe, etc.)
   */
  app.get('/health/live', (_req: Request, res: Response) => {
    const uptime = Math.floor((Date.now() - deps.startTime) / 1000);

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime,
      service: 'handled-api',
      version: process.env.npm_package_version || 'unknown',
    });
  });

  /**
   * Readiness Probe - K8s uses this to route traffic
   * Returns 200 only if the application can handle requests
   * Checks database connectivity and required dependencies
   */
  app.get('/health/ready', async (_req: Request, res: Response): Promise<void> => {
    const mode = deps.config.ADAPTERS_PRESET;
    const checks: {
      database?: { status: string; latency?: number; error?: string };
      config?: { status: string; missing?: string[] };
      mode: string;
    } = { mode };

    let isReady = true;

    // Mock mode - always ready (no external dependencies)
    if (mode === 'mock') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks,
      });
      return;
    }

    // Real mode - check database connectivity
    if (deps.prisma) {
      try {
        const startTime = Date.now();
        // Simple ping query with 5-second timeout
        await deps.prisma.$queryRaw`SELECT 1 as health_check`;
        const latency = Date.now() - startTime;

        checks.database = { status: 'healthy', latency };

        // Warn if query is slow (>1s indicates connection pool issues)
        if (latency > 1000) {
          logger.warn({ latency }, 'Database health check slow (>1s)');
        }
      } catch (error) {
        isReady = false;
        checks.database = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        logger.error({ error }, 'Database health check failed');
      }
    }

    // Check required environment variables (real mode)
    const requiredKeys = ['DATABASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const;

    const missing: string[] = [];
    for (const key of requiredKeys) {
      if (!deps.config[key as keyof Config]) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      isReady = false;
      checks.config = { status: 'incomplete', missing };
    } else {
      checks.config = { status: 'complete' };
    }

    const status = isReady ? 'ready' : 'not_ready';
    const statusCode = isReady ? 200 : 503;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  /**
   * Legacy health endpoint with optional deep check
   * - GET /health - Basic liveness check (backward compatible)
   * - GET /health?deep=true - Extended health check with external services
   *
   * Deep check verifies connectivity to:
   * - Stripe (payment processing)
   * - Postmark (email delivery)
   * - Google Calendar (calendar sync)
   *
   * Response caching: 60 seconds per service to avoid rate limiting
   * Timeout: 5 seconds per service check
   */
  app.get('/health', async (req: Request, res: Response): Promise<void> => {
    const isDeepCheck = req.query.deep === 'true';

    // Basic health check (backward compatible)
    if (!isDeepCheck) {
      res.status(200).json({ ok: true });
      return;
    }

    // Deep health check (external services)
    if (!deps.healthCheckService) {
      res.status(503).json({
        status: 'degraded',
        error: 'Deep health checks not available (service not configured)',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Run all external service checks in parallel
    const [stripeCheck, postmarkCheck, calendarCheck] = await Promise.all([
      deps.healthCheckService.checkStripe(),
      deps.healthCheckService.checkPostmark(),
      deps.healthCheckService.checkGoogleCalendar(),
    ]);

    const checks = {
      stripe: stripeCheck,
      postmark: postmarkCheck,
      googleCalendar: calendarCheck,
    };

    // Determine overall health (unhealthy if ANY service is unhealthy)
    const allHealthy = Object.values(checks).every((check) => check.status === 'healthy');
    const status = allHealthy ? 'healthy' : 'degraded';
    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json({
      status,
      checks,
      timestamp: new Date().toISOString(),
      mode: deps.config.ADAPTERS_PRESET,
    });
  });
}
