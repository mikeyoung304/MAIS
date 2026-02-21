/**
 * Mock Tenant Repository
 *
 * Provides in-memory tenant storage for unit tests without database access.
 * Seeded with a default test tenant for immediate use.
 *
 * Note: Only implements methods needed for HTTP endpoint testing.
 * Full PrismaTenantRepository has many more methods for landing page config, etc.
 */

import { NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/core/logger';
import { DEFAULT_TENANT, tenants } from './state';
import type { MockTenant } from './state';

export class MockTenantRepository {
  async findById(id: string): Promise<MockTenant | null> {
    return tenants.get(id) || null;
  }

  async findBySlug(slug: string): Promise<MockTenant | null> {
    return Array.from(tenants.values()).find((t) => t.slug === slug) || null;
  }

  async findByApiKey(apiKey: string): Promise<MockTenant | null> {
    return Array.from(tenants.values()).find((t) => t.apiKeyPublic === apiKey) || null;
  }

  async findByEmail(email: string): Promise<MockTenant | null> {
    return (
      Array.from(tenants.values()).find((t) => t.email?.toLowerCase() === email.toLowerCase()) ||
      null
    );
  }

  async create(data: {
    id?: string;
    slug: string;
    name: string;
    email?: string;
    apiKeyPublic?: string;
    apiKeySecret?: string;
    commissionPercent?: number;
    branding?: Record<string, unknown>;
    tier?: 'FREE' | 'STARTER' | 'PRO';
  }): Promise<MockTenant> {
    const id = data.id || `tenant_${Date.now()}`;
    const tenant: MockTenant = {
      id,
      slug: data.slug,
      name: data.name,
      email: data.email || null,
      apiKeyPublic: data.apiKeyPublic || `pk_live_${data.slug}_${Date.now()}`,
      apiKeySecret: data.apiKeySecret || `sk_live_${data.slug}_${Date.now()}`,
      commissionPercent: data.commissionPercent ?? 10,
      branding: data.branding || {},
      stripeAccountId: null,
      stripeOnboarded: false,
      isActive: true,
      isTestTenant: false,
      tier: data.tier || 'FREE',
      onboardingStatus: 'PENDING_PAYMENT',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    tenants.set(id, tenant);
    logger.debug({ id, slug: data.slug }, 'Mock tenant created');
    return tenant;
  }

  async update(id: string, data: Partial<MockTenant>): Promise<MockTenant> {
    const tenant = tenants.get(id);
    if (!tenant) {
      throw new NotFoundError(`Tenant ${id} not found`);
    }
    const updated: MockTenant = {
      ...tenant,
      ...data,
      updatedAt: new Date(),
    };
    tenants.set(id, updated);
    return updated;
  }

  async list(): Promise<MockTenant[]> {
    return Array.from(tenants.values());
  }

  getDefaultTenantId(): string {
    return DEFAULT_TENANT;
  }
}
