'use server';

import { auth, unstable_update, getBackendToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { API_URL } from '@/lib/config';

/**
 * API response types for impersonation endpoints
 */
interface ImpersonateResponse {
  token: string;
  email: string;
  role: 'PLATFORM_ADMIN' | 'TENANT_ADMIN';
  tenantId: string;
  slug: string;
  impersonation: {
    tenantId: string;
    tenantSlug: string;
    tenantEmail: string;
    startedAt: string;
  };
}

interface StopImpersonationResponse {
  token: string;
  email: string;
  role: 'PLATFORM_ADMIN';
}

/**
 * Safely parse JSON response, handling non-JSON error responses
 */
async function safeParseJSON<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || `Request failed with status ${response.status}`);
  }
}

/**
 * Impersonate a tenant
 *
 * Allows PLATFORM_ADMIN to view the platform as a specific tenant.
 * Updates both the backend token cookie and NextAuth session.
 */
export async function impersonateTenant(tenantId: string) {
  const session = await auth();

  if (session?.user?.role !== 'PLATFORM_ADMIN') {
    throw new Error('Unauthorized');
  }

  if (session?.user?.impersonation) {
    throw new Error('Cannot impersonate while already impersonating');
  }

  const backendToken = await getBackendToken();
  if (!backendToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/v1/auth/impersonate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${backendToken}`,
    },
    body: JSON.stringify({ tenantId }),
  });

  if (!response.ok) {
    const error = await safeParseJSON<{ message?: string }>(response);
    throw new Error(error.message || 'Impersonation failed');
  }

  const data = await safeParseJSON<ImpersonateResponse>(response);

  // Store original token for rollback in case signIn fails
  const cookieStore = await cookies();
  const originalToken = cookieStore.get('mais_backend_token')?.value;

  // Update backend token cookie with impersonation token
  cookieStore.set('mais_backend_token', data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 4 * 60 * 60, // 4 hours for impersonation sessions
    path: '/',
  });

  try {
    // Update NextAuth session with impersonation data using unstable_update
    // This is more reliable than signIn() in Server Actions because it directly
    // updates the session cookie without going through the full auth flow
    //
    // Note: We cast to 'unknown' first because:
    // 1. MAISSession.user intentionally excludes backendToken (security - not sent to client)
    // 2. But the JWT callback needs backendToken to update the server-side JWT
    // 3. unstable_update passes this entire object to jwt callback with trigger='update'
    // 4. The jwt callback in auth.ts handles extracting backendToken from session.user
    await unstable_update({
      user: {
        id: data.tenantId,
        email: data.email,
        role: data.role,
        tenantId: data.tenantId,
        slug: data.slug,
        impersonation: data.impersonation,
        backendToken: data.token, // Passed to JWT callback, not exposed to client
      } as unknown as { id: string; email: string },
    });

    logger.info('Impersonation session started', {
      adminEmail: session.user.email,
      targetTenantId: data.tenantId,
      targetSlug: data.slug,
    });
  } catch (error) {
    // Rollback cookie if session update fails to prevent session desync
    logger.error('Failed to sync session after impersonation', { error });
    if (originalToken) {
      cookieStore.set('mais_backend_token', originalToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
        path: '/',
      });
    } else {
      cookieStore.delete('mais_backend_token');
    }
    throw new Error('Failed to start impersonation session');
  }

  revalidatePath('/');
  redirect('/tenant/dashboard');
}

/**
 * Stop impersonating a tenant
 *
 * Returns the PLATFORM_ADMIN to their normal admin view.
 * Restores the original admin token and clears impersonation state.
 */
export async function stopImpersonation() {
  const session = await auth();

  if (!session?.user?.impersonation) {
    redirect('/admin/tenants');
  }

  const backendToken = await getBackendToken();
  if (!backendToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/v1/auth/stop-impersonation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${backendToken}`,
    },
  });

  if (!response.ok) {
    const error = await safeParseJSON<{ message?: string }>(response);
    throw new Error(error.message || 'Failed to stop impersonation');
  }

  const data = await safeParseJSON<StopImpersonationResponse>(response);

  // Store impersonation token for rollback in case signIn fails
  const cookieStore = await cookies();
  const impersonationToken = cookieStore.get('mais_backend_token')?.value;

  // Restore admin token
  cookieStore.set('mais_backend_token', data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // Back to normal 24 hour session
    path: '/',
  });

  try {
    // Update NextAuth session to clear impersonation data using unstable_update
    // This is more reliable than signIn() in Server Actions
    //
    // Note: Same type assertion pattern as impersonateTenant - see comments there
    await unstable_update({
      user: {
        id: session.user.id,
        email: data.email,
        role: data.role,
        tenantId: undefined, // Clear tenant context
        slug: undefined,
        backendToken: data.token, // Restore admin token
        impersonation: undefined, // Clear impersonation
      } as unknown as { id: string; email: string },
    });

    logger.info('Impersonation session ended', {
      adminEmail: data.email,
    });
  } catch (error) {
    // Rollback cookie if session update fails to prevent session desync
    logger.error('Failed to sync session after stopping impersonation', { error });
    if (impersonationToken) {
      cookieStore.set('mais_backend_token', impersonationToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 4 * 60 * 60,
        path: '/',
      });
    }
    throw new Error('Failed to restore admin session');
  }

  revalidatePath('/');
  redirect('/admin/tenants');
}
