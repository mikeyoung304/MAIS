/**
 * Client-side ts-rest API client for Next.js Client Components
 *
 * This module is safe to import in 'use client' components.
 * It does NOT import any server-only APIs like next/headers.
 *
 * For Server Components, use api.server.ts instead.
 */

import { initClient } from '@ts-rest/core';
import { Contracts } from '@macon/contracts';
import { API_URL } from '@/lib/config';

/**
 * Client-side API client for use in Client Components
 *
 * This version reads tokens from cookies automatically via browser.
 * Use this in 'use client' components with React Query.
 */
export function createClientApiClient() {
  // On the client, cookies are sent automatically with fetch
  // We just need to set credentials: 'include'
  return initClient(Contracts, {
    baseUrl: API_URL,
    baseHeaders: {},
    api: async ({ path, method, headers, body }) => {
      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include', // Include cookies automatically
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
