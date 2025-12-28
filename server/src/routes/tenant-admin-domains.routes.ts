/**
 * Tenant Admin Domain Routes
 * Authenticated routes for tenant administrators to manage custom domains
 * Requires tenant admin authentication via JWT
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z, ZodError } from 'zod';
import type { DomainVerificationService } from '../services/domain-verification.service';
import { logger } from '../lib/core/logger';

// Validation schemas
const addDomainSchema = z.object({
  domain: z
    .string()
    .min(4, 'Domain must be at least 4 characters')
    .max(253, 'Domain must be at most 253 characters')
    .transform((d) => d.toLowerCase().trim()),
});

const domainIdSchema = z.object({
  id: z.string().min(1, 'Domain ID is required'),
});

/**
 * Create tenant admin domain routes
 * All routes require tenant admin authentication (applied via middleware)
 *
 * @param domainService - Domain verification service instance
 * @returns Express router with domain management endpoints
 */
export function createTenantAdminDomainsRouter(domainService: DomainVerificationService): Router {
  const router = Router();

  /**
   * GET /v1/tenant/admin/domains
   * List all custom domains for authenticated tenant
   *
   * @returns 200 - Array of domains with verification status
   * @returns 401 - Missing or invalid authentication
   * @returns 500 - Internal server error
   */
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      const domains = await domainService.getDomains(tenantId);

      res.json(domains);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant/admin/domains
   * Add a new custom domain for verification
   *
   * Request body:
   * { domain: string }
   *
   * @returns 201 - Created domain with verification instructions
   * @returns 400 - Invalid domain or already exists
   * @returns 401 - Missing or invalid authentication
   * @returns 500 - Internal server error
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      // Validate request body
      const { domain } = addDomainSchema.parse(req.body);

      // Add domain
      const domainInfo = await domainService.addDomain(tenantId, domain);

      // Include verification instructions in response
      const response = {
        ...domainInfo,
        verificationInstructions: {
          recordType: 'TXT',
          recordName: `_handled-verify.${domain}`,
          recordValue: `handled-verify=${domainInfo.verificationToken}`,
          description: 'Add this TXT record to your DNS configuration, then click "Verify Domain".',
        },
      };

      logger.info({ tenantId, domain }, 'Domain added for verification');

      res.status(201).json(response);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error.message?.includes('already')) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error.message === 'Invalid domain format') {
        res.status(400).json({ error: 'Invalid domain format' });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /v1/tenant/admin/domains/:id
   * Get domain details by ID
   *
   * @param id - Domain ID
   * @returns 200 - Domain info with verification status
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Domain not found
   * @returns 500 - Internal server error
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      const { id } = domainIdSchema.parse(req.params);

      const domain = await domainService.getDomain(tenantId, id);

      if (!domain) {
        res.status(404).json({ error: 'Domain not found' });
        return;
      }

      res.json(domain);
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

  /**
   * POST /v1/tenant/admin/domains/:id/verify
   * Verify domain by checking DNS TXT record
   *
   * @param id - Domain ID
   * @returns 200 - Verification result
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Domain not found
   * @returns 500 - Internal server error
   */
  router.post('/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      const { id } = domainIdSchema.parse(req.params);

      const result = await domainService.verifyDomain(tenantId, id);

      if (result.verified) {
        logger.info({ tenantId, domainId: id }, 'Domain verified successfully');
      }

      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error.message === 'Domain not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * POST /v1/tenant/admin/domains/:id/primary
   * Set domain as primary (for canonical URL)
   *
   * @param id - Domain ID
   * @returns 200 - Updated domain
   * @returns 400 - Domain not verified
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Domain not found
   * @returns 500 - Internal server error
   */
  router.post('/:id/primary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      const { id } = domainIdSchema.parse(req.params);

      const domain = await domainService.setPrimaryDomain(tenantId, id);

      logger.info({ tenantId, domainId: id, domain: domain.domain }, 'Domain set as primary');

      res.json(domain);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error.message === 'Domain not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message?.includes('verified')) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * DELETE /v1/tenant/admin/domains/:id
   * Remove a custom domain
   *
   * @param id - Domain ID
   * @returns 204 - Domain deleted
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Domain not found
   * @returns 500 - Internal server error
   */
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      const { id } = domainIdSchema.parse(req.params);

      await domainService.removeDomain(tenantId, id);

      logger.info({ tenantId, domainId: id }, 'Domain removed');

      res.status(204).send();
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error.message === 'Domain not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
