import { useState } from 'react';
import { Users, LogIn, XCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type Tenant = {
  id: string;
  slug: string;
  name: string;
  apiKeyPublic: string;
  commissionPercent: number;
  stripeOnboarded: boolean;
  stripeAccountId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stats: {
    bookings: number;
    packages: number;
    addOns: number;
  };
};

interface TenantsTabProps {
  tenants: Tenant[];
  isLoading: boolean;
  onRefresh: () => void;
}

/**
 * Tenants Tab Component
 *
 * Displays list of all tenants with impersonation buttons for platform admin.
 * Allows admin to sign into any tenant's dashboard with full editing capabilities.
 */
export function TenantsTab({ tenants, isLoading, onRefresh }: TenantsTabProps) {
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const handleImpersonate = async (tenantId: string) => {
    setImpersonating(tenantId);
    try {
      const result = await api.adminImpersonate(tenantId);
      if (result.status === 200 && result.body) {
        // Token is automatically stored by api.adminImpersonate
        // Reload the page to reinitialize with impersonation context
        window.location.reload();
      } else {
        if (import.meta.env.DEV) {
          console.error('Impersonation failed:', result.status);
        }
        toast.error('Failed to impersonate tenant', {
          description: 'Please try again or contact support.',
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Impersonation error:', error);
      }
      toast.error('An error occurred while impersonating tenant', {
        description: 'Please try again or contact support.',
      });
    } finally {
      setImpersonating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-macon-navy-900 rounded-lg p-8 text-center">
        <p className="text-white/60">Loading tenants...</p>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="bg-macon-navy-900 rounded-lg p-8 text-center">
        <Users className="w-12 h-12 text-macon-navy-600 mx-auto mb-4" />
        <p className="text-white/60 text-lg">No tenants found</p>
        <p className="text-white0 text-sm mt-2">Create a new tenant to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-white">Tenants ({tenants.length})</h2>
        <Button
          onClick={onRefresh}
          variant="outline"
          className="border-white/20 text-white/90 hover:bg-macon-navy-800"
        >
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {tenants.map((tenant) => (
          <div
            key={tenant.id}
            className="bg-macon-navy-900 rounded-lg p-6 border border-macon-navy-800 hover:border-macon-navy-700 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-white">{tenant.name}</h3>
                  {!tenant.isActive && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/50 text-red-300 text-xs rounded">
                      <XCircle className="h-3 w-3" aria-hidden="true" />
                      Inactive
                    </span>
                  )}
                  {tenant.stripeOnboarded && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/50 text-green-300 text-xs rounded">
                      <CheckCircle className="h-3 w-3" aria-hidden="true" />
                      Stripe Connected
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-sm text-white/50">
                  <p>
                    <span className="font-medium">Slug:</span> {tenant.slug}
                  </p>
                  <p>
                    <span className="font-medium">Commission:</span> {tenant.commissionPercent}%
                  </p>
                  <p>
                    <span className="font-medium">API Key:</span>{' '}
                    <code className="bg-macon-navy-950 px-2 py-0.5 rounded text-xs">
                      {tenant.apiKeyPublic}
                    </code>
                  </p>
                </div>

                <div className="flex gap-4 mt-3 text-xs text-white0">
                  <span>{tenant.stats.bookings} bookings</span>
                  <span>{tenant.stats.packages} packages</span>
                  <span>{tenant.stats.addOns} add-ons</span>
                </div>
              </div>

              <Button
                onClick={() => handleImpersonate(tenant.id)}
                disabled={!tenant.isActive || impersonating === tenant.id}
                className="bg-macon-peach hover:bg-macon-peach/90 text-macon-navy-950 font-semibold"
                size="lg"
              >
                {impersonating === tenant.id ? (
                  <>Loading...</>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In As
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
