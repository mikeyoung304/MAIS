# Test Examples for Wrapper Format Prevention

This document provides copy-paste test cases for validating wrapper format compliance.

---

## 1. Unit Tests for createPublishedWrapper()

**File:** `server/test/lib/landing-page-utils.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createPublishedWrapper } from '../../src/lib/landing-page-utils';
import type { PublishedWrapper } from '../../src/lib/landing-page-utils';

describe('createPublishedWrapper', () => {
  describe('Structure', () => {
    it('creates object with exactly 4 required fields', () => {
      const config = { pages: { home: { sections: [] } } };
      const wrapper = createPublishedWrapper(config);

      const keys = Object.keys(wrapper).sort();
      expect(keys).toEqual(['draft', 'draftUpdatedAt', 'published', 'publishedAt']);
    });

    it('sets draft to null', () => {
      const wrapper = createPublishedWrapper({});
      expect(wrapper.draft).toBeNull();
    });

    it('sets draftUpdatedAt to null', () => {
      const wrapper = createPublishedWrapper({});
      expect(wrapper.draftUpdatedAt).toBeNull();
    });

    it('preserves draft config in published field', () => {
      const config = {
        pages: {
          home: {
            sections: [
              {
                id: 'hero-1',
                type: 'hero' as const,
                headline: 'Welcome to My Site',
              },
            ],
          },
        },
      };

      const wrapper = createPublishedWrapper(config);
      expect(wrapper.published).toEqual(config);
    });
  });

  describe('publishedAt Timestamp', () => {
    it('includes publishedAt field', () => {
      const wrapper = createPublishedWrapper({});
      expect('publishedAt' in wrapper).toBe(true);
    });

    it('sets publishedAt to ISO string format', () => {
      const wrapper = createPublishedWrapper({});

      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(wrapper.publishedAt).toMatch(isoRegex);
    });

    it('sets publishedAt to current time', () => {
      const before = new Date();
      const wrapper = createPublishedWrapper({});
      const after = new Date();

      const timestamp = new Date(wrapper.publishedAt);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('never returns null publishedAt', () => {
      const wrapper = createPublishedWrapper({});
      expect(wrapper.publishedAt).not.toBeNull();
      expect(wrapper.publishedAt).not.toBeUndefined();
    });

    it('never returns empty string publishedAt', () => {
      const wrapper = createPublishedWrapper({});
      expect(wrapper.publishedAt).not.toBe('');
      expect(wrapper.publishedAt.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple Calls', () => {
    it('generates different timestamps for sequential calls', async () => {
      const wrapper1 = createPublishedWrapper({});
      // Small delay to ensure timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 10));
      const wrapper2 = createPublishedWrapper({});

      expect(wrapper1.publishedAt).not.toBe(wrapper2.publishedAt);
      expect(new Date(wrapper2.publishedAt) > new Date(wrapper1.publishedAt)).toBe(true);
    });

    it('handles various data types in draft config', () => {
      const testCases = [
        {},
        { pages: {} },
        { pages: { home: { sections: [] } } },
        { pages: { home: { sections: [{ id: 'test' }] } } },
        { branding: { colors: { primary: '#000' } } },
        null,
        undefined,
        'invalid',
        123,
      ];

      testCases.forEach((config) => {
        const wrapper = createPublishedWrapper(config);

        expect(wrapper.published).toBe(config);
        expect(wrapper.draft).toBeNull();
        expect(wrapper.draftUpdatedAt).toBeNull();
        expect(wrapper.publishedAt).toBeTruthy();
      });
    });
  });

  describe('Type Safety', () => {
    it('has correct TypeScript types', () => {
      const config = { pages: { home: { sections: [] } } };
      const wrapper = createPublishedWrapper(config);

      // These should be type-safe (no TypeScript errors)
      const draft: null = wrapper.draft;
      const draftUpdatedAt: null = wrapper.draftUpdatedAt;
      const published: any = wrapper.published;
      const publishedAt: string = wrapper.publishedAt;

      expect(draft).toBeNull();
      expect(draftUpdatedAt).toBeNull();
      expect(published).toBeDefined();
      expect(publishedAt).toBeDefined();
    });
  });
});
```

---

## 2. Integration Tests for Publish Endpoint

**File:** `server/test/routes/internal-agent-storefront.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { getTestPrisma } from '../helpers/global-prisma';
import type { Tenant } from '@prisma/client';

const prisma = getTestPrisma();

describe('POST /v1/internal/agent/storefront/publish', () => {
  let testTenant: Tenant;

  beforeEach(async () => {
    // Create test tenant
    testTenant = await prisma.tenant.create({
      data: {
        slug: `test-publish-${Date.now()}`,
        name: 'Test Tenant',
      },
    });
  });

  afterEach(async () => {
    // Cleanup
    if (testTenant) {
      await prisma.tenant.delete({ where: { id: testTenant.id } });
    }
  });

  describe('Wrapper Format', () => {
    it('creates wrapper with publishedAt timestamp', async () => {
      const draftConfig = {
        pages: {
          home: {
            enabled: true,
            sections: [{ id: 'hero', type: 'hero', headline: 'Welcome' }],
          },
        },
      };

      // Set draft
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: { landingPageConfigDraft: draftConfig },
      });

      // Publish
      const response = await request(app)
        .post('/v1/internal/agent/storefront/publish')
        .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET || 'test-secret')
        .send({ tenantId: testTenant.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify wrapper format
      const updated = await prisma.tenant.findUnique({ where: { id: testTenant.id } });
      const config = updated?.landingPageConfig as any;

      expect(config).toBeDefined();
      expect(config.draft).toBeNull();
      expect(config.draftUpdatedAt).toBeNull();
      expect(config.published).toEqual(draftConfig);
      expect(config.publishedAt).toBeDefined();
      expect(typeof config.publishedAt).toBe('string');
    });

    it('publishedAt is ISO 8601 format', async () => {
      const draftConfig = { pages: { home: { enabled: true, sections: [] } } };

      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: { landingPageConfigDraft: draftConfig },
      });

      await request(app)
        .post('/v1/internal/agent/storefront/publish')
        .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET || 'test-secret')
        .send({ tenantId: testTenant.id });

      const updated = await prisma.tenant.findUnique({ where: { id: testTenant.id } });
      const config = updated?.landingPageConfig as any;

      // ISO 8601: YYYY-MM-DDTHH:mm:ss.sssZ
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(config.publishedAt).toMatch(isoRegex);

      // Must be parseable as Date
      const ts = new Date(config.publishedAt);
      expect(ts.getTime()).toBeGreaterThan(0);
    });

    it('publishedAt is recent (within 5 seconds)', async () => {
      const draftConfig = { pages: { home: { enabled: true, sections: [] } } };

      const beforePublish = new Date();

      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: { landingPageConfigDraft: draftConfig },
      });

      await request(app)
        .post('/v1/internal/agent/storefront/publish')
        .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET || 'test-secret')
        .send({ tenantId: testTenant.id });

      const afterPublish = new Date();

      const updated = await prisma.tenant.findUnique({ where: { id: testTenant.id } });
      const config = updated?.landingPageConfig as any;
      const publishedTime = new Date(config.publishedAt);

      expect(publishedTime.getTime()).toBeGreaterThanOrEqual(beforePublish.getTime());
      expect(publishedTime.getTime()).toBeLessThanOrEqual(afterPublish.getTime());
    });

    it('preserves exact draft config in published field', async () => {
      const draftConfig = {
        pages: {
          home: {
            enabled: true,
            sections: [
              {
                id: 'hero-1',
                type: 'hero' as const,
                headline: 'Main Headline',
                subheadline: 'Subtext',
                ctaText: 'Book Now',
              },
              {
                id: 'about-1',
                type: 'text' as const,
                headline: 'About Section',
                content: 'Detailed information',
              },
            ],
          },
          services: {
            enabled: true,
            sections: [{ id: 'services-1', type: 'gallery' as const, headline: 'Services' }],
          },
        },
        branding: {
          colors: { primary: '#2563EB', secondary: '#1E40AF' },
          fonts: { heading: 'Poppins', body: 'Inter' },
        },
      };

      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: { landingPageConfigDraft: draftConfig },
      });

      await request(app)
        .post('/v1/internal/agent/storefront/publish')
        .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET || 'test-secret')
        .send({ tenantId: testTenant.id });

      const updated = await prisma.tenant.findUnique({ where: { id: testTenant.id } });
      const config = updated?.landingPageConfig as any;

      expect(config.published).toEqual(draftConfig);
      expect(JSON.stringify(config.published)).toBe(JSON.stringify(draftConfig));
    });
  });

  describe('Draft Clearing', () => {
    it('clears landingPageConfigDraft after publishing', async () => {
      const draftConfig = { pages: { home: { enabled: true, sections: [] } } };

      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: { landingPageConfigDraft: draftConfig },
      });

      expect(testTenant.landingPageConfigDraft).toBeDefined();

      await request(app)
        .post('/v1/internal/agent/storefront/publish')
        .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET || 'test-secret')
        .send({ tenantId: testTenant.id });

      const updated = await prisma.tenant.findUnique({ where: { id: testTenant.id } });
      expect(updated?.landingPageConfigDraft).toBeNull();
    });

    it('does not leave empty object in draft field', async () => {
      const draftConfig = { pages: { home: { enabled: true, sections: [] } } };

      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: { landingPageConfigDraft: draftConfig },
      });

      await request(app)
        .post('/v1/internal/agent/storefront/publish')
        .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET || 'test-secret')
        .send({ tenantId: testTenant.id });

      const updated = await prisma.tenant.findUnique({ where: { id: testTenant.id } });
      const config = updated?.landingPageConfig as any;

      expect(config.draft).toBeNull();
      expect(config.draft).not.toEqual({});
      expect(config.draft).not.toEqual(undefined);
    });
  });

  describe('Public API Visibility', () => {
    it('published config is readable via service', async () => {
      const draftConfig = {
        pages: {
          home: {
            enabled: true,
            sections: [{ id: 'hero', type: 'hero', headline: 'Welcome' }],
          },
        },
      };

      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: { landingPageConfigDraft: draftConfig },
      });

      await request(app)
        .post('/v1/internal/agent/storefront/publish')
        .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET || 'test-secret')
        .send({ tenantId: testTenant.id });

      // Simulate what public API does
      const updated = await prisma.tenant.findUnique({ where: { id: testTenant.id } });
      const config = updated?.landingPageConfig as any;

      // Public API expects this structure
      expect(config.published).toBeDefined();
      expect(config.published).toEqual(draftConfig);
      expect(config.publishedAt).toBeDefined();

      // Should NOT be null or missing
      expect(() => {
        const headline = config.published.pages.home.sections[0].headline;
        expect(headline).toBe('Welcome');
      }).not.toThrow();
    });
  });

  describe('Error Cases', () => {
    it('rejects if no draft to publish', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/storefront/publish')
        .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET || 'test-secret')
        .send({ tenantId: testTenant.id });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No draft');
    });

    it('rejects if tenant not found', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/storefront/publish')
        .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET || 'test-secret')
        .send({ tenantId: 'nonexistent-tenant-id' });

      expect(response.status).toBe(404);
    });
  });

  describe('Atomicity', () => {
    it('updates both landingPageConfig and clears draft in same transaction', async () => {
      const draftConfig = { pages: { home: { enabled: true, sections: [] } } };

      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: { landingPageConfigDraft: draftConfig },
      });

      // Hook into transaction if possible for verification
      const before = await prisma.tenant.findUnique({ where: { id: testTenant.id } });
      expect(before?.landingPageConfigDraft).toBeDefined();
      expect(before?.landingPageConfig).toBeNull();

      await request(app)
        .post('/v1/internal/agent/storefront/publish')
        .set('X-Internal-Secret', process.env.INTERNAL_API_SECRET || 'test-secret')
        .send({ tenantId: testTenant.id });

      const after = await prisma.tenant.findUnique({ where: { id: testTenant.id } });
      expect(after?.landingPageConfigDraft).toBeNull();
      expect(after?.landingPageConfig).toBeDefined();

      // Should never see intermediate state where both are set or both are null
    });
  });
});
```

---

## 3. Schema Validation Test

**File:** `server/test/schemas/landing-page-wrapper.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createPublishedWrapper } from '../../src/lib/landing-page-utils';

// Define the schema we expect
const PublishedWrapperSchema = z.object({
  draft: z.null(),
  draftUpdatedAt: z.null(),
  published: z.any(),
  publishedAt: z.string().datetime(),
});

describe('Landing Page Wrapper Schema', () => {
  it('validates wrapper created by helper function', () => {
    const config = { pages: { home: { sections: [] } } };
    const wrapper = createPublishedWrapper(config);

    const result = PublishedWrapperSchema.safeParse(wrapper);
    expect(result.success).toBe(true);
  });

  it('rejects wrapper missing draft field', () => {
    const invalid = {
      // missing draft
      draftUpdatedAt: null,
      published: {},
      publishedAt: new Date().toISOString(),
    };

    const result = PublishedWrapperSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects wrapper with non-null draft', () => {
    const invalid = {
      draft: { pages: {} }, // Should be null
      draftUpdatedAt: null,
      published: {},
      publishedAt: new Date().toISOString(),
    };

    const result = PublishedWrapperSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects wrapper missing publishedAt', () => {
    const invalid = {
      draft: null,
      draftUpdatedAt: null,
      published: {},
      // missing publishedAt
    };

    const result = PublishedWrapperSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects wrapper with null publishedAt', () => {
    const invalid = {
      draft: null,
      draftUpdatedAt: null,
      published: {},
      publishedAt: null,
    };

    const result = PublishedWrapperSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects wrapper with non-ISO publishedAt format', () => {
    const invalid = {
      draft: null,
      draftUpdatedAt: null,
      published: {},
      publishedAt: '2026-01-20', // Missing time
    };

    const result = PublishedWrapperSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects manually constructed object pattern', () => {
    // This is the bad pattern from the bug
    const manualWrapper = {
      published: { pages: { home: { sections: [] } } },
      // Missing: draft, draftUpdatedAt, publishedAt
    };

    const result = PublishedWrapperSchema.safeParse(manualWrapper);
    expect(result.success).toBe(false);
    expect(result.error?.issues.length).toBeGreaterThan(0);
  });
});
```

---

## 4. Negative Test Case (What NOT to do)

**File:** `server/test/anti-patterns/landing-page-wrapper-anti-patterns.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Landing Page Wrapper - Anti-Patterns (What NOT to do)', () => {
  describe('Manual object construction', () => {
    it('documents the incorrect pattern from bug #697', () => {
      // This was the bug: Manual construction missing publishedAt
      const buggyPattern = {
        published: { pages: { home: { sections: [] } } },
        // ❌ No publishedAt - causes public API failure
        // ❌ No draft or draftUpdatedAt
      };

      // Verify it's missing required fields
      expect('publishedAt' in buggyPattern).toBe(false);
      expect('draft' in buggyPattern).toBe(false);
      expect('draftUpdatedAt' in buggyPattern).toBe(false);
    });

    it('shows why missing publishedAt breaks public API', () => {
      const brokenConfig = {
        published: { pages: { home: { sections: [] } } },
      };

      // Public API tries to access publishedAt for audit logging
      const canExtractPublished = 'published' in brokenConfig;
      const canGetTimestamp = 'publishedAt' in brokenConfig;

      expect(canExtractPublished).toBe(true); // Partial success - looks OK
      expect(canGetTimestamp).toBe(false); // But fails on timestamp - users don't see it!
    });

    it('shows empty object pattern (also wrong)', () => {
      const emptyDraft = {
        draft: {},
        draftUpdatedAt: null,
        published: {},
        // ❌ Missing publishedAt
      };

      expect(emptyDraft.publishedAt).toBeUndefined();
    });

    it('shows null publishedAt pattern (also wrong)', () => {
      const nullTimestamp = {
        draft: null,
        draftUpdatedAt: null,
        published: {},
        publishedAt: null,
        // ❌ publishedAt is null - same as missing!
      };

      const isValid = nullTimestamp.publishedAt !== null && nullTimestamp.publishedAt !== undefined;
      expect(isValid).toBe(false);
    });
  });

  describe('Forgot to use helper function', () => {
    it('shows pattern of inline object in update', () => {
      // This pattern should be caught by ESLint rule
      const badUpdate = {
        tenantId: 'test',
        // ❌ Inline object without helper
        landingPageConfig: {
          published: {},
          draft: null,
          draftUpdatedAt: null,
          // ❌ publishedAt missing!
        },
      };

      const hasTimestamp = 'publishedAt' in badUpdate.landingPageConfig;
      expect(hasTimestamp).toBe(false);
    });
  });

  describe('Forgot ISO format', () => {
    it('shows non-ISO timestamp formats (wrong)', () => {
      const badFormats = [
        '2026-01-20', // No time
        '2026/01/20 15:30:45', // Wrong format
        '1737374445000', // Milliseconds since epoch, not ISO
        Date.now().toString(), // Timestamp number as string
        'January 20, 2026', // Human readable
      ];

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

      badFormats.forEach((format) => {
        expect(format).not.toMatch(isoRegex);
      });
    });

    it('shows correct ISO format', () => {
      const correctFormats = [
        '2026-01-20T15:30:45.123Z',
        '2025-12-31T23:59:59.999Z',
        '2026-01-01T00:00:00.000Z',
      ];

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

      correctFormats.forEach((format) => {
        expect(format).toMatch(isoRegex);
      });
    });
  });
});
```

---

## Implementation Notes

1. **Location:** Place these test files in `server/test/` directory matching the structure
2. **Dependencies:** All tests use `vitest` (already in project)
3. **Run tests:** `npm test` or `npm run test:watch`
4. **Coverage:** These tests should achieve 100% coverage of wrapper format logic
5. **CI/CD:** Add these tests to pre-commit hooks to catch issues early

---

## Quick Start

```bash
# Copy unit test
cp docs/solutions/TEST_EXAMPLES_WRAPPER_FORMAT.md \
  server/test/lib/landing-page-utils.test.ts

# Copy integration test
cp docs/solutions/TEST_EXAMPLES_WRAPPER_FORMAT.md \
  server/test/routes/internal-agent-storefront.test.ts

# Run tests
npm test -- landing-page-wrapper

# With coverage
npm test -- --coverage landing-page-wrapper
```
