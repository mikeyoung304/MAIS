/**
 * Type definitions for BlackoutsManager
 */

export type BlackoutDto = {
  id: string;
  tenantId: string;
  date: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

export interface BlackoutsManagerProps {
  blackouts: BlackoutDto[];
  isLoading: boolean;
  onBlackoutsChange: () => void;
}
