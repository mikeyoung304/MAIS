/**
 * Client-side ts-rest API client for Next.js Client Components
 *
 * This module is safe to import in 'use client' components.
 * It does NOT import any server-only APIs like next/headers.
 *
 * IMPORTANT: For authenticated API calls, use the /api/* proxy routes instead.
 * The proxy pattern is required because:
 * 1. backendToken is stored in encrypted JWT, not readable client-side
 * 2. NextAuth cookies are HTTP-only for security
 * 3. The proxy reads the token server-side and injects the Authorization header
 *
 * Example (correct):
 *   fetch('/api/tenant-admin/packages', { method: 'GET' })
 *
 * Example (incorrect - will fail auth):
 *   fetch('http://localhost:3001/v1/tenant-admin/packages', { method: 'GET' })
 *
 * For Server Components, use api.server.ts instead.
 */

import { initClient } from '@ts-rest/core';
import { Contracts } from '@macon/contracts';

/**
 * Transform contract paths to Next.js proxy paths
 *
 * Contract paths use /v1/* but the Next.js proxy routes are at /api/*
 * This function maps authenticated routes to their proxy equivalents:
 *   /v1/tenant-admin/* → /api/tenant-admin/*
 *   /v1/agent/*        → /api/agent/*
 *   /v1/admin/*        → /api/admin/*
 *
 * Public endpoints (/v1/public/*) are not transformed as they go directly to backend.
 */
function transformToProxyPath(path: string): string {
  // Routes that need to go through Next.js proxy (for auth injection)
  if (path.startsWith('/v1/tenant-admin/')) {
    return path.replace('/v1/tenant-admin/', '/api/tenant-admin/');
  }
  if (path.startsWith('/v1/agent/')) {
    return path.replace('/v1/agent/', '/api/agent/');
  }
  if (path.startsWith('/v1/admin/')) {
    return path.replace('/v1/admin/', '/api/admin/');
  }
  // Public routes go directly to backend (with NEXT_PUBLIC_API_URL)
  return path;
}

/**
 * Client-side API client for use in Client Components
 *
 * This client automatically routes authenticated endpoints through Next.js proxy
 * routes which inject the auth token server-side. Public endpoints go directly
 * to the backend.
 *
 * Path transformation:
 *   /v1/tenant-admin/* → /api/tenant-admin/* (proxied, auth injected)
 *   /v1/agent/*        → /api/agent/*        (proxied, auth injected)
 *   /v1/admin/*        → /api/admin/*        (proxied, auth injected)
 *   /v1/public/*       → direct to backend   (no auth needed)
 */
export function createClientApiClient() {
  return initClient(Contracts, {
    baseUrl: '', // Empty = relative URLs for proxy routes
    baseHeaders: {},
    api: async ({ path, method, headers, body }) => {
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      // Transform authenticated routes to proxy paths
      const finalPath = transformToProxyPath(path);

      const response = await fetch(finalPath, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
      });

      const responseBody = await response.json().catch(() => null);

      return {
        status: response.status,
        body: responseBody,
        headers: response.headers,
      };
    },
  });
}
