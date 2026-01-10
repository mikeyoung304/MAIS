/**
 * Build Mode Types
 *
 * Type definitions for the agent-first storefront editor.
 * Legacy component prop types removed 2026-01-10 (see BUILD_MODE_LEGACY_CLEANUP.md)
 */

// Re-export message types from protocol (Zod-validated versions are canonical)
export type { BuildModeParentMessage, BuildModeChildMessage } from './protocol';
