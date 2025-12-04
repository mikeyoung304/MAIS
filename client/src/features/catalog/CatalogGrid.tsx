import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { PackageCardSkeleton } from '@/components/ui/skeleton';
import { usePackages } from './hooks';
import type { PackageDto } from '@macon/contracts';
import { formatCurrency } from '@/lib/utils';

export function CatalogGrid() {
  const { data: packages, isLoading, error } = usePackages();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <PackageCardSkeleton />
        <PackageCardSkeleton />
        <PackageCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-neutral-900 text-xl">
        Error loading packages: {error.message}
      </div>
    );
  }

  if (!packages || packages.length === 0) {
    return <div className="text-center py-12 text-neutral-700 text-xl">No packages available</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {packages.map((pkg: PackageDto) => (
        <Link key={pkg.id} to={`/package/${pkg.slug}`}>
          <Card className="overflow-hidden cursor-pointer h-full transition-all hover:shadow-elevation-2 bg-white border-neutral-200 hover:border-neutral-300 shadow-elevation-1">
            {pkg.photoUrl && (
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={pkg.photoUrl}
                  alt={pkg.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <CardContent className="p-6">
              <h3 className="font-heading text-3xl font-semibold mb-3 text-neutral-900">
                {pkg.title}
              </h3>
              <p className="text-neutral-700 mb-4 line-clamp-2 text-lg leading-relaxed">
                {pkg.description}
              </p>
              <div className="flex justify-between items-center pt-2 border-t border-neutral-200">
                <span className="text-4xl font-heading font-semibold text-macon-navy">
                  {formatCurrency(pkg.priceCents)}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
