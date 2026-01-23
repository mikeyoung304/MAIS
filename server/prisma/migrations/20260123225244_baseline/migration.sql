-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'PLATFORM_ADMIN', 'TENANT_ADMIN');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'DEPOSIT_PAID', 'PAID', 'CONFIRMED', 'CANCELED', 'REFUNDED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('DATE', 'TIMESLOT');

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('CUSTOMER', 'TENANT', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'TRIALING', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STARTER', 'PRO');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "AgentTrustTier" AS ENUM ('T1', 'T2', 'T3');

-- CreateEnum
CREATE TYPE "AgentProposalStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXECUTED', 'EXPIRED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentApprovalStatus" AS ENUM ('AUTO', 'SOFT', 'EXPLICIT', 'BYPASSED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('ADMIN', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "OnboardingPhase" AS ENUM ('NOT_STARTED', 'DISCOVERY', 'MARKET_RESEARCH', 'SERVICES', 'MARKETING', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ProjectEventType" AS ENUM ('PROJECT_CREATED', 'STATUS_CHANGED', 'MESSAGE_FROM_CUSTOMER', 'MESSAGE_FROM_TENANT', 'MESSAGE_FROM_AGENT', 'REQUEST_SUBMITTED', 'REQUEST_APPROVED', 'REQUEST_DENIED', 'REQUEST_AUTO_HANDLED', 'REQUEST_EXPIRED', 'FILE_UPLOADED', 'FILE_DELETED', 'MILESTONE_COMPLETED', 'REMINDER_SENT');

-- CreateEnum
CREATE TYPE "ProjectActor" AS ENUM ('CUSTOMER', 'TENANT', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('REFERENCE_PHOTO', 'INSPIRATION', 'CONTRACT', 'INVOICE', 'DELIVERABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('RESCHEDULE', 'ADD_ON', 'QUESTION', 'CHANGE_REQUEST', 'CANCELLATION', 'REFUND', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'AUTO_HANDLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RequestHandler" AS ENUM ('AGENT', 'TENANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "apiKeyPublic" TEXT NOT NULL,
    "apiKeySecret" TEXT NOT NULL,
    "commissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 10.0,
    "branding" JSONB NOT NULL DEFAULT '{}',
    "primaryColor" TEXT NOT NULL DEFAULT '#1a365d',
    "secondaryColor" TEXT NOT NULL DEFAULT '#fb923c',
    "accentColor" TEXT NOT NULL DEFAULT '#38b2ac',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "stripeAccountId" TEXT,
    "stripeOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "stripeCustomerId" TEXT,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "aiMessagesUsed" INTEGER NOT NULL DEFAULT 0,
    "aiMessagesResetAt" TIMESTAMP(3),
    "secrets" JSONB NOT NULL DEFAULT '{}',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "depositPercent" DECIMAL(5,2),
    "balanceDueDays" INTEGER NOT NULL DEFAULT 30,
    "landingPageConfig" JSONB,
    "landingPageConfigDraft" JSONB,
    "landingPageConfigDraftVersion" INTEGER NOT NULL DEFAULT 0,
    "tierDisplayNames" JSONB DEFAULT '{}',
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "is_test_tenant" BOOLEAN NOT NULL DEFAULT false,
    "onboardingPhase" "OnboardingPhase" NOT NULL DEFAULT 'NOT_STARTED',
    "onboardingCompletedAt" TIMESTAMP(3),
    "onboardingVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantDomain" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "heroTitle" TEXT NOT NULL,
    "heroSubtitle" TEXT,
    "heroImage" TEXT,
    "description" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "segmentId" TEXT,
    "grouping" TEXT,
    "groupingOrder" INTEGER,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "draftTitle" TEXT,
    "draftDescription" TEXT,
    "draftPriceCents" INTEGER,
    "draftPhotos" JSONB,
    "hasDraft" BOOLEAN NOT NULL DEFAULT false,
    "draftUpdatedAt" TIMESTAMP(3),
    "bookingType" "BookingType" NOT NULL DEFAULT 'DATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddOn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "segmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageAddOn" (
    "packageId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,

    CONSTRAINT "PackageAddOn_pkey" PRIMARY KEY ("packageId","addOnId")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "packageId" TEXT,
    "venueId" TEXT,
    "confirmationCode" TEXT,
    "date" DATE NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "bookingType" "BookingType" NOT NULL DEFAULT 'DATE',
    "serviceId" TEXT,
    "clientTimezone" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "totalPrice" INTEGER NOT NULL,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "commissionAmount" INTEGER NOT NULL DEFAULT 0,
    "commissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "stripePaymentIntentId" TEXT,
    "googleEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" "CancelledBy",
    "cancellationReason" TEXT,
    "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NONE',
    "refundAmount" INTEGER,
    "refundedAt" TIMESTAMP(3),
    "stripeRefundId" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "reminderDueDate" TIMESTAMP(3),
    "depositPaidAmount" INTEGER,
    "balanceDueDate" TIMESTAMP(3),
    "balancePaidAmount" INTEGER,
    "balancePaidAt" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "priceCents" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "minNoticeMinutes" INTEGER NOT NULL DEFAULT 120,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "maxPerDay" INTEGER,
    "segmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAddOn" (
    "bookingId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,

    CONSTRAINT "BookingAddOn_pkey" PRIMARY KEY ("bookingId","addOnId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "processor" TEXT NOT NULL,
    "processorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackoutDate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlackoutDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarlyAccessRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EarlyAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigChangeLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" TEXT,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProposal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerId" TEXT,
    "toolName" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "trustTier" "AgentTrustTier" NOT NULL,
    "payload" JSONB NOT NULL,
    "preview" JSONB NOT NULL,
    "status" "AgentProposalStatus" NOT NULL DEFAULT 'PENDING',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "proposalId" TEXT,
    "inputSummary" VARCHAR(500) NOT NULL,
    "outputSummary" VARCHAR(500) NOT NULL,
    "trustTier" "AgentTrustTier" NOT NULL,
    "approvalStatus" "AgentApprovalStatus" NOT NULL,
    "durationMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionType" "SessionType" NOT NULL DEFAULT 'ADMIN',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" VARCHAR(500),

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSessionMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" VARCHAR(64),

    CONSTRAINT "AgentSessionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL,

    CONSTRAINT "OnboardingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTrace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "messages" JSONB NOT NULL,
    "toolCalls" JSONB NOT NULL,
    "errors" JSONB,
    "expiresAt" TIMESTAMP(3),
    "promptVersion" TEXT,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "taskCompleted" BOOLEAN,
    "userSatisfaction" INTEGER,
    "evalScore" DOUBLE PRECISION,
    "evalDimensions" JSONB,
    "evalReasoning" TEXT,
    "evalConfidence" DOUBLE PRECISION,
    "evaluatedAt" TIMESTAMP(3),
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "reviewStatus" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,

    CONSTRAINT "ConversationTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "traceId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "messageId" TEXT,
    "deviceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "correctedScore" DOUBLE PRECISION,
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "customerPreferences" JSONB,
    "tenantNotes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" "ProjectEventType" NOT NULL,
    "actor" "ProjectActor" NOT NULL,
    "payload" JSONB NOT NULL,
    "visibleToCustomer" BOOLEAN NOT NULL DEFAULT false,
    "visibleToTenant" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploadedBy" "ProjectActor" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "checksum" TEXT,
    "category" "FileCategory" NOT NULL DEFAULT 'OTHER',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestData" JSONB NOT NULL,
    "responseData" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "handledBy" "RequestHandler",
    "resolvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "autoRespondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_apiKeyPublic_key" ON "Tenant"("apiKeyPublic");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeAccountId_key" ON "Tenant"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeCustomerId_key" ON "Tenant"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_passwordResetToken_key" ON "Tenant"("passwordResetToken");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_apiKeyPublic_idx" ON "Tenant"("apiKeyPublic");

-- CreateIndex
CREATE INDEX "Tenant_isActive_idx" ON "Tenant"("isActive");

-- CreateIndex
CREATE INDEX "Tenant_is_test_tenant_idx" ON "Tenant"("is_test_tenant");

-- CreateIndex
CREATE UNIQUE INDEX "TenantDomain_domain_key" ON "TenantDomain"("domain");

-- CreateIndex
CREATE INDEX "TenantDomain_tenantId_idx" ON "TenantDomain"("tenantId");

-- CreateIndex
CREATE INDEX "TenantDomain_verified_idx" ON "TenantDomain"("verified");

-- CreateIndex
CREATE INDEX "TenantDomain_tenantId_isPrimary_idx" ON "TenantDomain"("tenantId", "isPrimary");

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE INDEX "Customer_tenantId_createdAt_idx" ON "Customer"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_email_key" ON "Customer"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Venue_tenantId_idx" ON "Venue"("tenantId");

-- CreateIndex
CREATE INDEX "Venue_tenantId_city_idx" ON "Venue"("tenantId", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_tenantId_name_key" ON "Venue"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Segment_tenantId_active_idx" ON "Segment"("tenantId", "active");

-- CreateIndex
CREATE INDEX "Segment_tenantId_sortOrder_idx" ON "Segment"("tenantId", "sortOrder");

-- CreateIndex
CREATE INDEX "Segment_tenantId_idx" ON "Segment"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Segment_tenantId_slug_key" ON "Segment"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Package_tenantId_active_idx" ON "Package"("tenantId", "active");

-- CreateIndex
CREATE INDEX "Package_tenantId_idx" ON "Package"("tenantId");

-- CreateIndex
CREATE INDEX "Package_tenantId_hasDraft_idx" ON "Package"("tenantId", "hasDraft");

-- CreateIndex
CREATE INDEX "Package_slug_idx" ON "Package"("slug");

-- CreateIndex
CREATE INDEX "Package_segmentId_idx" ON "Package"("segmentId");

-- CreateIndex
CREATE INDEX "Package_segmentId_grouping_idx" ON "Package"("segmentId", "grouping");

-- CreateIndex
CREATE INDEX "Package_segmentId_active_idx" ON "Package"("segmentId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Package_tenantId_slug_key" ON "Package"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "AddOn_tenantId_active_idx" ON "AddOn"("tenantId", "active");

-- CreateIndex
CREATE INDEX "AddOn_tenantId_idx" ON "AddOn"("tenantId");

-- CreateIndex
CREATE INDEX "AddOn_tenantId_segmentId_idx" ON "AddOn"("tenantId", "segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AddOn_tenantId_slug_key" ON "AddOn"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "PackageAddOn_packageId_idx" ON "PackageAddOn"("packageId");

-- CreateIndex
CREATE INDEX "PackageAddOn_addOnId_idx" ON "PackageAddOn"("addOnId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_confirmationCode_key" ON "Booking"("confirmationCode");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_stripePaymentIntentId_key" ON "Booking"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Booking_tenantId_status_idx" ON "Booking"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Booking_tenantId_date_idx" ON "Booking"("tenantId", "date");

-- CreateIndex
CREATE INDEX "Booking_tenantId_date_bookingType_idx" ON "Booking"("tenantId", "date", "bookingType");

-- CreateIndex
CREATE INDEX "Booking_tenantId_startTime_idx" ON "Booking"("tenantId", "startTime");

-- CreateIndex
CREATE INDEX "Booking_tenantId_status_date_idx" ON "Booking"("tenantId", "status", "date");

-- CreateIndex
CREATE INDEX "Booking_tenantId_idx" ON "Booking"("tenantId");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE INDEX "Booking_packageId_idx" ON "Booking"("packageId");

-- CreateIndex
CREATE INDEX "Booking_serviceId_idx" ON "Booking"("serviceId");

-- CreateIndex
CREATE INDEX "Booking_venueId_idx" ON "Booking"("venueId");

-- CreateIndex
CREATE INDEX "Booking_stripePaymentIntentId_idx" ON "Booking"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Booking_googleEventId_idx" ON "Booking"("googleEventId");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");

-- CreateIndex
CREATE INDEX "Booking_tenantId_confirmedAt_idx" ON "Booking"("tenantId", "confirmedAt");

-- CreateIndex
CREATE INDEX "Booking_tenantId_reminderDueDate_reminderSentAt_status_idx" ON "Booking"("tenantId", "reminderDueDate", "reminderSentAt", "status");

-- CreateIndex
CREATE INDEX "Booking_tenantId_bookingType_startTime_endTime_idx" ON "Booking"("tenantId", "bookingType", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Booking_tenantId_serviceId_startTime_idx" ON "Booking"("tenantId", "serviceId", "startTime");

-- CreateIndex
CREATE INDEX "Booking_tenantId_bookingType_startTime_status_idx" ON "Booking"("tenantId", "bookingType", "startTime", "status");

-- CreateIndex
CREATE INDEX "Booking_tenantId_createdAt_status_idx" ON "Booking"("tenantId", "createdAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_tenantId_date_bookingType_key" ON "Booking"("tenantId", "date", "bookingType");

-- CreateIndex
CREATE INDEX "Service_tenantId_active_idx" ON "Service"("tenantId", "active");

-- CreateIndex
CREATE INDEX "Service_tenantId_idx" ON "Service"("tenantId");

-- CreateIndex
CREATE INDEX "Service_segmentId_idx" ON "Service"("segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_tenantId_slug_key" ON "Service"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "AvailabilityRule_tenantId_dayOfWeek_idx" ON "AvailabilityRule"("tenantId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "AvailabilityRule_serviceId_idx" ON "AvailabilityRule"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityRule_tenantId_serviceId_dayOfWeek_startTime_key" ON "AvailabilityRule"("tenantId", "serviceId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "BookingAddOn_bookingId_idx" ON "BookingAddOn"("bookingId");

-- CreateIndex
CREATE INDEX "BookingAddOn_addOnId_idx" ON "BookingAddOn"("addOnId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_status_idx" ON "Payment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Payment_tenantId_createdAt_idx" ON "Payment"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_processorId_idx" ON "Payment"("processorId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_processorId_key" ON "Payment"("tenantId", "processorId");

-- CreateIndex
CREATE INDEX "BlackoutDate_tenantId_date_idx" ON "BlackoutDate"("tenantId", "date");

-- CreateIndex
CREATE INDEX "BlackoutDate_tenantId_idx" ON "BlackoutDate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BlackoutDate_tenantId_date_key" ON "BlackoutDate"("tenantId", "date");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_status_idx" ON "WebhookEvent"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_createdAt_idx" ON "WebhookEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_idx" ON "WebhookEvent"("tenantId");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventId_idx" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_createdAt_idx" ON "WebhookEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_tenantId_eventId_key" ON "WebhookEvent"("tenantId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EarlyAccessRequest_email_key" ON "EarlyAccessRequest"("email");

-- CreateIndex
CREATE INDEX "EarlyAccessRequest_status_idx" ON "EarlyAccessRequest"("status");

-- CreateIndex
CREATE INDEX "EarlyAccessRequest_createdAt_idx" ON "EarlyAccessRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ConfigChangeLog_tenantId_createdAt_idx" ON "ConfigChangeLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ConfigChangeLog_tenantId_entityType_entityId_idx" ON "ConfigChangeLog"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ConfigChangeLog_tenantId_changeType_idx" ON "ConfigChangeLog"("tenantId", "changeType");

-- CreateIndex
CREATE INDEX "ConfigChangeLog_userId_idx" ON "ConfigChangeLog"("userId");

-- CreateIndex
CREATE INDEX "ConfigChangeLog_tenantId_userId_idx" ON "ConfigChangeLog"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "ConfigChangeLog_entityType_entityId_idx" ON "ConfigChangeLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "WebhookSubscription_tenantId_active_idx" ON "WebhookSubscription"("tenantId", "active");

-- CreateIndex
CREATE INDEX "WebhookSubscription_tenantId_idx" ON "WebhookSubscription"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookSubscription_tenantId_url_key" ON "WebhookSubscription"("tenantId", "url");

-- CreateIndex
CREATE INDEX "WebhookDelivery_subscriptionId_status_idx" ON "WebhookDelivery"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_createdAt_idx" ON "WebhookDelivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_subscriptionId_idx" ON "WebhookDelivery"("subscriptionId");

-- CreateIndex
CREATE INDEX "AgentProposal_tenantId_sessionId_idx" ON "AgentProposal"("tenantId", "sessionId");

-- CreateIndex
CREATE INDEX "AgentProposal_tenantId_status_idx" ON "AgentProposal"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AgentProposal_expiresAt_idx" ON "AgentProposal"("expiresAt");

-- CreateIndex
CREATE INDEX "AgentProposal_status_expiresAt_idx" ON "AgentProposal"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AgentProposal_status_updatedAt_idx" ON "AgentProposal"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "AgentProposal_tenantId_idx" ON "AgentProposal"("tenantId");

-- CreateIndex
CREATE INDEX "AgentProposal_customerId_idx" ON "AgentProposal"("customerId");

-- CreateIndex
CREATE INDEX "AgentAuditLog_tenantId_sessionId_idx" ON "AgentAuditLog"("tenantId", "sessionId");

-- CreateIndex
CREATE INDEX "AgentAuditLog_tenantId_createdAt_idx" ON "AgentAuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentAuditLog_tenantId_toolName_idx" ON "AgentAuditLog"("tenantId", "toolName");

-- CreateIndex
CREATE INDEX "AgentAuditLog_createdAt_idx" ON "AgentAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AgentAuditLog_tenantId_idx" ON "AgentAuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AgentSession_tenantId_updatedAt_idx" ON "AgentSession"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "AgentSession_tenantId_idx" ON "AgentSession"("tenantId");

-- CreateIndex
CREATE INDEX "AgentSession_customerId_updatedAt_idx" ON "AgentSession"("customerId", "updatedAt");

-- CreateIndex
CREATE INDEX "AgentSession_sessionType_updatedAt_idx" ON "AgentSession"("sessionType", "updatedAt");

-- CreateIndex
CREATE INDEX "AgentSession_tenantId_sessionType_updatedAt_idx" ON "AgentSession"("tenantId", "sessionType", "updatedAt");

-- CreateIndex
CREATE INDEX "AgentSession_tenantId_deletedAt_idx" ON "AgentSession"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "AgentSession_id_tenantId_idx" ON "AgentSession"("id", "tenantId");

-- CreateIndex
CREATE INDEX "AgentSession_lastActivityAt_idx" ON "AgentSession"("lastActivityAt");

-- CreateIndex
CREATE INDEX "idx_session_cleanup" ON "AgentSession"("lastActivityAt", "deletedAt");

-- CreateIndex
CREATE INDEX "AgentSessionMessage_sessionId_createdAt_idx" ON "AgentSessionMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentSessionMessage_tenantId_sessionId_idx" ON "AgentSessionMessage"("tenantId", "sessionId");

-- CreateIndex
CREATE INDEX "AgentSessionMessage_idempotencyKey_idx" ON "AgentSessionMessage"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSessionMessage_sessionId_idempotencyKey_key" ON "AgentSessionMessage"("sessionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OnboardingEvent_tenantId_timestamp_idx" ON "OnboardingEvent"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "OnboardingEvent_tenantId_version_idx" ON "OnboardingEvent"("tenantId", "version");

-- CreateIndex
CREATE INDEX "ConversationTrace_tenantId_startedAt_idx" ON "ConversationTrace"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "ConversationTrace_tenantId_agentType_startedAt_idx" ON "ConversationTrace"("tenantId", "agentType", "startedAt");

-- CreateIndex
CREATE INDEX "ConversationTrace_tenantId_flagged_reviewStatus_idx" ON "ConversationTrace"("tenantId", "flagged", "reviewStatus");

-- CreateIndex
CREATE INDEX "ConversationTrace_tenantId_evalScore_idx" ON "ConversationTrace"("tenantId", "evalScore");

-- CreateIndex
CREATE INDEX "ConversationTrace_tenantId_evalScore_startedAt_idx" ON "ConversationTrace"("tenantId", "evalScore", "startedAt");

-- CreateIndex
CREATE INDEX "ConversationTrace_sessionId_idx" ON "ConversationTrace"("sessionId");

-- CreateIndex
CREATE INDEX "ConversationTrace_expiresAt_idx" ON "ConversationTrace"("expiresAt");

-- CreateIndex
CREATE INDEX "AgentUsage_tenantId_timestamp_idx" ON "AgentUsage"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "AgentUsage_tenantId_agentType_timestamp_idx" ON "AgentUsage"("tenantId", "agentType", "timestamp");

-- CreateIndex
CREATE INDEX "UserFeedback_tenantId_sessionId_idx" ON "UserFeedback"("tenantId", "sessionId");

-- CreateIndex
CREATE INDEX "UserFeedback_tenantId_createdAt_idx" ON "UserFeedback"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "UserFeedback_traceId_idx" ON "UserFeedback"("traceId");

-- CreateIndex
CREATE INDEX "UserFeedback_traceId_createdAt_idx" ON "UserFeedback"("traceId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewAction_tenantId_performedAt_idx" ON "ReviewAction"("tenantId", "performedAt");

-- CreateIndex
CREATE INDEX "ReviewAction_traceId_idx" ON "ReviewAction"("traceId");

-- CreateIndex
CREATE INDEX "ReviewAction_tenantId_action_idx" ON "ReviewAction"("tenantId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Project_bookingId_key" ON "Project"("bookingId");

-- CreateIndex
CREATE INDEX "Project_tenantId_idx" ON "Project"("tenantId");

-- CreateIndex
CREATE INDEX "Project_customerId_idx" ON "Project"("customerId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_tenantId_status_idx" ON "Project"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Project_tenantId_customerId_status_idx" ON "Project"("tenantId", "customerId", "status");

-- CreateIndex
CREATE INDEX "ProjectEvent_tenantId_idx" ON "ProjectEvent"("tenantId");

-- CreateIndex
CREATE INDEX "ProjectEvent_projectId_createdAt_idx" ON "ProjectEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectEvent_projectId_visibleToCustomer_idx" ON "ProjectEvent"("projectId", "visibleToCustomer");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEvent_projectId_version_key" ON "ProjectEvent"("projectId", "version");

-- CreateIndex
CREATE INDEX "ProjectFile_tenantId_idx" ON "ProjectFile"("tenantId");

-- CreateIndex
CREATE INDEX "ProjectFile_projectId_deletedAt_idx" ON "ProjectFile"("projectId", "deletedAt");

-- CreateIndex
CREATE INDEX "ProjectFile_projectId_category_idx" ON "ProjectFile"("projectId", "category");

-- CreateIndex
CREATE INDEX "ProjectRequest_tenantId_idx" ON "ProjectRequest"("tenantId");

-- CreateIndex
CREATE INDEX "ProjectRequest_projectId_status_idx" ON "ProjectRequest"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectRequest_status_expiresAt_idx" ON "ProjectRequest"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ProjectRequest_tenantId_status_idx" ON "ProjectRequest"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantDomain" ADD CONSTRAINT "TenantDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddOn" ADD CONSTRAINT "AddOn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddOn" ADD CONSTRAINT "AddOn_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageAddOn" ADD CONSTRAINT "PackageAddOn_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageAddOn" ADD CONSTRAINT "PackageAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddOn" ADD CONSTRAINT "BookingAddOn_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddOn" ADD CONSTRAINT "BookingAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlackoutDate" ADD CONSTRAINT "BlackoutDate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigChangeLog" ADD CONSTRAINT "ConfigChangeLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAuditLog" ADD CONSTRAINT "AgentAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSessionMessage" ADD CONSTRAINT "AgentSessionMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingEvent" ADD CONSTRAINT "OnboardingEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTrace" ADD CONSTRAINT "ConversationTrace_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentUsage" ADD CONSTRAINT "AgentUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "ConversationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAction" ADD CONSTRAINT "ReviewAction_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "ConversationTrace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAction" ADD CONSTRAINT "ReviewAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRequest" ADD CONSTRAINT "ProjectRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
