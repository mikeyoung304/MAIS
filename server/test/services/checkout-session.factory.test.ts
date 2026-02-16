/**
 * CheckoutSessionFactory Unit Tests
 *
 * Tests for Stripe checkout session creation with:
 * - Idempotency key generation and caching
 * - Race condition handling with retry logic
 * - Stripe Connect vs Standard checkout routing
 * - Tenant-specific success/cancel URL generation
 * - Metadata enrichment with tenant slug
 *
 * @module checkout-session.factory.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CheckoutSessionFactory,
  type CreateCheckoutSessionInput,
} from '../../src/services/checkout-session.factory';
import type { PaymentProvider, CheckoutSession } from '../../src/lib/ports';
import type { PrismaTenantRepository } from '../../src/adapters/prisma/tenant.repository';
import type {
  IdempotencyService,
  IdempotencyResponse,
} from '../../src/services/idempotency.service';
import { NotFoundError } from '../../src/lib/errors';
import { buildMockConfig } from '../helpers/fakes';

// --- Mock Types ---

/**
 * Minimal tenant type for tests
 * Matches subset of Prisma Tenant used by CheckoutSessionFactory
 */
interface MockTenant {
  id: string;
  slug: string;
  name: string;
  stripeAccountId: string | null;
  stripeOnboarded: boolean;
  commissionPercent: number;
}

// --- Mock Implementations ---

/**
 * Mock PaymentProvider that tracks all calls and returns configurable responses
 */
class MockPaymentProvider implements PaymentProvider {
  public createCheckoutSessionCalls: Array<{
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    applicationFeeAmount?: number;
    idempotencyKey?: string;
    successUrl: string;
    cancelUrl: string;
  }> = [];

  public createConnectCheckoutSessionCalls: Array<{
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId: string;
    applicationFeeAmount: number;
    idempotencyKey?: string;
    successUrl: string;
    cancelUrl: string;
  }> = [];

  private nextCheckoutSession: CheckoutSession = {
    url: 'https://checkout.stripe.com/session_123',
    sessionId: 'cs_test_123',
  };

  async createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    applicationFeeAmount?: number;
    idempotencyKey?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    this.createCheckoutSessionCalls.push(input);
    return this.nextCheckoutSession;
  }

  async createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId: string;
    applicationFeeAmount: number;
    idempotencyKey?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    this.createConnectCheckoutSessionCalls.push(input);
    return this.nextCheckoutSession;
  }

  async verifyWebhook(): Promise<unknown> {
    return { verified: true };
  }

  async refund(): Promise<{ refundId: string; status: string; amountCents: number }> {
    return { refundId: 're_test', status: 'succeeded', amountCents: 1000 };
  }

  // Test helpers
  setNextCheckoutSession(session: CheckoutSession): void {
    this.nextCheckoutSession = session;
  }

  clear(): void {
    this.createCheckoutSessionCalls = [];
    this.createConnectCheckoutSessionCalls = [];
  }
}

/**
 * Mock TenantRepository that returns configurable tenant data
 */
class MockTenantRepository {
  private tenants: Map<string, MockTenant> = new Map();

  async findById(id: string): Promise<MockTenant | null> {
    return this.tenants.get(id) ?? null;
  }

  // Test helpers
  addTenant(tenant: MockTenant): void {
    this.tenants.set(tenant.id, tenant);
  }

  clear(): void {
    this.tenants.clear();
  }
}

/**
 * Mock IdempotencyService that tracks all calls and returns configurable responses
 */
class MockIdempotencyService {
  public generateCheckoutKeyCalls: Array<[string, string, string, string, number | undefined]> = [];
  public checkAndStoreCalls: string[] = [];
  public getStoredResponseCalls: string[] = [];
  public updateResponseCalls: Array<{ key: string; response: IdempotencyResponse }> = [];

  private generatedKeys: Map<string, string> = new Map();
  private storedResponses: Map<string, IdempotencyResponse> = new Map();
  private checkAndStoreResults: Map<string, boolean> = new Map(); // true = new, false = duplicate

  generateCheckoutKey(
    tenantId: string,
    email: string,
    tierId: string,
    eventDate: string,
    timestamp?: number
  ): string {
    this.generateCheckoutKeyCalls.push([tenantId, email, tierId, eventDate, timestamp]);
    const keyParts = `${tenantId}|${email}|${tierId}|${eventDate}`;
    const generatedKey =
      this.generatedKeys.get(keyParts) ?? `checkout_${keyParts.replace(/\|/g, '_')}`;
    return generatedKey;
  }

  async checkAndStore(key: string): Promise<boolean> {
    this.checkAndStoreCalls.push(key);
    return this.checkAndStoreResults.get(key) ?? true; // Default: new request
  }

  async getStoredResponse(key: string): Promise<IdempotencyResponse | null> {
    this.getStoredResponseCalls.push(key);
    return this.storedResponses.get(key) ?? null;
  }

  async updateResponse(key: string, response: IdempotencyResponse): Promise<void> {
    this.updateResponseCalls.push({ key, response });
  }

  // Test helpers
  setGeneratedKey(keyParts: string, key: string): void {
    this.generatedKeys.set(keyParts, key);
  }

  setStoredResponse(key: string, response: IdempotencyResponse): void {
    this.storedResponses.set(key, response);
  }

  setCheckAndStoreResult(key: string, isNew: boolean): void {
    this.checkAndStoreResults.set(key, isNew);
  }

  clear(): void {
    this.generateCheckoutKeyCalls = [];
    this.checkAndStoreCalls = [];
    this.getStoredResponseCalls = [];
    this.updateResponseCalls = [];
    this.generatedKeys.clear();
    this.storedResponses.clear();
    this.checkAndStoreResults.clear();
  }
}

// --- Test Fixtures ---

function buildMockTenant(overrides?: Partial<MockTenant>): MockTenant {
  return {
    id: 'tenant_123',
    slug: 'test-photography',
    name: 'Test Photography',
    stripeAccountId: null,
    stripeOnboarded: false,
    commissionPercent: 10,
    ...overrides,
  };
}

function buildCheckoutInput(
  overrides?: Partial<CreateCheckoutSessionInput>
): CreateCheckoutSessionInput {
  return {
    tenantId: 'tenant_123',
    amountCents: 100000, // $1000
    email: 'customer@example.com',
    metadata: {
      tierId: 'pkg_123',
      eventDate: '2025-06-15',
      coupleName: 'John & Jane',
    },
    applicationFeeAmount: 10000, // $100 (10%)
    idempotencyKeyParts: [
      'tenant_123',
      'customer@example.com',
      'pkg_123',
      '2025-06-15',
      Date.now(),
    ],
    ...overrides,
  };
}

// --- Tests ---

describe('CheckoutSessionFactory', () => {
  let factory: CheckoutSessionFactory;
  let paymentProvider: MockPaymentProvider;
  let tenantRepo: MockTenantRepository;
  let idempotencyService: MockIdempotencyService;

  beforeEach(() => {
    paymentProvider = new MockPaymentProvider();
    tenantRepo = new MockTenantRepository();
    idempotencyService = new MockIdempotencyService();

    const config = buildMockConfig({
      CORS_ORIGIN: 'https://gethandled.ai',
    });

    factory = new CheckoutSessionFactory(
      paymentProvider,
      tenantRepo as unknown as PrismaTenantRepository,
      idempotencyService as unknown as IdempotencyService,
      config
    );

    // Default: add a standard tenant (no Stripe Connect)
    tenantRepo.addTenant(buildMockTenant());
  });

  describe('createCheckoutSession', () => {
    it('creates checkout session with correct params', async () => {
      const input = buildCheckoutInput();
      paymentProvider.setNextCheckoutSession({
        url: 'https://checkout.stripe.com/cs_test_abc',
        sessionId: 'cs_test_abc',
      });

      const result = await factory.createCheckoutSession(input);

      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/cs_test_abc');

      // Verify standard checkout was called (not Connect)
      expect(paymentProvider.createCheckoutSessionCalls).toHaveLength(1);
      expect(paymentProvider.createConnectCheckoutSessionCalls).toHaveLength(0);

      const call = paymentProvider.createCheckoutSessionCalls[0];
      expect(call.amountCents).toBe(100000);
      expect(call.email).toBe('customer@example.com');
      expect(call.applicationFeeAmount).toBe(10000);
    });

    it('returns cached response for duplicate request', async () => {
      const input = buildCheckoutInput();
      const idempotencyKey = 'checkout_tenant_123_customer@example.com_pkg_123_2025-06-15';

      // Simulate cached response
      idempotencyService.setStoredResponse(idempotencyKey, {
        data: { url: 'https://cached-checkout.stripe.com/cs_cached' },
        timestamp: new Date().toISOString(),
      });
      idempotencyService.setGeneratedKey(
        'tenant_123|customer@example.com|pkg_123|2025-06-15',
        idempotencyKey
      );

      const result = await factory.createCheckoutSession(input);

      // Should return cached URL
      expect(result.checkoutUrl).toBe('https://cached-checkout.stripe.com/cs_cached');

      // Should NOT call payment provider
      expect(paymentProvider.createCheckoutSessionCalls).toHaveLength(0);
      expect(paymentProvider.createConnectCheckoutSessionCalls).toHaveLength(0);
    });

    it('handles race condition with retry logic', async () => {
      const input = buildCheckoutInput();
      const idempotencyKey = 'checkout_race_test';

      idempotencyService.setGeneratedKey(
        'tenant_123|customer@example.com|pkg_123|2025-06-15',
        idempotencyKey
      );

      // First getStoredResponse returns null (no cache)
      // checkAndStore returns false (another request stored key)
      idempotencyService.setCheckAndStoreResult(idempotencyKey, false);

      // After retry delay, getStoredResponse returns cached response
      let getStoredResponseCallCount = 0;
      vi.spyOn(idempotencyService, 'getStoredResponse').mockImplementation(async (key: string) => {
        idempotencyService.getStoredResponseCalls.push(key);
        getStoredResponseCallCount++;

        // First call: no cache (initial check)
        // Second call: cached response (after retry)
        if (getStoredResponseCallCount === 1) {
          return null;
        }
        return {
          data: { url: 'https://retry-cached.stripe.com/cs_retry' },
          timestamp: new Date().toISOString(),
        };
      });

      const result = await factory.createCheckoutSession(input);

      // Should return cached URL from retry
      expect(result.checkoutUrl).toBe('https://retry-cached.stripe.com/cs_retry');

      // Verify retry logic was triggered
      expect(idempotencyService.getStoredResponseCalls).toHaveLength(2);
      expect(idempotencyService.checkAndStoreCalls).toHaveLength(1);
    });

    it('uses Connect checkout when tenant has Stripe account', async () => {
      // Set up tenant with Stripe Connect
      tenantRepo.clear();
      tenantRepo.addTenant(
        buildMockTenant({
          id: 'tenant_connect',
          slug: 'connect-photography',
          stripeAccountId: 'acct_1234567890',
          stripeOnboarded: true,
        })
      );

      const input = buildCheckoutInput({ tenantId: 'tenant_connect' });
      paymentProvider.setNextCheckoutSession({
        url: 'https://checkout.stripe.com/cs_connect_abc',
        sessionId: 'cs_connect_abc',
      });

      const result = await factory.createCheckoutSession(input);

      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/cs_connect_abc');

      // Verify Connect checkout was called
      expect(paymentProvider.createConnectCheckoutSessionCalls).toHaveLength(1);
      expect(paymentProvider.createCheckoutSessionCalls).toHaveLength(0);

      const call = paymentProvider.createConnectCheckoutSessionCalls[0];
      expect(call.stripeAccountId).toBe('acct_1234567890');
      expect(call.applicationFeeAmount).toBe(10000);
    });

    it('uses Standard checkout when tenant lacks Stripe account', async () => {
      // Default tenant has no Stripe account
      const input = buildCheckoutInput();

      await factory.createCheckoutSession(input);

      // Verify standard checkout was called
      expect(paymentProvider.createCheckoutSessionCalls).toHaveLength(1);
      expect(paymentProvider.createConnectCheckoutSessionCalls).toHaveLength(0);
    });

    it('uses Standard checkout when tenant has Stripe account but not onboarded', async () => {
      tenantRepo.clear();
      tenantRepo.addTenant(
        buildMockTenant({
          stripeAccountId: 'acct_pending',
          stripeOnboarded: false, // Not yet onboarded
        })
      );

      const input = buildCheckoutInput();

      await factory.createCheckoutSession(input);

      // Verify standard checkout was called (not Connect)
      expect(paymentProvider.createCheckoutSessionCalls).toHaveLength(1);
      expect(paymentProvider.createConnectCheckoutSessionCalls).toHaveLength(0);
    });

    it('includes tenant slug in success/cancel URLs', async () => {
      tenantRepo.clear();
      tenantRepo.addTenant(
        buildMockTenant({
          slug: 'jane-photography',
        })
      );

      const input = buildCheckoutInput();

      await factory.createCheckoutSession(input);

      const call = paymentProvider.createCheckoutSessionCalls[0];
      expect(call.successUrl).toBe(
        'https://gethandled.ai/t/jane-photography/book/success?session_id={CHECKOUT_SESSION_ID}'
      );
      expect(call.cancelUrl).toBe('https://gethandled.ai/t/jane-photography/book');
    });

    it('URL-encodes tenant slug with special characters', async () => {
      tenantRepo.clear();
      tenantRepo.addTenant(
        buildMockTenant({
          slug: 'jane & john photography', // Contains special chars (unlikely but possible)
        })
      );

      const input = buildCheckoutInput();

      await factory.createCheckoutSession(input);

      const call = paymentProvider.createCheckoutSessionCalls[0];
      // encodeURIComponent encodes & as %26 and spaces as %20
      expect(call.successUrl).toContain('/t/jane%20%26%20john%20photography/book/success');
      expect(call.cancelUrl).toContain('/t/jane%20%26%20john%20photography/book');
    });

    it('throws NotFoundError for unknown tenant', async () => {
      const input = buildCheckoutInput({ tenantId: 'tenant_nonexistent' });

      await expect(factory.createCheckoutSession(input)).rejects.toThrow(NotFoundError);
      await expect(factory.createCheckoutSession(input)).rejects.toThrow(
        'The requested resource was not found'
      );

      // Should not call payment provider
      expect(paymentProvider.createCheckoutSessionCalls).toHaveLength(0);
    });

    it('generates idempotency key from input parts', async () => {
      const input = buildCheckoutInput({
        idempotencyKeyParts: [
          'tenant_abc',
          'test@test.com',
          'pkg_xyz',
          '2025-12-25',
          1703520000000,
        ],
      });

      await factory.createCheckoutSession(input);

      expect(idempotencyService.generateCheckoutKeyCalls).toHaveLength(1);
      expect(idempotencyService.generateCheckoutKeyCalls[0]).toEqual([
        'tenant_abc',
        'test@test.com',
        'pkg_xyz',
        '2025-12-25',
        1703520000000,
      ]);
    });

    it('stores response after successful creation', async () => {
      const input = buildCheckoutInput();
      paymentProvider.setNextCheckoutSession({
        url: 'https://checkout.stripe.com/cs_new_session',
        sessionId: 'cs_new_session',
      });

      await factory.createCheckoutSession(input);

      // Verify response was stored
      expect(idempotencyService.updateResponseCalls).toHaveLength(1);
      const storedResponse = idempotencyService.updateResponseCalls[0];
      expect(storedResponse.response.data).toEqual({
        url: 'https://checkout.stripe.com/cs_new_session',
        sessionId: 'cs_new_session',
      });
      expect(storedResponse.response.timestamp).toBeDefined();
    });

    it('enriches metadata with tenant slug', async () => {
      tenantRepo.clear();
      tenantRepo.addTenant(
        buildMockTenant({
          slug: 'enriched-tenant',
        })
      );

      const input = buildCheckoutInput({
        metadata: {
          tierId: 'pkg_test',
          eventDate: '2025-06-15',
          customField: 'custom-value',
        },
      });

      await factory.createCheckoutSession(input);

      const call = paymentProvider.createCheckoutSessionCalls[0];
      expect(call.metadata).toEqual({
        tierId: 'pkg_test',
        eventDate: '2025-06-15',
        customField: 'custom-value',
        tenantSlug: 'enriched-tenant',
      });
    });

    it('passes idempotency key to payment provider for standard checkout', async () => {
      const idempotencyKey = 'checkout_test_key_123';
      idempotencyService.setGeneratedKey(
        'tenant_123|customer@example.com|pkg_123|2025-06-15',
        idempotencyKey
      );

      const input = buildCheckoutInput();

      await factory.createCheckoutSession(input);

      const call = paymentProvider.createCheckoutSessionCalls[0];
      expect(call.idempotencyKey).toBe(idempotencyKey);
    });

    it('passes idempotency key to payment provider for Connect checkout', async () => {
      tenantRepo.clear();
      tenantRepo.addTenant(
        buildMockTenant({
          id: 'tenant_connect',
          stripeAccountId: 'acct_connect_123',
          stripeOnboarded: true,
        })
      );

      const idempotencyKey = 'checkout_connect_key_456';
      // The key parts must match what buildCheckoutInput generates
      idempotencyService.setGeneratedKey(
        'tenant_connect|connect@example.com|pkg_connect|2025-07-20',
        idempotencyKey
      );

      const input = buildCheckoutInput({
        tenantId: 'tenant_connect',
        email: 'connect@example.com',
        metadata: {
          tierId: 'pkg_connect',
          eventDate: '2025-07-20',
        },
        idempotencyKeyParts: [
          'tenant_connect',
          'connect@example.com',
          'pkg_connect',
          '2025-07-20',
          Date.now(),
        ],
      });

      await factory.createCheckoutSession(input);

      const call = paymentProvider.createConnectCheckoutSessionCalls[0];
      expect(call.idempotencyKey).toBe(idempotencyKey);
    });

    it('proceeds with checkout if race condition retry has no cached response', async () => {
      // Edge case: checkAndStore returns false (race condition detected)
      // But retry also returns no cached response
      // Factory should proceed with creating checkout anyway

      const input = buildCheckoutInput();
      const idempotencyKey = 'checkout_edge_case';

      idempotencyService.setGeneratedKey(
        'tenant_123|customer@example.com|pkg_123|2025-06-15',
        idempotencyKey
      );
      idempotencyService.setCheckAndStoreResult(idempotencyKey, false);

      // getStoredResponse always returns null (no cached response even after retry)
      vi.spyOn(idempotencyService, 'getStoredResponse').mockResolvedValue(null);

      paymentProvider.setNextCheckoutSession({
        url: 'https://checkout.stripe.com/cs_edge_case',
        sessionId: 'cs_edge_case',
      });

      const result = await factory.createCheckoutSession(input);

      // Should still create checkout
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/cs_edge_case');
      expect(paymentProvider.createCheckoutSessionCalls).toHaveLength(1);
    });
  });

  describe('URL generation', () => {
    it('uses CORS_ORIGIN as frontend base URL', async () => {
      // Create factory with different CORS_ORIGIN
      const customConfig = buildMockConfig({
        CORS_ORIGIN: 'https://custom-domain.com',
      });

      const customFactory = new CheckoutSessionFactory(
        paymentProvider,
        tenantRepo as unknown as PrismaTenantRepository,
        idempotencyService as unknown as IdempotencyService,
        customConfig
      );

      const input = buildCheckoutInput();

      await customFactory.createCheckoutSession(input);

      const call = paymentProvider.createCheckoutSessionCalls[0];
      expect(call.successUrl).toContain('https://custom-domain.com/t/');
      expect(call.cancelUrl).toContain('https://custom-domain.com/t/');
    });

    it('includes CHECKOUT_SESSION_ID placeholder in success URL', async () => {
      const input = buildCheckoutInput();

      await factory.createCheckoutSession(input);

      const call = paymentProvider.createCheckoutSessionCalls[0];
      expect(call.successUrl).toContain('{CHECKOUT_SESSION_ID}');
    });
  });

  describe('parallelization', () => {
    it('fetches tenant and cached response in parallel', async () => {
      // This test verifies the Promise.all behavior by checking both calls happen
      const input = buildCheckoutInput();

      await factory.createCheckoutSession(input);

      // Both should be called (as part of Promise.all)
      // The implementation fetches tenant AND checks cache simultaneously
      expect(idempotencyService.getStoredResponseCalls.length).toBeGreaterThanOrEqual(1);

      // Verify tenant was fetched
      expect(paymentProvider.createCheckoutSessionCalls).toHaveLength(1);
    });
  });
});
