'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { updateTenant, deactivateTenant } from './actions';
import type { TenantEditFormData } from '../types';

interface EditTenantFormProps {
  tenant: TenantEditFormData;
}

export function EditTenantForm({ tenant }: EditTenantFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const [formData, setFormData] = useState({
    name: tenant.name,
    commission: tenant.commissionPercent.toString(),
    isActive: tenant.isActive,
  });

  /**
   * Submit form to update tenant
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const result = await updateTenant(tenant.id, {
        name: formData.name.trim(),
        commission: parseFloat(formData.commission),
        isActive: formData.isActive,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Tenant updated successfully');
        // Clear any existing timeout before setting a new one
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tenant');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Deactivate tenant (soft delete)
   * Called after user confirms via AlertDialog
   */
  const handleDeactivate = async () => {
    setError(null);
    setIsDeactivating(true);

    try {
      const result = await deactivateTenant(tenant.id);

      if (result.error) {
        setError(result.error);
      } else {
        router.push('/admin/tenants');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate tenant');
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card colorScheme="dark">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Edit {tenant.name}</CardTitle>
          <CardDescription>Tenant slug: {tenant.slug}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-green-950/50 border-green-800">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-300">{success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Business Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="bg-surface border-neutral-700"
                required
                disabled={isSubmitting}
              />
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

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="isActive" className="text-base">
                  Active Status
                </Label>
                <p className="text-xs text-text-muted">
                  Inactive tenants cannot access the platform
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
                disabled={isSubmitting}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" variant="sage" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
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

      {/* Danger zone */}
      <Card colorScheme="dark" className="border-red-900/50">
        <CardHeader>
          <CardTitle className="text-red-400 font-serif">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-primary font-medium">Deactivate Tenant</p>
              <p className="text-xs text-text-muted">
                The tenant will lose access to the platform immediately
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isDeactivating || !tenant.isActive}
                >
                  {isDeactivating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Deactivate
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate Tenant?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately disable their site. They won&apos;t be billed again. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeactivate}>Deactivate</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
