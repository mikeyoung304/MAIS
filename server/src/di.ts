/**
 * Dependency injection container
 */

import type { Config } from './lib/core/config';
import { InProcessEventEmitter, BookingEvents, AppointmentEvents } from './lib/core/events';
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
import { TenantOnboardingService } from './services/tenant-onboarding.service';
import { TenantProvisioningService } from './services/tenant-provisioning.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { SchedulingAvailabilityService } from './services/scheduling-availability.service';
import { PackageDraftService } from './services/package-draft.service';
import { ReminderService } from './services/reminder.service';
import { LandingPageService } from './services/landing-page.service';
import { HealthCheckService } from './services/health-check.service';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { UploadAdapter } from './adapters/upload.adapter';
import { NodeFileSystemAdapter } from './adapters/filesystem.adapter';
import { PackagesController } from './routes/packages.routes';
import { AvailabilityController } from './routes/availability.routes';
import { BookingsController } from './routes/bookings.routes';
import { WebhooksController } from './routes/webhooks.routes';
import type { WebhookQueue } from './jobs/webhook-queue';
import { createWebhookQueue } from './jobs/webhook-queue';
import { AdminController } from './routes/admin.routes';
import { BlackoutsController } from './routes/blackouts.routes';
import { AdminPackagesController } from './routes/admin-packages.routes';
import { TenantController } from './routes/tenant.routes';
import { TenantAuthController } from './routes/tenant-auth.routes';
import { DevController } from './routes/dev.routes';
import { PlatformAdminController } from './controllers/platform-admin.controller';
import { buildMockAdapters } from './adapters/mock';
import { PrismaClient } from './generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaCatalogRepository,
  PrismaBookingRepository,
  PrismaBlackoutRepository,
  PrismaUserRepository,
  PrismaWebhookRepository,
  PrismaWebhookSubscriptionRepository,
  PrismaTenantRepository,
  PrismaSegmentRepository,
  PrismaServiceRepository,
  PrismaAvailabilityRuleRepository,
  PrismaEarlyAccessRepository,
} from './adapters/prisma';
import { PrismaAdvisorMemoryRepository } from './adapters/prisma/advisor-memory.repository';
import type { AdvisorMemoryRepository } from './lib/ports';
import { createEvaluator } from './agent/evals/evaluator';
import { createEvalPipeline } from './agent/evals/pipeline';
import { createReviewQueue } from './agent/feedback/review-queue';
import { createReviewActionService } from './agent/feedback/review-actions';
import type { ConversationEvaluator } from './agent/evals/evaluator';
import type { EvalPipeline } from './agent/evals/pipeline';
import type { ReviewQueue } from './agent/feedback/review-queue';
import type { ReviewActionService } from './agent/feedback/review-actions';
import { StripePaymentAdapter } from './adapters/stripe.adapter';
import { PostmarkMailAdapter } from './adapters/postmark.adapter';
import { GoogleCalendarSyncAdapter } from './adapters/google-calendar-sync.adapter';
import { getSupabaseClient } from './config/database';
import { logger } from './lib/core/logger';
import path from 'path';

// ============================================================================
// Evaluation Services DI Helper (Issue 605)
// ============================================================================
// Extracted helper to avoid duplication between mock and real mode

interface EvaluationServices {
  evaluator: ConversationEvaluator;
  pipeline: EvalPipeline;
  reviewQueue: ReviewQueue;
  reviewActions: ReviewActionService;
}

/**
 * Build evaluation services for agent quality monitoring.
 * Requires ANTHROPIC_API_KEY to be set; returns undefined if not configured.
 */
function buildEvaluationServices(
  prisma: PrismaClient,
  mode: 'mock' | 'real'
): EvaluationServices | undefined {
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.info('⚠️  Agent evaluation services skipped (ANTHROPIC_API_KEY not set)');
    return undefined;
  }

  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(prisma, evaluator);
  const reviewQueue = createReviewQueue(prisma);
  const reviewActions = createReviewActionService(prisma);

  logger.info(`${mode === 'mock' ? '🧪' : '🤖'} Agent evaluation services initialized`);
  return { evaluator, pipeline, reviewQueue, reviewActions };
}

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
    availability: AvailabilityService; // Date availability checking
    audit: AuditService;
    segment: SegmentService;
    tenantOnboarding: TenantOnboardingService; // Tenant signup default data creation
    googleCalendar?: GoogleCalendarService; // Optional - only if calendar provider supports sync
    schedulingAvailability?: SchedulingAvailabilityService; // Scheduling slot generation
    packageDraft: PackageDraftService; // Visual editor draft management
    reminder: ReminderService; // Lazy reminder evaluation (Phase 2)
    landingPage: LandingPageService; // Landing page visual editor (TODO-241)
    webhookDelivery?: WebhookDeliveryService; // Outbound webhook delivery (TODO-278)
    // Agent evaluation services (Phase 2 - agent-evaluation-system.md)
    evaluation?: {
      evaluator: ConversationEvaluator;
      pipeline: EvalPipeline;
      reviewQueue: ReviewQueue;
      reviewActions: ReviewActionService;
    };
  };
  repositories?: {
    service?: PrismaServiceRepository;
    availabilityRule?: PrismaAvailabilityRuleRepository;
    booking?: PrismaBookingRepository;
    catalog?: PrismaCatalogRepository; // Catalog repository for package lookups
    webhookSubscription?: PrismaWebhookSubscriptionRepository; // Webhook subscription management (TODO-278)
    earlyAccess?: PrismaEarlyAccessRepository; // Early access request persistence
    advisorMemory?: AdvisorMemoryRepository; // Onboarding agent state projection
  };
  mailProvider?: PostmarkMailAdapter; // Export mail provider for password reset emails
  storageProvider: UploadAdapter; // Export storage provider for file uploads
  cacheAdapter: CacheServicePort; // Export cache adapter for health checks
  healthCheckService?: HealthCheckService; // Export health check service for deep checks
  prisma?: PrismaClient; // Export Prisma instance for shutdown
  eventEmitter?: InProcessEventEmitter; // Export event emitter for cleanup
  webhookQueue?: WebhookQueue; // Export webhook queue for shutdown
  stripeAdapter?: StripePaymentAdapter; // Export Stripe adapter for billing routes
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

    // Build storage provider (local filesystem for mock mode)
    const fileSystem = new NodeFileSystemAdapter();
    const storageProvider = new UploadAdapter(
      {
        logoUploadDir: path.join(process.cwd(), 'uploads', 'logos'),
        packagePhotoUploadDir: path.join(process.cwd(), 'uploads', 'packages'),
        segmentImageUploadDir: path.join(process.cwd(), 'uploads', 'segments'),
        landingPageImageUploadDir: path.join(process.cwd(), 'uploads', 'landing-pages'),
        maxFileSizeMB: 2,
        maxPackagePhotoSizeMB: 5,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'],
        baseUrl: config.API_BASE_URL || 'http://localhost:5000',
        isRealMode: false,
        supabaseClient: undefined,
      },
      fileSystem
    );

    // Mock PrismaClient for CommissionService (uses in-memory mock data)
    // Prisma 7: Use driver adapter - DATABASE_URL is required even in mock mode
    const mockDatabaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST;
    if (!mockDatabaseUrl) {
      throw new Error(
        'DATABASE_URL or DATABASE_URL_TEST must be set. Prisma 7 requires a database connection.'
      );
    }
    const mockAdapter = new PrismaPg({ connectionString: mockDatabaseUrl });
    const mockPrisma = new PrismaClient({ adapter: mockAdapter });

    // Create CommissionService with mock Prisma
    const commissionService = new CommissionService(mockPrisma);

    // Create AuditService with mock Prisma (Sprint 2.1)
    const auditService = new AuditService({ prisma: mockPrisma });

    // Create IdempotencyService with mock Prisma
    const idempotencyService = new IdempotencyService(mockPrisma);
    idempotencyService.startCleanupScheduler();

    // Mock TenantRepository (moved before CatalogService for proper dependency order)
    const mockTenantRepo = new PrismaTenantRepository(mockPrisma);

    // Create SegmentService and TenantOnboardingService BEFORE CatalogService (#631)
    const segmentRepo = new PrismaSegmentRepository(mockPrisma);
    const tenantOnboardingService = new TenantOnboardingService(mockPrisma);

    // Create TenantProvisioningService for atomic tenant creation (#634)
    const tenantProvisioningService = new TenantProvisioningService(mockPrisma);

    // Build domain services with caching and audit logging
    // CatalogService now receives segmentRepo and onboardingService for segment validation (#631)
    const catalogService = new CatalogService(
      adapters.catalogRepo,
      cacheAdapter,
      auditService,
      segmentRepo,
      tenantOnboardingService
    );
    const availabilityService = new AvailabilityService(
      adapters.calendarProvider,
      adapters.blackoutRepo,
      adapters.bookingRepo
    );

    // Create scheduling repositories and service for TIMESLOT bookings
    const serviceRepo = new PrismaServiceRepository(mockPrisma);
    const availabilityRuleRepo = new PrismaAvailabilityRuleRepository(mockPrisma);

    // Create GoogleCalendarService with mock calendar provider (needed by SchedulingAvailabilityService)
    const googleCalendarService = new GoogleCalendarService(adapters.calendarProvider);

    const schedulingAvailabilityService = new SchedulingAvailabilityService(
      serviceRepo,
      availabilityRuleRepo,
      adapters.bookingRepo,
      googleCalendarService, // Two-way sync with Google Calendar
      cacheAdapter // Cache for Google Calendar busy times (5 min TTL)
    );

    // P3-342 FIX: Use options object pattern to avoid undefined placeholders
    const bookingService = new BookingService({
      bookingRepo: adapters.bookingRepo,
      catalogRepo: adapters.catalogRepo,
      eventEmitter,
      paymentProvider: adapters.paymentProvider,
      commissionService,
      tenantRepo: mockTenantRepo,
      idempotencyService,
      // Optional dependencies now properly passed (not undefined placeholders)
      schedulingAvailabilityService,
      serviceRepo,
      availabilityService,
    });
    const identityService = new IdentityService(adapters.userRepo, config.JWT_SECRET);

    // Create StripeConnectService with mock Prisma
    const stripeConnectService = new StripeConnectService(mockPrisma);

    // Create TenantAuthService with mock Prisma tenant repo
    const tenantAuthService = new TenantAuthService(mockTenantRepo, config.JWT_SECRET);

    // Create SegmentService with mock Prisma segment repo and storage provider
    // Note: segmentRepo and tenantOnboardingService already created above for CatalogService (#631)
    const segmentService = new SegmentService(segmentRepo, cacheAdapter, storageProvider);

    // Create PackageDraftService with mock catalog repository
    const packageDraftService = new PackageDraftService(adapters.catalogRepo, cacheAdapter);

    // Create LandingPageService with mock tenant repository
    const landingPageService = new LandingPageService(mockTenantRepo);

    // Create HealthCheckService with mock adapters (won't be used in mock mode)
    const healthCheckService = new HealthCheckService({
      stripeAdapter: undefined, // Mock mode doesn't use real adapters
      mailAdapter: undefined,
      calendarAdapter: undefined,
    });

    // Note: No webhook queue in mock mode - processing is always synchronous
    // This keeps mock mode simple and fast for testing
    const controllers = {
      packages: new PackagesController(catalogService),
      availability: new AvailabilityController(availabilityService),
      bookings: new BookingsController(bookingService),
      webhooks: new WebhooksController(
        adapters.paymentProvider,
        bookingService,
        adapters.webhookRepo,
        undefined, // No queue in mock mode - sync processing
        mockTenantRepo // For subscription checkout processing
      ),
      admin: new AdminController(identityService, bookingService),
      blackouts: new BlackoutsController(adapters.blackoutRepo),
      adminPackages: new AdminPackagesController(catalogService),
      platformAdmin: new PlatformAdminController(mockPrisma),
      tenant: new TenantController(mockTenantRepo),
      tenantAuth: new TenantAuthController(tenantAuthService),
      dev: new DevController(bookingService, adapters.catalogRepo, adapters.bookingRepo),
    };

    // Create ReminderService with mock adapters
    const reminderService = new ReminderService(
      adapters.bookingRepo,
      adapters.catalogRepo,
      eventEmitter
    );

    // Agent evaluation services (uses extracted helper to avoid duplication)
    // In mock mode, these are optional - tests can inject mock evaluators
    const evaluation = buildEvaluationServices(mockPrisma, 'mock');

    const services = {
      identity: identityService,
      stripeConnect: stripeConnectService,
      tenantAuth: tenantAuthService,
      catalog: catalogService,
      booking: bookingService,
      availability: availabilityService,
      audit: auditService,
      segment: segmentService,
      tenantOnboarding: tenantOnboardingService,
      tenantProvisioning: tenantProvisioningService,
      googleCalendar: googleCalendarService,
      schedulingAvailability: schedulingAvailabilityService,
      packageDraft: packageDraftService,
      reminder: reminderService,
      landingPage: landingPageService,
      evaluation,
    };

    // Create AdvisorMemoryRepository for onboarding agent
    const advisorMemoryRepo = new PrismaAdvisorMemoryRepository(mockPrisma);

    const repositories = {
      service: serviceRepo,
      availabilityRule: availabilityRuleRepo,
      booking: adapters.bookingRepo as any, // Mock booking repo - type compatibility
      catalog: adapters.catalogRepo as any, // Mock catalog repo
      earlyAccess: adapters.earlyAccessRepo as any, // Mock early access repo
      advisorMemory: advisorMemoryRepo, // Onboarding agent state projection
    };

    // Cleanup function for mock mode
    const cleanup = async (): Promise<void> => {
      logger.info('Starting DI container cleanup (mock mode)');

      try {
        // 1. Stop idempotency cleanup scheduler
        await idempotencyService.stopCleanupScheduler();
        logger.info('Idempotency cleanup scheduler stopped');

        // 2. Disconnect Prisma (mock instance)
        if (mockPrisma) {
          await mockPrisma.$disconnect();
          logger.info('Mock Prisma disconnected');
        }

        // 3. Disconnect cache adapter (in-memory or Redis)
        if (cacheAdapter && 'disconnect' in cacheAdapter) {
          await (cacheAdapter as any).disconnect();
          logger.info('Cache adapter disconnected');
        }

        // 4. Clear event emitter subscriptions to prevent memory leaks
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
      storageProvider,
      cacheAdapter,
      healthCheckService,
      prisma: mockPrisma,
      eventEmitter,
      webhookQueue: undefined, // No queue in mock mode
      stripeAdapter: undefined, // No Stripe in mock mode
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

  // Prisma 7: Use driver adapter for PostgreSQL connections
  const adapter = new PrismaPg({ connectionString: databaseUrl.toString() });
  const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  });

  logger.info(
    `📊 Prisma connection pool: limit=${config.DATABASE_CONNECTION_LIMIT}, timeout=${config.DATABASE_POOL_TIMEOUT}s`
  );

  // Add slow query monitoring
  if (process.env.NODE_ENV !== 'production') {
    prisma.$on(
      'query' as never,
      ((e: { duration: number; query: string }) => {
        if (e.duration > 1000) {
          logger.warn({ duration: e.duration, query: e.query }, 'Slow query detected (>1s)');
        }
      }) as never
    );
  }

  // Build real repository adapters
  const catalogRepo = new PrismaCatalogRepository(prisma);
  const bookingRepo = new PrismaBookingRepository(prisma);
  const blackoutRepo = new PrismaBlackoutRepository(prisma);
  const userRepo = new PrismaUserRepository(prisma);
  const webhookRepo = new PrismaWebhookRepository(prisma);
  const webhookSubscriptionRepo = new PrismaWebhookSubscriptionRepository(prisma);
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
    logger.info(
      '📅 Using Google Calendar sync adapter (one-way sync enabled, per-tenant config supported)'
    );
    // Use GoogleCalendarSyncAdapter for full sync capabilities (extends GoogleCalendarAdapter)
    // Pass tenantRepo to enable per-tenant calendar configuration
    calendarProvider = new GoogleCalendarSyncAdapter(
      {
        calendarId: config.GOOGLE_CALENDAR_ID,
        serviceAccountJsonBase64: config.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,
      },
      tenantRepo
    );
  } else {
    logger.warn(
      '⚠️  Google Calendar credentials not configured; using mock calendar (all dates available)'
    );
    const mockAdapters = buildMockAdapters();
    calendarProvider = mockAdapters.calendarProvider;
  }

  // Build storage provider (Supabase for real mode, or local filesystem fallback)
  const fileSystem = new NodeFileSystemAdapter();
  let supabaseClient;
  let isRealMode = false;

  // Use Supabase storage only when:
  // 1. ADAPTERS_PRESET=real AND SUPABASE_URL is configured, OR
  // 2. STORAGE_MODE=supabase is explicitly set
  // This allows integration tests to use real DB with local storage by not setting STORAGE_MODE
  if (
    process.env.STORAGE_MODE === 'supabase' ||
    (config.ADAPTERS_PRESET === 'real' &&
      process.env.SUPABASE_URL &&
      process.env.STORAGE_MODE !== 'local')
  ) {
    try {
      supabaseClient = getSupabaseClient();
      isRealMode = true;
      logger.info('📦 Using Supabase storage for file uploads');
    } catch (error) {
      logger.warn('⚠️  Supabase not configured; using local filesystem storage');
    }
  } else {
    logger.info('📁 Using local filesystem storage for file uploads');
  }

  const storageProvider = new UploadAdapter(
    {
      logoUploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'logos'),
      packagePhotoUploadDir: path.join(process.cwd(), 'uploads', 'packages'),
      segmentImageUploadDir: path.join(process.cwd(), 'uploads', 'segments'),
      landingPageImageUploadDir: path.join(process.cwd(), 'uploads', 'landing-pages'),
      maxFileSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '2', 10),
      maxPackagePhotoSizeMB: 5,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'],
      baseUrl: config.API_BASE_URL || 'http://localhost:5000',
      isRealMode,
      supabaseClient,
    },
    fileSystem
  );

  // Create AuditService with real Prisma (Sprint 2.1)
  const auditService = new AuditService({ prisma });

  // Create IdempotencyService with real Prisma
  const idempotencyService = new IdempotencyService(prisma);
  idempotencyService.startCleanupScheduler();

  // Create TenantOnboardingService BEFORE CatalogService (#631) for segment validation
  const tenantOnboardingService = new TenantOnboardingService(prisma);

  // Create TenantProvisioningService for atomic tenant creation (#634)
  const tenantProvisioningService = new TenantProvisioningService(prisma);

  // Build domain services with caching and audit logging
  // CatalogService now receives segmentRepo and onboardingService for segment validation (#631)
  const catalogService = new CatalogService(
    catalogRepo,
    cacheAdapter,
    auditService,
    segmentRepo,
    tenantOnboardingService
  );
  const availabilityService = new AvailabilityService(calendarProvider, blackoutRepo, bookingRepo);
  // P3-342 FIX: Use options object pattern to avoid undefined placeholders
  const bookingService = new BookingService({
    bookingRepo,
    catalogRepo,
    eventEmitter,
    paymentProvider,
    commissionService,
    tenantRepo,
    idempotencyService,
    // Optional dependencies - will be set up after scheduling service is created
    availabilityService,
  });
  const identityService = new IdentityService(userRepo, config.JWT_SECRET);

  // Create TenantAuthService with real Prisma tenant repo
  const tenantAuthService = new TenantAuthService(tenantRepo, config.JWT_SECRET);

  // Create SegmentService with real Prisma segment repo and storage provider
  const segmentService = new SegmentService(segmentRepo, cacheAdapter, storageProvider);

  // Create GoogleCalendarService with real calendar provider
  const googleCalendarService = new GoogleCalendarService(calendarProvider);

  // Create scheduling repositories and service with real Prisma
  const serviceRepo = new PrismaServiceRepository(prisma);
  const availabilityRuleRepo = new PrismaAvailabilityRuleRepository(prisma);
  const schedulingAvailabilityService = new SchedulingAvailabilityService(
    serviceRepo,
    availabilityRuleRepo,
    bookingRepo,
    googleCalendarService, // Two-way sync with Google Calendar
    cacheAdapter // Cache for Google Calendar busy times (5 min TTL)
  );

  // Create PackageDraftService with real catalog repository
  const packageDraftService = new PackageDraftService(catalogRepo, cacheAdapter);

  // Create LandingPageService with real tenant repository
  const landingPageService = new LandingPageService(tenantRepo);

  // Create ReminderService with real adapters
  const reminderService = new ReminderService(bookingRepo, catalogRepo, eventEmitter);

  // Create WebhookDeliveryService for outbound webhook delivery (TODO-278)
  const webhookDeliveryService = new WebhookDeliveryService(webhookSubscriptionRepo, eventEmitter);

  // Create HealthCheckService with real adapters
  const healthCheckService = new HealthCheckService({
    stripeAdapter: paymentProvider,
    mailAdapter: mailProvider,
    calendarAdapter: calendarProvider,
  });

  // ============================================================================
  // Event Subscriptions - Type-safe event handlers
  // ============================================================================
  // Note: Type annotations are not needed on subscribe() calls because the
  // EventEmitter interface enforces type safety based on the event name.
  // The payload parameter is automatically typed based on AllEventPayloads.

  // Subscribe to BookingPaid events to send confirmation emails
  eventEmitter.subscribe(BookingEvents.PAID, async (payload) => {
    try {
      await mailProvider.sendBookingConfirm(payload.email, {
        eventDate: payload.eventDate,
        packageTitle: payload.packageTitle,
        totalCents: payload.totalCents,
        addOnTitles: payload.addOnTitles,
      });
    } catch (err) {
      logger.error(
        { err, bookingId: payload.bookingId },
        'Failed to send booking confirmation email'
      );
    }
  });

  // Subscribe to BookingReminderDue events to send reminder emails (Phase 2)
  eventEmitter.subscribe(BookingEvents.REMINDER_DUE, async (payload) => {
    try {
      await mailProvider.sendBookingReminder(payload.email, {
        coupleName: payload.coupleName,
        eventDate: payload.eventDate,
        packageTitle: payload.packageTitle,
        daysUntilEvent: payload.daysUntilEvent,
        manageUrl: payload.manageUrl,
      });
      logger.info({ bookingId: payload.bookingId }, 'Booking reminder email sent');
    } catch (err) {
      logger.error({ err, bookingId: payload.bookingId }, 'Failed to send booking reminder email');
    }
  });

  // Subscribe to AppointmentBooked events to sync with Google Calendar
  eventEmitter.subscribe(AppointmentEvents.BOOKED, async (payload) => {
    try {
      // Sync appointment to Google Calendar
      const result = await googleCalendarService.createAppointmentEvent(payload.tenantId, {
        id: payload.bookingId,
        serviceName: payload.serviceName,
        clientName: payload.clientName,
        clientEmail: payload.clientEmail,
        startTime: new Date(payload.startTime),
        endTime: new Date(payload.endTime),
        notes: payload.notes,
        timezone: payload.timezone,
      });

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

  // Subscribe to BookingCancelled events to delete from Google Calendar
  eventEmitter.subscribe(BookingEvents.CANCELLED, async (payload) => {
    try {
      if (payload.googleEventId) {
        const deleted = await googleCalendarService.cancelAppointmentEvent(
          payload.tenantId,
          payload.googleEventId
        );
        if (deleted) {
          logger.info(
            { bookingId: payload.bookingId, googleEventId: payload.googleEventId },
            'Deleted Google Calendar event for cancelled booking'
          );
        }
      }
    } catch (err) {
      // Log error but don't fail the cancellation - calendar sync is non-critical
      logger.error(
        { err, bookingId: payload.bookingId },
        'Failed to delete Google Calendar event for cancelled booking'
      );
    }
  });

  // Create webhook queue for async processing (will be initialized in index.ts)
  const webhookQueue = createWebhookQueue();

  // Build controllers
  const controllers = {
    packages: new PackagesController(catalogService),
    availability: new AvailabilityController(availabilityService),
    bookings: new BookingsController(bookingService),
    webhooks: new WebhooksController(
      paymentProvider,
      bookingService,
      webhookRepo,
      webhookQueue,
      tenantRepo
    ),
    admin: new AdminController(identityService, bookingService),
    blackouts: new BlackoutsController(blackoutRepo),
    adminPackages: new AdminPackagesController(catalogService),
    platformAdmin: new PlatformAdminController(prisma),
    tenant: new TenantController(tenantRepo),
    tenantAuth: new TenantAuthController(tenantAuthService),
    // No dev controller in real mode
  };

  // Agent evaluation services (uses extracted helper to avoid duplication)
  // P1-583 FIX: Use factory functions for proper DI (dependencies before config)
  const evaluationServices = buildEvaluationServices(prisma, 'real');

  const services = {
    identity: identityService,
    stripeConnect: stripeConnectService,
    tenantAuth: tenantAuthService,
    catalog: catalogService,
    booking: bookingService,
    availability: availabilityService,
    audit: auditService,
    segment: segmentService,
    tenantOnboarding: tenantOnboardingService,
    tenantProvisioning: tenantProvisioningService,
    googleCalendar: googleCalendarService,
    schedulingAvailability: schedulingAvailabilityService,
    packageDraft: packageDraftService,
    reminder: reminderService,
    landingPage: landingPageService,
    webhookDelivery: webhookDeliveryService,
    evaluation: evaluationServices,
  };

  // Create EarlyAccessRepository for early access request persistence
  const earlyAccessRepo = new PrismaEarlyAccessRepository(prisma);

  // Create AdvisorMemoryRepository for onboarding agent
  const advisorMemoryRepo = new PrismaAdvisorMemoryRepository(prisma);

  const repositories = {
    service: serviceRepo,
    availabilityRule: availabilityRuleRepo,
    booking: bookingRepo,
    catalog: catalogRepo,
    webhookSubscription: webhookSubscriptionRepo,
    earlyAccess: earlyAccessRepo,
    advisorMemory: advisorMemoryRepo, // Onboarding agent state projection
  };

  // Cleanup function for real mode
  const cleanup = async (): Promise<void> => {
    logger.info('Starting DI container cleanup (real mode)');

    try {
      // 1. Stop webhook queue (stop accepting new jobs, wait for current to finish)
      if (webhookQueue) {
        await webhookQueue.shutdown();
        logger.info('Webhook queue shutdown');
      }

      // 2. Stop idempotency cleanup scheduler
      await idempotencyService.stopCleanupScheduler();
      logger.info('Idempotency cleanup scheduler stopped');

      // 3. Disconnect Prisma
      if (prisma) {
        await prisma.$disconnect();
        logger.info('Prisma disconnected');
      }

      // 4. Disconnect cache adapter (Redis or in-memory)
      if (cacheAdapter && 'disconnect' in cacheAdapter) {
        await (cacheAdapter as any).disconnect();
        logger.info('Cache adapter disconnected');
      }

      // 5. Clear event emitter subscriptions to prevent memory leaks
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
    storageProvider,
    cacheAdapter,
    healthCheckService,
    prisma,
    eventEmitter,
    webhookQueue,
    stripeAdapter: paymentProvider, // For billing routes
    cleanup,
  };
}
