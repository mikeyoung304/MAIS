import { permanentRedirect } from 'next/navigation';

/**
 * Root page redirect to MAIS tenant storefront
 *
 * MAIS practices "Tenant Zero" dogfooding - the company's website runs on
 * the same config-driven architecture we sell to clients. This redirect
 * ensures the root URL serves the MAIS tenant storefront.
 *
 * Uses permanentRedirect (308) for SEO benefits and browser caching.
 *
 * @see plans/feat-mais-tenant-zero-dogfooding.md
 */
export default function HomePage() {
  permanentRedirect('/t/mais');
}
