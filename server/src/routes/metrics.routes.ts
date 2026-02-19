/**
 * Metrics Routes
 *
 * Provides application metrics endpoint for monitoring systems (Prometheus, Datadog)
 *
 * Security: Protected by bearer token authentication when METRICS_BEARER_TOKEN is set.
 * Configure Prometheus scrape config with bearer_token to authenticate.
 *
 * Endpoints:
 * - GET /metrics - Prometheus text format (for Prometheus scraping)
 * - GET /metrics/json - JSON format (for debugging and Datadog)
 * - GET /metrics/agent - Agent-specific metrics (deprecated - agents now on Cloud Run)
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { register, collectDefaultMetrics, Counter, Gauge } from 'prom-client';
import { logger } from '../lib/core/logger';
import { getConfig } from '../lib/core/config';
import { timingSafeCompare } from '../lib/timing-safe';

/**
 * Metrics authentication middleware
 *
 * When METRICS_BEARER_TOKEN is configured:
 * - Requires Authorization: Bearer <token> header
 * - Returns 401 if token is missing or invalid
 *
 * When METRICS_BEARER_TOKEN is NOT configured:
 * - In production (NODE_ENV=production): Returns 403 (metrics disabled)
 * - In development: Allows access with a warning log
 */
function metricsAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const expectedToken = getConfig().METRICS_BEARER_TOKEN;

  // If token is configured, require it
  if (expectedToken) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }

    // Check Bearer token format
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      res
        .status(401)
        .json({ error: 'Invalid Authorization header format. Expected: Bearer <token>' });
      return;
    }

    const providedToken = tokenMatch[1];

    // Constant-time comparison to prevent timing attacks
    if (!timingSafeCompare(providedToken, expectedToken)) {
      logger.warn({ ip: req.ip }, 'Invalid metrics bearer token');
      res.status(401).json({ error: 'Invalid bearer token' });
      return;
    }

    next();
    return;
  }

  // Token not configured
  if (getConfig().NODE_ENV === 'production') {
    // In production, refuse to expose metrics without auth
    logger.error('METRICS_BEARER_TOKEN not configured - metrics endpoint disabled in production');
    res.status(403).json({
      error: 'Metrics endpoint disabled. Configure METRICS_BEARER_TOKEN to enable.',
    });
    return;
  }

  // In development, allow but warn (once per startup)
  if (!metricsAuthWarningLogged) {
    logger.warn(
      'METRICS_BEARER_TOKEN not configured - metrics endpoints are unauthenticated. ' +
        'Set METRICS_BEARER_TOKEN in production.'
    );
    metricsAuthWarningLogged = true;
  }

  next();
}

// Avoid log spam - warn only once per startup
let metricsAuthWarningLogged = false;

export interface MetricsDeps {
  startTime: number;
}

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({
  prefix: 'handled_',
  labels: { service: 'handled-api' },
});

// Custom application metrics
const httpRequestsTotal = new Counter({
  name: 'handled_http_requests_total',
  help: 'Total HTTP requests by method, path, and status',
  labelNames: ['method', 'path', 'status'] as const,
});

const httpRequestDuration = new Gauge({
  name: 'handled_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'] as const,
});

const uptimeGauge = new Gauge({
  name: 'handled_uptime_seconds',
  help: 'Server uptime in seconds',
});

export function registerMetricsRoutes(app: Express, deps: MetricsDeps): void {
  // Update uptime gauge periodically
  setInterval(() => {
    uptimeGauge.set(Math.floor((Date.now() - deps.startTime) / 1000));
  }, 5000);

  // Initialize uptime
  uptimeGauge.set(0);

  /**
   * GET /metrics
   * Returns all metrics in Prometheus text format
   *
   * Protected by bearer token when METRICS_BEARER_TOKEN is configured.
   *
   * Note: Agent-specific metrics now live in Cloud Run (Vertex AI observability).
   */
  app.get('/metrics', metricsAuthMiddleware, async (_req: Request, res: Response) => {
    try {
      // Get default registry metrics (Node.js, HTTP, uptime)
      const defaultMetrics = await register.metrics();

      res.set('Content-Type', register.contentType);
      res.status(200).send(defaultMetrics);
    } catch (error) {
      logger.error({ error }, 'Failed to collect Prometheus metrics');
      res.status(500).send('# Error collecting metrics');
    }
  });

  /**
   * GET /metrics/json
   * Returns metrics in JSON format (backwards compatible)
   * Useful for debugging and non-Prometheus monitoring systems
   *
   * Protected by bearer token when METRICS_BEARER_TOKEN is configured.
   */
  app.get('/metrics/json', metricsAuthMiddleware, (_req: Request, res: Response) => {
    try {
      const now = Date.now();
      const uptimeSeconds = Math.floor((now - deps.startTime) / 1000);

      const metrics = {
        // Timestamp
        timestamp: new Date().toISOString(),
        timestamp_ms: now,

        // Process metrics
        uptime_seconds: uptimeSeconds,
        memory_usage: process.memoryUsage(),

        // CPU usage
        cpu_usage: process.cpuUsage(),

        // Service metadata
        service: 'handled-api',
        version: getConfig().npm_package_version || 'unknown',
        node_version: process.version,
      };

      res.status(200).json(metrics);
    } catch (error) {
      logger.error({ error }, 'Failed to collect JSON metrics');
      res.status(500).json({ error: 'Failed to collect metrics' });
    }
  });

  /**
   * GET /metrics/agent
   * Agent-specific metrics endpoint (deprecated)
   *
   * Agent metrics have moved to Vertex AI Cloud Run observability.
   * This endpoint is preserved for backwards compatibility.
   */
  app.get('/metrics/agent', metricsAuthMiddleware, (_req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res
      .status(200)
      .send(
        '# HELP agent_metrics_deprecated Agent metrics have moved to Vertex AI Cloud Run\n' +
          '# TYPE agent_metrics_deprecated gauge\n' +
          'agent_metrics_deprecated 1\n'
      );
  });
}

/**
 * Middleware to record HTTP metrics
 * Call this from your Express app setup
 */
export function createMetricsMiddleware() {
  return (req: Request, res: Response, next: () => void) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;

      // Normalize path to prevent high cardinality
      // Replace UUIDs, IDs, and numeric segments with placeholders
      const normalizedPath = req.path
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
        .replace(/\/\d+/g, '/:id');

      httpRequestsTotal.inc({
        method: req.method,
        path: normalizedPath,
        status: res.statusCode.toString(),
      });

      httpRequestDuration.set(
        {
          method: req.method,
          path: normalizedPath,
        },
        duration
      );
    });

    next();
  };
}
