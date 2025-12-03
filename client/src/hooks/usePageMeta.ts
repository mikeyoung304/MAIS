/**
 * usePageMeta Hook
 *
 * Manages page metadata including title, description, and Open Graph tags
 * for SEO and social sharing.
 *
 * Usage:
 * ```tsx
 * usePageMeta({
 *   title: 'My Page Title',
 *   description: 'Page description for SEO',
 *   image: 'https://example.com/og-image.jpg'
 * });
 * ```
 */

import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description: string;
  image?: string;
}

/**
 * Sets page metadata including title, description, and Open Graph tags.
 * Updates existing meta tags or creates new ones as needed.
 */
export function usePageMeta({ title, description, image }: PageMeta): void {
  useEffect(() => {
    // Set page title
    document.title = title;

    /**
     * Helper to set or update a meta tag
     * @param property - The property or name attribute value
     * @param content - The content value
     */
    const setMeta = (property: string, content: string) => {
      const isOpenGraph = property.startsWith('og:') || property.startsWith('twitter:');
      const attrName = isOpenGraph ? 'property' : 'name';

      // Try to find existing meta tag
      let element = document.querySelector(`meta[${attrName}="${property}"]`);

      if (!element) {
        // Create new meta tag if it doesn't exist
        element = document.createElement('meta');
        element.setAttribute(attrName, property);
        document.head.appendChild(element);
      }

      // Set content
      element.setAttribute('content', content);
    };

    // Basic SEO meta tags
    setMeta('description', description);

    // Open Graph tags (Facebook, LinkedIn)
    setMeta('og:title', title);
    setMeta('og:description', description);
    setMeta('og:type', 'website');

    // Twitter Card tags
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);

    // Set image tags if provided
    if (image) {
      setMeta('og:image', image);
      setMeta('twitter:image', image);
    }
  }, [title, description, image]);
}
