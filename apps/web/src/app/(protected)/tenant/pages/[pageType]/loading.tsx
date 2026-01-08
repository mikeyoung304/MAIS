import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Loading skeleton for the page editor
 * Matches the structure of the PageEditorPage component
 */
export default function PageEditorLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        {/* Back button skeleton */}
        <div className="h-10 w-10 animate-pulse rounded-lg bg-neutral-200" />
        <div className="space-y-2">
          {/* Title skeleton */}
          <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-200" />
          {/* Description skeleton */}
          <div className="h-5 w-64 animate-pulse rounded-lg bg-neutral-200" />
        </div>
      </div>

      {/* Action bar skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-10 w-36 animate-pulse rounded-lg bg-neutral-200" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-neutral-200" />
      </div>

      {/* Section cards skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-32 animate-pulse rounded bg-neutral-200" />
                  <div className="h-4 w-48 animate-pulse rounded bg-neutral-200" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 w-9 animate-pulse rounded-lg bg-neutral-200" />
                  <div className="h-9 w-9 animate-pulse rounded-lg bg-neutral-200" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-24 animate-pulse rounded-lg bg-neutral-100" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
