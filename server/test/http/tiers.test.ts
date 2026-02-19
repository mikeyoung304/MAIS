/**
 * HTTP Contract Tests for /v1/tiers
 * P0/P1 Implementation with Vitest + Supertest
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/lib/core/config';
import { buildContainer } from '../../src/di';
import { getTestPrisma } from '../helpers/global-prisma';

// Use singleton to prevent connection pool exhaustion
const prisma = getTestPrisma();

describe('GET /v1/tiers', () => {
  let app: Express;
  let testTenantApiKey: string;

  beforeAll(async () => {
    // Upsert test tenant with known API key
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'mais-test' },
      update: {
        apiKeyPublic: 'pk_live_mais-test_0123456789abcdef',
        apiKeySecret: 'sk_live_mais-test_0123456789abcdef0123456789abcdef',
        isActive: true,
      },
      create: {
        slug: 'mais-test',
        name: 'MAIS (Test)',
        apiKeyPublic: 'pk_live_mais-test_0123456789abcdef',
        apiKeySecret: 'sk_live_mais-test_0123456789abcdef0123456789abcdef',
        commissionPercent: 10.0,
        branding: {},
        isActive: true,
      },
    });

    testTenantApiKey = tenant.apiKeyPublic;
    // No-op: singleton handles its own lifecycle

    const config = loadConfig();
    const container = buildContainer({ ...config, ADAPTERS_PRESET: 'mock' });
    const startTime = Date.now();
    app = createApp(config, container, startTime);
  });

  it('returns tiers list with contract shape', async () => {
    const res = await request(app)
      .get('/v1/tiers')
      .set('X-Tenant-Key', testTenantApiKey)
      .expect('Content-Type', /json/)
      .expect(200);

    // Response is now paginated: { items, total, hasMore }
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('hasMore');
    expect(Array.isArray(res.body.items)).toBe(true);

    if (res.body.items.length > 0) {
      const tier = res.body.items[0];
      expect(tier).toHaveProperty('id');
      expect(tier).toHaveProperty('slug');
      expect(tier).toHaveProperty('title');
      expect(tier).toHaveProperty('priceCents');
      expect(typeof tier.id).toBe('string');
      expect(typeof tier.slug).toBe('string');
      expect(typeof tier.title).toBe('string');
      expect(typeof tier.priceCents).toBe('number');
    }
  });

  it('handles invalid route with 404', async () => {
    await request(app).get('/v1/nonexistent').expect(404);
  });
});

describe('GET /v1/tiers/:slug', () => {
  let app: Express;
  let testTenantApiKey: string;

  beforeAll(async () => {
    // Upsert test tenant with known API key (uses shared singleton)
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'mais-test' },
      update: {
        apiKeyPublic: 'pk_live_mais-test_0123456789abcdef',
        apiKeySecret: 'sk_live_mais-test_0123456789abcdef0123456789abcdef',
        isActive: true,
      },
      create: {
        slug: 'mais-test',
        name: 'MAIS (Test)',
        apiKeyPublic: 'pk_live_mais-test_0123456789abcdef',
        apiKeySecret: 'sk_live_mais-test_0123456789abcdef0123456789abcdef',
        commissionPercent: 10.0,
        branding: {},
        isActive: true,
      },
    });

    testTenantApiKey = tenant.apiKeyPublic;
    // No-op: singleton handles its own lifecycle

    const config = loadConfig();
    const container = buildContainer({ ...config, ADAPTERS_PRESET: 'mock' });
    const startTime = Date.now();
    app = createApp(config, container, startTime);
  });

  it('returns single tier by slug', async () => {
    // Uses 'starter' slug which matches both mock adapter and demo.ts seed
    const res = await request(app)
      .get('/v1/tiers/starter')
      .set('X-Tenant-Key', testTenantApiKey)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('slug');
    expect(res.body.slug).toBe('starter');
  });

  it('returns 404 for non-existent tier', async () => {
    await request(app)
      .get('/v1/tiers/nonexistent-slug')
      .set('X-Tenant-Key', testTenantApiKey)
      .expect(404);
  });
});
