/**
 * Tests for NextAuth cookie handling in HTTPS environments
 *
 * These tests verify that the cookie name lookup order is correct
 * to prevent authentication failures when running on HTTPS (production).
 *
 * Background: NextAuth v5 uses __Secure- prefixed cookies on HTTPS.
 * If the lookup order is wrong, getBackendToken() will fail to find
 * the session cookie even when the user is authenticated.
 *
 * @see commits 9346d8a and e31a599 for the fix this tests protect
 */

import { describe, it, expect } from 'vitest';
import { NEXTAUTH_COOKIE_NAMES } from '../auth-constants';

describe('NEXTAUTH_COOKIE_NAMES', () => {
  it('should have __Secure- prefixed cookies first for HTTPS', () => {
    // Verify order: secure cookies come before non-secure
    const secureIndex = NEXTAUTH_COOKIE_NAMES.findIndex((name) => name.startsWith('__Secure-'));
    const nonSecureIndex = NEXTAUTH_COOKIE_NAMES.findIndex((name) => !name.startsWith('__Secure-'));

    expect(secureIndex).toBeLessThan(nonSecureIndex);
  });

  it('should include all expected cookie name variants', () => {
    expect(NEXTAUTH_COOKIE_NAMES).toContain('__Secure-authjs.session-token');
    expect(NEXTAUTH_COOKIE_NAMES).toContain('authjs.session-token');
    expect(NEXTAUTH_COOKIE_NAMES).toContain('__Secure-next-auth.session-token');
    expect(NEXTAUTH_COOKIE_NAMES).toContain('next-auth.session-token');
  });

  it('should have exactly 4 cookie names for v4 and v5 support', () => {
    expect(NEXTAUTH_COOKIE_NAMES).toHaveLength(4);
  });

  it('should prioritize v5 cookie names over v4', () => {
    const v5Index = NEXTAUTH_COOKIE_NAMES.findIndex((name) => name.includes('authjs'));
    const v4Index = NEXTAUTH_COOKIE_NAMES.findIndex((name) => name.includes('next-auth'));

    expect(v5Index).toBeLessThan(v4Index);
  });
});

describe('Cookie name lookup order', () => {
  it('should find HTTPS cookie before HTTP cookie', () => {
    const cookies = {
      'authjs.session-token': 'http-token',
      '__Secure-authjs.session-token': 'https-token',
    };

    // Simulate the lookup logic from getBackendToken
    const foundCookie = NEXTAUTH_COOKIE_NAMES.find((name) => cookies[name as keyof typeof cookies]);

    expect(foundCookie).toBe('__Secure-authjs.session-token');
  });

  it('should fall back to HTTP cookie when HTTPS cookie is missing', () => {
    const cookies = {
      'authjs.session-token': 'http-token',
    };

    const foundCookie = NEXTAUTH_COOKIE_NAMES.find((name) => cookies[name as keyof typeof cookies]);

    expect(foundCookie).toBe('authjs.session-token');
  });

  it('should find v4 cookie when v5 cookies are missing', () => {
    const cookies = {
      'next-auth.session-token': 'v4-token',
    };

    const foundCookie = NEXTAUTH_COOKIE_NAMES.find((name) => cookies[name as keyof typeof cookies]);

    expect(foundCookie).toBe('next-auth.session-token');
  });

  it('should prefer v5 HTTPS over v4 HTTPS cookie', () => {
    const cookies = {
      '__Secure-authjs.session-token': 'v5-https-token',
      '__Secure-next-auth.session-token': 'v4-https-token',
    };

    const foundCookie = NEXTAUTH_COOKIE_NAMES.find((name) => cookies[name as keyof typeof cookies]);

    expect(foundCookie).toBe('__Secure-authjs.session-token');
  });

  it('should return undefined when no cookies are present', () => {
    const cookies = {};

    const foundCookie = NEXTAUTH_COOKIE_NAMES.find((name) => cookies[name as keyof typeof cookies]);

    expect(foundCookie).toBeUndefined();
  });
});

describe('Cookie name format validation', () => {
  it('should have consistent naming pattern for HTTPS cookies', () => {
    const secureCookies = NEXTAUTH_COOKIE_NAMES.filter((name) => name.startsWith('__Secure-'));

    // All secure cookies should have the __Secure- prefix
    secureCookies.forEach((cookie) => {
      expect(cookie).toMatch(/^__Secure-/);
    });

    // Should have exactly 2 secure cookies (v5 and v4)
    expect(secureCookies).toHaveLength(2);
  });

  it('should have consistent naming pattern for HTTP cookies', () => {
    const httpCookies = NEXTAUTH_COOKIE_NAMES.filter((name) => !name.startsWith('__Secure-'));

    // HTTP cookies should NOT have the __Secure- prefix
    httpCookies.forEach((cookie) => {
      expect(cookie).not.toMatch(/^__Secure-/);
    });

    // Should have exactly 2 HTTP cookies (v5 and v4)
    expect(httpCookies).toHaveLength(2);
  });

  it('should have matching HTTP/HTTPS pairs for each version', () => {
    // v5 pair
    expect(NEXTAUTH_COOKIE_NAMES).toContain('__Secure-authjs.session-token');
    expect(NEXTAUTH_COOKIE_NAMES).toContain('authjs.session-token');

    // v4 pair
    expect(NEXTAUTH_COOKIE_NAMES).toContain('__Secure-next-auth.session-token');
    expect(NEXTAUTH_COOKIE_NAMES).toContain('next-auth.session-token');
  });
});
