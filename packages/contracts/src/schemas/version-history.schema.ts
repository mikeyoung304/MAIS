/**
 * Version History Schema Definitions
 *
 * Zod schemas for the SectionContent model's versions Json field.
 * Supports undo functionality by storing last 5 versions of content.
 *
 * @see server/prisma/schema.prisma - SectionContent.versions
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { z } from 'zod';

/**
 * Individual version entry in the history
 */
export const VersionEntrySchema = z.object({
  /** The content snapshot at this version */
  content: z.record(z.unknown()),

  /** ISO 8601 timestamp when this version was created */
  timestamp: z.string().datetime({ message: 'Timestamp must be ISO 8601 format' }),

  /** Who created this version */
  author: z.enum(['agent', 'user', 'previous', 'system']),

  /** Name of the tool that made the change (if agent-initiated) */
  toolName: z.string().optional(),

  /** Optional description of what changed */
  changeDescription: z.string().max(200).optional(),
});

/**
 * Version history array
 * Limited to 5 entries to prevent unbounded growth
 */
export const VersionHistorySchema = z
  .array(VersionEntrySchema)
  .max(5, 'Version history limited to 5 entries');

// Type exports
export type VersionEntry = z.infer<typeof VersionEntrySchema>;
export type VersionHistory = z.infer<typeof VersionHistorySchema>;

/**
 * Create a new version entry
 *
 * @example
 * const entry = createVersionEntry(currentContent, 'agent', 'update_section');
 */
export function createVersionEntry(
  content: Record<string, unknown>,
  author: VersionEntry['author'],
  toolName?: string,
  changeDescription?: string
): VersionEntry {
  return {
    content,
    timestamp: new Date().toISOString(),
    author,
    toolName,
    changeDescription,
  };
}

/**
 * Add a version to history, maintaining max 5 entries
 * New versions are prepended (most recent first)
 *
 * @example
 * const newHistory = addVersionToHistory(existingHistory, newEntry);
 */
export function addVersionToHistory(
  history: VersionHistory | null | undefined,
  entry: VersionEntry
): VersionHistory {
  const existing = history ?? [];
  const updated = [entry, ...existing];

  // Keep only the 5 most recent versions
  return updated.slice(0, 5);
}

/**
 * Get the most recent version from history
 * Returns undefined if history is empty
 */
export function getMostRecentVersion(
  history: VersionHistory | null | undefined
): VersionEntry | undefined {
  if (!history || history.length === 0) {
    return undefined;
  }
  return history[0];
}

/**
 * Check if undo is available
 */
export function canUndo(history: VersionHistory | null | undefined): boolean {
  return !!history && history.length > 0;
}
