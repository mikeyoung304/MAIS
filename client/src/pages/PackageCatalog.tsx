/**
 * Package Catalog Page - Sprint 9
 * Displays all active packages with search, filter, and sort capabilities
 */

import { useState, useMemo } from 'react';
import { Package, Search } from 'lucide-react';
import { Container } from '@/ui/Container';
import { PackageCard } from '@/features/catalog/PackageCard';
import { CatalogFilters } from '@/features/catalog/CatalogFilters';
import { PackageCardSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { usePackages } from '@/features/catalog/hooks';
import { FeatureErrorBoundary } from '@/components/errors';
import { getTierDisplayName, type TierLevel } from '@/features/storefront/utils';
import type { PackageDto } from '@macon/contracts';

function PackageCatalogContent() {
  // Fetch packages
  const { data: packages, isLoading, error, refetch } = usePackages();

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState({ min: 0, max: Infinity });
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc'>('price-asc');

  // Apply filters and sorting - memoized to prevent unnecessary re-computation
  const filteredAndSortedPackages = useMemo(() => {
    if (!packages) return undefined;

    return packages
      .filter((pkg: PackageDto) => {
        // Search filter (search in title and description)
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const titleMatch = pkg.title.toLowerCase().includes(query);
          const descMatch = pkg.description.toLowerCase().includes(query);
          if (!titleMatch && !descMatch) {
            return false;
          }
        }

        // Price filter
        const priceInDollars = pkg.priceCents / 100;
        if (priceInDollars < priceRange.min || priceInDollars > priceRange.max) {
          return false;
        }

        return true;
      })
      .sort((a: PackageDto, b: PackageDto) => {
        // Sort logic
        if (sortBy === 'price-asc') {
          return a.priceCents - b.priceCents;
        }
        if (sortBy === 'price-desc') {
          return b.priceCents - a.priceCents;
        }
        return 0;
      });
  }, [packages, searchQuery, priceRange.min, priceRange.max, sortBy]);

  // Group packages by tier for storefront display
  const packagesByTier = useMemo(() => {
    if (!filteredAndSortedPackages) return {};

    const grouped = filteredAndSortedPackages.reduce(
      (acc, pkg) => {
        const tier = pkg.grouping || 'Featured';
        if (!acc[tier]) acc[tier] = [];
        acc[tier].push(pkg);
        return acc;
      },
      {} as Record<string, PackageDto[]>
    );

    // Sort within each tier by groupingOrder, then by title
    Object.values(grouped).forEach((tierPackages) => {
      tierPackages.sort((a, b) => {
        const orderA = a.groupingOrder ?? Infinity;
        const orderB = b.groupingOrder ?? Infinity;
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title);
      });
    });

    return grouped;
  }, [filteredAndSortedPackages]);

  // Check if we have multiple tiers (show tier headers) or just one
  const tierNames = Object.keys(packagesByTier);
  const hasTiers = tierNames.length > 1 || (tierNames.length === 1 && tierNames[0] !== 'Featured');

  // Loading state
  if (isLoading) {
    return (
      <Container className="py-12">
        <h1 className="font-serif text-5xl md:text-6xl font-bold text-text-primary leading-tight tracking-tight">
          Your packages.
          <br />
          Your experience.
        </h1>
        <p className="text-xl md:text-2xl text-text-muted font-light mt-6 mb-12">
          Choose what feels right. Book instantly.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <PackageCardSkeleton key={i} />
          ))}
        </div>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container className="py-12">
        <h1 className="font-serif text-5xl md:text-6xl font-bold text-text-primary leading-tight tracking-tight">
          Your packages.
        </h1>
        <div className="bg-danger-50 border-2 border-danger-200 rounded-xl p-8 max-w-2xl">
          <p className="text-xl text-danger-700 mb-4 font-medium">
            Failed to load packages. Please try again.
          </p>
          <Button onClick={() => refetch()} variant="secondary" size="lg" className="min-h-[44px]">
            Retry
          </Button>
        </div>
      </Container>
    );
  }

  // Empty state (no packages exist)
  if (!packages || packages.length === 0) {
    return (
      <Container className="py-12">
        <h1 className="font-serif text-5xl md:text-6xl font-bold text-text-primary leading-tight tracking-tight mb-6">
          Your packages.
        </h1>
        <div className="text-center py-16 bg-neutral-50 rounded-xl border border-neutral-200">
          <Package className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
          <h3 className="text-xl font-semibold text-neutral-900 mb-2">Coming Soon</h3>
          <p className="text-neutral-600">We're preparing something special for you.</p>
        </div>
      </Container>
    );
  }

  // No results after filtering
  if (filteredAndSortedPackages && filteredAndSortedPackages.length === 0) {
    const hasActiveFilters = searchQuery || priceRange.min > 0 || priceRange.max < Infinity;

    return (
      <Container className="py-12">
        <h1 className="font-serif text-5xl md:text-6xl font-bold text-text-primary leading-tight tracking-tight">
          Your packages.
          <br />
          Your experience.
        </h1>
        <p className="text-xl md:text-2xl text-text-muted font-light mt-6 mb-12">
          Choose what feels right. Book instantly.
        </p>

        <CatalogFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        <div className="text-center py-16 bg-neutral-50 rounded-xl border border-neutral-200 mt-8">
          <Search className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
          <h3 className="text-xl font-semibold text-neutral-900 mb-2">No matches found</h3>
          <p className="text-neutral-600 mb-6">Try adjusting your search or filter criteria.</p>
          {hasActiveFilters && (
            <Button
              onClick={() => {
                setSearchQuery('');
                setPriceRange({ min: 0, max: Infinity });
              }}
              variant="outline"
              size="lg"
              className="min-h-[44px]"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </Container>
    );
  }

  // Main catalog view
  return (
    <Container className="py-12">
      <h1 className="font-serif text-5xl md:text-6xl font-bold text-text-primary leading-tight tracking-tight">
        Your packages.
        <br />
        Your experience.
      </h1>
      <p className="text-xl md:text-2xl text-text-muted font-light mt-6 mb-12">
        Choose what feels right. Book instantly.
      </p>

      <CatalogFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      <div className="mt-12">
        <p className="text-lg text-neutral-600 mb-6">
          Showing {filteredAndSortedPackages.length}{' '}
          {filteredAndSortedPackages.length === 1 ? 'package' : 'packages'}
        </p>

        {hasTiers ? (
          // Grouped by tier display
          <div className="space-y-20">
            {Object.entries(packagesByTier).map(([tier, tierPackages]) => (
              <section key={tier}>
                <h2 className="font-serif text-3xl md:text-4xl font-bold text-text-primary mb-8 tracking-tight">
                  {getTierDisplayName(tier as TierLevel)}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {tierPackages.map((pkg: PackageDto) => (
                    <PackageCard key={pkg.id} package={pkg} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          // Flat display (no tiers or only "Featured")
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredAndSortedPackages.map((pkg: PackageDto) => (
              <PackageCard key={pkg.id} package={pkg} />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}

export function PackageCatalog() {
  return (
    <FeatureErrorBoundary featureName="Package Catalog">
      <PackageCatalogContent />
    </FeatureErrorBoundary>
  );
}
