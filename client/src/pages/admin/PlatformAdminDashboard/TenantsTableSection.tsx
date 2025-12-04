import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Loader2, Search, LogIn, Settings } from 'lucide-react';
import { api } from '../../../lib/api';
import { logger } from '../../../lib/logger';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { Badge, StatusBadge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import type { TenantDto } from './types';

interface TenantsTableSectionProps {
  tenants: TenantDto[];
  isLoading: boolean;
}

/**
 * TenantsTableSection Component
 *
 * Displays a searchable table of all tenants with their details and actions
 */
export function TenantsTableSection({ tenants, isLoading }: TenantsTableSectionProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const handleImpersonate = async (tenantId: string) => {
    setImpersonatingId(tenantId);
    try {
      const result = await api.adminImpersonate(tenantId);
      if (result.status === 200 && result.body) {
        // Token is stored by api.adminImpersonate, reload to reinitialize with impersonation context
        window.location.reload();
      } else {
        logger.error('Impersonation failed', {
          status: result.status,
          component: 'TenantsTableSection',
        });
        alert('Failed to sign in as tenant. Please try again.');
      }
    } catch (error) {
      logger.error('Impersonation error', { error, component: 'TenantsTableSection' });
      alert('An error occurred while signing in as tenant.');
    } finally {
      setImpersonatingId(null);
    }
  };

  // Memoize filtered tenants to prevent re-filtering on every render
  const filteredTenants = useMemo(
    () =>
      tenants.filter(
        (tenant) =>
          tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tenant.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tenant.email?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [tenants, searchTerm]
  );

  return (
    <Card className="p-6 border-neutral-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-neutral-900">All Tenants</h2>
        <Button
          className="bg-macon-navy hover:bg-macon-navy-dark"
          onClick={() => navigate('/admin/tenants/new')}
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Tenant
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <Input
            type="search"
            placeholder="Search tenants by name, slug, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-neutral-300 focus:border-white/30"
          />
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="border-neutral-200 hover:bg-neutral-50">
            <TableHead className="text-neutral-700 font-semibold">Tenant</TableHead>
            <TableHead className="text-neutral-700 font-semibold">Slug</TableHead>
            <TableHead className="text-neutral-700 font-semibold">Email</TableHead>
            <TableHead className="text-neutral-700 font-semibold">Packages</TableHead>
            <TableHead className="text-neutral-700 font-semibold">Bookings</TableHead>
            <TableHead className="text-neutral-700 font-semibold">Commission</TableHead>
            <TableHead className="text-neutral-700 font-semibold">Status</TableHead>
            <TableHead className="text-neutral-700 font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow className="hover:bg-neutral-50">
              <TableCell colSpan={8} className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" />
              </TableCell>
            </TableRow>
          ) : filteredTenants.length === 0 ? (
            <TableRow className="hover:bg-neutral-50">
              <TableCell colSpan={8} className="p-0">
                {searchTerm ? (
                  <EmptyState
                    icon={Search}
                    title="No tenants found"
                    description={`No tenants match "${searchTerm}". Try adjusting your search terms.`}
                  />
                ) : (
                  <EmptyState
                    icon={Building2}
                    title="Ready to onboard your first client"
                    description="Add your first tenant to start managing their packages and bookings."
                    action={{
                      label: 'Add Tenant',
                      onClick: () => navigate('/admin/tenants/new'),
                    }}
                  />
                )}
              </TableCell>
            </TableRow>
          ) : (
            filteredTenants.map((tenant) => (
              <TableRow
                key={tenant.id}
                className="border-neutral-200 hover:bg-macon-navy-50/50 transition-colors duration-150"
              >
                <TableCell className="font-semibold text-neutral-900">{tenant.name}</TableCell>
                <TableCell className="text-neutral-600 font-mono text-sm">{tenant.slug}</TableCell>
                <TableCell className="text-neutral-600">
                  {tenant.email || <span className="text-neutral-400">Not set</span>}
                </TableCell>
                <TableCell className="text-neutral-700 font-medium">
                  {tenant._count?.packages || 0}
                </TableCell>
                <TableCell className="text-neutral-700 font-medium">
                  {tenant._count?.bookings || 0}
                </TableCell>
                <TableCell className="text-neutral-700 font-medium">
                  {tenant.commissionPercent}%
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <StatusBadge status={tenant.isActive ? 'active' : 'inactive'} />
                    {tenant.stripeOnboarded && <Badge variant="info">Stripe</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="default"
                      onClick={() => handleImpersonate(tenant.id)}
                      disabled={!tenant.isActive || impersonatingId === tenant.id}
                      className="bg-macon-orange hover:bg-macon-orange/90 text-white"
                    >
                      {impersonatingId === tenant.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <LogIn className="w-4 h-4 mr-2" />
                          Sign In As
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                      className="border-macon-navy/20 text-macon-navy hover:bg-macon-navy-50"
                      title="Edit tenant settings"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
