/**
 * Block Type Mapper
 *
 * Bidirectional mapping between frontend section types and database BlockType enum.
 * Handles legacy conversions (e.g., 'text' -> 'ABOUT') and provides type-safe utilities.
 *
 * @see server/prisma/schema.prisma - BlockType enum
 * @see packages/contracts/src/schemas/section-content.schema.ts - BlockTypeSchema
 * @see docs/plans/2026-02-02-refactor-section-content-migration-plan.md - Phase 0.3
 */

import type { BlockType } from '../generated/prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Frontend section types as used in agent tools and API contracts.
 * These are the lowercase names used in the frontend/API.
 */
export const SECTION_TYPES = [
  'hero',
  'text', // Maps to ABOUT (legacy naming)
  'about',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'services',
  'features',
  'custom',
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

/**
 * All valid BlockType values from Prisma enum.
 * Used for runtime validation.
 */
export const BLOCK_TYPES = [
  'HERO',
  'ABOUT',
  'SERVICES',
  'PRICING',
  'TESTIMONIALS',
  'FAQ',
  'CONTACT',
  'CTA',
  'GALLERY',
  'FEATURES',
  'CUSTOM',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Mapping Tables
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map frontend section types to database BlockType enum.
 *
 * IMPORTANT: 'text' is a legacy name that maps to 'ABOUT'.
 * New code should use 'about' but we support 'text' for backwards compatibility.
 */
const SECTION_TO_BLOCK_MAP: Record<SectionType, BlockType> = {
  hero: 'HERO',
  text: 'ABOUT', // Legacy: 'text' sections map to ABOUT block
  about: 'ABOUT',
  gallery: 'GALLERY',
  testimonials: 'TESTIMONIALS',
  faq: 'FAQ',
  contact: 'CONTACT',
  cta: 'CTA',
  pricing: 'PRICING',
  services: 'SERVICES',
  features: 'FEATURES',
  custom: 'CUSTOM',
};

/**
 * Map database BlockType enum to canonical frontend section type.
 *
 * Note: ABOUT maps to 'about' (not 'text') as 'about' is the canonical name.
 */
const BLOCK_TO_SECTION_MAP: Record<BlockType, SectionType> = {
  HERO: 'hero',
  ABOUT: 'about', // Canonical name (not 'text')
  GALLERY: 'gallery',
  TESTIMONIALS: 'testimonials',
  FAQ: 'faq',
  CONTACT: 'contact',
  CTA: 'cta',
  PRICING: 'pricing',
  SERVICES: 'services',
  FEATURES: 'features',
  CUSTOM: 'custom',
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapping Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert frontend section type to database BlockType.
 *
 * @param sectionType - Frontend section type (e.g., 'hero', 'text', 'about')
 * @returns BlockType enum value, or null if invalid
 *
 * @example
 * sectionTypeToBlockType('hero') // 'HERO'
 * sectionTypeToBlockType('text') // 'ABOUT' (legacy support)
 * sectionTypeToBlockType('about') // 'ABOUT'
 * sectionTypeToBlockType('invalid') // null
 */
export function sectionTypeToBlockType(sectionType: string): BlockType | null {
  const normalized = sectionType.toLowerCase().trim();

  // Check if it's a valid section type
  if (normalized in SECTION_TO_BLOCK_MAP) {
    return SECTION_TO_BLOCK_MAP[normalized as SectionType];
  }

  // Check if it's already a BlockType (uppercase)
  if (isValidBlockType(sectionType)) {
    return sectionType;
  }

  return null;
}

/**
 * Convert database BlockType to canonical frontend section type.
 *
 * @param blockType - Database BlockType enum value
 * @returns Canonical frontend section type
 *
 * @example
 * blockTypeToSectionType('HERO') // 'hero'
 * blockTypeToSectionType('ABOUT') // 'about' (not 'text')
 */
export function blockTypeToSectionType(blockType: BlockType): SectionType {
  return BLOCK_TO_SECTION_MAP[blockType];
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a string is a valid BlockType enum value.
 *
 * @param value - String to check
 * @returns True if value is a valid BlockType
 *
 * @example
 * isValidBlockType('HERO') // true
 * isValidBlockType('hero') // false (lowercase)
 * isValidBlockType('INVALID') // false
 */
export function isValidBlockType(value: string): value is BlockType {
  return BLOCK_TYPES.includes(value as BlockType);
}
