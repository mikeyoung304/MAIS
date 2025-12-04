/**
 * Public Scheduling Routes
 * Customer-facing endpoints for browsing services and checking availability
 * Requires tenant context via X-Tenant-Key header
 *
 * These routes should be mounted at /v1/public to match the contract paths:
 * - GET /v1/public/services
 * - GET /v1/public/services/:slug
 * - GET /v1/public/availability/slots
 */

import { Router, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { TenantRequest } from '../middleware/tenant';
import type { ServiceRepository } from '../lib/ports';
import type { SchedulingAvailabilityService } from '../services/scheduling-availability.service';
import { AvailableSlotsQuerySchema } from '@macon/contracts';
import type { TimeSlotDto } from '@macon/contracts';
import { logger } from '../lib/core/logger';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';
import { publicSchedulingLimiter } from '../middleware/rateLimiter';

/**
 * Path params validation schema for slug routes
 */
const slugParamsSchema = z.object({
  slug: z.string().min(1).max(100),
});

/**
 * Create public scheduling routes
 *
 * Mount at /v1/public to match contract paths
 *
 * @param serviceRepo - Service repository instance
 * @param availabilityService - Scheduling availability service instance
 * @returns Express router with public scheduling endpoints
 */
export function createPublicSchedulingRoutes(
  serviceRepo: ServiceRepository,
  availabilityService: SchedulingAvailabilityService
): Router {
  const router = Router();

  // Apply rate limiting to all public scheduling endpoints
  // TODO-057: 100 requests/minute per tenant/IP to prevent enumeration and DoS
  router.use(publicSchedulingLimiter);

  // =========================================================================
  // Services Routes (/v1/public/services)
  // =========================================================================

  /**
   * GET /v1/public/services
   * Get all active services for a tenant
   * Used for service selection UI in booking widgets
   *
   * @returns 200 - Array of active services
   * @returns 401 - Missing or invalid tenant key
   * @returns 500 - Internal server error
   */
  router.get('/services', async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Tenant context required' });
        return;
      }

      // Get all active services for tenant
      const services = await serviceRepo.getActiveServices(tenantId);

      // Transform to DTO format (excluding tenantId for public API)
      const serviceDtos = services.map((service) => ({
        id: service.id,
        slug: service.slug,
        name: service.name,
        description: service.description ?? null,
        durationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes,
        priceCents: service.priceCents,
        timezone: service.timezone,
        active: service.active,
        sortOrder: service.sortOrder ?? 0,
        segmentId: service.segmentId ?? null,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
      }));

      logger.info({ tenantId, serviceCount: serviceDtos.length }, 'Public services list accessed');

      res.json(serviceDtos);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /v1/public/services/:slug
   * Get service details by slug
   * Used for service detail pages
   *
   * @param slug - URL-safe service identifier (e.g., "30-min-consultation")
   * @returns 200 - Service object
   * @returns 400 - Invalid slug format
   * @returns 401 - Missing or invalid tenant key
   * @returns 404 - Service not found
   * @returns 500 - Internal server error
   */
  router.get('/services/:slug', async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Tenant context required' });
        return;
      }

      // Validate slug format
      const params = slugParamsSchema.parse(req.params);
      const { slug } = params;

      // Get service by slug
      const service = await serviceRepo.getBySlug(tenantId, slug);

      if (!service) {
        throw new NotFoundError(`Service not found: ${slug}`);
      }

      // Transform to DTO format (excluding tenantId for public API)
      const serviceDto = {
        id: service.id,
        slug: service.slug,
        name: service.name,
        description: service.description ?? null,
        durationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes,
        priceCents: service.priceCents,
        timezone: service.timezone,
        active: service.active,
        sortOrder: service.sortOrder ?? 0,
        segmentId: service.segmentId ?? null,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
      };

      logger.info({ tenantId, slug, serviceId: service.id }, 'Public service details accessed');

      res.json(serviceDto);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  // =========================================================================
  // Availability Routes (/v1/public/availability)
  // =========================================================================

  /**
   * GET /v1/public/availability/slots
   * Get available time slots for a service on a specific date
   * Used for time slot selection in booking flow
   *
   * Query params:
   * - serviceId: Service ID (required)
   * - date: Date in YYYY-MM-DD format (required)
   * - timezone: Client timezone (optional, defaults to service timezone)
   *
   * @returns 200 - Available slots for the date
   * @returns 400 - Validation error (invalid date format, missing params)
   * @returns 401 - Missing or invalid tenant key
   * @returns 404 - Service not found
   * @returns 500 - Internal server error
   */
  router.get(
    '/availability/slots',
    async (req: TenantRequest, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.tenantId;
        if (!tenantId) {
          res.status(401).json({ error: 'Tenant context required' });
          return;
        }

        // Validate query params
        const query = AvailableSlotsQuerySchema.parse(req.query);
        const { serviceId, date: dateStr, timezone: clientTimezone } = query;

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
          res.status(400).json({
            error: 'Invalid date format. Expected YYYY-MM-DD',
          });
          return;
        }

        // Convert date string to Date object
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          res.status(400).json({
            error: 'Invalid date value',
          });
          return;
        }

        // Verify service exists and belongs to tenant
        const service = await serviceRepo.getById(tenantId, serviceId);
        if (!service) {
          throw new NotFoundError(`Service not found: ${serviceId}`);
        }

        // Get available slots from availability service
        const slots = await availabilityService.getAvailableSlots({
          tenantId,
          serviceId,
          date,
        });

        // Transform slots to DTO format
        const slotDtos: TimeSlotDto[] = slots.map((slot) => ({
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
          available: slot.available,
        }));

        // Determine timezone for response (client timezone or service timezone)
        const responseTimezone = clientTimezone ?? service.timezone;

        // Log if falling back to service timezone
        if (!clientTimezone) {
          logger.warn(
            {
              tenantId,
              serviceId,
              fallbackTimezone: service.timezone,
              date: dateStr,
              context: 'available_slots_query',
            },
            'Timezone fallback used - no client timezone provided in available slots query'
          );
        }

        logger.info(
          {
            tenantId,
            serviceId,
            date: dateStr,
            slotCount: slotDtos.length,
            availableCount: slotDtos.filter((s) => s.available).length,
          },
          'Available slots queried'
        );

        res.json({
          date: dateStr,
          serviceId,
          timezone: responseTimezone,
          slots: slotDtos,
        });
      } catch (error) {
        if (error instanceof ZodError) {
          res.status(400).json({
            error: 'Validation error',
            details: error.issues,
          });
          return;
        }
        if (error instanceof NotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        next(error);
      }
    }
  );

  return router;
}
