/**
 * Proxy Error Response Helpers
 *
 * Provides consistent error responses across all API proxy routes.
 * This ensures uniform error formats for debugging and security.
 *
 * Security Note: Error responses intentionally avoid revealing
 * specific authentication failure modes to prevent information leakage.
 *
 * @see apps/web/src/app/api/agent/[...path]/route.ts
 * @see apps/web/src/app/api/tenant-admin/[...path]/route.ts
 */

import { NextResponse } from 'next/server';

/**
 * Standard error response format for all proxy routes
 */
interface ProxyErrorResponse {
  error: string;
  message: string;
}

/**
 * Returns a 401 Unauthorized response
 *
 * Used when authentication is missing or invalid.
 * Does NOT reveal specific failure mode for security.
 */
export function unauthorizedResponse(): NextResponse<ProxyErrorResponse> {
  return NextResponse.json(
    { error: 'UNAUTHORIZED', message: 'Authentication required' },
    { status: 401 }
  );
}

/**
 * Returns a 400 Bad Request response
 *
 * Used for invalid request parameters (e.g., path traversal attempts)
 */
export function badRequestResponse(message: string): NextResponse<ProxyErrorResponse> {
  return NextResponse.json({ error: 'BAD_REQUEST', message }, { status: 400 });
}

/**
 * Returns a 500 Internal Server Error response
 *
 * Used when proxy encounters an unexpected error.
 * Does NOT reveal internal error details for security.
 */
export function serverErrorResponse(): NextResponse<ProxyErrorResponse> {
  return NextResponse.json(
    { error: 'INTERNAL_ERROR', message: 'Internal server error' },
    { status: 500 }
  );
}
