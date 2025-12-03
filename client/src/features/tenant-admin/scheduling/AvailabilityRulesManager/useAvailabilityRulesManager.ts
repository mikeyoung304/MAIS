import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { useSuccessMessage } from "@/hooks/useSuccessMessage";
import type { AvailabilityRuleDto, RuleFormData } from "./types";
import { getTodayISODate } from "./utils";

/**
 * useAvailabilityRulesManager Hook
 *
 * Manages availability rules form state and API interactions
 */
export function useAvailabilityRulesManager(onRulesChange: () => void) {
  // Form state
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { message: successMessage, showSuccess } = useSuccessMessage();
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<AvailabilityRuleDto | null>(null);

  // Rule form data
  const [ruleForm, setRuleForm] = useState<RuleFormData>({
    serviceId: null,
    dayOfWeek: 1, // Monday
    startTime: "09:00",
    endTime: "17:00",
    effectiveFrom: getTodayISODate(),
    effectiveTo: null,
  });

  const handleCreateRule = () => {
    setIsCreatingRule(true);
    setError(null);
    // Reset form to defaults
    setRuleForm({
      serviceId: null,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
      effectiveFrom: getTodayISODate(),
      effectiveTo: null,
    });
  };

  const handleCancelRuleForm = () => {
    setIsCreatingRule(false);
    setError(null);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      // Validate times
      if (ruleForm.startTime >= ruleForm.endTime) {
        setError("End time must be after start time");
        setIsSaving(false);
        return;
      }

      const result = await api.tenantAdminCreateAvailabilityRule({
        body: {
          serviceId: ruleForm.serviceId,
          dayOfWeek: ruleForm.dayOfWeek,
          startTime: ruleForm.startTime,
          endTime: ruleForm.endTime,
          effectiveFrom: ruleForm.effectiveFrom
            ? new Date(ruleForm.effectiveFrom).toISOString()
            : new Date().toISOString(),
          effectiveTo: ruleForm.effectiveTo
            ? new Date(ruleForm.effectiveTo).toISOString()
            : null,
        },
      });

      if (result.status === 201) {
        showSuccess("Availability rule created successfully");
        setIsCreatingRule(false);
        onRulesChange();
      } else if (result.status === 409) {
        setError("A rule with this time slot already exists for this day and service");
      } else {
        setError("Failed to create availability rule. Please try again.");
        toast.error("Failed to create availability rule", {
          description: "Please try again or contact support.",
        });
      }
    } catch (err) {
      logger.error("Failed to create availability rule", {
        error: err,
        component: "useAvailabilityRulesManager",
      });
      setError("An error occurred while creating the rule");
      toast.error("An error occurred while creating the availability rule", {
        description: "Please try again or contact support.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (rule: AvailabilityRuleDto) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!ruleToDelete) return;

    try {
      const result = await api.tenantAdminDeleteAvailabilityRule({
        params: { id: ruleToDelete.id },
        body: undefined,
      });

      if (result.status === 204) {
        showSuccess("Availability rule deleted successfully");
        onRulesChange();
        setDeleteDialogOpen(false);
        setRuleToDelete(null);
      } else {
        toast.error("Failed to delete availability rule", {
          description: "Please try again or contact support.",
        });
      }
    } catch (err) {
      logger.error("Failed to delete availability rule", {
        error: err,
        component: "useAvailabilityRulesManager",
        ruleId: ruleToDelete.id,
      });
      toast.error("An error occurred while deleting the availability rule", {
        description: "Please try again or contact support.",
      });
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setRuleToDelete(null);
  };

  return {
    // Form state
    isCreatingRule,
    isSaving,
    error,
    ruleForm,
    setRuleForm,

    // Dialog state
    deleteDialogOpen,
    setDeleteDialogOpen,
    ruleToDelete,

    // Messages
    successMessage,

    // Actions
    handleCreateRule,
    handleSaveRule,
    handleDeleteClick,
    confirmDelete,
    cancelDelete,
    handleCancelRuleForm,
  };
}
