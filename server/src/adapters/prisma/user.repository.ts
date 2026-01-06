/**
 * Prisma User Repository Adapter
 */

import type { PrismaClient } from '../../generated/prisma/client';
import type { UserRepository, User } from '../lib/ports';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role as 'admin',
    };
  }
}
