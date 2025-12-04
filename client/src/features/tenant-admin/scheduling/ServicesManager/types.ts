import type { ServiceDto } from '@macon/contracts';

export interface ServiceFormData {
  slug: string;
  name: string;
  description: string;
  durationMinutes: string;
  bufferMinutes: string;
  priceCents: string;
  timezone: string;
  sortOrder: string;
  active: boolean;
}

export interface ServicesManagerProps {
  onServicesChange?: () => void;
}

export interface ServicesListProps {
  services: ServiceDto[];
  onEdit: (service: ServiceDto) => void;
  onDelete: (service: ServiceDto) => void;
  onToggleActive: (service: ServiceDto) => void;
  isLoading?: boolean;
}

export interface ServiceFormProps {
  serviceForm: ServiceFormData;
  editingServiceId: string | null;
  isSaving: boolean;
  error: string | null;
  onFormChange: (form: ServiceFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  serviceToDelete: ServiceDto | null;
  onConfirm: () => void;
  onCancel: () => void;
}
