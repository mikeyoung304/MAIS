/**
 * Authentication Utilities
 *
 * Client-side JWT decoding and token management utilities.
 * NOTE: These do NOT verify signatures - that's done server-side.
 */

import type { TokenPayload, User, UserRole, ImpersonationData } from './types';

export const AUTH_COOKIES = {
  TENANT_TOKEN: 'tenantToken',
  ADMIN_TOKEN: 'adminToken',
  IMPERSONATION_KEY: 'impersonationTenantKey',
} as const;

/**
 * Decode JWT token without signature verification
 * Used for client-side display only - server validates signatures
 */
export function decodeJWT(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    // Handle both standard base64 and base64url encoding
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired
 * Uses 60-second buffer for clock skew
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;

  const expirationTime = payload.exp * 1000; // Convert to milliseconds
  const currentTime = Date.now();
  const buffer = 60 * 1000; // 60-second buffer

  return currentTime >= expirationTime - buffer;
}

/**
 * Convert JWT payload to User object
 */
export function payloadToUser(payload: TokenPayload): User {
  if ('type' in payload && payload.type === 'tenant') {
    // Tenant admin token
    return {
      id: payload.tenantId,
      email: payload.email,
      role: 'TENANT_ADMIN',
      tenantId: payload.tenantId,
      slug: payload.slug,
    };
  }

  // Platform admin token
  const adminPayload = payload as {
    userId: string;
    email: string;
    role: string;
    impersonating?: ImpersonationData;
  };

  return {
    id: adminPayload.userId,
    email: adminPayload.email,
    role: 'PLATFORM_ADMIN',
  };
}

/**
 * Determine role from JWT payload
 */
export function getRoleFromPayload(payload: TokenPayload): UserRole {
  if ('type' in payload && payload.type === 'tenant') {
    return 'TENANT_ADMIN';
  }
  return 'PLATFORM_ADMIN';
}

/**
 * Extract impersonation data from admin token
 */
export function getImpersonationFromPayload(
  payload: TokenPayload
): ImpersonationData | null {
  if ('impersonating' in payload && payload.impersonating) {
    return payload.impersonating;
  }
  return null;
}

/**
 * Get cookie value by name (client-side)
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

/**
 * Set cookie value (client-side)
 */
export function setCookie(name: string, value: string, days = 7): void {
  if (typeof document === 'undefined') return;

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
}

/**
 * Delete cookie (client-side)
 */
export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/`;
}

/**
 * Clear all auth cookies
 */
export function clearAuthCookies(): void {
  deleteCookie(AUTH_COOKIES.TENANT_TOKEN);
  deleteCookie(AUTH_COOKIES.ADMIN_TOKEN);
  deleteCookie(AUTH_COOKIES.IMPERSONATION_KEY);
}
