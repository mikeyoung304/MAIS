import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Not Found Page for Tenant Routes
 *
 * Displayed when:
 * - Tenant slug doesn't exist
 * - Custom domain isn't registered
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
          <Button asChild variant="sage">
            <Link href="/">Go to Homepage</Link>
          </Button>
        </div>
      </div>
      <p className="mt-16 text-center text-sm text-text-muted">
        Are you a business owner?{' '}
        <Link href="/signup" className="text-sage underline hover:no-underline">
          Get started with MAIS
        </Link>
      </p>
    </div>
  );
}
