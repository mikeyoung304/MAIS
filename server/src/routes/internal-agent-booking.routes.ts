/**
 * Internal Agent Booking Routes
 *
 * Customer-agent endpoints for service discovery, availability, and booking.
 * 7 endpoints including /services, /availability, /business-info, /faq, /recommend, /create-booking.
 *
 * Called by: customer-agent
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import { verifyInternalSecret, handleError, TenantIdSchema } from './internal-agent-shared';
import type { BookingRoutesDeps } from './internal-agent-shared';

// =============================================================================
// Schemas
// =============================================================================

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
// Helpers
// =============================================================================

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

// =============================================================================
// Route Factory
// =============================================================================

/**
 * Create internal agent booking routes.
 *
 * Mounted at `/` by the aggregator (root-level paths like `/services`, `/availability`).
 */
export function createInternalAgentBookingRoutes(deps: BookingRoutesDeps): Router {
  const router = Router();
  const {
    catalogService,
    schedulingAvailabilityService,
    bookingService,
    tenantRepo,
    serviceRepo,
    internalApiSecret,
  } = deps;

  router.use(verifyInternalSecret(internalApiSecret));

  // POST /services - Get all services for a tenant
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

  // POST /service-details - Get detailed info about a specific service
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

  // POST /availability - Check availability for a service
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

  // POST /business-info - Get tenant business information
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

  // POST /faq - Answer FAQ question
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

  // POST /recommend - Recommend packages based on preferences
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

  // POST /create-booking - Create a booking (T3 action requiring confirmation)
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

  return router;
}
