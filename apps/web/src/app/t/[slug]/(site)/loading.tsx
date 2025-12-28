/**
 * Loading skeleton for tenant pages
 *
 * Displayed while the page data is being fetched.
 * Follows the same layout structure as the actual page.
 */
export default function TenantPageLoading() {
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
