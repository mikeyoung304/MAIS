'use server';

import { auth, getBackendToken } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { API_URL } from '@/lib/config';

interface CreateTenantInput {
  name: string;
  slug: string;
  commission: number;
}

interface CreateTenantResult {
  success: boolean;
  secretKey?: string;
  error?: string;
}

/**
 * Create a new tenant via the admin API
 *
 * Returns the secret key on success (shown once, never stored in plaintext)
 */
export async function createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
  const session = await auth();
  if (session?.user?.role !== 'PLATFORM_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  const token = await getBackendToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${API_URL}/v1/admin/tenants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: input.name,
        slug: input.slug,
        commission: input.commission,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || 'Failed to create tenant',
      };
    }

    // Revalidate the tenants list
    revalidatePath('/admin/tenants');

    return {
      success: true,
      secretKey: data.secretKey,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create tenant',
    };
  }
}
