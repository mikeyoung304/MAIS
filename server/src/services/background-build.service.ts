/**
 * Background Build Service (Phase 4 — Onboarding Redesign)
 *
 * Orchestrates async website generation after intake form completion.
 * Pipeline: get discovery facts → generate HERO/ABOUT/SERVICES via LLM → write sections.
 *
 * Fire-and-forget: POST /intake/complete triggers this service, which runs
 * in-process via setImmediate(). No external queue needed at current scale.
 *
 * Concurrency: pg_try_advisory_lock prevents parallel builds per tenant.
 * Idempotency: buildIdempotencyKey on Tenant prevents duplicate triggers.
 */

import type { PrismaClient } from '../generated/prisma/client';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { SectionContentService } from './section-content.service';
import type { DiscoveryService } from './discovery.service';
import { logger } from '../lib/core/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BUILD_STATUS = {
  QUEUED: 'QUEUED',
  GENERATING_HERO: 'GENERATING_HERO',
  GENERATING_ABOUT: 'GENERATING_ABOUT',
  GENERATING_SERVICES: 'GENERATING_SERVICES',
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
} as const;

const SECTION_TIMEOUT_MS = 45_000;
const BUILD_TIMEOUT_MS = 120_000;

const MVP_SECTIONS = ['HERO', 'ABOUT', 'SERVICES'] as const;
type MvpSectionType = (typeof MVP_SECTIONS)[number];

type SectionStatus = 'pending' | 'generating' | 'complete' | 'failed';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuildStatusResponse {
  buildStatus: string | null;
  buildError: string | null;
  sections: Record<Lowercase<MvpSectionType>, SectionStatus>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class BackgroundBuildService {
  constructor(
    private readonly tenantRepo: PrismaTenantRepository,
    private readonly sectionContent: SectionContentService,
    private readonly discoveryService: DiscoveryService,
    private readonly prisma: PrismaClient
  ) {}

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Fire-and-forget build trigger. Sets QUEUED, kicks off async pipeline.
   * Returns immediately — frontend polls getBuildStatus for progress.
   */
  async triggerBuild(tenantId: string, idempotencyKey?: string): Promise<{ triggered: boolean }> {
    // Idempotency guard
    if (idempotencyKey) {
      const tenant = await this.tenantRepo.findById(tenantId);
      if (tenant?.buildIdempotencyKey === idempotencyKey) {
        logger.info(
          { tenantId, idempotencyKey },
          '[BackgroundBuild] Duplicate build request, skipping'
        );
        return { triggered: false };
      }
    }

    // Set initial status
    await this.tenantRepo.update(tenantId, {
      buildStatus: BUILD_STATUS.QUEUED,
      buildError: null,
      buildIdempotencyKey: idempotencyKey ?? null,
    });

    logger.info({ tenantId }, '[BackgroundBuild] Build queued');

    // Fire and forget — runs outside the HTTP request lifecycle
    setImmediate(() => {
      this.executeBuild(tenantId).catch((error) => {
        logger.error(
          { tenantId, error: error instanceof Error ? error.message : String(error) },
          '[BackgroundBuild] Unhandled build pipeline error'
        );
      });
    });

    return { triggered: true };
  }

  /**
   * Returns current build status with per-section progress.
   * Used by frontend polling (GET /build-status every 2s).
   */
  async getBuildStatus(tenantId: string): Promise<BuildStatusResponse> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      return {
        buildStatus: null,
        buildError: null,
        sections: { hero: 'pending', about: 'pending', services: 'pending' },
      };
    }

    return {
      buildStatus: tenant.buildStatus,
      buildError: tenant.buildError,
      sections: this.deriveSectionStatus(tenant.buildStatus),
    };
  }

  /**
   * Retry a failed or stuck build.
   */
  async retryBuild(tenantId: string): Promise<{ triggered: boolean }> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      return { triggered: false };
    }

    // Allow retry from FAILED state only
    if (tenant.buildStatus !== BUILD_STATUS.FAILED) {
      logger.info(
        { tenantId, currentStatus: tenant.buildStatus },
        '[BackgroundBuild] Cannot retry — not in FAILED state'
      );
      return { triggered: false };
    }

    // Re-trigger without idempotency key (allow fresh build)
    return this.triggerBuild(tenantId);
  }

  // ==========================================================================
  // Build Pipeline (runs async)
  // ==========================================================================

  private async executeBuild(tenantId: string): Promise<void> {
    const startTime = Date.now();

    // Acquire advisory lock (one active build per tenant)
    const lockAcquired = await this.acquireAdvisoryLock(tenantId);
    if (!lockAcquired) {
      logger.warn(
        { tenantId },
        '[BackgroundBuild] Could not acquire lock — concurrent build in progress'
      );
      return;
    }

    try {
      // 1. Load discovery facts (populated by intake form)
      const factsResult = await this.discoveryService.getDiscoveryFacts(tenantId);
      if (!factsResult.success || factsResult.factCount === 0) {
        await this.setBuildFailed(
          tenantId,
          'No discovery facts found. Complete intake form first.'
        );
        return;
      }

      const facts = factsResult.facts;
      logger.info(
        { tenantId, factCount: factsResult.factCount },
        '[BackgroundBuild] Discovery facts loaded'
      );

      // 2. Generate sections sequentially with per-section status updates
      const results: Record<string, boolean> = {};

      for (let i = 0; i < MVP_SECTIONS.length; i++) {
        const sectionType = MVP_SECTIONS[i];

        // Check overall timeout
        if (Date.now() - startTime > BUILD_TIMEOUT_MS) {
          logger.warn(
            { tenantId, elapsed: Date.now() - startTime },
            '[BackgroundBuild] Overall build timeout — stopping'
          );
          break;
        }

        // Update status to GENERATING_<SECTION>
        const statusKey = `GENERATING_${sectionType}` as keyof typeof BUILD_STATUS;
        await this.tenantRepo.update(tenantId, {
          buildStatus: BUILD_STATUS[statusKey],
        });

        try {
          const content = await this.withTimeout(
            this.generateSectionContent(sectionType, facts),
            SECTION_TIMEOUT_MS,
            `${sectionType} generation`
          );

          await this.writeSectionContent(tenantId, sectionType, content, i);
          results[sectionType] = true;

          logger.info({ tenantId, sectionType }, '[BackgroundBuild] Section generated');
        } catch (error) {
          results[sectionType] = false;
          logger.error(
            {
              tenantId,
              sectionType,
              error: error instanceof Error ? error.message : String(error),
            },
            '[BackgroundBuild] Section generation failed'
          );
        }
      }

      // 3. Determine outcome
      const successCount = Object.values(results).filter(Boolean).length;
      const failedSections = Object.entries(results)
        .filter(([, ok]) => !ok)
        .map(([type]) => type);

      if (successCount === MVP_SECTIONS.length) {
        // Full success → advance to SETUP
        await this.tenantRepo.update(tenantId, {
          buildStatus: BUILD_STATUS.COMPLETE,
          buildError: null,
          onboardingStatus: 'SETUP',
        });
        logger.info(
          { tenantId, elapsed: Date.now() - startTime },
          '[BackgroundBuild] Build complete — advanced to SETUP'
        );
      } else if (successCount > 0) {
        // Partial success → still advance, note failures
        await this.tenantRepo.update(tenantId, {
          buildStatus: BUILD_STATUS.COMPLETE,
          buildError: `Partial: ${failedSections.join(', ')} failed. Content can be refined in the editor.`,
          onboardingStatus: 'SETUP',
        });
        logger.info(
          { tenantId, failedSections, elapsed: Date.now() - startTime },
          '[BackgroundBuild] Build partially complete'
        );
      } else {
        // Total failure
        await this.setBuildFailed(tenantId, 'All section generations failed. Please retry.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.setBuildFailed(tenantId, message);
      logger.error({ tenantId, error: message }, '[BackgroundBuild] Build pipeline error');
    } finally {
      await this.releaseAdvisoryLock(tenantId);
    }
  }

  // ==========================================================================
  // Content Generation
  // ==========================================================================

  /**
   * Generate section content via LLM, with fallback to template-based content.
   */
  private async generateSectionContent(
    sectionType: MvpSectionType,
    facts: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      return await this.generateWithLLM(sectionType, facts);
    } catch (error) {
      logger.warn(
        {
          sectionType,
          error: error instanceof Error ? error.message : String(error),
        },
        '[BackgroundBuild] LLM generation failed, using fallback content'
      );
      return this.generateFallbackContent(sectionType, facts);
    }
  }

  /**
   * Call Vertex AI (Gemini) directly to generate section content.
   * Lazy-imports vertex-client to avoid startup failures in mock mode.
   */
  private async generateWithLLM(
    sectionType: MvpSectionType,
    facts: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const vertexModule = await import('../llm/vertex-client');
    const client = vertexModule.getVertexClient();

    const prompt = this.buildPrompt(sectionType, facts);

    const response = await client.models.generateContent({
      model: vertexModule.DEFAULT_MODEL,
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    const text = response.text ?? '';

    // Extract JSON from response (may be wrapped in markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON found in LLM response for ${sectionType}`);
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return { ...parsed, visible: true };
  }

  /**
   * Template-based fallback when LLM is unavailable (mock mode, quota exhausted).
   * Produces reasonable defaults from discovery facts.
   */
  private generateFallbackContent(
    sectionType: MvpSectionType,
    facts: Record<string, unknown>
  ): Record<string, unknown> {
    const name = String(facts.businessName || 'Your Business');
    const type = String(facts.businessType || 'service professional').replace(/_/g, ' ');
    const location = String(facts.location || '');
    const services = String(facts.servicesOffered || 'professional services');
    const uniqueValue = String(facts.uniqueValue || '');
    const approach = String(facts.approach || '');

    switch (sectionType) {
      case 'HERO':
        return {
          headline: name,
          subheadline: location
            ? `${type.charAt(0).toUpperCase() + type.slice(1)} in ${location}`
            : `Professional ${type}`,
          ctaText: 'Book a Consultation',
          alignment: 'center',
          visible: true,
        };

      case 'ABOUT': {
        const paragraphs = [
          uniqueValue || `${name} provides ${services}.`,
          approach || '',
          location ? `Based in ${location}.` : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        return {
          title: `About ${name}`,
          body: paragraphs,
          imagePosition: 'right',
          visible: true,
        };
      }

      case 'SERVICES':
        return {
          title: 'Services',
          subtitle: services.length > 200 ? services.slice(0, 197) + '...' : services,
          layout: 'cards',
          showPricing: true,
          visible: true,
        };

      default:
        return { visible: true };
    }
  }

  // ==========================================================================
  // Prompt Construction
  // ==========================================================================

  private buildPrompt(sectionType: MvpSectionType, facts: Record<string, unknown>): string {
    const factsBlock = Object.entries(facts)
      .filter(([, v]) => v != null && String(v).length > 0)
      .map(([k, v]) => `- ${k}: ${String(v)}`)
      .join('\n');

    const base = `You are a professional web copywriter creating website content for a service professional.
Write clear, warm, confident copy. No exclamation marks. No hype words (revolutionary, game-changing,
cutting-edge, leverage, synergy). Speak directly to the target audience.
Return ONLY valid JSON — no markdown code fences, no explanatory text.

Business information:
${factsBlock}`;

    const sectionInstructions: Record<MvpSectionType, string> = {
      HERO: `Generate a hero section. Return JSON:
{
  "headline": "Business name or compelling tagline (max 100 chars)",
  "subheadline": "What they do and who they serve (max 200 chars)",
  "ctaText": "Action button text like 'Book a Session' (max 40 chars)",
  "alignment": "center"
}`,

      ABOUT: `Generate an about section. Return JSON:
{
  "title": "Section heading (max 100 chars)",
  "body": "2-3 paragraphs telling their story, approach, and why clients choose them (max 2000 chars)"
}`,

      SERVICES: `Generate a services section header. Return JSON:
{
  "title": "Section heading (max 100 chars)",
  "subtitle": "Brief overview of their offerings (max 200 chars)",
  "layout": "cards",
  "showPricing": true
}`,
    };

    return `${base}\n\n${sectionInstructions[sectionType]}`;
  }

  // ==========================================================================
  // Section Writing
  // ==========================================================================

  private async writeSectionContent(
    tenantId: string,
    sectionType: MvpSectionType,
    content: Record<string, unknown>,
    position: number
  ): Promise<void> {
    const result = await this.sectionContent.addSection(
      tenantId,
      'home',
      sectionType,
      content,
      position
    );

    if (!result.success) {
      throw new Error(`Failed to write ${sectionType} section: ${result.message}`);
    }
  }

  // ==========================================================================
  // Status Derivation
  // ==========================================================================

  /**
   * Derive per-section status from the overall buildStatus field.
   * Sequential generation means each status implies prior sections completed.
   */
  private deriveSectionStatus(
    buildStatus: string | null
  ): Record<Lowercase<MvpSectionType>, SectionStatus> {
    switch (buildStatus) {
      case null:
      case BUILD_STATUS.QUEUED:
        return { hero: 'pending', about: 'pending', services: 'pending' };
      case BUILD_STATUS.GENERATING_HERO:
        return { hero: 'generating', about: 'pending', services: 'pending' };
      case BUILD_STATUS.GENERATING_ABOUT:
        return { hero: 'complete', about: 'generating', services: 'pending' };
      case BUILD_STATUS.GENERATING_SERVICES:
        return { hero: 'complete', about: 'complete', services: 'generating' };
      case BUILD_STATUS.COMPLETE:
        return { hero: 'complete', about: 'complete', services: 'complete' };
      case BUILD_STATUS.FAILED:
        return { hero: 'failed', about: 'failed', services: 'failed' };
      default:
        return { hero: 'pending', about: 'pending', services: 'pending' };
    }
  }

  // ==========================================================================
  // Advisory Lock (concurrency control)
  // ==========================================================================

  /**
   * Acquire a PostgreSQL advisory lock keyed on tenantId.
   * Non-blocking: returns false immediately if lock is held.
   */
  private async acquireAdvisoryLock(tenantId: string): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
        SELECT pg_try_advisory_lock(hashtext(${'build:' + tenantId}))
      `;
      return result[0]?.pg_try_advisory_lock === true;
    } catch (error) {
      logger.error(
        { tenantId, error: error instanceof Error ? error.message : String(error) },
        '[BackgroundBuild] Advisory lock acquisition failed'
      );
      return false;
    }
  }

  /**
   * Release the advisory lock. Must be called in finally block.
   */
  private async releaseAdvisoryLock(tenantId: string): Promise<void> {
    try {
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock(hashtext(${'build:' + tenantId}))
      `;
    } catch (error) {
      logger.error(
        { tenantId, error: error instanceof Error ? error.message : String(error) },
        '[BackgroundBuild] Advisory lock release failed'
      );
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async setBuildFailed(tenantId: string, error: string): Promise<void> {
    await this.tenantRepo.update(tenantId, {
      buildStatus: BUILD_STATUS.FAILED,
      buildError: error,
    });
  }

  /**
   * Race a promise against a timeout. Rejects with a descriptive error on timeout.
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
