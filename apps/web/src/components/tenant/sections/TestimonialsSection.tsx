'use client';

import Image from 'next/image';
import type {
  TestimonialsSection as TestimonialsSectionType,
  TenantPublicDto,
} from '@macon/contracts';
import { StarRating } from '@/components/ui/star-rating';
import { useScrollReveal } from '@/hooks/useScrollReveal';

interface TestimonialsSectionProps extends TestimonialsSectionType {
  tenant: TenantPublicDto;
}

/**
 * Testimonials section component for customer reviews
 *
 * Features:
 * - Grid of testimonial cards
 * - Star ratings
 * - Author info with optional photo
 */
export function TestimonialsSection({
  headline = 'What Clients Say',
  items,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tenant: _tenant,
}: TestimonialsSectionProps) {
  const sectionRef = useScrollReveal();
  const safeItems = Array.isArray(items) ? items : [];
  // Don't render if no testimonials
  if (safeItems.length === 0) {
    return null;
  }

  return (
    <section ref={sectionRef} className="py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-bold text-primary sm:text-4xl">{headline}</h2>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {safeItems.map((testimonial, i) => (
            <div
              key={i}
              className={`rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none reveal-delay-${i % 2 === 0 ? '1' : '2'}`}
            >
              <StarRating rating={testimonial.rating} />
              <p className="mt-4 line-clamp-4 text-muted-foreground">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                {testimonial.authorPhotoUrl && (
                  <div className="relative h-10 w-10 flex-shrink-0">
                    <Image
                      src={testimonial.authorPhotoUrl}
                      alt={`${testimonial.authorName} testimonial photo`}
                      fill
                      className="rounded-full object-cover"
                      sizes="40px"
                    />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-primary">{testimonial.authorName}</p>
                  {testimonial.authorRole && (
                    <p className="text-sm text-muted-foreground">{testimonial.authorRole}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
