/**
 * Unit tests for StripeConnectService
 *
 * Tests Stripe Connect account creation, onboarding, and management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StripeConnectService } from '../../src/services/stripe-connect.service';
import type { PrismaClient } from '../../src/generated/prisma/client';
import type Stripe from 'stripe';

// Mock the encryption service module
vi.mock('../../src/lib/encryption.service', () => ({
  encryptionService: {
    encryptStripeSecret: vi.fn((secret: string) => ({
      ciphertext: 'encrypted_' + secret,
      iv: 'mock_iv',
      authTag: 'mock_auth_tag',
    })),
    decryptStripeSecret: vi.fn((encrypted: any) => {
      if (encrypted.ciphertext) {
        return encrypted.ciphertext.replace('encrypted_', '');
      }
      return null;
    }),
  },
}));

describe('StripeConnectService', () => {
  let service: StripeConnectService;
  let mockPrisma: any;
  let mockStripe: any;

  beforeEach(() => {
    // Mock Stripe SDK
    mockStripe = {
      accounts: {
        create: vi.fn(),
        retrieve: vi.fn(),
        createLoginLink: vi.fn(),
        del: vi.fn(),
      },
      accountLinks: {
        create: vi.fn(),
      },
    };

    // Mock Prisma client
    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    // Create service with mocked dependencies
    service = new StripeConnectService(mockPrisma as unknown as PrismaClient);

    // Replace the internal stripe instance with our mock
    (service as any).stripe = mockStripe;
  });

  describe('createConnectedAccount - Account Creation', () => {
    it('should create Stripe Express account', async () => {
      // Arrange
      const tenantId = 'tenant_123';
      const email = 'owner@business.com';
      const businessName = 'Bella Weddings';

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        slug: 'bella-weddings',
        stripeAccountId: null, // No existing account
      });

      mockStripe.accounts.create.mockResolvedValue({
        id: 'acct_test123',
        type: 'express',
        email,
      });

      mockPrisma.tenant.update.mockResolvedValue({
        id: tenantId,
        stripeAccountId: 'acct_test123',
        stripeOnboarded: false,
      });

      // Act
      const accountId = await service.createConnectedAccount(tenantId, email, businessName);

      // Assert
      expect(accountId).toBe('acct_test123');
      expect(mockStripe.accounts.create).toHaveBeenCalledWith({
        type: 'express',
        country: 'US',
        email,
        business_type: 'individual',
        business_profile: {
          name: businessName,
          product_description: 'Wedding and event booking services',
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: {
          stripeAccountId: 'acct_test123',
          stripeOnboarded: false,
        },
      });
    });

    it('should skip creation if account already exists', async () => {
      // Arrange
      const tenantId = 'tenant_456';
      const existingAccountId = 'acct_existing';

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        slug: 'existing-tenant',
        stripeAccountId: existingAccountId, // Account already exists
      });

      // Act
      const accountId = await service.createConnectedAccount(
        tenantId,
        'owner@test.com',
        'Test Business'
      );

      // Assert
      expect(accountId).toBe(existingAccountId);
      expect(mockStripe.accounts.create).not.toHaveBeenCalled(); // Should skip
      expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    });

    it('should throw error for invalid tenant', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createConnectedAccount('nonexistent', 'owner@test.com', 'Test Business')
      ).rejects.toThrow('Tenant not found: nonexistent');
    });
  });

  describe('createOnboardingLink - Account Links', () => {
    it('should generate onboarding link', async () => {
      // Arrange
      const tenantId = 'tenant_123';
      const stripeAccountId = 'acct_test123';

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        slug: 'test-tenant',
        stripeAccountId,
      });

      mockStripe.accountLinks.create.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/s/acct_test123',
        created: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 86400,
      });

      // Act
      const url = await service.createOnboardingLink(
        tenantId,
        'https://app.maconaisolutions.com/onboarding/refresh',
        'https://app.maconaisolutions.com/onboarding/success'
      );

      // Assert
      expect(url).toBe('https://connect.stripe.com/setup/s/acct_test123');
      expect(mockStripe.accountLinks.create).toHaveBeenCalledWith({
        account: stripeAccountId,
        refresh_url: 'https://app.maconaisolutions.com/onboarding/refresh',
        return_url: 'https://app.maconaisolutions.com/onboarding/success',
        type: 'account_onboarding',
      });
    });

    it('should return onboarding status', async () => {
      // Arrange
      const tenantId = 'tenant_123';
      const stripeAccountId = 'acct_test123';

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        slug: 'test-tenant',
        stripeAccountId,
      });

      mockStripe.accounts.retrieve.mockResolvedValue({
        id: stripeAccountId,
        charges_enabled: true,
        details_submitted: true,
      } as Stripe.Account);

      mockPrisma.tenant.update.mockResolvedValue({
        id: tenantId,
        stripeOnboarded: true,
      });

      // Act
      const isOnboarded = await service.checkOnboardingStatus(tenantId);

      // Assert
      expect(isOnboarded).toBe(true);
      expect(mockStripe.accounts.retrieve).toHaveBeenCalledWith(stripeAccountId);
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: { stripeOnboarded: true },
      });
    });
  });

  describe('deleteConnectedAccount - Account Management', () => {
    it('should clean up Stripe account', async () => {
      // Arrange
      const tenantId = 'tenant_123';
      const stripeAccountId = 'acct_test123';

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        slug: 'test-tenant',
        stripeAccountId,
      });

      mockStripe.accounts.del.mockResolvedValue({
        id: stripeAccountId,
        deleted: true,
      });

      mockPrisma.tenant.update.mockResolvedValue({
        id: tenantId,
        stripeAccountId: null,
        stripeOnboarded: false,
        secrets: {},
      });

      // Act
      await service.deleteConnectedAccount(tenantId);

      // Assert
      expect(mockStripe.accounts.del).toHaveBeenCalledWith(stripeAccountId);
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: {
          stripeAccountId: null,
          stripeOnboarded: false,
          secrets: {},
        },
      });
    });
  });
});
