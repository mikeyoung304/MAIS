/**
 * Tier Schema Tests
 *
 * Unit tests for TierFeatureSchema and TierFeaturesSchema.
 * Validates schema constraints and type safety.
 *
 * @see packages/contracts/src/schemas/tier.schema.ts
 */

import { describe, it, expect } from 'vitest';
import { TierFeatureSchema, TierFeaturesSchema, TierLevelSchema } from '@macon/contracts';

describe('TierFeatureSchema', () => {
  it('should validate a valid feature', () => {
    const result = TierFeatureSchema.safeParse({
      text: 'Unlimited bookings',
      highlighted: true,
      icon: 'check-circle',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe('Unlimited bookings');
      expect(result.data.highlighted).toBe(true);
      expect(result.data.icon).toBe('check-circle');
    }
  });

  it('should apply default highlighted=false', () => {
    const result = TierFeatureSchema.safeParse({
      text: 'Basic feature',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.highlighted).toBe(false);
    }
  });

  it('should allow optional icon', () => {
    const result = TierFeatureSchema.safeParse({
      text: 'No icon feature',
      highlighted: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.icon).toBeUndefined();
    }
  });

  it('should reject empty text', () => {
    const result = TierFeatureSchema.safeParse({
      text: '',
      highlighted: false,
    });
    expect(result.success).toBe(false);
  });

  it('should reject text over 200 characters', () => {
    const result = TierFeatureSchema.safeParse({
      text: 'a'.repeat(201),
      highlighted: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('TierFeaturesSchema', () => {
  it('should validate an array of features', () => {
    const features = [
      { text: 'Feature 1', highlighted: true },
      { text: 'Feature 2', highlighted: false },
      { text: 'Feature 3', highlighted: false, icon: 'star' },
    ];
    const result = TierFeaturesSchema.safeParse(features);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(3);
    }
  });

  it('should reject more than 15 features', () => {
    const features = Array(16)
      .fill(null)
      .map((_, i) => ({
        text: `Feature ${i + 1}`,
        highlighted: false,
      }));
    const result = TierFeaturesSchema.safeParse(features);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('15');
    }
  });

  it('should accept exactly 15 features', () => {
    const features = Array(15)
      .fill(null)
      .map((_, i) => ({
        text: `Feature ${i + 1}`,
        highlighted: false,
      }));
    const result = TierFeaturesSchema.safeParse(features);
    expect(result.success).toBe(true);
  });

  it('should accept empty array', () => {
    const result = TierFeaturesSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it('should reject invalid feature structure', () => {
    const result = TierFeaturesSchema.safeParse([
      { text: 'Valid feature', highlighted: false },
      { invalid: 'structure' }, // Missing text
    ]);
    expect(result.success).toBe(false);
  });
});

describe('TierLevelSchema', () => {
  it('should accept GOOD', () => {
    const result = TierLevelSchema.safeParse('GOOD');
    expect(result.success).toBe(true);
  });

  it('should accept BETTER', () => {
    const result = TierLevelSchema.safeParse('BETTER');
    expect(result.success).toBe(true);
  });

  it('should accept BEST', () => {
    const result = TierLevelSchema.safeParse('BEST');
    expect(result.success).toBe(true);
  });

  it('should reject invalid level', () => {
    const result = TierLevelSchema.safeParse('INVALID');
    expect(result.success).toBe(false);
  });

  it('should reject lowercase', () => {
    const result = TierLevelSchema.safeParse('good');
    expect(result.success).toBe(false);
  });
});
