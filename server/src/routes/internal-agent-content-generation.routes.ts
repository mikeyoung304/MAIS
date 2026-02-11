/**
 * Internal Agent Content Generation Routes
 *
 * AI content generation and management tools for the tenant agent:
 * - Section variant generation (Vertex AI)
 * - Package management (CRUD on bookable packages)
 * - Vocabulary resolution (semantic section type matching)
 *
 * Called by: tenant-agent
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { LRUCache } from 'lru-cache';
import { logger } from '../lib/core/logger';
import {
  verifyInternalSecret,
  handleError,
  TenantIdSchema,
  SECTION_TYPES,
} from './internal-agent-shared';
import type { MarketingRoutesDeps } from './internal-agent-shared';

// =============================================================================
// Schemas
// =============================================================================

const TONE_VARIANTS = ['professional', 'premium', 'friendly'] as const;

const GenerateSectionVariantsSchema = TenantIdSchema.extend({
  sectionId: z.string().min(1, 'sectionId is required'),
  sectionType: z.enum(SECTION_TYPES),
  currentContent: z.object({
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    content: z.string().optional(),
    ctaText: z.string().optional(),
  }),
  tones: z.array(z.enum(TONE_VARIANTS)).default(['professional', 'premium', 'friendly']),
});

const ManagePackagesSchema = TenantIdSchema.extend({
  action: z.enum(['list', 'create', 'update', 'delete']),
  // Create fields
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priceCents: z.number().min(100, 'Price must be at least $1 (100 cents)').optional(),
  // Update/Delete fields
  packageId: z.string().min(1).optional(),
});

// Vocabulary Resolution (for Tenant Agent)
const ResolveVocabularySchema = z.object({
  phrase: z.string().min(1).max(200, 'phrase must be 200 characters or less'),
  tenantId: z.string().optional(), // Optional for logging/analytics
});

// Lazy import Vertex client to avoid startup issues if not configured
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let vertexClientPromise: Promise<typeof import('../llm/vertex-client')> | null = null;
async function getVertexModule() {
  if (!vertexClientPromise) {
    vertexClientPromise = import('../llm/vertex-client');
  }
  return vertexClientPromise;
}

function buildVariantGenerationPrompt(
  sectionType: string,
  currentContent: { headline?: string; subheadline?: string; content?: string; ctaText?: string },
  businessContext: { name: string; industry: string },
  tones: readonly string[]
): string {
  const businessName = businessContext.name || 'the business';
  const industry = businessContext.industry || 'service';

  const toneDescriptions: Record<string, string> = {
    professional: 'Clean, authoritative, confidence-inspiring. Direct and results-focused.',
    premium: 'Elegant, exclusive, refined. Emphasizes quality and unique value.',
    friendly: 'Warm, approachable, conversational. Like talking to a trusted friend.',
  };

  const toneList = tones.map((t) => `- ${t}: ${toneDescriptions[t] || t}`).join('\n');

  const currentFields = Object.entries(currentContent)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: "${v}"`)
    .join('\n');

  return `You are a marketing copywriter for ${businessName}, a ${industry} business.

Generate 3 different versions of this ${sectionType} section content, each in a different tone.

CURRENT CONTENT:
${currentFields || 'No current content - generate from scratch for a typical business in this industry.'}

REQUIRED TONES:
${toneList}

Return ONLY valid JSON with this exact structure:
{
  "variants": {
    "${tones[0]}": {
      "headline": "...",
      "subheadline": "...",
      "content": "...",
      "ctaText": "..."
    },
    "${tones[1]}": {
      "headline": "...",
      "subheadline": "...",
      "content": "...",
      "ctaText": "..."
    },
    "${tones[2]}": {
      "headline": "...",
      "subheadline": "...",
      "content": "...",
      "ctaText": "..."
    }
  },
  "recommendation": "${tones[0]}",
  "rationale": "Brief 1-2 sentence explanation of why this tone fits best."
}

RULES:
- Headlines: Under 10 words, impactful, no clichés
- Subheadlines: 1-2 sentences, supports the headline
- Content: 2-4 sentences for the section body
- CTA: 2-4 words, action-oriented
- Recommendation: Choose the tone that best fits ${industry} businesses
- NEVER use overused phrases like "passion for excellence" or unsubstantiated superlatives`;
}

/**
 * Create internal agent content generation routes.
 * Mounted at `/content-generation` by the aggregator.
 */
export function createInternalAgentContentGenerationRoutes(deps: MarketingRoutesDeps): Router {
  const router = Router();
  const { tenantRepo, catalogService, vocabularyEmbeddingService, internalApiSecret } = deps;

  router.use(verifyInternalSecret(internalApiSecret));

  // Rate limiting for variant generation: 10 requests per minute per tenant
  // Memory footprint: ~80 KB (1000 entries × ~80 bytes per rate limit state)
  const variantGenerationRateLimit = new LRUCache<string, { count: number; resetAt: number }>({
    max: 1000,
    ttl: 60_000, // 1 minute
  });

  // POST /generate-variants - Generate tone variants for a section
  router.post('/generate-variants', async (req: Request, res: Response) => {
    try {
      const params = GenerateSectionVariantsSchema.parse(req.body);
      const { tenantId, sectionId, sectionType, currentContent, tones } = params;

      logger.info(
        { tenantId, sectionId, sectionType, tones, endpoint: '/marketing/generate-variants' },
        '[Agent] Generating section variants'
      );

      // Rate limiting: 10 requests per minute per tenant
      const rateLimitKey = `variant-gen:${tenantId}`;
      const rateState = variantGenerationRateLimit.get(rateLimitKey);
      const now = Date.now();

      if (rateState) {
        if (now < rateState.resetAt && rateState.count >= 10) {
          const waitSeconds = Math.ceil((rateState.resetAt - now) / 1000);
          res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Too many variant generation requests. Please wait ${waitSeconds} seconds.`,
            retryAfter: waitSeconds,
          });
          return;
        }
        // Increment count
        variantGenerationRateLimit.set(rateLimitKey, {
          count: now >= rateState.resetAt ? 1 : rateState.count + 1,
          resetAt: now >= rateState.resetAt ? now + 60_000 : rateState.resetAt,
        });
      } else {
        variantGenerationRateLimit.set(rateLimitKey, { count: 1, resetAt: now + 60_000 });
      }

      // Get business context
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const branding = (tenant.branding as Record<string, unknown>) || {};
      const businessContext = {
        name: tenant.name,
        industry: (branding.businessType as string) || (branding.industry as string) || 'service',
      };

      // Generate variants using Vertex AI
      const vertexModule = await getVertexModule();
      const client = vertexModule.getVertexClient();
      const prompt = buildVariantGenerationPrompt(
        sectionType,
        currentContent,
        businessContext,
        tones
      );

      const response = await client.models.generateContent({
        model: vertexModule.DEFAULT_MODEL,
        contents: prompt,
        config: {
          temperature: 0.8, // Higher for creative diversity
          maxOutputTokens: 2048,
        },
      });

      const text = response.text || '';

      // Parse JSON from response
      let result: {
        variants: Record<
          string,
          { headline?: string; subheadline?: string; content?: string; ctaText?: string }
        >;
        recommendation: string;
        rationale: string;
      };

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.warn(
          { parseError, textPreview: text.substring(0, 300) },
          '[Variants] Failed to parse JSON'
        );
        // Return error - don't use fallback for this critical feature
        res.status(500).json({
          error: 'Failed to generate variants',
          message: 'The AI response could not be parsed. Please try again.',
        });
        return;
      }

      // Sanitize the generated content (XSS prevention - Blocking Issue B4)
      const { sanitizeObject } = await import('../lib/sanitization');
      const sanitizedVariants = sanitizeObject(result.variants, {
        allowHtml: ['content'], // Allow basic HTML in content field only
      });

      res.json({
        success: true,
        sectionId,
        sectionType,
        variants: sanitizedVariants,
        recommendation: result.recommendation,
        rationale: result.rationale,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      handleError(res, error, '/marketing/generate-variants');
    }
  });

  // POST /manage-packages - CRUD on actual bookable packages (price >= $1)
  // Called by: Tenant Agent's manage_packages tool
  router.post('/manage-packages', async (req: Request, res: Response) => {
    try {
      const params = ManagePackagesSchema.parse(req.body);
      const { tenantId, action } = params;

      logger.info(
        { tenantId, action, endpoint: '/manage-packages' },
        '[Agent] Package management request'
      );

      // Verify tenant exists
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      switch (action) {
        case 'list': {
          const packages = await catalogService.getAllPackages(tenantId);
          const formatted = packages.map((pkg) => ({
            id: pkg.id,
            name: pkg.title || pkg.name || 'Unnamed Package',
            description: pkg.description || '',
            priceInDollars: Math.round((pkg.priceCents || pkg.basePrice || 0) / 100),
            slug: pkg.slug,
            active: pkg.active !== false,
          }));

          res.json({
            packages: formatted,
            totalCount: formatted.length,
          });
          return;
        }

        case 'create': {
          // Validate required create fields
          if (!params.slug || !params.title || !params.priceCents) {
            res.status(400).json({
              error: 'Missing required fields for create: slug, title, priceCents',
            });
            return;
          }

          // P0 FIX: Enforce minimum price to prevent $0 booking path
          if (params.priceCents < 100) {
            res.status(400).json({
              error: 'Price must be at least $1 (100 cents). Free packages are not allowed.',
            });
            return;
          }

          const newPackage = await catalogService.createPackage(tenantId, {
            slug: params.slug,
            title: params.title,
            description: params.description || '',
            priceCents: params.priceCents,
          });

          // Get updated count for verification
          const allPackages = await catalogService.getAllPackages(tenantId);

          logger.info(
            { tenantId, packageId: newPackage.id, name: newPackage.title },
            '[Agent] Package created'
          );

          res.json({
            package: {
              id: newPackage.id,
              name: newPackage.title || newPackage.name,
              description: newPackage.description,
              priceInDollars: Math.round(
                (newPackage.priceCents || newPackage.basePrice || 0) / 100
              ),
              slug: newPackage.slug,
            },
            totalCount: allPackages.length,
          });
          return;
        }

        case 'update': {
          if (!params.packageId) {
            res.status(400).json({ error: 'packageId is required for update' });
            return;
          }

          // SECURITY: Verify package belongs to tenant (pitfall #816)
          const existingPkg = await catalogService.getPackageById(tenantId, params.packageId);
          if (!existingPkg) {
            res.status(404).json({ error: 'Package not found' });
            return;
          }

          // P0 FIX: Enforce minimum price if updating price
          if (params.priceCents !== undefined && params.priceCents < 100) {
            res.status(400).json({
              error: 'Price must be at least $1 (100 cents). Free packages are not allowed.',
            });
            return;
          }

          // Build update payload (only include provided fields)
          const updateData: {
            slug?: string;
            title?: string;
            description?: string;
            priceCents?: number;
          } = {};

          if (params.slug) updateData.slug = params.slug;
          if (params.title) updateData.title = params.title;
          if (params.description) updateData.description = params.description;
          if (params.priceCents !== undefined) updateData.priceCents = params.priceCents;

          const updatedPackage = await catalogService.updatePackage(
            tenantId,
            params.packageId,
            updateData
          );

          const allPackages = await catalogService.getAllPackages(tenantId);

          logger.info(
            { tenantId, packageId: updatedPackage.id, updates: Object.keys(updateData) },
            '[Agent] Package updated'
          );

          res.json({
            package: {
              id: updatedPackage.id,
              name: updatedPackage.title || updatedPackage.name,
              description: updatedPackage.description,
              priceInDollars: Math.round(
                (updatedPackage.priceCents || updatedPackage.basePrice || 0) / 100
              ),
              slug: updatedPackage.slug,
            },
            totalCount: allPackages.length,
          });
          return;
        }

        case 'delete': {
          if (!params.packageId) {
            res.status(400).json({ error: 'packageId is required for delete' });
            return;
          }

          // SECURITY: Verify package belongs to tenant (pitfall #816)
          const existingPkg = await catalogService.getPackageById(tenantId, params.packageId);
          if (!existingPkg) {
            res.status(404).json({ error: 'Package not found' });
            return;
          }

          await catalogService.deletePackage(tenantId, params.packageId);

          const remainingPackages = await catalogService.getAllPackages(tenantId);

          logger.info({ tenantId, deletedPackageId: params.packageId }, '[Agent] Package deleted');

          res.json({
            deletedId: params.packageId,
            totalCount: remainingPackages.length,
          });
          return;
        }

        default:
          res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      handleError(res, error, '/manage-packages');
    }
  });

  // POST /vocabulary/resolve - Resolve natural language phrase to BlockType
  // Uses VocabularyEmbeddingService for semantic matching (e.g., "my bio" → ABOUT)
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
