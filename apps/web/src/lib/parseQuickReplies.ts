/**
 * Parse quick reply suggestions from agent messages
 *
 * The agent embeds quick replies in a special format at the end of messages:
 * [Quick Replies: Option 1 | Option 2 | Option 3]
 *
 * This parser extracts them so the UI can render clickable chips.
 *
 * Security: Options are validated to prevent XSS and injection attacks.
 * Defense-in-depth: Even though React escapes text content, we filter
 * potentially dangerous patterns at the parser level.
 */

export interface ParsedMessage {
  /** The message content with quick replies stripped */
  message: string;
  /** Array of quick reply options (sanitized) */
  quickReplies: string[];
}

/**
 * Maximum allowed length for a quick reply option.
 * Prevents layout issues and reduces attack surface.
 */
export const MAX_OPTION_LENGTH = 50;

/**
 * Patterns that are not allowed in quick reply options.
 * Defense-in-depth against XSS - even though React escapes text,
 * we filter these patterns to prevent issues if rendering changes.
 */
export const DISALLOWED_PATTERNS: RegExp[] = [
  /<script/i, // Script tags
  /javascript:/i, // JavaScript URLs
  /data:/i, // Data URLs (can contain scripts)
  /vbscript:/i, // VBScript URLs
  /on\w+\s*=/i, // Event handlers (onclick=, onerror=, etc.)
  /<\s*\/?\s*\w+/i, // Any HTML tags
];

/**
 * Validate and sanitize a single quick reply option
 *
 * @param option - Raw option string from LLM
 * @returns Sanitized option, or null if invalid
 */
export function sanitizeOption(option: string): string | null {
  const trimmed = option.trim();

  // Reject empty options
  if (trimmed.length === 0) {
    return null;
  }

  // Reject overly long options (truncation could break meaning)
  if (trimmed.length > MAX_OPTION_LENGTH) {
    return null;
  }

  // Reject options containing disallowed patterns
  if (DISALLOWED_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return null;
  }

  return trimmed;
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

  // Parse pipe-separated options and sanitize each one
  const quickReplies = match[1]
    .split('|')
    .map(sanitizeOption)
    .filter((s): s is string => s !== null);

  return { message, quickReplies };
}
