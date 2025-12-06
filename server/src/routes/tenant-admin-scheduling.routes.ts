/**
 * Tenant Admin Scheduling Routes
 * Authenticated routes for tenant administrators to manage their scheduling services,
 * availability rules, and appointments
 * Requires tenant admin authentication via JWT
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  CreateServiceDtoSchema,
  UpdateServiceDtoSchema,
  CreateAvailabilityRuleDtoSchema,
  UpdateAvailabilityRuleDtoSchema,
} from '@macon/contracts';
import type {
  ServiceRepository,
  AvailabilityRuleRepository,
  BookingRepository,
} from '../lib/ports';
import type { BookingService } from '../services/booking.service';
import { logger } from '../lib/core/logger';
import { NotFoundError, ValidationError } from '../lib/errors';

/**
 * Create tenant admin scheduling routes
 * All routes require tenant admin authentication (applied via middleware)
 *
 * @param serviceRepo - Service repository instance
 * @param availabilityRuleRepo - Availability rule repository instance
 * @param bookingService - Booking service instance (for appointments)
 * @param bookingRepo - Booking repository instance (for efficient appointment queries)
 * @returns Express router with tenant admin scheduling endpoints
 */
export function createTenantAdminSchedulingRoutes(
  serviceRepo: ServiceRepository,
  availabilityRuleRepo: AvailabilityRuleRepository,
  bookingService: BookingService,
  bookingRepo: BookingRepository
): Router {
  const router = Router();

  // ============================================================================
  // Service Management Endpoints
  // ============================================================================

  /**
   * GET /v1/tenant-admin/services
   * List all services (including inactive) for authenticated tenant
   * Used in tenant admin dashboard for service management
   *
   * @returns 200 - Array of all services ordered by sortOrder
   * @returns 401 - Missing or invalid authentication
   * @returns 500 - Internal server error
   */
  router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Include inactive services for admin view
      const services = await serviceRepo.getAll(tenantId, true);

      res.json(services);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/services
   * Create new service for authenticated tenant
   *
   * Request body: CreateServiceDto (validated by Zod)
   * {
   *   slug: string,              // URL-safe (lowercase, alphanumeric, hyphens)
   *   name: string,              // Display name
   *   description?: string,      // Service description
   *   durationMinutes: number,   // Service duration
   *   bufferMinutes?: number,    // Buffer between appointments (default 0)
   *   priceCents: number,        // Price in cents
   *   timezone?: string,         // Timezone (default "America/New_York")
   *   active?: boolean,          // Visibility (default true)
   *   sortOrder?: number,        // Display order (default 0)
   *   segmentId?: string | null  // Optional segment assignment
   * }
   *
   * @returns 201 - Created service object
   * @returns 400 - Validation error or duplicate slug
   * @returns 401 - Missing or invalid authentication
   * @returns 409 - Slug conflict (service with same slug exists)
   * @returns 500 - Internal server error
   */
  router.post('/services', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Check if timezone was provided BEFORE Zod applies default
      const timezoneMissing = !req.body.timezone;

      // Validate request body
      const data = CreateServiceDtoSchema.parse(req.body);

      // Log timezone fallback if timezone wasn't provided
      if (timezoneMissing) {
        logger.warn(
          {
            fallbackTimezone: data.timezone,
            tenantId,
            serviceSlug: data.slug,
            context: 'service_creation_route',
          },
          'Timezone fallback used - no timezone provided for service creation'
        );
      }

      // Check for slug conflict
      const existing = await serviceRepo.getBySlug(tenantId, data.slug);
      if (existing) {
        res.status(409).json({ error: 'Service with this slug already exists' });
        return;
      }

      // Create service
      const service = await serviceRepo.create(tenantId, {
        slug: data.slug,
        name: data.name,
        description: data.description,
        durationMinutes: data.durationMinutes,
        bufferMinutes: data.bufferMinutes,
        priceCents: data.priceCents,
        timezone: data.timezone,
        sortOrder: data.sortOrder,
        segmentId: data.segmentId,
      });

      logger.info(
        { tenantId, serviceId: service.id, slug: service.slug },
        'Service created by tenant admin'
      );

      res.status(201).json(service);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * PUT /v1/tenant-admin/services/:id
   * Update service
   * Verifies service belongs to authenticated tenant
   *
   * Request body: Partial<CreateServiceDto>
   * All fields optional for partial updates
   *
   * @param id - Service CUID
   * @returns 200 - Updated service object
   * @returns 400 - Validation error
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Service not found or belongs to different tenant
   * @returns 409 - Slug conflict (another service with same slug exists)
   * @returns 500 - Internal server error
   */
  router.put('/services/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const { id } = req.params;

      // Validate update data
      const data = UpdateServiceDtoSchema.parse(req.body);

      // Verify service exists and belongs to tenant
      const existing = await serviceRepo.getById(tenantId, id);
      if (!existing) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      // Check for slug conflict if slug is being changed
      if (data.slug && data.slug !== existing.slug) {
        const conflicting = await serviceRepo.getBySlug(tenantId, data.slug);
        if (conflicting) {
          res.status(409).json({ error: 'Service with this slug already exists' });
          return;
        }
      }

      // Update service
      const service = await serviceRepo.update(tenantId, id, data);

      logger.info(
        { tenantId, serviceId: service.id, slug: service.slug },
        'Service updated by tenant admin'
      );

      res.json(service);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * DELETE /v1/tenant-admin/services/:id
   * Delete service
   * Verifies service belongs to authenticated tenant
   * Cascades to associated availability rules
   *
   * @param id - Service CUID
   * @returns 204 - Service deleted successfully
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Service not found or belongs to different tenant
   * @returns 500 - Internal server error
   */
  router.delete('/services/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const { id } = req.params;

      // Verify service exists and belongs to tenant
      const existing = await serviceRepo.getById(tenantId, id);
      if (!existing) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      // Delete service (cascades to availability rules via repository)
      await serviceRepo.delete(tenantId, id);

      logger.info({ tenantId, serviceId: id }, 'Service deleted by tenant admin');

      res.status(204).send();
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  // ============================================================================
  // Availability Rule Management Endpoints
  // ============================================================================

  /**
   * GET /v1/tenant-admin/availability-rules
   * List all availability rules for authenticated tenant
   * Optional query param: ?serviceId=xyz to filter by service
   *
   * @query serviceId - Optional service ID to filter rules
   * @returns 200 - Array of availability rules
   * @returns 401 - Missing or invalid authentication
   * @returns 500 - Internal server error
   */
  router.get('/availability-rules', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const { serviceId } = req.query;

      let rules;
      if (serviceId && typeof serviceId === 'string') {
        // Filter by service
        rules = await availabilityRuleRepo.getByService(tenantId, serviceId);
      } else {
        // Get all rules
        rules = await availabilityRuleRepo.getAll(tenantId);
      }

      // Map to DTO format with ISO date strings
      const rulesDto = rules.map((rule) => ({
        id: rule.id,
        tenantId: rule.tenantId,
        serviceId: rule.serviceId,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        effectiveFrom: rule.effectiveFrom.toISOString(),
        effectiveTo: rule.effectiveTo ? rule.effectiveTo.toISOString() : null,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      }));

      res.json(rulesDto);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/availability-rules
   * Create new availability rule for authenticated tenant
   *
   * Request body: CreateAvailabilityRuleDto (validated by Zod)
   * {
   *   serviceId?: string | null, // NULL = applies to all services
   *   dayOfWeek: number,         // 0=Sunday, 6=Saturday
   *   startTime: string,         // "09:00" (HH:MM format)
   *   endTime: string,           // "17:00" (HH:MM format)
   *   effectiveFrom?: string,    // ISO date (default now)
   *   effectiveTo?: string       // ISO date (NULL = indefinite)
   * }
   *
   * @returns 201 - Created availability rule object
   * @returns 400 - Validation error
   * @returns 401 - Missing or invalid authentication
   * @returns 500 - Internal server error
   */
  router.post('/availability-rules', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Validate request body
      const data = CreateAvailabilityRuleDtoSchema.parse(req.body);

      // Verify service exists if serviceId provided
      if (data.serviceId) {
        const service = await serviceRepo.getById(tenantId, data.serviceId);
        if (!service) {
          res.status(404).json({ error: 'Service not found' });
          return;
        }
      }

      // Create availability rule
      const rule = await availabilityRuleRepo.create(tenantId, {
        serviceId: data.serviceId ?? null,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      });

      logger.info(
        { tenantId, ruleId: rule.id, dayOfWeek: rule.dayOfWeek },
        'Availability rule created by tenant admin'
      );

      // Map to DTO format
      const ruleDto = {
        id: rule.id,
        tenantId: rule.tenantId,
        serviceId: rule.serviceId,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        effectiveFrom: rule.effectiveFrom.toISOString(),
        effectiveTo: rule.effectiveTo ? rule.effectiveTo.toISOString() : null,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      };

      res.status(201).json(ruleDto);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * PUT /v1/tenant-admin/availability-rules/:id
   * Update availability rule
   * Verifies rule belongs to authenticated tenant
   *
   * Request body: Partial<CreateAvailabilityRuleDto>
   * All fields optional for partial updates
   *
   * @param id - Availability rule CUID
   * @returns 200 - Updated availability rule object
   * @returns 400 - Validation error
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Rule not found or belongs to different tenant
   * @returns 500 - Internal server error
   */
  router.put('/availability-rules/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const { id } = req.params;

      // Validate update data
      const data = UpdateAvailabilityRuleDtoSchema.parse(req.body);

      // Verify rule exists and belongs to tenant (repository will check during update)
      // Convert ISO date strings to Date objects if provided
      const updateData: any = {};
      if (data.serviceId !== undefined) updateData.serviceId = data.serviceId;
      if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
      if (data.startTime !== undefined) updateData.startTime = data.startTime;
      if (data.endTime !== undefined) updateData.endTime = data.endTime;
      if (data.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(data.effectiveFrom);
      if (data.effectiveTo !== undefined) {
        updateData.effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;
      }

      // Verify service exists if serviceId is being updated
      if (data.serviceId) {
        const service = await serviceRepo.getById(tenantId, data.serviceId);
        if (!service) {
          res.status(404).json({ error: 'Service not found' });
          return;
        }
      }

      // Update availability rule
      const rule = await availabilityRuleRepo.update(tenantId, id, updateData);

      logger.info(
        { tenantId, ruleId: rule.id, dayOfWeek: rule.dayOfWeek },
        'Availability rule updated by tenant admin'
      );

      // Map to DTO format
      const ruleDto = {
        id: rule.id,
        tenantId: rule.tenantId,
        serviceId: rule.serviceId,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        effectiveFrom: rule.effectiveFrom.toISOString(),
        effectiveTo: rule.effectiveTo ? rule.effectiveTo.toISOString() : null,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      };

      res.json(ruleDto);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      // Handle repository error for rule not found
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'Availability rule not found' });
        return;
      }
      next(error);
    }
  });

  /**
   * DELETE /v1/tenant-admin/availability-rules/:id
   * Delete availability rule
   * Verifies rule belongs to authenticated tenant
   *
   * @param id - Availability rule CUID
   * @returns 204 - Rule deleted successfully
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Rule not found or belongs to different tenant
   * @returns 500 - Internal server error
   */
  router.delete(
    '/availability-rules/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantAuth = res.locals.tenantAuth;
        if (!tenantAuth) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }
        const tenantId = tenantAuth.tenantId;

        const { id } = req.params;

        // Verify rule exists by attempting to fetch all and find the matching one
        // (Repository doesn't have a getById method, so we verify via getAll)
        const allRules = await availabilityRuleRepo.getAll(tenantId);
        const ruleExists = allRules.some((rule) => rule.id === id);

        if (!ruleExists) {
          res.status(404).json({ error: 'Availability rule not found' });
          return;
        }

        // Delete rule
        await availabilityRuleRepo.delete(tenantId, id);

        logger.info({ tenantId, ruleId: id }, 'Availability rule deleted by tenant admin');

        res.status(204).send();
      } catch (error) {
        if (error instanceof NotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        next(error);
      }
    }
  );

  // ============================================================================
  // Appointment View Endpoint (Read-Only)
  // ============================================================================

  /**
   * GET /v1/tenant-admin/appointments
   * List all time-slot appointments for authenticated tenant
   * Query params: ?status=CONFIRMED&serviceId=xyz&startDate=2025-01-01&endDate=2025-12-31&limit=50&offset=0
   *
   * P1 #276 FIX: Enforce pagination defaults at route level to prevent DoS via unbounded queries
   * Defense-in-depth: Route enforces limits, repository also enforces for safety
   *
   * @query status - Optional booking status filter (PENDING, CONFIRMED, CANCELED, FULFILLED)
   * @query serviceId - Optional service ID filter
   * @query startDate - Optional start date filter (YYYY-MM-DD)
   * @query endDate - Optional end date filter (YYYY-MM-DD)
   * @query limit - Maximum results to return (default 100, max 500)
   * @query offset - Number of results to skip for pagination (default 0)
   * @returns 200 - Array of appointment bookings
   * @returns 400 - Validation error (invalid date format or pagination params)
   * @returns 401 - Missing or invalid authentication
   * @returns 500 - Internal server error
   */
  router.get('/appointments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // P1 #276: Pagination constants - aligned with repository layer (defense-in-depth)
      const DEFAULT_LIMIT = 100;
      const MAX_LIMIT = 500;

      const { status, serviceId, startDate, endDate, limit, offset } = req.query;

      // Validate date formats if provided
      if (startDate && typeof startDate === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        res.status(400).json({ error: 'Invalid startDate format. Use YYYY-MM-DD' });
        return;
      }
      if (endDate && typeof endDate === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        res.status(400).json({ error: 'Invalid endDate format. Use YYYY-MM-DD' });
        return;
      }

      // Validate and enforce pagination parameters with defaults
      let parsedLimit: number = DEFAULT_LIMIT;
      let parsedOffset: number = 0;

      if (limit !== undefined) {
        const limitValue = parseInt(limit as string, 10);
        if (isNaN(limitValue) || limitValue < 1) {
          res.status(400).json({ error: 'Invalid limit parameter. Must be a positive integer' });
          return;
        }
        // Cap at MAX_LIMIT even if client requests more
        parsedLimit = Math.min(limitValue, MAX_LIMIT);

        // Log when limit exceeds maximum (for monitoring potential abuse)
        if (limitValue > MAX_LIMIT) {
          logger.warn(
            {
              tenantId,
              requestedLimit: limitValue,
              enforcedLimit: MAX_LIMIT,
              context: 'appointments_endpoint',
            },
            'Client requested limit exceeds maximum, capped at MAX_LIMIT'
          );
        }
      }

      if (offset !== undefined) {
        parsedOffset = parseInt(offset as string, 10);
        if (isNaN(parsedOffset) || parsedOffset < 0) {
          res
            .status(400)
            .json({ error: 'Invalid offset parameter. Must be a non-negative integer' });
          return;
        }
      }

      // Validate date range (max 90 days to prevent abuse)
      if (startDate && endDate && typeof startDate === 'string' && typeof endDate === 'string') {
        const daysDiff = Math.floor(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 90) {
          res.status(400).json({ error: 'Date range cannot exceed 90 days' });
          return;
        }
      }

      // Use server-side filtering via repository for efficient queries
      const appointments = await bookingRepo.findAppointments(tenantId, {
        status: typeof status === 'string' ? status : undefined,
        serviceId: typeof serviceId === 'string' ? serviceId : undefined,
        startDate: typeof startDate === 'string' ? startDate : undefined,
        endDate: typeof endDate === 'string' ? endDate : undefined,
        limit: parsedLimit,
        offset: parsedOffset,
      });

      res.json(appointments);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      next(error);
    }
  });

  return router;
}
