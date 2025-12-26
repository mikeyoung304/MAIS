/**
 * Shared types for webhook job processing
 *
 * Extracted to prevent circular dependencies between
 * webhook-queue.ts and webhook-processor.ts
 */

/**
 * Job data structure for webhook processing
 */
export interface WebhookJobData {
  eventId: string;
  tenantId: string;
  rawPayload: string;
  signature: string;
}
