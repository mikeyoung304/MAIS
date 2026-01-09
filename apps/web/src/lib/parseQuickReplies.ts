/**
 * Parse quick reply suggestions from agent messages
 *
 * The agent embeds quick replies in a special format at the end of messages:
 * [Quick Replies: Option 1 | Option 2 | Option 3]
 *
 * This parser extracts them so the UI can render clickable chips.
 */

export interface ParsedMessage {
  /** The message content with quick replies stripped */
  message: string;
  /** Array of quick reply options */
  quickReplies: string[];
}

/**
 * Parse quick replies from agent message content
 *
 * @param content - Raw message content from agent
 * @returns Object with cleaned message and extracted quick replies
 *
 * @example
 * parseQuickReplies("Ready to start? [Quick Replies: Yes | No | Maybe]")
 * // => { message: "Ready to start?", quickReplies: ["Yes", "No", "Maybe"] }
 */
export function parseQuickReplies(content: string): ParsedMessage {
  // Match [Quick Replies: ...] at end of message (case-insensitive)
  const pattern = /\[Quick Replies:\s*(.+?)\]\s*$/i;
  const match = content.match(pattern);

  if (!match) {
    return { message: content.trim(), quickReplies: [] };
  }

  // Strip the quick replies from the message
  const message = content.replace(pattern, '').trim();

  // Parse pipe-separated options
  const quickReplies = match[1]
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return { message, quickReplies };
}
