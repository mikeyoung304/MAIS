/**
 * Landing Page API Route
 *
 * Proxies requests to the backend API with authentication.
 * Used by the tenant admin pages to get/update landing page configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Force dynamic rendering - this route uses cookies for authentication
export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * GET /api/tenant/landing-page
 *
 * Fetches the current landing page configuration.
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getBackendToken(request);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${API_BASE_URL}/v1/tenant-admin/landing-page`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: data.message || 'Failed to fetch landing page configuration' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.error('Landing page API error', { error, method: 'GET' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
