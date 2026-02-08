/**
 * Not Found Page for Tenant Routes
 *
 * Displayed when:
 * - Tenant slug doesn't exist
 * - Custom domain isn't registered
 *
 * IMPORTANT: This file must NOT import client components (Button, Link, etc.).
 * Next.js 14.x has a bug where not-found.tsx at route segment boundaries
 * (e.g., app/t/not-found.tsx) maps shared client component module IDs to
 * deeper chunks (page.js) that aren't loaded when the NotFoundBoundary
 * renders. The not-found.js chunk IS built but its <script> tag is NOT
 * included in the HTML, causing "Cannot read properties of undefined
 * (reading 'call')" in webpack's module factory.
 *
 * Use plain <a> tags instead to avoid the client component chunk dependency.
 * See: https://github.com/vercel/next.js/issues/58100
 */
export default function TenantNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6">
      <div className="text-center">
        <h1 className="font-serif text-6xl font-bold text-text-primary">404</h1>
        <p className="mt-4 text-xl text-text-muted">Business not found</p>
        <p className="mt-2 max-w-md text-text-muted">
          The business you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <div className="mt-8">
          <a
            href="/"
            className="inline-flex items-center justify-center whitespace-nowrap font-semibold rounded-lg px-6 py-3 bg-sage text-white hover:bg-sage-hover transition-colors"
          >
            Go to Homepage
          </a>
        </div>
      </div>
      <p className="mt-16 text-center text-sm text-text-muted">
        Are you a business owner?{' '}
        <a href="/signup" className="text-sage underline hover:no-underline">
          Get started with HANDLED
        </a>
      </p>
    </div>
  );
}
