/**
 * V1 API router using @ts-rest/express
 */

import type { Application } from 'express';
import type { Config } from '../lib/core/config';
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
import {
  resolveTenant,
  requireTenant,
  getTenantId,
  type TenantRequest,
} from '../middleware/tenant';
import type { PrismaClient } from '../generated/prisma/client';
import { PrismaTenantRepository, PrismaBlackoutRepository } from '../adapters/prisma';
import type {
  ServiceRepository,
  AvailabilityRuleRepository,
  BookingRepository,
  CatalogRepository,
  WebhookSubscriptionRepository,
  EarlyAccessRepository,
  CacheServicePort,
} from '../lib/ports';
import { createAdminTenantsRoutes } from './admin/tenants.routes';
import { createAdminStripeRoutes } from './admin/stripe.routes';
import { createTenantAdminRoutes } from './tenant-admin.routes';
import type { TenantProvisioningService } from '../services/tenant-provisioning.service';
import { createTenantAdminStripeRoutes } from './tenant-admin-stripe.routes';
import { createTenantAdminBillingRoutes } from './tenant-admin-billing.routes';
import { createTenantAdminReminderRoutes } from './tenant-admin-reminders.routes';
import { createTenantAdminCalendarRoutes } from './tenant-admin-calendar.routes';
import { createTenantAdminDepositRoutes } from './tenant-admin-deposits.routes';
import { createTenantAdminLandingPageRoutes } from './tenant-admin-landing-page.routes';
import { createTenantAdminAgentRoutes } from './tenant-admin-agent.routes';
import { createTenantAdminTenantAgentRoutes } from './tenant-admin-tenant-agent.routes';
import { createTenantAdminProjectRoutes } from './tenant-admin-projects.routes';
import { createTenantAuthRoutes } from './tenant-auth.routes';
import { createUnifiedAuthRoutes } from './auth.routes';
import { createSegmentsRouter } from './segments.routes';
import { createTenantAdminSegmentsRouter } from './tenant-admin-segments.routes';
import { createPublicSchedulingRoutes } from './public-scheduling.routes';
import { createTenantAdminSchedulingRoutes } from './tenant-admin-scheduling.routes';
import { createPublicTenantRoutes } from './public-tenant.routes';
import { createTenantAdminWebhookRoutes } from './tenant-admin-webhooks.routes';
import { createPlatformAdminTracesRouter } from './platform-admin-traces.routes';
import { createTenantAdminDomainsRouter } from './tenant-admin-domains.routes';
import { DomainVerificationService } from '../services/domain-verification.service';
import { createInternalRoutes } from './internal.routes';
import { createInternalAgentRoutes } from './internal-agent.routes';
import { createInternalAgentHealthRoutes } from './internal-agent-health.routes';
import { createPublicCustomerChatRoutes } from './public-customer-chat.routes';
import { createContextBuilderService } from '../services/context-builder.service';
import { startCleanupScheduler } from '../jobs/cleanup';
import {
  createPublicBookingManagementRouter,
  PublicBookingManagementController,
} from './public-booking-management.routes';
import {
  createPublicBalancePaymentRouter,
  PublicBalancePaymentController,
} from './public-balance-payment.routes';
import { createPublicDateBookingRoutes } from './public-date-booking.routes';
import { createPublicProjectRoutes } from './public-project.routes';
import {
  loginLimiter,
  publicTenantLookupLimiter,
  publicBookingActionsLimiter,
  publicBalancePaymentLimiter,
  agentChatLimiter,
  agentSessionLimiter,
  customerChatLimiter,
} from '../middleware/rateLimiter';
import { logger } from '../lib/core/logger';
import type { StripeConnectService } from '../services/stripe-connect.service';
import type { StripePaymentAdapter } from '../adapters/stripe.adapter';
import type { SchedulingAvailabilityService } from '../services/scheduling-availability.service';
import type { PackageDraftService } from '../services/package-draft.service';
import type { TenantOnboardingService } from '../services/tenant-onboarding.service';
import type { ReminderService } from '../services/reminder.service';
import type { LandingPageService } from '../services/landing-page.service';
import type { SectionContentService } from '../services/section-content.service';
import type { WebhookDeliveryService } from '../services/webhook-delivery.service';
import type { AvailabilityService } from '../services/availability.service';
import type { ProjectHubService } from '../services/project-hub.service';
import { VocabularyEmbeddingService } from '../services/vocabulary-embedding.service';

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
  availability: AvailabilityService;
  tenantAuth: TenantAuthService;
  segment: SegmentService;
  stripeConnect?: StripeConnectService;
  schedulingAvailability?: SchedulingAvailabilityService;
  packageDraft?: PackageDraftService;
  tenantOnboarding?: TenantOnboardingService;
  tenantProvisioning?: TenantProvisioningService;
  reminder?: ReminderService;
  landingPage?: LandingPageService;
  sectionContent?: SectionContentService;
  webhookDelivery?: WebhookDeliveryService;
  projectHub?: ProjectHubService;
}

interface Repositories {
  service?: ServiceRepository;
  availabilityRule?: AvailabilityRuleRepository;
  booking?: BookingRepository;
  catalog?: CatalogRepository;
  webhookSubscription?: WebhookSubscriptionRepository;
  earlyAccess?: EarlyAccessRepository;
}

export function createV1Router(
  controllers: Controllers,
  identityService: IdentityService,
  app: Application,
  config: Config,
  services?: Services,
  mailProvider?: {
    sendPasswordReset: (to: string, resetToken: string, resetUrl: string) => Promise<void>;
    sendEmail: (input: { to: string; subject: string; html: string }) => Promise<void>;
  },
  prisma?: PrismaClient,
  repositories?: Repositories,
  cacheAdapter?: CacheServicePort,
  stripeAdapter?: StripePaymentAdapter,
  tenantRepo?: PrismaTenantRepository // For internal agent routes (mock mode uses MockTenantRepository)
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
  createExpressEndpoints(
    Contracts,
    s.router(Contracts, {
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

      getUnavailableDates: async ({
        req,
        query,
      }: {
        req: any;
        query: { startDate: string; endDate: string };
      }) => {
        const tenantId = getTenantId(req as TenantRequest);
        const data = await controllers.availability.getUnavailableDates(
          tenantId,
          query.startDate,
          query.endDate
        );
        return { status: 200 as const, body: data };
      },

      createCheckout: async ({
        req,
        body,
      }: {
        req: any;
        body: {
          packageId: string;
          eventDate: string;
          coupleName: string;
          email: string;
          addOnIds?: string[];
        };
      }) => {
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
        const signature = Array.isArray(signatureHeader)
          ? signatureHeader[0]
          : signatureHeader || '';

        await controllers.webhooks.handleStripeWebhook(rawBody, signature);
        return { status: 204 as const, body: undefined };
      },

      adminLogin: async ({
        req,
        body,
      }: {
        req: any;
        body: { email: string; password: string };
      }) => {
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        try {
          const data = await controllers.admin.login(body);
          return { status: 200 as const, body: data };
        } catch (error) {
          // Log failed admin login attempts
          logger.warn(
            {
              event: 'admin_login_failed',
              endpoint: '/v1/admin/login',
              email: body.email,
              ipAddress,
              timestamp: new Date().toISOString(),
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            'Failed admin login attempt'
          );
          throw error;
        }
      },

      tenantLogin: async ({
        req,
        body,
      }: {
        req: any;
        body: { email: string; password: string };
      }) => {
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        try {
          if (!services) {
            throw new Error('Tenant auth service not available');
          }
          const data = await services.tenantAuth.login(body.email, body.password);
          return { status: 200 as const, body: data };
        } catch (error) {
          logger.warn(
            {
              event: 'tenant_login_failed',
              endpoint: '/v1/tenant-auth/login',
              email: body.email,
              ipAddress,
            },
            'Failed tenant login attempt'
          );
          throw error;
        }
      },

      platformGetAllTenants: async ({ query }: { query?: { includeTest?: 'true' | 'false' } }) => {
        // Auth middleware applied via app.use('/v1/admin/tenants', authMiddleware)
        const includeTestTenants = query?.includeTest === 'true';
        const data = await controllers.platformAdmin.getAllTenants(includeTestTenants);
        return { status: 200 as const, body: { tenants: data } };
      },

      platformCreateTenant: async ({ body: _body }: { body: unknown }) => {
        // Note: Actual tenant creation is handled by the Express route
        // This is just a placeholder for ts-rest contract compliance
        // See /server/src/routes/admin/tenants.routes.ts
        throw new Error('Use Express route /api/v1/admin/tenants directly');
      },

      platformGetTenant: async ({ params: _params }: { params: { id: string } }) => {
        // Note: Actual implementation in Express routes
        throw new Error('Use Express route /api/v1/admin/tenants/:id directly');
      },

      platformUpdateTenant: async ({
        params: _params,
        body: _body,
      }: {
        params: { id: string };
        body: unknown;
      }) => {
        // Note: Actual implementation in Express routes
        throw new Error('Use Express route /api/v1/admin/tenants/:id directly');
      },

      platformDeleteTenant: async ({ params: _params }: { params: { id: string } }) => {
        // Note: Actual implementation in Express routes
        throw new Error('Use Express route /api/v1/admin/tenants/:id directly');
      },

      platformGetStats: async ({ query }: { query?: { includeTest?: 'true' | 'false' } }) => {
        // Auth middleware applied via app.use('/v1/admin/stats', authMiddleware)
        const includeTestTenants = query?.includeTest === 'true';
        const data = await controllers.platformAdmin.getStats(includeTestTenants);
        return { status: 200 as const, body: data };
      },

      adminGetBookings: async ({ query }: { query?: { cursor?: string } }) => {
        // Auth middleware applied via app.use('/v1/admin/bookings', authMiddleware)
        // Issue #7 Fix: Now returns paginated bookings across ALL tenants
        const data = await controllers.admin.getBookings(query?.cursor);
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

      adminCreatePackage: async ({
        body,
      }: {
        body: {
          slug: string;
          title: string;
          description: string;
          priceCents: number;
          photoUrl?: string;
        };
      }) => {
        // Auth middleware applied via app.use('/v1/admin/packages', authMiddleware)
        const data = await controllers.adminPackages.createPackage(body);
        return { status: 200 as const, body: data };
      },

      adminUpdatePackage: async ({
        params,
        body,
      }: {
        params: { id: string };
        body: {
          slug?: string;
          title?: string;
          description?: string;
          priceCents?: number;
          photoUrl?: string;
        };
      }) => {
        // Auth middleware applied via app.use('/v1/admin/packages', authMiddleware)
        const data = await controllers.adminPackages.updatePackage(params.id, body);
        return { status: 200 as const, body: data };
      },

      adminDeletePackage: async ({ params }: { params: { id: string } }) => {
        // Auth middleware applied via app.use('/v1/admin/packages', authMiddleware)
        await controllers.adminPackages.deletePackage(params.id);
        return { status: 204 as const, body: undefined };
      },

      adminCreateAddOn: async ({
        params,
        body,
      }: {
        params: { packageId: string };
        body: { packageId: string; title: string; priceCents: number; photoUrl?: string };
      }) => {
        // Auth middleware applied via app.use('/v1/admin/packages', authMiddleware)
        const data = await controllers.adminPackages.createAddOn(params.packageId, body);
        return { status: 200 as const, body: data };
      },

      adminUpdateAddOn: async ({
        params,
        body,
      }: {
        params: { id: string };
        body: { packageId?: string; title?: string; priceCents?: number; photoUrl?: string };
      }) => {
        // Auth middleware applied via app.use('/v1/admin/addons', authMiddleware)
        const data = await controllers.adminPackages.updateAddOn(params.id, body);
        return { status: 200 as const, body: data };
      },

      adminDeleteAddOn: async ({ params }: { params: { id: string } }) => {
        // Auth middleware applied via app.use('/v1/admin/addons', authMiddleware)
        await controllers.adminPackages.deleteAddOn(params.id);
        return { status: 204 as const, body: undefined };
      },
    } as any),
    app,
    {
      // Apply middleware based on route path
      globalMiddleware: [
        (req, res, next) => {
          // Apply strict rate limiting to login endpoints
          if (
            (req.path === '/v1/admin/login' || req.path === '/v1/tenant-auth/login') &&
            req.method === 'POST'
          ) {
            return loginLimiter(req, res, next);
          }
          // Public API routes (packages, bookings, availability, tenant) require tenant
          if (
            req.path.startsWith('/v1/packages') ||
            req.path.startsWith('/v1/bookings') ||
            req.path.startsWith('/v1/availability') ||
            req.path.startsWith('/v1/tenant')
          ) {
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
        },
      ],
    }
  );

  // Register admin tenant management routes (Express router, not ts-rest)
  // Use factory function with shared services from DI container (#634)
  if (!services?.tenantProvisioning) {
    throw new Error('TenantProvisioningService is required - ensure DI container provides it');
  }
  app.use(
    '/v1/admin/tenants',
    authMiddleware,
    createAdminTenantsRoutes({
      prisma: prismaClient,
      provisioningService: services.tenantProvisioning,
    })
  );

  // Register admin Stripe Connect routes (Express router, not ts-rest)
  // Use factory function with shared prisma instance to avoid connection pool exhaustion
  app.use('/v1/admin/tenants', authMiddleware, createAdminStripeRoutes(prismaClient));

  // Register platform admin traces routes (for agent evaluation monitoring)
  // Requires platform admin authentication - used to review flagged conversations
  const platformAdminTracesRouter = createPlatformAdminTracesRouter(prismaClient);
  app.use('/v1/platform/admin/traces', authMiddleware, platformAdminTracesRouter);
  logger.info('✅ Platform admin traces routes mounted at /v1/platform/admin/traces');

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
    // /v1/auth/early-access - public - early access waitlist signup
    // Use TenantProvisioningService from DI container for atomic signup (#634)
    const unifiedAuthRoutes = createUnifiedAuthRoutes({
      identityService,
      tenantAuthService: services.tenantAuth,
      tenantRepo,
      config: {
        earlyAccessNotificationEmail: config.EARLY_ACCESS_NOTIFICATION_EMAIL,
        adminNotificationEmail: config.ADMIN_NOTIFICATION_EMAIL,
      },
      mailProvider,
      tenantProvisioningService: services.tenantProvisioning,
      earlyAccessRepo: repositories?.earlyAccess,
    });
    app.use('/v1/auth', unifiedAuthRoutes);

    // Register public tenant lookup routes (for storefront routing)
    // NO authentication required - returns only safe public fields
    // Rate limited to prevent enumeration attacks
    // Uses tenantRepo for DI (same repo used for tenant admin routes)
    const publicTenantRoutes = createPublicTenantRoutes({
      tenantRepository: tenantRepo,
      sectionContentService: services.sectionContent,
    });
    app.use('/v1/public/tenants', publicTenantLookupLimiter, publicTenantRoutes);
    logger.info('✅ Public tenant lookup routes mounted at /v1/public/tenants');

    // Register public booking management routes (for customer self-service)
    // NO authentication required - uses JWT tokens in query params for access
    // Allows customers to reschedule/cancel bookings via links in confirmation emails
    // P2-284 FIX: Inject bookingRepo for token state validation (prevents business logic bypass)
    if (!repositories?.booking) {
      throw new Error('BookingRepository is required for public booking management');
    }
    const publicBookingManagementController = new PublicBookingManagementController(
      services.booking,
      services.catalog,
      repositories.booking
    );
    const publicBookingManagementRouter = createPublicBookingManagementRouter(
      publicBookingManagementController
    );
    // P1-145 FIX: Apply rate limiting to prevent token brute-force and DoS
    app.use('/v1/public/bookings', publicBookingActionsLimiter, publicBookingManagementRouter);
    logger.info(
      '✅ Public booking management routes mounted at /v1/public/bookings (rate limited)'
    );

    // Register public balance payment routes (for deposit payment flow)
    // NO authentication required - uses JWT tokens in query params for access
    // Allows customers to pay remaining balance via links in confirmation emails
    // P2-284 FIX: Inject bookingRepo for token state validation (prevents business logic bypass)
    const publicBalancePaymentController = new PublicBalancePaymentController(
      services.booking,
      repositories.booking
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

    // Register tenant admin billing routes (for subscription management)
    // Requires tenant admin authentication
    if (stripeAdapter) {
      const tenantAdminBillingRoutes = createTenantAdminBillingRoutes(stripeAdapter, tenantRepo);
      app.use('/v1/tenant-admin/billing', tenantAuthMiddleware, tenantAdminBillingRoutes);
      logger.info('✅ Tenant admin billing routes mounted at /v1/tenant-admin/billing');
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
    logger.info(
      '✅ Tenant admin deposit settings routes mounted at /v1/tenant-admin/settings/deposits'
    );

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

      // Register public date booking routes (for DATE type package bookings)
      // Requires tenant context via X-Tenant-Key header
      // Phase 2 Refactor: BookingService now handles availability checking internally
      // TODO-329: Pass cacheAdapter for request-level idempotency via X-Idempotency-Key header
      const publicDateBookingRouter = createPublicDateBookingRoutes(services.booking, cacheAdapter);
      app.use('/v1/public', tenantMiddleware, requireTenant, publicDateBookingRouter);
      logger.info('✅ Public date booking routes mounted at /v1/public/bookings/date');

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

    // Register tenant admin webhook routes (for custom webhook subscriptions - TODO-278)
    // Requires tenant admin authentication
    if (repositories.webhookSubscription && services.webhookDelivery) {
      const tenantAdminWebhookRoutes = createTenantAdminWebhookRoutes(
        repositories.webhookSubscription,
        services.webhookDelivery
      );
      app.use('/v1/tenant-admin/webhooks', tenantAuthMiddleware, tenantAdminWebhookRoutes);
      logger.info('✅ Tenant admin webhook routes mounted at /v1/tenant-admin/webhooks');
    }

    // Register tenant admin domain routes (for custom domain management)
    // Requires tenant admin authentication
    const domainVerificationService = new DomainVerificationService(prismaClient);
    const tenantAdminDomainsRouter = createTenantAdminDomainsRouter(domainVerificationService);
    app.use('/v1/tenant-admin/domains', tenantAuthMiddleware, tenantAdminDomainsRouter);
    logger.info('✅ Tenant admin domain routes mounted at /v1/tenant-admin/domains');

    // Register Concierge agent routes (for Vertex AI agent integration)
    // Requires tenant admin authentication - chat with Concierge for dashboard actions
    // Dual-layer rate limiting to protect Vertex AI costs:
    // - agentChatLimiter: 30 messages per minute per tenant (overall quota)
    // - agentSessionLimiter: 10 messages per minute per session (burst protection)
    // Now uses persistent session storage via PostgreSQL (#session-persistence)
    const tenantAdminAgentRoutes = createTenantAdminAgentRoutes({ prisma: prismaClient });
    app.use(
      '/v1/tenant-admin/agent',
      tenantAuthMiddleware,
      agentChatLimiter,
      agentSessionLimiter,
      tenantAdminAgentRoutes
    );
    logger.info(
      '✅ Tenant admin Concierge routes mounted at /v1/tenant-admin/agent (with rate limiting)'
    );

    // Register Tenant Agent routes (Phase 2a - Semantic Storefront Architecture)
    // The Tenant Agent consolidates: Concierge, Storefront, Marketing, Project Hub
    // This runs alongside the existing Concierge routes during migration
    // @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
    const tenantAdminTenantAgentRoutes = createTenantAdminTenantAgentRoutes({
      prisma: prismaClient,
    });
    app.use(
      '/v1/tenant-admin/agent/tenant',
      tenantAuthMiddleware,
      agentChatLimiter,
      agentSessionLimiter,
      tenantAdminTenantAgentRoutes
    );
    logger.info('✅ Tenant Agent routes mounted at /v1/tenant-admin/agent/tenant (Phase 2a)');

    // Register tenant admin project routes (for project management dashboard)
    // Requires tenant admin authentication - manage projects, view/approve requests
    if (services.projectHub) {
      const tenantAdminProjectRoutes = createTenantAdminProjectRoutes(services.projectHub);
      app.use('/v1/tenant-admin/projects', tenantAuthMiddleware, tenantAdminProjectRoutes);
      logger.info('✅ Tenant admin project routes mounted at /v1/tenant-admin/projects');
    }

    // Register public customer chat routes (for customer-facing chatbot)
    // NO authentication required - uses tenant context from X-Tenant-Key header
    // Rate limited to 20 messages per minute per IP to protect Claude API costs
    const customerChatRoutes = createPublicCustomerChatRoutes(prismaClient);
    app.use(
      '/v1/public/chat',
      tenantMiddleware,
      requireTenant,
      customerChatLimiter,
      customerChatRoutes
    );
    logger.info('✅ Public customer chat routes mounted at /v1/public/chat (rate limited)');

    // Register public project routes (for customer project view page)
    // NO authentication required - uses tenant context from X-Tenant-Key header
    // Provides project details and Project Hub agent chat integration
    const publicProjectRoutes = createPublicProjectRoutes(prismaClient);
    app.use('/v1/public/projects', tenantMiddleware, requireTenant, publicProjectRoutes);
    logger.info('✅ Public project routes mounted at /v1/public/projects');

    // Start cleanup scheduler for customer sessions (runs every 24h)
    const stopCleanup = startCleanupScheduler(prismaClient);
    logger.info('✅ Customer session cleanup scheduler started (runs every 24h)');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      stopCleanup();
      logger.info('Cleanup scheduler stopped');
    });
  }

  // Register internal routes (for service-to-service communication)
  // Secured with INTERNAL_API_SECRET - not tenant authenticated
  const internalRoutes = createInternalRoutes({
    internalApiSecret: config.INTERNAL_API_SECRET,
  });
  app.use('/v1/internal', internalRoutes);
  logger.info('✅ Internal routes mounted at /v1/internal');

  // Register internal agent routes (for Vertex AI agent-to-backend communication)
  // Secured with X-Internal-Secret header - agents call these to fetch tenant data
  // Required services: catalog, booking, tenant repository, advisor memory
  if (services) {
    // Use tenantRepo from parameter if available (mock mode), otherwise create new (real mode fallback)
    const internalTenantRepo = tenantRepo ?? new PrismaTenantRepository(prismaClient);
    // Create context builder service (replaces legacy AdvisorMemoryService)
    const contextBuilder = createContextBuilderService(prismaClient);
    // Create vocabulary embedding service for semantic section resolution
    const vocabularyEmbeddingService = new VocabularyEmbeddingService(prismaClient);

    const internalAgentRoutes = createInternalAgentRoutes({
      internalApiSecret: config.INTERNAL_API_SECRET,
      catalogService: services.catalog,
      schedulingAvailabilityService: services.schedulingAvailability,
      bookingService: services.booking,
      tenantRepo: internalTenantRepo,
      serviceRepo: repositories?.service,
      contextBuilder,
      projectHubService: services.projectHub,
      vocabularyEmbeddingService,
      sectionContentService: services.sectionContent,
    });
    app.use('/v1/internal/agent', internalAgentRoutes);
    logger.info('✅ Internal agent routes mounted at /v1/internal/agent');
  }

  // Register internal agent health routes (for deployment verification)
  // Secured with X-Internal-Secret header - CI calls to verify agents are healthy
  const internalAgentHealthRoutes = createInternalAgentHealthRoutes({
    internalApiSecret: config.INTERNAL_API_SECRET,
  });
  app.use('/v1/internal', internalAgentHealthRoutes);
  logger.info('✅ Internal agent health routes mounted at /v1/internal/agents/health');
}
