/**
 * Event Sourcing for Onboarding Agent
 *
 * Provides audit trail and state reconstruction for tenant onboarding.
 * Uses Prisma transactions with optimistic locking for concurrent modification safety.
 *
 * Key Features:
 * - getNextVersion: Sequential versioning for event ordering (Kieran Fix #3)
 * - Optimistic locking with updateMany + count check (Kieran Fix #2)
 * - Runtime Zod.parse() validation for event payloads (Kieran Fix #7)
 *
 * @see CLAUDE.md for double-booking prevention pattern (similar approach)
 */

import type { PrismaClient, Prisma } from '../../generated/prisma/client';
import {
  type OnboardingEventType,
  type OnboardingEventPayloads,
  type OnboardingPhase,
  EventPayloadSchemas,
} from '@macon/contracts';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of appending an event
 */
export type AppendEventResult =
  | { success: true; eventId: string; version: number }
  | { success: false; error: 'CONCURRENT_MODIFICATION'; currentVersion: number }
  | { success: false; error: 'VALIDATION_ERROR'; message: string }
  | { success: false; error: 'DATABASE_ERROR'; message: string };

/**
 * Result of updating onboarding phase
 */
export type UpdatePhaseResult =
  | { success: true; phase: OnboardingPhase; version: number }
  | { success: false; error: 'CONCURRENT_MODIFICATION'; currentVersion: number }
  | {
      success: false;
      error: 'INVALID_TRANSITION';
      currentPhase: OnboardingPhase;
      attemptedPhase: OnboardingPhase;
    };

// ============================================================================
// Version Management (Fix #3: getNextVersion function)
// ============================================================================

/**
 * Get the next sequential version for a tenant's onboarding events.
 * Uses aggregate query to find max version and increment.
 *
 * @param tx - Prisma transaction client
 * @param tenantId - Tenant ID for isolation
 * @returns Next version number (1 if no events exist)
 *
 * @example
 * ```typescript
 * const version = await getNextVersion(tx, 'tenant_123');
 * // Returns 1 for first event, 2 for second, etc.
 * ```
 */
export async function getNextVersion(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<number> {
  const result = await tx.onboardingEvent.aggregate({
    where: { tenantId },
    _max: { version: true },
  });

  return (result._max.version ?? 0) + 1;
}

// ============================================================================
// Event Payload Validation (Fix #7: Runtime Zod.parse())
// ============================================================================

/**
 * Validate event payload at runtime using Zod.parse().
 * Throws ZodError if validation fails (not just type assertion).
 *
 * @param eventType - The type of event
 * @param payload - The payload to validate
 * @returns The validated and typed payload
 * @throws ZodError if payload doesn't match schema
 *
 * @example
 * ```typescript
 * // This will throw if payload is invalid
 * const validatedPayload = validateEventPayload('DISCOVERY_COMPLETED', rawPayload);
 * ```
 */
export function validateEventPayload<T extends OnboardingEventType>(
  eventType: T,
  payload: unknown
): OnboardingEventPayloads[T] {
  const schema = EventPayloadSchemas[eventType];

  // Use parse() which throws on invalid data (not safeParse which returns success/error)
  return schema.parse(payload) as OnboardingEventPayloads[T];
}

/**
 * Safe version that returns a result object instead of throwing
 */
export function safeValidateEventPayload<T extends OnboardingEventType>(
  eventType: T,
  payload: unknown
): { success: true; data: OnboardingEventPayloads[T] } | { success: false; error: string } {
  try {
    const schema = EventPayloadSchemas[eventType];
    const validated = schema.parse(payload);
    return { success: true, data: validated as OnboardingEventPayloads[T] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown validation error';
    return { success: false, error: message };
  }
}

// ============================================================================
// Event Appending with Optimistic Locking (Fix #2)
// ============================================================================

/**
 * Append an event to the onboarding event log with optimistic locking.
 *
 * Uses updateMany + count check to detect concurrent modifications.
 * This is more reliable than update() which silently succeeds even when
 * the version doesn't match.
 *
 * @param prisma - Prisma client
 * @param tenantId - Tenant ID (for isolation)
 * @param eventType - Type of event
 * @param payload - Event payload (validated by Zod)
 * @param expectedVersion - Expected current version (for optimistic locking)
 *
 * @example
 * ```typescript
 * const result = await appendEvent(
 *   prisma,
 *   'tenant_123',
 *   'DISCOVERY_COMPLETED',
 *   { businessType: 'photographer', ... },
 *   0 // Expect version 0 (no events yet)
 * );
 *
 * if (!result.success && result.error === 'CONCURRENT_MODIFICATION') {
 *   // Handle conflict - another request modified the state
 * }
 * ```
 */
export async function appendEvent<T extends OnboardingEventType>(
  prisma: PrismaClient,
  tenantId: string,
  eventType: T,
  payload: OnboardingEventPayloads[T],
  expectedVersion: number
): Promise<AppendEventResult> {
  try {
    // Validate payload at runtime (Fix #7)
    const validationResult = safeValidateEventPayload(eventType, payload);
    if (!validationResult.success) {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: validationResult.error,
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Check version with optimistic locking (Fix #2)
      // Use updateMany which returns count, unlike update which throws
      const lockResult = await tx.tenant.updateMany({
        where: {
          id: tenantId,
          onboardingVersion: expectedVersion, // Only update if version matches
        },
        data: {
          onboardingVersion: expectedVersion + 1,
        },
      });

      // Step 2: Check if lock was acquired
      if (lockResult.count === 0) {
        // Version mismatch - concurrent modification detected
        const current = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { onboardingVersion: true },
        });

        return {
          success: false as const,
          error: 'CONCURRENT_MODIFICATION' as const,
          currentVersion: current?.onboardingVersion ?? 0,
        };
      }

      // Step 3: Get next event version (Fix #3)
      const nextVersion = await getNextVersion(tx, tenantId);

      // Step 4: Create the event
      const event = await tx.onboardingEvent.create({
        data: {
          tenantId,
          eventType,
          payload: validationResult.data as Prisma.InputJsonValue,
          version: nextVersion,
        },
      });

      logger.info(
        {
          tenantId,
          eventType,
          eventId: event.id,
          version: nextVersion,
        },
        'Onboarding event appended'
      );

      return {
        success: true as const,
        eventId: event.id,
        version: nextVersion,
      };
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    logger.error(
      { error: sanitizeError(error), tenantId, eventType },
      'Failed to append onboarding event'
    );

    return {
      success: false,
      error: 'DATABASE_ERROR',
      message,
    };
  }
}

// ============================================================================
// Phase Updates with Optimistic Locking
// ============================================================================

/**
 * Valid phase transitions (state machine rules)
 */
const VALID_TRANSITIONS: Record<OnboardingPhase, OnboardingPhase[]> = {
  NOT_STARTED: ['DISCOVERY', 'SKIPPED'],
  DISCOVERY: ['MARKET_RESEARCH', 'SKIPPED'],
  MARKET_RESEARCH: ['SERVICES', 'DISCOVERY', 'SKIPPED'],
  SERVICES: ['MARKETING', 'MARKET_RESEARCH', 'COMPLETED', 'SKIPPED'],
  MARKETING: ['COMPLETED', 'SERVICES', 'SKIPPED'],
  COMPLETED: [], // Final state
  SKIPPED: [], // Final state
};

/**
 * Update tenant's onboarding phase with optimistic locking.
 * Validates state machine transitions before applying.
 *
 * @param prisma - Prisma client
 * @param tenantId - Tenant ID
 * @param newPhase - Target phase
 * @param expectedVersion - Expected current version
 */
export async function updateOnboardingPhase(
  prisma: PrismaClient,
  tenantId: string,
  newPhase: OnboardingPhase,
  expectedVersion: number
): Promise<UpdatePhaseResult> {
  const result = await prisma.$transaction(async (tx) => {
    // Get current state
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingPhase: true, onboardingVersion: true },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const currentPhase = tenant.onboardingPhase;

    // Validate transition
    const validNextPhases = VALID_TRANSITIONS[currentPhase];
    if (!validNextPhases.includes(newPhase)) {
      return {
        success: false as const,
        error: 'INVALID_TRANSITION' as const,
        currentPhase,
        attemptedPhase: newPhase,
      };
    }

    // Apply optimistic locking (Fix #2)
    const updateResult = await tx.tenant.updateMany({
      where: {
        id: tenantId,
        onboardingVersion: expectedVersion,
      },
      data: {
        onboardingPhase: newPhase,
        onboardingVersion: expectedVersion + 1,
        // Set completedAt if transitioning to final state
        ...(newPhase === 'COMPLETED' || newPhase === 'SKIPPED'
          ? { onboardingCompletedAt: new Date() }
          : {}),
      },
    });

    if (updateResult.count === 0) {
      // Concurrent modification
      const current = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { onboardingVersion: true },
      });

      return {
        success: false as const,
        error: 'CONCURRENT_MODIFICATION' as const,
        currentVersion: current?.onboardingVersion ?? 0,
      };
    }

    logger.info(
      {
        tenantId,
        fromPhase: currentPhase,
        toPhase: newPhase,
        version: expectedVersion + 1,
      },
      'Onboarding phase updated'
    );

    return {
      success: true as const,
      phase: newPhase,
      version: expectedVersion + 1,
    };
  });

  return result;
}

// ============================================================================
// State Projection from Events
// ============================================================================
// NOTE: Use AdvisorMemoryRepository.projectFromEvents() and .getEventHistory()
// instead of standalone functions. The repository pattern enables:
// - Dependency injection for testability
// - Mock implementations for unit tests
// - Consistent interface across adapters
//
// See: server/src/adapters/prisma/advisor-memory.repository.ts
// See: server/src/lib/ports.ts (AdvisorMemoryRepository interface)
