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
  it('should have __Secure- prefixed cookie first for HTTPS', () => {
    expect(NEXTAUTH_COOKIE_NAMES[0]).toBe('__Secure-authjs.session-token');
  });

  it('should include v5 cookie name variants only', () => {
    expect(NEXTAUTH_COOKIE_NAMES).toContain('__Secure-authjs.session-token');
    expect(NEXTAUTH_COOKIE_NAMES).toContain('authjs.session-token');
  });

  it('should have exactly 2 cookie names (HTTPS + HTTP)', () => {
    expect(NEXTAUTH_COOKIE_NAMES).toHaveLength(2);
  });

  it('should not contain legacy v4 cookie names', () => {
    const names = [...NEXTAUTH_COOKIE_NAMES];
    expect(names.some((n) => n.includes('next-auth'))).toBe(false);
  });
});

describe('Cookie name lookup order', () => {
  it('should find HTTPS cookie before HTTP cookie', () => {
    const cookies = {
      'authjs.session-token': 'http-token',
      '__Secure-authjs.session-token': 'https-token',
    };

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

  it('should return undefined when no cookies are present', () => {
    const cookies = {};

    const foundCookie = NEXTAUTH_COOKIE_NAMES.find((name) => cookies[name as keyof typeof cookies]);

    expect(foundCookie).toBeUndefined();
  });
});

describe('Cookie name format validation', () => {
  it('should have one __Secure- prefixed cookie and one plain cookie', () => {
    const secureCookies = NEXTAUTH_COOKIE_NAMES.filter((name) => name.startsWith('__Secure-'));
    const httpCookies = NEXTAUTH_COOKIE_NAMES.filter((name) => !name.startsWith('__Secure-'));

    expect(secureCookies).toHaveLength(1);
    expect(httpCookies).toHaveLength(1);
  });
});
