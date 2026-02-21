/**
 * Onboarding Intake Service
 *
 * Business logic for the conversational intake form during onboarding.
 * Handles per-question validation, sanitization, storage, and progress tracking.
 *
 * Architecture:
 * - Answers are stored as discovery facts (reuses existing DiscoveryService.storeFact)
 * - Per-question Zod validation using schemas from @macon/contracts
 * - DOMPurify sanitization for all text answers
 * - SSRF protection for websiteUrl (reject private IPs + dangerous schemes)
 * - Progress tracked by cross-referencing stored facts with INTAKE_QUESTIONS config
 *
 * CRITICAL: All methods require tenantId for multi-tenant isolation.
 */

import DOMPurify from 'isomorphic-dompurify';
import { logger } from '../lib/core/logger';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { DiscoveryService } from './discovery.service';
import {
  type IntakeAnswerResponse,
  type IntakeProgressResponse,
  type IntakeCompleteResponse,
  type IntakeQuestionId,
  INTAKE_QUESTIONS,
  getIntakeQuestion,
  getRequiredQuestionIds,
  getNextQuestionId,
  TOTAL_INTAKE_QUESTIONS,
  intakeValidationSchemas,
} from '@macon/contracts';

// ============================================================================
// SSRF Protection
// ============================================================================

/**
 * Dangerous URL schemes that must be rejected for websiteUrl.
 */
const DANGEROUS_SCHEMES = ['file:', 'javascript:', 'data:'];

/**
 * Private/reserved IP patterns (IPv4 + IPv6) to block SSRF attacks.
 * Matches: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x, 169.254.x.x, ::1, fc00::, fe80::
 */
const PRIVATE_IP_PATTERNS = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\.0\.0\.0$/,
  /^localhost$/i,
];

/**
 * Check if a URL points to a private/reserved IP or uses a dangerous scheme.
 * Returns an error message if unsafe, null if safe.
 */
function validateUrlSafety(urlString: string): string | null {
  if (!urlString || urlString === '') return null;

  // Check dangerous schemes
  const lowerUrl = urlString.toLowerCase();
  for (const scheme of DANGEROUS_SCHEMES) {
    if (lowerUrl.startsWith(scheme)) {
      return `URL scheme "${scheme}" is not allowed`;
    }
  }

  // Parse URL to extract hostname
  let hostname: string;
  try {
    const parsed = new URL(urlString);
    hostname = parsed.hostname;
  } catch {
    // URL parsing failed — Zod .url() will catch this separately
    return null;
  }

  // Check private IP patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return 'URLs pointing to private or reserved IP addresses are not allowed';
    }
  }

  return null;
}

// ============================================================================
// Intake Question ID Set (for filtering discovery facts)
// ============================================================================

const INTAKE_QUESTION_IDS = new Set(INTAKE_QUESTIONS.map((q) => q.id));

// ============================================================================
// Service
// ============================================================================

export class OnboardingIntakeService {
  constructor(
    private readonly tenantRepo: PrismaTenantRepository,
    private readonly discoveryService: DiscoveryService
  ) {}

  // ==========================================================================
  // saveAnswer
  // ==========================================================================

  /**
   * Save a single intake answer.
   *
   * 1. Validates the answer using the per-question Zod schema
   * 2. Sanitizes text with DOMPurify
   * 3. Runs SSRF check for websiteUrl
   * 4. Stores as a discovery fact via DiscoveryService
   * 5. Computes next question ID
   */
  async saveAnswer(
    tenantId: string,
    questionId: string,
    answer: string | string[]
  ): Promise<IntakeAnswerResponse> {
    // 1. Verify question exists
    const question = getIntakeQuestion(questionId);
    if (!question) {
      logger.warn({ tenantId, questionId }, '[OnboardingIntakeService] Unknown question ID');
      throw new IntakeValidationError(`Unknown question ID: ${questionId}`);
    }

    // 2. Validate with per-question Zod schema
    const schema = intakeValidationSchemas[questionId as IntakeQuestionId];
    if (!schema) {
      throw new IntakeValidationError(`No validation schema for question: ${questionId}`);
    }

    const validation = schema.safeParse(answer);
    if (!validation.success) {
      logger.info(
        { tenantId, questionId, errors: validation.error.issues },
        '[OnboardingIntakeService] Answer validation failed'
      );
      throw new IntakeValidationError(
        validation.error.issues.map((i) => i.message).join('; '),
        validation.error.issues
      );
    }

    // validation.data type varies per schema — coerce to the input type for sanitization
    const validatedAnswer = validation.data as string | string[];

    // 3. Sanitize text answers (strings only — arrays don't need DOMPurify)
    let sanitizedAnswer: string | string[];
    if (typeof validatedAnswer === 'string') {
      sanitizedAnswer = DOMPurify.sanitize(validatedAnswer);
    } else if (Array.isArray(validatedAnswer)) {
      sanitizedAnswer = (validatedAnswer as string[]).map((v: string) => DOMPurify.sanitize(v));
    } else {
      sanitizedAnswer = String(validatedAnswer);
    }

    // 4. SSRF protection for websiteUrl
    if (
      questionId === 'websiteUrl' &&
      typeof sanitizedAnswer === 'string' &&
      sanitizedAnswer !== ''
    ) {
      const ssrfError = validateUrlSafety(sanitizedAnswer);
      if (ssrfError) {
        logger.warn(
          { tenantId, questionId, url: sanitizedAnswer },
          `[OnboardingIntakeService] SSRF protection: ${ssrfError}`
        );
        throw new IntakeValidationError(ssrfError);
      }
    }

    // 5. Store as discovery fact
    await this.discoveryService.storeFact(tenantId, questionId, sanitizedAnswer);

    // 6. Get current answers for next-question computation
    const factsResult = await this.discoveryService.getDiscoveryFacts(tenantId);
    const intakeAnswers = this.filterIntakeAnswers(factsResult.facts);

    // 7. Compute next question
    const nextQuestionId = getNextQuestionId(questionId, intakeAnswers);

    logger.info(
      { tenantId, questionId, nextQuestionId, answeredCount: Object.keys(intakeAnswers).length },
      '[OnboardingIntakeService] Answer saved'
    );

    return {
      stored: true,
      questionId,
      nextQuestionId,
      answeredCount: Object.keys(intakeAnswers).length,
      totalQuestions: TOTAL_INTAKE_QUESTIONS,
    };
  }

  // ==========================================================================
  // getProgress
  // ==========================================================================

  /**
   * Get current intake progress.
   *
   * Returns answered questions, next unanswered question, and can-complete flag.
   */
  async getProgress(tenantId: string): Promise<IntakeProgressResponse> {
    const factsResult = await this.discoveryService.getDiscoveryFacts(tenantId);
    const intakeAnswers = this.filterIntakeAnswers(factsResult.facts);
    const answeredQuestionIds = Object.keys(intakeAnswers);

    // Find next unanswered question by walking the question graph
    const nextQuestionId = this.findNextUnanswered(answeredQuestionIds, intakeAnswers);

    // Check if all required questions are answered
    const requiredIds = getRequiredQuestionIds();
    const canComplete = requiredIds.every((id) => answeredQuestionIds.includes(id));

    logger.info(
      {
        tenantId,
        answeredCount: answeredQuestionIds.length,
        totalQuestions: TOTAL_INTAKE_QUESTIONS,
        canComplete,
      },
      '[OnboardingIntakeService] Progress retrieved'
    );

    return {
      answers: intakeAnswers,
      answeredQuestionIds,
      nextQuestionId,
      totalQuestions: TOTAL_INTAKE_QUESTIONS,
      completedCount: answeredQuestionIds.length,
      canComplete,
    };
  }

  // ==========================================================================
  // completeIntake
  // ==========================================================================

  /**
   * Complete the intake form and advance to BUILDING status.
   *
   * 1. Checks all required questions are answered
   * 2. Verifies tenant is in PENDING_INTAKE status
   * 3. Advances status to BUILDING
   */
  async completeIntake(tenantId: string): Promise<IntakeCompleteResponse> {
    // Check current tenant status
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new Error(`[OnboardingIntakeService] Tenant not found: ${tenantId}`);
    }

    // Already past intake?
    if (tenant.onboardingStatus !== 'PENDING_INTAKE') {
      logger.info(
        { tenantId, currentStatus: tenant.onboardingStatus },
        '[OnboardingIntakeService] Intake already completed or wrong status'
      );
      return {
        status: 'already_completed',
        currentStatus: tenant.onboardingStatus as string,
      };
    }

    // Check all required questions are answered
    const factsResult = await this.discoveryService.getDiscoveryFacts(tenantId);
    const intakeAnswers = this.filterIntakeAnswers(factsResult.facts);
    const answeredQuestionIds = Object.keys(intakeAnswers);

    const requiredIds = getRequiredQuestionIds();
    const missingQuestions = requiredIds.filter((id) => !answeredQuestionIds.includes(id));

    if (missingQuestions.length > 0) {
      logger.info(
        { tenantId, missingQuestions },
        '[OnboardingIntakeService] Cannot complete intake — missing required questions'
      );
      return {
        status: 'missing_required',
        missingQuestions,
      };
    }

    // Advance status: PENDING_INTAKE → BUILDING
    await this.tenantRepo.update(tenantId, {
      onboardingStatus: 'BUILDING',
    });

    logger.info(
      { tenantId, from: 'PENDING_INTAKE', to: 'BUILDING' },
      '[OnboardingIntakeService] Intake completed, advancing to BUILDING'
    );

    return {
      status: 'advanced_to_building',
      redirectTo: '/onboarding/build',
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Filter discovery facts to only include intake question answers.
   * Discovery facts may include other keys from the agent — we only want intake question IDs.
   */
  private filterIntakeAnswers(facts: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(facts).filter(([key]) => INTAKE_QUESTION_IDS.has(key))
    );
  }

  /**
   * Walk the question graph to find the first unanswered question.
   * Starts from the first question and follows the `next()` chain.
   */
  private findNextUnanswered(
    answeredIds: string[],
    _answers: Record<string, unknown>
  ): string | null {
    // Walk the question sequence from the beginning
    for (const question of INTAKE_QUESTIONS) {
      if (!answeredIds.includes(question.id)) {
        return question.id;
      }
    }
    // All questions answered
    return null;
  }
}

// ============================================================================
// Error Classes
// ============================================================================

export class IntakeValidationError extends Error {
  public readonly issues?: Array<{ message: string; path?: (string | number)[] }>;

  constructor(message: string, issues?: Array<{ message: string; path?: (string | number)[] }>) {
    super(message);
    this.name = 'IntakeValidationError';
    this.issues = issues;
  }
}
