/**
 * V1 API router using @ts-rest/express
 */

import type { Application } from 'express';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { Contracts } from '@macon/contracts';
import type { PackagesController } from './packages.routes';
import type { AvailabilityController } from './availability.routes';
import type { BookingsController } from './bookings.routes';
import type { WebhooksController } from './webhooks.routes';
import type { AdminController } from './admin.routes';
import type { BlackoutsController } from './blackouts.routes';
import type { AdminPackagesController } from './admin-packages.routes';
import type { TenantController } from './tenant.routes';
import type { PlatformAdminController } from '../controllers/platform-admin.controller';
import { createAuthMiddleware } from '../middleware/auth';
import { createTenantAuthMiddleware } from '../middleware/tenant-auth';
import type { IdentityService } from '../services/identity.service';
import type { TenantAuthService } from '../services/tenant-auth.service';
import type { CatalogService } from '../services/catalog.service';
import type { BookingService } from '../services/booking.service';
import type { SegmentService } from '../services/segment.service';
import { resolveTenant, requireTenant, getTenantId, type TenantRequest } from '../middleware/tenant';
import { PrismaClient } from '../generated/prisma';
import { PrismaTenantRepository, PrismaBlackoutRepository } from '../adapters/prisma';
import type { ServiceRepository, AvailabilityRuleRepository, BookingRepository } from '../lib/ports';
import type { Request } from 'express';
import { createAdminTenantsRoutes } from './admin/tenants.routes';
import { createAdminStripeRoutes } from './admin/stripe.routes';
import { createTenantAdminRoutes } from './tenant-admin.routes';
import { createTenantAdminStripeRoutes } from './tenant-admin-stripe.routes';
import { createTenantAdminReminderRoutes } from './tenant-admin-reminders.routes';
import { createTenantAdminCalendarRoutes } from './tenant-admin-calendar.routes';
import { createTenantAdminDepositRoutes } from './tenant-admin-deposits.routes';
import { createTenantAdminLandingPageRoutes } from './tenant-admin-landing-page.routes';
import { createTenantAuthRoutes } from './tenant-auth.routes';
import { createUnifiedAuthRoutes } from './auth.routes';
import { createSegmentsRouter } from './segments.routes';
import { createTenantAdminSegmentsRouter } from './tenant-admin-segments.routes';
import { createPublicSchedulingRoutes } from './public-scheduling.routes';
import { createTenantAdminSchedulingRoutes } from './tenant-admin-scheduling.routes';
import { createPublicTenantRoutes } from './public-tenant.routes';
import {
  createPublicBookingManagementRouter,
  PublicBookingManagementController,
} from './public-booking-management.routes';
import {
  createPublicBalancePaymentRouter,
  PublicBalancePaymentController,
} from './public-balance-payment.routes';
import {
  loginLimiter,
  publicTenantLookupLimiter,
  publicBookingActionsLimiter,
  publicBalancePaymentLimiter,
} from '../middleware/rateLimiter';
import { logger } from '../lib/core/logger';
import { apiKeyService } from '../lib/api-key.service';
import type { StripeConnectService } from '../services/stripe-connect.service';
import type { SchedulingAvailabilityService } from '../services/scheduling-availability.service';
import type { PackageDraftService } from '../services/package-draft.service';
import type { TenantOnboardingService } from '../services/tenant-onboarding.service';
import type { ReminderService } from '../services/reminder.service';
import type { LandingPageService } from '../services/landing-page.service';

interface Controllers {
  packages: PackagesController;
  availability: AvailabilityController;
  bookings: BookingsController;
  webhooks: WebhooksController;
  admin: AdminController;
  blackouts: BlackoutsController;
  adminPackages: AdminPackagesController;
  platformAdmin: PlatformAdminController;
  tenant: TenantController;
}

interface Services {
  catalog: CatalogService;
  booking: BookingService;
  tenantAuth: TenantAuthService;
  segment: SegmentService;
  stripeConnect?: StripeConnectService;
  schedulingAvailability?: SchedulingAvailabilityService;
  packageDraft?: PackageDraftService;
  tenantOnboarding?: TenantOnboardingService;
  reminder?: ReminderService;
  landingPage?: LandingPageService;
}

interface Repositories {
  service?: ServiceRepository;
  availabilityRule?: AvailabilityRuleRepository;
  booking?: BookingRepository;
}

export function createV1Router(
  controllers: Controllers,
  identityService: IdentityService,
  app: Application,
  services?: Services,
  mailProvider?: { sendPasswordReset: (to: string, resetToken: string, resetUrl: string) => Promise<void> },
  prisma?: PrismaClient,
  repositories?: Repositories
): void {
  // Require PrismaClient from DI - fail fast if misconfigured
  if (!prisma) {
    throw new Error('PrismaClient is required - ensure DI container provides it');
  }
  const prismaClient = prisma;

  // Create tenant middleware for multi-tenant data isolation
  const tenantMiddleware = resolveTenant(prismaClient);

  // Create auth middleware for admin endpoints
  const authMiddleware = createAuthMiddleware(identityService);

  const s = initServer();

  // ts-rest express has type compatibility issues with Express 4.x/5.x
  // The `any` type for req is required - ts-rest internally handles request typing
  // Attempting to use `Request` type causes TS2345 errors due to middleware signature mismatch
  // See: https://github.com/ts-rest/ts-rest/issues
  createExpressEndpoints(Contracts, s.router(Contracts, {
    getPackages: async ({ req }: { req: any }) => {
      const tenantId = getTenantId(req as TenantRequest);
      const data = await controllers.packages.getPackages(tenantId);
      return { status: 200 as const, body: data };
    },

    getPackageBySlug: async ({ req, params }: { req: any; params: { slug: string } }) => {
      const tenantId = getTenantId(req as TenantRequest);
      const data = await controllers.packages.getPackageBySlug(tenantId, params.slug);
      return { status: 200 as const, body: data };
    },

    getAvailability: async ({ req, query }: { req: any; query: { date: string } }) => {
      const tenantId = getTenantId(req as TenantRequest);
      const data = await controllers.availability.getAvailability(tenantId, query.date);
      return { status: 200 as const, body: data };
    },

    getUnavailableDates: async ({ req, query }: { req: any; query: { startDate: string; endDate: string } }) => {
      const tenantId = getTenantId(req as TenantRequest);
      const data = await controllers.availability.getUnavailableDates(tenantId, query.startDate, query.endDate);
      return { status: 200 as const, body: data };
    },

    createCheckout: async ({ req, body }: { req: any; body: { packageId: string; eventDate: string; coupleName: string; email: string; addOnIds?: string[] } }) => {
      const tenantId = getTenantId(req as TenantRequest);
      const data = await controllers.bookings.createCheckout(tenantId, body);
      return { status: 200 as const, body: data };
    },

    getBookingById: async ({ req, params }: { req: any; params: { id: string } }) => {
      const tenantId = getTenantId(req as TenantRequest);
      const data = await controllers.bookings.getBookingById(tenantId, params.id);
      return { status: 200 as const, body: data };
    },

    getTenantBranding: async ({ req }: { req: any }) => {
      const tenantId = getTenantId(req as TenantRequest);
      const data = await controllers.tenant.getBranding(tenantId);
      return { status: 200 as const, body: data };
    },

    stripeWebhook: async ({ req }: { req: any }) => {
      // Extract raw body (Buffer) and Stripe signature header
      const rawBody = req.body ? req.body.toString('utf8') : '';
      const signatureHeader = req.headers['stripe-signature'];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : (signatureHeader || '');

      await controllers.webhooks.handleStripeWebhook(rawBody, signature);
      return { status: 204 as const, body: undefined };
    },

    adminLogin: async ({ req, body }: { req: any; body: { email: string; password: string } }) => {
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      try {
        const data = await controllers.admin.login(body);
        return { status: 200 as const, body: data };
      } catch (error) {
        // Log failed admin login attempts
        logger.warn({
          event: 'admin_login_failed',
          endpoint: '/v1/admin/login',
          email: body.email,
          ipAddress,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Failed admin login attempt');
        throw error;
      }
    },

    tenantLogin: async ({ req, body }: { req: any; body: { email: string; password: string } }) => {
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      try {
        if (!services) {
          throw new Error('Tenant auth service not available');
        }
        const data = await services.tenantAuth.login(body.email, body.password);
        return { status: 200 as const, body: data };
      } catch (error) {
        logger.warn({
          event: 'tenant_login_failed',
          endpoint: '/v1/tenant-auth/login',
          email: body.email,
          ipAddress,
        }, 'Failed tenant login attempt');
        throw error;
      }
    },

    platformGetAllTenants: async () => {
      // Auth middleware applied via app.use('/v1/admin/tenants', authMiddleware)
      const data = await controllers.platformAdmin.getAllTenants();
      return { status: 200 as const, body: data };
    },

    platformCreateTenant: async ({ body }: { body: unknown }) => {
      // Note: Actual tenant creation is handled by the Express route
      // This is just a placeholder for ts-rest contract compliance
      // See /server/src/routes/admin/tenants.routes.ts
      throw new Error('Use Express route /api/v1/admin/tenants directly');
    },

    platformGetTenant: async ({ params }: { params: { id: string } }) => {
      // Note: Actual implementation in Express routes
      throw new Error('Use Express route /api/v1/admin/tenants/:id directly');
    },

    platformUpdateTenant: async ({ params, body }: { params: { id: string }; body: unknown }) => {
      // Note: Actual implementation in Express routes
      throw new Error('Use Express route /api/v1/admin/tenants/:id directly');
    },

    platformDeleteTenant: async ({ params }: { params: { id: string } }) => {
      // Note: Actual implementation in Express routes
      throw new Error('Use Express route /api/v1/admin/tenants/:id directly');
    },

    platformGetStats: async () => {
      // Auth middleware applied via app.use('/v1/admin/stats', authMiddleware)
      const data = await controllers.platformAdmin.getStats();
      return { status: 200 as const, body: data };
    },

    adminGetBookings: async () => {
      // Auth middleware applied via app.use('/v1/admin/bookings', authMiddleware)
      const data = await controllers.admin.getBookings();
      return { status: 200 as const, body: data };
    },

    adminGetBlackouts: async () => {
      // Auth middleware applied via app.use('/v1/admin/blackouts', authMiddleware)
      const data = await controllers.blackouts.getBlackouts();
      return { status: 200 as const, body: data };
    },

    adminCreateBlackout: async ({ body }: { body: { date: string; reason?: string } }) => {
      // Auth middleware applied via app.use('/v1/admin/blackouts', authMiddleware)
      const data = await controllers.blackouts.createBlackout(body);
      return { status: 200 as const, body: data };
    },

    adminCreatePackage: async ({ body }: { body: { slug: string; title: string; description: string; priceCents: number; photoUrl?: string } }) => {
      // Auth middleware applied via app.use('/v1/admin/packages', authMiddleware)
      const data = await controllers.adminPackages.createPackage(body);
      return { status: 200 as const, body: data };
    },

    adminUpdatePackage: async ({ params, body }: { params: { id: string }; body: { slug?: string; title?: string; description?: string; priceCents?: number; photoUrl?: string } }) => {
      // Auth middleware applied via app.use('/v1/admin/packages', authMiddleware)
      const data = await controllers.adminPackages.updatePackage(params.id, body);
      return { status: 200 as const, body: data };
    },

    adminDeletePackage: async ({ params }: { params: { id: string } }) => {
      // Auth middleware applied via app.use('/v1/admin/packages', authMiddleware)
      await controllers.adminPackages.deletePackage(params.id);
      return { status: 204 as const, body: undefined };
    },

    adminCreateAddOn: async ({ params, body }: { params: { packageId: string }; body: { packageId: string; title: string; priceCents: number; photoUrl?: string } }) => {
      // Auth middleware applied via app.use('/v1/admin/packages', authMiddleware)
      const data = await controllers.adminPackages.createAddOn(params.packageId, body);
      return { status: 200 as const, body: data };
    },

    adminUpdateAddOn: async ({ params, body }: { params: { id: string }; body: { packageId?: string; title?: string; priceCents?: number; photoUrl?: string } }) => {
      // Auth middleware applied via app.use('/v1/admin/addons', authMiddleware)
      const data = await controllers.adminPackages.updateAddOn(params.id, body);
      return { status: 200 as const, body: data };
    },

    adminDeleteAddOn: async ({ params }: { params: { id: string } }) => {
      // Auth middleware applied via app.use('/v1/admin/addons', authMiddleware)
      await controllers.adminPackages.deleteAddOn(params.id);
      return { status: 204 as const, body: undefined };
    },
  } as any), app, {
    // Apply middleware based on route path
    globalMiddleware: [
      (req, res, next) => {
        // Apply strict rate limiting to login endpoints
        if ((req.path === '/v1/admin/login' || req.path === '/v1/tenant-auth/login') && req.method === 'POST') {
          return loginLimiter(req, res, next);
        }
        // Public API routes (packages, bookings, availability, tenant) require tenant
        if (req.path.startsWith('/v1/packages') ||
            req.path.startsWith('/v1/bookings') ||
            req.path.startsWith('/v1/availability') ||
            req.path.startsWith('/v1/tenant')) {
          // Chain tenant middleware with requireTenant
          tenantMiddleware(req as TenantRequest, res, (err?: unknown) => {
            if (err) return next(err);
            if (res.headersSent) return; // Middleware already sent response
            requireTenant(req as TenantRequest, res, next);
          });
        }
        // Admin routes require authentication
        else if (req.path.startsWith('/v1/admin/') && !req.path.startsWith('/v1/admin/login')) {
          authMiddleware(req, res, next);
        }
        // Webhooks and other routes pass through
        else {
          next();
        }
      }
    ]
  });

  // Register admin tenant management routes (Express router, not ts-rest)
  // Use factory function with shared prisma instance to avoid connection pool exhaustion
  app.use('/v1/admin/tenants', authMiddleware, createAdminTenantsRoutes(prismaClient));

  // Register admin Stripe Connect routes (Express router, not ts-rest)
  // Use factory function with shared prisma instance to avoid connection pool exhaustion
  app.use('/v1/admin/tenants', authMiddleware, createAdminStripeRoutes(prismaClient));

  // Register tenant authentication routes (login, /me)
  if (services) {
    const tenantAuthRoutes = createTenantAuthRoutes(services.tenantAuth);
    // Pass identityService to enable platform admin impersonation on tenant routes
    const tenantAuthMiddleware = createTenantAuthMiddleware(services.tenantAuth, identityService);

    // Mount tenant auth routes under /v1/tenant-auth
    // /v1/tenant-auth/login - public
    // /v1/tenant-auth/me - requires authentication (protected by middleware in route handler)
    app.use('/v1/tenant-auth', tenantAuthRoutes);

    // Register tenant admin routes (for tenant self-service)
    // These routes use tenant auth middleware for authentication and authorization
    const tenantRepo = new PrismaTenantRepository(prismaClient);
    const blackoutRepo = new PrismaBlackoutRepository(prismaClient);
    const tenantAdminRoutes = createTenantAdminRoutes(
      tenantRepo,
      services.catalog,
      services.booking,
      blackoutRepo,
      services.segment,
      services.packageDraft
    );
    app.use('/v1/tenant-admin', tenantAuthMiddleware, tenantAdminRoutes);

    // Register unified authentication routes (RECOMMENDED)
    // /v1/auth/login - public - unified login for both platform admins and tenant admins
    // /v1/auth/verify - requires token - verify token and get user info
    // /v1/auth/signup - public - self-service tenant signup
    // /v1/auth/forgot-password - public - request password reset
    // /v1/auth/reset-password - public - complete password reset
    const unifiedAuthRoutes = createUnifiedAuthRoutes({
      identityService,
      tenantAuthService: services.tenantAuth,
      tenantRepo,
      apiKeyService,
      mailProvider,
      tenantOnboardingService: services?.tenantOnboarding,
    });
    app.use('/v1/auth', unifiedAuthRoutes);

    // Register public tenant lookup routes (for storefront routing)
    // NO authentication required - returns only safe public fields
    // Rate limited to prevent enumeration attacks
    // Uses tenantRepo for DI (same repo used for tenant admin routes)
    const publicTenantRoutes = createPublicTenantRoutes(tenantRepo);
    app.use('/v1/public/tenants', publicTenantLookupLimiter, publicTenantRoutes);
    logger.info('✅ Public tenant lookup routes mounted at /v1/public/tenants');

    // Register public booking management routes (for customer self-service)
    // NO authentication required - uses JWT tokens in query params for access
    // Allows customers to reschedule/cancel bookings via links in confirmation emails
    const publicBookingManagementController = new PublicBookingManagementController(
      services.booking,
      services.catalog
    );
    const publicBookingManagementRouter = createPublicBookingManagementRouter(
      publicBookingManagementController
    );
    // P1-145 FIX: Apply rate limiting to prevent token brute-force and DoS
    app.use('/v1/public/bookings', publicBookingActionsLimiter, publicBookingManagementRouter);
    logger.info('✅ Public booking management routes mounted at /v1/public/bookings (rate limited)');

    // Register public balance payment routes (for deposit payment flow)
    // NO authentication required - uses JWT tokens in query params for access
    // Allows customers to pay remaining balance via links in confirmation emails
    const publicBalancePaymentController = new PublicBalancePaymentController(
      services.booking
    );
    const publicBalancePaymentRouter = createPublicBalancePaymentRouter(
      publicBalancePaymentController
    );
    // P1-145 FIX: Apply stricter rate limiting for payment actions
    app.use('/v1/public/bookings', publicBalancePaymentLimiter, publicBalancePaymentRouter);
    logger.info('✅ Public balance payment routes mounted at /v1/public/bookings (rate limited)');

    // Register public segment routes (for customer browsing)
    // Requires tenant context via X-Tenant-Key header
    const segmentsRouter = createSegmentsRouter(services.segment);
    app.use('/v1/segments', tenantMiddleware, requireTenant, segmentsRouter);
    logger.info('✅ Public segment routes mounted at /v1/segments');

    // Register tenant admin segment routes (for segment CRUD)
    // Requires tenant admin authentication
    const tenantAdminSegmentsRouter = createTenantAdminSegmentsRouter(services.segment);
    app.use('/v1/tenant-admin/segments', tenantAuthMiddleware, tenantAdminSegmentsRouter);
    logger.info('✅ Tenant admin segment routes mounted at /v1/tenant-admin/segments');

    // Register tenant admin Stripe Connect routes (for payment setup)
    // Requires tenant admin authentication
    if (services.stripeConnect) {
      const tenantAdminStripeRoutes = createTenantAdminStripeRoutes(services.stripeConnect);
      app.use('/v1/tenant-admin/stripe', tenantAuthMiddleware, tenantAdminStripeRoutes);
      logger.info('✅ Tenant admin Stripe Connect routes mounted at /v1/tenant-admin/stripe');
    }

    // Register tenant admin reminder routes (for lazy reminder evaluation)
    // Requires tenant admin authentication
    if (services.reminder) {
      const tenantAdminReminderRoutes = createTenantAdminReminderRoutes(services.reminder);
      app.use('/v1/tenant-admin/reminders', tenantAuthMiddleware, tenantAdminReminderRoutes);
      logger.info('✅ Tenant admin reminder routes mounted at /v1/tenant-admin/reminders');
    }

    // Register tenant admin calendar routes (for per-tenant calendar configuration)
    // Requires tenant admin authentication
    const tenantAdminCalendarRoutes = createTenantAdminCalendarRoutes(tenantRepo);
    app.use('/v1/tenant-admin/calendar', tenantAuthMiddleware, tenantAdminCalendarRoutes);
    logger.info('✅ Tenant admin calendar routes mounted at /v1/tenant-admin/calendar');

    // Register tenant admin deposit settings routes (for deposit configuration)
    // Requires tenant admin authentication
    const tenantAdminDepositRoutes = createTenantAdminDepositRoutes(tenantRepo);
    app.use('/v1/tenant-admin', tenantAuthMiddleware, tenantAdminDepositRoutes);
    logger.info('✅ Tenant admin deposit settings routes mounted at /v1/tenant-admin/settings/deposits');

    // Register tenant admin landing page routes (for landing page configuration)
    // Requires tenant admin authentication
    // Uses LandingPageService for business logic (TODO-241: service layer consistency)
    if (services.landingPage) {
      const tenantAdminLandingPageRoutes = createTenantAdminLandingPageRoutes(services.landingPage);
      app.use('/v1/tenant-admin/landing-page', tenantAuthMiddleware, tenantAdminLandingPageRoutes);
      logger.info('✅ Tenant admin landing page routes mounted at /v1/tenant-admin/landing-page');
    }

    // Register public scheduling routes (for customer booking widget)
    // Requires tenant context via X-Tenant-Key header
    if (services.schedulingAvailability && repositories?.service) {
      const publicSchedulingRouter = createPublicSchedulingRoutes(
        repositories.service,
        services.schedulingAvailability
      );
      app.use('/v1/public', tenantMiddleware, requireTenant, publicSchedulingRouter);
      logger.info('✅ Public scheduling routes mounted at /v1/public');

      // Register tenant admin scheduling routes (for service and availability management)
      // Requires tenant admin authentication and all scheduling repositories
      if (repositories.service && repositories.availabilityRule && repositories.booking) {
        const tenantAdminSchedulingRouter = createTenantAdminSchedulingRoutes(
          repositories.service,
          repositories.availabilityRule,
          services.booking,
          repositories.booking
        );
        app.use('/v1/tenant-admin', tenantAuthMiddleware, tenantAdminSchedulingRouter);
        logger.info('✅ Tenant admin scheduling routes mounted at /v1/tenant-admin');
      }
    }
  }
}
