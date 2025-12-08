/**
 * Prisma Early Access Repository Adapter
 *
 * Handles early access request persistence for homepage waitlist signups.
 * This repository is tenant-agnostic (platform-level feature).
 */

import type { PrismaClient } from '../../generated/prisma';
import type { EarlyAccessRepository, EarlyAccessRequest } from '../../lib/ports';

export class PrismaEarlyAccessRepository implements EarlyAccessRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Upsert early access request
   * Creates a new request or updates the timestamp if email already exists
   *
   * @param email - Normalized email address
   * @param source - Source of the request (e.g., 'homepage')
   * @returns The request and whether it was newly created
   */
  async upsert(
    email: string,
    source: string
  ): Promise<{ request: EarlyAccessRequest; isNew: boolean }> {
    const result = await this.prisma.earlyAccessRequest.upsert({
      where: { email },
      update: { updatedAt: new Date() },
      create: {
        email,
        source,
        status: 'pending',
      },
    });

    // Determine if this was a new request by comparing timestamps
    const isNew = result.createdAt.getTime() === result.updatedAt.getTime();

    return {
      request: {
        id: result.id,
        email: result.email,
        source: result.source,
        status: result.status,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
      isNew,
    };
  }
}
