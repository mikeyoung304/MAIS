/**
 * AvailabilityRulesManager Component
 *
 * Main orchestrator for tenant admin availability rules management.
 * Allows tenant admins to define when their services are available (weekly schedule).
 *
 * Features:
 * - Display rules grouped by day of week
 * - Create new rule with form
 * - Delete rule with confirmation
 * - Filter by service (optional)
 * - Visual weekly schedule view
 *
 * API Endpoints:
 * - GET /v1/tenant-admin/availability-rules - List all rules
 * - POST /v1/tenant-admin/availability-rules - Create rule
 * - DELETE /v1/tenant-admin/availability-rules/:id - Delete rule
 */

import { useState, useEffect } from 'react';
import type { AvailabilityRuleDto, ServiceDto } from '@macon/contracts';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { SuccessMessage } from '@/components/shared/SuccessMessage';
import { CreateRuleButton } from './CreateRuleButton';
import { RuleForm } from './RuleForm';
import { RulesList } from './RulesList';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { useAvailabilityRulesManager } from './useAvailabilityRulesManager';

export function AvailabilityRulesManager() {
  const [rules, setRules] = useState<AvailabilityRuleDto[]>([]);
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const result = await api.tenantAdminGetAvailabilityRules();
      if (result.status === 200) {
        setRules(result.body);
      }
    } catch (error) {
      logger.error('Failed to fetch availability rules', {
        error,
        component: 'AvailabilityRulesManager',
      });
      toast.error('Failed to load availability rules', {
        description: 'Please refresh the page or contact support.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const result = await api.tenantAdminGetServices();
      if (result.status === 200) {
        // Sort services by sortOrder ascending
        const sortedServices = [...result.body].sort((a, b) => a.sortOrder - b.sortOrder);
        setServices(sortedServices);
      }
    } catch (error) {
      logger.error('Failed to fetch services', {
        error,
        component: 'AvailabilityRulesManager',
      });
      toast.error('Failed to load services', {
        description: 'Service dropdown may be empty. Please refresh the page.',
      });
    }
  };

  useEffect(() => {
    fetchRules();
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    isCreatingRule,
    isSaving,
    error,
    ruleForm,
    setRuleForm,
    deleteDialogOpen,
    setDeleteDialogOpen,
    ruleToDelete,
    successMessage,
    handleCreateRule,
    handleSaveRule,
    handleDeleteClick,
    confirmDelete,
    cancelDelete,
    handleCancelRuleForm,
  } = useAvailabilityRulesManager(fetchRules);

  return (
    <div className="space-y-6">
      {/* Success Message */}
      <SuccessMessage message={successMessage} />

      {/* Create Rule Button */}
      {!isCreatingRule && <CreateRuleButton onClick={handleCreateRule} />}

      {/* Create Rule Form */}
      {isCreatingRule && (
        <RuleForm
          ruleForm={ruleForm}
          services={services}
          isSaving={isSaving}
          error={error}
          onFormChange={setRuleForm}
          onSubmit={handleSaveRule}
          onCancel={handleCancelRuleForm}
        />
      )}

      {/* Rules List */}
      <RulesList
        rules={rules}
        services={services}
        isLoading={isLoading}
        onDeleteClick={handleDeleteClick}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        ruleToDelete={ruleToDelete}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
