/**
 * Block Type Mapper Tests
 *
 * Comprehensive tests for bidirectional mapping between frontend section types
 * and database BlockType enum values.
 *
 * @see block-type-mapper.ts
 */

import { describe, it, expect } from 'vitest';
import {
  sectionTypeToBlockType,
  blockTypeToSectionType,
  isValidBlockType,
  SECTION_TYPES,
  BLOCK_TYPES,
} from './block-type-mapper';

describe('block-type-mapper', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // sectionTypeToBlockType
  // ─────────────────────────────────────────────────────────────────────────

  describe('sectionTypeToBlockType', () => {
    it('should convert lowercase section types to BlockType', () => {
      expect(sectionTypeToBlockType('hero')).toBe('HERO');
      expect(sectionTypeToBlockType('about')).toBe('ABOUT');
      expect(sectionTypeToBlockType('gallery')).toBe('GALLERY');
      expect(sectionTypeToBlockType('testimonials')).toBe('TESTIMONIALS');
      expect(sectionTypeToBlockType('faq')).toBe('FAQ');
      expect(sectionTypeToBlockType('contact')).toBe('CONTACT');
      expect(sectionTypeToBlockType('cta')).toBe('CTA');
      expect(sectionTypeToBlockType('pricing')).toBe('PRICING');
      expect(sectionTypeToBlockType('services')).toBe('SERVICES');
      expect(sectionTypeToBlockType('features')).toBe('FEATURES');
      expect(sectionTypeToBlockType('custom')).toBe('CUSTOM');
    });

    it('should handle legacy "text" section type', () => {
      // 'text' is legacy naming for ABOUT sections
      expect(sectionTypeToBlockType('text')).toBe('ABOUT');
    });

    it('should handle uppercase input (already a BlockType)', () => {
      expect(sectionTypeToBlockType('HERO')).toBe('HERO');
      expect(sectionTypeToBlockType('ABOUT')).toBe('ABOUT');
      expect(sectionTypeToBlockType('FEATURES')).toBe('FEATURES');
    });

    it('should handle mixed case by normalizing to lowercase', () => {
      expect(sectionTypeToBlockType('Hero')).toBe('HERO');
      expect(sectionTypeToBlockType('HERO')).toBe('HERO');
    });

    it('should handle whitespace', () => {
      expect(sectionTypeToBlockType(' hero ')).toBe('HERO');
      expect(sectionTypeToBlockType('  about  ')).toBe('ABOUT');
    });

    it('should return null for invalid section types', () => {
      expect(sectionTypeToBlockType('invalid')).toBeNull();
      expect(sectionTypeToBlockType('banner')).toBeNull();
      expect(sectionTypeToBlockType('header')).toBeNull();
      expect(sectionTypeToBlockType('')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // blockTypeToSectionType
  // ─────────────────────────────────────────────────────────────────────────

  describe('blockTypeToSectionType', () => {
    it('should convert all BlockTypes to section types', () => {
      expect(blockTypeToSectionType('HERO')).toBe('hero');
      expect(blockTypeToSectionType('ABOUT')).toBe('about');
      expect(blockTypeToSectionType('GALLERY')).toBe('gallery');
      expect(blockTypeToSectionType('TESTIMONIALS')).toBe('testimonials');
      expect(blockTypeToSectionType('FAQ')).toBe('faq');
      expect(blockTypeToSectionType('CONTACT')).toBe('contact');
      expect(blockTypeToSectionType('CTA')).toBe('cta');
      expect(blockTypeToSectionType('PRICING')).toBe('pricing');
      expect(blockTypeToSectionType('SERVICES')).toBe('services');
      expect(blockTypeToSectionType('FEATURES')).toBe('features');
      expect(blockTypeToSectionType('CUSTOM')).toBe('custom');
    });

    it('should map ABOUT to "about" (not "text")', () => {
      // 'about' is the canonical name, not 'text'
      expect(blockTypeToSectionType('ABOUT')).toBe('about');
      expect(blockTypeToSectionType('ABOUT')).not.toBe('text');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bidirectional Consistency
  // ─────────────────────────────────────────────────────────────────────────

  describe('bidirectional consistency', () => {
    it('should round-trip BlockType -> SectionType -> BlockType', () => {
      for (const blockType of BLOCK_TYPES) {
        const sectionType = blockTypeToSectionType(blockType);
        const backToBlockType = sectionTypeToBlockType(sectionType);
        expect(backToBlockType).toBe(blockType);
      }
    });

    it('should handle "text" legacy type correctly in round-trip', () => {
      // text -> ABOUT -> about (canonical name returned, not 'text')
      const blockType = sectionTypeToBlockType('text');
      expect(blockType).toBe('ABOUT');

      const sectionType = blockTypeToSectionType(blockType!);
      expect(sectionType).toBe('about');

      // And back to BlockType
      const finalBlockType = sectionTypeToBlockType(sectionType);
      expect(finalBlockType).toBe('ABOUT');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // isValidBlockType
  // ─────────────────────────────────────────────────────────────────────────

  describe('isValidBlockType', () => {
    it('should return true for valid BlockTypes', () => {
      expect(isValidBlockType('HERO')).toBe(true);
      expect(isValidBlockType('ABOUT')).toBe(true);
      expect(isValidBlockType('FEATURES')).toBe(true);
      expect(isValidBlockType('CUSTOM')).toBe(true);
    });

    it('should return false for lowercase section types', () => {
      expect(isValidBlockType('hero')).toBe(false);
      expect(isValidBlockType('about')).toBe(false);
    });

    it('should return false for invalid values', () => {
      expect(isValidBlockType('INVALID')).toBe(false);
      expect(isValidBlockType('')).toBe(false);
      expect(isValidBlockType('BANNER')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constants
  // ─────────────────────────────────────────────────────────────────────────

  describe('constants', () => {
    it('should export all expected section types', () => {
      expect(SECTION_TYPES).toContain('hero');
      expect(SECTION_TYPES).toContain('text');
      expect(SECTION_TYPES).toContain('about');
      expect(SECTION_TYPES).toContain('features');
      expect(SECTION_TYPES).toHaveLength(12);
    });

    it('should export all expected block types', () => {
      expect(BLOCK_TYPES).toContain('HERO');
      expect(BLOCK_TYPES).toContain('ABOUT');
      expect(BLOCK_TYPES).toContain('FEATURES');
      expect(BLOCK_TYPES).toContain('CUSTOM');
      expect(BLOCK_TYPES).toHaveLength(11);
    });

    it('should have BLOCK_TYPES and SECTION_TYPES in sync (minus legacy)', () => {
      // BLOCK_TYPES should match SECTION_TYPES minus 'text' (legacy alias)
      const uniqueSectionTypes = SECTION_TYPES.filter((t) => t !== 'text');
      expect(BLOCK_TYPES.length).toBe(uniqueSectionTypes.length);
    });
  });
});
