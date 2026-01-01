/**
 * Metrics Routes
 *
 * Provides application metrics endpoint for monitoring systems (Prometheus, Datadog)
 * No authentication required - designed for scraping by monitoring tools
 *
 * Endpoints:
 * - GET /metrics - Prometheus text format (for Prometheus scraping)
 * - GET /metrics/json - JSON format (for debugging and Datadog)
 */

import type { Express, Request, Response } from 'express';
import { register, collectDefaultMetrics, Counter, Gauge } from 'prom-client';
import { logger } from '../lib/core/logger';
import { getAgentMetrics, getAgentMetricsContentType } from '../agent/orchestrator/metrics';

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
   * Combines default Node.js metrics with agent-specific metrics
   *
   * No authentication required - designed for Prometheus scraping
   */
  app.get('/metrics', async (_req: Request, res: Response) => {
    try {
      // Get default registry metrics (Node.js, HTTP, uptime)
      const defaultMetrics = await register.metrics();

      // Get agent-specific metrics
      const agentMetricsText = await getAgentMetrics();

      // Combine both metric sets
      const allMetrics = defaultMetrics + '\n' + agentMetricsText;

      res.set('Content-Type', register.contentType);
      res.status(200).send(allMetrics);
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
   * No authentication required
   */
  app.get('/metrics/json', (_req: Request, res: Response) => {
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
        version: process.env.npm_package_version || 'unknown',
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
   * Returns only agent-specific metrics in Prometheus format
   * Useful for targeted monitoring of AI agent behavior
   */
  app.get('/metrics/agent', async (_req: Request, res: Response) => {
    try {
      const agentMetricsText = await getAgentMetrics();
      res.set('Content-Type', getAgentMetricsContentType());
      res.status(200).send(agentMetricsText);
    } catch (error) {
      logger.error({ error }, 'Failed to collect agent metrics');
      res.status(500).send('# Error collecting agent metrics');
    }
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
