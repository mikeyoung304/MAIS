/**
 * Version History Schema Tests
 *
 * Unit tests for VersionEntrySchema and VersionHistorySchema.
 * Tests version tracking and undo functionality helpers.
 *
 * @see packages/contracts/src/schemas/version-history.schema.ts
 */

import { describe, it, expect } from 'vitest';
import {
  VersionEntrySchema,
  VersionHistorySchema,
  createVersionEntry,
  addVersionToHistory,
  getMostRecentVersion,
  canUndo,
} from '@macon/contracts';

describe('VersionEntrySchema', () => {
  it('should validate a complete version entry', () => {
    const result = VersionEntrySchema.safeParse({
      content: { headline: 'Old headline', visible: true },
      timestamp: '2026-01-30T15:30:00.000Z',
      author: 'agent',
      toolName: 'update_section',
      changeDescription: 'Updated headline',
    });
    expect(result.success).toBe(true);
  });

  it('should validate with minimal required fields', () => {
    const result = VersionEntrySchema.safeParse({
      content: { text: 'Some content' },
      timestamp: '2026-01-30T15:30:00.000Z',
      author: 'user',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toolName).toBeUndefined();
      expect(result.data.changeDescription).toBeUndefined();
    }
  });

  it('should accept all valid author types', () => {
    const authors = ['agent', 'user', 'previous', 'system'];
    for (const author of authors) {
      const result = VersionEntrySchema.safeParse({
        content: {},
        timestamp: '2026-01-30T15:30:00.000Z',
        author,
      });
      expect(result.success, `Expected ${author} to be valid`).toBe(true);
    }
  });

  it('should reject invalid author', () => {
    const result = VersionEntrySchema.safeParse({
      content: {},
      timestamp: '2026-01-30T15:30:00.000Z',
      author: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid timestamp format', () => {
    const result = VersionEntrySchema.safeParse({
      content: {},
      timestamp: 'not-a-timestamp',
      author: 'user',
    });
    expect(result.success).toBe(false);
  });

  it('should reject changeDescription over 200 characters', () => {
    const result = VersionEntrySchema.safeParse({
      content: {},
      timestamp: '2026-01-30T15:30:00.000Z',
      author: 'agent',
      changeDescription: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe('VersionHistorySchema', () => {
  it('should validate an array of version entries', () => {
    const history = [
      {
        content: { version: 3 },
        timestamp: '2026-01-30T15:30:00.000Z',
        author: 'agent',
      },
      {
        content: { version: 2 },
        timestamp: '2026-01-30T15:00:00.000Z',
        author: 'user',
      },
      {
        content: { version: 1 },
        timestamp: '2026-01-30T14:30:00.000Z',
        author: 'previous',
      },
    ];
    const result = VersionHistorySchema.safeParse(history);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(3);
    }
  });

  it('should accept empty history', () => {
    const result = VersionHistorySchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it('should accept exactly 5 entries', () => {
    const history = Array(5)
      .fill(null)
      .map((_, i) => ({
        content: { version: i },
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        author: 'agent' as const,
      }));
    const result = VersionHistorySchema.safeParse(history);
    expect(result.success).toBe(true);
  });

  it('should reject more than 5 entries', () => {
    const history = Array(6)
      .fill(null)
      .map((_, i) => ({
        content: { version: i },
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        author: 'agent' as const,
      }));
    const result = VersionHistorySchema.safeParse(history);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('5');
    }
  });
});

describe('createVersionEntry helper', () => {
  it('should create a valid version entry', () => {
    const content = { headline: 'Test', visible: true };
    const entry = createVersionEntry(content, 'agent', 'update_section', 'Updated headline');

    expect(entry.content).toEqual(content);
    expect(entry.author).toBe('agent');
    expect(entry.toolName).toBe('update_section');
    expect(entry.changeDescription).toBe('Updated headline');

    // Timestamp should be valid ISO format
    const parseResult = VersionEntrySchema.safeParse(entry);
    expect(parseResult.success).toBe(true);
  });

  it('should create entry without optional fields', () => {
    const entry = createVersionEntry({ text: 'content' }, 'user');

    expect(entry.author).toBe('user');
    expect(entry.toolName).toBeUndefined();
    expect(entry.changeDescription).toBeUndefined();
  });

  it('should generate valid ISO timestamp', () => {
    const entry = createVersionEntry({}, 'system');
    const date = new Date(entry.timestamp);
    expect(date.toString()).not.toBe('Invalid Date');
  });
});

describe('addVersionToHistory helper', () => {
  it('should add version to empty history', () => {
    const entry = createVersionEntry({ v: 1 }, 'user');
    const history = addVersionToHistory(null, entry);

    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(entry);
  });

  it('should prepend version to existing history', () => {
    const existing = [createVersionEntry({ v: 1 }, 'user')];
    const newEntry = createVersionEntry({ v: 2 }, 'agent');
    const history = addVersionToHistory(existing, newEntry);

    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(newEntry); // New entry first
    expect(history[1]).toEqual(existing[0]);
  });

  it('should maintain max 5 entries', () => {
    const existing = Array(5)
      .fill(null)
      .map((_, i) => createVersionEntry({ v: i }, 'user'));
    const newEntry = createVersionEntry({ v: 'new' }, 'agent');
    const history = addVersionToHistory(existing, newEntry);

    expect(history).toHaveLength(5);
    expect(history[0]).toEqual(newEntry);
    // Oldest entry (v: 4) should be dropped
    expect(history[4].content).toEqual({ v: 3 });
  });

  it('should handle undefined history', () => {
    const entry = createVersionEntry({ test: true }, 'system');
    const history = addVersionToHistory(undefined, entry);

    expect(history).toHaveLength(1);
  });
});

describe('getMostRecentVersion helper', () => {
  it('should return first entry (most recent)', () => {
    const history = [
      createVersionEntry({ v: 'newest' }, 'agent'),
      createVersionEntry({ v: 'older' }, 'user'),
    ];
    const recent = getMostRecentVersion(history);

    expect(recent?.content).toEqual({ v: 'newest' });
  });

  it('should return undefined for empty history', () => {
    const recent = getMostRecentVersion([]);
    expect(recent).toBeUndefined();
  });

  it('should return undefined for null history', () => {
    const recent = getMostRecentVersion(null);
    expect(recent).toBeUndefined();
  });

  it('should return undefined for undefined history', () => {
    const recent = getMostRecentVersion(undefined);
    expect(recent).toBeUndefined();
  });
});

describe('canUndo helper', () => {
  it('should return true when history has entries', () => {
    const history = [createVersionEntry({}, 'user')];
    expect(canUndo(history)).toBe(true);
  });

  it('should return false for empty history', () => {
    expect(canUndo([])).toBe(false);
  });

  it('should return false for null history', () => {
    expect(canUndo(null)).toBe(false);
  });

  it('should return false for undefined history', () => {
    expect(canUndo(undefined)).toBe(false);
  });
});
