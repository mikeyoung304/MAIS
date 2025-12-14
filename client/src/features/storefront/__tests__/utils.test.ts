/**
 * Smoke tests for storefront tier utilities
 *
 * Covers critical paths for normalizeGrouping function:
 * - Canonical tier names pass through
 * - Legacy aliases map correctly
 * - Edge cases return null
 */
import { describe, it, expect } from 'vitest';
import { normalizeGrouping } from '../utils';

describe('normalizeGrouping', () => {
  it('returns tier_1 for canonical tier_1 input', () => {
    expect(normalizeGrouping('tier_1')).toBe('tier_1');
  });

  it('maps legacy alias "budget" to tier_1', () => {
    expect(normalizeGrouping('budget')).toBe('tier_1');
  });

  it('returns null for unmapped values like "Elopement"', () => {
    expect(normalizeGrouping('Elopement')).toBeNull();
  });

  it('handles case-insensitive input', () => {
    expect(normalizeGrouping('TIER_1')).toBe('tier_1');
    expect(normalizeGrouping('BUDGET')).toBe('tier_1');
  });

  it('returns null for empty string', () => {
    expect(normalizeGrouping('')).toBeNull();
  });
});
