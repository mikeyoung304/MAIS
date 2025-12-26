/**
 * Loading state for gallery page (domain-based)
 */
export default function GalleryLoading() {
  return (
    <div className="py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-48 animate-pulse rounded-lg bg-neutral-200" />
        </div>
        <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-2xl bg-neutral-200"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
