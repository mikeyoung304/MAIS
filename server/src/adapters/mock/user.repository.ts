/**
 * Mock User Repository
 *
 * In-memory implementation of UserRepository for testing and local development.
 */

import type { User, UserRepository } from '../../lib/ports';
import { users } from './state';

export class MockUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return users.get(email) || null;
  }
}
