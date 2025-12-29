/**
 * Express type extensions for tenant authentication
 */

import type { TenantTokenPayload } from '../lib/ports';

declare global {
  namespace Express {
    interface Request {
      /** Tenant ID set by tenant middleware for public routes */
      tenantId?: string;
    }
    interface Locals {
      tenantAuth?: TenantTokenPayload;
      logger?: any;
    }
  }
}
