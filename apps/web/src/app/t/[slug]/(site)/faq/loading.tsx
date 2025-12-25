/**
 * Loading skeleton for FAQ page
 */
export default function FAQLoading() {
  return (
    <div id="main-content" className="animate-pulse">
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
              <div
                key={i}
                className="rounded-2xl border border-neutral-100 bg-white p-6"
              >
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
