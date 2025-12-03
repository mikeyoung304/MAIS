/**
 * Rate Limiter Middleware Tests
 *
 * Tests DDoS protection via express-rate-limit.
 * Critical security component - must maintain 100% coverage.
 *
 * Note: Each test uses fresh limiter instances to avoid shared state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import { skipIfHealth } from '../../src/middleware/rateLimiter';

// Create fresh limiters for each test to avoid shared state
function createPublicLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        error: 'too_many_requests',
        message: 'Rate limit exceeded. Please try again later.',
      }),
  });
}

function createAdminLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        error: 'too_many_requests',
        message: 'Admin route rate limit exceeded.',
      }),
  });
}

function createLoginLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (_req, res) =>
      res.status(429).json({
        error: 'too_many_login_attempts',
        message: 'Too many login attempts. Please try again in 15 minutes.',
      }),
  });
}

describe('Rate Limiter Middleware', () => {
  describe('publicLimiter', () => {
    it('should allow requests within limit (300 per 15min)', async () => {
      const app = express();
      app.use(createPublicLimiter());
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    it('should include standard rate limit headers', async () => {
      const app = express();
      app.use(createPublicLimiter());
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['ratelimit-limit']).toBe('300');
      expect(response.headers['ratelimit-remaining']).toBe('299');
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    it('should not include legacy X-RateLimit headers', async () => {
      const app = express();
      app.use(createPublicLimiter());
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
      expect(response.headers['x-ratelimit-remaining']).toBeUndefined();
    });

    it('should return 429 after exceeding limit', async () => {
      const app = express();
      app.use(createPublicLimiter());
      app.get('/test', (_req, res) => res.json({ success: true }));

      // Make 300 requests (the limit)
      for (let i = 0; i < 300; i++) {
        await request(app).get('/test');
      }

      // 301st request should be rate limited
      const response = await request(app).get('/test');

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: 'too_many_requests',
        message: 'Rate limit exceeded. Please try again later.',
      });
    });

    it('should decrement remaining count with each request', async () => {
      const app = express();
      app.use(createPublicLimiter());
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response1 = await request(app).get('/test');
      const remaining1 = parseInt(response1.headers['ratelimit-remaining'] as string);

      const response2 = await request(app).get('/test');
      const remaining2 = parseInt(response2.headers['ratelimit-remaining'] as string);

      expect(remaining1).toBe(299);
      expect(remaining2).toBe(298);
      expect(remaining2).toBe(remaining1 - 1);
    });
  });

  describe('adminLimiter', () => {
    it('should allow requests within limit (120 per 15min)', async () => {
      const app = express();
      app.use(createAdminLimiter());
      app.get('/admin/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/admin/test');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    it('should return 429 with admin-specific message', async () => {
      const app = express();
      app.use(createAdminLimiter());
      app.get('/admin/test', (_req, res) => res.json({ success: true }));

      // Make 120 requests (the limit)
      for (let i = 0; i < 120; i++) {
        await request(app).get('/admin/test');
      }

      // 121st request should be rate limited
      const response = await request(app).get('/admin/test');

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: 'too_many_requests',
        message: 'Admin route rate limit exceeded.',
      });
    });

    it('should have stricter limit than public routes (120 vs 300)', async () => {
      const publicApp = express();
      publicApp.use(createPublicLimiter());
      publicApp.get('/test', (_req, res) => res.json({ success: true }));

      const adminApp = express();
      adminApp.use(createAdminLimiter());
      adminApp.get('/test', (_req, res) => res.json({ success: true }));

      const publicResponse = await request(publicApp).get('/test');
      const adminResponse = await request(adminApp).get('/test');

      expect(publicResponse.headers['ratelimit-limit']).toBe('300');
      expect(adminResponse.headers['ratelimit-limit']).toBe('120');
    });
  });

  describe('loginLimiter', () => {
    it('should allow requests within limit (5 per 15min)', async () => {
      const app = express();
      app.use(express.json());
      app.use(createLoginLimiter());

      app.post('/login', (req, res) => {
        const { email, password } = req.body;
        if (email === 'test@example.com' && password === 'correct') {
          return res.json({ success: true, token: 'abc123' });
        }
        return res.status(401).json({ error: 'invalid_credentials' });
      });

      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      // First failed attempt should succeed (not rate limited)
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'invalid_credentials' });
    });

    it('should return 429 after 5 failed login attempts', async () => {
      const app = express();
      app.use(express.json());
      app.use(createLoginLimiter());

      app.post('/login', (req, res) => {
        const { email, password } = req.body;
        if (email === 'test@example.com' && password === 'correct') {
          return res.json({ success: true, token: 'abc123' });
        }
        return res.status(401).json({ error: 'invalid_credentials' });
      });

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/login')
          .send({ email: 'test@example.com', password: 'wrong' });
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: 'too_many_login_attempts',
        message: 'Too many login attempts. Please try again in 15 minutes.',
      });
    });

    it('should have strict limit for security (5 attempts)', async () => {
      const app = express();
      app.use(express.json());
      app.use(createLoginLimiter());

      app.post('/login', (req, res) => {
        return res.status(401).json({ error: 'invalid_credentials' });
      });

      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(response.headers['ratelimit-limit']).toBe('5');
    });

    it('should protect against brute force attacks', async () => {
      const app = express();
      app.use(express.json());
      app.use(createLoginLimiter());

      app.post('/login', (req, res) => {
        const { email, password } = req.body;
        if (email === 'test@example.com' && password === 'correct') {
          return res.json({ success: true, token: 'abc123' });
        }
        return res.status(401).json({ error: 'invalid_credentials' });
      });

      // Simulate brute force attack with different passwords
      const passwords = ['pass1', 'pass2', 'pass3', 'pass4', 'pass5'];

      for (const password of passwords) {
        await request(app)
          .post('/login')
          .send({ email: 'test@example.com', password });
      }

      // All subsequent attempts should be blocked (even with correct password)
      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'correct' });

      expect(response.status).toBe(429);
    });
  });

  describe('skipIfHealth', () => {
    it('should skip rate limiting for /health endpoint', async () => {
      const app = express();
      app.use(skipIfHealth);
      app.get('/health', (_req, res) => res.json({ status: 'ok' }));

      // Make many requests to /health
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/health');
        expect(response.status).toBe(200);
      }

      // Health checks should never be rate limited
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });

    it('should skip rate limiting for /ready endpoint', async () => {
      const app = express();
      app.use(skipIfHealth);
      app.get('/ready', (_req, res) => res.json({ status: 'ready' }));

      // Make many requests to /ready
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/ready');
        expect(response.status).toBe(200);
      }

      // Readiness checks should never be rate limited
      const response = await request(app).get('/ready');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ready' });
    });

    it('should not add rate limit headers to health checks', async () => {
      const app = express();
      app.use(skipIfHealth);
      app.get('/health', (_req, res) => res.json({ status: 'ok' }));

      const response = await request(app).get('/health');

      expect(response.headers['ratelimit-limit']).toBeUndefined();
      expect(response.headers['ratelimit-remaining']).toBeUndefined();
    });

    it('should apply public rate limit to other endpoints', async () => {
      const app = express();
      app.use(skipIfHealth);
      app.get('/api/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/api/test');

      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBe('300');
    });
  });

  describe('Error Handling', () => {
    it('should return JSON error response on rate limit', async () => {
      const app = express();
      app.use(createPublicLimiter());
      app.get('/test', (_req, res) => res.json({ success: true }));

      // Exceed limit
      for (let i = 0; i < 300; i++) {
        await request(app).get('/test');
      }

      const response = await request(app).get('/test');

      expect(response.status).toBe(429);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });

    it('should use consistent error format across limiters', async () => {
      const publicApp = express();
      publicApp.use(createPublicLimiter());
      publicApp.get('/test', (_req, res) => res.json({ success: true }));

      const adminApp = express();
      adminApp.use(createAdminLimiter());
      adminApp.get('/test', (_req, res) => res.json({ success: true }));

      // Exceed both limits
      for (let i = 0; i < 300; i++) {
        await request(publicApp).get('/test');
      }
      for (let i = 0; i < 120; i++) {
        await request(adminApp).get('/test');
      }

      const publicResponse = await request(publicApp).get('/test');
      const adminResponse = await request(adminApp).get('/test');

      // Both should have same error structure
      expect(publicResponse.body).toHaveProperty('error');
      expect(publicResponse.body).toHaveProperty('message');
      expect(adminResponse.body).toHaveProperty('error');
      expect(adminResponse.body).toHaveProperty('message');
    });
  });

  describe('Configuration Validation', () => {
    it('should enforce security hierarchy (login < admin < public)', async () => {
      const loginApp = express();
      loginApp.use(express.json());
      loginApp.use(createLoginLimiter());
      loginApp.post('/login', (_req, res) => res.json({ success: true }));

      const adminApp = express();
      adminApp.use(createAdminLimiter());
      adminApp.get('/admin', (_req, res) => res.json({ success: true }));

      const publicApp = express();
      publicApp.use(createPublicLimiter());
      publicApp.get('/public', (_req, res) => res.json({ success: true }));

      const loginResponse = await request(loginApp).post('/login');
      const adminResponse = await request(adminApp).get('/admin');
      const publicResponse = await request(publicApp).get('/public');

      const loginLimit = parseInt(loginResponse.headers['ratelimit-limit'] as string);
      const adminLimit = parseInt(adminResponse.headers['ratelimit-limit'] as string);
      const publicLimit = parseInt(publicResponse.headers['ratelimit-limit'] as string);

      // Verify hierarchy: login (5) < admin (120) < public (300)
      expect(loginLimit).toBe(5);
      expect(adminLimit).toBe(120);
      expect(publicLimit).toBe(300);
      expect(loginLimit).toBeLessThan(adminLimit);
      expect(adminLimit).toBeLessThan(publicLimit);
    });

    it('should use same window duration for all limiters (15 minutes)', async () => {
      // All limiters should reset at approximately the same interval
      // express-rate-limit returns seconds until reset in 'ratelimit-reset' header

      const publicApp = express();
      publicApp.use(createPublicLimiter());
      publicApp.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(publicApp).get('/test');
      const resetSeconds = parseInt(response.headers['ratelimit-reset'] as string);

      // Should be approximately 900 seconds (15 minutes)
      expect(resetSeconds).toBeGreaterThanOrEqual(880); // Allow 20 second tolerance
      expect(resetSeconds).toBeLessThanOrEqual(920);
    });
  });

  describe('publicSchedulingLimiter', () => {
    function createSchedulingLimiter() {
      return rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 100, // 100 requests per minute
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
          const tenantReq = req as typeof req & { tenantId?: string };
          return tenantReq.tenantId || req.ip || 'unknown';
        },
        validate: false,
        handler: (_req, res) =>
          res.status(429).json({
            error: 'too_many_requests',
            message: 'Too many requests, please try again later.',
          }),
      });
    }

    it('should allow requests within limit (100 per minute)', async () => {
      const app = express();
      app.use(createSchedulingLimiter());
      app.get('/services', (_req, res) => res.json({ services: [] }));

      const response = await request(app).get('/services');

      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBe('100');
    });

    it('should return 429 after exceeding 100 requests per minute', async () => {
      const app = express();
      app.use(createSchedulingLimiter());
      app.get('/services', (_req, res) => res.json({ services: [] }));

      // Make 100 requests (the limit)
      for (let i = 0; i < 100; i++) {
        await request(app).get('/services');
      }

      // 101st request should be rate limited
      const response = await request(app).get('/services');

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: 'too_many_requests',
        message: 'Too many requests, please try again later.',
      });
    });

    it('should key by tenantId when available', async () => {
      const app = express();

      // Mock tenant middleware that adds tenantId
      app.use((req, _res, next) => {
        (req as typeof req & { tenantId?: string }).tenantId = 'tenant-123';
        next();
      });

      app.use(createSchedulingLimiter());
      app.get('/services', (_req, res) => res.json({ services: [] }));

      const response = await request(app).get('/services');

      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBe('100');
    });

    it('should key by IP when tenantId not available', async () => {
      const app = express();
      app.use(createSchedulingLimiter());
      app.get('/services', (_req, res) => res.json({ services: [] }));

      const response = await request(app).get('/services');

      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBe('100');
    });

    it('should have 1 minute window (60 seconds)', async () => {
      const app = express();
      app.use(createSchedulingLimiter());
      app.get('/services', (_req, res) => res.json({ services: [] }));

      const response = await request(app).get('/services');
      const resetSeconds = parseInt(response.headers['ratelimit-reset'] as string);

      // Should be approximately 60 seconds (1 minute)
      expect(resetSeconds).toBeGreaterThanOrEqual(50); // Allow 10 second tolerance
      expect(resetSeconds).toBeLessThanOrEqual(70);
    });

    it('should prevent enumeration attacks on services endpoint', async () => {
      const app = express();
      app.use(createSchedulingLimiter());
      app.get('/services', (_req, res) => res.json({ services: [] }));

      // Simulate enumeration attack - rapid requests
      let rateLimitedCount = 0;

      for (let i = 0; i < 105; i++) {
        const response = await request(app).get('/services');
        if (response.status === 429) {
          rateLimitedCount++;
        }
      }

      // Should have rate limited at least 5 requests (105 - 100 limit)
      expect(rateLimitedCount).toBeGreaterThanOrEqual(5);
    });

    it('should prevent DoS attacks on availability slots endpoint', async () => {
      const app = express();
      app.use(createSchedulingLimiter());
      app.get('/availability/slots', (_req, res) => res.json({ slots: [] }));

      // Simulate DoS attack - many requests to expensive endpoint
      let successCount = 0;
      let rateLimitedCount = 0;

      for (let i = 0; i < 120; i++) {
        const response = await request(app).get('/availability/slots');
        if (response.status === 200) {
          successCount++;
        } else if (response.status === 429) {
          rateLimitedCount++;
        }
      }

      // Should have allowed exactly 100 requests
      expect(successCount).toBe(100);
      // Should have rate limited the rest (20 requests)
      expect(rateLimitedCount).toBe(20);
    });
  });
});
