import Link from 'next/link';
import { getBackendToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TenantsList } from './TenantsList';
import { API_URL } from '@/lib/config';
import type { Tenant } from './types';

export const metadata = {
  title: 'Tenants | HANDLED Admin',
};

async function getTenants(): Promise<Tenant[]> {
  const token = await getBackendToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(`${API_URL}/v1/admin/tenants`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch tenants');
  }

  const data = await res.json();
  return data.tenants;
}

export default async function TenantsPage() {
  const tenants = await getTenants();

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary mb-2">Tenants</h1>
          <p className="text-text-muted">Manage and impersonate tenant accounts</p>
        </div>
        <Button variant="sage" asChild>
          <Link href="/admin/tenants/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Tenant
          </Link>
        </Button>
      </div>

      <TenantsList tenants={tenants} />
    </div>
  );
}
