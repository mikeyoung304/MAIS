/**
 * Signup Page Loading State
 *
 * Route-level loading fallback for Next.js App Router.
 * Displays while the signup page chunk is being loaded.
 */
export default function SignupLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md mx-auto">
        {/* Logo skeleton */}
        <div className="mb-8 text-center">
          <div className="h-9 w-32 mx-auto animate-pulse rounded bg-neutral-700" />
        </div>

        {/* Badge skeleton */}
        <div className="flex justify-center mb-6">
          <div className="h-9 w-52 animate-pulse rounded-full bg-neutral-700" />
        </div>

        {/* Title + subtitle skeleton */}
        <div className="text-center mb-8">
          <div className="h-10 w-64 mx-auto animate-pulse rounded bg-neutral-700 mb-3" />
          <div className="h-5 w-72 max-w-full mx-auto animate-pulse rounded bg-neutral-700" />
        </div>

        {/* Card skeleton */}
        <div className="bg-surface-alt border border-neutral-800 rounded-3xl p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-neutral-700" />
                <div className="h-12 animate-pulse rounded-lg bg-neutral-700" />
                {/* Password hint skeleton - reserves space to prevent CLS */}
                {i === 3 && <div className="h-4 w-28 animate-pulse rounded bg-neutral-700" />}
              </div>
            ))}
            <div className="h-12 animate-pulse rounded-full bg-sage/30 mt-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
