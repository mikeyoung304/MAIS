import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Loading skeleton for the tenant edit page.
 * Displays placeholder for the edit form and stats sidebar.
 */
export default function EditTenantLoading() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link skeleton */}
      <div className="mb-6 flex items-center gap-2">
        <div className="h-4 w-4 bg-neutral-700/60 rounded animate-pulse" />
        <div className="h-4 w-28 bg-neutral-700/60 rounded animate-pulse" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main edit form skeleton */}
        <div className="md:col-span-2">
          <Card colorScheme="dark">
            <CardHeader>
              <div className="h-7 w-40 bg-neutral-700 rounded animate-pulse" />
              <div className="h-5 w-56 bg-neutral-700/60 rounded animate-pulse mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Business Name field skeleton */}
              <div className="space-y-2">
                <div className="h-4 w-28 bg-neutral-700/60 rounded animate-pulse" />
                <div className="h-10 w-full bg-neutral-700/60 rounded animate-pulse" />
              </div>

              {/* Email field skeleton */}
              <div className="space-y-2">
                <div className="h-4 w-12 bg-neutral-700/60 rounded animate-pulse" />
                <div className="h-10 w-full bg-neutral-700/60 rounded animate-pulse" />
              </div>

              {/* URL Slug field skeleton */}
              <div className="space-y-2">
                <div className="h-4 w-20 bg-neutral-700/60 rounded animate-pulse" />
                <div className="flex items-center gap-2">
                  <div className="h-4 w-6 bg-neutral-700/60 rounded animate-pulse" />
                  <div className="h-10 flex-1 bg-neutral-700/60 rounded animate-pulse" />
                </div>
              </div>

              {/* Commission field skeleton */}
              <div className="space-y-2">
                <div className="h-4 w-40 bg-neutral-700/60 rounded animate-pulse" />
                <div className="h-10 w-32 bg-neutral-700/60 rounded animate-pulse" />
              </div>

              {/* Active toggle skeleton */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-4 w-24 bg-neutral-700/60 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-neutral-700/40 rounded animate-pulse" />
                </div>
                <div className="h-6 w-11 bg-neutral-700/60 rounded-full animate-pulse" />
              </div>

              {/* Buttons skeleton */}
              <div className="flex gap-3 pt-4">
                <div className="h-10 flex-1 bg-neutral-700 rounded animate-pulse" />
                <div className="h-10 w-24 bg-neutral-700/60 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats sidebar skeleton */}
        <div className="space-y-6">
          {/* Tenant Stats card skeleton */}
          <Card colorScheme="dark">
            <CardHeader className="pb-3">
              <div className="h-5 w-28 bg-neutral-700 rounded animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-4 w-20 bg-neutral-700/60 rounded animate-pulse" />
                  <div className="h-5 w-16 bg-neutral-700/60 rounded animate-pulse" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* API Keys card skeleton */}
          <Card colorScheme="dark">
            <CardHeader className="pb-3">
              <div className="h-5 w-20 bg-neutral-700 rounded animate-pulse" />
              <div className="h-4 w-40 bg-neutral-700/60 rounded animate-pulse mt-1" />
            </CardHeader>
            <CardContent>
              <div className="h-16 w-full bg-neutral-700/60 rounded animate-pulse" />
            </CardContent>
          </Card>

          {/* Dates card skeleton */}
          <Card colorScheme="dark">
            <CardHeader className="pb-3">
              <div className="h-5 w-16 bg-neutral-700 rounded animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-16 bg-neutral-700/60 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-neutral-700/60 rounded animate-pulse" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
