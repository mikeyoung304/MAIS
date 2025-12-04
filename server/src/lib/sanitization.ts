/**
 * Input Sanitization Utilities
 *
 * Provides defense-in-depth against XSS, injection attacks, and malicious input.
 * Used in conjunction with Zod validation for comprehensive input protection.
 */

import xss from 'xss';
import validator from 'validator';

/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses whitelist approach - only safe tags/attributes allowed
 */
export function sanitizeHtml(input: string): string {
  return xss(input, {
    whiteList: {
      // Allow basic formatting only
      b: [],
      i: [],
      em: [],
      strong: [],
      p: [],
      br: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  });
}

/**
 * Sanitize plain text (no HTML allowed)
 * Strips all HTML tags and encodes special characters
 */
export function sanitizePlainText(input: string): string {
  return validator.escape(validator.stripLow(input));
}

/**
 * Sanitize email address
 * Normalizes and validates email format
 */
export function sanitizeEmail(input: string): string {
  const trimmed = input.trim();
  // Normalize email but preserve dots (gmail_remove_dots: false)
  const normalized = validator.normalizeEmail(trimmed, {
    gmail_remove_dots: false,
    all_lowercase: true,
  });

  if (!normalized) {
    return '';
  }

  return validator.isEmail(normalized) ? normalized : '';
}

/**
 * Sanitize URL
 * Ensures URL is valid and uses safe protocol
 */
export function sanitizeUrl(input: string): string {
  if (!validator.isURL(input, { protocols: ['http', 'https'], require_protocol: true })) {
    return '';
  }
  return input;
}

/**
 * Sanitize phone number
 * Removes non-numeric characters (except + for international)
 */
export function sanitizePhone(input: string): string {
  return input.replace(/[^\d+]/g, '');
}

/**
 * Recursively sanitize an object
 * Applies appropriate sanitization based on field names and types
 */
export function sanitizeObject(obj: any, options: { allowHtml?: string[] } = {}): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle string primitives (e.g., array elements)
  if (typeof obj === 'string') {
    return sanitizePlainText(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, options));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Apply field-specific sanitization
        if (key.toLowerCase().includes('email')) {
          sanitized[key] = sanitizeEmail(value);
        } else if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
          sanitized[key] = sanitizeUrl(value);
        } else if (key.toLowerCase().includes('phone')) {
          sanitized[key] = sanitizePhone(value);
        } else if (options.allowHtml?.includes(key)) {
          sanitized[key] = sanitizeHtml(value);
        } else {
          sanitized[key] = sanitizePlainText(value);
        }
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value, options);
      } else {
        // Numbers, booleans, etc. pass through
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate and sanitize tenant slug
 * Must be lowercase alphanumeric with hyphens
 */
export function sanitizeTenantSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50); // Max length
}

/**
 * Validate and sanitize package/addon slug
 * Must be lowercase alphanumeric with hyphens
 */
export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .slice(0, 100); // Max length
}
