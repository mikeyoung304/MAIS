/**
 * Project Hub Agent Schemas
 *
 * Type-safe schemas for the Project Hub dual-faced communication system.
 * Provides contracts for customer-tenant communication post-booking.
 *
 * Architecture:
 * - Discriminated unions for request types (type-safe payload validation)
 * - Bootstrap response schemas for context initialization
 * - Request/response schemas for all 9 backend endpoints
 */

import { z } from 'zod';

// ============================================================================
// Project Status & Request Status Enums
// ============================================================================

/**
 * Project status enum - matches Prisma ProjectStatus
 */
export const ProjectStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD']);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

/**
 * Request status enum - matches Prisma RequestStatus
 */
export const RequestStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'DENIED',
  'AUTO_HANDLED',
  'EXPIRED',
]);

export type RequestStatus = z.infer<typeof RequestStatusSchema>;

/**
 * Request type enum - matches Prisma RequestType
 */
export const RequestTypeSchema = z.enum([
  'RESCHEDULE',
  'ADD_ON',
  'QUESTION',
  'CHANGE_REQUEST',
  'CANCELLATION',
  'REFUND',
  'OTHER',
]);

export type RequestType = z.infer<typeof RequestTypeSchema>;

/**
 * Actor enum - matches Prisma ProjectActor
 */
export const ProjectActorSchema = z.enum(['CUSTOMER', 'TENANT', 'AGENT', 'SYSTEM']);

export type ProjectActor = z.infer<typeof ProjectActorSchema>;

// ============================================================================
// Request Payload Discriminated Union (Type-Safe Request Data)
// ============================================================================

/**
 * Request payload discriminated union - ensures type/payload alignment
 *
 * Each request type has specific required fields:
 * - CANCELLATION and REFUND require `confirmationReceived` (T3 confirmation)
 * - RESCHEDULE requires `newDate` and `reason`
 * - ADD_ON requires `addOnId`
 * - QUESTION requires `question`
 */
export const ProjectRequestPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('RESCHEDULE'),
    newDate: z.string().describe('Requested new date in ISO format'),
    reason: z.string().describe('Reason for rescheduling'),
  }),
  z.object({
    type: z.literal('ADD_ON'),
    addOnId: z.string().describe('ID of the add-on to request'),
    notes: z.string().optional().describe('Additional notes about the add-on request'),
  }),
  z.object({
    type: z.literal('QUESTION'),
    question: z.string().describe('Customer question'),
  }),
  z.object({
    type: z.literal('CHANGE_REQUEST'),
    description: z.string().describe('Description of the requested change'),
  }),
  z.object({
    type: z.literal('CANCELLATION'),
    reason: z.string().describe('Reason for cancellation'),
    confirmationReceived: z.boolean().describe('T3: Customer explicitly confirmed cancellation'),
  }),
  z.object({
    type: z.literal('REFUND'),
    reason: z.string().describe('Reason for refund request'),
    confirmationReceived: z.boolean().describe('T3: Customer explicitly confirmed refund request'),
  }),
  z.object({
    type: z.literal('OTHER'),
    description: z.string().describe('Description of the request'),
  }),
]);

export type ProjectRequestPayload = z.infer<typeof ProjectRequestPayloadSchema>;

// ============================================================================
// Checklist Item Schema
// ============================================================================

/**
 * Checklist item schema - preparation tasks for customers
 */
export const ChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
  completedAt: z.date().optional(),
  category: z.enum(['prep', 'documents', 'logistics']).optional(),
});

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

// ============================================================================
// Bootstrap Response Schemas
// ============================================================================

/**
 * Customer bootstrap response - returned when initializing customer context
 */
export const CustomerBootstrapSchema = z.object({
  project: z.object({
    id: z.string(),
    status: ProjectStatusSchema,
    bookingDate: z.string().describe('ISO datetime of the booking'),
    serviceName: z.string(),
  }),
  hasPendingRequests: z.boolean(),
  pendingRequestCount: z.number().int().min(0),
  greeting: z.string().describe('Personalized greeting message'),
});

export type CustomerBootstrap = z.infer<typeof CustomerBootstrapSchema>;

/**
 * Tenant bootstrap response - returned when initializing tenant context
 */
export const TenantBootstrapSchema = z.object({
  activeProjectCount: z.number().int().min(0),
  pendingRequestCount: z.number().int().min(0),
  recentActivityCount: z.number().int().min(0).optional(),
  greeting: z.string().describe('Personalized greeting message'),
});

export type TenantBootstrap = z.infer<typeof TenantBootstrapSchema>;

// ============================================================================
// Project & Request Response Schemas
// ============================================================================

/**
 * Project details response
 */
export const ProjectDetailsSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  status: ProjectStatusSchema,
  version: z.number().int().min(1),
  customerPreferences: z.record(z.unknown()).nullable(),
  tenantNotes: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  booking: z.object({
    id: z.string(),
    eventDate: z.date(),
    tier: z.object({
      id: z.string(),
      name: z.string(),
      priceCents: z.number().int(),
    }),
    customer: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  }),
});

export type ProjectDetails = z.infer<typeof ProjectDetailsSchema>;

/**
 * Project request response (for tenant pending requests view)
 */
export const ProjectRequestResponseSchema = z.object({
  id: z.string(),
  type: RequestTypeSchema,
  status: RequestStatusSchema,
  requestData: z.record(z.unknown()),
  responseData: z.record(z.unknown()).nullable(),
  expiresAt: z.date(),
  createdAt: z.date(),
  version: z.number().int().min(1),
  project: z
    .object({
      id: z.string(),
      booking: z.object({
        eventDate: z.date(),
        customer: z.object({
          name: z.string(),
          email: z.string(),
        }),
        tier: z.object({
          name: z.string(),
        }),
      }),
    })
    .optional(),
});

export type ProjectRequestResponse = z.infer<typeof ProjectRequestResponseSchema>;

// ============================================================================
// Timeline Event Schema
// ============================================================================

/**
 * Project event schema - for timeline display
 */
export const ProjectEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  actor: ProjectActorSchema,
  payload: z.record(z.unknown()),
  visibleToCustomer: z.boolean(),
  visibleToTenant: z.boolean(),
  createdAt: z.date(),
});

export type ProjectEvent = z.infer<typeof ProjectEventSchema>;

// ============================================================================
// API Input Schemas (for endpoint validation)
// ============================================================================

/**
 * Create request input
 */
export const CreateRequestInputSchema = z.object({
  tenantId: z.string(),
  projectId: z.string(),
  payload: ProjectRequestPayloadSchema,
});

export type CreateRequestInput = z.infer<typeof CreateRequestInputSchema>;

/**
 * Approve/Deny request input (with optimistic locking)
 */
export const HandleRequestInputSchema = z.object({
  tenantId: z.string(),
  requestId: z.string(),
  response: z.string().optional().describe('Optional response message to customer'),
  expectedVersion: z.number().int().min(1).describe('For optimistic locking'),
});

export type HandleRequestInput = z.infer<typeof HandleRequestInputSchema>;

/**
 * Deny request input (requires reason)
 */
export const DenyRequestInputSchema = HandleRequestInputSchema.extend({
  reason: z.string().min(1).describe('Reason for denial'),
});

export type DenyRequestInput = z.infer<typeof DenyRequestInputSchema>;

// ============================================================================
// Result Types (Union-Based Error Handling)
// ============================================================================

/**
 * Create request result
 */
export const CreateRequestResultSchema = z.union([
  z.object({
    success: z.literal(true),
    request: ProjectRequestResponseSchema.omit({ project: true }),
    expiresAt: z.date(),
  }),
  z.object({
    requiresConfirmation: z.literal(true),
    message: z.string().describe('Confirmation prompt for T3 actions'),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type CreateRequestResult = z.infer<typeof CreateRequestResultSchema>;

/**
 * Handle request result (approve/deny)
 */
export const HandleRequestResultSchema = z.union([
  z.object({
    success: z.literal(true),
    request: ProjectRequestResponseSchema.omit({ project: true }),
  }),
  z.object({
    success: z.literal(false),
    error: z.literal('CONCURRENT_MODIFICATION'),
    currentVersion: z.number().int(),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.literal('NOT_FOUND'),
    message: z.string(),
  }),
]);

export type HandleRequestResult = z.infer<typeof HandleRequestResultSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a request type requires T3 confirmation
 */
export function requiresT3Confirmation(type: RequestType): boolean {
  return type === 'CANCELLATION' || type === 'REFUND';
}

/**
 * Safely parse project status from unknown value
 */
export function parseProjectStatus(value: unknown): ProjectStatus {
  const result = ProjectStatusSchema.safeParse(value);
  return result.success ? result.data : 'ACTIVE';
}

/**
 * Safely parse request status from unknown value
 */
export function parseRequestStatus(value: unknown): RequestStatus {
  const result = RequestStatusSchema.safeParse(value);
  return result.success ? result.data : 'PENDING';
}
