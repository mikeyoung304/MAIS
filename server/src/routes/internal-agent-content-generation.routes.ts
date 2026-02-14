/**
 * Internal Agent Content Generation Routes — Aggregator
 *
 * Composes domain-specific content generation route files:
 * - Variant generation (Vertex AI tone variants)
 * - Segment management (CRUD)
 * - Tier management (CRUD)
 * - AddOn management (CRUD)
 * - Vocabulary resolution (semantic section type matching) — kept inline
 *
 * Called by: tenant-agent
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import { verifyInternalSecret, handleError } from './internal-agent-shared';
import type { MarketingRoutesDeps } from './internal-agent-shared';
import { registerVariantRoutes } from './internal-agent-content-variants.routes';
import { registerSegmentRoutes } from './internal-agent-content-segments.routes';
import { registerTierRoutes } from './internal-agent-content-tiers.routes';
import { registerAddonRoutes } from './internal-agent-content-addons.routes';

// =============================================================================
// Schemas (vocabulary/resolve — kept inline, ~30 lines)
// =============================================================================

const ResolveVocabularySchema = z.object({
  phrase: z.string().min(1).max(200, 'phrase must be 200 characters or less'),
  tenantId: z.string().optional(), // Optional for logging/analytics
});

// =============================================================================
// Aggregator
// =============================================================================

/**
 * Create internal agent content generation routes.
 * Mounted at `/content-generation` by the aggregator.
 */
export function createInternalAgentContentGenerationRoutes(deps: MarketingRoutesDeps): Router {
  const router = Router();
  const { vocabularyEmbeddingService, internalApiSecret } = deps;

  router.use(verifyInternalSecret(internalApiSecret));

  // Register domain-specific routes
  registerVariantRoutes(router, deps);
  registerSegmentRoutes(router, deps);
  registerTierRoutes(router, deps);
  registerAddonRoutes(router, deps);

  // POST /vocabulary/resolve - Resolve natural language phrase to BlockType
  // Uses VocabularyEmbeddingService for semantic matching (e.g., "my bio" -> ABOUT)
  router.post('/vocabulary/resolve', async (req: Request, res: Response) => {
    try {
      if (!vocabularyEmbeddingService) {
        res.status(503).json({
          error: 'Vocabulary embedding service not available',
          blockType: null,
          confidence: 0,
          matchedPhrase: null,
        });
        return;
      }

      const { phrase, tenantId } = ResolveVocabularySchema.parse(req.body);

      logger.info(
        { phrase, tenantId, endpoint: '/vocabulary/resolve' },
        '[Agent] Resolving vocabulary phrase'
      );

      const result = await vocabularyEmbeddingService.resolveBlockType(phrase);

      res.json({
        blockType: result.blockType,
        confidence: result.confidence,
        matchedPhrase: result.matchedPhrase,
      });
    } catch (error) {
      handleError(res, error, '/vocabulary/resolve');
    }
  });

  return router;
}
