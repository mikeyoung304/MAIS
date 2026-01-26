/**
 * Tenant Admin API Proxy Route
 *
 * Proxies all /api/tenant-admin/* requests to the backend API with authentication.
 * This allows client components to make API calls without exposing the backend token.
 *
 * The backend token is securely retrieved from the NextAuth session JWT and added
 * to the request headers.
 *
 * Supports both JSON and multipart/form-data (for file uploads).
 *
 * Example:
 *   Client calls: /api/tenant-admin/packages
 *   Proxied to:   ${API_BASE_URL}/v1/tenant-admin/packages
 *
 * @see apps/web/src/app/api/agent/[...path]/route.ts - Same pattern for agent proxy
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { unauthorizedResponse, badRequestResponse, serverErrorResponse } from '@/lib/proxy-errors';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Handle all HTTP methods
 */
async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Get backend token from NextAuth session (same pattern as agent proxy)
    const token = await getBackendToken(request);

    if (!token) {
      logger.debug('Tenant admin proxy: No backend token in session');
      return unauthorizedResponse();
    }

    const { path } = await params;

    // Validate path segments to prevent traversal attempts
    if (path.some((segment) => segment === '..' || segment === '.' || segment === '')) {
      return badRequestResponse('Invalid path');
    }

    const pathString = path.join('/');
    const url = new URL(request.url);
    const queryString = url.search;

    // Build the backend URL
    const backendUrl = `${API_BASE_URL}/v1/tenant-admin/${pathString}${queryString}`;

    // Prepare headers - always include auth
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };

    const method = request.method;
    let body: BodyInit | undefined;

    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = request.headers.get('content-type');

      // Handle multipart/form-data separately - forward the raw body
      // Don't set Content-Type header - let fetch set it with proper boundary
      if (contentType?.includes('multipart/form-data')) {
        // Clone the request to get the form data
        const formData = await request.formData();
        body = formData;
        // Note: We intentionally don't set Content-Type for multipart
        // The fetch API will set it correctly with the boundary
      } else {
        // For JSON and other content types, forward as text
        if (contentType) {
          headers['Content-Type'] = contentType;
        }
        body = await request.text();
      }
    }

    // Make the request to the backend
    const response = await fetch(backendUrl, {
      method,
      headers,
      body,
    });

    // Get response data
    const responseText = await response.text();
    let responseData: unknown;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      // Not JSON, return as-is
      return new NextResponse(responseText, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'text/plain',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    return NextResponse.json(responseData, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    logger.error('Tenant admin API proxy error', {
      error,
      method: request.method,
      url: request.url,
    });
    return serverErrorResponse();
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}
