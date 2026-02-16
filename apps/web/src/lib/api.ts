/**
 * SSR-aware ts-rest API client for Next.js
 *
 * This module provides a factory function to create ts-rest clients
 * that work in both Server Components (using cookies) and Client Components.
 *
 * Key differences from the Vite client:
 * - No global state (factory function creates fresh instance per request)
 * - Cookie-based auth instead of localStorage
 * - Works with Next.js App Router and Server Components
 */

import { initClient } from '@ts-rest/core';
import { cookies } from 'next/headers';
import { Contracts } from '@macon/contracts';
import { API_URL } from '@/lib/config';

/**
 * Cookie names for authentication tokens
 */
export const AUTH_COOKIES = {
  ADMIN_TOKEN: 'adminToken',
  TENANT_TOKEN: 'tenantToken',
  TENANT_API_KEY: 'tenantApiKey',
} as const;

/**
 * Create an SSR-aware API client for Server Components
 *
 * Usage in Server Component:
 * ```ts
 * const api = await createServerApiClient();
 * const tiers = await api.getTiers();
 * ```
 */
export async function createServerApiClient() {
  const cookieStore = await cookies();

  const tenantToken = cookieStore.get(AUTH_COOKIES.TENANT_TOKEN)?.value;
  const adminToken = cookieStore.get(AUTH_COOKIES.ADMIN_TOKEN)?.value;
  const tenantApiKey = cookieStore.get(AUTH_COOKIES.TENANT_API_KEY)?.value;

  return createApiClientWithAuth({
    tenantToken,
    adminToken,
    tenantApiKey,
  });
}

/**
 * Create an API client with specific auth credentials
 *
 * This is used internally by createServerApiClient and can be used
 * directly for testing or when you have tokens from other sources.
 */
export function createApiClientWithAuth(auth: {
  tenantToken?: string;
  adminToken?: string;
  tenantApiKey?: string;
}) {
  return initClient(Contracts, {
    baseUrl: API_URL,
    baseHeaders: {},
    api: async ({ path, method, headers, body }) => {
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      // Inject auth tokens based on route pattern
      if (path.includes('/v1/admin') && auth.adminToken) {
        requestHeaders['Authorization'] = `Bearer ${auth.adminToken}`;
      } else if (path.includes('/v1/tenant-admin')) {
        // Check for impersonation first
        if (auth.tenantApiKey && auth.adminToken) {
          requestHeaders['Authorization'] = `Bearer ${auth.adminToken}`;
        } else if (auth.tenantToken) {
          requestHeaders['Authorization'] = `Bearer ${auth.tenantToken}`;
        }
      } else if (path.includes('/v1/tenant') && auth.tenantToken) {
        requestHeaders['Authorization'] = `Bearer ${auth.tenantToken}`;
      }

      // Always include tenant API key if available (for multi-tenant context)
      if (auth.tenantApiKey) {
        requestHeaders['X-Tenant-Key'] = auth.tenantApiKey;
      }

      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store', // Disable caching for API requests
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

// NOTE: For client components, use createClientApiClient from '@/lib/api.client'
// This file imports next/headers which is server-only and cannot be used in 'use client' components
