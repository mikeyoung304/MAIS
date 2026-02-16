import { describe, it, expect } from 'vitest';
import { slugify } from './internal-agent-shared';

describe('slugify', () => {
  it('converts text to lowercase slug', () => {
    expect(slugify('My Business Name')).toBe('my-business-name');
  });

  it('replaces & with "and"', () => {
    expect(slugify('Ember & Ash Photography')).toBe('ember-and-ash-photography');
  });

  it('handles HTML-encoded &amp;', () => {
    expect(slugify('Ember &amp; Ash Photography')).toBe('ember-and-ash-photography');
  });

  it('handles HTML-encoded entities', () => {
    expect(slugify('Smith &lt;3 Co')).toBe('smith-3-co');
    expect(slugify('A &gt; B')).toBe('a-b');
    expect(slugify('&quot;Quoted&quot;')).toBe('quoted');
  });

  it('strips leading and trailing dashes', () => {
    expect(slugify('-hello-world-')).toBe('hello-world');
  });

  it('truncates to 50 chars', () => {
    const long = 'a'.repeat(60);
    expect(slugify(long).length).toBeLessThanOrEqual(50);
  });

  it('collapses multiple non-alphanumeric chars into single dash', () => {
    expect(slugify('hello   world')).toBe('hello-world');
    expect(slugify('hello---world')).toBe('hello-world');
  });
});
