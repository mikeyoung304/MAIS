import { describe, it, expect } from 'vitest';
import { transformContentForSection } from './storefront-utils';

describe('transformContentForSection', () => {
  describe('pricing', () => {
    it('maps items to tiers', () => {
      const result = transformContentForSection('pricing', {
        items: [{ name: 'Basic', price: 1000 }],
      });
      expect(result.tiers).toEqual([{ name: 'Basic', price: 1000 }]);
      expect(result.items).toBeUndefined();
    });

    it('coalesces null tiers to empty array', () => {
      const result = transformContentForSection('pricing', { tiers: null });
      expect(result.tiers).toEqual([]);
    });

    it('coalesces undefined tiers to empty array when field present', () => {
      const result = transformContentForSection('pricing', { tiers: undefined });
      expect(result.tiers).toEqual([]);
    });

    it('preserves existing tiers array', () => {
      const tiers = [{ name: 'Pro', price: 5000 }];
      const result = transformContentForSection('pricing', { tiers });
      expect(result.tiers).toEqual(tiers);
    });

    it('does not overwrite existing tiers with items', () => {
      const result = transformContentForSection('pricing', {
        items: [{ name: 'Old' }],
        tiers: [{ name: 'New' }],
      });
      expect(result.tiers).toEqual([{ name: 'New' }]);
    });
  });

  describe('default case null coalescing', () => {
    it('coalesces null array fields to empty arrays for unknown types', () => {
      const result = transformContentForSection('custom' as never, {
        items: null,
        features: 'not-an-array',
        images: undefined,
      });
      expect(result.items).toEqual([]);
      expect(result.features).toEqual([]);
      expect(result.images).toEqual([]);
    });

    it('preserves valid arrays in default case', () => {
      const result = transformContentForSection('custom' as never, {
        items: [1, 2, 3],
      });
      expect(result.items).toEqual([1, 2, 3]);
    });
  });

  describe('features/services', () => {
    it('maps items to features', () => {
      const result = transformContentForSection('features', {
        items: [{ title: 'Feature 1' }],
      });
      expect(result.features).toEqual([{ title: 'Feature 1' }]);
      expect(result.items).toBeUndefined();
    });
  });

  describe('gallery', () => {
    it('maps items to images', () => {
      const result = transformContentForSection('gallery', {
        items: [{ url: 'img.jpg' }],
      });
      expect(result.images).toEqual([{ url: 'img.jpg' }]);
      expect(result.items).toBeUndefined();
    });
  });

  describe('common mappings', () => {
    it('maps title to headline', () => {
      const result = transformContentForSection('hero', { title: 'Hello' });
      expect(result.headline).toBe('Hello');
      expect(result.title).toBeUndefined();
    });

    it('does not overwrite existing headline with title', () => {
      const result = transformContentForSection('hero', {
        title: 'Old',
        headline: 'New',
      });
      expect(result.headline).toBe('New');
    });
  });
});
