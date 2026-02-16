/**
 * Font Preset Names (Cloud Run local copy)
 *
 * Canonical source: packages/contracts/src/constants/font-presets.ts
 * Sync test: server/src/lib/constants-sync.test.ts
 *
 * Keep this in sync with FONT_PRESET_NAMES from @macon/contracts.
 */

export const FONT_PRESET_NAMES = [
  'classic',
  'modern',
  'warm',
  'editorial',
  'minimal',
  'luxury',
  'rustic',
  'playful',
] as const;

export type FontPresetName = (typeof FONT_PRESET_NAMES)[number];
