/**
 * Shared loading skeleton components for tenant pages
 *
 * Used by both [slug] and _domain routes to maintain consistency
 * and avoid code duplication across tenant storefront loading states.
 */
import { Loader2 } from 'lucide-react';

/**
 * Home page loading skeleton
 * Displays hero, trust bar, and tier cards skeletons
 */
export function HomePageSkeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-surface">
      {/* Hero skeleton */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mx-auto h-12 w-3/4 rounded-lg bg-neutral-200 md:h-16" />
          <div className="mx-auto mt-6 h-6 w-2/3 rounded-lg bg-neutral-100" />
          <div className="mx-auto mt-10 h-14 w-48 rounded-full bg-neutral-200" />
        </div>
      </section>

      {/* Trust bar skeleton */}
      <section className="border-y border-neutral-100 bg-surface-alt py-8">
        <div className="mx-auto flex max-w-5xl justify-center gap-16 px-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <div className="mx-auto h-8 w-16 rounded bg-neutral-200" />
              <div className="mx-auto mt-2 h-4 w-20 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </section>

      {/* Tier cards skeleton */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto h-10 w-64 rounded-lg bg-neutral-200" />
          <div className="mx-auto mt-4 h-5 w-96 rounded bg-neutral-100" />

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg">
                <div className="h-6 w-24 rounded bg-neutral-200" />
                <div className="mt-4 h-10 w-32 rounded bg-neutral-200" />
                <div className="mt-6 space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-4 w-full rounded bg-neutral-100" />
                  ))}
                </div>
                <div className="mt-8 h-11 w-full rounded-lg bg-neutral-200" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * About page loading skeleton
 * Displays hero with image and content, plus CTA section
 */
export function AboutPageSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Hero Section Skeleton */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            {/* Image skeleton */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-neutral-200" />

            {/* Content skeleton */}
            <div>
              <div className="h-12 w-3/4 rounded-lg bg-neutral-200 md:h-16" />
              <div className="mt-6 space-y-3">
                <div className="h-5 w-full rounded bg-neutral-100" />
                <div className="h-5 w-full rounded bg-neutral-100" />
                <div className="h-5 w-4/5 rounded bg-neutral-100" />
                <div className="h-5 w-full rounded bg-neutral-100" />
                <div className="h-5 w-3/4 rounded bg-neutral-100" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section Skeleton */}
      <section className="bg-accent/50 py-32 md:py-40">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mx-auto h-10 w-2/3 rounded-lg bg-white/30" />
          <div className="mx-auto mt-6 h-5 w-1/2 rounded bg-white/20" />
          <div className="mt-10 flex justify-center gap-4">
            <div className="h-14 w-40 rounded-full bg-white/40" />
            <div className="h-14 w-40 rounded-full bg-white/20" />
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Contact page loading skeleton
 * Displays contact info and form skeletons
 */
export function ContactPageSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Hero Section Skeleton */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left: Info skeleton */}
            <div>
              <div className="h-12 w-3/4 rounded-lg bg-neutral-200 md:h-16" />
              <div className="mt-6 space-y-3">
                <div className="h-5 w-full rounded bg-neutral-100" />
                <div className="h-5 w-4/5 rounded bg-neutral-100" />
              </div>
              <div className="mt-12 space-y-6">
                <div>
                  <div className="h-5 w-20 rounded bg-neutral-200" />
                  <div className="mt-2 h-4 w-32 rounded bg-neutral-100" />
                </div>
              </div>
            </div>

            {/* Right: Form skeleton */}
            <div className="rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg">
              <div className="mb-6 h-6 w-40 rounded bg-neutral-200" />

              {/* Form fields skeleton */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="mb-6">
                  <div className="mb-2 h-4 w-16 rounded bg-neutral-200" />
                  <div className="h-12 w-full rounded-xl bg-neutral-100" />
                </div>
              ))}

              {/* Textarea skeleton */}
              <div className="mb-6">
                <div className="mb-2 h-4 w-20 rounded bg-neutral-200" />
                <div className="h-32 w-full rounded-xl bg-neutral-100" />
              </div>

              {/* Button skeleton */}
              <div className="h-14 w-full rounded-full bg-neutral-200" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * FAQ page loading skeleton
 * Displays FAQ accordion items and CTA section
 */
export function FAQPageSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Hero Section Skeleton */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <div className="mx-auto h-12 w-2/3 rounded-lg bg-neutral-200 md:h-16" />
            <div className="mx-auto mt-6 h-5 w-1/2 rounded bg-neutral-100" />
          </div>

          {/* FAQ Items Skeleton */}
          <div className="mt-16 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-2xl border border-neutral-100 bg-white p-6">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-3/4 rounded bg-neutral-200" />
                  <div className="h-5 w-5 rounded bg-neutral-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section Skeleton */}
      <section className="bg-surface-alt py-32 md:py-40">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mx-auto h-10 w-1/2 rounded-lg bg-neutral-200" />
          <div className="mx-auto mt-6 h-5 w-2/3 rounded bg-neutral-100" />
          <div className="mx-auto mt-10 h-14 w-40 rounded-full bg-neutral-200" />
        </div>
      </section>
    </div>
  );
}

/**
 * Services page loading skeleton
 * Displays service cards grid and CTA section
 */
export function ServicesPageSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Hero Section Skeleton */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <div className="mx-auto h-12 w-1/3 rounded-lg bg-neutral-200 md:h-16" />
            <div className="mx-auto mt-6 h-6 w-1/2 rounded bg-neutral-100" />
          </div>
        </div>
      </section>

      {/* Packages Section Skeleton */}
      <section className="bg-surface-alt py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-lg"
              >
                {/* Image skeleton */}
                <div className="aspect-[16/9] bg-neutral-200" />

                {/* Content skeleton */}
                <div className="p-6">
                  <div className="h-6 w-24 rounded bg-neutral-200" />
                  <div className="mt-2 h-8 w-20 rounded bg-neutral-200" />
                  <div className="mt-4 space-y-2">
                    <div className="h-4 w-full rounded bg-neutral-100" />
                    <div className="h-4 w-3/4 rounded bg-neutral-100" />
                  </div>
                  <div className="mt-6 h-11 w-full rounded-full bg-neutral-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section Skeleton */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mx-auto h-10 w-2/3 rounded-lg bg-neutral-200" />
          <div className="mx-auto mt-6 h-5 w-1/2 rounded bg-neutral-100" />
          <div className="mx-auto mt-10 h-14 w-40 rounded-full bg-neutral-200" />
        </div>
      </section>
    </div>
  );
}

/**
 * Gallery page loading skeleton
 * Displays image grid skeleton
 */
export function GalleryPageSkeleton() {
  return (
    <div className="py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-48 animate-pulse rounded-lg bg-neutral-200" />
        </div>
        <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-neutral-200" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Testimonials page loading skeleton
 * Displays testimonial cards grid
 */
export function TestimonialsPageSkeleton() {
  return (
    <div className="py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-64 animate-pulse rounded-lg bg-neutral-200" />
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg">
              <div className="flex gap-1">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="h-5 w-5 animate-pulse rounded bg-neutral-200" />
                ))}
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-4 animate-pulse rounded bg-neutral-200" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-200" />
                <div className="space-y-1">
                  <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
                  <div className="h-3 w-16 animate-pulse rounded bg-neutral-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Booking page loading skeleton
 * Displays a centered spinner with loading message
 */
export function BookingPageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-accent" />
        <p className="mt-4 text-lg text-neutral-600">Loading booking...</p>
      </div>
    </div>
  );
}

/**
 * Booking success page loading skeleton
 * Displays a centered spinner with confirmation loading message
 */
export function BookingSuccessPageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-accent" />
        <p className="mt-4 text-lg text-neutral-600">Loading confirmation...</p>
      </div>
    </div>
  );
}
