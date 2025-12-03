/**
 * Layout for public tenant storefronts at /t/:tenantSlug/*
 *
 * Resolves tenant from URL slug, sets API key for X-Tenant-Key header,
 * applies tenant branding via CSS variables, and provides white-label experience.
 *
 * @example
 * /t/little-bit-farm → Loads Little Bit Farm's storefront
 * /t/little-bit-farm/s/wellness → Segment tier page
 * /t/little-bit-farm/book → Appointment booking
 */

import { useEffect } from 'react';
import { Outlet, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTenantBranding } from '../hooks/useTenantBranding';
import { Loading } from '../ui/Loading';
import { Container } from '../ui/Container';
import type { TenantPublicDto } from '@macon/contracts';

export function TenantStorefrontLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Fetch tenant by slug
  const { data: tenant, isLoading, error } = useQuery<TenantPublicDto>({
    queryKey: ['tenant-public', tenantSlug],
    queryFn: async () => {
      const result = await api.getTenantPublic({ params: { slug: tenantSlug! } });
      if (result.status === 200) {
        // Set API key synchronously when data arrives
        api.setTenantKey(result.body.apiKeyPublic);
        return result.body;
      }
      if (result.status === 404) {
        throw new Error('Tenant not found');
      }
      throw new Error('Failed to fetch tenant');
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 15, // Cache 15 minutes
  });

  // Cleanup API key on unmount
  useEffect(() => {
    return () => {
      api.setTenantKey(null);
    };
  }, []);

  // Apply tenant branding CSS variables
  useTenantBranding(tenant?.branding);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Loading storefront" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Container className="py-20 text-center flex-1 flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold text-gray-900">Storefront Not Found</h1>
          <p className="mt-2 text-gray-600">
            The business you're looking for doesn't exist or is no longer active.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Return to MaconAI
          </Link>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Minimal tenant header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <Container>
          <div className="flex items-center justify-between py-4">
            <Link
              to={`/t/${tenant.slug}`}
              className="text-xl font-semibold"
              style={{ color: tenant.branding?.primaryColor || 'var(--color-primary)' }}
            >
              {tenant.branding?.logoUrl ? (
                <img
                  src={tenant.branding.logoUrl}
                  alt={tenant.name}
                  className="h-10 w-auto"
                />
              ) : (
                tenant.name
              )}
            </Link>
          </div>
        </Container>
      </header>

      {/* Main content - existing storefront components */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Powered by footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <Container>
          <div className="py-6 text-center text-sm text-gray-500">
            <span>&copy; {new Date().getFullYear()} {tenant.name}</span>
            <span className="mx-2">&middot;</span>
            <a
              href="https://maconaisolutions.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              Powered by MaconAI
            </a>
          </div>
        </Container>
      </footer>
    </div>
  );
}
