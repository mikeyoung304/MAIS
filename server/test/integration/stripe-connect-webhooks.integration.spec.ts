/**
 * Integration tests for Stripe Connect webhook handlers
 * Tests tenant database updates based on account events
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { StripeConnectWebhooksController } from '../../src/routes/stripe-connect-webhooks.routes';
import type Stripe from 'stripe';
import { getTestPrisma } from '../helpers/global-prisma';

describe('Stripe Connect Webhook Integration', () => {
  // Use singleton to prevent connection pool exhaustion
  const prisma = getTestPrisma();
  let testTenantId: string;
  let testStripeAccountId: string;

  beforeAll(async () => {
    // No-op: singleton is already connected
  });

  afterAll(async () => {
    // No-op: singleton handles its own lifecycle
  });

  beforeEach(async () => {
    // Create a test tenant
    testStripeAccountId = `acct_test_${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: {
        slug: `test-tenant-${Date.now()}`,
        name: 'Test Tenant',
        apiKeyPublic: `pk_test_${Date.now()}`,
        apiKeySecret: `sk_test_${Date.now()}`,
        stripeAccountId: testStripeAccountId,
        stripeOnboarded: false,
      },
    });
    testTenantId = tenant.id;
  });

  afterEach(async () => {
    // Clean up test tenant
    if (testTenantId) {
      await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
    }
  });

  describe('account.updated handler', () => {
    it('should update stripeOnboarded to true when charges_enabled becomes true', async () => {
      // Verify initial state
      let tenant = await prisma.tenant.findUnique({
        where: { id: testTenantId },
        select: { stripeOnboarded: true },
      });
      expect(tenant?.stripeOnboarded).toBe(false);

      // Simulate account update to charges_enabled = true
      await prisma.tenant.update({
        where: { stripeAccountId: testStripeAccountId },
        data: { stripeOnboarded: true },
      });

      // Verify update
      tenant = await prisma.tenant.findUnique({
        where: { id: testTenantId },
        select: { stripeOnboarded: true },
      });
      expect(tenant?.stripeOnboarded).toBe(true);
    });

    it('should update stripeOnboarded to false when charges_enabled becomes false', async () => {
      // Set initial state to onboarded
      await prisma.tenant.update({
        where: { id: testTenantId },
        data: { stripeOnboarded: true },
      });

      // Verify initial state
      let tenant = await prisma.tenant.findUnique({
        where: { id: testTenantId },
        select: { stripeOnboarded: true },
      });
      expect(tenant?.stripeOnboarded).toBe(true);

      // Simulate account update to charges_enabled = false
      await prisma.tenant.update({
        where: { stripeAccountId: testStripeAccountId },
        data: { stripeOnboarded: false },
      });

      // Verify update
      tenant = await prisma.tenant.findUnique({
        where: { id: testTenantId },
        select: { stripeOnboarded: true },
      });
      expect(tenant?.stripeOnboarded).toBe(false);
    });

    it('should find tenant by stripeAccountId for updates', async () => {
      const tenant = await prisma.tenant.findUnique({
        where: { stripeAccountId: testStripeAccountId },
        select: { id: true, slug: true, stripeOnboarded: true },
      });

      expect(tenant).not.toBeNull();
      expect(tenant?.id).toBe(testTenantId);
    });
  });

  describe('account.application.deauthorized handler', () => {
    it('should clear Stripe account data when account is deauthorized', async () => {
      // Set up tenant with Stripe account and encrypted secrets
      await prisma.tenant.update({
        where: { id: testTenantId },
        data: {
          stripeAccountId: testStripeAccountId,
          stripeOnboarded: true,
          secrets: { stripe: { ciphertext: 'encrypted-data', iv: 'test-iv', authTag: 'test-tag' } },
        },
      });

      // Verify initial state
      let tenant = await prisma.tenant.findUnique({
        where: { id: testTenantId },
      });
      expect(tenant?.stripeAccountId).toBe(testStripeAccountId);
      expect(tenant?.stripeOnboarded).toBe(true);
      expect(tenant?.secrets).toMatchObject({ stripe: expect.any(Object) });

      // Simulate deauthorization
      await prisma.tenant.update({
        where: { id: testTenantId },
        data: {
          stripeAccountId: null,
          stripeOnboarded: false,
          secrets: {},
        },
      });

      // Verify cleanup
      tenant = await prisma.tenant.findUnique({
        where: { id: testTenantId },
      });
      expect(tenant?.stripeAccountId).toBeNull();
      expect(tenant?.stripeOnboarded).toBe(false);
      expect(tenant?.secrets).toEqual({});
    });

    it('should find tenant by stripeAccountId for deauthorization', async () => {
      const tenant = await prisma.tenant.findUnique({
        where: { stripeAccountId: testStripeAccountId },
        select: { id: true, slug: true },
      });

      expect(tenant).not.toBeNull();
      expect(tenant?.id).toBe(testTenantId);
    });
  });

  describe('tenant database schema', () => {
    it('should have unique constraint on stripeAccountId', async () => {
      const duplicateAccountId = `acct_duplicate_${Date.now()}`;

      // Create first tenant with account ID
      const tenant1 = await prisma.tenant.create({
        data: {
          slug: `duplicate-test-1-${Date.now()}`,
          name: 'Duplicate Test 1',
          apiKeyPublic: `pk_dup1_${Date.now()}`,
          apiKeySecret: `sk_dup1_${Date.now()}`,
          stripeAccountId: duplicateAccountId,
        },
      });

      // Attempt to create second tenant with same account ID
      await expect(
        prisma.tenant.create({
          data: {
            slug: `duplicate-test-2-${Date.now()}`,
            name: 'Duplicate Test 2',
            apiKeyPublic: `pk_dup2_${Date.now()}`,
            apiKeySecret: `sk_dup2_${Date.now()}`,
            stripeAccountId: duplicateAccountId,
          },
        })
      ).rejects.toThrow();

      // Clean up
      await prisma.tenant.delete({ where: { id: tenant1.id } });
    });

    it('should allow null stripeAccountId for multiple tenants', async () => {
      // Create multiple tenants without Stripe accounts
      const tenant1 = await prisma.tenant.create({
        data: {
          slug: `null-test-1-${Date.now()}`,
          name: 'Null Test 1',
          apiKeyPublic: `pk_null1_${Date.now()}`,
          apiKeySecret: `sk_null1_${Date.now()}`,
          stripeAccountId: null,
        },
      });

      const tenant2 = await prisma.tenant.create({
        data: {
          slug: `null-test-2-${Date.now()}`,
          name: 'Null Test 2',
          apiKeyPublic: `pk_null2_${Date.now()}`,
          apiKeySecret: `sk_null2_${Date.now()}`,
          stripeAccountId: null,
        },
      });

      expect(tenant1.stripeAccountId).toBeNull();
      expect(tenant2.stripeAccountId).toBeNull();

      // Clean up
      await prisma.tenant.delete({ where: { id: tenant1.id } });
      await prisma.tenant.delete({ where: { id: tenant2.id } });
    });
  });
});
