import { describe, it, expect } from 'vitest';
import { parseQuickReplies } from './parseQuickReplies';

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
});
