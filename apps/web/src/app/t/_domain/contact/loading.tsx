/**
 * Loading skeleton for custom domain Contact page
 */
export default function DomainContactLoading() {
  return (
    <div id="main-content" className="animate-pulse">
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
              <div className="h-6 w-40 rounded bg-neutral-200 mb-6" />

              {/* Form fields skeleton */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="mb-6">
                  <div className="h-4 w-16 rounded bg-neutral-200 mb-2" />
                  <div className="h-12 w-full rounded-xl bg-neutral-100" />
                </div>
              ))}

              {/* Textarea skeleton */}
              <div className="mb-6">
                <div className="h-4 w-20 rounded bg-neutral-200 mb-2" />
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
