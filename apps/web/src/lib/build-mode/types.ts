/**
 * Build Mode Types
 *
 * Type definitions for the split-screen storefront editor.
 */

import type { PageName, PagesConfig } from '@macon/contracts';

// Re-export message types from protocol (Zod-validated versions are canonical)
export type { BuildModeParentMessage, BuildModeChildMessage } from './protocol';

// ============================================================================
// Build Mode State
// ============================================================================

export interface BuildModeState {
  /** Currently selected page */
  currentPage: PageName;

  /** Whether draft has unsaved changes */
  isDirty: boolean;

  /** Draft configuration being edited */
  draftConfig: PagesConfig | null;

  /** Whether currently saving */
  isSaving: boolean;

  /** Last saved timestamp */
  lastSaved: Date | null;

  /** Currently highlighted section index (from chat selection) */
  highlightedSection: number | null;
}

// ============================================================================
// Chat Context for Build Mode
// ============================================================================

export interface BuildModeChatContext {
  /** Current page being edited */
  currentPage: PageName;

  /** Number of sections on current page */
  sectionCount: number;

  /** Whether draft has unsaved changes */
  hasDraft: boolean;

  /** Tenant slug for preview URL */
  tenantSlug: string;
}

// ============================================================================
// Component Props
// ============================================================================

export interface BuildModePreviewProps {
  tenantSlug: string;
  currentPage: PageName;
  isDraft: boolean;
  onReady?: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

export interface BuildModeChatProps {
  tenantId: string;
  tenantSlug: string;
  context: BuildModeChatContext;
  onSectionHighlight?: (pageId: PageName, sectionIndex: number) => void;
  onConfigUpdate?: () => void;
  className?: string;
}

export interface PageSelectorProps {
  currentPage: PageName;
  pages: PagesConfig;
  onChange: (page: PageName) => void;
}

export interface BuildModeHeaderProps {
  isDirty: boolean;
  isSaving: boolean;
  onPublish: () => void;
  onDiscard: () => void;
  onExit: () => void;
}
