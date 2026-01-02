/**
 * PII Redactor
 *
 * Centralized module for redacting Personally Identifiable Information (PII)
 * from text content before it's sent to evaluators, logged, or displayed.
 *
 * Extracted from:
 * - server/src/agent/evals/pipeline.ts
 * - server/src/agent/feedback/review-queue.ts
 *
 * @see plans/agent-eval-remediation-plan.md Phase 6.3
 */

// ─────────────────────────────────────────────────────────────────────────────
// PII Patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PII patterns to detect and redact.
 * Each pattern has a regex and a replacement token.
 */
const PII_PATTERNS = [
  // Email addresses
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL]',
  },
  // Phone numbers (various formats)
  {
    pattern: /\b(\+\d{1,2}\s?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE]',
  },
  // Credit card numbers
  {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CARD]',
  },
  // SSN
  {
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: '[SSN]',
  },
  // Addresses (basic pattern)
  {
    pattern:
      /\b\d{1,5}\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|circle|cir|boulevard|blvd)\b/gi,
    replacement: '[ADDRESS]',
  },
  // Names following "my name is" or "I'm" patterns
  {
    pattern: /(?:my name is|I'm|I am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    replacement: 'my name is [NAME]',
  },
  // IP addresses (IPv4)
  {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '[IP]',
  },
  // International phone numbers (E.164 format: +1234567890)
  {
    pattern: /\+\d{7,15}\b/g,
    replacement: '[PHONE]',
  },
  // Date of birth patterns (DOB: MM/DD/YYYY or similar)
  {
    pattern: /\b(?:DOB|Date of Birth|Birthday)[:\s]+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi,
    replacement: '[DOB]',
  },
] as const;

/**
 * Sensitive key names that should have their values fully redacted.
 */
const SENSITIVE_KEYS = [
  'email',
  'phone',
  'address',
  'ssn',
  'card',
  'password',
  'creditcard',
  'social_security',
  'socialsecurity',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Redact PII from a string.
 *
 * @param text - The text to redact
 * @returns Text with PII patterns replaced with tokens
 *
 * @example
 * ```typescript
 * redactPII('Contact me at john@example.com');
 * // Returns: 'Contact me at [EMAIL]'
 *
 * redactPII('Call 555-123-4567 for help');
 * // Returns: 'Call [PHONE] for help'
 * ```
 */
export function redactPII(text: string): string {
  let redacted = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

/**
 * Redact PII from an array of message objects.
 * Each message must have a `content` property.
 *
 * @param messages - Array of messages with content field
 * @returns New array with redacted content
 *
 * @example
 * ```typescript
 * const messages = [{ role: 'user', content: 'My email is test@example.com' }];
 * redactMessages(messages);
 * // Returns: [{ role: 'user', content: 'My email is [EMAIL]' }]
 * ```
 */
export function redactMessages<T extends { content: string }>(messages: readonly T[]): T[] {
  return messages.map((m) => ({
    ...m,
    content: redactPII(m.content),
  }));
}

/**
 * Redact PII from tool calls (input/output objects).
 *
 * @param toolCalls - Array of tool calls with input/output
 * @returns New array with redacted input/output
 */
export function redactToolCalls<T extends { input: Record<string, unknown>; output?: unknown }>(
  toolCalls: readonly T[]
): T[] {
  return toolCalls.map((tc) => ({
    ...tc,
    input: redactObjectPII(tc.input) as Record<string, unknown>,
    output: tc.output !== undefined ? redactObjectPII(tc.output) : undefined,
  }));
}

/**
 * Recursively redact PII from an object.
 * Handles strings, arrays, and nested objects.
 * Sensitive keys (email, password, etc.) are fully redacted.
 *
 * @param obj - The object to redact
 * @returns New object with redacted values
 *
 * @example
 * ```typescript
 * redactObjectPII({ email: 'test@example.com', name: 'John' });
 * // Returns: { email: '[REDACTED_EMAIL]', name: 'John' }
 * ```
 */
export function redactObjectPII(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return redactPII(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(redactObjectPII);
  }
  if (obj !== null && typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Redact sensitive keys entirely
      if (SENSITIVE_KEYS.includes(key.toLowerCase() as (typeof SENSITIVE_KEYS)[number])) {
        redacted[key] = `[REDACTED_${key.toUpperCase()}]`;
      } else {
        redacted[key] = redactObjectPII(value);
      }
    }
    return redacted;
  }
  return obj;
}

/**
 * Redact PII from messages and truncate to max length.
 * Useful for preview displays in review queues.
 *
 * @param messages - Array of messages with role and content
 * @param maxLength - Maximum length per message content (default: 500)
 * @returns New array with redacted and truncated content
 */
export function redactMessagesForPreview<T extends { role: string; content: string }>(
  messages: readonly T[],
  maxLength: number = 500
): Array<{ role: string; content: string }> {
  return messages.map((m) => ({
    role: m.role,
    content: redactPII(m.content).slice(0, maxLength),
  }));
}
