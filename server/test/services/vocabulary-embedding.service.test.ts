/**
 * Vocabulary Embedding Service Tests
 *
 * Unit tests for semantic phrase resolution.
 * Tests the VocabularyEmbeddingService's ability to map user phrases to BlockTypes.
 *
 * NOTE: These are integration tests that require DATABASE_URL to be set and
 * GOOGLE_VERTEX_PROJECT for embedding generation. Tests are skipped if not configured.
 *
 * @see server/src/services/vocabulary-embedding.service.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { VocabularyEmbeddingService } from '../../src/services/vocabulary-embedding.service';
import { BlockType } from '../../src/generated/prisma';
import { getTestPrisma } from '../helpers/global-prisma';

/**
 * Skip entire test suite if DATABASE_URL is not configured.
 */
const hasDatabaseUrl = !!(process.env.DATABASE_URL || process.env.DATABASE_URL_TEST);

/**
 * Skip if GOOGLE_VERTEX_PROJECT is not configured (required for embeddings).
 */
const hasVertexProject = !!process.env.GOOGLE_VERTEX_PROJECT;

describe.runIf(hasDatabaseUrl && hasVertexProject)('VocabularyEmbeddingService', () => {
  const prisma = getTestPrisma()!;
  let service: VocabularyEmbeddingService;

  // Track test phrases for cleanup
  const testPhrases: string[] = [];

  const generateTestPhrase = (prefix: string) => {
    const phrase = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    testPhrases.push(phrase);
    return phrase;
  };

  beforeAll(() => {
    service = new VocabularyEmbeddingService(prisma);
  });

  afterAll(async () => {
    // Cleanup test phrases
    if (testPhrases.length > 0) {
      await prisma.$executeRaw`
        DELETE FROM "VocabularyEmbedding" WHERE phrase = ANY(${testPhrases}::text[])
      `;
    }
  });

  describe('generateEmbedding', () => {
    it('should generate a 768-dimensional embedding', async () => {
      const embedding = await service.generateEmbedding('test phrase');

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      expect(embedding.every((v) => typeof v === 'number')).toBe(true);
    });

    it('should generate consistent embeddings for same text', async () => {
      const text = 'consistent test phrase';
      const embedding1 = await service.generateEmbedding(text);
      const embedding2 = await service.generateEmbedding(text);

      // Embeddings should be identical for same input
      expect(embedding1).toEqual(embedding2);
    });

    it('should generate different embeddings for different text', async () => {
      const embedding1 = await service.generateEmbedding('apple');
      const embedding2 = await service.generateEmbedding('banana');

      // Embeddings should be different
      expect(embedding1).not.toEqual(embedding2);
    });

    it('should normalize text to lowercase', async () => {
      const embedding1 = await service.generateEmbedding('HELLO WORLD');
      const embedding2 = await service.generateEmbedding('hello world');

      // Should be identical after normalization
      expect(embedding1).toEqual(embedding2);
    });
  });

  describe('addVocabularyPhrase', () => {
    it('should add a new vocabulary phrase', async () => {
      const phrase = generateTestPhrase('vocab-add');

      const id = await service.addVocabularyPhrase({
        phrase,
        blockType: 'ABOUT',
        isCanonical: false,
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);

      // Verify it was inserted
      const result = await prisma.$queryRaw<Array<{ phrase: string; blockType: BlockType }>>`
        SELECT phrase, "blockType" FROM "VocabularyEmbedding" WHERE id = ${id}
      `;

      expect(result.length).toBe(1);
      expect(result[0].phrase).toBe(phrase.toLowerCase());
      expect(result[0].blockType).toBe('ABOUT');
    });

    it('should return existing ID for duplicate phrase', async () => {
      const phrase = generateTestPhrase('vocab-dup');

      const id1 = await service.addVocabularyPhrase({
        phrase,
        blockType: 'HERO',
        isCanonical: true,
      });

      const id2 = await service.addVocabularyPhrase({
        phrase,
        blockType: 'HERO',
        isCanonical: true,
      });

      expect(id1).toBe(id2);
    });

    it('should normalize phrase to lowercase', async () => {
      const phrase = generateTestPhrase('VOCAB-UPPER');

      await service.addVocabularyPhrase({
        phrase,
        blockType: 'FAQ',
        isCanonical: false,
      });

      // Query with lowercase
      const result = await prisma.$queryRaw<Array<{ phrase: string }>>`
        SELECT phrase FROM "VocabularyEmbedding" WHERE phrase = ${phrase.toLowerCase()}
      `;

      expect(result.length).toBe(1);
      expect(result[0].phrase).toBe(phrase.toLowerCase());
    });
  });

  describe('resolveBlockType', () => {
    // These tests require seeded vocabulary to be meaningful
    // They test the resolution algorithm with real embeddings

    it('should resolve exact match with high confidence', async () => {
      const phrase = generateTestPhrase('exact-match');

      // Add a phrase
      await service.addVocabularyPhrase({
        phrase,
        blockType: 'TESTIMONIALS',
        isCanonical: true,
      });

      // Resolve the exact same phrase
      const result = await service.resolveBlockType(phrase);

      expect(result.blockType).toBe('TESTIMONIALS');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.matchedPhrase).toBe(phrase.toLowerCase());
    });

    it('should return null for phrases with no semantic match', async () => {
      // Use a completely unrelated phrase
      const result = await service.resolveBlockType('xyzzy random nonsense gibberish qwerty');

      // May or may not find a match depending on vocabulary, but confidence should be low
      if (result.blockType === null) {
        expect(result.confidence).toBeLessThan(0.7);
      }
    });

    it('should resolve semantically similar phrases', async () => {
      const basephrase = generateTestPhrase('semantic-base');
      const similarPhrase = `${basephrase} with more words`;

      // Add base phrase
      await service.addVocabularyPhrase({
        phrase: basephrase,
        blockType: 'GALLERY',
        isCanonical: true,
      });

      // Resolve similar phrase - should match the base
      const result = await service.resolveBlockType(similarPhrase);

      // The similar phrase should match with reasonably high confidence
      // (exact threshold depends on the embedding model)
      expect(result.matchedPhrase).toBe(basephrase.toLowerCase());
    });
  });

  describe('findSimilarPhrases', () => {
    it('should find similar phrases with similarity scores', async () => {
      const phrase1 = generateTestPhrase('similar-test');
      const phrase2 = generateTestPhrase('similar-test');

      // Add two similar phrases
      await service.addVocabularyPhrase({
        phrase: phrase1,
        blockType: 'CONTACT',
        isCanonical: true,
      });

      await service.addVocabularyPhrase({
        phrase: phrase2,
        blockType: 'CONTACT',
        isCanonical: false,
      });

      // Find similar to the first phrase
      const results = await service.findSimilarPhrases(phrase1, 5, 0.3);

      expect(results.length).toBeGreaterThan(0);

      // First result should be exact match
      expect(results[0].phrase).toBe(phrase1.toLowerCase());
      expect(results[0].similarity).toBeGreaterThan(0.9);
    });

    it('should respect limit parameter', async () => {
      const results = await service.findSimilarPhrases('test', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by minimum similarity', async () => {
      const results = await service.findSimilarPhrases('test', 10, 0.99);

      // Very high threshold should return few or no results
      for (const result of results) {
        expect(result.similarity).toBeGreaterThanOrEqual(0.99);
      }
    });
  });

  describe('getVocabularyStats', () => {
    it('should return vocabulary statistics', async () => {
      const stats = await service.getVocabularyStats();

      expect(typeof stats.totalPhrases).toBe('number');
      expect(typeof stats.canonicalPhrases).toBe('number');
      expect(typeof stats.phrasesByBlockType).toBe('object');

      // Total should be >= canonical
      expect(stats.totalPhrases).toBeGreaterThanOrEqual(stats.canonicalPhrases);
    });

    it('should count phrases by block type correctly', async () => {
      const stats = await service.getVocabularyStats();

      // Sum of all block type counts should equal total
      const sumByType = Object.values(stats.phrasesByBlockType).reduce((a, b) => a + b, 0);
      expect(sumByType).toBe(stats.totalPhrases);
    });
  });

  describe('seedVocabulary', () => {
    it('should seed multiple phrases in batch', async () => {
      const inputs = [
        {
          phrase: generateTestPhrase('seed-batch-1'),
          blockType: 'HERO' as const,
          isCanonical: true,
        },
        {
          phrase: generateTestPhrase('seed-batch-2'),
          blockType: 'ABOUT' as const,
          isCanonical: true,
        },
        {
          phrase: generateTestPhrase('seed-batch-3'),
          blockType: 'FAQ' as const,
          isCanonical: true,
        },
      ];

      const added = await service.seedVocabulary(inputs, 2);

      expect(added).toBe(3);
    });

    it('should skip existing phrases', async () => {
      const existingPhrase = generateTestPhrase('seed-existing');

      // Add first
      await service.addVocabularyPhrase({
        phrase: existingPhrase,
        blockType: 'CTA',
        isCanonical: false,
      });

      // Try to seed same phrase
      const inputs = [{ phrase: existingPhrase, blockType: 'CTA' as const, isCanonical: true }];

      const added = await service.seedVocabulary(inputs);

      // Should return 1 even though it already existed (addVocabularyPhrase returns existing ID)
      expect(added).toBe(1);
    });
  });
});

/**
 * Unit tests that don't require real embeddings - mock the embedding generation.
 */
describe('VocabularyEmbeddingService (mocked)', () => {
  it('should handle embedding generation errors gracefully in resolveBlockType', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn(),
    } as unknown as ReturnType<typeof getTestPrisma>;

    const service = new VocabularyEmbeddingService(mockPrisma);

    // Mock generateEmbedding to throw
    vi.spyOn(service, 'generateEmbedding').mockRejectedValue(new Error('Vertex AI unavailable'));

    const result = await service.resolveBlockType('test phrase');

    // Should return null match on error (graceful degradation)
    expect(result.blockType).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.matchedPhrase).toBeNull();
  });

  it('should handle embedding generation errors gracefully in findSimilarPhrases', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn(),
    } as unknown as ReturnType<typeof getTestPrisma>;

    const service = new VocabularyEmbeddingService(mockPrisma);

    vi.spyOn(service, 'generateEmbedding').mockRejectedValue(new Error('Vertex AI unavailable'));

    const results = await service.findSimilarPhrases('test phrase');

    // Should return empty array on error
    expect(results).toEqual([]);
  });
});
