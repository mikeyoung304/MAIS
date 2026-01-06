'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { User, Calendar, CreditCard, Pencil, Search, X, Filter } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { impersonateTenant } from './actions';
import type { Tenant } from './types';

interface TenantsListProps {
  tenants: Tenant[];
}

type FilterMode = 'all' | 'stripe' | 'no-stripe';

export function TenantsList({ tenants }: TenantsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Debounce search query to prevent excessive re-renders with large tenant lists
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 150);

  /**
   * Filter and search tenants
   */
  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      // Filter by Stripe status
      if (filterMode === 'stripe' && !tenant.stripeConnected) return false;
      if (filterMode === 'no-stripe' && tenant.stripeConnected) return false;

      // Search by name, slug, or email
      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase();
        return (
          tenant.name.toLowerCase().includes(query) ||
          tenant.slug.toLowerCase().includes(query) ||
          tenant.email.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [tenants, debouncedSearchQuery, filterMode]);

  const hasFilters = searchQuery.trim() || filterMode !== 'all';

  return (
    <div>
      {/* Search and filter bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            type="text"
            placeholder="Search by name, slug, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-surface border-neutral-700"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterMode === 'all' ? 'sage' : 'outline'}
            size="sm"
            onClick={() => setFilterMode('all')}
          >
            All
          </Button>
          <Button
            variant={filterMode === 'stripe' ? 'sage' : 'outline'}
            size="sm"
            onClick={() => setFilterMode('stripe')}
          >
            <CreditCard className="h-3 w-3 mr-1" />
            Stripe
          </Button>
          <Button
            variant={filterMode === 'no-stripe' ? 'sage' : 'outline'}
            size="sm"
            onClick={() => setFilterMode('no-stripe')}
          >
            <Filter className="h-3 w-3 mr-1" />
            No Stripe
          </Button>
        </div>
      </div>

      {/* Results count */}
      {hasFilters && (
        <p className="text-sm text-text-muted mb-4">
          Showing {filteredTenants.length} of {tenants.length} tenants
          {searchQuery && <span className="ml-1">matching &quot;{searchQuery}&quot;</span>}
        </p>
      )}

      {filteredTenants.length === 0 ? (
        <Card colorScheme="dark" className="border-dashed border-2 border-neutral-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-text-muted mb-4" />
            <p className="text-text-muted text-center">
              {hasFilters ? 'No tenants match your search' : 'No tenants found'}
            </p>
            {hasFilters && (
              <Button
                variant="outline-light"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('all');
                }}
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTenants.map((tenant) => (
            <Card
              key={tenant.id}
              colorScheme="dark"
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
                  <Button variant="outline-light" size="sm" asChild>
                    <Link href={`/admin/tenants/${tenant.id}`}>
                      <Pencil className="h-3 w-3" />
                    </Link>
                  </Button>
                  <Button variant="outline-light" size="sm" asChild>
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
