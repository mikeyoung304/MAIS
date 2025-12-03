# TODO-202: Missing Backend CRUD Routes for Landing Page Configuration

## Priority: P1 (Critical)

## Status: Resolved

## Source: Code Review - Landing Page Implementation

## Description

The landing page feature has frontend rendering and contract schemas but lacks backend API routes for tenant admins to configure their landing pages. Currently, data must be manually inserted into the database.

## Missing Functionality

- `GET /v1/tenant-admin/landing-page` - Fetch current landing page config
- `PUT /v1/tenant-admin/landing-page` - Update landing page config
- `PATCH /v1/tenant-admin/landing-page/sections` - Toggle section visibility
- `POST /v1/tenant-admin/landing-page/preview` - Preview landing page (optional)

## Files to Create/Modify

### New Files
- `server/src/routes/tenant-admin/landing-page.routes.ts` - Route handlers
- `packages/contracts/src/tenant-admin/landing-page.contract.ts` - API contracts

### Modify
- `packages/contracts/src/index.ts` - Export new contract
- `server/src/routes/tenant-admin/index.ts` - Mount landing page routes
- `server/src/services/tenant.service.ts` - Add landing page methods

## Contract Definition

```typescript
// packages/contracts/src/tenant-admin/landing-page.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { LandingPageConfigSchema } from '../landing-page';

const c = initContract();

export const landingPageContract = c.router({
  getLandingPage: {
    method: 'GET',
    path: '/v1/tenant-admin/landing-page',
    responses: {
      200: LandingPageConfigSchema.nullable(),
    },
    summary: 'Get landing page configuration',
  },
  updateLandingPage: {
    method: 'PUT',
    path: '/v1/tenant-admin/landing-page',
    body: LandingPageConfigSchema,
    responses: {
      200: LandingPageConfigSchema,
      400: z.object({ error: z.string() }),
    },
    summary: 'Update landing page configuration',
  },
  toggleSection: {
    method: 'PATCH',
    path: '/v1/tenant-admin/landing-page/sections',
    body: z.object({
      section: z.enum(['hero', 'socialProofBar', 'segmentSelector', 'about', 'testimonials', 'accommodation', 'gallery', 'faq', 'finalCta']),
      enabled: z.boolean(),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
      400: z.object({ error: z.string() }),
    },
    summary: 'Toggle a section on/off',
  },
});
```

## Route Implementation Pattern

```typescript
// server/src/routes/tenant-admin/landing-page.routes.ts
import { initServer } from '@ts-rest/express';
import { landingPageContract } from '@macon/contracts';
import { tenantService } from '../../di';

const s = initServer();

export const landingPageRoutes = s.router(landingPageContract, {
  getLandingPage: async ({ req }) => {
    const landingPage = await tenantService.getLandingPage(req.tenantId);
    return { status: 200, body: landingPage };
  },
  updateLandingPage: async ({ req, body }) => {
    const updated = await tenantService.updateLandingPage(req.tenantId, body);
    return { status: 200, body: updated };
  },
  toggleSection: async ({ req, body }) => {
    await tenantService.toggleLandingPageSection(req.tenantId, body.section, body.enabled);
    return { status: 200, body: { success: true } };
  },
});
```

## Acceptance Criteria

- [x] Contract defined with proper Zod schemas
- [x] Routes implemented with tenant authentication
- [x] Service methods added for CRUD operations (tenant repository)
- [x] Input validation via Zod
- [ ] Tests for all endpoints (TODO: follow-up)
- [x] API documented (inline comments)

## Resolution Summary

Implemented complete backend CRUD routes for landing page configuration:

### Files Created
1. `/packages/contracts/src/tenant-admin/landing-page.contract.ts` - ts-rest API contract
2. `/server/src/routes/tenant-admin-landing-page.routes.ts` - Express route handlers

### Files Modified
1. `/packages/contracts/src/index.ts` - Added export for landing page contract
2. `/server/src/adapters/prisma/tenant.repository.ts` - Added methods:
   - `getLandingPageConfig(tenantId)`
   - `updateLandingPageConfig(tenantId, config)`
   - `toggleLandingPageSection(tenantId, section, enabled)`
3. `/server/src/routes/index.ts` - Mounted landing page routes at `/v1/tenant-admin/landing-page`
4. `/server/prisma/schema.prisma` - Added `landingPageConfig Json?` field to Tenant model

### Endpoints Implemented
- `GET /v1/tenant-admin/landing-page` - Fetch landing page config (200: config or null)
- `PUT /v1/tenant-admin/landing-page` - Update entire config (200: updated config, 400: validation error)
- `PATCH /v1/tenant-admin/landing-page/sections` - Toggle section visibility (200: success)

### Security
- All routes require tenant admin authentication via JWT (tenantAuthMiddleware)
- All operations are tenant-scoped by `tenantId` from `res.locals.tenantAuth`
- Input validation via Zod schemas from `@macon/contracts`

### Database Migration
- Schema updated with `landingPageConfig Json?` field
- Migration file needs to be created (schema drift detected)
- Run: `cd server && npm exec prisma migrate dev --name add_landing_page_config`

### Next Steps
- [ ] Create database migration (requires user consent for migrate reset)
- [ ] Write integration tests for landing page routes
- [ ] Update TODO-205 (tenant admin UI) to consume these endpoints

## Tags

backend, api, tenant-admin, landing-page, crud, resolved
