'use client';

/**
 * Error boundary for testimonials page (domain-based)
 */
export default function TestimonialsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16">
      <h1 className="font-serif text-3xl font-bold text-text-primary">Something went wrong</h1>
      <p className="mt-4 text-text-muted">
        {error.message || 'Unable to load testimonials. Please try again.'}
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-full bg-sage px-8 py-3 text-white transition-colors hover:bg-sage-hover"
      >
        Try again
      </button>
    </div>
  );
}
