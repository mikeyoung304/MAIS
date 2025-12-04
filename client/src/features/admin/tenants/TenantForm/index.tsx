/**
 * Tenant Form Component
 * For creating and editing tenants in the platform admin dashboard
 *
 * This is the main orchestrator that coordinates:
 * - Form state management via useTenantForm hook
 * - API calls via tenantApi service
 * - UI sections via BasicInfoFields and ConfigurationFields
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChevronLeft, Save, AlertCircle } from 'lucide-react';

import { BasicInfoFields } from './BasicInfoFields';
import { ConfigurationFields } from './ConfigurationFields';
import { LoadingState } from './LoadingState';
import { useTenantForm } from './useTenantForm';
import { tenantApi } from './tenantApi';

export function TenantForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const {
    formData,
    setFormData,
    updateFormData,
    errors,
    setErrors,
    isLoading,
    setIsLoading,
    isSubmitting,
    setIsSubmitting,
    validateForm,
    generateSlug,
  } = useTenantForm(id);

  // Load existing tenant if editing
  useEffect(() => {
    if (isEditing && id) {
      loadTenant();
    }
  }, [id]);

  const loadTenant = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await tenantApi.loadTenant(id);
      setFormData(data);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load tenant:', error);
      }
      toast.error('Failed to load tenant');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      let result;
      if (isEditing && id) {
        result = await tenantApi.updateTenant(id, formData);
        toast.success('Tenant updated successfully!');
      } else {
        result = await tenantApi.createTenant(formData);
        if (result.secretKey) {
          toast.success('Tenant created successfully!', {
            description: `IMPORTANT - Save this secret key: ${result.secretKey}\n\nThis will only be shown once.`,
            duration: 10000,
          });
        } else {
          toast.success('Tenant created successfully!');
        }
      }
      navigate('/admin/dashboard');
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('Failed to save tenant:', error);
      }
      setErrors({
        submit: error.message || 'Failed to save tenant. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-macon-navy-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/dashboard')}
            className="mb-4 text-white/70 hover:text-white/90"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <h1 className="text-3xl font-bold text-white">
            {isEditing ? 'Edit Tenant' : 'Add New Tenant'}
          </h1>
          <p className="text-white/70 mt-2">
            {isEditing
              ? 'Update tenant information and settings'
              : 'Create a new tenant account for the platform'}
          </p>
        </div>

        {/* Form */}
        <Card className="bg-macon-navy-800 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Tenant Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Alert */}
              {errors.submit && (
                <div className="bg-red-900/20 border border-red-500 text-red-200 p-4 rounded-lg flex items-start">
                  <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                  <div>{errors.submit}</div>
                </div>
              )}

              <BasicInfoFields
                formData={formData}
                errors={errors}
                isSubmitting={isSubmitting}
                onChange={updateFormData}
                onGenerateSlug={generateSlug}
              />

              <ConfigurationFields
                formData={formData}
                errors={errors}
                isSubmitting={isSubmitting}
                onChange={updateFormData}
              />

              {/* Submit Buttons */}
              <div className="flex gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin/dashboard')}
                  className="flex-1 border-white/20 text-white/70 hover:bg-macon-navy-700"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-lavender-600 hover:bg-lavender-700 text-white"
                  disabled={isSubmitting}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Saving...' : isEditing ? 'Update Tenant' : 'Create Tenant'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
