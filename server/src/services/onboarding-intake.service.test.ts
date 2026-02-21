/**
 * OnboardingIntakeService Unit Tests
 *
 * Tests the service layer for conversational intake form:
 * - saveAnswer: validation, sanitization, SSRF protection, storage
 * - getProgress: progress tracking, next question computation
 * - completeIntake: status advancement, required question checks
 *
 * All dependencies are mocked — no real DB or HTTP calls.
 *
 * @see onboarding-intake.service.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingIntakeService, IntakeValidationError } from './onboarding-intake.service';
import { TOTAL_INTAKE_QUESTIONS, getRequiredQuestionIds, INTAKE_QUESTIONS } from '@macon/contracts';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockTenantRepo(overrides: Record<string, unknown> = {}) {
  return {
    findById: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

function createMockDiscoveryService(overrides: Record<string, unknown> = {}) {
  return {
    storeFact: vi.fn().mockResolvedValue({ stored: true }),
    getDiscoveryFacts: vi.fn().mockResolvedValue({
      success: true,
      facts: {},
      factCount: 0,
      factKeys: [],
      message: 'No facts stored yet.',
    }),
    ...overrides,
  };
}

/** Minimal tenant object matching PrismaTenantRepository return shape */
function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    name: 'Test Studio',
    tier: 'FREE',
    onboardingStatus: 'PENDING_INTAKE',
    onboardingCompletedAt: null,
    branding: {},
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('OnboardingIntakeService', () => {
  let tenantRepo: ReturnType<typeof createMockTenantRepo>;
  let discoveryService: ReturnType<typeof createMockDiscoveryService>;
  let service: OnboardingIntakeService;

  beforeEach(() => {
    tenantRepo = createMockTenantRepo();
    discoveryService = createMockDiscoveryService();
    service = new OnboardingIntakeService(tenantRepo as never, discoveryService as never);
  });

  // ==========================================================================
  // saveAnswer
  // ==========================================================================

  describe('saveAnswer', () => {
    it('validates answer, stores discovery fact, returns next question', async () => {
      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts: { businessName: 'Test Studio' },
        factCount: 1,
        factKeys: ['businessName'],
        message: 'Known facts: businessName',
      });

      const result = await service.saveAnswer('tenant-1', 'businessName', 'Test Studio');

      expect(result.stored).toBe(true);
      expect(result.questionId).toBe('businessName');
      expect(result.nextQuestionId).toBe('businessType');
      expect(result.answeredCount).toBe(1);
      expect(result.totalQuestions).toBe(TOTAL_INTAKE_QUESTIONS);

      // Verify discovery service was called
      expect(discoveryService.storeFact).toHaveBeenCalledWith(
        'tenant-1',
        'businessName',
        'Test Studio'
      );
    });

    it('rejects invalid answer (too short)', async () => {
      await expect(service.saveAnswer('tenant-1', 'businessName', 'A')).rejects.toThrow(
        IntakeValidationError
      );
    });

    it('rejects invalid answer (wrong enum value)', async () => {
      await expect(service.saveAnswer('tenant-1', 'priceRange', 'invalid_value')).rejects.toThrow(
        IntakeValidationError
      );
    });

    it('rejects unknown question ID', async () => {
      await expect(service.saveAnswer('tenant-1', 'nonexistent_question', 'test')).rejects.toThrow(
        IntakeValidationError
      );
    });

    it('sanitizes HTML in text answers', async () => {
      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts: { businessName: 'Clean Studio' },
        factCount: 1,
        factKeys: ['businessName'],
        message: 'Known facts: businessName',
      });

      await service.saveAnswer(
        'tenant-1',
        'businessName',
        '<script>alert("xss")</script>Clean Studio'
      );

      // DOMPurify should strip the script tag — check the value stored in discovery
      const storedValue = discoveryService.storeFact.mock.calls[0]![2];
      expect(storedValue).not.toContain('<script>');
      expect(storedValue).toContain('Clean Studio');
    });

    it('rejects private IPs in websiteUrl', async () => {
      await expect(
        service.saveAnswer('tenant-1', 'websiteUrl', 'http://192.168.1.1/admin')
      ).rejects.toThrow(IntakeValidationError);
    });

    it('rejects localhost in websiteUrl', async () => {
      await expect(
        service.saveAnswer('tenant-1', 'websiteUrl', 'http://localhost:3000')
      ).rejects.toThrow(IntakeValidationError);
    });

    it('rejects file:// scheme in websiteUrl', async () => {
      await expect(
        service.saveAnswer('tenant-1', 'websiteUrl', 'file:///etc/passwd')
      ).rejects.toThrow(IntakeValidationError);
    });

    it('rejects javascript: scheme in websiteUrl', async () => {
      await expect(
        service.saveAnswer('tenant-1', 'websiteUrl', 'javascript:alert(1)')
      ).rejects.toThrow(IntakeValidationError);
    });

    it('rejects 10.x.x.x private IP in websiteUrl', async () => {
      await expect(
        service.saveAnswer('tenant-1', 'websiteUrl', 'http://10.0.0.1/internal')
      ).rejects.toThrow(IntakeValidationError);
    });

    it('rejects 127.x.x.x loopback IP in websiteUrl', async () => {
      await expect(
        service.saveAnswer('tenant-1', 'websiteUrl', 'http://127.0.0.1:8080')
      ).rejects.toThrow(IntakeValidationError);
    });

    it('allows valid public URLs in websiteUrl', async () => {
      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts: { websiteUrl: 'https://example.com' },
        factCount: 1,
        factKeys: ['websiteUrl'],
        message: 'Known facts: websiteUrl',
      });

      const result = await service.saveAnswer('tenant-1', 'websiteUrl', 'https://example.com');

      expect(result.stored).toBe(true);
    });

    it('allows empty string for optional websiteUrl', async () => {
      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts: { websiteUrl: '' },
        factCount: 1,
        factKeys: ['websiteUrl'],
        message: 'Known facts: websiteUrl',
      });

      const result = await service.saveAnswer('tenant-1', 'websiteUrl', '');

      expect(result.stored).toBe(true);
    });

    it('returns null for nextQuestionId on terminal question', async () => {
      // websiteUrl is the last question (next returns null)
      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts: { websiteUrl: 'https://example.com' },
        factCount: 1,
        factKeys: ['websiteUrl'],
        message: 'Known facts: websiteUrl',
      });

      const result = await service.saveAnswer('tenant-1', 'websiteUrl', 'https://example.com');

      expect(result.nextQuestionId).toBeNull();
    });

    it('validates select questions with correct enum values', async () => {
      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts: { priceRange: '500_2000' },
        factCount: 1,
        factKeys: ['priceRange'],
        message: 'Known facts: priceRange',
      });

      const result = await service.saveAnswer('tenant-1', 'priceRange', '500_2000');

      expect(result.stored).toBe(true);
    });
  });

  // ==========================================================================
  // getProgress
  // ==========================================================================

  describe('getProgress', () => {
    it('returns empty for new tenant (no answers)', async () => {
      const result = await service.getProgress('tenant-1');

      expect(result.answeredQuestionIds).toEqual([]);
      expect(result.completedCount).toBe(0);
      expect(result.canComplete).toBe(false);
      expect(result.totalQuestions).toBe(TOTAL_INTAKE_QUESTIONS);
      // Next question should be the first one
      expect(result.nextQuestionId).toBe(INTAKE_QUESTIONS[0]!.id);
    });

    it('returns correct next question after some answers', async () => {
      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts: {
          businessName: 'Test Studio',
          businessType: 'photographer',
        },
        factCount: 2,
        factKeys: ['businessName', 'businessType'],
        message: 'Known facts: businessName, businessType',
      });

      const result = await service.getProgress('tenant-1');

      expect(result.answeredQuestionIds).toEqual(['businessName', 'businessType']);
      expect(result.completedCount).toBe(2);
      // Next unanswered question in sequence should be servicesOffered
      expect(result.nextQuestionId).toBe('servicesOffered');
    });

    it('canComplete is true when all required questions answered', async () => {
      // Build a facts object with all required questions answered
      const requiredIds = getRequiredQuestionIds();
      const facts: Record<string, string> = {};
      for (const id of requiredIds) {
        facts[id] = 'test value';
      }

      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts,
        factCount: requiredIds.length,
        factKeys: requiredIds,
        message: `Known facts: ${requiredIds.join(', ')}`,
      });

      const result = await service.getProgress('tenant-1');

      expect(result.canComplete).toBe(true);
    });

    it('canComplete is false when some required questions missing', async () => {
      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts: {
          businessName: 'Test Studio',
        },
        factCount: 1,
        factKeys: ['businessName'],
        message: 'Known facts: businessName',
      });

      const result = await service.getProgress('tenant-1');

      expect(result.canComplete).toBe(false);
    });

    it('filters out non-intake discovery facts from answers', async () => {
      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts: {
          businessName: 'Test Studio',
          primarySegment: 'weddings', // Not an intake question
          _researchTriggered: true, // Internal metadata (already filtered by discovery)
        },
        factCount: 2,
        factKeys: ['businessName', 'primarySegment'],
        message: 'Known facts: businessName, primarySegment',
      });

      const result = await service.getProgress('tenant-1');

      // Only businessName should be counted as an intake answer
      expect(result.answeredQuestionIds).toEqual(['businessName']);
      expect(result.completedCount).toBe(1);
      // Non-intake facts should not appear in answers
      expect(result.answers).not.toHaveProperty('primarySegment');
    });

    it('returns null nextQuestionId when all questions answered', async () => {
      // Build a facts object with ALL questions answered (required + optional)
      const allIds = INTAKE_QUESTIONS.map((q) => q.id);
      const facts: Record<string, string> = {};
      for (const id of allIds) {
        facts[id] = 'test value';
      }

      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts,
        factCount: allIds.length,
        factKeys: allIds,
        message: `Known facts: ${allIds.join(', ')}`,
      });

      const result = await service.getProgress('tenant-1');

      expect(result.nextQuestionId).toBeNull();
    });
  });

  // ==========================================================================
  // completeIntake
  // ==========================================================================

  describe('completeIntake', () => {
    it('advances status to BUILDING when all required questions answered', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant());

      // Build facts with all required questions answered
      const requiredIds = getRequiredQuestionIds();
      const facts: Record<string, string> = {};
      for (const id of requiredIds) {
        facts[id] = 'test value';
      }

      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts,
        factCount: requiredIds.length,
        factKeys: requiredIds,
        message: `Known facts: ${requiredIds.join(', ')}`,
      });

      const result = await service.completeIntake('tenant-1');

      expect(result.status).toBe('advanced_to_building');
      if (result.status === 'advanced_to_building') {
        expect(result.redirectTo).toBe('/onboarding/build');
      }

      // Verify status was updated
      expect(tenantRepo.update).toHaveBeenCalledWith('tenant-1', {
        onboardingStatus: 'BUILDING',
      });
    });

    it('returns missing_required when not all required questions answered', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant());

      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts: { businessName: 'Test Studio' },
        factCount: 1,
        factKeys: ['businessName'],
        message: 'Known facts: businessName',
      });

      const result = await service.completeIntake('tenant-1');

      expect(result.status).toBe('missing_required');
      if (result.status === 'missing_required') {
        expect(result.missingQuestions.length).toBeGreaterThan(0);
        // businessName is answered, so it should NOT be in missing list
        expect(result.missingQuestions).not.toContain('businessName');
      }

      // Should NOT update tenant
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('returns already_completed if status is not PENDING_INTAKE', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant({ onboardingStatus: 'BUILDING' }));

      const result = await service.completeIntake('tenant-1');

      expect(result.status).toBe('already_completed');
      if (result.status === 'already_completed') {
        expect(result.currentStatus).toBe('BUILDING');
      }

      // Should NOT update tenant
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('returns already_completed for COMPLETE status', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant({ onboardingStatus: 'COMPLETE' }));

      const result = await service.completeIntake('tenant-1');

      expect(result.status).toBe('already_completed');
      if (result.status === 'already_completed') {
        expect(result.currentStatus).toBe('COMPLETE');
      }
    });

    it('throws error when tenant not found', async () => {
      tenantRepo.findById.mockResolvedValue(null);

      await expect(service.completeIntake('nonexistent')).rejects.toThrow(
        'Tenant not found: nonexistent'
      );
    });

    it('does not include optional questions in missing_required', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant());

      // Answer all required questions but NOT the optional websiteUrl
      const requiredIds = getRequiredQuestionIds();
      const facts: Record<string, string> = {};
      for (const id of requiredIds) {
        facts[id] = 'test value';
      }

      discoveryService.getDiscoveryFacts.mockResolvedValue({
        success: true,
        facts,
        factCount: requiredIds.length,
        factKeys: requiredIds,
        message: `Known facts: ${requiredIds.join(', ')}`,
      });

      const result = await service.completeIntake('tenant-1');

      // Should succeed — optional questions don't block completion
      expect(result.status).toBe('advanced_to_building');
    });
  });
});
