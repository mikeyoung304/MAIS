import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, ArrowLeft } from 'lucide-react';

export default function TenantNotFound() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/admin/tenants"
        className="mb-6 inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tenants
      </Link>

      <Card colorScheme="dark">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sage/10">
            <Search className="h-8 w-8 text-sage" />
          </div>
          <h2 className="mb-2 font-serif text-2xl font-bold text-text-primary">Tenant Not Found</h2>
          <p className="mb-6 text-text-muted">
            The tenant you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button variant="sage" asChild>
            <Link href="/admin/tenants">View All Tenants</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
