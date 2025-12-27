import { permanentRedirect } from 'next/navigation';

/**
 * Root page redirect to HANDLED tenant storefront
 *
 * HANDLED practices "Tenant Zero" dogfooding - the company's website runs on
 * the same config-driven architecture we sell to clients. This redirect
 * ensures the root URL serves the HANDLED tenant storefront.
 *
 * Uses permanentRedirect (308) for SEO benefits and browser caching.
 */
export default function HomePage() {
  permanentRedirect('/t/handled');
}
