/**
 * Internal Agent Content Generation Routes
 *
 * AI content generation and management tools for the tenant agent:
 * - Section variant generation (Vertex AI)
 * - Segment management (CRUD on client segments)
 * - Tier management (CRUD on bookable pricing tiers)
 * - AddOn management (CRUD on service add-ons)
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
// Constants
// =============================================================================

const MAX_SEGMENTS_PER_TENANT = 5;
const MAX_TIERS_PER_SEGMENT = 5;

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

const ManageSegmentsSchema = TenantIdSchema.extend({
  action: z.enum(['list', 'create', 'update', 'delete']),
  segmentId: z.string().min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).optional(),
  active: z.boolean().optional(),
});

const ManageTiersSchema = TenantIdSchema.extend({
  action: z.enum(['list', 'create', 'update', 'delete']),
  tierId: z.string().min(1).optional(),
  segmentId: z.string().min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(2000).optional(),
  priceCents: z.number().min(100, 'Price must be at least $1 (100 cents)').optional(),
  features: z.array(z.unknown()).optional(),
  sortOrder: z.number().min(1).max(99).optional(),
  bookingType: z.enum(['DATE', 'TIMESLOT']).optional(),
  durationMinutes: z.number().min(1).optional(),
  active: z.boolean().optional(),
});

const ManageAddOnsSchema = TenantIdSchema.extend({
  action: z.enum(['list', 'create', 'update', 'delete']),
  addOnId: z.string().min(1).optional(),
  segmentId: z.string().min(1).nullable().optional(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(2000).optional(),
  priceCents: z.number().min(0).optional(),
  active: z.boolean().optional(),
});

// Vocabulary Resolution (for Tenant Agent)
const ResolveVocabularySchema = z.object({
  phrase: z.string().min(1).max(200, 'phrase must be 200 characters or less'),
  tenantId: z.string().optional(), // Optional for logging/analytics
});

// =============================================================================
// Helpers
// =============================================================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

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
  const {
    tenantRepo,
    catalogService,
    segmentService,
    prisma,
    vocabularyEmbeddingService,
    internalApiSecret,
  } = deps;

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

  // ===========================================================================
  // POST /manage-segments - CRUD on tenant segments
  // Called by: Tenant Agent's manage_segments tool
  // ===========================================================================
  router.post('/manage-segments', async (req: Request, res: Response) => {
    try {
      const params = ManageSegmentsSchema.parse(req.body);
      const { tenantId, action } = params;

      logger.info(
        { tenantId, action, endpoint: '/manage-segments' },
        '[Agent] Segment management request'
      );

      if (!segmentService) {
        res.status(503).json({ error: 'Segment service not available' });
        return;
      }

      // Verify tenant exists
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      switch (action) {
        case 'list': {
          const segments = await segmentService.getSegments(tenantId, false);
          const formatted = segments.map((seg) => ({
            id: seg.id,
            name: seg.name,
            slug: seg.slug,
            sortOrder: seg.sortOrder,
            active: seg.active,
          }));

          res.json({
            segments: formatted,
            totalCount: formatted.length,
            maxSegments: MAX_SEGMENTS_PER_TENANT,
          });
          return;
        }

        case 'create': {
          if (!params.name) {
            res.status(400).json({ error: 'name is required for create' });
            return;
          }

          // Enforce max segments per tenant
          const existingSegments = await segmentService.getSegments(tenantId, false);
          if (existingSegments.length >= MAX_SEGMENTS_PER_TENANT) {
            res.status(400).json({
              error: `Maximum ${MAX_SEGMENTS_PER_TENANT} segments per tenant. Delete one first.`,
            });
            return;
          }

          const slug = params.slug || slugify(params.name);
          const maxSort = existingSegments.reduce((max, s) => Math.max(max, s.sortOrder), 0);

          const newSegment = await segmentService.createSegment({
            tenantId,
            name: params.name,
            slug,
            heroTitle: params.name, // Default heroTitle to segment name
            sortOrder: maxSort + 1,
            active: params.active ?? true,
          });

          const allSegments = await segmentService.getSegments(tenantId, false);

          logger.info(
            { tenantId, segmentId: newSegment.id, name: newSegment.name },
            '[Agent] Segment created'
          );

          res.json({
            segment: {
              id: newSegment.id,
              name: newSegment.name,
              slug: newSegment.slug,
              sortOrder: newSegment.sortOrder,
              active: newSegment.active,
            },
            totalCount: allSegments.length,
            maxSegments: MAX_SEGMENTS_PER_TENANT,
          });
          return;
        }

        case 'update': {
          if (!params.segmentId) {
            res.status(400).json({ error: 'segmentId is required for update' });
            return;
          }

          const updateData: { name?: string; slug?: string; active?: boolean } = {};
          if (params.name) updateData.name = params.name;
          if (params.slug) updateData.slug = params.slug;
          if (params.active !== undefined) updateData.active = params.active;

          const updated = await segmentService.updateSegment(
            tenantId,
            params.segmentId,
            updateData
          );

          const allSegments = await segmentService.getSegments(tenantId, false);

          logger.info(
            { tenantId, segmentId: updated.id, updates: Object.keys(updateData) },
            '[Agent] Segment updated'
          );

          res.json({
            segment: {
              id: updated.id,
              name: updated.name,
              slug: updated.slug,
              sortOrder: updated.sortOrder,
              active: updated.active,
            },
            totalCount: allSegments.length,
            maxSegments: MAX_SEGMENTS_PER_TENANT,
          });
          return;
        }

        case 'delete': {
          if (!params.segmentId) {
            res.status(400).json({ error: 'segmentId is required for delete' });
            return;
          }

          await segmentService.deleteSegment(tenantId, params.segmentId);

          const remainingSegments = await segmentService.getSegments(tenantId, false);

          logger.info({ tenantId, deletedSegmentId: params.segmentId }, '[Agent] Segment deleted');

          res.json({
            deletedId: params.segmentId,
            totalCount: remainingSegments.length,
          });
          return;
        }

        default:
          res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      handleError(res, error, '/manage-segments');
    }
  });

  // ===========================================================================
  // POST /manage-tiers - CRUD on bookable pricing tiers
  // Called by: Tenant Agent's manage_tiers tool
  // ===========================================================================
  router.post('/manage-tiers', async (req: Request, res: Response) => {
    try {
      const params = ManageTiersSchema.parse(req.body);
      const { tenantId, action } = params;

      logger.info(
        { tenantId, action, endpoint: '/manage-tiers' },
        '[Agent] Tier management request'
      );

      if (!prisma) {
        res.status(503).json({ error: 'Database not available' });
        return;
      }

      // Verify tenant exists
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      switch (action) {
        case 'list': {
          // MULTI-TENANT: Filter by tenantId (pitfall #1)
          const where: { tenantId: string; segmentId?: string } = { tenantId };
          if (params.segmentId) where.segmentId = params.segmentId;

          const tiers = await prisma.tier.findMany({
            where,
            include: { segment: { select: { name: true } } },
            orderBy: [{ segmentId: 'asc' }, { sortOrder: 'asc' }],
            take: 100, // pitfall #13: bounded query
          });

          const formatted = tiers.map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            segmentId: t.segmentId,
            segmentName: t.segment.name,
            sortOrder: t.sortOrder,
            priceInDollars: Math.round(t.priceCents / 100),
            priceCents: t.priceCents,
            features: t.features as unknown[],
            bookingType: t.bookingType,
            active: t.active,
          }));

          res.json({
            tiers: formatted,
            totalCount: formatted.length,
            segmentId: params.segmentId,
          });
          return;
        }

        case 'create': {
          if (!params.segmentId || !params.name || params.priceCents === undefined) {
            res.status(400).json({
              error: 'create requires: segmentId, name, priceCents',
            });
            return;
          }

          // SECURITY: Verify segment belongs to tenant
          const segment = await prisma.segment.findFirst({
            where: { id: params.segmentId, tenantId },
          });
          if (!segment) {
            res.status(404).json({ error: 'Segment not found or access denied' });
            return;
          }

          // Enforce max tiers per segment
          const existingTierCount = await prisma.tier.count({
            where: { segmentId: params.segmentId, tenantId },
          });
          if (existingTierCount >= MAX_TIERS_PER_SEGMENT) {
            res.status(400).json({
              error: `Maximum ${MAX_TIERS_PER_SEGMENT} tiers per segment. Delete one first.`,
            });
            return;
          }

          // Price sanity bounds
          if (params.priceCents < 100 || params.priceCents > 5000000) {
            res.status(400).json({
              error: 'Price must be between $1 and $50,000',
            });
            return;
          }

          // Auto-compute sortOrder
          const maxSortTier = await prisma.tier.findFirst({
            where: { segmentId: params.segmentId, tenantId },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
          });
          const nextSort = params.sortOrder ?? (maxSortTier ? maxSortTier.sortOrder + 1 : 1);

          const slug = params.slug || slugify(params.name);

          const newTier = await prisma.tier.create({
            data: {
              tenantId,
              segmentId: params.segmentId,
              name: params.name,
              slug,
              description: params.description ?? null,
              priceCents: params.priceCents,
              features: (params.features ?? []) as unknown as string,
              sortOrder: nextSort,
              bookingType: params.bookingType ?? 'DATE',
              durationMinutes: params.durationMinutes ?? null,
              active: params.active ?? true,
            },
            include: { segment: { select: { name: true } } },
          });

          const allTiers = await prisma.tier.count({
            where: { segmentId: params.segmentId, tenantId },
          });

          logger.info(
            { tenantId, tierId: newTier.id, name: newTier.name, segmentId: params.segmentId },
            '[Agent] Tier created'
          );

          res.json({
            tier: {
              id: newTier.id,
              name: newTier.name,
              slug: newTier.slug,
              segmentId: newTier.segmentId,
              segmentName: newTier.segment.name,
              sortOrder: newTier.sortOrder,
              priceInDollars: Math.round(newTier.priceCents / 100),
              priceCents: newTier.priceCents,
              features: newTier.features as unknown[],
              bookingType: newTier.bookingType,
              active: newTier.active,
            },
            totalCount: allTiers,
          });
          return;
        }

        case 'update': {
          if (!params.tierId) {
            res.status(400).json({ error: 'tierId is required for update' });
            return;
          }

          // SECURITY: Verify tier belongs to tenant (pitfall #1)
          const existing = await prisma.tier.findFirst({
            where: { id: params.tierId, tenantId },
          });
          if (!existing) {
            res.status(404).json({ error: 'Tier not found or access denied' });
            return;
          }

          // Price sanity bounds if updating price
          if (params.priceCents !== undefined) {
            if (params.priceCents < 100 || params.priceCents > 5000000) {
              res.status(400).json({ error: 'Price must be between $1 and $50,000' });
              return;
            }
          }

          const updateData: Record<string, unknown> = {};
          if (params.name) {
            updateData.name = params.name;
            if (!params.slug) updateData.slug = slugify(params.name);
          }
          if (params.slug) updateData.slug = params.slug;
          if (params.description !== undefined) updateData.description = params.description;
          if (params.priceCents !== undefined) updateData.priceCents = params.priceCents;
          if (params.features !== undefined) updateData.features = params.features;
          if (params.sortOrder !== undefined) updateData.sortOrder = params.sortOrder;
          if (params.bookingType) updateData.bookingType = params.bookingType;
          if (params.durationMinutes !== undefined)
            updateData.durationMinutes = params.durationMinutes;
          if (params.active !== undefined) updateData.active = params.active;

          const updated = await prisma.tier.update({
            where: { id: params.tierId },
            data: updateData,
            include: { segment: { select: { name: true } } },
          });

          const allTiers = await prisma.tier.count({
            where: { segmentId: updated.segmentId, tenantId },
          });

          logger.info(
            { tenantId, tierId: updated.id, updates: Object.keys(updateData) },
            '[Agent] Tier updated'
          );

          res.json({
            tier: {
              id: updated.id,
              name: updated.name,
              slug: updated.slug,
              segmentId: updated.segmentId,
              segmentName: updated.segment.name,
              sortOrder: updated.sortOrder,
              priceInDollars: Math.round(updated.priceCents / 100),
              priceCents: updated.priceCents,
              features: updated.features as unknown[],
              bookingType: updated.bookingType,
              active: updated.active,
            },
            totalCount: allTiers,
          });
          return;
        }

        case 'delete': {
          if (!params.tierId) {
            res.status(400).json({ error: 'tierId is required for delete' });
            return;
          }

          // SECURITY: Verify tier belongs to tenant
          const existing = await prisma.tier.findFirst({
            where: { id: params.tierId, tenantId },
          });
          if (!existing) {
            res.status(404).json({ error: 'Tier not found or access denied' });
            return;
          }

          // Check for active bookings before deleting (onDelete: Restrict)
          const bookingCount = await prisma.booking.count({
            where: { tierId: params.tierId },
          });
          if (bookingCount > 0) {
            res.status(409).json({
              error: `Cannot delete tier with ${bookingCount} active booking(s). Deactivate instead.`,
            });
            return;
          }

          await prisma.tier.delete({ where: { id: params.tierId } });

          const remainingTiers = await prisma.tier.count({
            where: { segmentId: existing.segmentId, tenantId },
          });

          logger.info({ tenantId, deletedTierId: params.tierId }, '[Agent] Tier deleted');

          res.json({
            deletedId: params.tierId,
            totalCount: remainingTiers,
          });
          return;
        }

        default:
          res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      handleError(res, error, '/manage-tiers');
    }
  });

  // ===========================================================================
  // POST /manage-addons - CRUD on service add-ons
  // Called by: Tenant Agent's manage_addons tool
  // ===========================================================================
  router.post('/manage-addons', async (req: Request, res: Response) => {
    try {
      const params = ManageAddOnsSchema.parse(req.body);
      const { tenantId, action } = params;

      logger.info(
        { tenantId, action, endpoint: '/manage-addons' },
        '[Agent] AddOn management request'
      );

      if (!prisma) {
        res.status(503).json({ error: 'Database not available' });
        return;
      }

      // Verify tenant exists
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      switch (action) {
        case 'list': {
          // MULTI-TENANT: Filter by tenantId (pitfall #1)
          const where: { tenantId: string; segmentId?: string | null } = { tenantId };
          if (params.segmentId !== undefined) {
            where.segmentId = params.segmentId;
          }

          const addOns = await prisma.addOn.findMany({
            where,
            include: { segment: { select: { name: true } } },
            orderBy: { name: 'asc' },
            take: 100, // pitfall #13: bounded query
          });

          const formatted = addOns.map((a) => ({
            id: a.id,
            name: a.name,
            slug: a.slug,
            description: a.description,
            priceInDollars: Math.round(a.price / 100),
            priceCents: a.price,
            segmentId: a.segmentId,
            segmentName: a.segment?.name ?? null,
            active: a.active,
          }));

          res.json({
            addOns: formatted,
            totalCount: formatted.length,
          });
          return;
        }

        case 'create': {
          if (!params.name || params.priceCents === undefined) {
            res.status(400).json({ error: 'create requires: name, priceCents' });
            return;
          }

          // If segment-scoped, verify segment belongs to tenant
          if (params.segmentId) {
            const segment = await prisma.segment.findFirst({
              where: { id: params.segmentId, tenantId },
            });
            if (!segment) {
              res.status(404).json({ error: 'Segment not found or access denied' });
              return;
            }
          }

          const slug = params.slug || slugify(params.name);

          const newAddOn = await prisma.addOn.create({
            data: {
              tenantId,
              name: params.name,
              slug,
              description: params.description ?? null,
              price: params.priceCents,
              segmentId: params.segmentId ?? null,
              active: params.active ?? true,
            },
            include: { segment: { select: { name: true } } },
          });

          const allAddOns = await prisma.addOn.count({ where: { tenantId } });

          logger.info(
            { tenantId, addOnId: newAddOn.id, name: newAddOn.name },
            '[Agent] AddOn created'
          );

          res.json({
            addOn: {
              id: newAddOn.id,
              name: newAddOn.name,
              slug: newAddOn.slug,
              description: newAddOn.description,
              priceInDollars: Math.round(newAddOn.price / 100),
              priceCents: newAddOn.price,
              segmentId: newAddOn.segmentId,
              segmentName: newAddOn.segment?.name ?? null,
              active: newAddOn.active,
            },
            totalCount: allAddOns,
          });
          return;
        }

        case 'update': {
          if (!params.addOnId) {
            res.status(400).json({ error: 'addOnId is required for update' });
            return;
          }

          // SECURITY: Verify add-on belongs to tenant
          const existing = await prisma.addOn.findFirst({
            where: { id: params.addOnId, tenantId },
          });
          if (!existing) {
            res.status(404).json({ error: 'AddOn not found or access denied' });
            return;
          }

          const updateData: Record<string, unknown> = {};
          if (params.name) {
            updateData.name = params.name;
            if (!params.slug) updateData.slug = slugify(params.name);
          }
          if (params.slug) updateData.slug = params.slug;
          if (params.description !== undefined) updateData.description = params.description;
          if (params.priceCents !== undefined) updateData.price = params.priceCents;
          if (params.segmentId !== undefined) updateData.segmentId = params.segmentId;
          if (params.active !== undefined) updateData.active = params.active;

          const updated = await prisma.addOn.update({
            where: { id: params.addOnId },
            data: updateData,
            include: { segment: { select: { name: true } } },
          });

          const allAddOns = await prisma.addOn.count({ where: { tenantId } });

          logger.info(
            { tenantId, addOnId: updated.id, updates: Object.keys(updateData) },
            '[Agent] AddOn updated'
          );

          res.json({
            addOn: {
              id: updated.id,
              name: updated.name,
              slug: updated.slug,
              description: updated.description,
              priceInDollars: Math.round(updated.price / 100),
              priceCents: updated.price,
              segmentId: updated.segmentId,
              segmentName: updated.segment?.name ?? null,
              active: updated.active,
            },
            totalCount: allAddOns,
          });
          return;
        }

        case 'delete': {
          if (!params.addOnId) {
            res.status(400).json({ error: 'addOnId is required for delete' });
            return;
          }

          // SECURITY: Verify add-on belongs to tenant
          const existing = await prisma.addOn.findFirst({
            where: { id: params.addOnId, tenantId },
          });
          if (!existing) {
            res.status(404).json({ error: 'AddOn not found or access denied' });
            return;
          }

          await prisma.addOn.delete({ where: { id: params.addOnId } });

          const remainingAddOns = await prisma.addOn.count({ where: { tenantId } });

          logger.info({ tenantId, deletedAddOnId: params.addOnId }, '[Agent] AddOn deleted');

          res.json({
            deletedId: params.addOnId,
            totalCount: remainingAddOns,
          });
          return;
        }

        default:
          res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      handleError(res, error, '/manage-addons');
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
