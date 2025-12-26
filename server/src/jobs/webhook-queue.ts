/**
 * BullMQ Webhook Job Queue
 *
 * Handles async webhook processing to respond quickly to Stripe
 * (which has a 5-second timeout limit).
 *
 * Key features:
 * - Queue webhook events for background processing
 * - Graceful fallback to synchronous processing when Redis unavailable
 * - Retry logic with exponential backoff
 * - Graceful shutdown support
 */

import type { Job } from 'bullmq';
import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import IORedis from 'ioredis';
import { logger } from '../lib/core/logger';
import type { WebhookJobData } from './types';
import type { WebhookProcessor } from './webhook-processor';

// Re-export for backwards compatibility
export type { WebhookJobData } from './types';

// Queue configuration
const QUEUE_NAME = 'webhook-processing';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds base delay

/**
 * WebhookQueue - Manages async webhook processing
 *
 * Usage:
 * 1. Initialize with Redis connection
 * 2. Enqueue webhook events with add()
 * 3. Worker processes events in background
 * 4. Call shutdown() during graceful shutdown
 */
export class WebhookQueue {
  private queue: Queue<WebhookJobData> | null = null;
  private worker: Worker<WebhookJobData> | null = null;
  private connection: Redis | null = null;
  private isRedisAvailable = false;

  /**
   * Initialize the queue with Redis connection
   * Falls back to sync mode if Redis is unavailable
   */
  async initialize(redisUrl?: string): Promise<boolean> {
    if (!redisUrl) {
      logger.warn('REDIS_URL not configured - webhook processing will be synchronous');
      this.isRedisAvailable = false;
      return false;
    }

    try {
      // Create Redis connection with timeout
      this.connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: true,
        connectTimeout: 5000,
        lazyConnect: true,
      });

      // Test connection with timeout
      await Promise.race([
        this.connection.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
        ),
      ]);

      // Ping to verify connection
      await this.connection.ping();

      this.isRedisAvailable = true;
      logger.info({ redisUrl: this.maskRedisUrl(redisUrl) }, 'Redis connection established');

      // Create queue
      this.queue = new Queue<WebhookJobData>(QUEUE_NAME, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: MAX_RETRIES,
          backoff: {
            type: 'exponential',
            delay: RETRY_DELAY_MS,
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000, // Keep last 1000 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          },
        },
      });

      logger.info('Webhook queue initialized');
      return true;
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Redis connection failed - webhook processing will be synchronous'
      );
      this.isRedisAvailable = false;

      // Clean up failed connection
      if (this.connection) {
        try {
          await this.connection.quit();
        } catch {
          // Ignore cleanup errors
        }
        this.connection = null;
      }

      return false;
    }
  }

  /**
   * Start the worker to process webhook jobs
   * Must be called after initialize()
   */
  startWorker(processor: (job: Job<WebhookJobData>) => Promise<void>): void {
    if (!this.isRedisAvailable || !this.connection) {
      logger.info('Skipping worker start - Redis not available');
      return;
    }

    // Create worker with same connection
    this.worker = new Worker<WebhookJobData>(
      QUEUE_NAME,
      async (job) => {
        logger.info(
          { jobId: job.id, eventId: job.data.eventId, attempt: job.attemptsMade + 1 },
          'Processing webhook job'
        );

        try {
          await processor(job);
          logger.info(
            { jobId: job.id, eventId: job.data.eventId },
            'Webhook job completed successfully'
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(
            {
              jobId: job.id,
              eventId: job.data.eventId,
              attempt: job.attemptsMade + 1,
              maxAttempts: MAX_RETRIES,
              error: errorMessage,
            },
            'Webhook job failed'
          );
          throw error; // Re-throw to trigger retry
        }
      },
      {
        connection: this.connection,
        concurrency: 5, // Process up to 5 webhooks concurrently
        autorun: true,
        // Stalled job detection - recover jobs if worker crashes mid-processing
        stalledInterval: 30000, // Check for stalled jobs every 30s
        lockDuration: 30000, // Job lock expires after 30s if worker crashes
      }
    );

    // Event handlers for monitoring
    this.worker.on('completed', (job) => {
      logger.info({ jobId: job.id, eventId: job.data.eventId }, 'Webhook job completed');
    });

    this.worker.on('failed', (job, error) => {
      if (job) {
        logger.error(
          {
            jobId: job.id,
            eventId: job.data.eventId,
            attempts: job.attemptsMade,
            error: error.message,
          },
          'Webhook job failed permanently'
        );
      }
    });

    this.worker.on('error', (error) => {
      logger.error({ error: error.message }, 'Webhook worker error');
    });

    logger.info('Webhook worker started');
  }

  /**
   * Add a webhook event to the queue for processing
   * Falls back to synchronous processing if Redis unavailable
   */
  async add(data: WebhookJobData): Promise<{ queued: boolean; jobId?: string }> {
    if (!this.isRedisAvailable || !this.queue) {
      // Fallback: process synchronously
      logger.info(
        { eventId: data.eventId },
        'Redis unavailable - processing webhook synchronously'
      );
      return { queued: false };
    }

    try {
      const job = await this.queue.add('process-webhook', data, {
        jobId: data.eventId, // Use eventId as job ID for deduplication
      });

      logger.info({ eventId: data.eventId, jobId: job.id }, 'Webhook job enqueued');

      return { queued: true, jobId: job.id };
    } catch (error) {
      // If queue add fails, fall back to sync processing
      logger.warn(
        { eventId: data.eventId, error: error instanceof Error ? error.message : String(error) },
        'Failed to enqueue webhook - will process synchronously'
      );
      return { queued: false };
    }
  }

  /**
   * Check if async processing is available
   */
  isAsyncAvailable(): boolean {
    return this.isRedisAvailable;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  } | null> {
    if (!this.queue) {
      return null;
    }

    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
      ]);

      return { waiting, active, completed, failed };
    } catch (error) {
      logger.warn({ error }, 'Failed to get queue stats');
      return null;
    }
  }

  /**
   * Graceful shutdown - close worker and queue
   */
  async shutdown(): Promise<void> {
    logger.info('Starting webhook queue shutdown');

    try {
      // Close worker first (stop processing new jobs)
      if (this.worker) {
        await this.worker.close();
        this.worker = null;
        logger.info('Webhook worker closed');
      }

      // Close queue
      if (this.queue) {
        await this.queue.close();
        this.queue = null;
        logger.info('Webhook queue closed');
      }

      // Close Redis connection
      if (this.connection) {
        await this.connection.quit();
        this.connection = null;
        logger.info('Redis connection closed');
      }

      this.isRedisAvailable = false;
      logger.info('Webhook queue shutdown completed');
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error during webhook queue shutdown'
      );
      throw error;
    }
  }

  /**
   * Mask Redis URL for logging (hide password)
   */
  private maskRedisUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.password) {
        parsed.password = '***';
      }
      return parsed.toString();
    } catch {
      return '(invalid URL)';
    }
  }
}

/**
 * Create the webhook queue (synchronous)
 * Call initialize() separately to connect to Redis
 */
export function createWebhookQueue(): WebhookQueue {
  return new WebhookQueue();
}

/**
 * Initialize and start the webhook queue with worker
 * Call this during app startup after DI container is built
 *
 * @param queue - WebhookQueue instance from createWebhookQueue
 * @param processor - Webhook processor from WebhooksController.getProcessor()
 * @param redisUrl - Redis connection URL (optional - sync fallback if not provided)
 */
export async function initializeWebhookQueue(
  queue: WebhookQueue,
  processor: WebhookProcessor,
  redisUrl?: string
): Promise<void> {
  const initialized = await queue.initialize(redisUrl);

  if (initialized) {
    // Start worker with processor
    queue.startWorker(async (job) => {
      await processor.processJob(job);
    });
  }
}
