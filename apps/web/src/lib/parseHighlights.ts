/**
 * Parse highlight instructions from agent messages
 *
 * The agent embeds highlight commands inline in messages:
 * [highlight section-id]
 *
 * This parser extracts them so the UI can trigger section highlights,
 * and strips them from the displayed message.
 *
 * @example
 * parseHighlights("Let me show you the hero. [highlight home-hero-main] This is your headline.")
 * // => { message: "Let me show you the hero. This is your headline.", highlights: ["home-hero-main"] }
 */

export interface ParsedHighlights {
  /** The message content with highlight instructions stripped */
  message: string;
  /** Array of section IDs to highlight */
  highlights: string[];
}

/**
 * Parse highlight instructions from agent message content
 *
 * @param content - Raw message content from agent
 * @returns Object with cleaned message and extracted highlight IDs
 */
export function parseHighlights(content: string): ParsedHighlights {
  // Match [highlight section-id] anywhere in message (case-insensitive)
  // Section IDs follow pattern: {page}-{type}-{qualifier} (e.g., home-hero-main)
  const pattern = /\[highlight\s+([^\]]+)\]/gi;

  const highlights: string[] = [];
  let match;

  // Extract all highlight instructions
  while ((match = pattern.exec(content)) !== null) {
    highlights.push(match[1].trim());
  }

  // Strip highlight instructions from displayed message
  const message = content.replace(pattern, '').trim();

  // Clean up any double spaces left by removal
  const cleanedMessage = message.replace(/\s{2,}/g, ' ');

  return { message: cleanedMessage, highlights };
}
