/**
 * Shared utilities for preview iframe URL construction.
 *
 * Single source of truth for the `?preview=draft&edit=true&token=JWT`
 * pattern used by both PreviewPanel and RevealTransition.
 */

/**
 * Build the preview iframe URL for a tenant storefront.
 *
 * @param slug - Tenant slug (e.g. "acme-photo"). If null/undefined, returns null.
 * @param previewToken - JWT token for draft access. Appended as `&token=` if present.
 * @returns The full relative URL, e.g. `/t/acme-photo/?preview=draft&edit=true&token=abc`,
 *          or null when slug is missing.
 */
export function buildPreviewUrl(
  slug: string | null | undefined,
  previewToken: string | null
): string | null {
  if (!slug) return null;

  const params = new URLSearchParams({
    preview: 'draft',
    edit: 'true',
  });

  if (previewToken) {
    params.set('token', previewToken);
  }

  return `/t/${slug}/?${params.toString()}`;
}
