/**
 * Webhook Port — Webhook event tracking, deduplication, and subscription management
 */

/**
 * Webhook Repository - Webhook event tracking and deduplication
 */
export interface WebhookRepository {
  /**
   * Records a webhook event. Returns true if this is a new record, false if duplicate.
   * Used for idempotency - if false, caller should return early (duplicate detected).
   */
  recordWebhook(input: {
    tenantId: string;
    eventId: string;
    eventType: string;
    rawPayload: string;
  }): Promise<boolean>;
  markProcessed(tenantId: string, eventId: string): Promise<void>;
  markFailed(tenantId: string, eventId: string, errorMessage: string): Promise<void>;
  isDuplicate(tenantId: string, eventId: string): Promise<boolean>;
}

/**
 * Webhook Subscription Repository - Custom webhook subscriptions for tenants
 */
export interface WebhookSubscriptionRepository {
  /**
   * Create a new webhook subscription
   */
  create(
    tenantId: string,
    data: {
      url: string;
      events: string[];
      secret: string;
    }
  ): Promise<WebhookSubscription>;

  /**
   * Find all webhook subscriptions for a tenant
   */
  findAll(tenantId: string): Promise<WebhookSubscriptionListItem[]>;

  /**
   * Find webhook subscription by ID
   */
  findById(tenantId: string, id: string): Promise<WebhookSubscription | null>;

  /**
   * Find active subscriptions for a specific event type
   */
  findActiveByEvent(tenantId: string, eventType: string): Promise<WebhookSubscriptionForDelivery[]>;

  /**
   * Update webhook subscription
   */
  update(
    tenantId: string,
    id: string,
    data: {
      url?: string;
      events?: string[];
      active?: boolean;
    }
  ): Promise<WebhookSubscriptionListItem>;

  /**
   * Delete webhook subscription
   */
  delete(tenantId: string, id: string): Promise<void>;

  /**
   * Create a webhook delivery record
   */
  createDelivery(data: {
    subscriptionId: string;
    event: string;
    payload: Record<string, any>;
  }): Promise<WebhookDeliveryRecord>;

  /**
   * Mark delivery as delivered
   */
  markDelivered(deliveryId: string): Promise<void>;

  /**
   * Mark delivery as failed
   */
  markFailed(deliveryId: string, error: string): Promise<void>;

  /**
   * Find deliveries by subscription
   */
  findDeliveriesBySubscription(
    tenantId: string,
    subscriptionId: string,
    limit?: number
  ): Promise<WebhookDeliveryListItem[]>;
}

/**
 * Full webhook subscription with secret (used internally)
 */
export interface WebhookSubscription {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook subscription for list view (excludes secret)
 */
export interface WebhookSubscriptionListItem {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook subscription for delivery (minimal data)
 */
export interface WebhookSubscriptionForDelivery {
  id: string;
  url: string;
  secret: string;
}

/**
 * Webhook delivery record (minimal for creation)
 */
export interface WebhookDeliveryRecord {
  id: string;
  subscriptionId: string;
  event: string;
  status: string;
}

/**
 * Webhook delivery for list view
 */
export interface WebhookDeliveryListItem {
  id: string;
  event: string;
  status: string;
  attempts: number;
  createdAt: Date;
  deliveredAt: Date | null;
  lastError: string | null;
}
