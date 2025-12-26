/**
 * Stripe Connect Service for Multi-Tenant Payment Processing
 *
 * ARCHITECTURE: Each tenant gets their own Stripe Express Connected Account
 * - Tenant receives payments directly to their bank account
 * - Platform deducts commission via application_fee_amount
 * - Platform is responsible for refunds and chargebacks
 *
 * SECURITY:
 * - Stripe restricted keys are encrypted using EncryptionService
 * - Keys stored in tenant.secrets JSON field
 * - AES-256-GCM encryption with authenticated encryption
 *
 * @see EMBEDDABLE_MULTI_TENANT_IMPLEMENTATION_PLAN.md
 */

import Stripe from 'stripe';
import type { Prisma, PrismaClient } from '../generated/prisma';
import { encryptionService, type EncryptedData } from '../lib/encryption.service';
import { logger } from '../lib/core/logger';

// TenantSecrets type - Stripe encrypted secret storage
interface TenantSecrets {
  stripe?: EncryptedData; // Encrypted Stripe restricted key
  [key: string]: unknown;
}

/**
 * Service for managing Stripe Connect accounts (tenant payment processing)
 */
export class StripeConnectService {
  private stripe: Stripe;

  constructor(private readonly prisma: PrismaClient) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    // Use the same API version as StripePaymentAdapter
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
    });

    logger.info('✅ StripeConnectService initialized');
  }

  /**
   * Create Stripe Connect Express account for tenant
   *
   * EXPRESS ACCOUNT: Stripe handles onboarding, compliance, payouts
   * Platform controls customer experience
   *
   * @param tenantId - Tenant ID (CUID)
   * @param email - Business owner email
   * @param businessName - Business display name
   * @param country - Two-letter country code (default: US)
   * @returns Stripe Connected Account ID
   * @throws Error if account creation fails
   */
  async createConnectedAccount(
    tenantId: string,
    email: string,
    businessName: string,
    country: string = 'US'
  ): Promise<string> {
    // Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, stripeAccountId: true },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    if (tenant.stripeAccountId) {
      logger.warn(
        { tenantId, tenantSlug: tenant.slug, stripeAccountId: tenant.stripeAccountId },
        'Tenant already has Stripe account, skipping creation'
      );
      return tenant.stripeAccountId;
    }

    // Create Stripe Express Connected Account
    const account = await this.stripe.accounts.create({
      type: 'express',
      country,
      email,
      business_type: 'individual', // Can be changed to 'company' for business entities
      business_profile: {
        name: businessName,
        product_description: 'Wedding and event booking services',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Store account ID in database
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        stripeAccountId: account.id,
        stripeOnboarded: false, // Will be true after completing onboarding
      },
    });

    logger.info(
      { tenantId, tenantSlug: tenant.slug, stripeAccountId: account.id },
      'Created Stripe Connect account for tenant'
    );

    return account.id;
  }

  /**
   * Generate Stripe Connect onboarding link
   * Tenant completes onboarding in Stripe-hosted flow
   *
   * @param tenantId - Tenant ID
   * @param refreshUrl - URL to redirect if onboarding fails
   * @param returnUrl - URL to redirect after successful onboarding
   * @returns Onboarding URL (expires after 24 hours)
   * @throws Error if tenant doesn't have Stripe account
   */
  async createOnboardingLink(
    tenantId: string,
    refreshUrl: string,
    returnUrl: string
  ): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeAccountId: true, slug: true },
    });

    if (!tenant?.stripeAccountId) {
      throw new Error('Tenant does not have a Stripe account. Call createConnectedAccount first.');
    }

    const accountLink = await this.stripe.accountLinks.create({
      account: tenant.stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    logger.info(
      { tenantId, tenantSlug: tenant.slug, stripeAccountId: tenant.stripeAccountId },
      'Created Stripe onboarding link'
    );

    return accountLink.url;
  }

  /**
   * Check if tenant has completed Stripe onboarding
   * Updates tenant.stripeOnboarded in database
   *
   * @param tenantId - Tenant ID
   * @returns true if onboarding complete and charges enabled
   */
  async checkOnboardingStatus(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeAccountId: true, slug: true },
    });

    if (!tenant?.stripeAccountId) {
      logger.warn({ tenantId }, 'Cannot check onboarding status: no Stripe account');
      return false;
    }

    // Retrieve account from Stripe
    const account = await this.stripe.accounts.retrieve(tenant.stripeAccountId);

    // Check if charges are enabled (onboarding complete)
    const isOnboarded = account.charges_enabled === true;

    // Update database
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { stripeOnboarded: isOnboarded },
    });

    logger.info(
      {
        tenantId,
        tenantSlug: tenant.slug,
        stripeAccountId: tenant.stripeAccountId,
        isOnboarded,
        chargesEnabled: account.charges_enabled,
        detailsSubmitted: account.details_submitted,
      },
      'Checked Stripe onboarding status'
    );

    return isOnboarded;
  }

  /**
   * Store encrypted Stripe restricted API key for tenant
   *
   * SECURITY: Restricted keys are stored encrypted in database
   * Used for creating payment intents on tenant's behalf
   *
   * @param tenantId - Tenant ID
   * @param restrictedKey - Stripe restricted key (sk_test_* or sk_live_*)
   * @throws Error if encryption fails or tenant not found
   */
  async storeRestrictedKey(tenantId: string, restrictedKey: string): Promise<void> {
    // Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, secrets: true },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    // Encrypt the restricted key
    const encrypted = encryptionService.encryptStripeSecret(restrictedKey);

    // Merge with existing secrets
    const existingSecrets: TenantSecrets = (tenant.secrets as TenantSecrets) || {};
    const updatedSecrets: TenantSecrets = {
      ...existingSecrets,
      stripe: encrypted,
    };

    // Store encrypted key
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        secrets: updatedSecrets as Prisma.InputJsonValue,
      },
    });

    logger.info(
      { tenantId, tenantSlug: tenant.slug },
      'Stored encrypted Stripe restricted key for tenant'
    );
  }

  /**
   * Retrieve decrypted Stripe restricted key for tenant
   *
   * @param tenantId - Tenant ID
   * @returns Decrypted Stripe key or null if not found
   * @throws Error if decryption fails
   */
  async getRestrictedKey(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { secrets: true },
    });

    if (!tenant || !tenant.secrets) {
      logger.debug({ tenantId }, 'No secrets found for tenant');
      return null;
    }

    const secrets = tenant.secrets as TenantSecrets | null;
    if (!secrets || !secrets.stripe) {
      logger.debug({ tenantId }, 'No Stripe key found in tenant secrets');
      return null;
    }

    // Decrypt and return
    const decrypted = encryptionService.decryptStripeSecret(secrets.stripe);

    logger.debug({ tenantId }, 'Retrieved and decrypted Stripe restricted key');

    return decrypted;
  }

  /**
   * Get Stripe account details for tenant
   *
   * @param tenantId - Tenant ID
   * @returns Stripe account object or null
   */
  async getAccountDetails(tenantId: string): Promise<Stripe.Account | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeAccountId: true },
    });

    if (!tenant?.stripeAccountId) {
      return null;
    }

    return await this.stripe.accounts.retrieve(tenant.stripeAccountId);
  }

  /**
   * Create a login link for tenant to access their Stripe Express Dashboard
   *
   * @param tenantId - Tenant ID
   * @returns Login link URL (expires after 5 minutes)
   * @throws Error if tenant doesn't have Stripe account
   */
  async createLoginLink(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeAccountId: true, slug: true },
    });

    if (!tenant?.stripeAccountId) {
      throw new Error('Tenant does not have a Stripe account');
    }

    const loginLink = await this.stripe.accounts.createLoginLink(tenant.stripeAccountId);

    logger.info(
      { tenantId, tenantSlug: tenant.slug, stripeAccountId: tenant.stripeAccountId },
      'Created Stripe Express dashboard login link'
    );

    return loginLink.url;
  }

  /**
   * Delete Stripe Connect account for tenant
   * WARNING: This is irreversible!
   *
   * @param tenantId - Tenant ID
   * @throws Error if deletion fails
   */
  async deleteConnectedAccount(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeAccountId: true, slug: true },
    });

    if (!tenant?.stripeAccountId) {
      logger.warn({ tenantId }, 'Cannot delete Stripe account: not found');
      return;
    }

    // Delete from Stripe
    await this.stripe.accounts.del(tenant.stripeAccountId);

    // Clear from database
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        stripeAccountId: null,
        stripeOnboarded: false,
        secrets: {}, // Clear encrypted keys
      },
    });

    logger.warn(
      { tenantId, tenantSlug: tenant.slug, stripeAccountId: tenant.stripeAccountId },
      'Deleted Stripe Connect account for tenant'
    );
  }
}
