import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Loading skeleton for the new tenant creation page.
 * Displays placeholder form fields matching the actual layout.
 */
export default function NewTenantLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link skeleton */}
      <div className="mb-6 flex items-center gap-2">
        <div className="h-4 w-4 bg-neutral-700/60 rounded animate-pulse" />
        <div className="h-4 w-28 bg-neutral-700/60 rounded animate-pulse" />
      </div>

      <Card colorScheme="dark">
        <CardHeader>
          <div className="h-7 w-48 bg-neutral-700 rounded animate-pulse" />
          <div className="h-5 w-64 bg-neutral-700/60 rounded animate-pulse mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Business Name field skeleton */}
          <div className="space-y-2">
            <div className="h-4 w-28 bg-neutral-700/60 rounded animate-pulse" />
            <div className="h-10 w-full bg-neutral-700/60 rounded animate-pulse" />
          </div>

          {/* URL Slug field skeleton */}
          <div className="space-y-2">
            <div className="h-4 w-20 bg-neutral-700/60 rounded animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-4 w-6 bg-neutral-700/60 rounded animate-pulse" />
              <div className="h-10 flex-1 bg-neutral-700/60 rounded animate-pulse" />
            </div>
            <div className="h-3 w-64 bg-neutral-700/40 rounded animate-pulse" />
          </div>

          {/* Commission field skeleton */}
          <div className="space-y-2">
            <div className="h-4 w-40 bg-neutral-700/60 rounded animate-pulse" />
            <div className="h-10 w-32 bg-neutral-700/60 rounded animate-pulse" />
            <div className="h-3 w-72 bg-neutral-700/40 rounded animate-pulse" />
          </div>

          {/* Buttons skeleton */}
          <div className="flex gap-3 pt-4">
            <div className="h-10 flex-1 bg-neutral-700 rounded animate-pulse" />
            <div className="h-10 w-20 bg-neutral-700/60 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
