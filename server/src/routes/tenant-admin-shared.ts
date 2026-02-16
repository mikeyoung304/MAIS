/**
 * Shared helpers for tenant-admin route sub-modules
 *
 * Contains utilities used across 3+ tenant-admin route files.
 * Helpers used in 1-2 files are kept inline in those files.
 */

import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { BadRequestError } from '../lib/errors';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { CatalogService } from '../services/catalog.service';
import type { BookingService } from '../services/booking.service';
import type { BlackoutRepository, StorageProvider } from '../lib/ports';
import type { SegmentService } from '../services/segment.service';
import type { SectionContentService } from '../services/section-content.service';

/**
 * Shared dependency interface for all tenant-admin route sub-modules
 */
export interface TenantAdminDeps {
  tenantRepository: PrismaTenantRepository;
  catalogService: CatalogService;
  bookingService: BookingService;
  blackoutRepo: BlackoutRepository;
  storageProvider: StorageProvider;
  segmentService?: SegmentService;
  sectionContentService?: SectionContentService;
}

/**
 * Extract tenantId from authenticated request.
 * Returns null if not authenticated, allowing route to handle 401.
 */
export function getTenantId(res: Response): string | null {
  const tenantAuth = res.locals.tenantAuth;
  return tenantAuth?.tenantId ?? null;
}

/**
 * Middleware to require authentication before proceeding.
 * Use this BEFORE rate limiters to ensure auth errors are returned
 * instead of rate limit errors (see issue #733).
 */
export function requireAuth(_req: Request, res: Response, next: NextFunction): void {
  if (!res.locals.tenantAuth) {
    res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
    return;
  }
  next();
}

/**
 * Multer error handler middleware.
 * Converts multer-specific errors (file size, field count, etc.) to proper HTTP status codes.
 */
export function handleMulterError(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      // 413 Payload Too Large — multer error messages are safe/controlled strings
      res.status(413).json({ error: 'File too large (max 5MB)' });
      return;
    }
    next(new BadRequestError(error.message));
    return;
  }
  // Not a multer error, pass to next handler
  next(error);
}
