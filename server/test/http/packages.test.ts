/**
 * HTTP Contract Tests for /v1/packages
 * P0/P1 Implementation with Vitest + Supertest
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/lib/core/config';
import { buildContainer } from '../../src/di';
import { PrismaClient } from '../../src/generated/prisma';

describe('GET /v1/packages', () => {
  let app: Express;
  let testTenantApiKey: string;

  beforeAll(async () => {
    // Upsert test tenant with known API key
    const prisma = new PrismaClient();

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
    await prisma.$disconnect();

    const config = loadConfig();
    const container = buildContainer({ ...config, ADAPTERS_PRESET: 'mock' });
    const startTime = Date.now();
    app = createApp(config, container, startTime);
  });

  it('returns packages list with contract shape', async () => {
    const res = await request(app)
      .get('/v1/packages')
      .set('X-Tenant-Key', testTenantApiKey)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      const pkg = res.body[0];
      expect(pkg).toHaveProperty('id');
      expect(pkg).toHaveProperty('slug');
      expect(pkg).toHaveProperty('title');
      expect(pkg).toHaveProperty('priceCents');
      expect(typeof pkg.id).toBe('string');
      expect(typeof pkg.slug).toBe('string');
      expect(typeof pkg.title).toBe('string');
      expect(typeof pkg.priceCents).toBe('number');
    }
  });

  it('handles invalid route with 404', async () => {
    await request(app).get('/v1/nonexistent').expect(404);
  });
});

describe('GET /v1/packages/:slug', () => {
  let app: Express;
  let testTenantApiKey: string;

  beforeAll(async () => {
    // Upsert test tenant with known API key
    const prisma = new PrismaClient();

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
    await prisma.$disconnect();

    const config = loadConfig();
    const container = buildContainer({ ...config, ADAPTERS_PRESET: 'mock' });
    const startTime = Date.now();
    app = createApp(config, container, startTime);
  });

  it('returns single package by slug', async () => {
    const res = await request(app)
      .get('/v1/packages/basic-elopement')
      .set('X-Tenant-Key', testTenantApiKey)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('slug');
    expect(res.body.slug).toBe('basic-elopement');
  });

  it('returns 404 for non-existent package', async () => {
    await request(app)
      .get('/v1/packages/nonexistent-slug')
      .set('X-Tenant-Key', testTenantApiKey)
      .expect(404);
  });
});
