/**
 * Test fixtures for User entities
 */

import type { User, UserRole } from '../../generated/prisma/client';

/**
 * Build a test user with optional overrides
 */
export function buildUser(overrides?: Partial<User>): User {
  return {
    id: 'user_1',
    email: 'admin@example.com',
    name: 'Admin User',
    passwordHash: '$2a$10$FAKEHASH1234567890123456789012',
    role: 'ADMIN' as UserRole,
    tenantId: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Sample admin user for tests
 */
export const sampleAdminUser: User = buildUser();

/**
 * Sample platform admin user
 */
export const platformAdminUser: User = buildUser({
  id: 'user_2',
  email: 'platform@example.com',
  name: 'Platform Admin',
  role: 'PLATFORM_ADMIN' as UserRole,
});

/**
 * Sample tenant admin user
 */
export const tenantAdminUser: User = buildUser({
  id: 'user_3',
  email: 'tenant@example.com',
  name: 'Tenant Admin',
  role: 'TENANT_ADMIN' as UserRole,
  tenantId: 'tenant_1',
});

/**
 * Sample regular user
 */
export const regularUser: User = buildUser({
  id: 'user_4',
  email: 'user@example.com',
  name: 'Regular User',
  role: 'USER' as UserRole,
});
