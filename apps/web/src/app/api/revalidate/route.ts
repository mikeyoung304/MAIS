import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * ISR Revalidation API Route
 *
 * Called by the Express API to trigger on-demand revalidation of tenant pages
 * after config changes (landingPageConfig, branding, packages).
 *
 * Security:
 * - Protected with NEXTJS_REVALIDATE_SECRET
 * - Only accepts requests with matching secret
 *
 * Usage:
 * POST /api/revalidate?path=/t/[slug]&secret=<NEXTJS_REVALIDATE_SECRET>
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');
  const secret = searchParams.get('secret');

  // Validate secret
  const expectedSecret = process.env.NEXTJS_REVALIDATE_SECRET;

  if (!expectedSecret) {
    console.error('NEXTJS_REVALIDATE_SECRET not configured');
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

  try {
    // Revalidate the specified path
    revalidatePath(path);

    console.log(`Revalidated path: ${path}`);

    return NextResponse.json({
      revalidated: true,
      path,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Revalidation error:', error);
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
