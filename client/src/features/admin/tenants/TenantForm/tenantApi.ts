import { baseUrl } from '@/lib/api';
import type { TenantFormData } from './types';

export const tenantApi = {
  async loadTenant(id: string) {
    const token = localStorage.getItem('adminToken');
    const response = await fetch(`${baseUrl}/v1/admin/tenants/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to load tenant');
    }

    const data = await response.json();
    const tenant = data.tenant;

    return {
      name: tenant.name,
      slug: tenant.slug,
      email: tenant.email || '',
      phone: tenant.phone || '',
      commissionRate: Number(tenant.commissionPercent || 10),
      stripeAccountId: tenant.stripeAccountId || '',
      isActive: tenant.isActive !== false,
    } as TenantFormData;
  },

  async createTenant(formData: TenantFormData) {
    const token = localStorage.getItem('adminToken');
    const response = await fetch(`${baseUrl}/v1/admin/tenants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        slug: formData.slug,
        name: formData.name,
        email: formData.email || undefined,
        commission: formData.commissionRate,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create tenant' }));
      throw new Error(error.error || 'Failed to create tenant');
    }

    return response.json();
  },

  async updateTenant(id: string, formData: TenantFormData) {
    const token = localStorage.getItem('adminToken');
    const response = await fetch(`${baseUrl}/v1/admin/tenants/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: formData.name,
        slug: formData.slug,
        email: formData.email,
        phone: formData.phone || undefined,
        commissionRate: formData.commissionRate,
        stripeAccountId: formData.stripeAccountId || undefined,
        isActive: formData.isActive,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update tenant' }));
      throw new Error(error.error || 'Failed to update tenant');
    }

    return response.json();
  },
};
