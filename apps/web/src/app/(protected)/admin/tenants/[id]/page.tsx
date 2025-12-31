import Link from 'next/link';
import { getBackendToken } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CreditCard, Package, Calendar, User } from 'lucide-react';
import { EditTenantForm } from './EditTenantForm';
import { API_URL } from '@/lib/config';
import type { TenantDetail } from '../types';

async function getTenant(id: string): Promise<TenantDetail | null> {
  const token = await getBackendToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(`${API_URL}/v1/admin/tenants/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 }, // Always fresh for edits
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error('Failed to fetch tenant');
  }

  const data = await res.json();
  return data.tenant;
}

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getTenant(id);

  if (!tenant) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/admin/tenants"
        className="mb-6 inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tenants
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main edit form */}
        <div className="md:col-span-2">
          <EditTenantForm tenant={tenant} />
        </div>

        {/* Stats sidebar */}
        <div className="space-y-6">
          <Card colorScheme="dark">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-serif">Tenant Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-text-muted flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Stripe
                </span>
                {tenant.stripeConnected ? (
                  <Badge variant="success">Connected</Badge>
                ) : (
                  <Badge variant="secondary">Not Connected</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Packages
                </span>
                <span className="text-text-primary font-medium">{tenant.packageCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Bookings
                </span>
                <span className="text-text-primary font-medium">{tenant.bookingCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Status
                </span>
                {tenant.isActive ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="destructive">Inactive</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card colorScheme="dark">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-serif">API Keys</CardTitle>
              <CardDescription>Public key for client-side use</CardDescription>
            </CardHeader>
            <CardContent>
              <code className="text-xs font-mono text-sage break-all block p-2 bg-surface rounded border border-neutral-700">
                {tenant.apiKeyPublic}
              </code>
            </CardContent>
          </Card>

          <Card colorScheme="dark">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-serif">Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Created</span>
                <span className="text-text-primary">
                  {new Date(tenant.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Updated</span>
                <span className="text-text-primary">
                  {new Date(tenant.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
