/**
 * User & Authentication Port — User entity, roles, and JWT token payloads
 */

/**
 * User Repository - User authentication and management
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
}

/**
 * User entity with authentication details
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin';
}

/**
 * Standardized role types for unified authentication
 */
export type UserRole = 'PLATFORM_ADMIN' | 'TENANT_ADMIN';

/**
 * JWT token payload for platform admin authentication
 */
export interface TokenPayload {
  userId: string;
  email: string;
  role: 'admin';
}

/**
 * JWT token payload for tenant authentication
 * Includes tenant context instead of user context
 */
export interface TenantTokenPayload {
  tenantId: string;
  slug: string;
  email: string;
  type: 'tenant'; // Distinguishes from platform admin tokens
}

/**
 * Unified JWT token payload (supports both admin and tenant)
 * Use this for new implementations
 */
export interface UnifiedTokenPayload {
  // Common fields
  email: string;
  role: UserRole;

  // Platform admin fields (present when role = PLATFORM_ADMIN)
  userId?: string;

  // Tenant admin fields (present when role = TENANT_ADMIN)
  tenantId?: string;
  slug?: string;

  // Impersonation fields (present when platform admin impersonates tenant)
  impersonating?: {
    tenantId: string;
    tenantSlug: string;
    tenantEmail: string;
    startedAt: string; // ISO timestamp
  };
}
