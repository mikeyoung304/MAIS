/**
 * JWT-based project access tokens
 *
 * Provides secure, stateless tokens for customer self-service access
 * to their project details in the Project Hub.
 *
 * Security: Uses signed JWT tokens instead of guessable email parameters.
 * Tokens are cryptographically verified and time-limited.
 *
 * @see server/src/lib/booking-tokens.ts - Similar pattern for booking management
 */

import jwt from 'jsonwebtoken';
import { loadConfig, getBookingTokenSecret } from './core/config';
import { logger } from './core/logger';

/**
 * Project access token actions
 * - view: Read-only access to project details
 * - chat: Access to chat with Project Hub agent
 */
export type ProjectTokenAction = 'view' | 'chat';

/**
 * Payload structure for project access tokens
 */
export interface ProjectTokenPayload {
  projectId: string;
  tenantId: string;
  customerId: string;
  action: ProjectTokenAction;
  iat: number; // Issued at
  exp: number; // Expiration
}

/**
 * Generates a JWT token for project access
 *
 * Token includes:
 * - projectId: Which project this token grants access to
 * - tenantId: Tenant isolation (prevents cross-tenant access)
 * - customerId: Customer isolation (prevents cross-customer access)
 * - action: What actions are permitted (view/chat)
 * - expiry: Auto-expires after specified days
 *
 * @param projectId - The project ID this token grants access to
 * @param tenantId - The tenant ID for isolation
 * @param customerId - The customer ID for isolation
 * @param action - The permitted action (default: 'view')
 * @param expiresInDays - Token validity period (default: 30 days for projects)
 * @returns Signed JWT token string
 *
 * @example
 * ```typescript
 * const token = generateProjectAccessToken('project_123', 'tenant_abc', 'cust_xyz');
 * // Returns: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * ```
 */
export function generateProjectAccessToken(
  projectId: string,
  tenantId: string,
  customerId: string,
  action: ProjectTokenAction = 'view',
  expiresInDays: number = 30
): string {
  const config = loadConfig();

  // Reuse BOOKING_TOKEN_SECRET - both are customer-facing stateless tokens
  const token = jwt.sign(
    { projectId, tenantId, customerId, action },
    getBookingTokenSecret(config),
    { expiresIn: `${expiresInDays}d` }
  );

  logger.debug(
    { projectId, tenantId, customerId, action, expiresInDays },
    'Generated project access token'
  );

  return token;
}

/**
 * Result of token validation
 */
export interface ProjectTokenValidationResult {
  valid: true;
  payload: ProjectTokenPayload;
}

export interface ProjectTokenValidationError {
  valid: false;
  error: 'expired' | 'invalid' | 'malformed' | 'wrong_action' | 'wrong_project';
  message: string;
}

export type ValidateProjectTokenResult = ProjectTokenValidationResult | ProjectTokenValidationError;

/**
 * Validates a project access token
 *
 * Verification includes:
 * - JWT signature verification
 * - Expiration check
 * - Payload structure validation
 * - Optional project ID matching
 * - Optional action type validation
 *
 * @param token - The JWT token to validate
 * @param expectedProjectId - Optional: Must match token's projectId
 * @param expectedAction - Optional: Require specific action type
 * @returns Validation result with payload or error
 *
 * @example
 * ```typescript
 * const result = validateProjectAccessToken(token, 'project_123', 'view');
 * if (result.valid) {
 *   // Token is valid for this project
 *   console.log(result.payload.customerId);
 * } else {
 *   // Handle error: expired, invalid, etc.
 *   console.error(result.message);
 * }
 * ```
 */
export function validateProjectAccessToken(
  token: string,
  expectedProjectId?: string,
  expectedAction?: ProjectTokenAction
): ValidateProjectTokenResult {
  const config = loadConfig();

  try {
    const payload = jwt.verify(token, getBookingTokenSecret(config)) as ProjectTokenPayload;

    // Validate payload structure
    if (!payload.projectId || !payload.tenantId || !payload.customerId || !payload.action) {
      return {
        valid: false,
        error: 'malformed',
        message: 'Token is missing required fields',
      };
    }

    // Validate project ID if specified
    if (expectedProjectId && payload.projectId !== expectedProjectId) {
      return {
        valid: false,
        error: 'wrong_project',
        message: 'Token is not valid for this project',
      };
    }

    // Validate action type if specified
    if (expectedAction && payload.action !== expectedAction) {
      // 'view' tokens can also be used for chat (more permissive)
      if (!(payload.action === 'view' && expectedAction === 'chat')) {
        return {
          valid: false,
          error: 'wrong_action',
          message: `Token does not permit ${expectedAction} action`,
        };
      }
    }

    return { valid: true, payload };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        error: 'expired',
        message: 'This link has expired. Please request a new access link.',
      };
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return {
        valid: false,
        error: 'invalid',
        message: 'Invalid access token',
      };
    }

    logger.error({ error }, 'Project token validation failed with unexpected error');
    return {
      valid: false,
      error: 'invalid',
      message: 'Token validation failed',
    };
  }
}

/**
 * Generates a complete project access URL with embedded token
 *
 * Use this in customer notification emails to give them access
 * to their project details in the Project Hub.
 *
 * @param projectId - The project ID
 * @param tenantId - The tenant ID
 * @param customerId - The customer ID
 * @param tenantSlug - The tenant's URL slug
 * @param baseUrl - Client application base URL
 * @returns Full URL with token query parameter
 *
 * @example
 * ```typescript
 * const url = generateProjectAccessUrl('project_123', 'tenant_abc', 'cust_xyz', 'acme-photo');
 * // Returns: https://app.gethandled.ai/t/acme-photo/projects/project_123?token=eyJhbGc...
 * ```
 */
export function generateProjectAccessUrl(
  projectId: string,
  tenantId: string,
  customerId: string,
  tenantSlug: string,
  baseUrl: string = process.env.CLIENT_URL || 'http://localhost:3000'
): string {
  const token = generateProjectAccessToken(projectId, tenantId, customerId, 'view');
  return `${baseUrl}/t/${tenantSlug}/projects/${projectId}?token=${token}`;
}
