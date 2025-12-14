/**
 * Storefront Feature Module
 *
 * Customer-facing storefront components for the 3-choice pattern.
 *
 * Components:
 * - ChoiceCardBase: Pure presentation card (base for all choice cards)
 * - SegmentCard: Wrapper for segment display
 * - TierCard: Wrapper for tier/package display
 * - TierSelector: Tier card grid layout
 * - TierDetail: Full detail view with prev/next navigation
 *
 * Utilities:
 * - TIER_LEVELS: Standard tier level constants
 * - getTierDisplayName: Convert tier level to display name
 * - extractTiers: Extract tiers from package list
 * - cardStyles: Shared card styling constants
 */

export { ChoiceCardBase } from './ChoiceCardBase';
export { ChoiceGrid } from './ChoiceGrid';
export { SegmentCard } from './SegmentCard';
export { TierCard } from './TierCard';
export { TierSelector } from './TierSelector';
export { TierDetail } from './TierDetail';

// Export shared utilities
export {
  TIER_LEVELS,
  LEGACY_TIER_ALIASES,
  getTierDisplayName,
  extractTiers,
  normalizeGrouping,
  truncateText,
  CARD_DESCRIPTION_MAX_LENGTH,
  type TierLevel,
} from './utils';

// Export hooks
export {
  useTenant,
  useTierDisplayName,
  getTierDisplayNameWithFallback,
} from './hooks';

// Export shared styles
export { cardStyles } from './cardStyles';
