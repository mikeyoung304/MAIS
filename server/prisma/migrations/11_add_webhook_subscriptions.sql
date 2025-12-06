-- Migration 11: Add Custom Webhook Subscriptions (TODO-278)
-- Allows tenants to configure custom webhook endpoints for appointment lifecycle events
-- Implements Acuity Scheduling parity for outbound webhooks

-- Create WebhookSubscription table
CREATE TABLE IF NOT EXISTS "WebhookSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[] NOT NULL,
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique constraint for tenant + URL (one subscription per URL per tenant)
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookSubscription_tenantId_url_key" ON "WebhookSubscription"("tenantId", "url");

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "WebhookSubscription_tenantId_active_idx" ON "WebhookSubscription"("tenantId", "active");
CREATE INDEX IF NOT EXISTS "WebhookSubscription_tenantId_idx" ON "WebhookSubscription"("tenantId");

-- Create WebhookDelivery table for tracking outbound webhook deliveries
CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for delivery tracking and retry logic
CREATE INDEX IF NOT EXISTS "WebhookDelivery_subscriptionId_status_idx" ON "WebhookDelivery"("subscriptionId", "status");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_status_createdAt_idx" ON "WebhookDelivery"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_subscriptionId_idx" ON "WebhookDelivery"("subscriptionId");
