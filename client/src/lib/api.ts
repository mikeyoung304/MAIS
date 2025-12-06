/**
 * ts-rest API client
 * Bound to @macon/contracts for type-safe API calls
 */

import { initClient } from '@ts-rest/core';
import { Contracts } from '@macon/contracts';

/**
 * Normalized API base URL
 *
 * Removes trailing slashes for consistent URL construction.
 * Defaults to localhost:3001 for local development.
 *
 * @example
 * ```typescript
 * console.log(baseUrl); // "http://localhost:3001"
 * ```
 */
// Normalize base URL (remove trailing slashes)
const raw = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
export const baseUrl = raw.replace(/\/+$/, '');

/**
 * Global tenant API key for multi-tenant widget mode
 * Set via api.setTenantKey() when widget loads
 * Also restored from localStorage for impersonation persistence across page loads
 */
let tenantApiKey: string | null = localStorage.getItem('impersonationTenantKey');

/**
 * Global tenant JWT token for tenant admin dashboard
 * Set via api.setTenantToken() when tenant logs in
 */
let tenantToken: string | null = null;

/**
 * Extended API client with additional methods for auth management
 */
interface ExtendedApiClient extends ReturnType<typeof initClient> {
  setTenantKey: (key: string | null) => void;
  setTenantToken: (token: string | null) => void;
  logoutTenant: () => void;
  adminGetTenants: () => Promise<{
    status: number;
    body: {
      tenants: Array<{
        id: string;
        slug: string;
        name: string;
        apiKeyPublic: string;
        commissionPercent: number;
        stripeOnboarded: boolean;
        stripeAccountId: string | null;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
        stats: {
          bookings: number;
          packages: number;
          addOns: number;
        };
      }>;
    } | null;
  }>;
  adminImpersonate: (tenantId: string) => Promise<{
    status: number;
    body: {
      token: string;
      role: 'PLATFORM_ADMIN';
      email: string;
      userId: string;
      tenantId: string;
      slug: string;
    } | null;
  }>;
  adminStopImpersonation: () => Promise<{
    status: number;
    body: {
      token: string;
      role: 'PLATFORM_ADMIN';
      email: string;
      userId: string;
    } | null;
  }>;
}

/**
 * Type-safe API client for Elope wedding booking platform
 *
 * Provides end-to-end type safety between client and server via ts-rest contracts.
 * Automatically injects admin JWT tokens for protected routes.
 * Supports multi-tenant mode via X-Tenant-Key header.
 *
 * Features:
 * - Auto-generated TypeScript types from server contracts
 * - Admin authentication via localStorage token
 * - Multi-tenant support via tenant API key
 * - JSON content-type headers
 * - Error-safe JSON parsing with fallback to null
 *
 * @example
 * ```typescript
 * // Public route - no auth required
 * const { status, body } = await api.catalog.getPackages();
 * if (status === 200) {
 *   console.log(body); // Type-safe PackageWithAddOns[]
 * }
 *
 * // Protected route - JWT from localStorage
 * const { status, body } = await api.admin.getBookings();
 * // Automatically includes "Authorization: Bearer <token>" header
 *
 * // Multi-tenant mode - set tenant key once
 * api.setTenantKey('pk_live_xxx');
 * // All subsequent requests include "X-Tenant-Key" header
 * ```
 */
export const api = initClient(Contracts, {
  baseUrl,
  baseHeaders: {},
  api: async ({ path, method, headers, body }) => {
    // Build headers dynamically - start with ts-rest's headers (includes Content-Type)
    const requestHeaders: Record<string, string> = { ...headers };

    // Inject auth token for admin routes
    // ts-rest v3.x provides full URL in path, so check if it contains the route pattern
    if (path.includes('/v1/admin') || path.includes('/api/v1/admin')) {
      const token = localStorage.getItem('adminToken');
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    // Inject auth token for tenant-admin routes
    // During impersonation, use adminToken (which contains impersonation context)
    // Otherwise use tenantToken for normal tenant admin access
    if (path.includes('/v1/tenant-admin')) {
      // Check if we're impersonating (impersonationTenantKey is set)
      const isImpersonating = localStorage.getItem('impersonationTenantKey');
      if (isImpersonating) {
        // Use admin token with impersonation context
        const token = localStorage.getItem('adminToken');
        if (token) {
          requestHeaders['Authorization'] = `Bearer ${token}`;
        }
      } else {
        // Normal tenant admin - use tenant token
        const token = tenantToken || localStorage.getItem('tenantToken');
        if (token) {
          requestHeaders['Authorization'] = `Bearer ${token}`;
        }
      }
    }
    // Inject auth token for other tenant routes (not tenant-admin)
    else if (path.includes('/v1/tenant') && !path.includes('/v1/tenant-admin')) {
      const token = tenantToken || localStorage.getItem('tenantToken');
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    // Inject tenant key for multi-tenant mode (widget)
    if (tenantApiKey) {
      requestHeaders['X-Tenant-Key'] = tenantApiKey;
    }

    // ts-rest v3.x already serializes the body and sets Content-Type
    // Don't add duplicate headers or double-stringify
    // ts-rest v3.x also provides the complete URL in the path parameter
    const response = await fetch(path, {
      method,
      headers: requestHeaders,
      body: body,
    });

    return {
      status: response.status,
      body: await response.json().catch(() => null),
      headers: response.headers,
    };
  },
}) as ExtendedApiClient;

/**
 * Set tenant API key for multi-tenant widget mode
 * Call this once when the widget loads with tenant-specific key
 */
api.setTenantKey = (key: string | null) => {
  tenantApiKey = key;
};

/**
 * Set tenant JWT token for tenant admin dashboard
 * Call this when tenant logs in
 */
api.setTenantToken = (token: string | null) => {
  tenantToken = token;
  if (token) {
    localStorage.setItem('tenantToken', token);
  } else {
    localStorage.removeItem('tenantToken');
  }
};

/**
 * Logout tenant admin (clear tenant token)
 */
api.logoutTenant = () => {
  tenantToken = null;
  localStorage.removeItem('tenantToken');
};

/**
 * Get list of all tenants (platform admin only)
 */
api.adminGetTenants = async () => {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`${baseUrl}/api/v1/admin/tenants`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
};

/**
 * Start impersonating a tenant (platform admin only)
 */
api.adminImpersonate = async (tenantId: string) => {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`${baseUrl}/v1/auth/impersonate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tenantId }),
  });

  const body = await response.json().catch(() => null);

  // Update admin token to impersonation token
  if (response.status === 200 && body?.token) {
    localStorage.setItem('adminToken', body.token);

    // Set tenant API key for public routes to work during impersonation
    if (body.apiKeyPublic) {
      tenantApiKey = body.apiKeyPublic;
      localStorage.setItem('impersonationTenantKey', body.apiKeyPublic);
    }
  }

  return {
    status: response.status,
    body,
  };
};

/**
 * Stop impersonating and return to normal admin token
 */
api.adminStopImpersonation = async () => {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`${baseUrl}/v1/auth/stop-impersonation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const body = await response.json().catch(() => null);

  // Update admin token back to normal token
  if (response.status === 200 && body?.token) {
    localStorage.setItem('adminToken', body.token);
  }

  // Clear impersonation tenant key
  tenantApiKey = null;
  localStorage.removeItem('impersonationTenantKey');

  return {
    status: response.status,
    body,
  };
};
