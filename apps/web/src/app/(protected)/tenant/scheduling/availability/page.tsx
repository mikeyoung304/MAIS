'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Plus, Loader2, AlertCircle } from 'lucide-react';
import { AvailabilityRulesList } from '@/components/scheduling/AvailabilityRulesList';
import { AvailabilityRuleForm } from '@/components/scheduling/AvailabilityRuleForm';

/**
 * DTO Types
 */
interface AvailabilityRuleDto {
  id: string;
  tenantId: string;
  serviceId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ServiceDto {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

/**
 * Tenant Availability Rules Page
 *
 * Allows tenant admins to manage their weekly availability schedule.
 * Rules define when their services are available for booking.
 */
export default function TenantAvailabilityRulesPage() {
  const { isAuthenticated } = useAuth();
  const [rules, setRules] = useState<AvailabilityRuleDto[]>([]);
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingRule, setIsCreatingRule] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const response = await fetch('/api/tenant-admin/availability-rules');
      if (response.ok) {
        const data = await response.json();
        setRules(Array.isArray(data) ? data : []);
      } else {
        setError('Failed to load availability rules');
      }
    } catch {
      setError('Failed to load availability rules');
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch('/api/tenant-admin/services');
      if (response.ok) {
        const data = await response.json();
        // Sort services by sortOrder ascending
        const sortedServices = [...data].sort(
          (a: ServiceDto, b: ServiceDto) => a.sortOrder - b.sortOrder
        );
        setServices(sortedServices);
      }
    } catch {
      // Services are optional for rule creation, so we don't set an error
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!isAuthenticated) return;

      setIsLoading(true);
      await Promise.all([fetchRules(), fetchServices()]);
      setIsLoading(false);
    }

    fetchData();
  }, [isAuthenticated, fetchRules, fetchServices]);

  const handleRuleCreated = useCallback(() => {
    setIsCreatingRule(false);
    fetchRules();
  }, [fetchRules]);

  const handleRuleDeleted = useCallback(() => {
    fetchRules();
  }, [fetchRules]);

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
