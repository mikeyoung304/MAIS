/**
 * Metrics Routes
 *
 * Provides application metrics endpoint for monitoring systems (Prometheus, Datadog)
 * No authentication required - designed for scraping by monitoring tools
 */

import type { Express, Request, Response } from 'express';
import { logger } from '../lib/core/logger';

export interface MetricsDeps {
  startTime: number;
}

export function registerMetricsRoutes(app: Express, deps: MetricsDeps): void {
  /**
   * GET /metrics
   * Returns application metrics in JSON format
   * Can be extended to return Prometheus format in the future
   *
   * No authentication required - this endpoint is designed to be scraped
   * by monitoring systems without credentials
   */
  app.get('/metrics', (_req: Request, res: Response) => {
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
        service: 'mais-api',
      };

      res.status(200).json(metrics);
    } catch (error) {
      logger.error({ error }, 'Failed to collect metrics');
      res.status(500).json({ error: 'Failed to collect metrics' });
    }
  });
}
