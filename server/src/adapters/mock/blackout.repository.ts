/**
 * Mock Blackout Repository
 *
 * In-memory implementation of BlackoutRepository for testing and local development.
 */

import { toUtcMidnight } from '@macon/shared';
import type { BlackoutRepository } from '../../lib/ports';
import { blackouts } from './state';

export class MockBlackoutRepository implements BlackoutRepository {
  async isBlackoutDate(_tenantId: string, date: string): Promise<boolean> {
    const dateKey = toUtcMidnight(date);
    return blackouts.has(dateKey);
  }

  async getAllBlackouts(_tenantId: string): Promise<Array<{ date: string; reason?: string }>> {
    return Array.from(blackouts.values());
  }

  async addBlackout(_tenantId: string, date: string, reason?: string): Promise<void> {
    const dateKey = toUtcMidnight(date);
    blackouts.set(dateKey, { date: dateKey, reason });
  }

  async deleteBlackout(_tenantId: string, id: string): Promise<void> {
    const dateKey = toUtcMidnight(id);
    blackouts.delete(dateKey);
  }

  async findBlackoutById(
    _tenantId: string,
    id: string
  ): Promise<{ id: string; date: string; reason?: string } | null> {
    const dateKey = toUtcMidnight(id);
    const blackout = blackouts.get(dateKey);
    if (!blackout) return null;
    return {
      id: dateKey,
      ...blackout,
    };
  }
}
