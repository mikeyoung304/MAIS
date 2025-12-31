/**
 * NextAuth Cookie Names Constants
 *
 * Extracted from auth.ts to allow testing without loading NextAuth dependencies.
 *
 * IMPORTANT: Order matters! HTTPS secure-prefixed cookies are checked first,
 * then HTTP cookies for development environments.
 *
 * The lookup priority is:
 * 1. __Secure-authjs.session-token  (v5 HTTPS - production)
 * 2. authjs.session-token           (v5 HTTP - development)
 * 3. __Secure-next-auth.session-token (v4 HTTPS - legacy)
 * 4. next-auth.session-token        (v4 HTTP - legacy)
 *
 * @see https://authjs.dev/concepts/session-strategies#jwt-session
 * @see commits 9346d8a and e31a599 for the HTTPS cookie fix
 */
export const NEXTAUTH_COOKIE_NAMES = [
  '__Secure-authjs.session-token', // NextAuth v5 on HTTPS (production)
  'authjs.session-token', // NextAuth v5 on HTTP (development)
  '__Secure-next-auth.session-token', // NextAuth v4 on HTTPS (legacy)
  'next-auth.session-token', // NextAuth v4 on HTTP (legacy)
] as const;

export type NextAuthCookieName = (typeof NEXTAUTH_COOKIE_NAMES)[number];
