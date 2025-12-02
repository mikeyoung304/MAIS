/**
 * Dependency injection container
 */

import type { Config } from './lib/core/config';
import { InProcessEventEmitter } from './lib/core/events';
import type { CacheServicePort } from './lib/ports';
import { RedisCacheAdapter } from './adapters/redis/cache.adapter';
import { InMemoryCacheAdapter } from './adapters/mock/cache.adapter';
import { CatalogService } from './services/catalog.service';
import { AvailabilityService } from './services/availability.service';
import { BookingService } from './services/booking.service';
import { CommissionService } from './services/commission.service';
import { IdentityService } from './services/identity.service';
import { StripeConnectService } from './services/stripe-connect.service';
import { TenantAuthService } from './services/tenant-auth.service';
import { AuditService } from './services/audit.service';
import { IdempotencyService } from './services/idempotency.service';
import { SegmentService } from './services/segment.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { SchedulingAvailabilityService } from './services/scheduling-availability.service';
import { PackageDraftService } from './services/package-draft.service';
import { PackagesController } from './routes/packages.routes';
import { AvailabilityController } from './routes/availability.routes';
import { BookingsController } from './routes/bookings.routes';
import { WebhooksController } from './routes/webhooks.routes';
import { AdminController } from './routes/admin.routes';
import { BlackoutsController } from './routes/blackouts.routes';
import { AdminPackagesController } from './routes/admin-packages.routes';
import { TenantController } from './routes/tenant.routes';
import { TenantAuthController } from './routes/tenant-auth.routes';
import { DevController } from './routes/dev.routes';
import { PlatformAdminController } from './controllers/platform-admin.controller';
import { buildMockAdapters } from './adapters/mock';
import { PrismaClient } from './generated/prisma';
import {
  PrismaCatalogRepository,
  PrismaBookingRepository,
  PrismaBlackoutRepository,
  PrismaUserRepository,
  PrismaWebhookRepository,
  PrismaTenantRepository,
  PrismaSegmentRepository,
  PrismaServiceRepository,
  PrismaAvailabilityRuleRepository,
} from './adapters/prisma';
import { StripePaymentAdapter } from './adapters/stripe.adapter';
import { PostmarkMailAdapter } from './adapters/postmark.adapter';
import { GoogleCalendarAdapter } from './adapters/gcal.adapter';
import { GoogleCalendarSyncAdapter } from './adapters/google-calendar-sync.adapter';
import { logger } from './lib/core/logger';

export interface Container {
  controllers: {
    packages: PackagesController;
    availability: AvailabilityController;
    bookings: BookingsController;
    webhooks: WebhooksController;
    admin: AdminController;
    blackouts: BlackoutsController;
    adminPackages: AdminPackagesController;
    platformAdmin: PlatformAdminController;
    tenant: TenantController;
    tenantAuth: TenantAuthController;
    dev?: DevController;
  };
  services: {
    identity: IdentityService;
    stripeConnect: StripeConnectService;
    tenantAuth: TenantAuthService;
    catalog: CatalogService;
    booking: BookingService;
    audit: AuditService;
    segment: SegmentService;
    googleCalendar?: GoogleCalendarService; // Optional - only if calendar provider supports sync
    schedulingAvailability?: SchedulingAvailabilityService; // Scheduling slot generation
    packageDraft: PackageDraftService; // Visual editor draft management
  };
  repositories?: {
    service?: PrismaServiceRepository;
    availabilityRule?: PrismaAvailabilityRuleRepository;
    booking?: PrismaBookingRepository;
  };
  mailProvider?: PostmarkMailAdapter; // Export mail provider for password reset emails
  cacheAdapter: CacheServicePort; // Export cache adapter for health checks
  prisma?: PrismaClient; // Export Prisma instance for shutdown
  eventEmitter?: InProcessEventEmitter; // Export event emitter for cleanup
  /**
   * Cleanup method to properly dispose of services and close connections
   * Call this during application shutdown to prevent memory leaks
   */
  cleanup: () => Promise<void>;
}

export function buildContainer(config: Config): Container {
  const eventEmitter = new InProcessEventEmitter();

  // Initialize cache adapter (Redis for real mode, in-memory for mock)
  let cacheAdapter: CacheServicePort;
  if (config.ADAPTERS_PRESET === 'real' && process.env.REDIS_URL) {
    logger.info('🔴 Using Redis cache adapter');
    cacheAdapter = new RedisCacheAdapter(process.env.REDIS_URL);
  } else {
    logger.info('🧪 Using in-memory cache adapter');
    cacheAdapter = new InMemoryCacheAdapter();
  }

  if (config.ADAPTERS_PRESET === 'mock') {
    logger.info('🧪 Using MOCK adapters');

    // Build mock adapters
    const adapters = buildMockAdapters();

    // Mock PrismaClient for CommissionService (uses in-memory mock data)
    const mockPrisma = new PrismaClient();

    // Create CommissionService with mock Prisma
    const commissionService = new CommissionService(mockPrisma);

    // Create AuditService with mock Prisma (Sprint 2.1)
    const auditService = new AuditService({ prisma: mockPrisma });

    // Create IdempotencyService with mock Prisma
    const idempotencyService = new IdempotencyService(mockPrisma);

    // Build domain services with caching and audit logging
    const catalogService = new CatalogService(adapters.catalogRepo, cacheAdapter, auditService);
    const availabilityService = new AvailabilityService(
      adapters.calendarProvider,
      adapters.blackoutRepo,
      adapters.bookingRepo
    );

    // Mock TenantRepository
    const mockTenantRepo = new PrismaTenantRepository(mockPrisma);

    const bookingService = new BookingService(
      adapters.bookingRepo,
      adapters.catalogRepo,
      eventEmitter,
      adapters.paymentProvider,
      commissionService,
      mockTenantRepo,
      idempotencyService
    );
    const identityService = new IdentityService(adapters.userRepo, config.JWT_SECRET);

    // Create StripeConnectService with mock Prisma
    const stripeConnectService = new StripeConnectService(mockPrisma);

    // Create TenantAuthService with mock Prisma tenant repo
    const tenantAuthService = new TenantAuthService(mockTenantRepo, config.JWT_SECRET);

    // Create SegmentService with mock Prisma segment repo
    const segmentRepo = new PrismaSegmentRepository(mockPrisma);
    const segmentService = new SegmentService(segmentRepo, cacheAdapter);

    // Create GoogleCalendarService with mock calendar provider
    const googleCalendarService = new GoogleCalendarService(adapters.calendarProvider);

    // Create scheduling repositories and service with mock Prisma
    const serviceRepo = new PrismaServiceRepository(mockPrisma);
    const availabilityRuleRepo = new PrismaAvailabilityRuleRepository(mockPrisma);
    const schedulingAvailabilityService = new SchedulingAvailabilityService(
      serviceRepo,
      availabilityRuleRepo,
      adapters.bookingRepo
    );

    // Create PackageDraftService with mock catalog repository
    const packageDraftService = new PackageDraftService(adapters.catalogRepo, cacheAdapter);

    const controllers = {
      packages: new PackagesController(catalogService),
      availability: new AvailabilityController(availabilityService),
      bookings: new BookingsController(bookingService),
      webhooks: new WebhooksController(adapters.paymentProvider, bookingService, adapters.webhookRepo),
      admin: new AdminController(identityService, bookingService),
      blackouts: new BlackoutsController(adapters.blackoutRepo),
      adminPackages: new AdminPackagesController(catalogService),
      platformAdmin: new PlatformAdminController(mockPrisma),
      tenant: new TenantController(mockTenantRepo),
      tenantAuth: new TenantAuthController(tenantAuthService),
      dev: new DevController(bookingService, adapters.catalogRepo),
    };

    const services = {
      identity: identityService,
      stripeConnect: stripeConnectService,
      tenantAuth: tenantAuthService,
      catalog: catalogService,
      booking: bookingService,
      audit: auditService,
      segment: segmentService,
      googleCalendar: googleCalendarService,
      schedulingAvailability: schedulingAvailabilityService,
      packageDraft: packageDraftService,
    };

    const repositories = {
      service: serviceRepo,
      availabilityRule: availabilityRuleRepo,
      booking: adapters.bookingRepo as any, // Mock booking repo - type compatibility
    };

    // Cleanup function for mock mode
    const cleanup = async (): Promise<void> => {
      logger.info('Starting DI container cleanup (mock mode)');

      try {
        // 1. Disconnect Prisma (mock instance)
        if (mockPrisma) {
          await mockPrisma.$disconnect();
          logger.info('Mock Prisma disconnected');
        }

        // 2. Disconnect cache adapter (in-memory or Redis)
        if (cacheAdapter && 'disconnect' in cacheAdapter) {
          await (cacheAdapter as any).disconnect();
          logger.info('Cache adapter disconnected');
        }

        // 3. Clear event emitter subscriptions to prevent memory leaks
        eventEmitter.clearAll();
        logger.info('Event emitter subscriptions cleared');

        logger.info('DI container cleanup completed (mock mode)');
      } catch (error) {
        logger.error({ error }, 'Error during DI container cleanup (mock mode)');
        throw error;
      }
    };

    return {
      controllers,
      services,
      repositories,
      mailProvider: undefined,
      cacheAdapter,
      prisma: mockPrisma,
      eventEmitter,
      cleanup,
    };
  }

  // Real adapters mode
  logger.info('🚀 Using REAL adapters with Prisma + PostgreSQL + Stripe');

  if (!config.DATABASE_URL) {
    throw new Error('DATABASE_URL required for real adapters mode');
  }

  // Initialize Prisma Client with serverless-optimized connection pooling
  // Append connection pool parameters to DATABASE_URL
  const databaseUrl = new URL(config.DATABASE_URL!);

  // Add Prisma connection pool parameters for serverless optimization
  // See: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool
  databaseUrl.searchParams.set('connection_limit', String(config.DATABASE_CONNECTION_LIMIT));
  databaseUrl.searchParams.set('pool_timeout', String(config.DATABASE_POOL_TIMEOUT));

  // For Supabase with Supavisor (pgbouncer), use transaction mode
  // This requires adding ?pgbouncer=true to the URL
  if (databaseUrl.host.includes('supabase')) {
    databaseUrl.searchParams.set('pgbouncer', 'true');
    logger.info('🔌 Using Supabase Supavisor (pgbouncer) for connection pooling');
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl.toString(),
      },
    },
    log: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['query', 'error', 'warn'],
  });

  logger.info(`📊 Prisma connection pool: limit=${config.DATABASE_CONNECTION_LIMIT}, timeout=${config.DATABASE_POOL_TIMEOUT}s`);

  // Add slow query monitoring
  if (process.env.NODE_ENV !== 'production') {
    prisma.$on('query' as never, ((e: { duration: number; query: string }) => {
      if (e.duration > 1000) {
        logger.warn({ duration: e.duration, query: e.query }, 'Slow query detected (>1s)');
      }
    }) as never);
  }

  // Build real repository adapters
  const catalogRepo = new PrismaCatalogRepository(prisma);
  const bookingRepo = new PrismaBookingRepository(prisma);
  const blackoutRepo = new PrismaBlackoutRepository(prisma);
  const userRepo = new PrismaUserRepository(prisma);
  const webhookRepo = new PrismaWebhookRepository(prisma);
  const tenantRepo = new PrismaTenantRepository(prisma);
  const segmentRepo = new PrismaSegmentRepository(prisma);

  // Create CommissionService with real Prisma
  const commissionService = new CommissionService(prisma);

  // Create StripeConnectService with real Prisma
  const stripeConnectService = new StripeConnectService(prisma);

  // Build Stripe payment adapter
  if (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET required for real adapters mode');
  }

  const paymentProvider = new StripePaymentAdapter({
    secretKey: config.STRIPE_SECRET_KEY,
    webhookSecret: config.STRIPE_WEBHOOK_SECRET,
    successUrl: config.STRIPE_SUCCESS_URL || 'http://localhost:5173/success',
    cancelUrl: config.STRIPE_CANCEL_URL || 'http://localhost:5173',
  });

  // Build Postmark mail adapter (with file-sink fallback when no token)
  const mailProvider = new PostmarkMailAdapter({
    serverToken: config.POSTMARK_SERVER_TOKEN,
    fromEmail: config.POSTMARK_FROM_EMAIL || 'bookings@example.com',
  });

  // Build Google Calendar adapter (or fallback to mock if creds missing)
  let calendarProvider;
  if (config.GOOGLE_CALENDAR_ID && config.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
    logger.info('📅 Using Google Calendar sync adapter (one-way sync enabled)');
    // Use GoogleCalendarSyncAdapter for full sync capabilities (extends GoogleCalendarAdapter)
    calendarProvider = new GoogleCalendarSyncAdapter({
      calendarId: config.GOOGLE_CALENDAR_ID,
      serviceAccountJsonBase64: config.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,
    });
  } else {
    logger.warn('⚠️  Google Calendar credentials not configured; using mock calendar (all dates available)');
    const mockAdapters = buildMockAdapters();
    calendarProvider = mockAdapters.calendarProvider;
  }

  // Create AuditService with real Prisma (Sprint 2.1)
  const auditService = new AuditService({ prisma });

  // Create IdempotencyService with real Prisma
  const idempotencyService = new IdempotencyService(prisma);

  // Build domain services with caching and audit logging
  const catalogService = new CatalogService(catalogRepo, cacheAdapter, auditService);
  const availabilityService = new AvailabilityService(
    calendarProvider,
    blackoutRepo,
    bookingRepo
  );
  const bookingService = new BookingService(
    bookingRepo,
    catalogRepo,
    eventEmitter,
    paymentProvider,
    commissionService,
    tenantRepo,
    idempotencyService
  );
  const identityService = new IdentityService(userRepo, config.JWT_SECRET);

  // Create TenantAuthService with real Prisma tenant repo
  const tenantAuthService = new TenantAuthService(tenantRepo, config.JWT_SECRET);

  // Create SegmentService with real Prisma segment repo
  const segmentService = new SegmentService(segmentRepo, cacheAdapter);

  // Create GoogleCalendarService with real calendar provider
  const googleCalendarService = new GoogleCalendarService(calendarProvider);

  // Create scheduling repositories and service with real Prisma
  const serviceRepo = new PrismaServiceRepository(prisma);
  const availabilityRuleRepo = new PrismaAvailabilityRuleRepository(prisma);
  const schedulingAvailabilityService = new SchedulingAvailabilityService(
    serviceRepo,
    availabilityRuleRepo,
    bookingRepo
  );

  // Create PackageDraftService with real catalog repository
  const packageDraftService = new PackageDraftService(catalogRepo, cacheAdapter);

  // Subscribe to BookingPaid events to send confirmation emails
  eventEmitter.subscribe<{
    bookingId: string;
    email: string;
    coupleName: string;
    eventDate: string;
    packageTitle: string;
    addOnTitles: string[];
    totalCents: number;
  }>('BookingPaid', async (payload) => {
    try {
      await mailProvider.sendBookingConfirm(payload.email, {
        eventDate: payload.eventDate,
        packageTitle: payload.packageTitle,
        totalCents: payload.totalCents,
        addOnTitles: payload.addOnTitles,
      });
    } catch (err) {
      logger.error({ err, bookingId: payload.bookingId }, 'Failed to send booking confirmation email');
    }
  });

  // Subscribe to AppointmentBooked events to sync with Google Calendar
  eventEmitter.subscribe<{
    bookingId: string;
    tenantId: string;
    serviceId: string;
    serviceName: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string;
    startTime: string;
    endTime: string;
    totalCents: number;
    notes?: string;
  }>('AppointmentBooked', async (payload) => {
    try {
      // Sync appointment to Google Calendar
      const result = await googleCalendarService.createAppointmentEvent(
        payload.tenantId,
        {
          id: payload.bookingId,
          serviceName: payload.serviceName,
          clientName: payload.clientName,
          clientEmail: payload.clientEmail,
          startTime: new Date(payload.startTime),
          endTime: new Date(payload.endTime),
          notes: payload.notes,
        }
      );

      if (result?.eventId) {
        // Store Google event ID in booking for future cancellation sync
        await bookingRepo.updateGoogleEventId(payload.tenantId, payload.bookingId, result.eventId);
        logger.info(
          { bookingId: payload.bookingId, googleEventId: result.eventId },
          'Appointment synced to Google Calendar'
        );
      }
    } catch (err) {
      // Log error but don't fail the booking - calendar sync is non-critical
      logger.error(
        { err, bookingId: payload.bookingId },
        'Failed to sync appointment to Google Calendar'
      );
    }
  });

  // Build controllers
  const controllers = {
    packages: new PackagesController(catalogService),
    availability: new AvailabilityController(availabilityService),
    bookings: new BookingsController(bookingService),
    webhooks: new WebhooksController(paymentProvider, bookingService, webhookRepo),
    admin: new AdminController(identityService, bookingService),
    blackouts: new BlackoutsController(blackoutRepo),
    adminPackages: new AdminPackagesController(catalogService),
    platformAdmin: new PlatformAdminController(prisma),
    tenant: new TenantController(tenantRepo),
    tenantAuth: new TenantAuthController(tenantAuthService),
    // No dev controller in real mode
  };

  const services = {
    identity: identityService,
    stripeConnect: stripeConnectService,
    tenantAuth: tenantAuthService,
    catalog: catalogService,
    booking: bookingService,
    audit: auditService,
    segment: segmentService,
    googleCalendar: googleCalendarService,
    schedulingAvailability: schedulingAvailabilityService,
    packageDraft: packageDraftService,
  };

  const repositories = {
    service: serviceRepo,
    availabilityRule: availabilityRuleRepo,
    booking: bookingRepo,
  };

  // Cleanup function for real mode
  const cleanup = async (): Promise<void> => {
    logger.info('Starting DI container cleanup (real mode)');

    try {
      // 1. Disconnect Prisma
      if (prisma) {
        await prisma.$disconnect();
        logger.info('Prisma disconnected');
      }

      // 2. Disconnect cache adapter (Redis or in-memory)
      if (cacheAdapter && 'disconnect' in cacheAdapter) {
        await (cacheAdapter as any).disconnect();
        logger.info('Cache adapter disconnected');
      }

      // 3. Clear event emitter subscriptions to prevent memory leaks
      eventEmitter.clearAll();
      logger.info('Event emitter subscriptions cleared');

      logger.info('DI container cleanup completed (real mode)');
    } catch (error) {
      logger.error({ error }, 'Error during DI container cleanup (real mode)');
      throw error;
    }
  };

  return {
    controllers,
    services,
    repositories,
    mailProvider,
    cacheAdapter,
    prisma,
    eventEmitter,
    cleanup,
  };
}
