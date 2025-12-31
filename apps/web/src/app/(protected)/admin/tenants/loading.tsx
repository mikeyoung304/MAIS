import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Loading skeleton for the tenants list page.
 * Displays placeholder cards matching the actual grid layout.
 */
export default function TenantsLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="h-9 w-32 bg-neutral-700 rounded animate-pulse mb-2" />
          <div className="h-5 w-64 bg-neutral-700/60 rounded animate-pulse" />
        </div>
        <div className="h-10 w-36 bg-neutral-700 rounded-full animate-pulse" />
      </div>

      {/* Search and filter bar skeleton */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="h-10 w-full bg-neutral-700/60 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-14 bg-neutral-700/60 rounded animate-pulse" />
          <div className="h-8 w-20 bg-neutral-700/60 rounded animate-pulse" />
          <div className="h-8 w-24 bg-neutral-700/60 rounded animate-pulse" />
        </div>
      </div>

      {/* Tenant cards skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} colorScheme="dark">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-6 w-36 bg-neutral-700 rounded animate-pulse" />
                <div className="h-5 w-16 bg-neutral-700/60 rounded animate-pulse" />
              </div>
              <div className="h-4 w-48 bg-neutral-700/60 rounded animate-pulse mt-2" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-4 w-24 bg-neutral-700/60 rounded animate-pulse" />
                <div className="h-4 w-24 bg-neutral-700/60 rounded animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 flex-1 bg-neutral-700 rounded animate-pulse" />
                <div className="h-8 w-8 bg-neutral-700/60 rounded animate-pulse" />
                <div className="h-8 w-20 bg-neutral-700/60 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
