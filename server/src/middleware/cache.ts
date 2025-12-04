/**
 * Simple in-memory HTTP response caching middleware
 * Uses node-cache for LRU cache with TTL support
 */

import type { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { logger } from '../lib/core/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 300 = 5 minutes)
  keyGenerator?: (req: Request) => string;
}

// Global cache instance
const cache = new NodeCache({
  stdTTL: 300, // Default 5 minutes
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false, // Better performance, but be careful with mutation
});

/**
 * Creates a caching middleware for GET requests
 *
 * @param options - Cache configuration options
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * // Cache for 5 minutes (default)
 * app.get('/v1/packages', cacheMiddleware(), handler);
 *
 * // Cache for 15 minutes
 * app.get('/v1/packages', cacheMiddleware({ ttl: 900 }), handler);
 * ```
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const ttl = options.ttl || 300; // Default 5 minutes

  const keyGenerator =
    options.keyGenerator ||
    ((req: Request) => {
      // Default: use method + path + query string
      return `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
    });

  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    const key = keyGenerator(req);

    // Check if response is in cache
    const cachedResponse = cache.get<{
      status: number;
      body: any;
      headers: Record<string, string>;
    }>(key);

    if (cachedResponse) {
      logger.debug({ key, ttl }, 'Cache hit');

      // Send cached response
      res.status(cachedResponse.status);

      // Set cached headers
      if (cachedResponse.headers) {
        Object.entries(cachedResponse.headers).forEach(([headerKey, headerValue]) => {
          res.setHeader(headerKey, headerValue);
        });
      }

      // Add cache indicator header
      res.setHeader('X-Cache', 'HIT');
      res.json(cachedResponse.body);
      return;
    }

    // Cache miss - intercept response
    logger.debug({ key, ttl }, 'Cache miss');

    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = function (body: any) {
      // Only cache successful responses (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const headers: Record<string, string> = {};

        // Capture relevant headers
        const headersToCopy = ['content-type', 'etag'];
        headersToCopy.forEach((headerName) => {
          const value = res.getHeader(headerName);
          if (value) {
            headers[headerName] = String(value);
          }
        });

        cache.set(
          key,
          {
            status: res.statusCode,
            body,
            headers,
          },
          ttl
        );

        logger.debug({ key, ttl, status: res.statusCode }, 'Response cached');
      }

      // Add cache indicator header
      res.setHeader('X-Cache', 'MISS');

      // Call original json method
      return originalJson(body);
    };

    next();
  };
}

/**
 * Clears the entire cache or specific keys
 *
 * @param pattern - Optional string pattern to match keys (supports wildcard)
 *
 * @example
 * ```typescript
 * // Clear entire cache
 * clearCache();
 *
 * // Clear all package-related cache entries
 * clearCache('GET:/v1/packages*');
 * ```
 */
export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.flushAll();
    logger.info('Cache cleared (all keys)');
    return;
  }

  const keys = cache.keys();
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  const matchingKeys = keys.filter((key) => regex.test(key));

  matchingKeys.forEach((key) => cache.del(key));
  logger.info({ pattern, count: matchingKeys.length }, 'Cache cleared (pattern match)');
}

/**
 * Gets cache statistics
 */
export function getCacheStats() {
  return cache.getStats();
}
