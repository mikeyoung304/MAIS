'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, AlertCircle, Copy, CheckCircle, Key } from 'lucide-react';
import { createTenant } from './actions';
import { logger } from '@/lib/logger';

export default function NewTenantPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    commission: '10',
  });

  /**
   * Auto-generate slug from name
   */
  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    }));
  };

  /**
   * Copy secret key to clipboard
   * Wrapped in try/catch as clipboard API can fail in non-HTTPS contexts or older browsers
   */
  const handleCopyKey = async () => {
    if (!secretKey) return;

    try {
      await navigator.clipboard.writeText(secretKey);
      setCopied(true);
      setCopyError(null);
      // Clear any existing timeout before setting a new one
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy to clipboard', err instanceof Error ? err : undefined);
      setCopyError('Failed to copy. Please select and copy manually.');
    }
  };

  /**
   * Submit form to create tenant
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await createTenant({
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        commission: parseFloat(formData.commission),
      });

      if (result.error) {
        setError(result.error);
      } else if (result.secretKey) {
        setSecretKey(result.secretKey);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Secret key display state - shown after successful creation
  if (secretKey) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card colorScheme="dark">
          <CardContent className="pt-8 pb-8">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sage/10">
              <Key className="h-8 w-8 text-sage" />
            </div>
            <h2 className="mb-2 text-center font-serif text-2xl font-bold text-text-primary">
              Tenant Created Successfully
            </h2>
            <p className="mb-6 text-center text-text-muted">
              Save this secret key now. It will only be shown once.
            </p>

            <div className="mb-6 p-4 bg-surface rounded-lg border border-neutral-700">
              <Label className="text-text-muted text-xs mb-2 block">Secret API Key</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-sm text-sage break-all select-all">
                  {secretKey}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyKey} className="shrink-0">
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-sage" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {copyError && <p className="mt-2 text-xs text-red-400">{copyError}</p>}
            </div>

            <Alert className="mb-6 bg-amber-950/50 border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-amber-300">
                This secret key will not be displayed again. Store it securely.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                variant="sage"
                onClick={() => router.push('/admin/tenants')}
                className="flex-1"
              >
                Back to Tenants
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSecretKey(null);
                  setFormData({ name: '', slug: '', commission: '10' });
                }}
              >
                Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/admin/tenants"
        className="mb-6 inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tenants
      </Link>

      <Card colorScheme="dark">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Create New Tenant</CardTitle>
          <CardDescription>Add a new business to the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Business Name</Label>
              <Input
                id="name"
                placeholder="Bella Weddings Photography"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="bg-surface border-neutral-700"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-sm">/t/</span>
                <Input
                  id="slug"
                  placeholder="bella-weddings"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    }))
                  }
                  className="bg-surface border-neutral-700"
                  required
                  pattern="[a-z0-9-]+"
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-xs text-text-muted">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commission">Platform Commission (%)</Label>
              <Input
                id="commission"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={formData.commission}
                onChange={(e) => setFormData((prev) => ({ ...prev, commission: e.target.value }))}
                className="bg-surface border-neutral-700 w-32"
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-text-muted">
                Percentage of each transaction taken by the platform
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" variant="sage" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Tenant'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/tenants')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
