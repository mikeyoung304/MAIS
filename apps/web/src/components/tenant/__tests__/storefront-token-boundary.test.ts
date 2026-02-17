/**
 * Storefront Token Boundary Test
 *
 * Enforces that tenant storefront components never use dark marketing palette tokens.
 * The HANDLED marketing site uses dark graphite tokens (surface, surface-alt, text-primary,
 * text-muted) which are defined in tailwind.config.js. Tenant storefronts use semantic
 * light tokens (background, primary, muted-foreground, accent) set via CSS variables.
 *
 * If this test fails, a dark marketing token leaked into a storefront component.
 * Fix: Replace the dark token with its light semantic equivalent.
 *
 * Token mapping:
 *   bg-surface-alt  → bg-white, bg-neutral-50, or remove (inherits bg-background)
 *   bg-surface       → bg-background
 *   text-text-primary → text-primary
 *   text-text-muted   → text-muted-foreground
 *
 * @see apps/web/tailwind.config.js (boundary comment above dark palette)
 * @see CLAUDE.md "Common Pitfalls"
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Regex patterns for each forbidden dark marketing token.
 * - bg-surface uses a negative lookahead to avoid matching bg-surface-alt
 *   (which is already caught by its own pattern).
 * - All patterns use word boundaries to avoid false positives like
 *   "text-text-primary-foreground" or comments mentioning the token name.
 */
const FORBIDDEN_PATTERNS: Array<{ token: string; pattern: RegExp }> = [
  { token: 'bg-surface-alt', pattern: /\bbg-surface-alt\b/ },
  { token: 'bg-surface', pattern: /\bbg-surface(?!-alt)\b/ },
  { token: 'text-text-primary', pattern: /\btext-text-primary\b/ },
  { token: 'text-text-muted', pattern: /\btext-text-muted\b/ },
];

/** Directories to exclude (admin-facing, not customer storefront) */
const EXCLUDED_DIRS = new Set(['editors', '__tests__']);

/**
 * Recursively collect all .tsx files in a directory, excluding specified subdirs.
 */
function collectTsxFiles(dir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry)) {
        results.push(...collectTsxFiles(fullPath));
      }
    } else if (entry.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }

  return results;
}

describe('Storefront token boundary', () => {
  const tenantDir = join(__dirname, '..');
  const tsxFiles = collectTsxFiles(tenantDir);

  it('should find tenant component files to scan', () => {
    expect(tsxFiles.length).toBeGreaterThan(0);
  });

  it('should not contain dark marketing palette tokens in any tenant storefront component', () => {
    const violations: Array<{ file: string; line: number; token: string; text: string }> = [];

    for (const filePath of tsxFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comments (single-line // and JSDoc lines starting with *)
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          continue;
        }

        for (const { token, pattern } of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: relative(tenantDir, filePath),
              line: i + 1,
              token,
              text: trimmed,
            });
          }
        }
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map((v) => `  ${v.file}:${v.line} — forbidden token "${v.token}"\n    ${v.text}`)
        .join('\n');

      expect.fail(
        `Dark marketing tokens found in tenant storefront components:\n${report}\n\n` +
          'Fix: Replace dark tokens with light semantic equivalents.\n' +
          'See: apps/web/tailwind.config.js (boundary comment) for the mapping.'
      );
    }
  });
});
