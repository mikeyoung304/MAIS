/**
 * Test fixtures for Tenant entities
 */

import type { Tenant } from '../../src/generated/prisma/client';
import { Prisma } from '../../src/generated/prisma/client';

/**
 * Build a test tenant with optional overrides
 */
export function buildTenant(overrides?: Partial<Tenant>): Tenant {
  return {
    id: 'tenant_1',
    slug: 'bella-weddings',
    name: 'Bella Weddings',
    email: 'admin@bellaweddings.com',
    passwordHash: '$2a$10$FAKEHASH1234567890123456789012',
    apiKeyPublic: 'pk_live_test_12345',
    apiKeySecret: '$2a$10$SECRETHASH1234567890123456789012',
    commissionPercent: new Prisma.Decimal(10.0),
    branding: {},
    stripeAccountId: null,
    stripeOnboarded: false,
    secrets: {},
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Sample tenant for tests
 */
export const sampleTenant: Tenant = buildTenant();

/**
 * Tenant with Stripe connected
 */
export const tenantWithStripe: Tenant = buildTenant({
  id: 'tenant_2',
  slug: 'elite-photography',
  name: 'Elite Photography',
  email: 'admin@elitephoto.com',
  stripeAccountId: 'acct_test123456',
  stripeOnboarded: true,
});

/**
 * Inactive tenant
 */
export const inactiveTenant: Tenant = buildTenant({
  id: 'tenant_3',
  slug: 'inactive-studio',
  name: 'Inactive Studio',
  email: 'admin@inactive.com',
  isActive: false,
});
