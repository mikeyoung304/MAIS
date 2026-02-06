/**
 * Internal Agent Routes
 *
 * Protected endpoints for agent-to-backend communication.
 * Called by deployed Vertex AI agents (tenant-agent, customer-agent, research-agent) to fetch tenant data.
 *
 * Security:
 * - Secured with X-Internal-Secret header (shared secret)
 * - All endpoints require tenantId in request body
 * - All queries are tenant-scoped to prevent data leakage
 *
 * TENANT AGENT Endpoints (Bootstrap/Discovery):
 * - POST /v1/internal/agent/bootstrap - Get session context (tenant, onboarding state, discovery data)
 * - POST /v1/internal/agent/complete-onboarding - Mark onboarding as complete
 * - POST /v1/internal/agent/store-discovery-fact - Store a fact learned during onboarding
 * - POST /v1/internal/agent/get-discovery-facts - Get all stored discovery facts for a tenant
 *
 * CUSTOMER AGENT Endpoints (Booking):
 * - POST /v1/internal/agent/services - Get all services for a tenant
 * - POST /v1/internal/agent/service-details - Get service details by ID
 * - POST /v1/internal/agent/availability - Check availability for a service
 * - POST /v1/internal/agent/business-info - Get tenant business info
 * - POST /v1/internal/agent/faq - Answer FAQ question
 * - POST /v1/internal/agent/recommend - Recommend packages based on preferences
 * - POST /v1/internal/agent/create-booking - Create a booking (T3 action)
 *
 * TENANT AGENT Endpoints (Storefront):
 * - POST /v1/internal/agent/storefront/structure - Get page structure with section IDs
 * - POST /v1/internal/agent/storefront/section - Get section content by ID
 * - POST /v1/internal/agent/storefront/update-section - Update section content
 * - POST /v1/internal/agent/storefront/add-section - Add a new section
 * - POST /v1/internal/agent/storefront/remove-section - Remove a section
 * - POST /v1/internal/agent/storefront/reorder-sections - Move a section
 * - POST /v1/internal/agent/storefront/toggle-page - Enable/disable a page
 * - POST /v1/internal/agent/storefront/update-branding - Update branding colors/fonts
 * - POST /v1/internal/agent/storefront/preview - Get preview URL
 * - POST /v1/internal/agent/storefront/publish - Publish draft to live
 * - POST /v1/internal/agent/storefront/discard - Discard draft changes
 *
 * PROJECT HUB Endpoints (used by both tenant-agent and customer-agent):
 * - POST /v1/internal/agent/project-hub/bootstrap-customer - Initialize customer session
 * - POST /v1/internal/agent/project-hub/bootstrap-tenant - Initialize tenant dashboard
 * - POST /v1/internal/agent/project-hub/project-details - Get project with booking info
 * - POST /v1/internal/agent/project-hub/timeline - Get project timeline events
 * - POST /v1/internal/agent/project-hub/pending-requests - Get pending requests for tenant
 * - POST /v1/internal/agent/project-hub/create-request - Create a customer request
 * - POST /v1/internal/agent/project-hub/approve-request - Approve request (optimistic locking)
 * - POST /v1/internal/agent/project-hub/deny-request - Deny request (optimistic locking)
 * - POST /v1/internal/agent/project-hub/list-projects - List all projects for tenant
 *
 * TENANT AGENT Endpoints (Vocabulary):
 * - POST /v1/internal/agent/vocabulary/resolve - Resolve phrase to BlockType using semantic search
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { z, ZodError } from 'zod';
import { LRUCache } from 'lru-cache';
import { logger } from '../lib/core/logger';
import type { CatalogService } from '../services/catalog.service';
import type { SchedulingAvailabilityService } from '../services/scheduling-availability.service';
import type { BookingService } from '../services/booking.service';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { ServiceRepository } from '../lib/ports';
import type { ContextBuilderService } from '../services/context-builder.service';
import type { ProjectHubService } from '../services/project-hub.service';
import type { VocabularyEmbeddingService } from '../services/vocabulary-embedding.service';
import type { SectionContentService } from '../services/section-content.service';
// NOTE: DEFAULT_PAGES_CONFIG import removed - storefront endpoints now use SectionContentService
// which reads from SectionContent table (seeded at tenant provisioning)
// NOTE: createPublishedWrapper import removed - agent routes now delegate to repository methods
// which handle the wrapper format internally. See: CODE_PATH_DRIFT_PREVENTION.md
import { ConcurrentModificationError, NotFoundError, ValidationError } from '../lib/errors';
import type { OnboardingPhase } from '../generated/prisma/enums';

// =============================================================================
// Request Schemas
// =============================================================================

const TenantIdSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
});

const GetServicesSchema = TenantIdSchema.extend({
  category: z.string().optional(),
  activeOnly: z.boolean().default(true),
});

const GetServiceDetailsSchema = TenantIdSchema.extend({
  serviceId: z.string().min(1, 'serviceId is required'),
});

const CheckAvailabilitySchema = TenantIdSchema.extend({
  serviceId: z.string().min(1, 'serviceId is required'),
  startDate: z.string().min(1, 'startDate is required'),
  endDate: z.string().min(1, 'endDate is required'),
});

const AnswerFaqSchema = TenantIdSchema.extend({
  question: z.string().min(1, 'question is required'),
});

// Vocabulary Resolution (for Tenant Agent)
const ResolveVocabularySchema = z.object({
  phrase: z.string().min(1).max(200, 'phrase must be 200 characters or less'),
  tenantId: z.string().optional(), // Optional for logging/analytics
});

const RecommendPackageSchema = TenantIdSchema.extend({
  preferences: z.object({
    budget: z.enum(['low', 'medium', 'high']).optional(),
    occasion: z.string().optional(),
    groupSize: z.number().optional(),
  }),
});

const CreateBookingSchema = TenantIdSchema.extend({
  serviceId: z.string().min(1, 'serviceId is required'),
  customerName: z.string().min(1, 'customerName is required'),
  customerEmail: z.string().email('Valid email is required'),
  customerPhone: z.string().optional(),
  scheduledAt: z.string().min(1, 'scheduledAt is required'),
  notes: z.string().optional(),
});

// =============================================================================
// Storefront Agent Schemas
// =============================================================================

const PAGE_NAMES = [
  'home',
  'about',
  'services',
  'faq',
  'contact',
  'gallery',
  'testimonials',
] as const;
const SECTION_TYPES = [
  'hero',
  'text',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'features',
] as const;

const GetPageStructureSchema = TenantIdSchema.extend({
  pageName: z.enum(PAGE_NAMES).optional(),
  includeOnlyPlaceholders: z.boolean().optional(),
});

const GetSectionContentSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
});

const UpdateSectionSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  content: z.string().optional(),
  ctaText: z.string().optional(),
  backgroundImageUrl: z.string().optional(),
  imageUrl: z.string().optional(),
});

const AddSectionSchema = TenantIdSchema.extend({
  pageName: z.enum(PAGE_NAMES),
  sectionType: z.enum(SECTION_TYPES),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  content: z.string().optional(),
  ctaText: z.string().optional(),
  position: z.number().optional(),
});

const RemoveSectionSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
});

const ReorderSectionsSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
  toPosition: z.number().min(0),
});

// TogglePageSchema DELETED - multi-page toggles not needed for single long-scroll pages
// See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md

const UpdateBrandingSchema = TenantIdSchema.extend({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logoUrl: z.string().optional(),
});

// Section-level publish/discard schemas (Phase 3: Section Content Migration)
const PublishSectionSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
  confirmationReceived: z.boolean(),
});

const DiscardSectionSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
  confirmationReceived: z.boolean(),
});

// Guided Refinement - Section Variant Generation
const TONE_VARIANTS = ['professional', 'premium', 'friendly'] as const;
const GenerateSectionVariantsSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
  sectionType: z.enum(SECTION_TYPES),
  currentContent: z.object({
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    content: z.string().optional(),
    ctaText: z.string().optional(),
  }),
  tones: z.array(z.enum(TONE_VARIANTS)).default(['professional', 'premium', 'friendly']),
});

// =============================================================================
// Route Factory
// =============================================================================

interface InternalAgentRoutesDeps {
  internalApiSecret?: string;
  catalogService: CatalogService;
  schedulingAvailabilityService?: SchedulingAvailabilityService;
  bookingService: BookingService;
  tenantRepo: PrismaTenantRepository;
  serviceRepo?: ServiceRepository;
  contextBuilder?: ContextBuilderService;
  projectHubService?: ProjectHubService;
  vocabularyEmbeddingService?: VocabularyEmbeddingService;
  sectionContentService?: SectionContentService;
}

/**
 * Create internal agent routes
 *
 * @param deps - Dependencies including services and config
 * @returns Express router with internal agent endpoints
 */
export function createInternalAgentRoutes(deps: InternalAgentRoutesDeps): Router {
  const router = Router();

  const {
    internalApiSecret,
    catalogService,
    schedulingAvailabilityService,
    bookingService,
    tenantRepo,
    serviceRepo,
    contextBuilder,
    projectHubService,
    vocabularyEmbeddingService,
    sectionContentService,
  } = deps;

  // ===========================================================================
  // Authentication Middleware
  // ===========================================================================

  /**
   * Middleware to verify internal API secret
   * Uses X-Internal-Secret header (as defined in the booking agent)
   */
  const verifyInternalSecret = (req: Request, res: Response, next: NextFunction): void => {
    const secret = req.headers['x-internal-secret'];
    const expectedSecret = internalApiSecret;

    // If no secret configured, reject all requests (fail-safe)
    if (!expectedSecret) {
      logger.warn('Internal API secret not configured - rejecting agent request');
      res.status(503).json({
        error: 'Internal API not configured',
      });
      return;
    }

    // Verify secret matches using constant-time comparison to prevent timing attacks
    // timingSafeEqual requires equal-length buffers, so we check length first
    const secretStr = typeof secret === 'string' ? secret : '';
    const secretBuffer = Buffer.from(secretStr);
    const expectedBuffer = Buffer.from(expectedSecret);

    if (
      secretBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(secretBuffer, expectedBuffer)
    ) {
      logger.warn({ ip: req.ip }, 'Invalid internal API secret from agent');
      res.status(403).json({
        error: 'Invalid API secret',
      });
      return;
    }

    next();
  };

  // Apply auth to all routes
  router.use(verifyInternalSecret);

  // ===========================================================================
  // BOOTSTRAP CACHE - LRU with 30-minute TTL, 1000 max entries
  // ===========================================================================

  interface BootstrapData {
    tenantId: string;
    businessName: string;
    industry: string | null;
    tier: string;
    onboardingDone: boolean;
    discoveryData: Record<string, unknown> | null;
  }

  const bootstrapCache = new LRUCache<string, BootstrapData>({
    max: 1000,
    ttl: 30 * 60 * 1000, // 30 minutes
  });

  /**
   * Invalidate bootstrap cache for a tenant.
   * Called after onboarding completion or significant changes.
   */
  function invalidateBootstrapCache(tenantId: string): void {
    bootstrapCache.delete(tenantId);
  }

  // ===========================================================================
  // GREETING STATE CACHE - Issue #5 Fix: Prevents infinite "Welcome back" loop
  //
  // ADK context.state.set() does NOT persist between turns, so we track
  // greeting state in the backend using compound key: tenantId:sessionId
  // ===========================================================================

  /**
   * Cache of greeted sessions to prevent duplicate greetings
   * Key format: `${tenantId}:${sessionId}`
   * Value: timestamp when greeted
   */
  const greetedSessionsCache = new LRUCache<string, number>({
    max: 5000, // More sessions than tenants (many sessions per tenant)
    ttl: 60 * 60 * 1000, // 1 hour TTL - sessions rarely last longer
  });

  /**
   * Build compound key for greeting state
   */
  function buildGreetingKey(tenantId: string, sessionId: string): string {
    return `${tenantId}:${sessionId}`;
  }

  /**
   * Check if a session has been greeted
   */
  function hasSessionBeenGreeted(tenantId: string, sessionId: string): boolean {
    return greetedSessionsCache.has(buildGreetingKey(tenantId, sessionId));
  }

  /**
   * Mark a session as greeted
   */
  function markSessionGreeted(tenantId: string, sessionId: string): void {
    greetedSessionsCache.set(buildGreetingKey(tenantId, sessionId), Date.now());
  }

  // ===========================================================================
  // POST /bootstrap - Session context for Concierge agent
  // Returns tenant context with onboarding state and discovery data
  // ===========================================================================

  // Extended schema for bootstrap - now includes optional sessionId for greeting tracking
  const BootstrapRequestSchema = TenantIdSchema.extend({
    sessionId: z.string().optional(), // Issue #5 Fix: Track greeting state per session
  });

  router.post('/bootstrap', async (req: Request, res: Response) => {
    try {
      const { tenantId, sessionId } = BootstrapRequestSchema.parse(req.body);

      logger.info({ tenantId, sessionId, endpoint: '/bootstrap' }, '[Agent] Bootstrap request');

      // Check if session has been greeted (Issue #5 Fix)
      const hasBeenGreeted = sessionId ? hasSessionBeenGreeted(tenantId, sessionId) : false;

      // Check cache first (LRU handles TTL automatically)
      const cached = bootstrapCache.get(tenantId);
      if (cached) {
        logger.info(
          { tenantId, sessionId, cached: true, hasBeenGreeted },
          '[Agent] Bootstrap cache hit'
        );
        // Return cached data + session-specific greeting state
        res.json({ ...cached, hasBeenGreeted });
        return;
      }

      // Fetch tenant data
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Get discovery data from ContextBuilder (single source of truth)
      // This replaces the legacy AdvisorMemoryService approach
      let discoveryData: Record<string, unknown> | null = null;
      if (contextBuilder) {
        try {
          const bootstrapData = await contextBuilder.getBootstrapData(tenantId);
          discoveryData = bootstrapData.discoveryFacts;
        } catch (error) {
          // Graceful degradation - continue without discovery data
          logger.warn(
            { tenantId, error: error instanceof Error ? error.message : String(error) },
            '[Agent] Failed to fetch context, continuing without discovery data'
          );
        }
      }

      // Fallback: Extract branding and discovery facts directly if contextBuilder unavailable
      const branding = (tenant.branding as Record<string, unknown>) || {};
      const brandingDiscoveryFacts = (branding.discoveryFacts as Record<string, unknown>) || {};

      // Use contextBuilder data or fallback to branding.discoveryFacts
      const mergedDiscoveryData =
        discoveryData ||
        (Object.keys(brandingDiscoveryFacts).length > 0 ? brandingDiscoveryFacts : null);

      // Extract industry from discovery data or branding
      const industry =
        (mergedDiscoveryData?.businessType as string) || (branding.industry as string) || null;

      // Build bootstrap response
      const bootstrapResponse = {
        tenantId: tenant.id,
        businessName: tenant.name,
        industry,
        tier: tenant.tier || 'FREE',
        onboardingDone:
          tenant.onboardingPhase === 'COMPLETED' || tenant.onboardingPhase === 'SKIPPED',
        discoveryData: mergedDiscoveryData,
      };

      // Cache response (LRU handles max size and TTL automatically)
      bootstrapCache.set(tenantId, bootstrapResponse);

      logger.info(
        {
          tenantId,
          sessionId,
          onboardingDone: bootstrapResponse.onboardingDone,
          hasBeenGreeted,
          cached: false,
        },
        '[Agent] Bootstrap response'
      );
      // Return cached tenant data + session-specific greeting state
      res.json({ ...bootstrapResponse, hasBeenGreeted });
    } catch (error) {
      handleError(res, error, '/bootstrap');
    }
  });

  // ===========================================================================
  // POST /mark-greeted - Issue #5 Fix: Mark session as greeted
  // Called by Concierge agent AFTER sending greeting to prevent repeat greetings
  // ===========================================================================

  const MarkGreetedSchema = TenantIdSchema.extend({
    sessionId: z.string().min(1),
  });

  router.post('/mark-greeted', async (req: Request, res: Response) => {
    try {
      const { tenantId, sessionId } = MarkGreetedSchema.parse(req.body);

      logger.info(
        { tenantId, sessionId, endpoint: '/mark-greeted' },
        '[Agent] Mark greeted request'
      );

      // Mark this session as greeted
      markSessionGreeted(tenantId, sessionId);

      res.json({ success: true, message: 'Session marked as greeted' });
    } catch (error) {
      handleError(res, error, '/mark-greeted');
    }
  });

  // ===========================================================================
  // POST /complete-onboarding - Mark onboarding as complete
  // Called by Concierge when user publishes their storefront
  // ===========================================================================

  const CompleteOnboardingSchema = TenantIdSchema.extend({
    publishedUrl: z.string().optional(),
    packagesCreated: z.number().optional(),
    summary: z.string().optional(),
  });

  router.post('/complete-onboarding', async (req: Request, res: Response) => {
    try {
      const { tenantId, publishedUrl, packagesCreated, summary } = CompleteOnboardingSchema.parse(
        req.body
      );

      logger.info(
        { tenantId, publishedUrl, packagesCreated, endpoint: '/complete-onboarding' },
        '[Agent] Completing onboarding'
      );

      // Fetch tenant to check current state (optimistic locking)
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Check if already completed (idempotent response)
      if (tenant.onboardingPhase === 'COMPLETED') {
        logger.info(
          { tenantId, endpoint: '/complete-onboarding' },
          '[Agent] Onboarding already completed - returning idempotent response'
        );
        res.json({
          success: true,
          wasAlreadyComplete: true,
          message: 'Onboarding was already completed',
          completedAt: tenant.onboardingCompletedAt?.toISOString() || null,
        });
        return;
      }

      // Validate prerequisites: at least one package must exist
      const packages = await catalogService.getAllPackages(tenantId);
      if (packages.length === 0) {
        logger.warn(
          { tenantId, endpoint: '/complete-onboarding' },
          '[Agent] Blocked onboarding completion - no packages exist'
        );
        res.status(400).json({
          error: 'Cannot complete onboarding without at least one package',
          suggestion: 'Create a service package first using the storefront tools',
          prerequisite: 'packages',
          required: 1,
          actual: 0,
        });
        return;
      }

      // Update tenant onboarding phase
      const completedAt = new Date();
      await tenantRepo.update(tenantId, {
        onboardingPhase: 'COMPLETED',
        onboardingCompletedAt: completedAt,
      });

      // Invalidate bootstrap cache so next request gets fresh data
      invalidateBootstrapCache(tenantId);

      res.json({
        success: true,
        wasAlreadyComplete: false,
        message: publishedUrl
          ? `Onboarding complete! Live at ${publishedUrl}`
          : 'Onboarding marked as complete.',
        completedAt: completedAt.toISOString(),
        ...(packagesCreated !== undefined && { packagesCreated }),
        ...(summary && { summary }),
      });
    } catch (error) {
      handleError(res, error, '/complete-onboarding');
    }
  });

  // ===========================================================================
  // POST /store-discovery-fact - Store a fact learned during onboarding
  // Called by Concierge when it learns something about the business
  // ===========================================================================

  // NOTE: Keep in sync with server/src/agent-v2/deploy/tenant/src/tools/discovery.ts
  const DISCOVERY_FACT_KEYS = [
    'businessType',
    'businessName',
    'location',
    'targetMarket',
    'priceRange',
    'yearsInBusiness',
    'teamSize',
    'uniqueValue',
    'servicesOffered',
    'specialization',
    'approach',
    'dreamClient',
    'testimonial',
    'faq',
    'contactInfo',
  ] as const;

  const StoreDiscoveryFactSchema = TenantIdSchema.extend({
    key: z.enum(DISCOVERY_FACT_KEYS),
    value: z.unknown(),
  });

  /**
   * Compute onboarding phase from known fact keys.
   * Phases advance monotonically based on which facts have been gathered.
   */
  function computeCurrentPhase(knownFactKeys: string[]): OnboardingPhase {
    const has = (key: string) => knownFactKeys.includes(key);

    // MARKETING requires: uniqueValue OR testimonial
    if (has('uniqueValue') || has('testimonial')) return 'MARKETING';

    // SERVICES requires: servicesOffered OR priceRange
    if (has('servicesOffered') || has('priceRange')) return 'SERVICES';

    // MARKET_RESEARCH requires: location (triggers research agent)
    if (has('location')) return 'MARKET_RESEARCH';

    // DISCOVERY requires: businessType
    if (has('businessType')) return 'DISCOVERY';

    return 'NOT_STARTED';
  }

  const PHASE_ORDER: Record<string, number> = {
    NOT_STARTED: 0,
    DISCOVERY: 1,
    MARKET_RESEARCH: 2,
    SERVICES: 3,
    MARKETING: 4,
    COMPLETED: 5,
    SKIPPED: 5,
  };

  router.post('/store-discovery-fact', async (req: Request, res: Response) => {
    try {
      const { tenantId, key, value } = StoreDiscoveryFactSchema.parse(req.body);

      logger.info(
        { tenantId, key, endpoint: '/store-discovery-fact' },
        '[Agent] Storing discovery fact'
      );

      // Agent-First Architecture: Store discovery facts directly in tenant.branding.discoveryFacts
      // This is the canonical storage location. ContextBuilder reads from here.

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Store in branding.discoveryFacts for now (simple approach)
      const branding = (tenant.branding as Record<string, unknown>) || {};
      const discoveryFacts = (branding.discoveryFacts as Record<string, unknown>) || {};
      discoveryFacts[key] = value;

      await tenantRepo.update(tenantId, {
        branding: { ...branding, discoveryFacts },
      });

      // Compute phase advancement from fact inventory
      const knownFactKeys = Object.keys(discoveryFacts);
      const newPhase = computeCurrentPhase(knownFactKeys);
      const currentPhase = (tenant.onboardingPhase as string) || 'NOT_STARTED';
      const phaseAdvanced = (PHASE_ORDER[newPhase] ?? 0) > (PHASE_ORDER[currentPhase] ?? 0);

      // Advance phase if needed (monotonic — never moves backward)
      if (phaseAdvanced) {
        await tenantRepo.update(tenantId, {
          onboardingPhase: newPhase,
        });
        logger.info(
          { tenantId, from: currentPhase, to: newPhase },
          '[Agent] Onboarding phase advanced'
        );
      }

      // Invalidate bootstrap cache so next request gets updated facts
      invalidateBootstrapCache(tenantId);

      // Return updated facts list + phase info so agent knows what it knows
      res.json({
        stored: true,
        key,
        value,
        totalFactsKnown: knownFactKeys.length,
        knownFactKeys,
        currentPhase: phaseAdvanced ? newPhase : currentPhase,
        phaseAdvanced,
        message: `Stored ${key} successfully. Now know: ${knownFactKeys.join(', ')}`,
      });
    } catch (error) {
      handleError(res, error, '/store-discovery-fact');
    }
  });

  // ===========================================================================
  // POST /get-discovery-facts - Get all stored discovery facts for a tenant
  // Called by Concierge to check what it knows without re-bootstrapping
  // ===========================================================================

  router.post('/get-discovery-facts', async (req: Request, res: Response) => {
    try {
      const { tenantId } = TenantIdSchema.parse(req.body);

      logger.info(
        { tenantId, endpoint: '/get-discovery-facts' },
        '[Agent] Fetching discovery facts'
      );

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Extract discovery facts from branding
      const branding = (tenant.branding as Record<string, unknown>) || {};
      const discoveryFacts = (branding.discoveryFacts as Record<string, unknown>) || {};
      const factKeys = Object.keys(discoveryFacts);

      res.json({
        success: true,
        facts: discoveryFacts,
        factCount: factKeys.length,
        factKeys,
        message:
          factKeys.length > 0 ? `Known facts: ${factKeys.join(', ')}` : 'No facts stored yet.',
      });
    } catch (error) {
      handleError(res, error, '/get-discovery-facts');
    }
  });

  // ===========================================================================
  // POST /services - Get all services for a tenant
  // ===========================================================================

  router.post('/services', async (req: Request, res: Response) => {
    try {
      const { tenantId, activeOnly } = GetServicesSchema.parse(req.body);

      logger.info({ tenantId, endpoint: '/services' }, '[Agent] Fetching services');

      // Get packages (which are services in HANDLED terminology)
      const packages = await catalogService.getAllPackages(tenantId);

      // Filter inactive if requested
      const filtered = activeOnly ? packages.filter((p) => p.active !== false) : packages;

      // Map to agent-friendly format
      const services = filtered.map((pkg) => ({
        id: pkg.id,
        slug: pkg.slug,
        name: pkg.title,
        description: pkg.description,
        priceCents: pkg.priceCents,
        bookingType: pkg.bookingType || 'DATE',
        photoUrl: pkg.photoUrl || null,
        addOns:
          pkg.addOns?.map((addon) => ({
            id: addon.id,
            name: addon.title,
            priceCents: addon.priceCents,
          })) || [],
      }));

      res.json({ services });
    } catch (error) {
      handleError(res, error, '/services');
    }
  });

  // ===========================================================================
  // POST /service-details - Get detailed info about a specific service
  // ===========================================================================

  router.post('/service-details', async (req: Request, res: Response) => {
    try {
      const { tenantId, serviceId } = GetServiceDetailsSchema.parse(req.body);

      logger.info(
        { tenantId, serviceId, endpoint: '/service-details' },
        '[Agent] Fetching service details'
      );

      // Try to get package by ID
      const pkg = await catalogService.getPackageById(tenantId, serviceId);

      if (!pkg) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      // Get full package with add-ons
      const fullPackage = await catalogService.getPackageBySlug(tenantId, pkg.slug);

      res.json({
        id: fullPackage.id,
        slug: fullPackage.slug,
        name: fullPackage.title,
        description: fullPackage.description,
        priceCents: fullPackage.priceCents,
        photoUrl: fullPackage.photoUrl || null,
        bookingType: fullPackage.bookingType || 'DATE',
        depositAmount: fullPackage.depositAmount || null,
        addOns:
          fullPackage.addOns?.map((addon) => ({
            id: addon.id,
            name: addon.title,
            description: addon.description || null,
            priceCents: addon.priceCents,
          })) || [],
      });
    } catch (error) {
      handleError(res, error, '/service-details');
    }
  });

  // ===========================================================================
  // POST /availability - Check availability for a service
  // ===========================================================================

  router.post('/availability', async (req: Request, res: Response) => {
    try {
      const { tenantId, serviceId, startDate, endDate } = CheckAvailabilitySchema.parse(req.body);

      logger.info(
        { tenantId, serviceId, startDate, endDate, endpoint: '/availability' },
        '[Agent] Checking availability'
      );

      // Try to find the service in both Service repository (TIMESLOT) and Catalog (DATE/packages)
      // Services in ServiceRepository are always TIMESLOT type
      if (schedulingAvailabilityService && serviceRepo) {
        const service = await serviceRepo.getById(tenantId, serviceId);

        if (service) {
          // Service found in ServiceRepository - it's a TIMESLOT service
          // Generate slots for each day in the range
          const start = new Date(startDate);
          const end = new Date(endDate);
          const slots: Array<{
            date: string;
            startTime: string;
            endTime: string;
            available: boolean;
          }> = [];

          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const daySlots = await schedulingAvailabilityService.getAvailableSlots({
              tenantId,
              serviceId,
              date: new Date(d),
            });

            for (const slot of daySlots) {
              slots.push({
                date: d.toISOString().split('T')[0],
                startTime: slot.startTime.toISOString(),
                endTime: slot.endTime.toISOString(),
                available: slot.available,
              });
            }
          }

          res.json({ bookingType: 'TIMESLOT', slots });
          return;
        }
      }

      // Default: DATE-based availability (weddings, events)
      // For now, return simplified availability
      // TODO: Integrate with AvailabilityService for DATE bookings
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dates: Array<{ date: string; available: boolean }> = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push({
          date: d.toISOString().split('T')[0],
          available: true, // TODO: Check against bookings and blackouts
        });
      }

      res.json({ bookingType: 'DATE', dates });
    } catch (error) {
      handleError(res, error, '/availability');
    }
  });

  // ===========================================================================
  // POST /business-info - Get tenant business information
  // ===========================================================================

  router.post('/business-info', async (req: Request, res: Response) => {
    try {
      const { tenantId } = TenantIdSchema.parse(req.body);

      logger.info({ tenantId, endpoint: '/business-info' }, '[Agent] Fetching business info');

      const tenant = await tenantRepo.findById(tenantId);

      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Extract business info from tenant and branding
      const branding = (tenant.branding as Record<string, unknown>) || {};

      res.json({
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email || null,
        phone: branding.phone || null,
        location: branding.location || branding.address || null,
        timezone: branding.timezone || 'America/New_York',
        website: branding.website || `https://gethandled.ai/t/${tenant.slug}`,
        description: branding.tagline || branding.description || null,
        hours: branding.businessHours || null,
        // Policies
        cancellationPolicy: branding.cancellationPolicy || null,
        // Social links
        instagram: branding.instagram || null,
        facebook: branding.facebook || null,
      });
    } catch (error) {
      handleError(res, error, '/business-info');
    }
  });

  // ===========================================================================
  // POST /faq - Answer FAQ question
  // ===========================================================================

  router.post('/faq', async (req: Request, res: Response) => {
    try {
      const { tenantId, question } = AnswerFaqSchema.parse(req.body);

      logger.info(
        { tenantId, question: question.substring(0, 50), endpoint: '/faq' },
        '[Agent] Answering FAQ'
      );

      const tenant = await tenantRepo.findById(tenantId);

      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Phase 5.2: FAQs now stored in SectionContent table under FAQ block type
      // TODO: Extract FAQs from SectionContentService when FAQ section exists
      // For now, return empty array as FAQs are managed via section-level operations
      const faqs: Array<{ question: string; answer: string }> = [];

      // Simple keyword matching for FAQ lookup
      // In production, this could use embeddings/vector search
      const questionLower = question.toLowerCase();
      const matchedFaq = faqs.find((faq) => {
        const faqQuestion = faq.question.toLowerCase();
        // Check for keyword overlap
        const questionWords = questionLower.split(/\s+/).filter((w) => w.length > 3);
        const faqWords = faqQuestion.split(/\s+/).filter((w) => w.length > 3);
        const overlap = questionWords.filter((w) =>
          faqWords.some((fw) => fw.includes(w) || w.includes(fw))
        );
        return (
          overlap.length >= 2 ||
          faqQuestion.includes(questionLower) ||
          questionLower.includes(faqQuestion)
        );
      });

      if (matchedFaq) {
        res.json({
          found: true,
          answer: matchedFaq.answer,
          confidence: 0.8,
          sourceQuestion: matchedFaq.question,
        });
      } else {
        // Return all FAQs so agent can choose
        res.json({
          found: false,
          answer: null,
          confidence: 0,
          availableFaqs: faqs.map((f) => f.question),
          suggestion:
            faqs.length > 0
              ? 'I found some related FAQs that might help.'
              : 'No FAQs are configured for this business yet.',
        });
      }
    } catch (error) {
      handleError(res, error, '/faq');
    }
  });

  // ===========================================================================
  // POST /recommend - Recommend packages based on preferences
  // ===========================================================================

  router.post('/recommend', async (req: Request, res: Response) => {
    try {
      const { tenantId, preferences } = RecommendPackageSchema.parse(req.body);

      logger.info(
        { tenantId, preferences, endpoint: '/recommend' },
        '[Agent] Getting recommendations'
      );

      const packages = await catalogService.getAllPackages(tenantId);

      // Filter active packages
      const activePackages = packages.filter((p) => p.active !== false);

      if (activePackages.length === 0) {
        res.json({
          recommendations: [],
          message: 'No packages available for recommendation.',
        });
        return;
      }

      // Simple recommendation logic based on budget
      let recommendations = [...activePackages];

      if (preferences.budget) {
        const prices = activePackages.map((p) => p.priceCents);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;

        const budgetRanges = {
          low: { min: minPrice, max: minPrice + priceRange * 0.33 },
          medium: { min: minPrice + priceRange * 0.33, max: minPrice + priceRange * 0.66 },
          high: { min: minPrice + priceRange * 0.66, max: maxPrice },
        };

        const range = budgetRanges[preferences.budget];
        recommendations = activePackages.filter(
          (p) => p.priceCents >= range.min && p.priceCents <= range.max
        );

        // If no exact matches, return closest options
        if (recommendations.length === 0) {
          recommendations = activePackages.slice(0, 3);
        }
      }

      // Sort by price (ascending for low budget, descending for high)
      recommendations.sort((a, b) =>
        preferences.budget === 'high' ? b.priceCents - a.priceCents : a.priceCents - b.priceCents
      );

      // Return top 3 recommendations
      res.json({
        recommendations: recommendations.slice(0, 3).map((pkg) => ({
          id: pkg.id,
          slug: pkg.slug,
          name: pkg.title,
          description: pkg.description,
          priceCents: pkg.priceCents,
          photoUrl: pkg.photoUrl || null,
          reason: getBudgetReason(preferences.budget, pkg.priceCents, activePackages),
        })),
      });
    } catch (error) {
      handleError(res, error, '/recommend');
    }
  });

  // ===========================================================================
  // POST /create-booking - Create a booking (T3 action requiring confirmation)
  // ===========================================================================

  router.post('/create-booking', async (req: Request, res: Response) => {
    try {
      const input = CreateBookingSchema.parse(req.body);
      const {
        tenantId,
        serviceId,
        customerName,
        customerEmail,
        customerPhone,
        scheduledAt,
        notes,
      } = input;

      logger.info(
        { tenantId, serviceId, customerEmail, scheduledAt, endpoint: '/create-booking' },
        '[Agent] Creating booking'
      );

      // Get service details to determine booking type
      const pkg = await catalogService.getPackageById(tenantId, serviceId);

      if (!pkg) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      // Extract date from scheduledAt
      const eventDate = scheduledAt.split('T')[0];

      // Create a date booking through the wedding booking orchestrator
      // This creates a Stripe checkout session for payment
      const result = await bookingService.createDateBooking(tenantId, {
        packageId: serviceId,
        date: eventDate,
        customerName,
        customerEmail,
        customerPhone: customerPhone || undefined,
        notes,
        addOnIds: [],
      });

      res.json({
        success: true,
        checkoutUrl: result.checkoutUrl,
        booking: {
          serviceName: pkg.title,
          customerName,
          customerEmail,
          scheduledAt: eventDate,
          totalCents: pkg.priceCents,
        },
        message: `Booking initiated! Please complete payment to confirm your booking.`,
      });
    } catch (error) {
      handleError(res, error, '/create-booking');
    }
  });

  // ===========================================================================
  // STOREFRONT AGENT ROUTES
  // ===========================================================================

  // POST /storefront/structure - Get page structure with section IDs
  // MIGRATED: Now uses SectionContentService instead of legacy JSON columns
  // See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
  router.post('/storefront/structure', async (req: Request, res: Response) => {
    try {
      const { tenantId, pageName, includeOnlyPlaceholders } = GetPageStructureSchema.parse(
        req.body
      );

      logger.info(
        { tenantId, pageName, endpoint: '/storefront/structure' },
        '[Agent] Getting page structure'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Get structure from SectionContentService
      const result = await sectionContentService.getPageStructure(tenantId, {
        pageName: pageName as
          | 'home'
          | 'about'
          | 'services'
          | 'faq'
          | 'contact'
          | 'gallery'
          | 'testimonials'
          | undefined,
      });

      // Transform to agent-friendly format
      let sections = result.pages.flatMap((page) =>
        page.sections.map((s) => ({
          id: s.sectionId,
          page: s.page,
          type: s.type,
          headline: s.headline || '',
          hasPlaceholder: s.isPlaceholder,
        }))
      );

      // Filter if requested
      if (includeOnlyPlaceholders) {
        sections = sections.filter((s) => s.hasPlaceholder);
      }

      res.json({
        sections,
        totalCount: sections.length,
        hasDraft: result.hasDraft,
        previewUrl: tenant.slug ? `/t/${tenant.slug}?preview=draft` : undefined,
      });
    } catch (error) {
      handleError(res, error, '/storefront/structure');
    }
  });

  // POST /storefront/section - Get section content by ID
  // MIGRATED: Now uses SectionContentService instead of legacy JSON columns
  // See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
  router.post('/storefront/section', async (req: Request, res: Response) => {
    try {
      const { tenantId, sectionId } = GetSectionContentSchema.parse(req.body);

      logger.info(
        { tenantId, sectionId, endpoint: '/storefront/section' },
        '[Agent] Getting section content'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const result = await sectionContentService.getSectionContent(tenantId, sectionId);
      if (!result) {
        res.status(404).json({ error: `Section '${sectionId}' not found` });
        return;
      }

      // Return in agent-friendly format matching legacy response shape
      res.json({
        section: result.section,
        page: result.page,
        index: result.index,
        hasDraft: result.isDraft,
      });
    } catch (error) {
      handleError(res, error, '/storefront/section');
    }
  });

  // POST /storefront/update-section - Update section content (saves to draft)
  // MIGRATED: Now uses SectionContentService instead of legacy JSON columns
  // See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
  router.post('/storefront/update-section', async (req: Request, res: Response) => {
    try {
      const { tenantId, sectionId, ...updates } = UpdateSectionSchema.parse(req.body);

      logger.info(
        { tenantId, sectionId, endpoint: '/storefront/update-section' },
        '[Agent] Updating section'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const result = await sectionContentService.updateSection(tenantId, sectionId, updates);

      if (!result.success) {
        res.status(404).json({ error: result.message });
        return;
      }

      res.json({
        success: true,
        sectionId,
        hasDraft: result.hasDraft,
        previewUrl: tenant.slug ? `/t/${tenant.slug}?preview=draft` : undefined,
        note: result.message,
        dashboardAction: result.dashboardAction,
      });
    } catch (error) {
      handleError(res, error, '/storefront/update-section');
    }
  });

  // POST /storefront/add-section - Add a new section (saves to draft)
  // MIGRATED: Now uses SectionContentService instead of legacy JSON columns
  // See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
  router.post('/storefront/add-section', async (req: Request, res: Response) => {
    try {
      const { tenantId, pageName, sectionType, position, ...content } = AddSectionSchema.parse(
        req.body
      );

      logger.info(
        { tenantId, pageName, sectionType, endpoint: '/storefront/add-section' },
        '[Agent] Adding section'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const result = await sectionContentService.addSection(
        tenantId,
        pageName,
        sectionType,
        Object.keys(content).length > 0 ? content : undefined,
        position
      );

      if (!result.success) {
        res.status(400).json({ error: result.message });
        return;
      }

      res.json({
        success: true,
        sectionId: result.sectionId,
        page: pageName,
        hasDraft: result.hasDraft,
        previewUrl: tenant.slug ? `/t/${tenant.slug}?preview=draft&page=${pageName}` : undefined,
        dashboardAction: result.dashboardAction,
      });
    } catch (error) {
      handleError(res, error, '/storefront/add-section');
    }
  });

  // POST /storefront/remove-section - Remove a section (saves to draft)
  // MIGRATED: Now uses SectionContentService instead of legacy JSON columns
  // See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
  router.post('/storefront/remove-section', async (req: Request, res: Response) => {
    try {
      const { tenantId, sectionId } = RemoveSectionSchema.parse(req.body);

      logger.info(
        { tenantId, sectionId, endpoint: '/storefront/remove-section' },
        '[Agent] Removing section'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const result = await sectionContentService.removeSection(tenantId, sectionId);

      if (!result.success) {
        res.status(404).json({ error: result.message });
        return;
      }

      res.json({
        success: true,
        sectionId,
        removedSectionId: result.removedSectionId,
        hasDraft: result.hasDraft,
        note: result.message,
      });
    } catch (error) {
      handleError(res, error, '/storefront/remove-section');
    }
  });

  // POST /storefront/reorder-sections - Move a section (saves to draft)
  // MIGRATED: Now uses SectionContentService instead of legacy JSON columns
  // See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
  router.post('/storefront/reorder-sections', async (req: Request, res: Response) => {
    try {
      const { tenantId, sectionId, toPosition } = ReorderSectionsSchema.parse(req.body);

      logger.info(
        { tenantId, sectionId, toPosition, endpoint: '/storefront/reorder-sections' },
        '[Agent] Reordering sections'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const result = await sectionContentService.reorderSection(tenantId, sectionId, toPosition);

      if (!result.success) {
        res.status(404).json({ error: result.message });
        return;
      }

      res.json({
        success: true,
        sectionId,
        newPosition: result.newPosition,
        hasDraft: result.hasDraft,
      });
    } catch (error) {
      handleError(res, error, '/storefront/reorder-sections');
    }
  });

  // POST /storefront/toggle-page - DELETED
  // This endpoint was for multi-page websites but MAIS uses single long-scroll pages.
  // See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md

  // POST /storefront/update-branding - Update branding (immediate, not draft)
  router.post('/storefront/update-branding', async (req: Request, res: Response) => {
    try {
      const { tenantId, ...branding } = UpdateBrandingSchema.parse(req.body);

      logger.info(
        { tenantId, endpoint: '/storefront/update-branding' },
        '[Agent] Updating branding'
      );

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Branding is stored in tenant.branding JSON column
      const currentBranding = (tenant.branding || {}) as Record<string, unknown>;
      const updatedBranding = { ...currentBranding };

      // Only update provided fields
      if (branding.primaryColor) updatedBranding.primaryColor = branding.primaryColor;
      if (branding.secondaryColor) updatedBranding.secondaryColor = branding.secondaryColor;
      if (branding.accentColor) updatedBranding.accentColor = branding.accentColor;
      if (branding.backgroundColor) updatedBranding.backgroundColor = branding.backgroundColor;
      if (branding.fontFamily) updatedBranding.fontFamily = branding.fontFamily;
      if (branding.logoUrl) updatedBranding.logoUrl = branding.logoUrl;

      await tenantRepo.update(tenantId, {
        branding: updatedBranding,
      });

      res.json({
        success: true,
        updated: Object.keys(branding).filter((k) => k !== 'tenantId'),
        note: 'Branding changes take effect immediately.',
      });
    } catch (error) {
      handleError(res, error, '/storefront/update-branding');
    }
  });

  // POST /storefront/preview - Get preview URL
  // MIGRATED: Now uses SectionContentService instead of legacy JSON columns
  // See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
  router.post('/storefront/preview', async (req: Request, res: Response) => {
    try {
      const { tenantId } = TenantIdSchema.parse(req.body);

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const hasDraft = await sectionContentService.hasDraft(tenantId);

      res.json({
        hasDraft,
        previewUrl: tenant.slug ? `/t/${tenant.slug}?preview=draft` : null,
        liveUrl: tenant.slug ? `/t/${tenant.slug}` : null,
      });
    } catch (error) {
      handleError(res, error, '/storefront/preview');
    }
  });

  // POST /storefront/publish - Publish all draft sections to live
  // MIGRATED: Now uses SectionContentService instead of legacy tenant repository
  // See: docs/plans/2026-02-02-refactor-section-content-migration-plan.md (Phase 5)
  router.post('/storefront/publish', async (req: Request, res: Response) => {
    try {
      // T3 confirmation pattern: confirmationReceived must be explicitly true
      // First call without confirmation returns preview, second call with confirmation=true publishes
      const { tenantId, confirmationReceived } = TenantIdSchema.extend({
        confirmationReceived: z.boolean().optional(),
      }).parse(req.body);

      logger.info(
        { tenantId, confirmationReceived, endpoint: '/storefront/publish' },
        '[Agent] Publishing all sections'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      // Delegate to SectionContentService which handles:
      // 1. T3 confirmation check
      // 2. Publishing all draft sections
      // 3. Returning hasDraft state for agent context
      const result = await sectionContentService.publishAll(tenantId, confirmationReceived);

      // If confirmation is required, return T3 prompt
      if (result.requiresConfirmation) {
        res.json({
          success: false,
          requiresConfirmation: true,
          message: result.message,
        });
        return;
      }

      // Get tenant slug for response
      const tenant = await tenantRepo.findById(tenantId);

      res.json({
        success: result.success,
        action: 'published',
        publishedAt: result.publishedAt,
        publishedCount: result.publishedCount,
        hasDraft: result.hasDraft,
        liveUrl: tenant?.slug ? `/t/${tenant.slug}` : null,
        note: result.message,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }
      handleError(res, error, '/storefront/publish');
    }
  });

  // POST /storefront/discard - Discard all draft sections
  // MIGRATED: Now uses SectionContentService instead of legacy tenant repository
  // See: docs/plans/2026-02-02-refactor-section-content-migration-plan.md (Phase 5)
  router.post('/storefront/discard', async (req: Request, res: Response) => {
    try {
      // T3 confirmation pattern: confirmationReceived must be explicitly true
      // First call without confirmation returns preview, second call with confirmation=true discards
      const { tenantId, confirmationReceived } = TenantIdSchema.extend({
        confirmationReceived: z.boolean().optional(),
      }).parse(req.body);

      logger.info(
        { tenantId, confirmationReceived, endpoint: '/storefront/discard' },
        '[Agent] Discarding all draft sections'
      );

      if (!sectionContentService) {
        res.status(503).json({ error: 'Section content service not configured' });
        return;
      }

      // Delegate to SectionContentService which handles:
      // 1. T3 confirmation check
      // 2. Discarding all draft sections
      // 3. Returning hasDraft state for agent context
      const result = await sectionContentService.discardAll(tenantId, confirmationReceived);

      // If confirmation is required, return T3 prompt
      if (result.requiresConfirmation) {
        res.json({
          success: false,
          requiresConfirmation: true,
          message: result.message,
        });
        return;
      }

      res.json({
        success: result.success,
        action: 'discarded',
        discardedCount: result.discardedCount,
        hasDraft: result.hasDraft,
        note: result.message,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }
      handleError(res, error, '/storefront/discard');
    }
  });

  // ===========================================================================
  // SECTION-LEVEL PUBLISH/DISCARD ENDPOINTS
  // Phase 3: Section Content Migration - enables per-section publishing
  // These use the new SectionContentService instead of the legacy JSON columns
  // ===========================================================================

  // POST /storefront/publish-section - Publish a single section (T3)
  router.post('/storefront/publish-section', async (req: Request, res: Response) => {
    try {
      const { tenantId, sectionId, confirmationReceived } = PublishSectionSchema.parse(req.body);

      logger.info(
        { tenantId, sectionId, confirmationReceived, endpoint: '/storefront/publish-section' },
        '[Agent] Publish section request'
      );

      // Require SectionContentService
      if (!sectionContentService) {
        res.status(503).json({
          error: 'Section content service not configured',
        });
        return;
      }

      // Call service - T3 confirmation is handled by the service
      const result = await sectionContentService.publishSection(
        tenantId,
        sectionId,
        confirmationReceived
      );

      // If confirmation is required, return early with T3 prompt
      if (result.requiresConfirmation) {
        res.json({
          success: false,
          requiresConfirmation: true,
          sectionId,
          message: result.message,
        });
        return;
      }

      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      handleError(res, error, '/storefront/publish-section');
    }
  });

  // POST /storefront/discard-section - Discard changes to a single section (T3)
  router.post('/storefront/discard-section', async (req: Request, res: Response) => {
    try {
      const { tenantId, sectionId, confirmationReceived } = DiscardSectionSchema.parse(req.body);

      logger.info(
        { tenantId, sectionId, confirmationReceived, endpoint: '/storefront/discard-section' },
        '[Agent] Discard section request'
      );

      // Require SectionContentService
      if (!sectionContentService) {
        res.status(503).json({
          error: 'Section content service not configured',
        });
        return;
      }

      // T3 confirmation check
      if (!confirmationReceived) {
        res.json({
          success: false,
          requiresConfirmation: true,
          sectionId,
          message:
            'Discard changes to this section? This will revert to the last published version.',
        });
        return;
      }

      // Get the section first to verify it exists and belongs to tenant
      const section = await sectionContentService.getSectionContent(tenantId, sectionId);
      if (!section) {
        res.status(404).json({ error: 'Section not found' });
        return;
      }

      // Remove the draft section - this effectively reverts to published
      await sectionContentService.removeSection(tenantId, sectionId);

      const hasDraft = await sectionContentService.hasDraft(tenantId);

      res.json({
        success: true,
        hasDraft,
        visibility: 'live' as const,
        message: 'Section changes discarded. Reverted to published version.',
        sectionId,
        dashboardAction: {
          type: 'REFRESH',
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      handleError(res, error, '/storefront/discard-section');
    }
  });

  // ===========================================================================
  // GUIDED REFINEMENT ENDPOINTS
  // Generate tone variants for section content to help users refine their copy.
  // Used by tenant-agent's refinement tools for the Guided Refinement Mode.
  // ===========================================================================

  // Rate limiting: Track requests per tenant (10 requests per minute)
  const variantGenerationRateLimit = new LRUCache<string, { count: number; resetAt: number }>({
    max: 1000,
    ttl: 60_000, // 1 minute
  });

  /**
   * Build prompt for generating section content variants across different tones.
   */
  function buildVariantGenerationPrompt(
    sectionType: string,
    currentContent: { headline?: string; subheadline?: string; content?: string; ctaText?: string },
    businessContext: { name: string; industry: string },
    tones: readonly string[]
  ): string {
    const businessName = businessContext.name || 'the business';
    const industry = businessContext.industry || 'service';

    const toneDescriptions: Record<string, string> = {
      professional: 'Clean, authoritative, confidence-inspiring. Direct and results-focused.',
      premium: 'Elegant, exclusive, refined. Emphasizes quality and unique value.',
      friendly: 'Warm, approachable, conversational. Like talking to a trusted friend.',
    };

    const toneList = tones.map((t) => `- ${t}: ${toneDescriptions[t] || t}`).join('\n');

    const currentFields = Object.entries(currentContent)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: "${v}"`)
      .join('\n');

    return `You are a marketing copywriter for ${businessName}, a ${industry} business.

Generate 3 different versions of this ${sectionType} section content, each in a different tone.

CURRENT CONTENT:
${currentFields || 'No current content - generate from scratch for a typical business in this industry.'}

REQUIRED TONES:
${toneList}

Return ONLY valid JSON with this exact structure:
{
  "variants": {
    "${tones[0]}": {
      "headline": "...",
      "subheadline": "...",
      "content": "...",
      "ctaText": "..."
    },
    "${tones[1]}": {
      "headline": "...",
      "subheadline": "...",
      "content": "...",
      "ctaText": "..."
    },
    "${tones[2]}": {
      "headline": "...",
      "subheadline": "...",
      "content": "...",
      "ctaText": "..."
    }
  },
  "recommendation": "${tones[0]}",
  "rationale": "Brief 1-2 sentence explanation of why this tone fits best."
}

RULES:
- Headlines: Under 10 words, impactful, no clichés
- Subheadlines: 1-2 sentences, supports the headline
- Content: 2-4 sentences for the section body
- CTA: 2-4 words, action-oriented
- Recommendation: Choose the tone that best fits ${industry} businesses
- NEVER use overused phrases like "passion for excellence" or unsubstantiated superlatives`;
  }

  // POST /storefront/generate-variants - Generate tone variants for a section
  router.post('/storefront/generate-variants', async (req: Request, res: Response) => {
    try {
      const params = GenerateSectionVariantsSchema.parse(req.body);
      const { tenantId, sectionId, sectionType, currentContent, tones } = params;

      logger.info(
        { tenantId, sectionId, sectionType, tones, endpoint: '/storefront/generate-variants' },
        '[Agent] Generating section variants'
      );

      // Rate limiting: 10 requests per minute per tenant
      const rateLimitKey = `variant-gen:${tenantId}`;
      const rateState = variantGenerationRateLimit.get(rateLimitKey);
      const now = Date.now();

      if (rateState) {
        if (now < rateState.resetAt && rateState.count >= 10) {
          const waitSeconds = Math.ceil((rateState.resetAt - now) / 1000);
          res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Too many variant generation requests. Please wait ${waitSeconds} seconds.`,
            retryAfter: waitSeconds,
          });
          return;
        }
        // Increment count
        variantGenerationRateLimit.set(rateLimitKey, {
          count: now >= rateState.resetAt ? 1 : rateState.count + 1,
          resetAt: now >= rateState.resetAt ? now + 60_000 : rateState.resetAt,
        });
      } else {
        variantGenerationRateLimit.set(rateLimitKey, { count: 1, resetAt: now + 60_000 });
      }

      // Get business context
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const branding = (tenant.branding as Record<string, unknown>) || {};
      const businessContext = {
        name: tenant.name,
        industry: (branding.businessType as string) || (branding.industry as string) || 'service',
      };

      // Generate variants using Vertex AI
      const vertexModule = await getVertexModule();
      const client = vertexModule.getVertexClient();
      const prompt = buildVariantGenerationPrompt(
        sectionType,
        currentContent,
        businessContext,
        tones
      );

      const response = await client.models.generateContent({
        model: vertexModule.DEFAULT_MODEL,
        contents: prompt,
        config: {
          temperature: 0.8, // Higher for creative diversity
          maxOutputTokens: 2048,
        },
      });

      const text = response.text || '';

      // Parse JSON from response
      let result: {
        variants: Record<
          string,
          { headline?: string; subheadline?: string; content?: string; ctaText?: string }
        >;
        recommendation: string;
        rationale: string;
      };

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.warn(
          { parseError, textPreview: text.substring(0, 300) },
          '[Variants] Failed to parse JSON'
        );
        // Return error - don't use fallback for this critical feature
        res.status(500).json({
          error: 'Failed to generate variants',
          message: 'The AI response could not be parsed. Please try again.',
        });
        return;
      }

      // Sanitize the generated content (XSS prevention - Blocking Issue B4)
      const { sanitizeObject } = await import('../lib/sanitization');
      const sanitizedVariants = sanitizeObject(result.variants, {
        allowHtml: ['content'], // Allow basic HTML in content field only
      });

      res.json({
        success: true,
        sectionId,
        sectionType,
        variants: sanitizedVariants,
        recommendation: result.recommendation,
        rationale: result.rationale,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      handleError(res, error, '/storefront/generate-variants');
    }
  });

  // ===========================================================================
  // MARKETING CONTENT GENERATION ENDPOINTS
  // These endpoints use Gemini to generate actual marketing content.
  // Added as part of Phase 4.5 remediation (issue 5188)
  // ===========================================================================

  // Lazy import Vertex client to avoid startup issues if not configured
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  let vertexClientPromise: Promise<typeof import('../llm/vertex-client')> | null = null;
  async function getVertexModule() {
    if (!vertexClientPromise) {
      vertexClientPromise = import('../llm/vertex-client');
    }
    return vertexClientPromise;
  }

  // Marketing generation schemas
  const GenerateHeadlineSchema = TenantIdSchema.extend({
    context: z.string().describe('What the headline is for (e.g., "homepage hero section")'),
    currentHeadline: z.string().optional(),
    tone: z.enum(['professional', 'warm', 'creative', 'luxury']).default('warm'),
    keywords: z.array(z.string()).optional(),
  });

  const GenerateTaglineSchema = TenantIdSchema.extend({
    businessContext: z.string().describe('Brief description of the business'),
    existingTagline: z.string().optional(),
    tone: z.enum(['professional', 'warm', 'creative', 'luxury']).default('warm'),
  });

  const GenerateServiceDescriptionSchema = TenantIdSchema.extend({
    serviceName: z.string(),
    serviceType: z.string(),
    priceRange: z.string().optional(),
    keyFeatures: z.array(z.string()).optional(),
    targetAudience: z.string().optional(),
    tone: z.enum(['professional', 'warm', 'creative', 'luxury']).default('warm'),
  });

  const RefineCopySchema = TenantIdSchema.extend({
    originalCopy: z.string(),
    feedback: z.string(),
    copyType: z.enum(['headline', 'tagline', 'description', 'about']),
  });

  /**
   * Build the marketing generation prompt with business context
   */
  function buildMarketingPrompt(
    type: 'headline' | 'tagline' | 'service_description' | 'refine',
    params: Record<string, unknown>,
    businessContext: Record<string, unknown>
  ): string {
    const businessName = (businessContext.name as string) || 'the business';
    const industry = (businessContext.industry as string) || 'service';
    const tone = (params.tone as string) || 'warm';

    const toneGuidelines: Record<string, string> = {
      professional: 'Clean, authoritative, confident. Good for consultants, coaches, B2B services.',
      warm: 'Friendly, approachable, personable. Good for family photographers, therapists, wellness.',
      creative: 'Bold, distinctive, memorable. Good for artists, designers, unique brands.',
      luxury: 'Elegant, exclusive, refined. Good for high-end weddings, premium services.',
    };

    const baseInstructions = `You are a marketing copywriter for ${businessName}, a ${industry} business.
Tone: ${tone} - ${toneGuidelines[tone] || toneGuidelines.warm}

IMPORTANT: Return ONLY valid JSON with this exact structure:
{
  "primary": "your main recommendation",
  "variants": ["variant 1", "variant 2"],
  "rationale": "brief explanation (1-2 sentences)"
}

Rules:
- Never use clichés like "passion for excellence"
- Avoid unsubstantiated superlatives ("best", "leading", "top")
- Focus on benefits over features
- Be specific to ${businessName}'s industry (${industry})`;

    switch (type) {
      case 'headline':
        return `${baseInstructions}

Generate 3 headline options for ${params.context}.
${params.currentHeadline ? `Improve upon: "${params.currentHeadline}"` : ''}
${(params.keywords as string[])?.length ? `Incorporate keywords: ${(params.keywords as string[]).join(', ')}` : ''}
Headlines must be under 10 words.`;

      case 'tagline':
        return `${baseInstructions}

Generate a tagline for the business.
Context: ${params.businessContext}
${params.existingTagline ? `Improve upon: "${params.existingTagline}"` : ''}
Taglines MUST be under 7 words.`;

      case 'service_description':
        return `${baseInstructions}

Generate a service description for "${params.serviceName}" (${params.serviceType}).
${params.priceRange ? `Price positioning: ${params.priceRange}` : ''}
${(params.keyFeatures as string[])?.length ? `Key features: ${(params.keyFeatures as string[]).join(', ')}` : ''}
${params.targetAudience ? `Target audience: ${params.targetAudience}` : ''}
Description should be 50-150 words.`;

      case 'refine':
        return `${baseInstructions}

Refine this ${params.copyType}:
Original: "${params.originalCopy}"
User feedback: ${params.feedback}

Apply the feedback while maintaining the ${tone} tone.`;

      default:
        return baseInstructions;
    }
  }

  /**
   * Generate marketing content using Gemini
   */
  async function generateMarketingContent(
    type: 'headline' | 'tagline' | 'service_description' | 'refine',
    params: Record<string, unknown>,
    businessContext: Record<string, unknown>
  ): Promise<{ primary: string; variants: string[]; rationale: string }> {
    const vertexModule = await getVertexModule();
    const client = vertexModule.getVertexClient();
    const _model = client.models.generateContent; // Preserved for potential future use

    const prompt = buildMarketingPrompt(type, params, businessContext);

    const response = await client.models.generateContent({
      model: vertexModule.DEFAULT_MODEL,
      contents: prompt,
      config: {
        temperature: 0.7, // Higher for creative content
        maxOutputTokens: 1024,
      },
    });

    // Extract text from response
    const text = response.text || '';

    // Parse JSON from response
    try {
      // Try to extract JSON from the response (may be wrapped in markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          primary: parsed.primary || '',
          variants: Array.isArray(parsed.variants) ? parsed.variants : [],
          rationale: parsed.rationale || '',
        };
      }
    } catch (parseError) {
      logger.warn({ parseError, text: text.substring(0, 200) }, '[Marketing] Failed to parse JSON');
    }

    // Fallback: return the raw text as primary
    return {
      primary: text.trim(),
      variants: [],
      rationale: 'Generated content (non-JSON format)',
    };
  }

  // POST /marketing/generate-headline - Generate headlines
  router.post('/marketing/generate-headline', async (req: Request, res: Response) => {
    try {
      const params = GenerateHeadlineSchema.parse(req.body);
      const { tenantId } = params;

      logger.info(
        { tenantId, context: params.context, endpoint: '/marketing/generate-headline' },
        '[Agent] Generating headline'
      );

      // Get business context
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const branding = (tenant.branding as Record<string, unknown>) || {};
      const businessContext = {
        name: tenant.name,
        industry: (branding.businessType as string) || (branding.industry as string) || 'service',
      };

      const result = await generateMarketingContent('headline', params, businessContext);

      res.json({
        success: true,
        type: 'headline',
        ...result,
      });
    } catch (error) {
      handleError(res, error, '/marketing/generate-headline');
    }
  });

  // POST /marketing/generate-tagline - Generate taglines
  router.post('/marketing/generate-tagline', async (req: Request, res: Response) => {
    try {
      const params = GenerateTaglineSchema.parse(req.body);
      const { tenantId } = params;

      logger.info(
        { tenantId, endpoint: '/marketing/generate-tagline' },
        '[Agent] Generating tagline'
      );

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const branding = (tenant.branding as Record<string, unknown>) || {};
      const businessContext = {
        name: tenant.name,
        industry: (branding.businessType as string) || (branding.industry as string) || 'service',
      };

      const result = await generateMarketingContent('tagline', params, businessContext);

      res.json({
        success: true,
        type: 'tagline',
        ...result,
      });
    } catch (error) {
      handleError(res, error, '/marketing/generate-tagline');
    }
  });

  // POST /marketing/generate-service-description - Generate service descriptions
  router.post('/marketing/generate-service-description', async (req: Request, res: Response) => {
    try {
      const params = GenerateServiceDescriptionSchema.parse(req.body);
      const { tenantId } = params;

      logger.info(
        {
          tenantId,
          serviceName: params.serviceName,
          endpoint: '/marketing/generate-service-description',
        },
        '[Agent] Generating service description'
      );

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const branding = (tenant.branding as Record<string, unknown>) || {};
      const businessContext = {
        name: tenant.name,
        industry: (branding.businessType as string) || (branding.industry as string) || 'service',
      };

      const result = await generateMarketingContent('service_description', params, businessContext);

      res.json({
        success: true,
        type: 'service_description',
        ...result,
      });
    } catch (error) {
      handleError(res, error, '/marketing/generate-service-description');
    }
  });

  // POST /marketing/refine-copy - Refine existing copy
  router.post('/marketing/refine-copy', async (req: Request, res: Response) => {
    try {
      const params = RefineCopySchema.parse(req.body);
      const { tenantId } = params;

      logger.info(
        { tenantId, copyType: params.copyType, endpoint: '/marketing/refine-copy' },
        '[Agent] Refining copy'
      );

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const branding = (tenant.branding as Record<string, unknown>) || {};
      const businessContext = {
        name: tenant.name,
        industry: (branding.businessType as string) || (branding.industry as string) || 'service',
      };

      const result = await generateMarketingContent('refine', params, businessContext);

      res.json({
        success: true,
        type: 'refined',
        originalCopyType: params.copyType,
        ...result,
      });
    } catch (error) {
      handleError(res, error, '/marketing/refine-copy');
    }
  });

  // ===========================================================================
  // PROJECT HUB AGENT ROUTES
  // Dual-faced customer-tenant communication system
  // ===========================================================================

  // Project Hub request schemas
  const ProjectHubBootstrapCustomerSchema = TenantIdSchema.extend({
    customerId: z.string().min(1, 'customerId is required'),
    // projectId is optional for backwards compatibility - when provided, looks up specific project
    // When omitted, falls back to finding any active project for the customer (legacy behavior)
    projectId: z.string().optional(),
  });

  const ProjectHubGetProjectSchema = TenantIdSchema.extend({
    projectId: z.string().min(1, 'projectId is required'),
  });

  const ProjectHubGetTimelineSchema = TenantIdSchema.extend({
    projectId: z.string().min(1, 'projectId is required'),
    actor: z.enum(['customer', 'tenant']).default('customer'),
  });

  const PROJECT_REQUEST_TYPES = [
    'RESCHEDULE',
    'ADD_ON',
    'QUESTION',
    'CHANGE_REQUEST',
    'CANCELLATION',
    'REFUND',
    'OTHER',
  ] as const;

  const ProjectHubCreateRequestSchema = TenantIdSchema.extend({
    projectId: z.string().min(1, 'projectId is required'),
    type: z.enum(PROJECT_REQUEST_TYPES),
    requestData: z.record(z.unknown()),
  });

  const ProjectHubHandleRequestSchema = TenantIdSchema.extend({
    requestId: z.string().min(1, 'requestId is required'),
    expectedVersion: z.number().int().min(1),
    response: z.string().optional(),
  });

  const ProjectHubDenyRequestSchema = ProjectHubHandleRequestSchema.extend({
    reason: z.string().min(1, 'reason is required'),
  });

  const ProjectHubListProjectsSchema = TenantIdSchema.extend({
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD']).optional(),
  });

  const _ProjectHubAddNoteSchema = TenantIdSchema.extend({
    projectId: z.string().min(1, 'projectId is required'),
    note: z.string().min(1, 'note is required'),
  });

  // POST /project-hub/bootstrap-customer - Initialize customer session
  router.post('/project-hub/bootstrap-customer', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, customerId, projectId } = ProjectHubBootstrapCustomerSchema.parse(req.body);

      logger.info(
        { tenantId, customerId, projectId, endpoint: '/project-hub/bootstrap-customer' },
        '[Agent] Bootstrapping customer session'
      );

      const result = await projectHubService.bootstrapCustomer(tenantId, customerId, projectId);

      res.json(result);
    } catch (error) {
      handleError(res, error, '/project-hub/bootstrap-customer');
    }
  });

  // POST /project-hub/bootstrap-tenant - Initialize tenant session
  router.post('/project-hub/bootstrap-tenant', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId } = TenantIdSchema.parse(req.body);

      logger.info(
        { tenantId, endpoint: '/project-hub/bootstrap-tenant' },
        '[Agent] Bootstrapping tenant session'
      );

      const result = await projectHubService.bootstrapTenant(tenantId);

      res.json(result);
    } catch (error) {
      handleError(res, error, '/project-hub/bootstrap-tenant');
    }
  });

  // POST /project-hub/project-details - Get project with booking info
  router.post('/project-hub/project-details', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, projectId } = ProjectHubGetProjectSchema.parse(req.body);

      logger.info(
        { tenantId, projectId, endpoint: '/project-hub/project-details' },
        '[Agent] Getting project details'
      );

      const result = await projectHubService.getProjectDetails(tenantId, projectId);

      res.json(result);
    } catch (error) {
      handleError(res, error, '/project-hub/project-details');
    }
  });

  // POST /project-hub/timeline - Get project timeline events
  router.post('/project-hub/timeline', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, projectId, actor } = ProjectHubGetTimelineSchema.parse(req.body);

      logger.info(
        { tenantId, projectId, actor, endpoint: '/project-hub/timeline' },
        '[Agent] Getting project timeline'
      );

      const events = await projectHubService.getTimeline(tenantId, projectId, actor);

      res.json({ events, count: events.length });
    } catch (error) {
      handleError(res, error, '/project-hub/timeline');
    }
  });

  // POST /project-hub/pending-requests - Get pending requests for tenant
  router.post('/project-hub/pending-requests', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId } = TenantIdSchema.parse(req.body);

      logger.info(
        { tenantId, endpoint: '/project-hub/pending-requests' },
        '[Agent] Getting pending requests'
      );

      const result = await projectHubService.getPendingRequests(tenantId);

      res.json({
        requests: result.requests,
        count: result.requests.length,
        hasMore: result.hasMore,
      });
    } catch (error) {
      handleError(res, error, '/project-hub/pending-requests');
    }
  });

  // POST /project-hub/create-request - Create a customer request
  router.post('/project-hub/create-request', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, projectId, type, requestData } = ProjectHubCreateRequestSchema.parse(
        req.body
      );

      logger.info(
        { tenantId, projectId, type, endpoint: '/project-hub/create-request' },
        '[Agent] Creating request'
      );

      const request = await projectHubService.createRequest({
        tenantId,
        projectId,
        type,
        requestData,
      });

      res.json({ success: true, request, expiresAt: request.expiresAt });
    } catch (error) {
      handleError(res, error, '/project-hub/create-request');
    }
  });

  // POST /project-hub/approve-request - Approve a pending request (with optimistic locking)
  router.post('/project-hub/approve-request', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, requestId, expectedVersion, response } =
        ProjectHubHandleRequestSchema.parse(req.body);

      logger.info(
        { tenantId, requestId, expectedVersion, endpoint: '/project-hub/approve-request' },
        '[Agent] Approving request'
      );

      const request = await projectHubService.approveRequest({
        tenantId,
        requestId,
        expectedVersion,
        response,
      });

      res.json({ success: true, request });
    } catch (error) {
      handleError(res, error, '/project-hub/approve-request');
    }
  });

  // POST /project-hub/deny-request - Deny a pending request (with optimistic locking)
  router.post('/project-hub/deny-request', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, requestId, expectedVersion, reason, response } =
        ProjectHubDenyRequestSchema.parse(req.body);

      logger.info(
        { tenantId, requestId, expectedVersion, endpoint: '/project-hub/deny-request' },
        '[Agent] Denying request'
      );

      const request = await projectHubService.denyRequest({
        tenantId,
        requestId,
        expectedVersion,
        reason,
        response,
      });

      res.json({ success: true, request });
    } catch (error) {
      handleError(res, error, '/project-hub/deny-request');
    }
  });

  // POST /project-hub/list-projects - List all projects for tenant
  router.post('/project-hub/list-projects', async (req: Request, res: Response) => {
    try {
      if (!projectHubService) {
        res.status(503).json({ error: 'Project Hub service not available' });
        return;
      }

      const { tenantId, status } = ProjectHubListProjectsSchema.parse(req.body);

      logger.info(
        { tenantId, status, endpoint: '/project-hub/list-projects' },
        '[Agent] Listing projects'
      );

      const result = await projectHubService.listProjects(tenantId, status);

      res.json({
        projects: result.projects,
        count: result.projects.length,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      });
    } catch (error) {
      handleError(res, error, '/project-hub/list-projects');
    }
  });

  // ===========================================================================
  // VOCABULARY RESOLUTION Endpoints (for Tenant Agent)
  // ===========================================================================

  /**
   * POST /vocabulary/resolve - Resolve natural language phrase to BlockType
   *
   * Uses VocabularyEmbeddingService to semantically match user phrases like
   * "my bio" → ABOUT, "reviews" → TESTIMONIALS, "header" → HERO
   *
   * Called by: Tenant Agent's resolve_vocabulary tool
   */
  router.post('/vocabulary/resolve', async (req: Request, res: Response) => {
    try {
      if (!vocabularyEmbeddingService) {
        res.status(503).json({
          error: 'Vocabulary embedding service not available',
          blockType: null,
          confidence: 0,
          matchedPhrase: null,
        });
        return;
      }

      const { phrase, tenantId } = ResolveVocabularySchema.parse(req.body);

      logger.info(
        { phrase, tenantId, endpoint: '/vocabulary/resolve' },
        '[Agent] Resolving vocabulary phrase'
      );

      const result = await vocabularyEmbeddingService.resolveBlockType(phrase);

      res.json({
        blockType: result.blockType,
        confidence: result.confidence,
        matchedPhrase: result.matchedPhrase,
      });
    } catch (error) {
      handleError(res, error, '/vocabulary/resolve');
    }
  });

  // ===========================================================================
  // PACKAGE MANAGEMENT Endpoints (for Tenant Agent)
  // ===========================================================================
  // CRITICAL P0 FIX: This endpoint manages ACTUAL bookable packages (Package table),
  // NOT the cosmetic "pricing section" in the storefront.
  //
  // This addresses the E2E failure where agent said "Done" but Services section
  // still showed generic $0 packages.
  //
  // @see docs/reports/2026-02-01-agent-testing-failure-report.md
  // @see todos/811-pending-p1-missing-package-management-tools.md
  // ===========================================================================

  const ManagePackagesSchema = TenantIdSchema.extend({
    action: z.enum(['list', 'create', 'update', 'delete']),
    // Create fields
    slug: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    priceCents: z.number().min(100, 'Price must be at least $1 (100 cents)').optional(),
    // Update/Delete fields
    packageId: z.string().min(1).optional(),
  });

  /**
   * POST /manage-packages - Create, update, delete, or list packages
   *
   * IMPORTANT: This modifies ACTUAL bookable packages that:
   * - Appear in the Services section on the storefront
   * - Have "Book" buttons that lead to real checkout
   * - Must have price >= $1 (P0 fix for $0 booking path)
   *
   * Called by: Tenant Agent's manage_packages tool
   */
  router.post('/manage-packages', async (req: Request, res: Response) => {
    try {
      const params = ManagePackagesSchema.parse(req.body);
      const { tenantId, action } = params;

      logger.info(
        { tenantId, action, endpoint: '/manage-packages' },
        '[Agent] Package management request'
      );

      // Verify tenant exists
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      switch (action) {
        case 'list': {
          const packages = await catalogService.getAllPackages(tenantId);
          const formatted = packages.map((pkg) => ({
            id: pkg.id,
            name: pkg.title || pkg.name || 'Unnamed Package',
            description: pkg.description || '',
            priceInDollars: Math.round((pkg.priceCents || pkg.basePrice || 0) / 100),
            slug: pkg.slug,
            active: pkg.active !== false,
          }));

          res.json({
            packages: formatted,
            totalCount: formatted.length,
          });
          return;
        }

        case 'create': {
          // Validate required create fields
          if (!params.slug || !params.title || !params.priceCents) {
            res.status(400).json({
              error: 'Missing required fields for create: slug, title, priceCents',
            });
            return;
          }

          // P0 FIX: Enforce minimum price to prevent $0 booking path
          if (params.priceCents < 100) {
            res.status(400).json({
              error: 'Price must be at least $1 (100 cents). Free packages are not allowed.',
            });
            return;
          }

          const newPackage = await catalogService.createPackage(tenantId, {
            slug: params.slug,
            title: params.title,
            description: params.description || '',
            priceCents: params.priceCents,
          });

          // Get updated count for verification
          const allPackages = await catalogService.getAllPackages(tenantId);

          logger.info(
            { tenantId, packageId: newPackage.id, name: newPackage.title },
            '[Agent] Package created'
          );

          res.json({
            package: {
              id: newPackage.id,
              name: newPackage.title || newPackage.name,
              description: newPackage.description,
              priceInDollars: Math.round(
                (newPackage.priceCents || newPackage.basePrice || 0) / 100
              ),
              slug: newPackage.slug,
            },
            totalCount: allPackages.length,
          });
          return;
        }

        case 'update': {
          if (!params.packageId) {
            res.status(400).json({ error: 'packageId is required for update' });
            return;
          }

          // SECURITY: Verify package belongs to tenant (pitfall #816)
          const existingPkg = await catalogService.getPackageById(tenantId, params.packageId);
          if (!existingPkg) {
            res.status(404).json({ error: 'Package not found' });
            return;
          }

          // P0 FIX: Enforce minimum price if updating price
          if (params.priceCents !== undefined && params.priceCents < 100) {
            res.status(400).json({
              error: 'Price must be at least $1 (100 cents). Free packages are not allowed.',
            });
            return;
          }

          // Build update payload (only include provided fields)
          const updateData: {
            slug?: string;
            title?: string;
            description?: string;
            priceCents?: number;
          } = {};

          if (params.slug) updateData.slug = params.slug;
          if (params.title) updateData.title = params.title;
          if (params.description) updateData.description = params.description;
          if (params.priceCents !== undefined) updateData.priceCents = params.priceCents;

          const updatedPackage = await catalogService.updatePackage(
            tenantId,
            params.packageId,
            updateData
          );

          const allPackages = await catalogService.getAllPackages(tenantId);

          logger.info(
            { tenantId, packageId: updatedPackage.id, updates: Object.keys(updateData) },
            '[Agent] Package updated'
          );

          res.json({
            package: {
              id: updatedPackage.id,
              name: updatedPackage.title || updatedPackage.name,
              description: updatedPackage.description,
              priceInDollars: Math.round(
                (updatedPackage.priceCents || updatedPackage.basePrice || 0) / 100
              ),
              slug: updatedPackage.slug,
            },
            totalCount: allPackages.length,
          });
          return;
        }

        case 'delete': {
          if (!params.packageId) {
            res.status(400).json({ error: 'packageId is required for delete' });
            return;
          }

          // SECURITY: Verify package belongs to tenant (pitfall #816)
          const existingPkg = await catalogService.getPackageById(tenantId, params.packageId);
          if (!existingPkg) {
            res.status(404).json({ error: 'Package not found' });
            return;
          }

          await catalogService.deletePackage(tenantId, params.packageId);

          const remainingPackages = await catalogService.getAllPackages(tenantId);

          logger.info({ tenantId, deletedPackageId: params.packageId }, '[Agent] Package deleted');

          res.json({
            deletedId: params.packageId,
            totalCount: remainingPackages.length,
          });
          return;
        }

        default:
          res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      handleError(res, error, '/manage-packages');
    }
  });

  return router;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Handle errors consistently across all endpoints
 */
function handleError(res: Response, error: unknown, endpoint: string): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: error.message,
    });
    return;
  }

  if (error instanceof ValidationError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: error.message,
    });
    return;
  }

  if (error instanceof ConcurrentModificationError) {
    res.status(409).json({
      error: 'CONCURRENT_MODIFICATION',
      message: error.message,
      currentVersion: error.currentVersion,
    });
    return;
  }

  logger.error({ error, endpoint }, '[Agent] Internal error');

  res.status(500).json({
    error: 'Internal server error',
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}

/**
 * Generate a reason string for budget-based recommendations
 */
function getBudgetReason(
  budget: 'low' | 'medium' | 'high' | undefined,
  priceCents: number,
  allPackages: Array<{ priceCents: number }>
): string {
  const prices = allPackages.map((p) => p.priceCents);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

  if (!budget) {
    return 'Popular choice';
  }

  if (budget === 'low' && priceCents <= avgPrice) {
    return 'Great value option';
  }

  if (budget === 'high' && priceCents >= avgPrice) {
    return 'Premium experience';
  }

  if (budget === 'medium') {
    return 'Balanced option';
  }

  // Default based on price position
  if (priceCents === minPrice) {
    return 'Most affordable';
  }
  if (priceCents === maxPrice) {
    return 'Most comprehensive';
  }

  return 'Recommended';
}
