import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSuccessMessage } from '@/hooks/useSuccessMessage';
import type { BlackoutDto } from './types';

/**
 * useBlackoutsManager Hook
 *
 * Manages blackout form state and API interactions
 */
export function useBlackoutsManager(onBlackoutsChange: () => void) {
  const [newBlackoutDate, setNewBlackoutDate] = useState('');
  const [newBlackoutReason, setNewBlackoutReason] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { message: successMessage, showSuccess } = useSuccessMessage();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [blackoutToDelete, setBlackoutToDelete] = useState<BlackoutDto | null>(null);

  const handleAddBlackout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlackoutDate) return;

    setIsAdding(true);

    try {
      const result = await api.tenantAdminCreateBlackout({
        body: {
          date: newBlackoutDate,
          reason: newBlackoutReason || undefined,
        },
      });

      if (result.status === 201) {
        setNewBlackoutDate('');
        setNewBlackoutReason('');
        showSuccess('Blackout date added successfully');
        onBlackoutsChange();
      } else {
        toast.error('Failed to create blackout date', {
          description: 'Please try again or contact support.',
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to create blackout:', error);
      }
      toast.error('An error occurred while creating the blackout date', {
        description: 'Please try again or contact support.',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteClick = (blackout: BlackoutDto) => {
    setBlackoutToDelete(blackout);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!blackoutToDelete) return;

    try {
      const result = await api.tenantAdminDeleteBlackout({
        params: { id: blackoutToDelete.id },
        body: undefined,
      });

      if (result.status === 204) {
        showSuccess('Blackout date deleted successfully');
        onBlackoutsChange();
        setDeleteDialogOpen(false);
        setBlackoutToDelete(null);
      } else {
        toast.error('Failed to delete blackout date', {
          description: 'Please try again or contact support.',
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to delete blackout:', error);
      }
      toast.error('An error occurred while deleting the blackout date', {
        description: 'Please try again or contact support.',
      });
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setBlackoutToDelete(null);
  };

  // Calculate if form has unsaved changes
  const isDirty = newBlackoutDate.trim() !== '' || newBlackoutReason.trim() !== '';

  return {
    // Form state
    newBlackoutDate,
    setNewBlackoutDate,
    newBlackoutReason,
    setNewBlackoutReason,
    isAdding,
    isDirty,

    // Dialog state
    deleteDialogOpen,
    setDeleteDialogOpen,
    blackoutToDelete,

    // Messages
    successMessage,

    // Actions
    handleAddBlackout,
    handleDeleteClick,
    confirmDelete,
    cancelDelete,
  };
}
