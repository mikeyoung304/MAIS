/**
 * Preview Token Service
 *
 * Generates and validates short-lived JWT tokens for draft preview access.
 * These tokens allow authenticated tenant admins to preview their draft
 * landing page configuration in an iframe without flashing published content.
 *
 * SECURITY:
 * - Tokens are tenant-scoped (can only preview own tenant's draft)
 * - Tokens are short-lived (10 minutes by default)
 * - Token generation requires authenticated tenant session
 * - Tokens are signed with JWT_SECRET (same as main auth tokens)
 *
 * USAGE:
 * 1. Tenant admin opens preview panel
 * 2. Frontend calls POST /v1/tenant-admin/preview-token
 * 3. Server validates session, generates preview token
 * 4. Frontend includes token in iframe URL: ?preview=draft&token={jwt}
 * 5. Server validates token and returns draft config instead of published
 *
 * @see docs/solutions/patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md
 */

import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { loadConfig } from './core/config';
import { logger } from './core/logger';

/**
 * Zod schema for validating preview token payload
 *
 * Validates BEFORE type assertion to ensure type safety.
 * This schema matches the PreviewTokenPayload interface.
 */
const PreviewTokenPayloadSchema = z.object({
  tenantId: z.string(),
  slug: z.string(),
  type: z.literal('preview'),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

/**
 * Preview token payload structure
 *
 * @property tenantId - The tenant ID this token grants preview access to
 * @property slug - Tenant slug for URL validation
 * @property type - Token type identifier (always 'preview')
 * @property iat - Issued at timestamp (auto-added by jwt.sign)
 * @property exp - Expiration timestamp (auto-added by jwt.sign)
 */
export interface PreviewTokenPayload {
  tenantId: string;
  slug: string;
  type: 'preview';
  iat?: number;
  exp?: number;
}

/**
 * Result of token validation
 */
export interface PreviewTokenValidationResult {
  valid: true;
  payload: PreviewTokenPayload;
}

export interface PreviewTokenValidationError {
  valid: false;
  error: 'expired' | 'invalid' | 'wrong_type' | 'malformed' | 'tenant_mismatch';
  message: string;
}

export type ValidatePreviewTokenResult = PreviewTokenValidationResult | PreviewTokenValidationError;

/**
 * Default preview token expiration time in minutes
 */
const DEFAULT_PREVIEW_TOKEN_EXPIRY_MINUTES = 10;

/**
 * Generate a preview token for draft access
 *
 * @param tenantId - The tenant ID to generate preview token for
 * @param slug - The tenant slug (included for validation)
 * @param expiryMinutes - Token validity period (default: 10 minutes)
 * @returns Signed JWT token string
 *
 * @example
 * ```typescript
 * const token = generatePreviewToken('tenant_123', 'jane-photography');
 * // Returns: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * ```
 */
export function generatePreviewToken(
  tenantId: string,
  slug: string,
  expiryMinutes: number = DEFAULT_PREVIEW_TOKEN_EXPIRY_MINUTES
): string {
  const config = loadConfig();

  const payload: Omit<PreviewTokenPayload, 'iat' | 'exp'> = {
    tenantId,
    slug,
    type: 'preview',
  };

  const token = jwt.sign(payload, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${expiryMinutes}m`,
  });

  logger.debug({ tenantId, slug, expiryMinutes }, 'Generated preview token');

  return token;
}

/**
 * Validate a preview token
 *
 * Verification includes:
 * - JWT signature verification
 * - Expiration check
 * - Token type validation (must be 'preview')
 * - Optional tenant slug validation
 *
 * @param token - The JWT token to validate
 * @param expectedSlug - Optional: Require specific tenant slug
 * @returns Validation result with payload or error
 *
 * @example
 * ```typescript
 * const result = validatePreviewToken(token, 'jane-photography');
 * if (result.valid) {
 *   // Token is valid, can access draft for result.payload.tenantId
 * } else {
 *   // Token invalid: result.error, result.message
 * }
 * ```
 */
export function validatePreviewToken(
  token: string,
  expectedSlug?: string
): ValidatePreviewTokenResult {
  const config = loadConfig();

  try {
    const rawPayload = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // Validate payload structure with Zod BEFORE type assertion
    // This ensures type safety - we only get PreviewTokenPayload after validation succeeds
    const parseResult = PreviewTokenPayloadSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      // Check if the issue is specifically the wrong type field
      if (
        typeof rawPayload === 'object' &&
        rawPayload !== null &&
        'type' in rawPayload &&
        (rawPayload as { type: unknown }).type !== 'preview'
      ) {
        return {
          valid: false,
          error: 'wrong_type',
          message: `Invalid token type: expected preview, got ${(rawPayload as { type: unknown }).type}`,
        };
      }
      return {
        valid: false,
        error: 'malformed',
        message: 'Token is missing required fields',
      };
    }

    const payload = parseResult.data;

    // Validate slug if provided (ensures token matches requested tenant)
    if (expectedSlug && payload.slug !== expectedSlug) {
      logger.warn({ expectedSlug, actualSlug: payload.slug }, 'Preview token slug mismatch');
      return {
        valid: false,
        error: 'tenant_mismatch',
        message: 'Token does not match requested tenant',
      };
    }

    logger.debug({ tenantId: payload.tenantId, slug: payload.slug }, 'Preview token validated');

    return { valid: true, payload };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        error: 'expired',
        message: 'Preview token has expired. Please refresh the preview.',
      };
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return {
        valid: false,
        error: 'invalid',
        message: 'Invalid token signature',
      };
    }

    logger.error({ error }, 'Preview token validation failed with unexpected error');
    return {
      valid: false,
      error: 'invalid',
      message: 'Token validation failed',
    };
  }
}
