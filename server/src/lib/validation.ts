/**
 * Shared validation utilities
 */

import { ValidationError } from './errors';

/**
 * Maximum price in cents: $999,999.99
 * Aligned with Stripe's maximum charge amount
 * @see https://stripe.com/docs/currencies#minimum-and-maximum-charge-amounts
 */
export const MAX_PRICE_CENTS = 99999999;

/**
 * Validate price is non-negative and within Stripe limits
 * Prevents integer overflow and aligns with Stripe's $999,999.99 maximum
 */
export function validatePrice(priceCents: number, fieldName: string = 'price'): void {
  if (priceCents < 0) {
    throw new ValidationError(`${fieldName} must be non-negative`);
  }
  if (priceCents > MAX_PRICE_CENTS) {
    throw new ValidationError(`${fieldName} exceeds maximum allowed value ($999,999.99)`);
  }
}

/**
 * Validate slug format (lowercase, hyphens, alphanumeric)
 */
export function validateSlug(slug: string): void {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  if (!slugRegex.test(slug)) {
    throw new ValidationError('Slug must be lowercase alphanumeric with hyphens only');
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
}

/**
 * Sanitize string input (trim, normalize whitespace)
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

/**
 * Validate required fields are present and non-empty
 */
export function validateRequiredFields<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T)[],
  entityName: string = 'Entity'
): void {
  const missing = requiredFields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new ValidationError(`${entityName}: Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Validate string is not empty after trimming
 */
export function validateNonEmptyString(value: string, fieldName: string): void {
  if (!value || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }
}

/**
 * Validate positive integer
 */
export function validatePositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer`);
  }
}
