'use server';

import { auth, signIn, getBackendToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    const error = await response.json();
    throw new Error(error.message || 'Impersonation failed');
  }

  const data = await response.json();

  // Update backend token cookie with impersonation token
  const cookieStore = await cookies();
  cookieStore.set('mais_backend_token', data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 4 * 60 * 60, // 4 hours for impersonation sessions
    path: '/',
  });

  // Re-authenticate to update NextAuth session with impersonation data
  await signIn('credentials', {
    token: data.token,
    email: data.email,
    role: data.role,
    tenantId: data.tenantId,
    slug: data.slug,
    impersonation: JSON.stringify(data.impersonation),
    redirect: false,
  });

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
    throw new Error('Failed to stop impersonation');
  }

  const data = await response.json();

  // Restore admin token
  const cookieStore = await cookies();
  cookieStore.set('mais_backend_token', data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // Back to normal 24 hour session
    path: '/',
  });

  // Re-authenticate as admin (no impersonation)
  await signIn('credentials', {
    token: data.token,
    email: data.email,
    role: data.role,
    redirect: false,
  });

  revalidatePath('/');
  redirect('/admin/tenants');
}
