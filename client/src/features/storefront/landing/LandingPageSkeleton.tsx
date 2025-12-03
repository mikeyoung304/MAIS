/**
 * LandingPageSkeleton Component
 *
 * Skeleton loading state for landing page.
 * Shows placeholder content while tenant data loads in TenantStorefrontLayout.
 *
 * @see TODO-217 resolution
 */

import { memo } from 'react';
import { Container } from '@/ui/Container';

/**
 * Skeleton loading state for landing page
 * Shows placeholder content while tenant data loads
 */
export const LandingPageSkeleton = memo(function LandingPageSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <section className="relative min-h-[80vh] bg-neutral-200 flex items-center justify-center">
        <Container className="text-center py-20">
          <div className="h-12 w-96 max-w-full bg-neutral-300 rounded mx-auto mb-6" />
          <div className="h-6 w-64 max-w-full bg-neutral-300 rounded mx-auto mb-10" />
          <div className="h-12 w-32 bg-neutral-300 rounded-lg mx-auto" />
        </Container>
        {/* Bottom gradient placeholder */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* Content sections skeleton */}
      <div className="max-w-6xl mx-auto py-16 px-4 space-y-16">
        {/* About section skeleton */}
        <section className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="h-8 w-48 bg-neutral-200 rounded" />
            <div className="h-4 w-full bg-neutral-200 rounded" />
            <div className="h-4 w-full bg-neutral-200 rounded" />
            <div className="h-4 w-3/4 bg-neutral-200 rounded" />
          </div>
          <div className="h-64 bg-neutral-200 rounded-lg" />
        </section>

        {/* Testimonials skeleton */}
        <section className="space-y-8">
          <div className="h-8 w-64 bg-neutral-200 rounded mx-auto" />
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-neutral-100 rounded-xl p-6 space-y-4">
                <div className="h-4 w-full bg-neutral-200 rounded" />
                <div className="h-4 w-full bg-neutral-200 rounded" />
                <div className="h-4 w-3/4 bg-neutral-200 rounded" />
                <div className="flex items-center gap-3 pt-4">
                  <div className="w-10 h-10 bg-neutral-200 rounded-full flex-shrink-0" />
                  <div className="h-4 w-24 bg-neutral-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Gallery skeleton */}
        <section className="space-y-8">
          <div className="h-8 w-48 bg-neutral-200 rounded mx-auto" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="aspect-square bg-neutral-200 rounded-lg" />
            ))}
          </div>
        </section>

        {/* FAQ skeleton */}
        <section className="max-w-3xl mx-auto space-y-6">
          <div className="h-8 w-64 bg-neutral-200 rounded mx-auto mb-8" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-neutral-100 rounded-lg p-6 space-y-3">
              <div className="h-5 w-3/4 bg-neutral-200 rounded" />
              <div className="h-4 w-full bg-neutral-200 rounded" />
              <div className="h-4 w-5/6 bg-neutral-200 rounded" />
            </div>
          ))}
        </section>

        {/* Final CTA skeleton */}
        <section className="bg-neutral-200 rounded-xl py-12 text-center">
          <Container>
            <div className="h-10 w-72 max-w-full bg-neutral-300 rounded mx-auto mb-4" />
            <div className="h-5 w-96 max-w-full bg-neutral-300 rounded mx-auto mb-8" />
            <div className="h-12 w-40 bg-neutral-300 rounded-lg mx-auto" />
          </Container>
        </section>
      </div>
    </div>
  );
});
