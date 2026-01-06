'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Plus, Loader2, AlertCircle } from 'lucide-react';
import { AvailabilityRulesList } from '@/components/scheduling/AvailabilityRulesList';
import { AvailabilityRuleForm } from '@/components/scheduling/AvailabilityRuleForm';
import { queryKeys, queryOptions } from '@/lib/query-client';
import type { AvailabilityRuleDto, ServiceDto } from '@macon/contracts';

/**
 * Tenant Availability Rules Page
 *
 * Allows tenant admins to manage their weekly availability schedule.
 * Rules define when their services are available for booking.
 */
export default function TenantAvailabilityRulesPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [isCreatingRule, setIsCreatingRule] = useState(false);

  // Fetch availability rules with React Query
  const {
    data: rules = [],
    isLoading: rulesLoading,
    error: rulesError,
  } = useQuery({
    queryKey: queryKeys.tenantAdmin.availabilityRules,
    queryFn: async () => {
      const response = await fetch('/api/tenant-admin/availability-rules');
      if (!response.ok) throw new Error('Failed to load availability rules');
      const data = await response.json();
      return Array.isArray(data) ? (data as AvailabilityRuleDto[]) : [];
    },
    enabled: isAuthenticated,
    ...queryOptions.catalog, // Rules change less frequently
  });

  // Fetch services with React Query (for dropdown)
  const { data: servicesRaw = [] } = useQuery({
    queryKey: queryKeys.tenantAdmin.services,
    queryFn: async () => {
      const response = await fetch('/api/tenant-admin/services');
      if (!response.ok) throw new Error('Failed to load services');
      const data = await response.json();
      return Array.isArray(data) ? (data as ServiceDto[]) : [];
    },
    enabled: isAuthenticated,
    ...queryOptions.catalog, // Services change less frequently
  });

  // Sort services by sortOrder ascending
  const services = useMemo(
    () => [...servicesRaw].sort((a, b) => a.sortOrder - b.sortOrder),
    [servicesRaw]
  );

  const isLoading = rulesLoading;
  const error = rulesError ? (rulesError as Error).message : null;

  /**
   * Invalidate and refetch availability rules after mutations
   */
  const invalidateRules = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tenantAdmin.availabilityRules });
  }, [queryClient]);

  const handleRuleCreated = useCallback(() => {
    setIsCreatingRule(false);
    invalidateRules();
  }, [invalidateRules]);

  const handleRuleDeleted = useCallback(() => {
    invalidateRules();
  }, [invalidateRules]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-text-primary">Availability Rules</h1>
            <p className="mt-2 text-text-muted">Define when your services are available</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-text-primary">Availability Rules</h1>
            <p className="mt-2 text-text-muted">Define when your services are available</p>
          </div>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Availability Rules</h1>
          <p className="mt-2 text-text-muted">
            {rules.length === 0
              ? 'Set your weekly schedule to start accepting bookings'
              : `${rules.length} rule${rules.length !== 1 ? 's' : ''} defining your schedule`}
          </p>
        </div>
        {!isCreatingRule && (
          <Button variant="sage" className="rounded-full" onClick={() => setIsCreatingRule(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Availability
          </Button>
        )}
      </div>

      {/* Create Rule Form */}
      {isCreatingRule && (
        <AvailabilityRuleForm
          services={services}
          onSuccess={handleRuleCreated}
          onCancel={() => setIsCreatingRule(false)}
        />
      )}

      {/* Empty State */}
      {rules.length === 0 && !isCreatingRule ? (
        <Card className="border-2 border-dashed border-sage/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-sage/10 p-4">
              <Calendar className="h-8 w-8 text-sage" />
            </div>
            <h3 className="mb-2 font-semibold text-text-primary">No availability rules yet</h3>
            <p className="mb-6 max-w-sm text-sm text-text-muted">
              Availability rules define when customers can book your services. Add your first rule
              to set your weekly schedule.
            </p>
            <Button variant="sage" className="rounded-full" onClick={() => setIsCreatingRule(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Rules List */
        <AvailabilityRulesList
          rules={rules}
          services={services}
          onRuleDeleted={handleRuleDeleted}
        />
      )}
    </div>
  );
}
