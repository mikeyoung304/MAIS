/**
 * PWA Icon Generator
 *
 * Creates the required PWA icons for the HANDLED web app.
 * Uses sharp for image generation.
 *
 * Brand colors:
 * - Primary sage: #45B37F (Electric Sage)
 * - Surface dark: #18181B
 * - Text: #FAFAFA
 */

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'public', 'icons');

// Brand colors
const SAGE = '#45B37F';
const WHITE = '#FAFAFA';

/**
 * Create an SVG with the "H" logo
 */
function createLogoSvg(size, withSafeZone = false) {
  // For maskable icons, content should be in the center 80% (safe zone)
  const padding = withSafeZone ? size * 0.1 : 0;
  const contentSize = size - padding * 2;

  // H letter dimensions - positioned in center
  const strokeWidth = Math.round(contentSize * 0.12);
  const letterWidth = Math.round(contentSize * 0.5);
  const letterHeight = Math.round(contentSize * 0.6);

  const centerX = size / 2;
  const centerY = size / 2;

  const leftX = centerX - letterWidth / 2;
  const rightX = centerX + letterWidth / 2;
  const topY = centerY - letterHeight / 2;
  const bottomY = centerY + letterHeight / 2;
  const middleY = centerY;

  // Build the H using three lines
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${SAGE}"/>
      <!-- Left vertical of H -->
      <line x1="${leftX}" y1="${topY}" x2="${leftX}" y2="${bottomY}"
            stroke="${WHITE}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
      <!-- Right vertical of H -->
      <line x1="${rightX}" y1="${topY}" x2="${rightX}" y2="${bottomY}"
            stroke="${WHITE}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
      <!-- Horizontal bar of H -->
      <line x1="${leftX}" y1="${middleY}" x2="${rightX}" y2="${middleY}"
            stroke="${WHITE}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
    </svg>
  `.trim();

  return Buffer.from(svg);
}

/**
 * Create a simple badge icon (smaller, simpler design)
 */
function createBadgeSvg(size) {
  const strokeWidth = Math.round(size * 0.1);
  const letterSize = Math.round(size * 0.6);

  const centerX = size / 2;
  const centerY = size / 2;

  const leftX = centerX - letterSize / 4;
  const rightX = centerX + letterSize / 4;
  const topY = centerY - letterSize / 3;
  const bottomY = centerY + letterSize / 3;
  const middleY = centerY;

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${SAGE}"/>
      <line x1="${leftX}" y1="${topY}" x2="${leftX}" y2="${bottomY}"
            stroke="${WHITE}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
      <line x1="${rightX}" y1="${topY}" x2="${rightX}" y2="${bottomY}"
            stroke="${WHITE}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
      <line x1="${leftX}" y1="${middleY}" x2="${rightX}" y2="${middleY}"
            stroke="${WHITE}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
    </svg>
  `.trim();

  return Buffer.from(svg);
}

async function generateIcons() {
  console.log('Creating icons directory...');
  await mkdir(ICONS_DIR, { recursive: true });

  const icons = [
    {
      name: 'icon-192.png',
      size: 192,
      svg: createLogoSvg(192),
      description: 'Standard PWA icon (192x192)',
    },
    {
      name: 'icon-512.png',
      size: 512,
      svg: createLogoSvg(512),
      description: 'Large PWA icon (512x512)',
    },
    {
      name: 'icon-maskable.png',
      size: 512,
      svg: createLogoSvg(512, true), // With safe zone padding
      description: 'Maskable icon for Android adaptive icons (512x512)',
    },
    {
      name: 'badge-72.png',
      size: 72,
      svg: createBadgeSvg(72),
      description: 'Push notification badge (72x72)',
    },
  ];

  for (const icon of icons) {
    const outputPath = join(ICONS_DIR, icon.name);
    console.log(`Generating ${icon.name} - ${icon.description}`);

    await sharp(icon.svg).png().toFile(outputPath);

    console.log(`  Created: ${outputPath}`);
  }

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch((error) => {
  console.error('Error generating icons:', error);
  process.exit(1);
});
