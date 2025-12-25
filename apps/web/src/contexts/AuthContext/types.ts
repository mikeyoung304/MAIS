/**
 * Authentication Types
 *
 * Type definitions for the authentication system.
 * Compatible with the Express API JWT structure.
 */

export type UserRole = 'PLATFORM_ADMIN' | 'TENANT_ADMIN';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  slug?: string;
}

export interface ImpersonationData {
  tenantId: string;
  tenantSlug: string;
  tenantEmail: string;
  startedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  tenantId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  impersonation: ImpersonationData | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  signup: (email: string, password: string, businessName: string) => Promise<SignupResponse>;
  logout: () => void;
  refreshAuth: () => void;
  isPlatformAdmin: () => boolean;
  isTenantAdmin: () => boolean;
  hasRole: (role: UserRole) => boolean;
  isImpersonating: () => boolean;
}

export interface LoginResponse {
  token: string;
  role: UserRole;
  email: string;
  userId?: string;
  tenantId?: string;
  slug?: string;
}

export interface SignupResponse {
  token: string;
  tenantId: string;
  slug: string;
  email: string;
  apiKeyPublic: string;
  secretKey: string;
}

/**
 * Platform Admin JWT Payload
 */
export interface PlatformAdminTokenPayload {
  userId: string;
  email: string;
  role: 'admin' | 'ADMIN' | 'PLATFORM_ADMIN';
  impersonating?: ImpersonationData;
  iat?: number;
  exp?: number;
}

/**
 * Tenant Admin JWT Payload
 */
export interface TenantAdminTokenPayload {
  tenantId: string;
  slug: string;
  email: string;
  type: 'tenant';
  iat?: number;
  exp?: number;
}

export type TokenPayload = PlatformAdminTokenPayload | TenantAdminTokenPayload;
