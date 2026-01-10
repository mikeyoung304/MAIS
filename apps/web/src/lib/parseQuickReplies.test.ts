import { describe, it, expect } from 'vitest';
import {
  parseQuickReplies,
  sanitizeOption,
  MAX_OPTION_LENGTH,
  DISALLOWED_PATTERNS,
} from './parseQuickReplies';

describe('parseQuickReplies', () => {
  it('extracts quick replies from message', () => {
    const result = parseQuickReplies(
      "Ready to start with your headline? [Quick Replies: Let's do it! | Show me first]"
    );
    expect(result.message).toBe('Ready to start with your headline?');
    expect(result.quickReplies).toEqual(["Let's do it!", 'Show me first']);
  });

  it('handles message without quick replies', () => {
    const result = parseQuickReplies('Just a normal message.');
    expect(result.message).toBe('Just a normal message.');
    expect(result.quickReplies).toEqual([]);
  });

  it('handles multiple options', () => {
    const result = parseQuickReplies('What next? [Quick Replies: Option 1 | Option 2 | Option 3]');
    expect(result.quickReplies).toEqual(['Option 1', 'Option 2', 'Option 3']);
  });

  it('is case insensitive', () => {
    const result = parseQuickReplies('Hello [quick replies: Yes | No]');
    expect(result.quickReplies).toEqual(['Yes', 'No']);
  });

  it('trims whitespace', () => {
    const result = parseQuickReplies('Msg [Quick Replies:   A  |  B  |  C  ]');
    expect(result.quickReplies).toEqual(['A', 'B', 'C']);
  });

  describe('security: XSS prevention', () => {
    it('filters options containing script tags', () => {
      const result = parseQuickReplies(
        'Choose [Quick Replies: Safe option | <script>alert(1)</script>]'
      );
      expect(result.quickReplies).toEqual(['Safe option']);
    });

    it('filters options containing javascript: URLs', () => {
      const result = parseQuickReplies('Choose [Quick Replies: Good | javascript:alert(1)]');
      expect(result.quickReplies).toEqual(['Good']);
    });

    it('filters options containing event handlers', () => {
      const result = parseQuickReplies(
        'Choose [Quick Replies: Clean | onclick=alert(1) | onerror = bad]'
      );
      expect(result.quickReplies).toEqual(['Clean']);
    });

    it('filters options containing HTML tags', () => {
      const result = parseQuickReplies(
        'Choose [Quick Replies: <img src=x> | <div>bad</div> | Normal]'
      );
      expect(result.quickReplies).toEqual(['Normal']);
    });

    it('filters options containing data: URLs', () => {
      const result = parseQuickReplies(
        'Choose [Quick Replies: data:text/html,<script>bad</script> | Safe]'
      );
      expect(result.quickReplies).toEqual(['Safe']);
    });
  });

  describe('security: length limits', () => {
    it('filters options exceeding max length', () => {
      const longOption = 'A'.repeat(MAX_OPTION_LENGTH + 1);
      const result = parseQuickReplies(`Choose [Quick Replies: ${longOption} | Short]`);
      expect(result.quickReplies).toEqual(['Short']);
    });

    it('allows options at max length', () => {
      const maxLengthOption = 'A'.repeat(MAX_OPTION_LENGTH);
      const result = parseQuickReplies(`Choose [Quick Replies: ${maxLengthOption} | Short]`);
      expect(result.quickReplies).toEqual([maxLengthOption, 'Short']);
    });
  });

  it('returns empty array when all options are filtered', () => {
    const result = parseQuickReplies(
      'Choose [Quick Replies: <script>bad</script> | javascript:bad]'
    );
    expect(result.quickReplies).toEqual([]);
    expect(result.message).toBe('Choose');
  });
});

describe('sanitizeOption', () => {
  it('returns trimmed valid option', () => {
    expect(sanitizeOption('  Hello  ')).toBe('Hello');
  });

  it('returns null for empty string', () => {
    expect(sanitizeOption('')).toBeNull();
    expect(sanitizeOption('   ')).toBeNull();
  });

  it('returns null for options exceeding max length', () => {
    const longOption = 'A'.repeat(MAX_OPTION_LENGTH + 1);
    expect(sanitizeOption(longOption)).toBeNull();
  });

  it('returns valid option at max length', () => {
    const maxLengthOption = 'A'.repeat(MAX_OPTION_LENGTH);
    expect(sanitizeOption(maxLengthOption)).toBe(maxLengthOption);
  });

  describe('disallowed patterns', () => {
    const dangerousInputs = [
      '<script>alert(1)</script>',
      'javascript:alert(1)',
      'JAVASCRIPT:void(0)',
      'data:text/html,<script>x</script>',
      'vbscript:msgbox(1)',
      'onclick=alert(1)',
      'onerror = bad',
      'ONLOAD=x',
      '<img src=x>',
      '<div>content</div>',
      '< script >',
      '</script>',
    ];

    it.each(dangerousInputs)('rejects "%s"', (input) => {
      expect(sanitizeOption(input)).toBeNull();
    });
  });

  describe('allowed content', () => {
    const safeInputs = [
      'Yes, continue',
      "Let's do it!",
      'Book for $50',
      'Schedule 2-hour session',
      'Contact me at email',
      '10% discount available',
      'Option (recommended)',
      'Tell me more...',
    ];

    it.each(safeInputs)('allows "%s"', (input) => {
      expect(sanitizeOption(input)).toBe(input);
    });
  });
});

describe('constants', () => {
  it('exports MAX_OPTION_LENGTH as a reasonable value', () => {
    expect(MAX_OPTION_LENGTH).toBeGreaterThanOrEqual(20);
    expect(MAX_OPTION_LENGTH).toBeLessThanOrEqual(100);
  });

  it('exports DISALLOWED_PATTERNS as an array of RegExp', () => {
    expect(Array.isArray(DISALLOWED_PATTERNS)).toBe(true);
    expect(DISALLOWED_PATTERNS.length).toBeGreaterThan(0);
    DISALLOWED_PATTERNS.forEach((pattern) => {
      expect(pattern).toBeInstanceOf(RegExp);
    });
  });
});
