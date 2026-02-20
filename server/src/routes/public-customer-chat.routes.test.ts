/**
 * Public Customer Chat Routes — Health Check Tests
 *
 * Verifies that the /health endpoint correctly reflects whether
 * CUSTOMER_AGENT_URL is configured, not GOOGLE_VERTEX_PROJECT.
 *
 * @see todos/11024-pending-p1-chatbot-health-check-wrong-env-var.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock logger before imports
vi.mock('../lib/core/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock CustomerAgentService to prevent constructor side-effects (Prisma, SessionService)
vi.mock('../services/customer-agent.service', () => ({
  CustomerAgentService: vi.fn().mockImplementation(() => ({
    getGreeting: vi.fn().mockResolvedValue('Hi!'),
    createSession: vi.fn(),
    getOrCreateSession: vi.fn(),
    getSession: vi.fn(),
    chat: vi.fn(),
  })),
}));

import { createPublicCustomerChatRoutes } from './public-customer-chat.routes';
import { resetConfig } from '../lib/core/config';

const mockTenantOnboarding = {
  isChatEnabled: vi.fn(),
  getTenantChatInfo: vi.fn(),
  getTenantName: vi.fn(),
};

function createTestApp(tenantId: string | null = 'tenant_123') {
  const app = express();
  app.use(express.json());
  // Simulate the tenantId middleware that runs before these routes in production
  app.use(
    (
      req: express.Request & { tenantId?: string },
      _res: express.Response,
      next: express.NextFunction
    ) => {
      if (tenantId) req.tenantId = tenantId;
      next();
    }
  );
  const routes = createPublicCustomerChatRoutes({
    prisma: {} as Parameters<typeof createPublicCustomerChatRoutes>[0]['prisma'],
    tenantOnboarding: mockTenantOnboarding as Parameters<
      typeof createPublicCustomerChatRoutes
    >[0]['tenantOnboarding'],
  });
  app.use('/', routes);
  return app;
}

describe('GET /health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CUSTOMER_AGENT_URL;
    resetConfig();
  });

  afterEach(() => {
    delete process.env.CUSTOMER_AGENT_URL;
    resetConfig();
  });

  it('returns available: false when CUSTOMER_AGENT_URL is not set', async () => {
    mockTenantOnboarding.getTenantChatInfo.mockResolvedValue({
      name: 'Test Business',
      chatEnabled: true,
    });

    const res = await request(createTestApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('api_not_configured');
  });

  it('returns available: true when CUSTOMER_AGENT_URL is set and chat is enabled', async () => {
    process.env.CUSTOMER_AGENT_URL = 'https://customer-agent.run.app';
    resetConfig();
    mockTenantOnboarding.getTenantChatInfo.mockResolvedValue({
      name: 'Test Business',
      chatEnabled: true,
    });

    const res = await request(createTestApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.businessName).toBe('Test Business');
  });

  it('returns available: false when tenantId is missing', async () => {
    const res = await request(createTestApp(null)).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('missing_tenant');
  });

  it('returns available: false when chat is disabled for tenant', async () => {
    process.env.CUSTOMER_AGENT_URL = 'https://customer-agent.run.app';
    resetConfig();
    mockTenantOnboarding.getTenantChatInfo.mockResolvedValue({
      name: 'Test Business',
      chatEnabled: false,
    });

    const res = await request(createTestApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('chat_disabled');
  });
});
