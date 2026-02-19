/**
 * Mock Early Access Repository
 *
 * In-memory implementation of EarlyAccessRepository for testing and local development.
 */

import type { EarlyAccessRepository, EarlyAccessRequest } from '../../lib/ports';
import { logger } from '../../lib/core/logger';
import { earlyAccessRequests } from './state';

export class MockEarlyAccessRepository implements EarlyAccessRepository {
  async upsert(
    email: string,
    source: string
  ): Promise<{ request: EarlyAccessRequest; isNew: boolean }> {
    const existing = earlyAccessRequests.get(email);
    const now = new Date();

    if (existing) {
      existing.updatedAt = now;
      logger.debug({ email }, 'Mock early access request updated');
      return { request: existing, isNew: false };
    }

    const request: EarlyAccessRequest = {
      id: `ear_${Date.now()}`,
      email,
      source,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    earlyAccessRequests.set(email, request);
    logger.debug({ email, id: request.id }, 'Mock early access request created');
    return { request, isNew: true };
  }
}
