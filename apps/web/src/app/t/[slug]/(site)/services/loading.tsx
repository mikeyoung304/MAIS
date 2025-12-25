/**
 * Loading skeleton for Services page
 */
export default function ServicesLoading() {
  return (
    <div id="main-content" className="animate-pulse">
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
                className="rounded-3xl border border-neutral-100 bg-white shadow-lg overflow-hidden"
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
