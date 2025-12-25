/**
 * Loading skeleton for About page
 */
export default function AboutLoading() {
  return (
    <div id="main-content" className="animate-pulse">
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
      <section className="bg-sage/50 py-32 md:py-40">
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
