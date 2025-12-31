/**
 * Mock Advisor Memory Repository for testing
 *
 * In-memory implementation of AdvisorMemoryRepository for unit tests.
 * Enables testing onboarding agent logic without database connections.
 */

import type { AdvisorMemoryRepository } from '../../lib/ports';
import type { AdvisorMemory, OnboardingPhase } from '@macon/contracts';

// In-memory storage keyed by tenantId
const tenantMemories = new Map<string, AdvisorMemory>();
const tenantEvents = new Map<
  string,
  Array<{
    id: string;
    eventType: string;
    version: number;
    timestamp: Date;
  }>
>();

export class MockAdvisorMemoryRepository implements AdvisorMemoryRepository {
  async getMemory(tenantId: string): Promise<AdvisorMemory | null> {
    return tenantMemories.get(tenantId) || null;
  }

  async projectFromEvents(tenantId: string): Promise<AdvisorMemory> {
    // Return stored memory or default
    const existing = tenantMemories.get(tenantId);
    if (existing) {
      return existing;
    }

    // Return default memory for new tenant
    return {
      tenantId,
      currentPhase: 'NOT_STARTED' as OnboardingPhase,
      lastEventVersion: 0,
      lastEventTimestamp: new Date().toISOString(),
    };
  }

  async clearMemory(tenantId: string): Promise<void> {
    tenantMemories.delete(tenantId);
    tenantEvents.delete(tenantId);
  }

  async getEventHistory(
    tenantId: string,
    limit = 50
  ): Promise<
    Array<{
      id: string;
      eventType: string;
      version: number;
      timestamp: Date;
    }>
  > {
    const events = tenantEvents.get(tenantId) || [];
    return events.slice(0, limit);
  }

  // ============================================================================
  // Test Helpers (not in interface, for test setup)
  // ============================================================================

  /**
   * Set memory state directly for testing
   */
  setMemory(tenantId: string, memory: AdvisorMemory): void {
    tenantMemories.set(tenantId, memory);
  }

  /**
   * Add an event to history for testing
   */
  addEvent(
    tenantId: string,
    event: { id: string; eventType: string; version: number; timestamp: Date }
  ): void {
    const events = tenantEvents.get(tenantId) || [];
    events.push(event);
    tenantEvents.set(tenantId, events);
  }

  /**
   * Clear all mock state (call in beforeEach/afterEach)
   */
  static reset(): void {
    tenantMemories.clear();
    tenantEvents.clear();
  }
}
