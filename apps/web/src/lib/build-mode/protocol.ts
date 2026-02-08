/**
 * Build Mode PostMessage Protocol
 *
 * Type-safe communication between Build Mode parent and storefront iframe.
 * Uses Zod validation to ensure message integrity and prevent injection attacks.
 *
 * Security:
 * - Origin validation required on both ends
 * - All payloads validated with Zod before processing
 * - Discriminated unions prevent type confusion attacks
 */

import { z } from 'zod';
import { PAGE_NAMES, PagesConfigSchema } from '@macon/contracts';
import { logger } from '@/lib/logger';

// ============================================================================
// Parent → Iframe Message Schemas
// ============================================================================

/**
 * Init message - sent when iframe reports ready
 */
export const BuildModeInitSchema = z.object({
  type: z.literal('BUILD_MODE_INIT'),
  data: z.object({
    draftConfig: PagesConfigSchema,
  }),
});

/**
 * Config update message - sent when draft config changes
 */
export const BuildModeConfigUpdateSchema = z.object({
  type: z.literal('BUILD_MODE_CONFIG_UPDATE'),
  data: z.object({
    config: PagesConfigSchema,
  }),
});

/**
 * Highlight section by ID message - sent to highlight a specific section by its stable ID
 *
 * Preferred over BUILD_MODE_HIGHLIGHT_SECTION because:
 * - IDs are stable across section reordering
 * - Agent can reference sections by meaningful names (e.g., "home-hero-main")
 * - No need to resolve index in parent - iframe looks up by data-section-id
 */
export const BuildModeHighlightSectionByIdSchema = z.object({
  type: z.literal('BUILD_MODE_HIGHLIGHT_SECTION_BY_ID'),
  data: z.object({
    sectionId: z.string().min(1).max(50),
  }),
});

/**
 * Clear highlight message - sent to remove section highlight
 */
export const BuildModeClearHighlightSchema = z.object({
  type: z.literal('BUILD_MODE_CLEAR_HIGHLIGHT'),
});

/**
 * Union of all parent → iframe messages
 */
export const BuildModeParentMessageSchema = z.discriminatedUnion('type', [
  BuildModeInitSchema,
  BuildModeConfigUpdateSchema,
  BuildModeHighlightSectionByIdSchema,
  BuildModeClearHighlightSchema,
]);

export type BuildModeParentMessage = z.infer<typeof BuildModeParentMessageSchema>;

// ============================================================================
// Iframe → Parent Message Schemas
// ============================================================================

/**
 * Ready message - sent when iframe has loaded and initialized
 */
export const BuildModeReadySchema = z.object({
  type: z.literal('BUILD_MODE_READY'),
});

/**
 * Section selected message - sent when user clicks a section
 */
export const BuildModeSectionSelectedSchema = z.object({
  type: z.literal('BUILD_MODE_SECTION_SELECTED'),
  data: z.object({
    pageId: z.enum(PAGE_NAMES as unknown as [string, ...string[]]),
    sectionIndex: z.number().int().min(0),
  }),
});

/**
 * Union of all iframe → parent messages
 */
export const BuildModeChildMessageSchema = z.discriminatedUnion('type', [
  BuildModeReadySchema,
  BuildModeSectionSelectedSchema,
]);

export type BuildModeChildMessage = z.infer<typeof BuildModeChildMessageSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate and parse a parent message
 * @returns Parsed message or null if invalid
 */
export function parseParentMessage(data: unknown): BuildModeParentMessage | null {
  const result = BuildModeParentMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate and parse a child message
 * @returns Parsed message or null if invalid
 */
export function parseChildMessage(data: unknown): BuildModeChildMessage | null {
  const result = BuildModeChildMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Check if message origin is from the same origin (security check)
 * @param origin - The origin of the message
 * @returns true if the origin is the current window origin
 */
export function isSameOrigin(origin: string): boolean {
  if (typeof window === 'undefined') return false;
  return origin === window.location.origin;
}

// ============================================================================
// Message Helpers
// ============================================================================

/**
 * Send a message to the iframe
 * @param iframe - The iframe element to send to
 * @param message - The message to send
 */
export function sendToIframe(iframe: HTMLIFrameElement, message: BuildModeParentMessage): void {
  if (!iframe.contentWindow) {
    logger.warn('[BuildMode] Cannot send to iframe: no contentWindow');
    return;
  }
  iframe.contentWindow.postMessage(message, window.location.origin);
}

/**
 * Send a message to the parent window
 * @param message - The message to send
 */
export function sendToParent(message: BuildModeChildMessage): void {
  if (typeof window === 'undefined' || window.parent === window) {
    logger.warn('[BuildMode] Not in iframe context');
    return;
  }
  window.parent.postMessage(message, window.location.origin);
}
