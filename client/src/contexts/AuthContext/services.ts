/**
 * Authentication Services
 *
 * Handles authentication API calls, token management, and user session operations.
 */

import { api } from '../../lib/api';
import {
  decodeJWT,
  payloadToUser,
  storeToken,
  clearAllTokens,
  getActiveUser,
  isTokenExpired,
  getTenantIdFromToken,
  getImpersonationFromToken,
} from '../../lib/auth';
import type { User, UserRole, ImpersonationData, SignupResponse } from '../../types/auth';

/**
 * Login result after successful authentication
 */
export interface LoginResult {
  user: User;
  token: string;
  role: UserRole;
  tenantId: string | null;
  impersonation: ImpersonationData | null;
}

/**
 * Authenticate user with email and password
 *
 * @param email - User email
 * @param password - User password
 * @param targetRole - User role (PLATFORM_ADMIN or TENANT_ADMIN)
 * @returns Login result with user data and token
 * @throws Error if login fails
 */
export async function authenticateUser(
  email: string,
  password: string,
  targetRole: UserRole
): Promise<LoginResult> {
  let result;

  if (targetRole === 'PLATFORM_ADMIN') {
    // Call platform admin login endpoint
    result = await api.adminLogin({
      body: { email, password },
    });
  } else {
    // Call tenant admin login endpoint
    result = await api.tenantLogin({
      body: { email, password },
    });
  }

  // Check if login was successful
  if (result.status !== 200) {
    throw new Error('Invalid email or password');
  }

  const { token } = result.body;

  // Decode and validate token
  const payload = decodeJWT(token);
  const userData = payloadToUser(payload);

  // Verify the role matches what we expect
  if (userData.role !== targetRole) {
    throw new Error('Invalid credentials for this role');
  }

  // Store token
  storeToken(token, targetRole);

  // Set tenant token in API client if tenant admin
  if (targetRole === 'TENANT_ADMIN' && userData.role === 'TENANT_ADMIN') {
    api.setTenantToken(token);
  }

  return {
    user: userData,
    token,
    role: targetRole,
    tenantId:
      targetRole === 'TENANT_ADMIN' && userData.role === 'TENANT_ADMIN' ? userData.tenantId : null,
    impersonation: null, // Normal login never has impersonation
  };
}

/**
 * Register new tenant with email, password, and business name
 *
 * @param email - Tenant admin email
 * @param password - Tenant admin password (min 8 characters)
 * @param businessName - Business name (min 2 characters, max 100)
 * @returns Signup response with token, tenant ID, slug, and API credentials
 * @throws Error if signup fails
 */
export async function signupTenant(
  email: string,
  password: string,
  businessName: string
): Promise<SignupResponse> {
  // Call tenant signup endpoint
  const result = await api.tenantSignup({
    body: { email, password, businessName },
  });

  // Check if signup was successful
  if (result.status !== 201) {
    // Handle specific error cases
    if (result.status === 409) {
      throw new Error('An account with this email already exists');
    }
    if (result.status === 429) {
      throw new Error('Too many signup attempts. Please try again later');
    }
    throw new Error('Signup failed. Please try again');
  }

  const { token, tenantId, slug, email: userEmail, apiKeyPublic, secretKey } = result.body;

  // Decode and validate token
  const payload = decodeJWT(token);
  const userData = payloadToUser(payload);

  // Verify the role is tenant admin
  if (userData.role !== 'TENANT_ADMIN') {
    throw new Error('Invalid signup response');
  }

  // Store token
  storeToken(token, 'TENANT_ADMIN');

  // Set tenant token in API client
  api.setTenantToken(token);

  return {
    token,
    tenantId,
    slug,
    email: userEmail,
    apiKeyPublic,
    secretKey,
  };
}

/**
 * Logout user and clear all authentication state
 */
export function logoutUser(): void {
  // Clear tokens from localStorage
  clearAllTokens();

  // Clear tenant token from API client
  api.logoutTenant();
}

/**
 * Restore authentication state from localStorage
 *
 * @returns Authentication state if available, null otherwise
 */
export function restoreAuthState(): {
  user: User;
  token: string;
  role: UserRole;
  tenantId: string | null;
  impersonation: ImpersonationData | null;
} | null {
  const activeUser = getActiveUser();

  if (!activeUser) {
    return null;
  }

  // Set tenant token in API client if tenant admin
  if (activeUser.role === 'TENANT_ADMIN') {
    const tenantId = getTenantIdFromToken(activeUser.token);
    api.setTenantToken(activeUser.token);

    return {
      user: activeUser.user,
      token: activeUser.token,
      role: activeUser.role,
      tenantId,
      impersonation: null, // Tenant admins don't impersonate
    };
  }

  // Check for impersonation state in platform admin token
  const impersonation = getImpersonationFromToken(activeUser.token);

  return {
    user: activeUser.user,
    token: activeUser.token,
    role: activeUser.role,
    tenantId: impersonation?.tenantId || null, // Use impersonated tenant ID if present
    impersonation,
  };
}

/**
 * Check if the provided token has expired
 *
 * @param token - JWT token to check
 * @returns true if token is expired, false otherwise
 */
export function checkTokenExpiration(token: string): boolean {
  return isTokenExpired(token);
}
