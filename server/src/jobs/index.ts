/**
 * Jobs Module - Background job processing with BullMQ
 *
 * This module provides async webhook processing to respond quickly to Stripe
 * webhooks (which have a 5-second timeout limit).
 *
 * Key exports:
 * - WebhookQueue: Queue for async webhook processing
 * - WebhookProcessor: Business logic for processing webhook events
 * - createWebhookQueue: Factory function for creating the queue
 * - initializeWebhookQueue: Initialize queue with Redis connection
 * - Cleanup jobs: Session and proposal cleanup utilities
 */

export { WebhookQueue, createWebhookQueue, initializeWebhookQueue } from './webhook-queue';
export { WebhookProcessor } from './webhook-processor';
export type { WebhookJobData } from './webhook-queue';

// Cleanup jobs for expired sessions and proposals
export {
  cleanupExpiredSessions,
  cleanupExpiredProposals,
  runAllCleanupJobs,
  startCleanupScheduler,
} from './cleanup';
