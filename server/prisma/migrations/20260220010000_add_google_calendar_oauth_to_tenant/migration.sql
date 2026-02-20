-- AlterTable
-- Add googleCalendarConnected flag to Tenant for OAuth connection status tracking
ALTER TABLE "Tenant" ADD COLUMN "googleCalendarConnected" BOOLEAN NOT NULL DEFAULT false;
