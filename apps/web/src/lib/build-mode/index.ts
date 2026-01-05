/**
 * Build Mode Library
 *
 * Types, protocols, and utilities for the split-screen storefront editor.
 */

export * from './config';
// Export types first (includes re-export of message types from protocol)
export * from './types';
// Export protocol functions and schemas (message types already exported via types)
export {
  // Schemas
  BuildModeInitSchema,
  BuildModeConfigUpdateSchema,
  BuildModeHighlightSectionSchema,
  BuildModeClearHighlightSchema,
  BuildModeParentMessageSchema,
  BuildModeReadySchema,
  BuildModeSectionEditSchema,
  BuildModeSectionSelectedSchema,
  BuildModePageChangeSchema,
  BuildModeChildMessageSchema,
  // Functions
  parseParentMessage,
  parseChildMessage,
  isSameOrigin,
  sendToIframe,
  sendToParent,
} from './protocol';
