/**
 * PackageCard Component - Sprint 9
 * Individual package display card with photo, name, description, price
 * Design: Apple-minimal aesthetic with brand voice guide patterns
 */

import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PackageDto } from '@macon/contracts';
import { formatCurrency } from '@/lib/utils';
import { truncateText } from '@/features/storefront';

interface PackageCardProps {
  package: PackageDto;
}

export function PackageCard({ package: pkg }: PackageCardProps) {
  return (
    <Card
      className="overflow-hidden h-full rounded-3xl shadow-lg border border-neutral-100 bg-white transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
      data-testid="package-card"
    >
      <Link to={`/package/${pkg.slug}`} className="block h-full flex flex-col">
        {/* Package Photo */}
        {pkg.photoUrl ? (
          <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
            <img
              src={pkg.photoUrl}
              alt={pkg.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            />
          </div>
        ) : (
          <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-sage/20 to-macon-navy/10 flex items-center justify-center">
            <Package className="w-16 h-16 text-sage/40" aria-hidden="true" />
          </div>
        )}

        {/* Package Info */}
        <CardContent className="p-6 flex-1 flex flex-col">
          {/* Package Title */}
          <h3 className="font-serif text-2xl font-bold text-text-primary mb-3 leading-tight">
            {pkg.title}
          </h3>

          {/* Package Description (truncated to 120 chars) */}
          <p className="text-lg text-text-muted mb-6 line-clamp-2 leading-relaxed flex-1">
            {truncateText(pkg.description, 120)}
          </p>

          {/* Price and CTA */}
          <div className="flex justify-between items-center pt-4 border-t border-neutral-100 mt-auto">
            <span className="font-serif text-2xl font-bold text-text-primary">
              {formatCurrency(pkg.priceCents)}
            </span>
            <Button
              size="sm"
              className="rounded-full bg-sage hover:bg-sage-hover text-white px-6 py-2 min-h-[44px] transition-all duration-300 hover:-translate-y-0.5"
            >
              View Details
            </Button>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
