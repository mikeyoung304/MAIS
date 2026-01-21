/**
 * Shared Security Utilities for Agent-v2
 *
 * Provides prompt injection detection and content sanitization for agents
 * that process external content (scraped web pages, user uploads, etc.)
 *
 * Originally extracted from the Research Agent as part of Phase 4.5 remediation.
 *
 * @module agent-v2/shared/security
 */

// =============================================================================
// PROMPT INJECTION DETECTION
// =============================================================================

/**
 * Patterns that indicate potential prompt injection in external content.
 * These patterns try to manipulate the agent through injected text.
 *
 * Categories:
 * 1. Direct instruction overrides - "ignore previous instructions"
 * 2. Role changes - "you are now a..."
 * 3. Encoding bypasses - Base64, hex encoded attempts
 * 4. Context manipulation - Fake system messages, conversation resets
 */
export const INJECTION_PATTERNS = [
  // Direct instruction attempts
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /forget\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /new\s+instructions?:\s*/i,
  /system\s*(?:prompt|message):\s*/i,
  /you\s+are\s+now\s+(?:a|an)\s+/i,

  // Role manipulation
  /(?:pretend|act|behave)\s+(?:like\s+)?(?:you\s+are|as\s+if)/i,
  /switch\s+(?:to\s+)?(?:a\s+)?(?:different\s+)?(?:mode|personality|role)/i,
  /enter\s+(?:developer|debug|admin|god)\s*mode/i,

  // Jailbreak attempts
  /dan\s*(?:mode|prompt)/i,
  /jailbreak/i,
  /bypass\s+(?:filters?|restrictions?|safety)/i,

  // Encoded content markers (may hide malicious prompts)
  /base64\s*:\s*/i,
  /encoded\s*:\s*/i,

  // Fake system boundaries
  /---+\s*(?:system|assistant|user)\s*---+/i,
  /\[system\]/i,
  /\[assistant\]/i,
  /end\s+of\s+(?:system\s+)?(?:prompt|instructions?)/i,

  // Conversation manipulation
  /new\s+conversation/i,
  /reset\s+(?:conversation|context|memory)/i,
  /clear\s+(?:all\s+)?(?:previous\s+)?(?:context|history)/i,
];

/**
 * Result of prompt injection filtering
 */
export interface InjectionFilterResult {
  /** Whether the content passed injection checks */
  safe: boolean;
  /** The filtered content (with injection patterns redacted) */
  filtered: string;
  /** List of detected injection pattern descriptions */
  detected: string[];
}

/**
 * Filter content for prompt injection patterns.
 *
 * This function scans text for known injection patterns and redacts them.
 * Use this for any external content before passing it to the LLM.
 *
 * @param content - The content to filter
 * @returns Object with safety status, filtered content, and detected patterns
 *
 * @example
 * ```typescript
 * const { safe, filtered, detected } = filterPromptInjection(scrapedText);
 * if (!safe) {
 *   logger.warn({ detected }, 'Prompt injection detected');
 * }
 * // Use `filtered` content which has injections redacted
 * ```
 */
export function filterPromptInjection(content: string): InjectionFilterResult {
  const detected: string[] = [];
  let filtered = content;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(filtered)) {
      detected.push(pattern.source);
      // Redact the pattern instead of removing entirely
      filtered = filtered.replace(pattern, '[REDACTED]');
    }
  }

  return {
    safe: detected.length === 0,
    filtered,
    detected,
  };
}

// =============================================================================
// CONTENT SANITIZATION
// =============================================================================

/**
 * Options for content sanitization
 */
export interface SanitizeOptions {
  /** Maximum length of output (default: 5000) */
  maxLength?: number;
  /** Whether to strip HTML tags (default: true) */
  stripHtml?: boolean;
  /** Whether to normalize whitespace (default: true) */
  normalizeWhitespace?: boolean;
  /** Whether to decode HTML entities (default: true) */
  decodeEntities?: boolean;
}

const DEFAULT_SANITIZE_OPTIONS: Required<SanitizeOptions> = {
  maxLength: 5000,
  stripHtml: true,
  normalizeWhitespace: true,
  decodeEntities: true,
};

/**
 * Clean and truncate external content for safe processing.
 *
 * Performs:
 * 1. HTML tag removal
 * 2. HTML entity decoding
 * 3. Whitespace normalization
 * 4. Length truncation with suffix
 *
 * @param content - Raw content to sanitize
 * @param options - Sanitization options
 * @returns Sanitized content safe for processing
 *
 * @example
 * ```typescript
 * const clean = sanitizeContent(scrapedHtml, { maxLength: 3000 });
 * ```
 */
export function sanitizeContent(content: string, options: SanitizeOptions = {}): string {
  const opts = { ...DEFAULT_SANITIZE_OPTIONS, ...options };
  let cleaned = content;

  // Normalize whitespace
  if (opts.normalizeWhitespace) {
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
  }

  // Remove HTML tags
  if (opts.stripHtml) {
    cleaned = cleaned.replace(/<[^>]*>/g, '');
  }

  // Decode HTML entities
  if (opts.decodeEntities) {
    cleaned = cleaned.replace(/&nbsp;/g, ' ');
    cleaned = cleaned.replace(/&amp;/g, '&');
    cleaned = cleaned.replace(/&lt;/g, '<');
    cleaned = cleaned.replace(/&gt;/g, '>');
    cleaned = cleaned.replace(/&quot;/g, '"');
    cleaned = cleaned.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  }

  // Truncate with suffix
  if (cleaned.length > opts.maxLength) {
    cleaned = cleaned.substring(0, opts.maxLength - 20) + '... [truncated]';
  }

  return cleaned;
}

// =============================================================================
// COMBINED PROCESSING
// =============================================================================

/**
 * Result of full content processing
 */
export interface ProcessedContent {
  /** Sanitized and filtered content */
  content: string;
  /** Whether any injection patterns were detected */
  injectionDetected: boolean;
  /** List of detected patterns (for logging) */
  detectedPatterns: string[];
  /** Original content length */
  originalLength: number;
  /** Final content length */
  finalLength: number;
  /** Whether content was truncated */
  wasTruncated: boolean;
}

/**
 * Process external content with full security pipeline.
 *
 * Combines injection filtering and sanitization into a single call.
 * Use this for scraped web content, file uploads, or any external text.
 *
 * @param content - Raw external content
 * @param options - Sanitization options
 * @returns Processed content with metadata
 *
 * @example
 * ```typescript
 * const result = processExternalContent(scrapedPage);
 * if (result.injectionDetected) {
 *   logger.warn({ patterns: result.detectedPatterns }, 'Suspicious content');
 * }
 * return result.content;
 * ```
 */
export function processExternalContent(
  content: string,
  options: SanitizeOptions = {}
): ProcessedContent {
  const originalLength = content.length;
  const maxLength = options.maxLength ?? DEFAULT_SANITIZE_OPTIONS.maxLength;

  // Step 1: Filter for injection patterns
  const { safe, filtered, detected } = filterPromptInjection(content);

  // Step 2: Sanitize the filtered content
  const sanitized = sanitizeContent(filtered, options);

  return {
    content: sanitized,
    injectionDetected: !safe,
    detectedPatterns: detected,
    originalLength,
    finalLength: sanitized.length,
    wasTruncated: originalLength > maxLength,
  };
}
