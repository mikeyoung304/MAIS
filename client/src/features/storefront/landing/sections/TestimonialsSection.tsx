/**
 * TestimonialsSection Component
 *
 * Displays customer testimonials in a card layout with ratings.
 * Responsive grid that adjusts based on number of testimonials.
 */

import { Star, Quote } from 'lucide-react';
import { Container } from '@/ui/Container';
import { sanitizeImageUrl } from '@/lib/sanitize-url';

interface TestimonialItem {
  quote: string;
  author: string;
  role?: string;
  imageUrl?: string;
  rating: number;
}

interface TestimonialsConfig {
  headline: string;
  items: TestimonialItem[];
}

interface TestimonialsSectionProps {
  config: TestimonialsConfig;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-5 h-5 ${
            star <= rating
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-neutral-300'
          }`}
        />
      ))}
    </div>
  );
}

function TestimonialCard({ testimonial }: { testimonial: TestimonialItem }) {
  // Sanitize image URL upfront
  const safeImageUrl = sanitizeImageUrl(testimonial.imageUrl);

  return (
    <div className="bg-white rounded-2xl p-6 md:p-8 shadow-lg border border-neutral-100 flex flex-col h-full">
      {/* Quote icon */}
      <Quote className="w-10 h-10 text-primary/20 mb-4 flex-shrink-0" />

      {/* Rating */}
      <div className="mb-4">
        <StarRating rating={testimonial?.rating ?? 5} />
      </div>

      {/* Quote text */}
      <blockquote className="text-neutral-700 text-lg leading-relaxed flex-grow mb-6">
        "{testimonial?.quote ?? ''}"
      </blockquote>

      {/* Author info */}
      <div className="flex items-center gap-4 mt-auto pt-4 border-t border-neutral-100">
        {safeImageUrl ? (
          <img
            src={safeImageUrl}
            alt={testimonial?.author ?? 'Customer'}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-semibold text-lg">
              {testimonial?.author?.charAt(0) ?? '?'}
            </span>
          </div>
        )}
        <div>
          <div className="font-semibold text-neutral-900">
            {testimonial?.author ?? 'Anonymous'}
          </div>
          {testimonial?.role && (
            <div className="text-sm text-neutral-500">{testimonial.role}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TestimonialsSection({ config }: TestimonialsSectionProps) {
  // Defensive coding: ensure items array exists
  const items = config?.items ?? [];
  if (items.length === 0) return null;

  const gridCols =
    items.length === 1
      ? 'lg:grid-cols-1 max-w-2xl mx-auto'
      : items.length === 2
        ? 'lg:grid-cols-2'
        : 'lg:grid-cols-3';

  return (
    <section className="py-16 md:py-24 bg-white">
      <Container>
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900">
            {config?.headline ?? 'What Our Customers Say'}
          </h2>
        </div>

        {/* Testimonial Grid */}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols} gap-6 md:gap-8`}>
          {items.map((testimonial, index) => (
            <TestimonialCard key={index} testimonial={testimonial} />
          ))}
        </div>
      </Container>
    </section>
  );
}
