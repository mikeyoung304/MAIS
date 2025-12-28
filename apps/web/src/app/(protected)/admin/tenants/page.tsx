import { getBackendToken } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, CreditCard } from 'lucide-react';
import { impersonateTenant } from './actions';

export const metadata = {
  title: 'Tenants | HANDLED Admin',
};

interface Tenant {
  id: string;
  slug: string;
  name: string;
  email: string;
  createdAt: string;
  stripeConnected: boolean;
  packageCount: number;
}

async function getTenants(): Promise<Tenant[]> {
  const token = await getBackendToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/v1/admin/tenants`,
    {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    }
  );

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
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-text-primary mb-2">Tenants</h1>
        <p className="text-text-muted">Manage and impersonate tenant accounts</p>
      </div>

      {tenants.length === 0 ? (
        <Card className="border-dashed border-2 border-sage/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-text-muted mb-4" />
            <p className="text-text-muted text-center">No tenants found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <Card
              key={tenant.id}
              className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-serif text-xl">{tenant.name}</CardTitle>
                  {tenant.stripeConnected ? (
                    <Badge variant="success">
                      <CreditCard className="h-3 w-3 mr-1" />
                      Stripe
                    </Badge>
                  ) : (
                    <Badge variant="secondary">No Payments</Badge>
                  )}
                </div>
                <p className="text-text-muted text-sm">{tenant.email}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-text-muted mb-4">
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {tenant.slug}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <form action={impersonateTenant.bind(null, tenant.id)} className="flex-1">
                    <Button type="submit" variant="sage" size="sm" className="w-full">
                      Impersonate
                    </Button>
                  </form>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/t/${tenant.slug}`} target="_blank" rel="noopener noreferrer">
                      View Site
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
