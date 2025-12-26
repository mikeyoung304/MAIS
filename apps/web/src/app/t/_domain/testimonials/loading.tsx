/**
 * Loading state for testimonials page (domain-based)
 */
export default function TestimonialsLoading() {
  return (
    <div className="py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-64 animate-pulse rounded-lg bg-neutral-200" />
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg"
            >
              <div className="flex gap-1">
                {[...Array(5)].map((_, j) => (
                  <div
                    key={j}
                    className="h-5 w-5 animate-pulse rounded bg-neutral-200"
                  />
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
