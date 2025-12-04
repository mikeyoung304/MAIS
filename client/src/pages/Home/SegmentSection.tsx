import { Link } from 'react-router-dom';
import { Container } from '@/ui/Container';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { useSegments } from '@/features/catalog/hooks';
import type { SegmentDto } from '@macon/contracts';

/**
 * SegmentSection - Data-driven customer journey selector
 *
 * Shows segment cards only if the tenant has active segments.
 * No configuration needed - purely data-driven.
 */
export function SegmentSection() {
  const { data: segments, isLoading } = useSegments();

  // Don't show section if no segments or still loading
  if (isLoading || !segments || segments.length === 0) {
    return null;
  }

  return (
    <section
      id="segments"
      aria-labelledby="segments-heading"
      className="py-20 sm:py-24 bg-neutral-50"
    >
      <Container>
        <div className="text-center mb-12">
          <h2
            id="segments-heading"
            className="font-heading text-3xl sm:text-4xl font-bold text-macon-navy mb-4"
          >
            Find Your Solution
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Every business is unique. Choose the path that matches your needs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {segments.map((segment: SegmentDto) => (
            <SegmentCard key={segment.id} segment={segment} />
          ))}
        </div>
      </Container>
    </section>
  );
}

function SegmentCard({ segment }: { segment: SegmentDto }) {
  return (
    <Link to={`/segments/${segment.slug}`} className="block group">
      <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-elevation-3 hover:-translate-y-1 border-neutral-200 hover:border-macon-orange/30">
        {/* Segment Image or Gradient */}
        {segment.heroImage ? (
          <div className="relative aspect-[16/10] overflow-hidden">
            <img
              src={segment.heroImage}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="font-heading text-xl font-bold text-white">{segment.name}</h3>
            </div>
          </div>
        ) : (
          <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-macon-navy via-macon-navy/90 to-macon-teal/80 flex items-end">
            <div className="p-4 w-full">
              <h3 className="font-heading text-xl font-bold text-white">{segment.name}</h3>
            </div>
          </div>
        )}

        {/* Content */}
        <CardContent className="p-4">
          <p className="text-neutral-600 text-sm mb-3 line-clamp-2">
            {segment.heroSubtitle || segment.description || 'Explore our packages'}
          </p>
          <div className="flex items-center text-macon-orange font-medium text-sm group-hover:text-macon-orange-dark transition-colors">
            View packages
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
