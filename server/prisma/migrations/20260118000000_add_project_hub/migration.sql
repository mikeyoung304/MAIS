-- Project Hub Models Migration (Phase 5)
-- Dual-faced customer-tenant communication system with AI mediation
-- Uses DO blocks with exception handling for idempotent enum creation

-- ============================================================================
-- ENUMS (Idempotent creation)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProjectEventType" AS ENUM (
        'PROJECT_CREATED',
        'STATUS_CHANGED',
        'MESSAGE_FROM_CUSTOMER',
        'MESSAGE_FROM_TENANT',
        'MESSAGE_FROM_AGENT',
        'REQUEST_SUBMITTED',
        'REQUEST_APPROVED',
        'REQUEST_DENIED',
        'REQUEST_AUTO_HANDLED',
        'REQUEST_EXPIRED',
        'FILE_UPLOADED',
        'FILE_DELETED',
        'MILESTONE_COMPLETED',
        'REMINDER_SENT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProjectActor" AS ENUM ('CUSTOMER', 'TENANT', 'AGENT', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "FileCategory" AS ENUM (
        'REFERENCE_PHOTO',
        'INSPIRATION',
        'CONTRACT',
        'INVOICE',
        'DELIVERABLE',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RequestType" AS ENUM (
        'RESCHEDULE',
        'ADD_ON',
        'QUESTION',
        'CHANGE_REQUEST',
        'CANCELLATION',
        'REFUND',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'AUTO_HANDLED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RequestHandler" AS ENUM ('AGENT', 'TENANT', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLES (Using IF NOT EXISTS)
-- ============================================================================

-- CreateTable
CREATE TABLE IF NOT EXISTS "Project" (
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
CREATE TABLE IF NOT EXISTS "ProjectEvent" (
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
CREATE TABLE IF NOT EXISTS "ProjectFile" (
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
CREATE TABLE IF NOT EXISTS "ProjectRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestData" JSONB NOT NULL,
    "responseData" JSONB,
    "handledBy" "RequestHandler",
    "resolvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "autoRespondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRequest_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- UNIQUE CONSTRAINTS (IF NOT EXISTS)
-- ============================================================================

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Project_bookingId_key" ON "Project"("bookingId");

-- CreateIndex (Prevent duplicate events via version)
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectEvent_projectId_version_key" ON "ProjectEvent"("projectId", "version");

-- ============================================================================
-- INDEXES (IF NOT EXISTS)
-- ============================================================================

-- Project indexes
CREATE INDEX IF NOT EXISTS "Project_tenantId_idx" ON "Project"("tenantId");
CREATE INDEX IF NOT EXISTS "Project_customerId_idx" ON "Project"("customerId");
CREATE INDEX IF NOT EXISTS "Project_status_idx" ON "Project"("status");
CREATE INDEX IF NOT EXISTS "Project_tenantId_status_idx" ON "Project"("tenantId", "status");

-- ProjectEvent indexes
CREATE INDEX IF NOT EXISTS "ProjectEvent_tenantId_idx" ON "ProjectEvent"("tenantId");
CREATE INDEX IF NOT EXISTS "ProjectEvent_projectId_createdAt_idx" ON "ProjectEvent"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProjectEvent_projectId_visibleToCustomer_idx" ON "ProjectEvent"("projectId", "visibleToCustomer");

-- ProjectFile indexes
CREATE INDEX IF NOT EXISTS "ProjectFile_tenantId_idx" ON "ProjectFile"("tenantId");
CREATE INDEX IF NOT EXISTS "ProjectFile_projectId_deletedAt_idx" ON "ProjectFile"("projectId", "deletedAt");
CREATE INDEX IF NOT EXISTS "ProjectFile_projectId_category_idx" ON "ProjectFile"("projectId", "category");

-- ProjectRequest indexes
CREATE INDEX IF NOT EXISTS "ProjectRequest_tenantId_idx" ON "ProjectRequest"("tenantId");
CREATE INDEX IF NOT EXISTS "ProjectRequest_projectId_status_idx" ON "ProjectRequest"("projectId", "status");
CREATE INDEX IF NOT EXISTS "ProjectRequest_status_expiresAt_idx" ON "ProjectRequest"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "ProjectRequest_tenantId_status_idx" ON "ProjectRequest"("tenantId", "status");

-- ============================================================================
-- FOREIGN KEYS (with DO blocks for idempotency)
-- ============================================================================

DO $$ BEGIN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_bookingId_fkey"
        FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ProjectRequest" ADD CONSTRAINT "ProjectRequest_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
