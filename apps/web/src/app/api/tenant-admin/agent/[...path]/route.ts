/**
 * Tenant Admin Agent API Proxy Route
 *
 * Proxies all /api/tenant-admin/agent/* requests to the backend Concierge agent API.
 * This allows dashboard components to chat with the Vertex AI Concierge agent
 * without exposing the backend token.
 *
 * The backend token is securely retrieved from the server-side session and added
 * to the request headers.
 *
 * Example:
 *   Client calls: /api/tenant-admin/agent/chat
 *   Proxied to:   ${API_BASE_URL}/v1/tenant-admin/agent/chat
 *
 * Endpoints proxied:
 *   - POST /chat - Send message to Concierge
 *   - GET /session/:id - Get session history
 *   - POST /session - Create new session
 *   - DELETE /session/:id - Close session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { unauthorizedResponse, badRequestResponse, serverErrorResponse } from '@/lib/proxy-errors';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Handle all HTTP methods for tenant admin agent routes
 */
async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const token = await getBackendToken(request);

    if (!token) {
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

    // Build the backend URL - route to tenant-admin/agent endpoint
    const backendUrl = `${API_BASE_URL}/v1/tenant-admin/agent/${pathString}${queryString}`;

    // Prepare headers
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };

    // Add content-type for requests with body
    const method = request.method;
    let body: string | undefined;

    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = request.headers.get('content-type');
      if (contentType) {
        headers['Content-Type'] = contentType;
      }
      body = await request.text();
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
        },
      });
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    logger.error('Tenant admin agent API proxy error', {
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}
