/**
 * Agent API Proxy Route
 *
 * Proxies all /api/agent/* requests to the backend API with authentication.
 * This allows client components to make API calls without exposing the backend token.
 *
 * The backend token is securely retrieved from the server-side session and added
 * to the request headers.
 *
 * Example:
 *   Client calls: /api/agent/health
 *   Proxied to:   ${API_BASE_URL}/v1/agent/health
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Handle all HTTP methods
 */
async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const token = await getBackendToken();

    if (!token) {
      // Return a user-friendly message when not authenticated
      return NextResponse.json(
        {
          available: false,
          reason: 'not_authenticated',
          message: 'Please sign in to access your assistant.',
        },
        { status: 401 }
      );
    }

    const { path } = await params;

    // Validate path segments to prevent traversal attempts
    if (path.some((segment) => segment === '..' || segment === '.' || segment === '')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const pathString = path.join('/');
    const url = new URL(request.url);
    const queryString = url.search;

    // Build the backend URL
    const backendUrl = `${API_BASE_URL}/v1/agent/${pathString}${queryString}`;

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
    logger.error('Agent API proxy error', {
      error,
      method: request.method,
      url: request.url,
    });
    return NextResponse.json(
      {
        available: false,
        reason: 'proxy_error',
        message: 'Having trouble connecting to your assistant. Try again?',
      },
      { status: 500 }
    );
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
