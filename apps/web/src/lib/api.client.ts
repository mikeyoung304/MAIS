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
 * Client-side API client for use in Client Components
 *
 * WARNING: This client does NOT inject auth headers automatically.
 * For authenticated routes, use /api/* proxy routes which handle auth server-side.
 *
 * Only use this client for:
 * - Public/unauthenticated endpoints
 * - Routes where you manually handle auth via the proxy pattern
 */
export function createClientApiClient() {
  return initClient(Contracts, {
    baseUrl: '', // Empty = relative URLs, goes through Next.js proxy
    baseHeaders: {},
    api: async ({ path, method, headers, body }) => {
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      const response = await fetch(path, {
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
