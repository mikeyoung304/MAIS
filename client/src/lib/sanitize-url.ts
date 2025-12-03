/**
 * URL Sanitization Utility
 *
 * Defense-in-depth validation for URLs, matching backend SafeUrlSchema.
 *
 * SECURITY CONTEXT:
 * - Backend validates all URLs via SafeUrlSchema (only https:/http: allowed)
 * - CSP headers enforce img-src at the browser level
 * - This utility provides frontend validation as defense-in-depth
 *
 * WHAT IT PROTECTS AGAINST:
 * - javascript: protocol injection (XSS)
 * - data: URI injection (XSS bypass)
 * - vbscript: and other dangerous protocols
 * - Malformed URLs that bypassed backend validation
 *
 * ALIGNED WITH:
 * - packages/contracts/src/landing-page.ts SafeUrlSchema
 * - Only http:// and https:// protocols allowed
 * - data: URIs are blocked (even data:image/) for consistency with backend
 */

const ALLOWED_PROTOCOLS = ['https:', 'http:'];

/**
 * Sanitizes URLs to prevent XSS via dangerous protocols.
 * Matches backend SafeUrlSchema validation.
 *
 * @param url - The URL to sanitize
 * @returns The sanitized URL or undefined if invalid/dangerous
 *
 * @example
 * sanitizeUrl('https://example.com/page') // ✅ Returns URL
 * sanitizeUrl('http://example.com/page')  // ✅ Returns URL
 * sanitizeUrl('javascript:alert(1)')      // ❌ Returns undefined
 * sanitizeUrl('data:text/html,...')       // ❌ Returns undefined
 * sanitizeUrl('data:image/png;base64,...') // ❌ Returns undefined (blocked for consistency)
 */
export function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return url;
    }
    // Block all other protocols including javascript:, data:, vbscript:, etc.
    console.warn('[security] Blocked dangerous URL protocol:', parsed.protocol, url);
    return undefined;
  } catch {
    // Invalid URL - log and block
    console.warn('[security] Blocked invalid URL:', url);
    return undefined;
  }
}

/**
 * Sanitizes image URLs with the same security rules as sanitizeUrl.
 * Use for img src attributes and CSS background-image URLs.
 *
 * @param url - The image URL to sanitize
 * @returns The sanitized URL or undefined if invalid/dangerous
 *
 * @example
 * sanitizeImageUrl('https://cdn.example.com/photo.jpg') // ✅ Returns URL
 * sanitizeImageUrl('javascript:alert(1)')               // ❌ Returns undefined
 */
export function sanitizeImageUrl(url: string | undefined): string | undefined {
  return sanitizeUrl(url);
}

/**
 * Creates a safe CSS background-image value.
 * Returns undefined if the URL is invalid or dangerous.
 *
 * @param url - The background image URL
 * @returns CSS url() value or undefined
 *
 * @example
 * sanitizeBackgroundUrl('https://example.com/bg.jpg') // ✅ 'url(https://example.com/bg.jpg)'
 * sanitizeBackgroundUrl('javascript:alert(1)')        // ❌ undefined
 */
export function sanitizeBackgroundUrl(url: string | undefined): string | undefined {
  const sanitized = sanitizeImageUrl(url);
  return sanitized ? `url(${sanitized})` : undefined;
}
