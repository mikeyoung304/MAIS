/**
 * Authentication Types
 *
 * Type definitions for user authentication, JWT tokens, and role-based access control.
 * Aligned with backend TokenPayload and TenantTokenPayload interfaces.
 */

/**
 * User roles in the system
 */
export type UserRole = 'PLATFORM_ADMIN' | 'TENANT_ADMIN';

/**
 * Platform admin user details
 */
export interface PlatformAdminUser {
  id: string;
  email: string;
  role: 'PLATFORM_ADMIN';
}

/**
 * Tenant admin user details
 */
export interface TenantAdminUser {
  tenantId: string;
  slug: string;
  email: string;
  role: 'TENANT_ADMIN';
}

/**
 * Union type for all user types
 */
export type User = PlatformAdminUser | TenantAdminUser;

/**
 * Impersonation data in JWT token
 * Present when platform admin is impersonating a tenant
 */
export interface ImpersonationData {
  tenantId: string;
  tenantSlug: string;
  tenantEmail: string;
  startedAt: string;
}

/**
 * JWT token payload for platform admin
 * Maps to backend TokenPayload interface
 */
export interface PlatformAdminTokenPayload {
  userId: string;
  email: string;
  role: 'admin' | 'ADMIN' | 'PLATFORM_ADMIN';
  impersonating?: ImpersonationData; // Present when impersonating a tenant
  iat?: number; // Issued at (Unix timestamp)
  exp?: number; // Expiration (Unix timestamp)
}

/**
 * JWT token payload for tenant admin
 * Maps to backend TenantTokenPayload interface
 */
export interface TenantAdminTokenPayload {
  tenantId: string;
  slug: string;
  email: string;
  type: 'tenant';
  iat?: number; // Issued at (Unix timestamp)
  exp?: number; // Expiration (Unix timestamp)
}

/**
 * Union type for all JWT payloads
 */
export type TokenPayload = PlatformAdminTokenPayload | TenantAdminTokenPayload;

/**
 * Authentication state interface
 */
export interface AuthState {
  user: User | null;
  role: UserRole | null;
  tenantId: string | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  impersonation: ImpersonationData | null; // Present when admin is impersonating
}

/**
 * Authentication context interface
 * Provides all auth-related methods and state
 */
export interface AuthContextType extends AuthState {
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  signup: (email: string, password: string, businessName: string) => Promise<SignupResponse>;
  logout: () => void;
  isPlatformAdmin: () => boolean;
  isTenantAdmin: () => boolean;
  hasRole: (role: UserRole) => boolean;
  refreshAuth: () => void;
  isImpersonating: () => boolean; // True if admin is impersonating a tenant
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Login response from backend
 */
export interface LoginResponse {
  token: string;
}

/**
 * Signup credentials
 */
export interface SignupCredentials {
  email: string;
  password: string;
  businessName: string;
}

/**
 * Signup response from backend
 */
export interface SignupResponse {
  token: string;
  tenantId: string;
  slug: string;
  email: string;
  apiKeyPublic: string;
  secretKey: string;
}

/**
 * Auth error types
 */
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Auth error class
 */
export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
