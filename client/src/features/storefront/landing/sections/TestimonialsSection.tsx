import { memo } from 'react';
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
    <figure className="bg-white rounded-2xl p-6 md:p-8 shadow-lg border border-neutral-100 flex flex-col h-full">
      {/* Quote icon */}
      <Quote className="w-10 h-10 text-primary/20 mb-4 flex-shrink-0" aria-hidden="true" />

      {/* Rating */}
      <div className="mb-4">
        <StarRating rating={testimonial?.rating ?? 5} />
      </div>

      {/* Quote text */}
      <blockquote className="text-neutral-700 text-lg leading-relaxed flex-grow mb-6">
        <p>"{testimonial?.quote ?? ''}"</p>
      </blockquote>

      {/* Author info */}
      <figcaption className="flex items-center gap-4 mt-auto pt-4 border-t border-neutral-100">
        {safeImageUrl ? (
          <img
            src={safeImageUrl}
            alt={testimonial.author ? `${testimonial.author}'s photo` : 'Customer photo'}
            loading="lazy"
            decoding="async"
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-semibold text-lg">
              {testimonial?.author?.charAt(0) ?? '?'}
            </span>
          </div>
        )}
        <cite className="not-italic">
          <div className="font-semibold text-neutral-900">
            {testimonial?.author ?? 'Anonymous'}
          </div>
          {testimonial?.role && (
            <div className="text-sm text-neutral-500">{testimonial.role}</div>
          )}
        </cite>
      </figcaption>
    </figure>
  );
}

/**
 * Testimonials section for landing pages
 *
 * Displays customer testimonials in a responsive card grid with star ratings, quotes,
 * and author information. The grid layout automatically adjusts based on the number
 * of testimonials (1-column for single testimonial, 2-column for pairs, 3-column for more).
 *
 * Each testimonial card includes a 5-star rating display, quoted text, and author details
 * with an optional photo and role. If no author photo is provided, a fallback avatar with
 * the author's initial is shown. Uses semantic HTML (figure, blockquote, cite) for
 * accessibility and proper content structure.
 *
 * @example
 * ```tsx
 * <TestimonialsSection
 *   config={{
 *     headline: "What Our Guests Say",
 *     items: [
 *       {
 *         quote: "An unforgettable experience. The farm tour was amazing!",
 *         author: "Sarah Johnson",
 *         role: "Food Blogger",
 *         imageUrl: "https://example.com/sarah.jpg",
 *         rating: 5
 *       },
 *       {
 *         quote: "Perfect weekend getaway. Highly recommended!",
 *         author: "Mike Chen",
 *         rating: 5
 *       }
 *     ]
 *   }}
 * />
 * ```
 *
 * @param props.config - Testimonials section configuration from tenant branding
 * @param props.config.headline - Section headline (required)
 * @param props.config.items - Array of testimonial items to display (required)
 * @param props.config.items[].quote - Customer testimonial text (required)
 * @param props.config.items[].author - Customer name (required)
 * @param props.config.items[].role - Customer role or title (optional)
 * @param props.config.items[].imageUrl - Customer photo URL, sanitized before rendering (optional)
 * @param props.config.items[].rating - Star rating from 1-5 (required)
 *
 * @see TestimonialsSectionConfigSchema in @macon/contracts for Zod validation
 * @see TODO-218 for cite element accessibility implementation
 */
export const TestimonialsSection = memo(function TestimonialsSection({ config }: TestimonialsSectionProps) {
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
            {config?.headline ?? 'Testimonials'}
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
});
