/**
 * Authentication Utilities
 *
 * JWT token decoding, validation, and token management utilities.
 * Handles both platform admin and tenant admin authentication.
 */

import {
  TokenPayload,
  PlatformAdminTokenPayload,
  TenantAdminTokenPayload,
  ImpersonationData,
  User,
  UserRole,
  AuthError,
  AuthErrorType,
} from '../types/auth';

/**
 * LocalStorage keys for authentication
 */
export const AUTH_STORAGE_KEYS = {
  PLATFORM_ADMIN_TOKEN: 'adminToken',
  TENANT_ADMIN_TOKEN: 'tenantToken',
} as const;

/**
 * Base64 URL decode helper
 * Converts base64url to base64 by replacing URL-safe characters
 */
function base64UrlDecode(str: string): string {
  // Replace URL-safe characters with standard base64 characters
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) {
      throw new Error('Invalid base64url string');
    }
    base64 += new Array(5 - pad).join('=');
  }

  return atob(base64);
}

/**
 * Decode JWT token without verification
 * Note: This only decodes the token, it does NOT verify the signature.
 * Token signature verification happens on the backend.
 *
 * @param token - JWT token string
 * @returns Decoded token payload
 * @throws AuthError if token is malformed
 */
export function decodeJWT(token: string): TokenPayload {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');

    if (parts.length !== 3) {
      throw new AuthError(
        AuthErrorType.INVALID_TOKEN,
        'Invalid JWT format: expected 3 parts separated by dots'
      );
    }

    // Decode the payload (second part)
    const payload = parts[1];
    const decodedPayload = base64UrlDecode(payload);
    const parsed = JSON.parse(decodedPayload);

    return parsed as TokenPayload;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(
      AuthErrorType.INVALID_TOKEN,
      `Failed to decode JWT: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if token is expired
 *
 * @param token - JWT token string
 * @returns true if token is expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJWT(token);

    if (!payload.exp) {
      // If no expiration, consider it expired for safety
      return true;
    }

    // exp is in seconds, Date.now() is in milliseconds
    const expirationTime = payload.exp * 1000;
    const currentTime = Date.now();

    // Add 60 second buffer to account for clock skew
    return currentTime >= expirationTime - 60000;
  } catch {
    // If we can't decode the token, consider it expired
    return true;
  }
}

/**
 * Type guard to check if payload is platform admin
 */
export function isPlatformAdminPayload(
  payload: TokenPayload
): payload is PlatformAdminTokenPayload {
  // Handle all platform admin role variants
  return (
    'role' in payload &&
    (payload.role === 'admin' || payload.role === 'ADMIN' || payload.role === 'PLATFORM_ADMIN')
  );
}

/**
 * Type guard to check if payload is tenant admin
 */
export function isTenantAdminPayload(payload: TokenPayload): payload is TenantAdminTokenPayload {
  return 'type' in payload && payload.type === 'tenant';
}

/**
 * Convert JWT payload to User object
 *
 * @param payload - Decoded JWT payload
 * @returns User object
 */
export function payloadToUser(payload: TokenPayload): User {
  if (isPlatformAdminPayload(payload)) {
    return {
      id: payload.userId,
      email: payload.email,
      role: 'PLATFORM_ADMIN' as const,
    };
  }

  if (isTenantAdminPayload(payload)) {
    return {
      tenantId: payload.tenantId,
      slug: payload.slug,
      email: payload.email,
      role: 'TENANT_ADMIN' as const,
    };
  }

  throw new AuthError(AuthErrorType.INVALID_TOKEN, 'Unknown token payload type');
}

/**
 * Get user role from token
 *
 * @param token - JWT token string
 * @returns User role or null if invalid
 */
export function getRoleFromToken(token: string): UserRole | null {
  try {
    const payload = decodeJWT(token);
    const user = payloadToUser(payload);
    return user.role;
  } catch {
    return null;
  }
}

/**
 * Get tenant ID from token (if tenant admin)
 *
 * @param token - JWT token string
 * @returns Tenant ID or null if not a tenant admin token
 */
export function getTenantIdFromToken(token: string): string | null {
  try {
    const payload = decodeJWT(token);
    if (isTenantAdminPayload(payload)) {
      return payload.tenantId;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get impersonation data from token (if platform admin impersonating)
 *
 * @param token - JWT token string
 * @returns Impersonation data or null if not impersonating
 */
export function getImpersonationFromToken(token: string): ImpersonationData | null {
  try {
    const payload = decodeJWT(token);
    if (isPlatformAdminPayload(payload) && payload.impersonating) {
      return payload.impersonating;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Store authentication token in localStorage
 *
 * @param token - JWT token to store
 * @param role - User role to determine storage key
 */
export function storeToken(token: string, role: UserRole): void {
  const key =
    role === 'PLATFORM_ADMIN'
      ? AUTH_STORAGE_KEYS.PLATFORM_ADMIN_TOKEN
      : AUTH_STORAGE_KEYS.TENANT_ADMIN_TOKEN;

  localStorage.setItem(key, token);
}

/**
 * Get authentication token from localStorage
 *
 * @param role - User role to determine which token to retrieve
 * @returns Token string or null if not found
 */
export function getToken(role: UserRole): string | null {
  const key =
    role === 'PLATFORM_ADMIN'
      ? AUTH_STORAGE_KEYS.PLATFORM_ADMIN_TOKEN
      : AUTH_STORAGE_KEYS.TENANT_ADMIN_TOKEN;

  return localStorage.getItem(key);
}

/**
 * Remove authentication token from localStorage
 *
 * @param role - User role to determine which token to remove
 */
export function removeToken(role: UserRole): void {
  const key =
    role === 'PLATFORM_ADMIN'
      ? AUTH_STORAGE_KEYS.PLATFORM_ADMIN_TOKEN
      : AUTH_STORAGE_KEYS.TENANT_ADMIN_TOKEN;

  localStorage.removeItem(key);
}

/**
 * Clear all authentication tokens
 */
export function clearAllTokens(): void {
  localStorage.removeItem(AUTH_STORAGE_KEYS.PLATFORM_ADMIN_TOKEN);
  localStorage.removeItem(AUTH_STORAGE_KEYS.TENANT_ADMIN_TOKEN);
}

/**
 * Validate and decode token from localStorage
 *
 * @param role - User role to determine which token to validate
 * @returns Decoded user object or null if invalid/expired
 */
export function validateStoredToken(role: UserRole): User | null {
  const token = getToken(role);

  if (!token) {
    return null;
  }

  // Check if token is expired
  if (isTokenExpired(token)) {
    removeToken(role);
    return null;
  }

  try {
    const payload = decodeJWT(token);
    return payloadToUser(payload);
  } catch {
    removeToken(role);
    return null;
  }
}

/**
 * Get the active user from localStorage
 * Checks both platform admin and tenant admin tokens
 *
 * @returns User object with role and token, or null if not authenticated
 */
export function getActiveUser(): { user: User; token: string; role: UserRole } | null {
  // Check platform admin first
  const platformAdminToken = getToken('PLATFORM_ADMIN');
  if (platformAdminToken && !isTokenExpired(platformAdminToken)) {
    try {
      const payload = decodeJWT(platformAdminToken);
      const user = payloadToUser(payload);
      return { user, token: platformAdminToken, role: 'PLATFORM_ADMIN' };
    } catch {
      removeToken('PLATFORM_ADMIN');
    }
  }

  // Check tenant admin
  const tenantAdminToken = getToken('TENANT_ADMIN');
  if (tenantAdminToken && !isTokenExpired(tenantAdminToken)) {
    try {
      const payload = decodeJWT(tenantAdminToken);
      const user = payloadToUser(payload);
      return { user, token: tenantAdminToken, role: 'TENANT_ADMIN' };
    } catch {
      removeToken('TENANT_ADMIN');
    }
  }

  return null;
}

/**
 * Format time remaining until token expiration
 *
 * @param token - JWT token string
 * @returns Human-readable time remaining, or null if expired/invalid
 */
export function getTokenExpirationTime(token: string): string | null {
  try {
    const payload = decodeJWT(token);

    if (!payload.exp) {
      return null;
    }

    const expirationTime = payload.exp * 1000;
    const currentTime = Date.now();
    const timeRemaining = expirationTime - currentTime;

    if (timeRemaining <= 0) {
      return 'Expired';
    }

    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  } catch {
    return null;
  }
}

/**
 * Get authentication token from localStorage
 * Handles both normal tenant authentication and platform admin impersonation
 *
 * When a platform admin is impersonating a tenant:
 * - impersonationTenantKey is set in localStorage
 * - adminToken is used (contains impersonation context in JWT)
 *
 * When a normal tenant admin is authenticated:
 * - tenantToken is used
 *
 * @param providedToken - Optional token to use instead of localStorage (useful for prop-based tokens)
 * @returns JWT token or null if not authenticated
 */
export function getAuthToken(providedToken?: string): string | null {
  // Use provided token if passed as argument (useful for components with token props)
  if (providedToken) {
    return providedToken;
  }

  // Check if platform admin is impersonating a tenant
  const isImpersonating = localStorage.getItem('impersonationTenantKey');
  if (isImpersonating) {
    return localStorage.getItem('adminToken');
  }

  // Return tenant token for normal tenant admin auth
  return localStorage.getItem('tenantToken');
}

/**
 * Get tenant-specific auth token (tenantToken only)
 *
 * @returns Tenant admin JWT token or null if not found
 */
export function getTenantToken(): string | null {
  return localStorage.getItem('tenantToken');
}

/**
 * Get platform admin auth token (adminToken only)
 *
 * @returns Platform admin JWT token or null if not found
 */
export function getAdminToken(): string | null {
  return localStorage.getItem('adminToken');
}
