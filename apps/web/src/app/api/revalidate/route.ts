import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * ISR Revalidation API Route
 *
 * Called by the Express API to trigger on-demand revalidation of tenant pages
 * after config changes (landingPageConfig, branding, packages).
 *
 * Security:
 * - Protected with NEXTJS_REVALIDATE_SECRET
 * - Only accepts requests with matching secret
 * - Rate limited to 10 requests per minute per path
 *
 * Usage:
 * POST /api/revalidate?path=/t/[slug]&secret=<NEXTJS_REVALIDATE_SECRET>
 */

// Simple in-memory rate limiting (resets on deployment)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests
const RATE_WINDOW = 60 * 1000; // 1 minute in ms

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }

  if (record.count >= RATE_LIMIT) {
    return true;
  }

  record.count++;
  return false;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');
  const secret = searchParams.get('secret');

  // Validate secret first
  const expectedSecret = process.env.NEXTJS_REVALIDATE_SECRET;

  if (!expectedSecret) {
    logger.error('NEXTJS_REVALIDATE_SECRET not configured');
    return NextResponse.json(
      { error: 'Revalidation not configured' },
      { status: 503 }
    );
  }

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json(
      { error: 'Invalid revalidation secret' },
      { status: 401 }
    );
  }

  // Validate path
  if (!path) {
    return NextResponse.json(
      { error: 'Missing path parameter' },
      { status: 400 }
    );
  }

  // Only allow revalidation of tenant paths
  if (!path.startsWith('/t/')) {
    return NextResponse.json(
      { error: 'Invalid path - only tenant paths allowed' },
      { status: 400 }
    );
  }

  // Rate limit per path
  const rateLimitKey = `revalidate:${path}`;
  if (isRateLimited(rateLimitKey)) {
    logger.warn('Rate limit exceeded for revalidation', { path });
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in 1 minute.' },
      { status: 429 }
    );
  }

  try {
    // Revalidate the specified path
    revalidatePath(path);

    logger.info('Revalidated path', { path });

    return NextResponse.json({
      revalidated: true,
      path,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Revalidation error', error instanceof Error ? error : { error });
    return NextResponse.json(
      {
        error: 'Revalidation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support GET for testing/debugging (but still require secret)
export async function GET(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
