/**
 * Health Check Service Tests
 *
 * Tests for external service connectivity checks with caching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthCheckService } from '../../src/services/health-check.service';
import type { StripePaymentAdapter } from '../../src/adapters/stripe.adapter';
import type { PostmarkMailAdapter } from '../../src/adapters/postmark.adapter';
import type { CalendarProvider } from '../../src/lib/ports';

describe('HealthCheckService', () => {
  describe('checkStripe', () => {
    it('should return healthy when Stripe API call succeeds', async () => {
      const mockStripeAdapter = {
        stripe: {
          balance: {
            retrieve: vi.fn().mockResolvedValue({ available: [{ amount: 0 }] }),
          },
        },
      } as unknown as StripePaymentAdapter;

      const service = new HealthCheckService({
        stripeAdapter: mockStripeAdapter,
        mailAdapter: undefined,
        calendarAdapter: undefined,
      });

      const result = await service.checkStripe();

      expect(result.status).toBe('healthy');
      expect(result.latency).toBeDefined();
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.lastChecked).toBeDefined();
    });

    it('should return unhealthy when Stripe adapter is not configured', async () => {
      const service = new HealthCheckService({
        stripeAdapter: undefined,
        mailAdapter: undefined,
        calendarAdapter: undefined,
      });

      const result = await service.checkStripe();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Stripe adapter not configured');
      expect(result.lastChecked).toBeDefined();
    });

    it('should return unhealthy when Stripe API call fails', async () => {
      const mockStripeAdapter = {
        stripe: {
          balance: {
            retrieve: vi.fn().mockRejectedValue(new Error('API authentication failed')),
          },
        },
      } as unknown as StripePaymentAdapter;

      const service = new HealthCheckService({
        stripeAdapter: mockStripeAdapter,
        mailAdapter: undefined,
        calendarAdapter: undefined,
      });

      const result = await service.checkStripe();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('API authentication failed');
      expect(result.latency).toBeDefined();
    });

    it('should cache results for 60 seconds', async () => {
      const retrieveFn = vi.fn().mockResolvedValue({ available: [{ amount: 0 }] });
      const mockStripeAdapter = {
        stripe: {
          balance: {
            retrieve: retrieveFn,
          },
        },
      } as unknown as StripePaymentAdapter;

      const service = new HealthCheckService({
        stripeAdapter: mockStripeAdapter,
        mailAdapter: undefined,
        calendarAdapter: undefined,
      });

      // First call - should hit API
      const result1 = await service.checkStripe();
      expect(retrieveFn).toHaveBeenCalledTimes(1);
      expect(result1.status).toBe('healthy');

      // Second call within TTL - should use cache
      const result2 = await service.checkStripe();
      expect(retrieveFn).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(result2.status).toBe('healthy');
      expect(result2.lastChecked).toBe(result1.lastChecked);
    });

    it('should timeout after 5 seconds', async () => {
      const mockStripeAdapter = {
        stripe: {
          balance: {
            retrieve: vi.fn().mockImplementation(
              () =>
                new Promise((resolve) => {
                  setTimeout(resolve, 10000); // 10 second delay
                })
            ),
          },
        },
      } as unknown as StripePaymentAdapter;

      const service = new HealthCheckService({
        stripeAdapter: mockStripeAdapter,
        mailAdapter: undefined,
        calendarAdapter: undefined,
      });

      const result = await service.checkStripe();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('Timeout');
      expect(result.latency).toBeLessThan(6000); // Should timeout before 6s
    }, 10000); // 10 second test timeout to allow for 5s check timeout
  });

  describe('checkPostmark', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return healthy when Postmark API call succeeds', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const mockMailAdapter = {
        cfg: { serverToken: 'test-token', fromEmail: 'test@example.com' },
      } as unknown as PostmarkMailAdapter;

      const service = new HealthCheckService({
        stripeAdapter: undefined,
        mailAdapter: mockMailAdapter,
        calendarAdapter: undefined,
      });

      const result = await service.checkPostmark();

      expect(result.status).toBe('healthy');
      expect(result.latency).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.postmarkapp.com/server',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Postmark-Server-Token': 'test-token',
          }),
        })
      );
    });

    it('should return unhealthy when Postmark adapter is not configured', async () => {
      const service = new HealthCheckService({
        stripeAdapter: undefined,
        mailAdapter: undefined,
        calendarAdapter: undefined,
      });

      const result = await service.checkPostmark();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Postmark adapter not configured');
    });

    it('should return healthy when using file sink fallback (no token)', async () => {
      const mockMailAdapter = {
        cfg: { serverToken: undefined, fromEmail: 'test@example.com' },
      } as unknown as PostmarkMailAdapter;

      const service = new HealthCheckService({
        stripeAdapter: undefined,
        mailAdapter: mockMailAdapter,
        calendarAdapter: undefined,
      });

      const result = await service.checkPostmark();

      expect(result.status).toBe('healthy');
      expect(result.error).toContain('file sink fallback');
    });

    it('should return unhealthy when Postmark API call fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Invalid API token'),
      });

      const mockMailAdapter = {
        cfg: { serverToken: 'invalid-token', fromEmail: 'test@example.com' },
      } as unknown as PostmarkMailAdapter;

      const service = new HealthCheckService({
        stripeAdapter: undefined,
        mailAdapter: mockMailAdapter,
        calendarAdapter: undefined,
      });

      const result = await service.checkPostmark();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('401');
      expect(result.latency).toBeDefined();
    });

    it('should cache results for 60 seconds', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchFn;

      const mockMailAdapter = {
        cfg: { serverToken: 'test-token', fromEmail: 'test@example.com' },
      } as unknown as PostmarkMailAdapter;

      const service = new HealthCheckService({
        stripeAdapter: undefined,
        mailAdapter: mockMailAdapter,
        calendarAdapter: undefined,
      });

      // First call - should hit API
      const result1 = await service.checkPostmark();
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(result1.status).toBe('healthy');

      // Second call within TTL - should use cache
      const result2 = await service.checkPostmark();
      expect(fetchFn).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(result2.lastChecked).toBe(result1.lastChecked);
    });
  });

  describe('checkGoogleCalendar', () => {
    it('should return healthy when real calendar adapter is configured', async () => {
      const mockCalendarAdapter = {
        constructor: { name: 'GoogleCalendarAdapter' },
        config: {
          calendarId: 'test@calendar.google.com',
          serviceAccountJsonBase64: 'base64encodedcredentials',
        },
      } as unknown as CalendarProvider;

      const service = new HealthCheckService({
        stripeAdapter: undefined,
        mailAdapter: undefined,
        calendarAdapter: mockCalendarAdapter,
      });

      const result = await service.checkGoogleCalendar();

      expect(result.status).toBe('healthy');
      expect(result.lastChecked).toBeDefined();
    });

    it('should return unhealthy when calendar adapter is not configured', async () => {
      const service = new HealthCheckService({
        stripeAdapter: undefined,
        mailAdapter: undefined,
        calendarAdapter: undefined,
      });

      const result = await service.checkGoogleCalendar();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Calendar adapter not configured');
    });

    it('should return healthy when using mock calendar adapter', async () => {
      const mockCalendarAdapter = {
        constructor: { name: 'MockCalendarProvider' },
      } as unknown as CalendarProvider;

      const service = new HealthCheckService({
        stripeAdapter: undefined,
        mailAdapter: undefined,
        calendarAdapter: mockCalendarAdapter,
      });

      const result = await service.checkGoogleCalendar();

      expect(result.status).toBe('healthy');
      expect(result.error).toContain('mock calendar adapter');
    });

    it('should return unhealthy when calendar credentials are missing', async () => {
      const mockCalendarAdapter = {
        constructor: { name: 'GoogleCalendarAdapter' },
        config: {
          calendarId: undefined,
          serviceAccountJsonBase64: undefined,
        },
      } as unknown as CalendarProvider;

      const service = new HealthCheckService({
        stripeAdapter: undefined,
        mailAdapter: undefined,
        calendarAdapter: mockCalendarAdapter,
      });

      const result = await service.checkGoogleCalendar();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('credentials not configured');
    });

    it('should cache results for 60 seconds', async () => {
      const mockCalendarAdapter = {
        constructor: { name: 'GoogleCalendarAdapter' },
        config: {
          calendarId: 'test@calendar.google.com',
          serviceAccountJsonBase64: 'base64encodedcredentials',
        },
      } as unknown as CalendarProvider;

      const service = new HealthCheckService({
        stripeAdapter: undefined,
        mailAdapter: undefined,
        calendarAdapter: mockCalendarAdapter,
      });

      // First call
      const result1 = await service.checkGoogleCalendar();
      expect(result1.status).toBe('healthy');

      // Second call within TTL - should use cache
      const result2 = await service.checkGoogleCalendar();
      expect(result2.lastChecked).toBe(result1.lastChecked);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached results', async () => {
      const mockStripeAdapter = {
        stripe: {
          balance: {
            retrieve: vi.fn().mockResolvedValue({ available: [{ amount: 0 }] }),
          },
        },
      } as unknown as StripePaymentAdapter;

      const service = new HealthCheckService({
        stripeAdapter: mockStripeAdapter,
        mailAdapter: undefined,
        calendarAdapter: undefined,
      });

      // First call - should cache
      const result1 = await service.checkStripe();
      const firstTimestamp = result1.lastChecked;

      // Clear cache
      service.clearCache();

      // Wait 10ms to ensure new timestamp (1ms can be flaky in fast CI environments)
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second call - should NOT use cache (new timestamp)
      const result2 = await service.checkStripe();
      const secondTimestamp = result2.lastChecked;

      expect(secondTimestamp).not.toBe(firstTimestamp);
    });
  });
});
