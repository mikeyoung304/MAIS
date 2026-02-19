/**
 * Blackout Repository Port — Blackout date management
 */

/**
 * Blackout Repository - Blackout date management
 */
export interface BlackoutRepository {
  isBlackoutDate(tenantId: string, date: string): Promise<boolean>;
  getAllBlackouts(tenantId: string): Promise<{ date: string; reason?: string }[]>;
  addBlackout(tenantId: string, date: string, reason?: string): Promise<void>;
  deleteBlackout(tenantId: string, id: string): Promise<void>;
  findBlackoutById(
    tenantId: string,
    id: string
  ): Promise<{ id: string; date: string; reason?: string } | null>;
}
