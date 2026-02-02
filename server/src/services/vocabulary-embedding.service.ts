/**
 * Vocabulary Embedding Service
 *
 * Enterprise-grade semantic phrase resolution using pgvector embeddings.
 * Maps user natural language phrases to canonical BlockType identifiers.
 *
 * Architecture:
 * - Uses Vertex AI text-embedding-005 model (768 dimensions)
 * - Embeddings stored in PostgreSQL with pgvector extension
 * - IVFFlat indexing for fast similarity search
 * - Cosine similarity with configurable confidence threshold
 *
 * Design notes:
 * - The service is stateless and uses dependency injection for Prisma
 * - Embedding generation has a 15-second timeout (per pitfall #46)
 * - Results are cached at the database level via pgvector indexes
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import type { PrismaClient, BlockType } from '../generated/prisma';
import { getVertexClient } from '../llm/vertex-client';
import { logger } from '../lib/core/logger';
import { createId } from '@paralleldrive/cuid2';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vertex AI embedding model for semantic search.
 *
 * text-embedding-005 is the latest GA model with:
 * - 768 dimensions (matches our VocabularyEmbedding.embedding column)
 * - Multilingual support
 * - Task type optimization
 *
 * @see https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings
 */
const EMBEDDING_MODEL = 'text-embedding-005';

/**
 * Minimum similarity score to consider a match valid.
 * Cosine similarity ranges from -1 to 1, where 1 is identical.
 * 0.7 is a conservative threshold that balances precision and recall.
 */
const MINIMUM_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Timeout for embedding generation requests (15 seconds per pitfall #46).
 */
const EMBEDDING_TIMEOUT_MS = 15_000;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VocabularyMatch {
  blockType: BlockType | null;
  confidence: number;
  matchedPhrase: string | null;
}

export interface VocabularyEmbeddingInput {
  phrase: string;
  blockType: BlockType;
  isCanonical?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class VocabularyEmbeddingService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate embedding vector for a text phrase.
   *
   * Uses Vertex AI's text-embedding-005 model optimized for semantic retrieval.
   *
   * @param text - The text to embed (normalized to lowercase)
   * @returns 768-dimensional embedding vector
   * @throws Error if embedding generation fails or times out
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const normalizedText = text.toLowerCase().trim();

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

    try {
      const client = getVertexClient();
      const model = client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: normalizedText,
        config: {
          taskType: 'SEMANTIC_SIMILARITY',
        },
      });

      // Race against timeout
      const result = await Promise.race([
        model,
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`Embedding generation timed out after ${EMBEDDING_TIMEOUT_MS}ms`));
          });
        }),
      ]);

      clearTimeout(timeoutId);

      if (!result.embeddings || result.embeddings.length === 0) {
        throw new Error('No embedding returned from Vertex AI');
      }

      const embedding = result.embeddings[0].values;
      if (!embedding || embedding.length === 0) {
        throw new Error('Empty embedding values returned from Vertex AI');
      }

      logger.debug(
        { textLength: normalizedText.length, embeddingDimensions: embedding.length },
        'Generated embedding'
      );

      return embedding;
    } catch (error) {
      clearTimeout(timeoutId);
      logger.error({ error, text: normalizedText }, 'Failed to generate embedding');
      throw error;
    }
  }

  /**
   * Resolve a user phrase to its most likely BlockType using semantic similarity.
   *
   * This is the core vocabulary resolution method that enables natural language
   * section references like "my story" → ABOUT or "reviews" → TESTIMONIALS.
   *
   * Algorithm:
   * 1. Generate embedding for user phrase
   * 2. Query pgvector for nearest neighbor using cosine distance
   * 3. Return match if similarity exceeds threshold, null otherwise
   *
   * @param userPhrase - Natural language phrase from user (e.g., "update my bio")
   * @returns Match result with blockType, confidence score, and matched canonical phrase
   */
  async resolveBlockType(userPhrase: string): Promise<VocabularyMatch> {
    const normalizedPhrase = userPhrase.toLowerCase().trim();

    try {
      const embedding = await this.generateEmbedding(normalizedPhrase);
      const vectorString = this.formatVectorForPg(embedding);

      // Query pgvector for nearest neighbor using cosine distance
      // The <=> operator computes cosine distance (1 - similarity)
      // So we compute similarity as 1 - distance
      const result = await this.prisma.$queryRaw<
        Array<{
          blockType: BlockType;
          phrase: string;
          similarity: number;
        }>
      >`
        SELECT
          "blockType",
          phrase,
          1 - (embedding <=> ${vectorString}::vector) as similarity
        FROM "VocabularyEmbedding"
        ORDER BY embedding <=> ${vectorString}::vector
        LIMIT 1
      `;

      if (result.length === 0) {
        logger.debug({ phrase: normalizedPhrase }, 'No vocabulary matches found');
        return { blockType: null, confidence: 0, matchedPhrase: null };
      }

      const match = result[0];

      if (match.similarity < MINIMUM_CONFIDENCE_THRESHOLD) {
        logger.debug(
          {
            phrase: normalizedPhrase,
            similarity: match.similarity,
            threshold: MINIMUM_CONFIDENCE_THRESHOLD,
          },
          'Match below confidence threshold'
        );
        return { blockType: null, confidence: match.similarity, matchedPhrase: null };
      }

      logger.info(
        {
          userPhrase: normalizedPhrase,
          matchedPhrase: match.phrase,
          blockType: match.blockType,
          confidence: match.similarity,
        },
        'Vocabulary phrase resolved'
      );

      return {
        blockType: match.blockType,
        confidence: match.similarity,
        matchedPhrase: match.phrase,
      };
    } catch (error) {
      logger.error({ error, phrase: normalizedPhrase }, 'Failed to resolve vocabulary');
      // Return null match on error rather than throwing - graceful degradation
      return { blockType: null, confidence: 0, matchedPhrase: null };
    }
  }

  /**
   * Find all phrases similar to a given phrase, ranked by similarity.
   *
   * Useful for debugging, analytics, and suggesting alternatives.
   *
   * @param phrase - The phrase to search for
   * @param limit - Maximum number of results (default 5)
   * @param minSimilarity - Minimum similarity threshold (default 0.5)
   * @returns Array of matches sorted by similarity descending
   */
  async findSimilarPhrases(
    phrase: string,
    limit: number = 5,
    minSimilarity: number = 0.5
  ): Promise<
    Array<{ phrase: string; blockType: BlockType; similarity: number; isCanonical: boolean }>
  > {
    const normalizedPhrase = phrase.toLowerCase().trim();

    try {
      const embedding = await this.generateEmbedding(normalizedPhrase);
      const vectorString = this.formatVectorForPg(embedding);

      const results = await this.prisma.$queryRaw<
        Array<{
          phrase: string;
          blockType: BlockType;
          similarity: number;
          isCanonical: boolean;
        }>
      >`
        SELECT
          phrase,
          "blockType",
          1 - (embedding <=> ${vectorString}::vector) as similarity,
          "isCanonical"
        FROM "VocabularyEmbedding"
        WHERE 1 - (embedding <=> ${vectorString}::vector) >= ${minSimilarity}
        ORDER BY embedding <=> ${vectorString}::vector
        LIMIT ${limit}
      `;

      return results;
    } catch (error) {
      logger.error({ error, phrase: normalizedPhrase }, 'Failed to find similar phrases');
      return [];
    }
  }

  /**
   * Format embedding array for pgvector.
   *
   * pgvector expects vectors in the format '[0.1, 0.2, ...]' not PostgreSQL array format.
   * Prisma's raw queries would pass arrays as '{0.1, 0.2}' which pgvector rejects.
   */
  private formatVectorForPg(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  /**
   * Add a new vocabulary phrase with its embedding.
   *
   * Used for:
   * - Seeding canonical vocabulary during setup
   * - Learning new phrases from user interactions
   *
   * @param input - Phrase, blockType, and whether it's canonical
   * @returns The created vocabulary embedding ID
   */
  async addVocabularyPhrase(input: VocabularyEmbeddingInput): Promise<string> {
    const normalizedPhrase = input.phrase.toLowerCase().trim();

    // Check if phrase already exists
    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "VocabularyEmbedding" WHERE phrase = ${normalizedPhrase}
    `;

    if (existing.length > 0) {
      logger.debug({ phrase: normalizedPhrase }, 'Vocabulary phrase already exists');
      return existing[0].id;
    }

    const embedding = await this.generateEmbedding(normalizedPhrase);
    const vectorString = this.formatVectorForPg(embedding);
    const id = createId();

    await this.prisma.$executeRaw`
      INSERT INTO "VocabularyEmbedding" (id, phrase, "blockType", embedding, "isCanonical", "createdAt")
      VALUES (
        ${id},
        ${normalizedPhrase},
        ${input.blockType}::"BlockType",
        ${vectorString}::vector,
        ${input.isCanonical ?? false},
        NOW()
      )
    `;

    logger.info(
      { id, phrase: normalizedPhrase, blockType: input.blockType, isCanonical: input.isCanonical },
      'Added vocabulary phrase'
    );

    return id;
  }

  /**
   * Bulk add vocabulary phrases (optimized for seeding).
   *
   * Processes phrases in batches to avoid overwhelming the embedding API.
   *
   * @param inputs - Array of vocabulary inputs
   * @param batchSize - Number of phrases per batch (default 10)
   * @returns Number of phrases successfully added
   */
  async seedVocabulary(
    inputs: VocabularyEmbeddingInput[],
    batchSize: number = 10
  ): Promise<number> {
    let added = 0;

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);

      for (const input of batch) {
        try {
          await this.addVocabularyPhrase(input);
          added++;
        } catch (error) {
          logger.error({ error, phrase: input.phrase }, 'Failed to seed vocabulary phrase');
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < inputs.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.info(
      { totalAdded: added, totalRequested: inputs.length },
      'Vocabulary seeding complete'
    );
    return added;
  }

  /**
   * Get statistics about the vocabulary database.
   *
   * Useful for monitoring and debugging.
   */
  async getVocabularyStats(): Promise<{
    totalPhrases: number;
    canonicalPhrases: number;
    phrasesByBlockType: Record<string, number>;
  }> {
    const [total, canonical, byBlockType] = await Promise.all([
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "VocabularyEmbedding"
      `,
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "VocabularyEmbedding" WHERE "isCanonical" = true
      `,
      this.prisma.$queryRaw<Array<{ blockType: BlockType; count: bigint }>>`
        SELECT "blockType", COUNT(*) as count
        FROM "VocabularyEmbedding"
        GROUP BY "blockType"
      `,
    ]);

    const phrasesByBlockType: Record<string, number> = {};
    for (const row of byBlockType) {
      phrasesByBlockType[row.blockType] = Number(row.count);
    }

    return {
      totalPhrases: Number(total[0].count),
      canonicalPhrases: Number(canonical[0].count),
      phrasesByBlockType,
    };
  }
}
