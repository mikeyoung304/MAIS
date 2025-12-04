import { Card, CardContent } from '@/components/ui/card';
import { usePackages } from '../features/catalog/hooks';
import type { PackageDto } from '@macon/contracts';
import { formatCurrency } from '@/lib/utils';

interface Props {
  onPackageClick: (slug: string) => void;
}

/**
 * Widget version of CatalogGrid
 *
 * Differences from main app:
 * - Uses callback instead of Link for navigation
 * - No router dependency
 * - Optimized for iframe embedding
 */
export function WidgetCatalogGrid({ onPackageClick }: Props) {
  const { data: packages, isLoading, error } = usePackages();

  if (isLoading) {
    return <div className="text-center py-12 text-white/90 text-xl">Loading packages...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12 text-white text-xl">
        Error loading packages: {error.message}
      </div>
    );
  }

  if (!packages || packages.length === 0) {
    return <div className="text-center py-12 text-white/90 text-xl">No packages available</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {packages.map((pkg: PackageDto) => (
        <div
          key={pkg.id}
          onClick={() => onPackageClick(pkg.slug)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPackageClick(pkg.slug);
            }
          }}
          className="cursor-pointer"
        >
          <Card className="overflow-hidden h-full transition-all hover:shadow-elegant bg-macon-navy-800 border-white/20 hover:border-white/20 hover:shadow-lg">
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
              <h3 className="font-heading text-3xl font-semibold mb-3 text-white">{pkg.title}</h3>
              <p className="text-white/90 mb-4 line-clamp-2 text-lg leading-relaxed">
                {pkg.description}
              </p>
              <div className="flex justify-between items-center pt-2 border-t border-white/20">
                <span className="text-4xl font-heading font-semibold text-white/60">
                  {formatCurrency(pkg.priceCents)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
