'use server';

import { auth, getBackendToken } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { API_URL } from '@/lib/config';

interface UpdateTenantInput {
  name: string;
  commission: number;
  isActive: boolean;
}

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Update tenant settings via the admin API
 */
export async function updateTenant(id: string, input: UpdateTenantInput): Promise<ActionResult> {
  const session = await auth();
  if (session?.user?.role !== 'PLATFORM_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  const token = await getBackendToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${API_URL}/v1/admin/tenants/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: input.name,
        commission: input.commission,
        isActive: input.isActive,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || 'Failed to update tenant',
      };
    }

    // Revalidate pages
    revalidatePath(`/admin/tenants/${id}`);
    revalidatePath('/admin/tenants');

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update tenant',
    };
  }
}

/**
 * Deactivate (soft delete) a tenant
 */
export async function deactivateTenant(id: string): Promise<ActionResult> {
  const session = await auth();
  if (session?.user?.role !== 'PLATFORM_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  const token = await getBackendToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${API_URL}/v1/admin/tenants/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        error: data.message || data.error || 'Failed to deactivate tenant',
      };
    }

    // Revalidate the tenants list
    revalidatePath('/admin/tenants');

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to deactivate tenant',
    };
  }
}
