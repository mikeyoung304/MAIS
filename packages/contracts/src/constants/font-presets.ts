/**
 * Font Presets — Curated heading + body font pairings
 *
 * Each preset bundles a heading font, body font, fallback stacks,
 * a prebuilt Google Fonts URL, and a human-readable description
 * for the AI agent to suggest contextually.
 *
 * Presets guarantee polished typography — service professionals
 * shouldn't need to pair fonts manually.
 */

export interface FontPreset {
  /** Google Font family for headings */
  heading: string;
  /** Google Font family for body text */
  body: string;
  /** CSS fallback stack for headings */
  headingFallback: string;
  /** CSS fallback stack for body */
  bodyFallback: string;
  /** Prebuilt Google Fonts <link> href */
  googleFontsUrl: string;
  /** Human-readable description for agent suggestions */
  description: string;
}

export const FONT_PRESETS: Record<string, FontPreset> = {
  classic: {
    heading: 'Playfair Display',
    body: 'Inter',
    headingFallback: 'Georgia, serif',
    bodyFallback: 'system-ui, sans-serif',
    googleFontsUrl:
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;700&display=swap',
    description: 'Elegant and timeless — serif headings with clean body text',
  },
  modern: {
    heading: 'DM Sans',
    body: 'DM Sans',
    headingFallback: 'system-ui, sans-serif',
    bodyFallback: 'system-ui, sans-serif',
    googleFontsUrl:
      'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap',
    description: 'Clean and contemporary — geometric sans-serif throughout',
  },
  warm: {
    heading: 'Lora',
    body: 'Source Sans 3',
    headingFallback: 'Georgia, serif',
    bodyFallback: 'system-ui, sans-serif',
    googleFontsUrl:
      'https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Source+Sans+3:wght@400;600&display=swap',
    description: 'Warm and inviting — soft serif headings with readable body',
  },
  editorial: {
    heading: 'Cormorant Garamond',
    body: 'Nunito Sans',
    headingFallback: 'Georgia, serif',
    bodyFallback: 'system-ui, sans-serif',
    googleFontsUrl:
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Nunito+Sans:wght@400;600&display=swap',
    description: 'Refined editorial — high-contrast serif with friendly sans body',
  },
  minimal: {
    heading: 'Outfit',
    body: 'Outfit',
    headingFallback: 'system-ui, sans-serif',
    bodyFallback: 'system-ui, sans-serif',
    googleFontsUrl:
      'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap',
    description: 'Minimal and modern — one clean font family for everything',
  },
  luxury: {
    heading: 'Bodoni Moda',
    body: 'Raleway',
    headingFallback: "'Didot', 'Bodoni MT', Georgia, serif",
    bodyFallback: 'system-ui, sans-serif',
    googleFontsUrl:
      'https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@400;700&family=Raleway:wght@400;500;600&display=swap',
    description: 'Luxury and sophisticated — high-fashion serif with elegant sans',
  },
  rustic: {
    heading: 'Libre Baskerville',
    body: 'Cabin',
    headingFallback: 'Georgia, serif',
    bodyFallback: 'system-ui, sans-serif',
    googleFontsUrl:
      'https://fonts.googleapis.com/css2?family=Cabin:wght@400;600;700&family=Libre+Baskerville:wght@400;700&display=swap',
    description: 'Rustic and grounded — traditional serif with a sturdy sans',
  },
  playful: {
    heading: 'Fraunces',
    body: 'Work Sans',
    headingFallback: 'Georgia, serif',
    bodyFallback: 'system-ui, sans-serif',
    googleFontsUrl:
      'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&family=Work+Sans:wght@400;500;600&display=swap',
    description: 'Playful and creative — expressive serif with versatile sans',
  },
} as const;

export const FONT_PRESET_NAMES = Object.keys(FONT_PRESETS) as Array<keyof typeof FONT_PRESETS>;
